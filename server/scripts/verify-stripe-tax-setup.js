#!/usr/bin/env node
/**
 * ============================================================================
 * STRIPE TAX SETUP VERIFICATION SCRIPT
 * ============================================================================
 *
 * Run this script to verify your Stripe account is properly configured
 * for tax reporting with your cleaning company platform.
 *
 * Usage:
 *   node scripts/verify-stripe-tax-setup.js
 *
 * Requirements:
 *   - STRIPE_SECRET_KEY environment variable must be set
 *   - Stripe Connect must be enabled on your account
 *
 * ============================================================================
 */

require("dotenv").config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("\n❌ ERROR: STRIPE_SECRET_KEY environment variable is not set\n");
  console.log("Please add STRIPE_SECRET_KEY to your .env file:");
  console.log("  STRIPE_SECRET_KEY=sk_live_xxxxx (for production)");
  console.log("  STRIPE_SECRET_KEY=sk_test_xxxxx (for testing)\n");
  process.exit(1);
}

const stripe = require("stripe")(STRIPE_SECRET_KEY);

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const CHECK = `${colors.green}✓${colors.reset}`;
const CROSS = `${colors.red}✗${colors.reset}`;
const WARN = `${colors.yellow}⚠${colors.reset}`;
const INFO = `${colors.blue}ℹ${colors.reset}`;

console.log(`
${colors.bold}============================================================================
                    STRIPE TAX SETUP VERIFICATION
============================================================================${colors.reset}
`);

const results = {
  passed: [],
  failed: [],
  warnings: [],
};

async function checkStripeConnection() {
  console.log(`${colors.cyan}[1/7] Checking Stripe API Connection...${colors.reset}`);

  try {
    const account = await stripe.accounts.retrieve();
    console.log(`  ${CHECK} Connected to Stripe account: ${account.id}`);
    console.log(`  ${INFO} Business name: ${account.business_profile?.name || account.settings?.dashboard?.display_name || "Not set"}`);
    console.log(`  ${INFO} Account type: ${account.type || "standard"}`);
    console.log(`  ${INFO} Country: ${account.country}`);

    const isLive = STRIPE_SECRET_KEY.startsWith("sk_live");
    if (isLive) {
      console.log(`  ${WARN} ${colors.yellow}Running in LIVE mode${colors.reset}`);
    } else {
      console.log(`  ${INFO} Running in TEST mode`);
    }

    results.passed.push("Stripe API connection");
    return account;
  } catch (error) {
    console.log(`  ${CROSS} Failed to connect to Stripe: ${error.message}`);
    results.failed.push("Stripe API connection");
    return null;
  }
}

async function checkConnectEnabled() {
  console.log(`\n${colors.cyan}[2/7] Checking Stripe Connect Configuration...${colors.reset}`);

  try {
    // Try to list connected accounts - this will fail if Connect isn't enabled
    const accounts = await stripe.accounts.list({ limit: 1 });
    console.log(`  ${CHECK} Stripe Connect is enabled`);
    console.log(`  ${INFO} Connected accounts found: ${accounts.data.length > 0 ? "Yes" : "None yet"}`);
    results.passed.push("Stripe Connect enabled");
    return true;
  } catch (error) {
    if (error.code === "account_invalid" || error.message.includes("Connect")) {
      console.log(`  ${CROSS} Stripe Connect is not enabled on this account`);
      console.log(`  ${INFO} Enable Connect at: https://dashboard.stripe.com/connect/accounts/overview`);
      results.failed.push("Stripe Connect not enabled");
    } else {
      console.log(`  ${WARN} Could not verify Connect status: ${error.message}`);
      results.warnings.push("Connect status check");
    }
    return false;
  }
}

async function checkConnectedAccounts() {
  console.log(`\n${colors.cyan}[3/7] Checking Connected Accounts...${colors.reset}`);

  try {
    const accounts = await stripe.accounts.list({ limit: 100 });
    const total = accounts.data.length;

    if (total === 0) {
      console.log(`  ${INFO} No connected accounts yet`);
      console.log(`  ${INFO} Connected accounts will be created when cleaners set up payments`);
      results.warnings.push("No connected accounts yet");
      return { total: 0, complete: 0, pending: 0 };
    }

    let complete = 0;
    let pending = 0;
    let payoutsEnabled = 0;

    for (const acc of accounts.data) {
      if (acc.details_submitted && acc.payouts_enabled) {
        complete++;
        payoutsEnabled++;
      } else if (acc.details_submitted) {
        complete++;
      } else {
        pending++;
      }
    }

    console.log(`  ${CHECK} Found ${total} connected account(s)`);
    console.log(`  ${INFO} Onboarding complete: ${complete}`);
    console.log(`  ${INFO} Onboarding pending: ${pending}`);
    console.log(`  ${INFO} Payouts enabled: ${payoutsEnabled}`);

    results.passed.push("Connected accounts check");
    return { total, complete, pending, payoutsEnabled };
  } catch (error) {
    console.log(`  ${CROSS} Failed to fetch connected accounts: ${error.message}`);
    results.failed.push("Connected accounts check");
    return null;
  }
}

async function checkPayoutSchedule() {
  console.log(`\n${colors.cyan}[4/7] Checking Default Payout Settings...${colors.reset}`);

  try {
    const account = await stripe.accounts.retrieve();
    const payoutSchedule = account.settings?.payouts?.schedule;

    if (payoutSchedule) {
      console.log(`  ${CHECK} Payout schedule configured`);
      console.log(`  ${INFO} Interval: ${payoutSchedule.interval}`);
      if (payoutSchedule.delay_days) {
        console.log(`  ${INFO} Delay: ${payoutSchedule.delay_days} day(s)`);
      }
      results.passed.push("Payout schedule");
    } else {
      console.log(`  ${INFO} Using Stripe default payout schedule`);
      results.passed.push("Payout schedule (default)");
    }

    return true;
  } catch (error) {
    console.log(`  ${WARN} Could not verify payout settings: ${error.message}`);
    results.warnings.push("Payout settings check");
    return false;
  }
}

async function checkTaxSettings() {
  console.log(`\n${colors.cyan}[5/7] Checking Tax Reporting Configuration...${colors.reset}`);

  // Note: Tax reporting settings aren't directly accessible via API
  // We check for indicators and provide guidance

  console.log(`  ${INFO} Tax reporting settings must be verified in Stripe Dashboard`);
  console.log(`  ${INFO} Go to: Settings → Connect → Tax reporting`);
  console.log("");
  console.log(`  ${colors.bold}Manual Checklist:${colors.reset}`);
  console.log(`  [ ] 1099 tax form support is enabled`);
  console.log(`  [ ] Payer information is complete (business name, EIN, address)`);
  console.log(`  [ ] Delivery method is configured (e-delivery recommended)`);
  console.log(`  [ ] Form type is set to 1099-NEC`);
  console.log("");
  console.log(`  ${colors.dim}Dashboard URL: https://dashboard.stripe.com/settings/connect/tax-reporting${colors.reset}`);

  results.warnings.push("Tax settings require manual verification");
  return true;
}

async function checkWebhooks() {
  console.log(`\n${colors.cyan}[6/7] Checking Webhook Configuration...${colors.reset}`);

  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });

    if (webhooks.data.length === 0) {
      console.log(`  ${WARN} No webhooks configured`);
      console.log(`  ${INFO} Webhooks are recommended for:`);
      console.log(`      - account.updated (Connect account changes)`);
      console.log(`      - payout.paid (Payout confirmations)`);
      console.log(`      - person.updated (Tax info updates)`);
      results.warnings.push("No webhooks configured");
      return false;
    }

    console.log(`  ${CHECK} Found ${webhooks.data.length} webhook endpoint(s)`);

    const recommendedEvents = [
      "account.updated",
      "payout.paid",
      "payout.failed",
      "payment_intent.succeeded",
    ];

    const allEnabledEvents = new Set();
    webhooks.data.forEach(wh => {
      if (wh.enabled_events) {
        wh.enabled_events.forEach(e => allEnabledEvents.add(e));
      }
    });

    const hasAllEvents = allEnabledEvents.has("*");

    for (const event of recommendedEvents) {
      if (hasAllEvents || allEnabledEvents.has(event)) {
        console.log(`  ${CHECK} ${event}`);
      } else {
        console.log(`  ${WARN} ${event} (not configured)`);
      }
    }

    results.passed.push("Webhooks configured");
    return true;
  } catch (error) {
    console.log(`  ${WARN} Could not verify webhooks: ${error.message}`);
    results.warnings.push("Webhook check");
    return false;
  }
}

async function checkRecentPayouts() {
  console.log(`\n${colors.cyan}[7/7] Checking Recent Payout Activity...${colors.reset}`);

  try {
    // Check for any payouts in the system
    const payouts = await stripe.payouts.list({ limit: 5 });

    if (payouts.data.length === 0) {
      console.log(`  ${INFO} No payouts recorded yet`);
      console.log(`  ${INFO} Payouts will be tracked automatically when cleaners complete jobs`);
      return true;
    }

    console.log(`  ${CHECK} Payout activity found`);

    // Calculate totals for current year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01T00:00:00Z`);

    const yearPayouts = await stripe.payouts.list({
      created: { gte: Math.floor(yearStart.getTime() / 1000) },
      limit: 100,
    });

    const totalAmount = yearPayouts.data.reduce((sum, p) => {
      if (p.status === "paid") {
        return sum + p.amount;
      }
      return sum;
    }, 0);

    console.log(`  ${INFO} ${currentYear} payouts: ${yearPayouts.data.length}`);
    console.log(`  ${INFO} ${currentYear} total amount: $${(totalAmount / 100).toFixed(2)}`);

    results.passed.push("Payout activity");
    return true;
  } catch (error) {
    console.log(`  ${WARN} Could not check payouts: ${error.message}`);
    results.warnings.push("Payout activity check");
    return false;
  }
}

async function generateReport() {
  console.log(`
${colors.bold}============================================================================
                           VERIFICATION SUMMARY
============================================================================${colors.reset}
`);

  if (results.passed.length > 0) {
    console.log(`${colors.green}PASSED (${results.passed.length}):${colors.reset}`);
    results.passed.forEach(item => console.log(`  ${CHECK} ${item}`));
  }

  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}WARNINGS (${results.warnings.length}):${colors.reset}`);
    results.warnings.forEach(item => console.log(`  ${WARN} ${item}`));
  }

  if (results.failed.length > 0) {
    console.log(`\n${colors.red}FAILED (${results.failed.length}):${colors.reset}`);
    results.failed.forEach(item => console.log(`  ${CROSS} ${item}`));
  }

  console.log(`
${colors.bold}============================================================================
                           NEXT STEPS
============================================================================${colors.reset}
`);

  if (results.failed.length > 0) {
    console.log(`${colors.red}Critical issues must be resolved:${colors.reset}`);
    console.log(`  1. Ensure STRIPE_SECRET_KEY is correct`);
    console.log(`  2. Enable Stripe Connect in your dashboard`);
    console.log(`  3. Complete platform onboarding\n`);
  }

  console.log(`${colors.cyan}Tax Reporting Setup (do this in Stripe Dashboard):${colors.reset}`);
  console.log(`  1. Go to: https://dashboard.stripe.com/settings/connect`);
  console.log(`  2. Click "Tax reporting" in the left sidebar`);
  console.log(`  3. Enable "1099 tax form support"`);
  console.log(`  4. Enter your business details (Payer information):`);
  console.log(`     - Legal business name`);
  console.log(`     - EIN (Employer Identification Number)`);
  console.log(`     - Business address`);
  console.log(`  5. Configure delivery method (e-delivery recommended)`);
  console.log(`  6. Save changes\n`);

  console.log(`${colors.cyan}Verification Endpoint:${colors.reset}`);
  console.log(`  Your app has an endpoint to verify setup at runtime:`);
  console.log(`  GET /api/v1/tax/admin/verify-setup`);
  console.log(`  (Requires business owner authentication)\n`);

  const overallStatus = results.failed.length === 0;

  if (overallStatus) {
    console.log(`${colors.green}${colors.bold}Overall Status: READY${colors.reset}`);
    console.log(`${colors.dim}(Complete the manual tax reporting setup in Stripe Dashboard)${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}Overall Status: ACTION REQUIRED${colors.reset}`);
    console.log(`${colors.dim}Please resolve the failed checks above${colors.reset}\n`);
  }

  return overallStatus;
}

async function main() {
  try {
    await checkStripeConnection();
    await checkConnectEnabled();
    await checkConnectedAccounts();
    await checkPayoutSchedule();
    await checkTaxSettings();
    await checkWebhooks();
    await checkRecentPayouts();

    const success = await generateReport();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(`\n${CROSS} Unexpected error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
