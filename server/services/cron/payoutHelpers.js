/**
 * Payout Helpers
 * Shared payout functions for single-cleaner and multi-cleaner jobs
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
  UserPendingRequests,
  sequelize,
} = require("../../models");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { getPricingConfig } = require("../../config/businessConfig");
const MultiCleanerPricingService = require("../MultiCleanerPricingService");
const BusinessVolumeService = require("../BusinessVolumeService");
const EmployeeDirectPayoutService = require("../EmployeeDirectPayoutService");
const IncentiveService = require("../IncentiveService");

/**
 * Process payout for a single-cleaner job after approval
 * Used by both manual approval and auto-approval flows
 * Uses database transactions to ensure atomicity of payout operations
 * @param {Object} appointment - The appointment record
 * @returns {Array} Array of payout results for each cleaner
 */
async function processSingleCleanerPayout(appointment) {
  const results = [];

  try {
    // Clean up any pending requests for this completed appointment
    await UserPendingRequests.destroy({
      where: { appointmentId: appointment.id },
    });

    const cleanerIds = appointment.employeesAssigned || [];

    if (cleanerIds.length === 0) {
      console.log(`[PayoutHelpers] No cleaners assigned to appointment ${appointment.id}`);
      return [{ status: "skipped", reason: "No cleaners assigned" }];
    }

    // Get platform fee from database
    const pricing = await getPricingConfig();
    const platformFeePercent = pricing.platform.feePercent;

    for (const cleanerIdStr of cleanerIds) {
      const cleanerId = parseInt(cleanerIdStr, 10);

      // Use a transaction for each cleaner's payout to ensure atomicity
      const t = await sequelize.transaction();

      try {
        // Get or check existing payout record with row lock
        let payout = await Payout.findOne({
          where: { appointmentId: appointment.id, cleanerId },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (payout && payout.status === "completed") {
          await t.commit();
          results.push({ cleanerId, status: "already_paid" });
          continue;
        }

        // Get cleaner's Stripe Connect account
        const connectAccount = await StripeConnectAccount.findOne({
          where: { userId: cleanerId },
          transaction: t,
        });

        if (!connectAccount || !connectAccount.payoutsEnabled) {
          await t.commit();
          results.push({
            cleanerId,
            status: "skipped",
            reason: "Cleaner has not completed Stripe onboarding",
          });
          continue;
        }

        // Calculate amounts - price is already stored in cents (INTEGER)
        // Use original price for cleaner payout if discount was applied
        // Business decision: Platform absorbs the discount, cleaners aren't penalized
        const priceInCents = appointment.discountApplied && appointment.originalPrice
          ? parseInt(appointment.originalPrice, 10)
          : appointment.price;
        const perCleanerGross = Math.round(priceInCents / cleanerIds.length);

        // Check for incentive-based fee reduction
        const feeResult = await IncentiveService.calculateCleanerFee(
          cleanerId,
          perCleanerGross,
          platformFeePercent
        );

        const platformFee = feeResult.platformFee;
        const netAmount = feeResult.netAmount;

        // Validate netAmount is positive - Stripe requires at least 1 cent
        if (netAmount < 1) {
          await t.commit();
          console.warn(`[PayoutHelpers] Payout skipped for cleaner ${cleanerId}: netAmount too low (${netAmount} cents)`);
          results.push({
            cleanerId,
            status: "skipped",
            reason: `Net amount too low after platform fee: ${netAmount} cents`,
          });
          continue;
        }

        // Create payout record if it doesn't exist
        if (!payout) {
          payout = await Payout.create({
            appointmentId: appointment.id,
            cleanerId,
            grossAmount: perCleanerGross,
            platformFee,
            netAmount,
            status: "processing",
            paymentCapturedAt: new Date(),
            transferInitiatedAt: new Date(),
            incentiveApplied: feeResult.incentiveApplied || false,
            originalPlatformFee: feeResult.originalPlatformFee || null,
          }, { transaction: t });
        } else {
          await payout.update({
            grossAmount: perCleanerGross,
            platformFee,
            netAmount,
            status: "processing",
            transferInitiatedAt: new Date(),
            incentiveApplied: feeResult.incentiveApplied || false,
            originalPlatformFee: feeResult.originalPlatformFee || null,
          }, { transaction: t });
        }

        // Commit the "processing" state before calling Stripe
        // This ensures we have a record of the payout attempt
        await t.commit();

        // Get the charge ID from payment intent (outside transaction - read-only Stripe call)
        let chargeId = null;
        if (appointment.paymentIntentId) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
            chargeId = paymentIntent.latest_charge;
          } catch (err) {
            console.error(`[PayoutHelpers] Could not retrieve payment intent:`, err.message);
          }
        }

        // Create Stripe Transfer (external API call - cannot be part of DB transaction)
        const transferParams = {
          amount: netAmount,
          currency: "usd",
          destination: connectAccount.stripeAccountId,
          metadata: {
            appointmentId: appointment.id.toString(),
            cleanerId: cleanerId.toString(),
            payoutId: payout.id.toString(),
          },
        };

        if (chargeId) {
          transferParams.source_transaction = chargeId;
        }

        let transfer;
        try {
          transfer = await stripe.transfers.create(transferParams);
        } catch (stripeError) {
          const errorMessage = stripeError.message || "Unknown Stripe error";
          const errorCode = stripeError.code || "unknown";

          console.error(`[PayoutHelpers] Stripe transfer failed for cleaner ${cleanerId}:`, {
            code: errorCode,
            message: errorMessage,
          });

          // Update payout status to failed (new transaction for the update)
          const tFailed = await sequelize.transaction();
          try {
            await payout.update({
              status: "failed",
              failureReason: `Stripe transfer failed: ${errorCode} - ${errorMessage}`,
              completedAt: new Date(),
            }, { transaction: tFailed });
            await tFailed.commit();
          } catch (updateErr) {
            await tFailed.rollback();
            console.error(`[PayoutHelpers] Failed to update payout status to failed:`, updateErr);
          }

          results.push({
            cleanerId,
            status: "failed",
            reason: errorCode,
            error: errorMessage,
            canRetry: errorCode !== "account_invalid",
            payoutId: payout.id,
          });
          continue;
        }

        // Stripe transfer succeeded - update payout status (new transaction)
        const tSuccess = await sequelize.transaction();
        try {
          await payout.update({
            stripeTransferId: transfer.id,
            status: "completed",
            completedAt: new Date(),
          }, { transaction: tSuccess });
          await tSuccess.commit();
        } catch (updateErr) {
          await tSuccess.rollback();
          // Critical: Stripe transfer succeeded but we couldn't update the record
          // Log for manual reconciliation
          console.error(`[PayoutHelpers] CRITICAL: Stripe transfer ${transfer.id} succeeded but failed to update payout record:`, updateErr);
          results.push({
            cleanerId,
            status: "success_db_error",
            transferId: transfer.id,
            amountCents: netAmount,
            error: "Transfer succeeded but database update failed - requires manual reconciliation",
          });
          continue;
        }

        results.push({
          cleanerId,
          status: "success",
          transferId: transfer.id,
          amountCents: netAmount,
        });

        console.log(`[PayoutHelpers] Successfully paid cleaner ${cleanerId} $${(netAmount / 100).toFixed(2)} for appointment ${appointment.id}`);
      } catch (error) {
        // Rollback transaction if it's still active
        try {
          await t.rollback();
        } catch (rollbackErr) {
          // Transaction may already be committed/rolled back
        }
        console.error(`[PayoutHelpers] Single-cleaner payout error for cleaner ${cleanerId}:`, error);
        results.push({ cleanerId, status: "error", error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error(`[PayoutHelpers] processSingleCleanerPayout error:`, error);
    throw error;
  }
}

/**
 * Process payout for a specific cleaner in a multi-cleaner job
 * Handles both marketplace cleaners and business employees
 * Uses database transactions to ensure atomicity of payout operations
 */
async function processMultiCleanerPayoutForCleaner(appointment, cleanerId) {
  // Start transaction for initial setup and payout creation
  const t = await sequelize.transaction();

  try {
    const multiCleanerJob = await MultiCleanerJob.findByPk(appointment.multiCleanerJobId, { transaction: t });
    if (!multiCleanerJob) {
      await t.rollback();
      throw new Error("Multi-cleaner job not found");
    }

    // Get room assignments for this cleaner
    const roomAssignments = await CleanerRoomAssignment.findAll({
      where: {
        appointmentId: appointment.id,
        cleanerId,
      },
      transaction: t,
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
      transaction: t,
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

    // Get or create payout record with row lock
    let payout = await Payout.findOne({
      where: { appointmentId: appointment.id, cleanerId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (payout && payout.status === "completed") {
      await t.commit();
      return { cleanerId, status: "already_paid" };
    }

    // Get the payout recipient's Stripe Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: payoutRecipientId },
      transaction: t,
    });

    if (!connectAccount || !connectAccount.payoutsEnabled) {
      await t.commit();
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

    // Validate netAmount is positive - Stripe requires at least 1 cent
    if (netAmount < 1) {
      await t.commit();
      console.warn(`[PayoutHelpers] Multi-cleaner payout skipped for cleaner ${cleanerId}: netAmount too low (${netAmount} cents)`);
      return {
        cleanerId,
        status: "skipped",
        reason: `Net amount too low after platform fee: ${netAmount} cents`,
      };
    }

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
      }, { transaction: t });
    } else {
      await payout.update({
        grossAmount,
        platformFee,
        netAmount,
        status: "processing",
        transferInitiatedAt: new Date(),
        payoutType: isBusinessEmployee ? "business_employee" : "marketplace",
      }, { transaction: t });
    }

    // Commit the "processing" state before calling Stripe
    await t.commit();

    // Get the charge ID (outside transaction - read-only Stripe call)
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
        // Update records atomically in a new transaction
        const tSplit = await sequelize.transaction();
        try {
          // Update payout record with the business owner's portion
          await payout.update({
            stripeTransferId: splitResult.businessOwnerPayout?.transferId,
            status: "completed",
            transferCompletedAt: new Date(),
          }, { transaction: tSplit });

          // Update CleanerJobCompletion
          await CleanerJobCompletion.update(
            { payoutId: payout.id },
            { where: { appointmentId: appointment.id, cleanerId }, transaction: tSplit }
          );

          await tSplit.commit();
        } catch (updateErr) {
          await tSplit.rollback();
          console.error(`[PayoutHelpers] Failed to update records after split payout:`, updateErr);
          return {
            cleanerId,
            status: "success_db_error",
            transferId: splitResult.businessOwnerPayout?.transferId,
            error: "Split payout succeeded but database update failed - requires manual reconciliation",
          };
        }

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

      // Update payout status to failed with reason (new transaction)
      const tFailed = await sequelize.transaction();
      try {
        await payout.update({
          status: "failed",
          failureReason: `Stripe transfer failed: ${errorCode} - ${errorMessage}`,
          completedAt: new Date(),
        }, { transaction: tFailed });
        await tFailed.commit();
      } catch (updateErr) {
        await tFailed.rollback();
        console.error(`[PayoutHelpers] Failed to update payout status to failed:`, updateErr);
      }

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

    // Stripe transfer succeeded - update all related records atomically
    const tSuccess = await sequelize.transaction();
    try {
      await payout.update({
        stripeTransferId: transfer.id,
        status: "completed",
        transferCompletedAt: new Date(),
      }, { transaction: tSuccess });

      // Update CleanerJobCompletion with payout ID
      await CleanerJobCompletion.update(
        { payoutId: payout.id },
        { where: { appointmentId: appointment.id, cleanerId }, transaction: tSuccess }
      );

      // Update EmployeeJobAssignment payout status if business employee
      // If direct payouts are enabled but employee doesn't have Stripe set up,
      // keep status as "pending" so business owner knows to pay them manually
      if (isBusinessEmployee && employeeAssignment) {
        const directPayoutsEnabled = await EmployeeDirectPayoutService.isDirectPayoutEnabled(businessOwnerId);

        if (directPayoutsEnabled && employeeAssignment.payAmount > 0) {
          // Direct payouts enabled but we fell through to business owner
          // This means employee doesn't have Stripe set up - keep as pending for manual payment
          await employeeAssignment.update({
            payoutStatus: "pending",
            payoutMethod: "pending_manual",
            businessOwnerPaidAmount: netAmount,
          }, { transaction: tSuccess });
          console.log(
            `[PayoutHelpers] Employee ${employeeAssignment.businessEmployeeId} needs manual payment - Stripe not set up`
          );
        } else {
          // Direct payouts not enabled - all goes to owner, mark as paid (owner handles payment)
          await employeeAssignment.update({
            payoutStatus: "paid",
            payoutMethod: "business_owner",
            businessOwnerPaidAmount: netAmount,
          }, { transaction: tSuccess });
        }
      }

      await tSuccess.commit();
    } catch (updateErr) {
      await tSuccess.rollback();
      // Critical: Stripe transfer succeeded but we couldn't update the records
      console.error(`[PayoutHelpers] CRITICAL: Stripe transfer ${transfer.id} succeeded but failed to update records:`, updateErr);
      return {
        cleanerId,
        status: "success_db_error",
        transferId: transfer.id,
        isBusinessEmployee,
        payoutRecipientId,
        error: "Transfer succeeded but database update failed - requires manual reconciliation",
      };
    }

    return {
      cleanerId,
      status: "success",
      transferId: transfer.id,
      isBusinessEmployee,
      payoutRecipientId,
    };
  } catch (error) {
    // Rollback transaction if it's still active
    try {
      await t.rollback();
    } catch (rollbackErr) {
      // Transaction may already be committed/rolled back
    }
    console.error(`[PayoutHelpers] Multi-cleaner payout error for cleaner ${cleanerId}:`, error);
    return { cleanerId, status: "error", error: error.message };
  }
}

module.exports = {
  processSingleCleanerPayout,
  processMultiCleanerPayoutForCleaner,
};
