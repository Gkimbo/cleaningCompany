/**
 * Unassigned Appointment Reminder Job
 * Sends daily reminders to business owners for appointments within 4 days
 * that have no employee assigned (including self-assignment).
 * Continues daily until someone is assigned or the appointment date passes.
 */

const { Op } = require("sequelize");
const {
  UserAppointments,
  User,
} = require("../../models");
const NotificationService = require("../NotificationService");
const EncryptionService = require("../EncryptionService");

/**
 * Process unassigned appointment reminders
 * Should be called daily (recommended: 9 AM)
 * @param {Object} io - Socket.io instance for real-time notifications
 * @returns {Object} Summary of processed reminders
 */
async function processUnassignedReminders(io = null) {
  const now = new Date();
  const results = { sent: 0, skipped: 0, errors: 0 };

  try {
    // Calculate date range: today through 4 days from now
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const fourDaysFromNow = new Date(today);
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
    const fourDaysFromNowStr = fourDaysFromNow.toISOString().split("T")[0];

    // Start of today for checking if we already sent a reminder today
    const startOfToday = new Date(today);

    console.log(`[UnassignedReminderJob] Checking appointments from ${todayStr} to ${fourDaysFromNowStr}`);

    // Find unassigned appointments within the 4-day window
    // that haven't received a reminder today
    const unassignedAppointments = await UserAppointments.findAll({
      where: {
        date: {
          [Op.gte]: todayStr,
          [Op.lte]: fourDaysFromNowStr,
        },
        completed: false,
        wasCancelled: { [Op.ne]: true },
        assignedToBusinessEmployee: false, // No one currently assigned
        bookedByCleanerId: { [Op.ne]: null }, // Only appointments booked by a business owner
        [Op.or]: [
          { lastBusinessOwnerReminderAt: null },
          {
            lastBusinessOwnerReminderAt: {
              [Op.lt]: startOfToday, // Before today
            },
          },
        ],
      },
      include: [
        {
          model: User,
          as: "bookedByCleaner", // Business owner who booked this appointment
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications", "notificationEmail"],
        },
        {
          model: User,
          as: "user", // Client/homeowner
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    console.log(`[UnassignedReminderJob] Found ${unassignedAppointments.length} unassigned appointments to process`);

    for (const appointment of unassignedAppointments) {
      try {
        const businessOwner = appointment.bookedByCleaner;
        const client = appointment.user;

        if (!businessOwner) {
          console.log(`[UnassignedReminderJob] Skipping appointment ${appointment.id}: No business owner found`);
          results.skipped++;
          continue;
        }

        // Calculate days until the appointment
        // Parse as local time by appending T00:00:00 to avoid UTC interpretation
        const appointmentDate = new Date(appointment.date + "T00:00:00");
        const daysUntil = Math.round((appointmentDate - today) / (1000 * 60 * 60 * 24));

        // Get client name (decrypt if encrypted)
        let clientName = "Client";
        if (client) {
          const firstName = client.firstName
            ? EncryptionService.decrypt(client.firstName)
            : "";
          const lastName = client.lastName
            ? EncryptionService.decrypt(client.lastName)
            : "";
          clientName = `${firstName} ${lastName}`.trim() || "Client";
        }

        const newReminderCount = (appointment.businessOwnerRemindersSent || 0) + 1;

        console.log(`[UnassignedReminderJob] Sending reminder ${newReminderCount} for appointment ${appointment.id} (${daysUntil} days away)`);

        // Send multi-channel notification
        await NotificationService.notifyUnassignedAppointmentReminder({
          businessOwnerId: businessOwner.id,
          appointmentId: appointment.id,
          appointmentDate: appointment.date,
          clientName,
          daysUntil,
          reminderCount: newReminderCount,
          io,
        });

        // Update tracking fields
        await appointment.update({
          businessOwnerRemindersSent: newReminderCount,
          lastBusinessOwnerReminderAt: now,
        });

        results.sent++;
        console.log(`[UnassignedReminderJob] Sent reminder for appointment ${appointment.id} to business owner ${businessOwner.id}`);
      } catch (error) {
        results.errors++;
        console.error(`[UnassignedReminderJob] Error processing appointment ${appointment.id}:`, error);
      }
    }

    console.log(`[UnassignedReminderJob] Completed. Sent: ${results.sent}, Skipped: ${results.skipped}, Errors: ${results.errors}`);
    return results;
  } catch (error) {
    console.error("[UnassignedReminderJob] Fatal error:", error);
    throw error;
  }
}

/**
 * Start the reminder job as a recurring interval
 * For production, recommend using node-cron to schedule at specific time (e.g., 9 AM)
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 24 hours)
 * @returns {Object} Interval reference for cleanup
 */
function startUnassignedReminderJob(io, intervalMs = 24 * 60 * 60 * 1000) {
  console.log(`[UnassignedReminderJob] Starting unassigned reminder job (interval: ${intervalMs}ms)`);

  // Don't run immediately on start - only run on scheduled interval
  // This prevents sending duplicate reminders on every server restart
  const interval = setInterval(() => {
    processUnassignedReminders(io).catch((err) => {
      console.error("[UnassignedReminderJob] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processUnassignedReminders,
  startUnassignedReminderJob,
};
