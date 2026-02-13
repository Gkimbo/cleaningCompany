/**
 * Cleaner Approval Timeout Job
 *
 * Auto-approves pending join requests that homeowners haven't responded to
 * after the 48-hour timeout period expires.
 */

const CleanerApprovalService = require("../CleanerApprovalService");

/**
 * Process expired approval requests
 * @param {Object} io - Socket.io instance (for future real-time updates)
 * @returns {Promise<Object>} Processing summary
 */
async function processExpiredApprovalRequests(io = null) {
  const now = new Date();

  console.log("[CleanerApprovalTimeoutJob] Starting approval timeout processing...");

  try {
    const result = await CleanerApprovalService.autoApproveExpiredRequests();

    console.log(
      `[CleanerApprovalTimeoutJob] Completed. Approved: ${result.approved}, Cancelled: ${result.cancelled}, Errors: ${result.errors}`
    );

    return {
      ...result,
      timestamp: now.toISOString(),
    };
  } catch (error) {
    console.error("[CleanerApprovalTimeoutJob] Fatal error:", error);
    throw error;
  }
}

/**
 * Start the approval timeout job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 15 minutes)
 * @returns {Object} Interval reference for cleanup
 */
function startApprovalTimeoutJob(io, intervalMs = 15 * 60 * 1000) {
  console.log(
    `[CleanerApprovalTimeoutJob] Starting approval timeout job (interval: ${intervalMs}ms)`
  );

  // Run immediately on start
  processExpiredApprovalRequests(io).catch((err) => {
    console.error("[CleanerApprovalTimeoutJob] Error on initial run:", err);
  });

  // Then run on interval (every 15 minutes)
  const interval = setInterval(() => {
    processExpiredApprovalRequests(io).catch((err) => {
      console.error("[CleanerApprovalTimeoutJob] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processExpiredApprovalRequests,
  startApprovalTimeoutJob,
};
