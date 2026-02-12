/**
 * Bi-Weekly Payout Job
 *
 * Processes batched employee payouts every other Friday.
 * Business owners are paid immediately when jobs complete;
 * employees are paid in batches on a bi-weekly schedule.
 *
 * Schedule: Every Friday at 6 AM UTC (1 AM EST)
 * Only processes on bi-weekly "payout Fridays"
 */

const cron = require("node-cron");
const EmployeeBatchPayoutService = require("../EmployeeBatchPayoutService");
const NotificationService = require("../NotificationService");
const Email = require("../sendNotifications/EmailClass");
const { BusinessEmployee, User } = require("../../models");
const EncryptionService = require("../EncryptionService");

// Anchor date for bi-weekly calculations (a known payout Friday)
const BIWEEKLY_ANCHOR = new Date("2024-01-05");

/**
 * Check if today is a payout Friday (every other Friday)
 */
function isPayoutFriday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Must be a Friday
  if (today.getDay() !== 5) {
    return false;
  }

  // Calculate weeks since anchor
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceAnchor = Math.floor((today - BIWEEKLY_ANCHOR) / msPerWeek);

  // Payout Fridays are every even number of weeks from anchor
  return weeksSinceAnchor % 2 === 0;
}

/**
 * Process bi-weekly employee payouts
 */
async function processBiWeeklyPayouts(io = null) {
  const today = new Date();
  console.log(`[BiWeeklyPayoutJob] Starting bi-weekly payout job at ${today.toISOString()}`);

  // Check if today is a payout Friday
  if (!isPayoutFriday()) {
    console.log("[BiWeeklyPayoutJob] Not a payout Friday, skipping");
    return { skipped: true, reason: "not_payout_friday" };
  }

  try {
    // Process all pending payouts
    const result = await EmployeeBatchPayoutService.processBiWeeklyPayouts();

    console.log(
      `[BiWeeklyPayoutJob] Completed: ${result.success} paid, ${result.failed} failed`
    );

    // Send notifications for successful payouts
    if (result.results && result.results.length > 0) {
      for (const employeeResult of result.results) {
        if (employeeResult.success) {
          await notifyEmployeeOfPayout(employeeResult);
        } else {
          await notifyEmployeeOfFailure(employeeResult);
        }
      }
    }

    // Emit socket event for real-time dashboard updates
    if (io) {
      io.emit("biweekly-payout-complete", {
        success: result.success,
        failed: result.failed,
        timestamp: new Date(),
      });
    }

    return result;
  } catch (error) {
    console.error("[BiWeeklyPayoutJob] Critical error:", error);

    // Alert operations (would integrate with monitoring system)
    console.error("[BiWeeklyPayoutJob] ALERT: Bi-weekly payout job failed!");

    return { error: error.message };
  }
}

/**
 * Notify employee of successful payout
 */
async function notifyEmployeeOfPayout(payoutResult) {
  try {
    const employee = await BusinessEmployee.findByPk(payoutResult.employeeId, {
      include: [{ model: User, as: "user" }],
    });

    if (!employee || !employee.user) {
      return;
    }

    const amount = payoutResult.formattedAmount || `$${(payoutResult.totalAmount / 100).toFixed(2)}`;
    const jobCount = payoutResult.payoutCount || 0;

    // In-app notification
    await NotificationService.createNotification(
      employee.userId,
      `Your bi-weekly payout of ${amount} for ${jobCount} job${jobCount !== 1 ? "s" : ""} has been sent to your bank account!`
    );

    // Email notification
    const email = employee.email || (employee.user.email ? EncryptionService.decrypt(employee.user.email) : null);
    if (email) {
      const firstName = employee.firstName || EncryptionService.decrypt(employee.user.firstName) || "Employee";

      await Email.sendTemplatedEmail(email, "employee-payout-sent", {
        firstName,
        amount,
        jobCount,
        transferId: payoutResult.transferId,
      });
    }

    console.log(`[BiWeeklyPayoutJob] Notified employee ${employee.id} of payout: ${amount}`);
  } catch (error) {
    console.error(`[BiWeeklyPayoutJob] Error notifying employee ${payoutResult.employeeId}:`, error);
  }
}

/**
 * Notify employee of failed payout
 */
async function notifyEmployeeOfFailure(payoutResult) {
  try {
    const employee = await BusinessEmployee.findByPk(payoutResult.employeeId, {
      include: [{ model: User, as: "user" }],
    });

    if (!employee || !employee.user) {
      return;
    }

    // In-app notification
    await NotificationService.createNotification(
      employee.userId,
      `There was an issue with your bi-weekly payout. Please check your Stripe account settings or contact support.`
    );

    console.log(`[BiWeeklyPayoutJob] Notified employee ${employee.id} of payout failure`);
  } catch (error) {
    console.error(`[BiWeeklyPayoutJob] Error notifying employee of failure:`, error);
  }
}

/**
 * Start the bi-weekly payout cron job
 *
 * Schedule: "0 6 * * 5" = Every Friday at 6:00 AM UTC
 * The job checks if it's a "payout Friday" before processing
 */
function startBiWeeklyPayoutJob(io = null) {
  // Run every Friday at 6 AM UTC
  cron.schedule("0 6 * * 5", async () => {
    console.log("[BiWeeklyPayoutJob] Cron triggered");
    await processBiWeeklyPayouts(io);
  });

  console.log("[BiWeeklyPayoutJob] Bi-weekly payout job scheduled for Fridays at 6 AM UTC");

  // Log next payout date
  const nextPayoutDate = EmployeeBatchPayoutService.getNextPayoutDate();
  console.log(`[BiWeeklyPayoutJob] Next payout date: ${nextPayoutDate.toISOString().split("T")[0]}`);
}

/**
 * Manually trigger bi-weekly payouts (for admin use)
 */
async function triggerManualPayout(io = null) {
  console.log("[BiWeeklyPayoutJob] Manual payout triggered");
  return await EmployeeBatchPayoutService.processBiWeeklyPayouts();
}

module.exports = {
  processBiWeeklyPayouts,
  startBiWeeklyPayoutJob,
  isPayoutFriday,
  triggerManualPayout,
};
