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
} = require("../../models");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { getPricingConfig } = require("../../config/businessConfig");
const MultiCleanerPricingService = require("../MultiCleanerPricingService");

/**
 * Process payout for a specific cleaner in a multi-cleaner job
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

    // Calculate this cleaner's share
    const pricing = await getPricingConfig();
    const cleanerShare = await MultiCleanerPricingService.calculateCleanerShare(
      appointment,
      multiCleanerJob,
      cleanerId,
      roomAssignments,
      pricing
    );

    // Get or create payout record
    let payout = await Payout.findOne({
      where: { appointmentId: appointment.id, cleanerId },
    });

    if (payout && payout.status === "completed") {
      return { cleanerId, status: "already_paid" };
    }

    // Get cleaner's Stripe Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: cleanerId },
    });

    if (!connectAccount || !connectAccount.payoutsEnabled) {
      return {
        cleanerId,
        status: "skipped",
        reason: "Cleaner has not completed Stripe onboarding",
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
      });
    } else {
      await payout.update({
        grossAmount,
        platformFee,
        netAmount,
        status: "processing",
        transferInitiatedAt: new Date(),
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

    // Create Stripe Transfer
    const transferParams = {
      amount: netAmount,
      currency: "usd",
      destination: connectAccount.stripeAccountId,
      metadata: {
        appointmentId: appointment.id.toString(),
        cleanerId: cleanerId.toString(),
        payoutId: payout.id.toString(),
        multiCleanerJobId: multiCleanerJob.id.toString(),
      },
    };

    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }

    const transfer = await stripe.transfers.create(transferParams);

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

    return { cleanerId, status: "success", transferId: transfer.id };
  } catch (error) {
    console.error(`[PayoutHelpers] Multi-cleaner payout error for cleaner ${cleanerId}:`, error);
    return { cleanerId, status: "error", error: error.message };
  }
}

module.exports = {
  processMultiCleanerPayoutForCleaner,
};
