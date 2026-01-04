/**
 * Multi-Cleaner Offer Expiration Job
 *
 * Expires unanswered job offers after the configured time period
 * and releases slots from expired offers.
 */

const { Op } = require("sequelize");
const { CleanerJobOffer, MultiCleanerJob, UserAppointments } = require("../../models");
const NotificationService = require("../NotificationService");

/**
 * Process expired offers
 * @param {Object} io - Socket.io instance
 * @returns {Promise<Object>} Processing summary
 */
async function processExpiredOffers(io = null) {
  const now = new Date();
  let expired = 0;
  let errors = 0;

  try {
    // Find all pending offers that have expired
    const expiredOffers = await CleanerJobOffer.findAll({
      where: {
        status: "pending",
        expiresAt: {
          [Op.lt]: now,
        },
      },
      include: [
        {
          model: MultiCleanerJob,
          as: "multiCleanerJob",
          include: [
            {
              model: UserAppointments,
              as: "appointment",
            },
          ],
        },
      ],
    });

    console.log(
      `[MultiCleanerOfferExpiration] Found ${expiredOffers.length} expired offers to process`
    );

    for (const offer of expiredOffers) {
      try {
        // Mark offer as expired
        await offer.markExpired();

        // Notify the cleaner that their offer expired
        await NotificationService.createNotification({
          userId: offer.cleanerId,
          type: "general",
          title: "Job offer expired",
          body: `The multi-cleaner job offer for ${offer.multiCleanerJob?.appointment?.date || "an appointment"} has expired.`,
          data: {
            appointmentId: offer.appointmentId,
            multiCleanerJobId: offer.multiCleanerJobId,
          },
        });

        expired++;
        console.log(
          `[MultiCleanerOfferExpiration] Expired offer ${offer.id} for cleaner ${offer.cleanerId}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[MultiCleanerOfferExpiration] Error processing offer ${offer.id}:`,
          error
        );
      }
    }

    const summary = {
      expired,
      errors,
      timestamp: now.toISOString(),
    };

    console.log(
      `[MultiCleanerOfferExpiration] Completed. Expired: ${expired}, Errors: ${errors}`
    );
    return summary;
  } catch (error) {
    console.error("[MultiCleanerOfferExpiration] Fatal error:", error);
    throw error;
  }
}

/**
 * Withdraw offers for jobs that are now filled
 * @returns {Promise<number>} Number of offers withdrawn
 */
async function withdrawOffersForFilledJobs() {
  let withdrawn = 0;

  try {
    // Find all pending offers for jobs that are now filled
    const pendingOffers = await CleanerJobOffer.findAll({
      where: {
        status: "pending",
      },
      include: [
        {
          model: MultiCleanerJob,
          as: "multiCleanerJob",
          where: {
            status: "filled",
          },
        },
      ],
    });

    for (const offer of pendingOffers) {
      try {
        await offer.update({
          status: "withdrawn",
          respondedAt: new Date(),
        });

        // Notify cleaner
        await NotificationService.createNotification({
          userId: offer.cleanerId,
          type: "general",
          title: "Job filled",
          body: "The multi-cleaner job you were offered has been filled by other cleaners.",
          data: {
            appointmentId: offer.appointmentId,
            multiCleanerJobId: offer.multiCleanerJobId,
          },
        });

        withdrawn++;
      } catch (error) {
        console.error(
          `[MultiCleanerOfferExpiration] Error withdrawing offer ${offer.id}:`,
          error
        );
      }
    }

    if (withdrawn > 0) {
      console.log(
        `[MultiCleanerOfferExpiration] Withdrew ${withdrawn} offers for filled jobs`
      );
    }

    return withdrawn;
  } catch (error) {
    console.error("[MultiCleanerOfferExpiration] Error withdrawing offers:", error);
    return 0;
  }
}

/**
 * Main processing function
 * @param {Object} io - Socket.io instance
 * @returns {Promise<Object>} Processing summary
 */
async function processOfferExpiration(io = null) {
  console.log("[MultiCleanerOfferExpiration] Starting offer expiration job...");

  const results = {
    expired: 0,
    withdrawn: 0,
    errors: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    const expiredResult = await processExpiredOffers(io);
    results.expired = expiredResult.expired;
    results.errors += expiredResult.errors;
  } catch (error) {
    console.error("[MultiCleanerOfferExpiration] Error expiring offers:", error);
    results.errors++;
  }

  try {
    results.withdrawn = await withdrawOffersForFilledJobs();
  } catch (error) {
    console.error("[MultiCleanerOfferExpiration] Error withdrawing offers:", error);
    results.errors++;
  }

  return results;
}

/**
 * Start the expiration job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 * @returns {Object} Interval reference for cleanup
 */
function startOfferExpirationJob(io, intervalMs = 60 * 60 * 1000) {
  console.log(
    `[MultiCleanerOfferExpiration] Starting offer expiration job (interval: ${intervalMs}ms)`
  );

  // Run immediately on start
  processOfferExpiration(io).catch((err) => {
    console.error("[MultiCleanerOfferExpiration] Error on initial run:", err);
  });

  // Then run on interval
  const interval = setInterval(() => {
    processOfferExpiration(io).catch((err) => {
      console.error("[MultiCleanerOfferExpiration] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processOfferExpiration,
  startOfferExpirationJob,
  processExpiredOffers,
  withdrawOffersForFilledJobs,
};
