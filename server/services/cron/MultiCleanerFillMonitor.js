/**
 * Multi-Cleaner Fill Monitor Job
 *
 * Monitors unfilled multi-cleaner jobs and sends notifications:
 * - 7 days before: Urgent fill notifications to nearby cleaners
 * - 3 days before: Final warning to homeowner with options
 */

const { Op } = require("sequelize");
const {
  MultiCleanerJob,
  UserAppointments,
  UserHomes,
  User,
  CleanerJobCompletion,
} = require("../../models");
const NotificationService = require("../NotificationService");
const MultiCleanerService = require("../MultiCleanerService");
const MultiCleanerPricingService = require("../MultiCleanerPricingService");
const { getPricingConfig } = require("../../config/businessConfig");
const EncryptionService = require("../EncryptionService");

/**
 * Process jobs that need urgent fill notifications (7 days out)
 * Sends notifications every 6 hours until the job is filled
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processUrgentFillNotifications(io = null) {
  const config = await getPricingConfig();
  const urgentDays = config?.multiCleaner?.urgentFillDays || 7;
  const urgentIntervalHours = config?.multiCleaner?.urgentNotificationIntervalHours || 6;

  const urgentDate = new Date();
  urgentDate.setDate(urgentDate.getDate() + urgentDays);
  const urgentDateStr = urgentDate.toISOString().split("T")[0];

  // Time threshold for resending notifications (6 hours ago)
  const resendThreshold = new Date();
  resendThreshold.setHours(resendThreshold.getHours() - urgentIntervalHours);

  // Find jobs that need urgent notifications:
  // - Status is open or partially_filled
  // - Appointment date is within 7 days
  // - Either never notified OR last notified more than 6 hours ago
  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: { [Op.in]: ["open", "partially_filled"] },
      [Op.or]: [
        { urgentNotificationSentAt: null },
        { urgentNotificationSentAt: { [Op.lte]: resendThreshold } },
      ],
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          date: { [Op.lte]: urgentDateStr },
        },
        include: [{ model: UserHomes, as: "home" }],
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const { appointment } = job;
      const slotsRemaining = job.getRemainingSlots();

      // Skip if no slots remaining (shouldn't happen but safety check)
      if (slotsRemaining <= 0) continue;

      // Calculate earnings for the offer
      const totalPrice = await MultiCleanerPricingService.calculateTotalJobPrice(
        appointment.home,
        appointment,
        job.totalCleanersRequired
      );
      const earningsBreakdown = await MultiCleanerPricingService.calculatePerCleanerEarnings(
        totalPrice,
        job.totalCleanersRequired
      );
      const perCleanerEarnings = earningsBreakdown.cleanerEarnings[0]?.netAmount || 0;

      // Calculate days until appointment for urgency messaging
      const appointmentDate = new Date(appointment.date);
      const today = new Date();
      const daysUntil = Math.ceil((appointmentDate - today) / (1000 * 60 * 60 * 24));

      // Find nearby cleaners to notify
      // For now, notify all cleaners - in production, filter by location
      const cleaners = await User.findAll({
        where: {
          type: "cleaner",
          accountFrozen: false,
        },
        attributes: ["id", "firstName", "expoPushToken"],
        limit: 50,
      });

      // Get already assigned cleaner IDs
      const assignedCleanerIds = await CleanerJobCompletion.findAll({
        where: { multiCleanerJobId: job.id },
        attributes: ["cleanerId"],
      }).then((completions) => completions.map((c) => c.cleanerId));

      // Build urgent message based on days remaining
      let urgencyPrefix = "";
      if (daysUntil <= 1) {
        urgencyPrefix = "🚨 URGENT: ";
      } else if (daysUntil <= 3) {
        urgencyPrefix = "⚠️ ";
      }

      // Notify eligible cleaners
      let notifiedCount = 0;
      for (const cleaner of cleaners) {
        if (assignedCleanerIds.includes(cleaner.id)) continue;

        await NotificationService.createNotification({
          userId: cleaner.id,
          type: "multi_cleaner_urgent",
          title: `${urgencyPrefix}Multi-cleaner job needs you!`,
          body: `$${(perCleanerEarnings / 100).toFixed(2)} for ${slotsRemaining > 1 ? "one of " : ""}${slotsRemaining} open slot(s) - ${daysUntil} day${daysUntil !== 1 ? "s" : ""} away`,
          data: {
            appointmentId: appointment.id,
            multiCleanerJobId: job.id,
            earningsOffered: perCleanerEarnings,
            daysUntilAppointment: daysUntil,
          },
          actionRequired: true,
          expiresAt: new Date(Date.now() + urgentIntervalHours * 60 * 60 * 1000), // Expires at next notification cycle
        });
        notifiedCount++;
      }

      // Update last notification time
      await job.update({ urgentNotificationSentAt: new Date() });
      processed++;

      const isResend = job.urgentNotificationSentAt !== null;
      console.log(
        `[MultiCleanerFillMonitor] ${isResend ? "Resent" : "Sent"} urgent fill notifications for job ${job.id} to ${notifiedCount} cleaners (${daysUntil} days until appointment)`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing urgent fill for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Process jobs that need homeowner final warning (3 days out)
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processFinalWarnings(io = null) {
  const config = await getPricingConfig();
  const finalDays = config?.multiCleaner?.finalWarningDays || 3;

  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + finalDays);
  const warningDateStr = warningDate.toISOString().split("T")[0];

  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: { [Op.in]: ["open", "partially_filled"] },
      finalWarningAt: null,
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          date: { [Op.lte]: warningDateStr },
        },
        include: [
          { model: UserHomes, as: "home" },
          { model: User, as: "user" },
        ],
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const { appointment } = job;
      const slotsRemaining = job.getRemainingSlots();
      const cleanersConfirmed = job.cleanersConfirmed;

      let message;
      if (cleanersConfirmed === 0) {
        message = `Your ${appointment.date} appointment still needs ${slotsRemaining} cleaner(s). You can proceed with fewer cleaners, reschedule, or cancel without penalty.`;
      } else {
        message = `Your ${appointment.date} appointment has ${cleanersConfirmed} cleaner(s) assigned but still needs ${slotsRemaining} more. You can proceed with fewer cleaners or take other action.`;
      }

      // Notify homeowner
      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "multi_cleaner_final_warning",
        title: "Action needed for your cleaning",
        body: message,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId: job.id,
          cleanersNeeded: job.totalCleanersRequired,
          cleanersConfirmed: cleanersConfirmed,
          slotsRemaining: slotsRemaining,
          options: ["proceed_with_one", "cancel", "reschedule"],
        },
        actionRequired: true,
      });

      // Mark as sent
      await job.update({ finalWarningAt: new Date() });
      processed++;

      console.log(
        `[MultiCleanerFillMonitor] Sent final warning for job ${job.id} to homeowner ${appointment.userId}`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing final warning for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Process jobs that have some cleaners but still have unfilled slots
 * Offer solo completion to remaining cleaners (1 day out)
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number processed
 */
async function processSoloCompletionOffers(io = null) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: "partially_filled",
      cleanersConfirmed: 1, // Exactly 1 cleaner
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          date: { [Op.lte]: tomorrowStr },
        },
      },
      {
        model: CleanerJobCompletion,
        as: "completions",
        where: {
          status: { [Op.notIn]: ["dropped_out", "no_show"] },
        },
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const remainingCleaner = job.completions[0];
      if (!remainingCleaner) continue;

      await MultiCleanerService.offerSoloCompletion(job.id, remainingCleaner.cleanerId);
      processed++;

      console.log(
        `[MultiCleanerFillMonitor] Offered solo completion for job ${job.id} to cleaner ${remainingCleaner.cleanerId}`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing solo completion for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Main monitor function - runs all checks
 * @param {Object} io - Socket.io instance
 * @returns {Object} Summary of processing
 */
async function processMultiCleanerFillMonitor(io = null) {
  console.log("[MultiCleanerFillMonitor] Starting fill monitor job...");

  const results = {
    urgentFillNotifications: 0,
    finalWarnings: 0,
    soloCompletionOffers: 0,
    errors: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    results.urgentFillNotifications = await processUrgentFillNotifications(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in urgent fill:", error);
    results.errors++;
  }

  try {
    results.finalWarnings = await processFinalWarnings(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in final warnings:", error);
    results.errors++;
  }

  try {
    results.soloCompletionOffers = await processSoloCompletionOffers(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in solo offers:", error);
    results.errors++;
  }

  console.log(
    `[MultiCleanerFillMonitor] Completed. Urgent: ${results.urgentFillNotifications}, Warnings: ${results.finalWarnings}, Solo: ${results.soloCompletionOffers}`
  );

  return results;
}

/**
 * Start the monitor as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 * @returns {Object} Interval reference for cleanup
 */
function startFillMonitorJob(io, intervalMs = 60 * 60 * 1000) {
  console.log(
    `[MultiCleanerFillMonitor] Starting fill monitor job (interval: ${intervalMs}ms)`
  );

  // Run immediately on start
  processMultiCleanerFillMonitor(io).catch((err) => {
    console.error("[MultiCleanerFillMonitor] Error on initial run:", err);
  });

  // Then run on interval
  const interval = setInterval(() => {
    processMultiCleanerFillMonitor(io).catch((err) => {
      console.error("[MultiCleanerFillMonitor] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processMultiCleanerFillMonitor,
  startFillMonitorJob,
  processUrgentFillNotifications,
  processFinalWarnings,
  processSoloCompletionOffers,
};
