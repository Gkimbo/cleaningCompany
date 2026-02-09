/**
 * Tenant Present Timeout Job
 *
 * Handles timeouts for the tenant present workflow:
 * 1. Response deadline timeout - Homeowner has 30 min to respond
 * 2. Return timeout - Cleaner said "will_return" but time window expired
 *
 * Should be run every 5 minutes to catch timeouts promptly.
 */

const GuestNotLeftService = require("../GuestNotLeftService");

/**
 * Process expired response deadlines
 * Called when homeowner doesn't respond within 30 minutes
 * @param {Object} io - Socket.io instance
 * @returns {Object} Summary of processed timeouts
 */
async function processResponseTimeouts(io = null) {
	const now = new Date();
	let processed = 0;
	let errors = 0;

	try {
		// Find reports where response deadline has passed
		const expiredReports = await GuestNotLeftService.getReportsWithExpiredDeadline();

		console.log(`[TenantPresentTimeout] Found ${expiredReports.length} expired response deadlines`);

		for (const report of expiredReports) {
			try {
				await GuestNotLeftService.handleResponseTimeout(report.id, io);
				processed++;
				console.log(`[TenantPresentTimeout] Processed response timeout for report ${report.id}`);
			} catch (error) {
				errors++;
				console.error(`[TenantPresentTimeout] Error processing report ${report.id}:`, error);
			}
		}

		return { processed, errors };
	} catch (error) {
		console.error("[TenantPresentTimeout] Error in processResponseTimeouts:", error);
		throw error;
	}
}

/**
 * Process expired return deadlines
 * Called when cleaner said "will_return" but time window has expired
 * @param {Object} io - Socket.io instance
 * @returns {Object} Summary of processed timeouts
 */
async function processReturnTimeouts(io = null) {
	const now = new Date();
	let processed = 0;
	let errors = 0;

	try {
		// Find reports where cleaner said will_return but window expired
		const expiredReports = await GuestNotLeftService.getExpiredReturnReports();

		console.log(`[TenantPresentTimeout] Found ${expiredReports.length} expired return windows`);

		for (const report of expiredReports) {
			try {
				await GuestNotLeftService.handleReturnTimeout(report.id, io);
				processed++;
				console.log(`[TenantPresentTimeout] Processed return timeout for report ${report.id}`);
			} catch (error) {
				errors++;
				console.error(`[TenantPresentTimeout] Error processing return timeout ${report.id}:`, error);
			}
		}

		return { processed, errors };
	} catch (error) {
		console.error("[TenantPresentTimeout] Error in processReturnTimeouts:", error);
		throw error;
	}
}

/**
 * Run all tenant present timeout checks
 * @param {Object} io - Socket.io instance
 * @returns {Object} Combined summary
 */
async function processAllTimeouts(io = null) {
	const now = new Date();

	console.log(`[TenantPresentTimeout] Starting timeout check at ${now.toISOString()}`);

	const responseResult = await processResponseTimeouts(io);
	const returnResult = await processReturnTimeouts(io);

	const summary = {
		responseTimeouts: responseResult,
		returnTimeouts: returnResult,
		timestamp: now.toISOString(),
	};

	console.log(
		`[TenantPresentTimeout] Completed. Response timeouts: ${responseResult.processed}, Return timeouts: ${returnResult.processed}`
	);

	return summary;
}

/**
 * Start the timeout job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 5 minutes)
 * @returns {Object} Interval reference for cleanup
 */
function startTenantPresentTimeoutJob(io, intervalMs = 5 * 60 * 1000) {
	console.log(`[TenantPresentTimeout] Starting timeout job (interval: ${intervalMs}ms)`);

	// Run immediately on start
	processAllTimeouts(io).catch((err) => {
		console.error("[TenantPresentTimeout] Error on initial run:", err);
	});

	// Then run on interval
	const interval = setInterval(() => {
		processAllTimeouts(io).catch((err) => {
			console.error("[TenantPresentTimeout] Error on interval run:", err);
		});
	}, intervalMs);

	return interval;
}

module.exports = {
	processResponseTimeouts,
	processReturnTimeouts,
	processAllTimeouts,
	startTenantPresentTimeoutJob,
};
