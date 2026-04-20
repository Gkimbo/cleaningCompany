/**
 * Expired Appointment Monitor Job
 *
 * Monitors and handles appointments (both solo and multi-cleaner) that were never cleaned:
 * - Past due by 24+ hours
 * - Never started or completed
 * - Marks them as system-cancelled with category "expired_no_show"
 * - Sends notification to homeowner
 *
 * This ensures these appointments don't show up in:
 * - Homeowner's "Recent Cleanings" section
 * - Cleaner's Payout Overview "Your Assignments" section
 */

const { Op } = require("sequelize");
const {
  MultiCleanerJob,
  UserAppointments,
  UserHomes,
  User,
  CleanerJobCompletion,
  UserCleanerAppointments,
  Notification,
} = require("../../models");
const NotificationService = require("../NotificationService");
const EncryptionService = require("../EncryptionService");
const TimezoneService = require("../TimezoneService");

// Notification types that should be cleaned up for expired appointments
const STALE_NOTIFICATION_TYPES = [
  "solo_completion_offer",
  "multi_cleaner_offer",
  "multi_cleaner_urgent",
  "multi_cleaner_final_warning",
  "multi_cleaner_slot_filled",
  "edge_case_decision_required",
  "cleaner_dropout",
];

/**
 * Check if an appointment is overdue by more than 24 hours (a full day)
 * An appointment is considered overdue by a full day if its date is strictly
 * before today (i.e., yesterday or earlier).
 *
 * @param {string} dateStr - Appointment date string (YYYY-MM-DD)
 * @returns {boolean} True if overdue by 24+ hours (date is before today)
 */
function isOverdueByFullDay(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    console.warn("[ExpiredMultiCleanerMonitor] isOverdueByFullDay called with invalid date:", dateStr);
    return false;
  }

  const todayStr = TimezoneService.getTodayInTimezone();
  // String comparison works for YYYY-MM-DD format
  return dateStr < todayStr;
}

/**
 * Process expired multi-cleaner appointments that were never cleaned
 * @param {Object} io - Socket.io instance (optional)
 * @returns {Promise<Object>} Results of processing
 */
async function processExpiredMultiCleanerAppointments(io = null) {
  console.log("[ExpiredMultiCleanerMonitor] Starting expired multi-cleaner check...");

  const todayStr = TimezoneService.getTodayInTimezone();

  try {
    // Find multi-cleaner appointments that are:
    // - Past due (date before today)
    // - Not completed
    // - Not already cancelled
    // - Have an associated MultiCleanerJob
    const expiredAppointments = await UserAppointments.findAll({
      where: {
        isMultiCleanerJob: true,
        completed: false,
        wasCancelled: false,
        date: { [Op.lt]: todayStr }, // Date is before today
      },
      include: [
        {
          model: UserHomes,
          as: "home",
        },
        {
          model: User,
          as: "user",
        },
        {
          model: MultiCleanerJob,
          as: "multiCleanerJob",
          where: {
            // Only process jobs that were never fully completed
            status: { [Op.notIn]: ["completed"] },
          },
        },
      ],
    });

    console.log(`[ExpiredMultiCleanerMonitor] Found ${expiredAppointments.length} expired multi-cleaner appointments`);

    let processed = 0;
    let errors = 0;

    for (const appointment of expiredAppointments) {
      try {
        // Additional check - ensure it's truly overdue by a full day
        if (!isOverdueByFullDay(appointment.date)) {
          continue;
        }

        const home = appointment.home;
        const homeowner = appointment.user;
        const multiCleanerJob = appointment.multiCleanerJob;

        console.log(`[ExpiredMultiCleanerMonitor] Processing expired appointment ${appointment.id} (date: ${appointment.date})`);

        // Cancel any pending payment authorization
        if (appointment.paymentIntentId) {
          try {
            const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
            await stripe.paymentIntents.cancel(appointment.paymentIntentId);
            console.log(`[ExpiredMultiCleanerMonitor] Cancelled payment intent for appointment ${appointment.id}`);
          } catch (stripeError) {
            // Payment intent may already be cancelled or in a state that can't be cancelled
            console.log(
              `[ExpiredMultiCleanerMonitor] Could not cancel payment intent for appointment ${appointment.id}:`,
              stripeError.message
            );
          }
        }

        // Mark appointment as system-cancelled
        await appointment.update({
          wasCancelled: true,
          cancellationType: "system",
          cancellationCategory: "expired_no_show",
          paymentStatus: "cancelled",
        });

        // Update multi-cleaner job status
        if (multiCleanerJob) {
          await multiCleanerJob.update({
            status: "cancelled",
          });
        }

        // Update cleaner job completions to mark as expired
        await CleanerJobCompletion.update(
          { status: "expired_no_show" },
          {
            where: {
              multiCleanerJobId: multiCleanerJob?.id,
              status: { [Op.notIn]: ["dropped_out", "no_show", "completed"] },
            },
          }
        );

        // Clean up stale notifications for this appointment
        await Notification.update(
          { actionRequired: false },
          {
            where: {
              relatedAppointmentId: appointment.id,
              type: { [Op.in]: STALE_NOTIFICATION_TYPES },
            },
          }
        );

        // Format notification data
        const appointmentDate = new Date(appointment.date + "T12:00:00");
        const formattedDate = appointmentDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        let homeAddress = null;
        if (home) {
          homeAddress = {
            street: EncryptionService.decrypt(home.address),
            city: EncryptionService.decrypt(home.city),
            state: EncryptionService.decrypt(home.state),
          };
        }

        // Send notification to homeowner
        if (homeowner) {
          await NotificationService.createNotification({
            userId: homeowner.id,
            type: "multi_cleaner_expired_no_show",
            title: "Cleaning Not Completed",
            body: `Your scheduled cleaning on ${formattedDate} was not completed and has been cancelled. No payment was taken. We apologize for any inconvenience.`,
            data: {
              appointmentId: appointment.id,
              date: appointment.date,
              homeId: home?.id,
              homeAddress,
              reason: "expired_no_show",
            },
            relatedAppointmentId: appointment.id,
          });

          // Emit socket event for real-time notification
          if (io) {
            io.to(`user_${homeowner.id}`).emit("notification", {
              type: "multi_cleaner_expired_no_show",
              message: "Your scheduled cleaning was not completed and has been cancelled.",
            });
          }
        }

        processed++;
        console.log(`[ExpiredMultiCleanerMonitor] Successfully processed appointment ${appointment.id}`);
      } catch (error) {
        errors++;
        console.error(`[ExpiredMultiCleanerMonitor] Error processing appointment ${appointment.id}:`, error.message);
      }
    }

    console.log(`[ExpiredMultiCleanerMonitor] Completed: ${processed} processed, ${errors} errors`);

    return {
      success: true,
      processed,
      errors,
      total: expiredAppointments.length,
    };
  } catch (error) {
    console.error("[ExpiredMultiCleanerMonitor] Fatal error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process expired solo appointments that were never cleaned
 * These are appointments that had a cleaner assigned but were never started/completed
 * @param {Object} io - Socket.io instance (optional)
 * @returns {Promise<Object>} Results of processing
 */
async function processExpiredSoloAppointments(io = null) {
  console.log("[ExpiredMultiCleanerMonitor] Starting expired solo appointment check...");

  const todayStr = TimezoneService.getTodayInTimezone();

  try {
    // Find solo appointments that are:
    // - NOT multi-cleaner jobs
    // - Past due (date before today)
    // - Not completed
    // - Not already cancelled
    // - Had a cleaner assigned (hasBeenAssigned = true)
    const expiredAppointments = await UserAppointments.findAll({
      where: {
        isMultiCleanerJob: { [Op.ne]: true },
        completed: false,
        wasCancelled: false,
        hasBeenAssigned: true, // Had a cleaner but was never cleaned
        date: { [Op.lt]: todayStr }, // Date is before today
      },
      include: [
        {
          model: UserHomes,
          as: "home",
        },
        {
          model: User,
          as: "user",
        },
      ],
    });

    console.log(`[ExpiredMultiCleanerMonitor] Found ${expiredAppointments.length} expired solo appointments`);

    let processed = 0;
    let errors = 0;

    for (const appointment of expiredAppointments) {
      try {
        // Additional check - ensure it's truly overdue by a full day
        if (!isOverdueByFullDay(appointment.date)) {
          continue;
        }

        const home = appointment.home;
        const homeowner = appointment.user;

        console.log(`[ExpiredMultiCleanerMonitor] Processing expired solo appointment ${appointment.id} (date: ${appointment.date})`);

        // Cancel any pending payment authorization
        if (appointment.paymentIntentId) {
          try {
            const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
            await stripe.paymentIntents.cancel(appointment.paymentIntentId);
            console.log(`[ExpiredMultiCleanerMonitor] Cancelled payment intent for appointment ${appointment.id}`);
          } catch (stripeError) {
            console.log(
              `[ExpiredMultiCleanerMonitor] Could not cancel payment intent for appointment ${appointment.id}:`,
              stripeError.message
            );
          }
        }

        // Mark appointment as system-cancelled
        await appointment.update({
          wasCancelled: true,
          cancellationType: "system",
          cancellationCategory: "expired_no_show",
          paymentStatus: "cancelled",
        });

        // Update cleaner assignment records
        await UserCleanerAppointments.update(
          { status: "expired_no_show" },
          {
            where: {
              appointmentId: appointment.id,
            },
          }
        );

        // Clean up stale notifications for this appointment
        await Notification.update(
          { actionRequired: false },
          {
            where: {
              relatedAppointmentId: appointment.id,
              type: { [Op.in]: STALE_NOTIFICATION_TYPES },
            },
          }
        );

        // Format notification data
        const appointmentDate = new Date(appointment.date + "T12:00:00");
        const formattedDate = appointmentDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        let homeAddress = null;
        if (home) {
          homeAddress = {
            street: EncryptionService.decrypt(home.address),
            city: EncryptionService.decrypt(home.city),
            state: EncryptionService.decrypt(home.state),
          };
        }

        // Send notification to homeowner
        if (homeowner) {
          await NotificationService.createNotification({
            userId: homeowner.id,
            type: "appointment_expired_no_show",
            title: "Cleaning Not Completed",
            body: `Your scheduled cleaning on ${formattedDate} was not completed and has been cancelled. No payment was taken. We apologize for any inconvenience.`,
            data: {
              appointmentId: appointment.id,
              date: appointment.date,
              homeId: home?.id,
              homeAddress,
              reason: "expired_no_show",
            },
            relatedAppointmentId: appointment.id,
          });

          // Emit socket event for real-time notification
          if (io) {
            io.to(`user_${homeowner.id}`).emit("notification", {
              type: "appointment_expired_no_show",
              message: "Your scheduled cleaning was not completed and has been cancelled.",
            });
          }
        }

        processed++;
        console.log(`[ExpiredMultiCleanerMonitor] Successfully processed solo appointment ${appointment.id}`);
      } catch (error) {
        errors++;
        console.error(`[ExpiredMultiCleanerMonitor] Error processing solo appointment ${appointment.id}:`, error.message);
      }
    }

    console.log(`[ExpiredMultiCleanerMonitor] Solo appointments completed: ${processed} processed, ${errors} errors`);

    return {
      success: true,
      processed,
      errors,
      total: expiredAppointments.length,
    };
  } catch (error) {
    console.error("[ExpiredMultiCleanerMonitor] Fatal error in solo processing:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process all expired appointments (both multi-cleaner and solo)
 * @param {Object} io - Socket.io instance (optional)
 * @returns {Promise<Object>} Combined results
 */
async function processAllExpiredAppointments(io = null) {
  const multiCleanerResults = await processExpiredMultiCleanerAppointments(io);
  const soloResults = await processExpiredSoloAppointments(io);

  return {
    multiCleaner: multiCleanerResults,
    solo: soloResults,
    totalProcessed: (multiCleanerResults.processed || 0) + (soloResults.processed || 0),
  };
}

/**
 * Start the monitor as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 6 hours)
 * @returns {Object} Interval reference for cleanup
 */
function startExpiredMultiCleanerMonitor(io, intervalMs = 6 * 60 * 60 * 1000) {
  console.log(
    `[ExpiredMultiCleanerMonitor] Starting expired appointment monitor (interval: ${intervalMs}ms)`
  );

  // Run immediately on start
  processAllExpiredAppointments(io).catch((err) => {
    console.error("[ExpiredMultiCleanerMonitor] Error on initial run:", err);
  });

  // Schedule recurring runs
  const interval = setInterval(async () => {
    await processAllExpiredAppointments(io);
  }, intervalMs);

  return interval;
}

module.exports = {
  processExpiredMultiCleanerAppointments,
  processExpiredSoloAppointments,
  processAllExpiredAppointments,
  startExpiredMultiCleanerMonitor,
};
