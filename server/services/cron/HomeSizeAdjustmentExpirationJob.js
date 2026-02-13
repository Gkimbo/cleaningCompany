/**
 * Home Size Adjustment Expiration Job
 * Checks for pending adjustment requests that have expired (24 hours without homeowner response)
 * Marks them as expired and notifies the cleaner and owners for review
 */

const { Op } = require("sequelize");
const { HomeSizeAdjustmentRequest, User, UserHomes, Notification } = require("../../models");
const NotificationService = require("../NotificationService");
const EncryptionService = require("../EncryptionService");

/**
 * Process expired home size adjustment requests
 * Should be called by a scheduler (e.g., every 15 minutes)
 * @param {Object} io - Socket.io instance for real-time notifications
 * @returns {Object} Summary of processed expirations
 */
async function processExpiredAdjustments(io = null) {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  try {
    // Find all pending_homeowner requests that have expired
    const expiredRequests = await HomeSizeAdjustmentRequest.findAll({
      where: {
        status: "pending_homeowner",
        expiresAt: {
          [Op.lt]: now,
        },
      },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications"],
        },
        {
          model: User,
          as: "homeowner",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city", "state"],
        },
      ],
    });

    console.log(`[HomeSizeAdjustmentExpiration] Found ${expiredRequests.length} expired requests to process`);

    for (const request of expiredRequests) {
      try {
        // Mark as expired
        await request.update({
          status: "expired",
          resolvedAt: now,
        });

        // Get home address for notification
        const homeAddress = request.home
          ? EncryptionService.decrypt(request.home.address)
          : "Unknown address";

        // Get cleaner name
        const cleanerName = request.cleaner
          ? EncryptionService.decrypt(request.cleaner.firstName)
          : "Cleaner";

        // Notify cleaner that request expired (homeowner didn't respond)
        await NotificationService.notifyUser({
          userId: request.cleanerId,
          type: "adjustment_expired",
          title: "Adjustment Request Expired",
          body: `The homeowner didn't respond to your home size claim for ${homeAddress} within 24 hours. An owner will review and make a decision.`,
          data: {
            adjustmentRequestId: request.id,
            appointmentId: request.appointmentId,
            homeAddress,
            caseNumber: request.caseNumber,
          },
          actionRequired: false,
          relatedAppointmentId: request.appointmentId,
          sendPush: true,
          io,
        });

        // Notify all owners that a request needs review
        const owners = await User.findAll({
          where: { type: "owner" },
          attributes: ["id", "firstName", "email", "expoPushToken", "notifications"],
        });

        for (const owner of owners) {
          await NotificationService.notifyUser({
            userId: owner.id,
            type: "adjustment_expired_review",
            title: "Expired Adjustment Needs Review",
            body: `Home size adjustment for ${homeAddress} expired without homeowner response. Case #${request.caseNumber}`,
            data: {
              adjustmentRequestId: request.id,
              appointmentId: request.appointmentId,
              homeAddress,
              caseNumber: request.caseNumber,
              cleanerName,
              reportedBeds: request.reportedNumBeds,
              reportedBaths: request.reportedNumBaths,
            },
            actionRequired: true,
            relatedAppointmentId: request.appointmentId,
            sendPush: true,
            io,
          });
        }

        processed++;
        console.log(`[HomeSizeAdjustmentExpiration] Expired request ${request.id} (Case #${request.caseNumber})`);
      } catch (error) {
        errors++;
        console.error(`[HomeSizeAdjustmentExpiration] Error processing request ${request.id}:`, error);
      }
    }

    const summary = {
      processed,
      errors,
      timestamp: now.toISOString(),
    };

    if (processed > 0) {
      console.log(`[HomeSizeAdjustmentExpiration] Completed. Processed: ${processed}, Errors: ${errors}`);
    }
    return summary;
  } catch (error) {
    console.error("[HomeSizeAdjustmentExpiration] Fatal error:", error);
    throw error;
  }
}

/**
 * Start the expiration job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 15 minutes)
 * @returns {Object} Interval reference for cleanup
 */
function startExpirationJob(io, intervalMs = 15 * 60 * 1000) {
  console.log(`[HomeSizeAdjustmentExpiration] Starting expiration job (interval: ${intervalMs}ms)`);

  // Run immediately on start
  processExpiredAdjustments(io).catch((err) => {
    console.error("[HomeSizeAdjustmentExpiration] Error on initial run:", err);
  });

  // Then run on interval
  const interval = setInterval(() => {
    processExpiredAdjustments(io).catch((err) => {
      console.error("[HomeSizeAdjustmentExpiration] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processExpiredAdjustments,
  startExpirationJob,
};
