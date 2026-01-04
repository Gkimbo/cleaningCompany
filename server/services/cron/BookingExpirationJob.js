/**
 * Booking Expiration Job
 * Checks for pending bookings that have expired (48 hours without client response)
 * and marks them as expired, notifying the business owner
 */

const { Op } = require("sequelize");
const { UserAppointments, User, Notification } = require("../../models");
const NotificationService = require("../NotificationService");
const EncryptionService = require("../EncryptionService");

/**
 * Process expired booking requests
 * Should be called by a scheduler (e.g., every hour)
 * @param {Object} io - Socket.io instance for real-time notifications
 * @returns {Object} Summary of processed expirations
 */
async function processExpiredBookings(io = null) {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  try {
    // Find all pending bookings that have expired
    const expiredBookings = await UserAppointments.findAll({
      where: {
        clientResponsePending: true,
        expiresAt: {
          [Op.lt]: now,
        },
        clientResponse: null, // Not yet responded
      },
      include: [
        {
          model: User,
          as: "bookedByCleaner",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications"],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    console.log(`[BookingExpirationJob] Found ${expiredBookings.length} expired bookings to process`);

    for (const appointment of expiredBookings) {
      try {
        // Mark as expired
        await appointment.update({
          clientResponsePending: false,
          clientResponse: "expired",
          clientRespondedAt: now,
        });

        // Get client name
        const clientName = appointment.user
          ? `${EncryptionService.decrypt(appointment.user.firstName)} ${EncryptionService.decrypt(appointment.user.lastName)}`
          : "Client";

        // Notify business owner
        await NotificationService.notifyBookingExpired({
          cleanerId: appointment.bookedByCleanerId,
          clientId: appointment.userId,
          appointmentId: appointment.id,
          appointmentDate: appointment.date,
          clientName,
          io,
        });

        // Also mark any related pending_booking notifications as actioned
        await Notification.update(
          { isRead: true, actionRequired: false },
          {
            where: {
              relatedAppointmentId: appointment.id,
              type: "pending_booking",
              isRead: false,
            },
          }
        );

        processed++;
        console.log(`[BookingExpirationJob] Expired appointment ${appointment.id} for client ${appointment.userId}`);
      } catch (error) {
        errors++;
        console.error(`[BookingExpirationJob] Error processing appointment ${appointment.id}:`, error);
      }
    }

    // Also clean up expired notifications
    await NotificationService.cleanupExpiredNotifications();

    const summary = {
      processed,
      errors,
      timestamp: now.toISOString(),
    };

    console.log(`[BookingExpirationJob] Completed. Processed: ${processed}, Errors: ${errors}`);
    return summary;
  } catch (error) {
    console.error("[BookingExpirationJob] Fatal error:", error);
    throw error;
  }
}

/**
 * Start the expiration job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 * @returns {Object} Interval reference for cleanup
 */
function startExpirationJob(io, intervalMs = 60 * 60 * 1000) {
  console.log(`[BookingExpirationJob] Starting expiration job (interval: ${intervalMs}ms)`);

  // Run immediately on start
  processExpiredBookings(io).catch((err) => {
    console.error("[BookingExpirationJob] Error on initial run:", err);
  });

  // Then run on interval
  const interval = setInterval(() => {
    processExpiredBookings(io).catch((err) => {
      console.error("[BookingExpirationJob] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processExpiredBookings,
  startExpirationJob,
};
