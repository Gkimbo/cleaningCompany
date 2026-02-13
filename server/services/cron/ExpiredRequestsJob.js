/**
 * Expired Requests Job
 *
 * Processes expired NewHomeRequests - marks them as expired and
 * notifies both business owners and clients.
 *
 * Schedule: Every hour
 */

const cron = require("node-cron");
const NewHomeRequestService = require("../NewHomeRequestService");
const NotificationService = require("../NotificationService");
const { NewHomeRequest, User, UserHomes } = require("../../models");
const { Op } = require("sequelize");

/**
 * Process all expired new home requests
 */
async function processExpiredRequests(io = null) {
  const now = new Date();
  console.log(`[ExpiredRequestsJob] Starting at ${now.toISOString()}`);

  try {
    // Find all pending requests that have expired
    const expiredRequests = await NewHomeRequest.findAll({
      where: {
        status: "pending",
        expiresAt: {
          [Op.lt]: now,
        },
      },
      include: [
        { model: User, as: "client" },
        { model: User, as: "businessOwner" },
        { model: UserHomes, as: "home" },
      ],
    });

    console.log(`[ExpiredRequestsJob] Found ${expiredRequests.length} expired requests`);

    let processed = 0;
    let errors = 0;

    for (const request of expiredRequests) {
      try {
        // Mark as expired
        await request.expire();
        processed++;

        // Notify client that the request expired
        if (request.client && request.home) {
          const homeAddress = `${request.home.address}, ${request.home.city}`;
          const businessOwnerName = request.businessOwner
            ? `${request.businessOwner.firstName} ${request.businessOwner.lastName}`.trim()
            : "Your cleaner";

          await NotificationService.notifyUser({
            userId: request.clientId,
            type: "new_home_declined", // Using declined type since it has similar UI treatment
            title: "Home Request Expired",
            body: `${businessOwnerName} didn't respond to your request for ${homeAddress}. You can list it on the marketplace or request again.`,
            data: {
              businessOwnerId: request.businessOwnerId,
              businessOwnerName,
              homeId: request.homeId,
              homeAddress,
              requestId: request.id,
              expired: true,
            },
            actionRequired: false,
            sendPush: true,
            io,
          });
        }

        // Optionally notify business owner that they missed the request
        if (request.businessOwner && request.home) {
          const clientName = request.client
            ? `${request.client.firstName} ${request.client.lastName}`.trim()
            : "A client";
          const homeAddress = `${request.home.address}, ${request.home.city}`;

          await NotificationService.notifyUser({
            userId: request.businessOwnerId,
            type: "booking_expired", // Using existing expired type
            title: "Home Request Expired",
            body: `The request from ${clientName} for ${homeAddress} has expired. The client may choose to list on the marketplace.`,
            data: {
              clientId: request.clientId,
              clientName,
              homeId: request.homeId,
              homeAddress,
              requestId: request.id,
            },
            actionRequired: false,
            sendPush: false, // Don't push for expired - they already missed it
            io,
          });
        }

        console.log(`[ExpiredRequestsJob] Processed request ${request.id}`);
      } catch (error) {
        console.error(`[ExpiredRequestsJob] Error processing request ${request.id}:`, error);
        errors++;
      }
    }

    console.log(`[ExpiredRequestsJob] Completed: ${processed} processed, ${errors} errors`);

    return { processed, errors, total: expiredRequests.length };
  } catch (error) {
    console.error("[ExpiredRequestsJob] Critical error:", error);
    return { error: error.message };
  }
}

/**
 * Start the expired requests cron job
 *
 * Schedule: "0 * * * *" = Every hour at minute 0
 */
function startExpiredRequestsJob(io = null) {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[ExpiredRequestsJob] Cron triggered");
    await processExpiredRequests(io);
  });

  console.log("[ExpiredRequestsJob] Expired requests job scheduled to run every hour");
}

/**
 * Manually trigger expired request processing (for admin use)
 */
async function triggerManualExpiredProcessing(io = null) {
  console.log("[ExpiredRequestsJob] Manual processing triggered");
  return await processExpiredRequests(io);
}

module.exports = {
  processExpiredRequests,
  startExpiredRequestsJob,
  triggerManualExpiredProcessing,
};
