/**
 * Billing Service
 * Handles billing-related scheduled tasks
 * - Monthly interest on unpaid cancellation fees (10% per month)
 */

const cron = require("node-cron");
const { UserBills } = require("../models");

const MONTHLY_INTEREST_RATE = 0.10; // 10% per month

/**
 * Apply 10% monthly interest to all unpaid cancellation fees
 * Called on the 1st of every month
 */
const applyMonthlyInterest = async () => {
  console.log("[Billing] Applying monthly interest to unpaid cancellation fees...");

  try {
    // Find all bills with unpaid cancellation fees
    const billsWithFees = await UserBills.findAll({
      where: {
        cancellationFee: {
          [require("sequelize").Op.gt]: 0,
        },
      },
    });

    console.log(`[Billing] Found ${billsWithFees.length} bills with unpaid cancellation fees`);

    let totalInterestApplied = 0;
    let billsUpdated = 0;

    for (const bill of billsWithFees) {
      const currentFee = Number(bill.cancellationFee) || 0;
      const interest = Math.round(currentFee * MONTHLY_INTEREST_RATE * 100) / 100; // Round to cents
      const newFee = Math.round((currentFee + interest) * 100) / 100;

      const currentTotal = Number(bill.totalDue) || 0;
      const newTotal = Math.round((currentTotal + interest) * 100) / 100;

      await bill.update({
        cancellationFee: newFee,
        totalDue: newTotal,
      });

      totalInterestApplied += interest;
      billsUpdated++;

      console.log(`[Billing] User ${bill.userId}: $${currentFee} + $${interest} interest = $${newFee}`);
    }

    console.log(`[Billing] Monthly interest complete: $${totalInterestApplied.toFixed(2)} applied to ${billsUpdated} bills`);

    return {
      billsUpdated,
      totalInterestApplied,
    };
  } catch (error) {
    console.error("[Billing] Error applying monthly interest:", error);
    throw error;
  }
};

/**
 * Start the billing scheduler
 * - Monthly interest runs on the 1st of every month at midnight
 */
let cronJobsStarted = false;

const startBillingScheduler = () => {
  if (cronJobsStarted) {
    console.log("[Billing] Scheduler already running");
    return;
  }

  cronJobsStarted = true;

  // Run on the 1st of every month at midnight
  // Cron: "0 0 1 * *" = At 00:00 on day 1 of every month
  cron.schedule("0 0 1 * *", async () => {
    console.log("[Billing] Running scheduled monthly interest application...");
    try {
      await applyMonthlyInterest();
    } catch (error) {
      console.error("[Billing] Scheduled interest application failed:", error);
    }
  });

  console.log("[Billing] Scheduler initialized:");
  console.log("  - Monthly interest: 1st of every month at midnight (10% on unpaid cancellation fees)");
};

const stopBillingScheduler = () => {
  cronJobsStarted = false;
  console.log("[Billing] Scheduler stopped");
};

module.exports = {
  applyMonthlyInterest,
  startBillingScheduler,
  stopBillingScheduler,
  MONTHLY_INTEREST_RATE,
};
