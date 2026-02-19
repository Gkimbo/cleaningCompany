/**
 * Payout Helpers
 * Shared payout functions for multi-cleaner jobs
 */

const {
  Payout,
  StripeConnectAccount,
  MultiCleanerJob,
  CleanerRoomAssignment,
  CleanerJobCompletion,
  EmployeeJobAssignment,
  BusinessEmployee,
  User,
} = require("../../models");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { getPricingConfig } = require("../../config/businessConfig");
const MultiCleanerPricingService = require("../MultiCleanerPricingService");
const BusinessVolumeService = require("../BusinessVolumeService");
const EmployeeDirectPayoutService = require("../EmployeeDirectPayoutService");

/**
 * Process payout for a specific cleaner in a multi-cleaner job
 * Handles both marketplace cleaners and business employees
 */
async function processMultiCleanerPayoutForCleaner(appointment, cleanerId) {
  try {
    const multiCleanerJob = await MultiCleanerJob.findByPk(appointment.multiCleanerJobId);
    if (!multiCleanerJob) {
      throw new Error("Multi-cleaner job not found");
    }

    // Get room assignments for this cleaner
    const roomAssignments = await CleanerRoomAssignment.findAll({
      where: {
        appointmentId: appointment.id,
        cleanerId,
      },
    });

    // Check if this cleaner is a business employee for this job
    let isBusinessEmployee = false;
    let businessOwnerId = null;
    let payoutRecipientId = cleanerId;

    const employeeAssignment = await EmployeeJobAssignment.findOne({
      where: { appointmentId: appointment.id },
      include: [{
        model: BusinessEmployee,
        as: "employee",
        where: { userId: cleanerId },
        required: true,
      }],
    });

    if (employeeAssignment) {
      isBusinessEmployee = true;
      businessOwnerId = employeeAssignment.businessOwnerId;
      payoutRecipientId = businessOwnerId; // Default: route payout to business owner
      console.log(`[PayoutHelpers] Cleaner ${cleanerId} is business employee of owner ${businessOwnerId}`);

      // Check if direct employee payouts are enabled
      const directPayoutEnabled = await EmployeeDirectPayoutService.isDirectPayoutEnabled(businessOwnerId);
      if (directPayoutEnabled) {
        const eligibility = await EmployeeDirectPayoutService.canEmployeeReceiveDirectPayout(employeeAssignment);
        if (eligibility.canReceive) {
          console.log(`[PayoutHelpers] Direct employee payout enabled for cleaner ${cleanerId}`);
          // We'll handle the split payout after calculating the amounts
          employeeAssignment.useDirectPayout = true;
          employeeAssignment.employeeStripeAccount = eligibility.stripeAccountId;
        }
      }
    }

    // Get pricing config and determine applicable fee
    const pricing = await getPricingConfig();
    let applicableFeePercent;

    if (isBusinessEmployee) {
      // Check if business qualifies for large business discount
      const qualification = await BusinessVolumeService.qualifiesForLargeBusinessFee(businessOwnerId);
      if (qualification.qualifies) {
        applicableFeePercent = pricing?.platform?.largeBusinessFeePercent || 0.07;
      } else {
        applicableFeePercent = pricing?.platform?.businessOwnerFeePercent || 0.10;
      }
      console.log(`[PayoutHelpers] Using business owner fee: ${applicableFeePercent * 100}%`);
    }

    // Calculate this cleaner's share with appropriate fee
    const cleanerShare = await MultiCleanerPricingService.calculateCleanerShare(
      appointment,
      multiCleanerJob,
      cleanerId,
      roomAssignments,
      pricing,
      isBusinessEmployee ? {
        isBusinessEmployee: true,
        businessOwnerFeePercent: applicableFeePercent,
      } : {}
    );

    // Get or create payout record
    let payout = await Payout.findOne({
      where: { appointmentId: appointment.id, cleanerId },
    });

    if (payout && payout.status === "completed") {
      return { cleanerId, status: "already_paid" };
    }

    // Get the payout recipient's Stripe Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: payoutRecipientId },
    });

    if (!connectAccount || !connectAccount.payoutsEnabled) {
      return {
        cleanerId,
        status: "skipped",
        reason: isBusinessEmployee
          ? "Business owner has not completed Stripe onboarding"
          : "Cleaner has not completed Stripe onboarding",
      };
    }

    const grossAmount = cleanerShare.grossAmount;
    const platformFee = cleanerShare.platformFee;
    const netAmount = cleanerShare.netAmount;

    // Create payout record if it doesn't exist
    if (!payout) {
      payout = await Payout.create({
        appointmentId: appointment.id,
        cleanerId,
        grossAmount,
        platformFee,
        netAmount,
        status: "processing",
        paymentCapturedAt: new Date(),
        transferInitiatedAt: new Date(),
        payoutType: isBusinessEmployee ? "business_employee" : "marketplace",
      });
    } else {
      await payout.update({
        grossAmount,
        platformFee,
        netAmount,
        status: "processing",
        transferInitiatedAt: new Date(),
        payoutType: isBusinessEmployee ? "business_employee" : "marketplace",
      });
    }

    // Get the charge ID
    let chargeId = null;
    if (appointment.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
        chargeId = paymentIntent.latest_charge;
      } catch (err) {
        console.error(`Could not retrieve payment intent:`, err.message);
      }
    }

    // Check if we should use direct employee payout (split between employee and owner)
    if (isBusinessEmployee && employeeAssignment?.useDirectPayout) {
      console.log(`[PayoutHelpers] Processing split payout for employee ${cleanerId}`);

      const splitResult = await EmployeeDirectPayoutService.processSplitPayout(
        appointment,
        employeeAssignment,
        netAmount,
        chargeId,
        payout
      );

      if (splitResult.payoutMethod === "split" || splitResult.payoutMethod === "direct_to_employee" || splitResult.payoutMethod === "batched_biweekly") {
        // Update payout record with the business owner's portion
        await payout.update({
          stripeTransferId: splitResult.businessOwnerPayout?.transferId,
          status: "completed",
          transferCompletedAt: new Date(),
        });

        // Update CleanerJobCompletion
        await CleanerJobCompletion.update(
          { payoutId: payout.id },
          { where: { appointmentId: appointment.id, cleanerId } }
        );

        // For batched payouts, employee payout is pending
        const isBatched = splitResult.payoutMethod === "batched_biweekly";

        return {
          cleanerId,
          status: "success",
          transferId: splitResult.businessOwnerPayout?.transferId,
          isBusinessEmployee,
          payoutRecipientId,
          directPayout: true,
          // For batched, employee transfer is pending
          employeePayoutPending: isBatched,
          employeePendingPayoutId: isBatched ? splitResult.employeePayout?.pendingPayoutId : null,
          employeeScheduledPayoutDate: isBatched ? splitResult.employeePayout?.scheduledPayoutDate : null,
          employeeTransferId: isBatched ? null : splitResult.employeePayout?.transferId,
          employeeAmount: splitResult.employeePayout?.amount,
          businessOwnerAmount: splitResult.businessOwnerPayout?.amount,
        };
      }
      // Fall through to normal payout if split failed
      console.log(`[PayoutHelpers] Split payout failed (${splitResult.fallbackReason}), falling back to business owner`);
    }

    // Create Stripe Transfer (standard flow - all to business owner or marketplace cleaner)
    const transferParams = {
      amount: netAmount,
      currency: "usd",
      destination: connectAccount.stripeAccountId,
      metadata: {
        appointmentId: appointment.id.toString(),
        cleanerId: cleanerId.toString(),
        payoutId: payout.id.toString(),
        multiCleanerJobId: multiCleanerJob.id.toString(),
        ...(isBusinessEmployee && {
          isBusinessEmployee: "true",
          businessOwnerId: businessOwnerId.toString(),
          payoutRecipientId: payoutRecipientId.toString(),
        }),
      },
    };

    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }

    let transfer;
    try {
      transfer = await stripe.transfers.create(transferParams);
    } catch (stripeError) {
      // Handle Stripe transfer errors gracefully
      const errorMessage = stripeError.message || "Unknown Stripe error";
      const errorCode = stripeError.code || "unknown";

      console.error(`[PayoutHelpers] Stripe transfer failed for cleaner ${cleanerId}:`, {
        code: errorCode,
        message: errorMessage,
        type: stripeError.type,
      });

      // Update payout status to failed with reason
      await payout.update({
        status: "failed",
        failureReason: `Stripe transfer failed: ${errorCode} - ${errorMessage}`,
        completedAt: new Date(),
      });

      // Return graceful error response with specific handling for balance issues
      if (errorCode === "balance_insufficient") {
        return {
          cleanerId,
          status: "failed",
          reason: "insufficient_stripe_balance",
          error: "Platform has insufficient funds in Stripe account. Please add funds and retry the payout.",
          canRetry: true,
          payoutId: payout.id,
        };
      }

      return {
        cleanerId,
        status: "failed",
        reason: errorCode,
        error: errorMessage,
        canRetry: errorCode !== "account_invalid",
        payoutId: payout.id,
      };
    }

    await payout.update({
      stripeTransferId: transfer.id,
      status: "completed",
      transferCompletedAt: new Date(),
    });

    // Update CleanerJobCompletion with payout ID
    await CleanerJobCompletion.update(
      { payoutId: payout.id },
      { where: { appointmentId: appointment.id, cleanerId } }
    );

    // Update EmployeeJobAssignment payout status if business employee
    if (isBusinessEmployee && employeeAssignment) {
      await employeeAssignment.update({
        payoutStatus: "paid",
        payoutMethod: "business_owner",
        businessOwnerPaidAmount: netAmount,
      });
    }

    return {
      cleanerId,
      status: "success",
      transferId: transfer.id,
      isBusinessEmployee,
      payoutRecipientId,
    };
  } catch (error) {
    console.error(`[PayoutHelpers] Multi-cleaner payout error for cleaner ${cleanerId}:`, error);
    return { cleanerId, status: "error", error: error.message };
  }
}

module.exports = {
  processMultiCleanerPayoutForCleaner,
};
