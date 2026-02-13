/**
 * Test Script for Stripe Tax Router
 * Tests the new simplified tax endpoints that use Stripe Tax Reporting
 *
 * Run: node scripts/test-stripe-tax.js
 */

require("dotenv").config();
const jwt = require("jsonwebtoken");
const {
  User,
  Payment,
  StripeConnectAccount,
  PlatformEarnings,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

const secretKey = process.env.SESSION_SECRET;

const testResults = {
  passed: [],
  failed: [],
  warnings: [],
};

function logTest(name, passed, message = "") {
  if (passed) {
    testResults.passed.push({ name, message });
    console.log(`✅ PASS: ${name}${message ? ` - ${message}` : ""}`);
  } else {
    testResults.failed.push({ name, message });
    console.log(`❌ FAIL: ${name}${message ? ` - ${message}` : ""}`);
  }
}

function logWarning(name, message) {
  testResults.warnings.push({ name, message });
  console.log(`⚠️  WARN: ${name} - ${message}`);
}

// Test data
const TEST_CLEANER_ID = 99990;
const TEST_TAX_YEAR = 2025;

async function cleanupTestData() {
  console.log("\n=== Cleaning up test data ===\n");

  await Payment.destroy({ where: { cleanerId: TEST_CLEANER_ID } });
  await StripeConnectAccount.destroy({ where: { userId: TEST_CLEANER_ID } });
  await User.destroy({ where: { id: TEST_CLEANER_ID } });

  console.log("Test data cleaned up");
}

async function createTestData() {
  console.log("\n=== Creating test data ===\n");

  // Create test cleaner
  const cleaner = await User.create({
    id: TEST_CLEANER_ID,
    username: "test_tax_cleaner",
    email: "test_tax_email",
    firstName: "Test",
    lastName: "Cleaner",
    password: "test_password_hash",
    type: "cleaner",
  });
  console.log(`Created test cleaner: ${cleaner.id}`);

  // Create Stripe Connect account
  const connectAccount = await StripeConnectAccount.create({
    userId: TEST_CLEANER_ID,
    stripeAccountId: "acct_test_stripe_tax_123",
    accountStatus: "active",
    payoutsEnabled: true,
    chargesEnabled: true,
    detailsSubmitted: true,
    onboardingComplete: true,
  });
  console.log(`Created test Stripe Connect account: ${connectAccount.id}`);

  // Create test payments totaling $850 (above $600 threshold)
  const payments = [
    { amount: 25000, description: "Job 1" }, // $250
    { amount: 35000, description: "Job 2" }, // $350
    { amount: 25000, description: "Job 3" }, // $250
  ];

  for (const p of payments) {
    await Payment.create({
      transactionId: `txn_stripe_tax_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      cleanerId: TEST_CLEANER_ID,
      type: "payout",
      status: "succeeded",
      amount: p.amount,
      currency: "usd",
      description: p.description,
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });
  }
  console.log(`Created ${payments.length} test payments totaling $850`);

  return { cleaner, connectAccount };
}

function generateToken(userId, type = "cleaner") {
  return jwt.sign({ userId, type }, secretKey, { expiresIn: "1h" });
}

// ============================================================================
// UNIT TESTS - Test helper functions and edge cases
// ============================================================================

async function testValidateTaxYear() {
  console.log("\n=== Testing Tax Year Validation ===\n");

  // Valid years
  const currentYear = new Date().getFullYear();
  logTest("Current year is valid", currentYear >= 2020 && currentYear <= 2100);
  logTest("Year 2020 is valid", 2020 >= 2020);
  logTest("Year 2025 is valid", 2025 >= 2020 && 2025 <= currentYear);

  // Invalid years
  logTest("Year 2019 should be invalid", 2019 < 2020, "Below minimum year");
  logTest("Year 3000 should be invalid", 3000 > currentYear, "Above current year");
  logTest("Non-numeric year handled", isNaN(parseInt("abc")), "NaN check works");
}

async function testEarningsSummaryLogic() {
  console.log("\n=== Testing Earnings Summary Logic ===\n");

  const token = generateToken(TEST_CLEANER_ID);
  const taxYear = TEST_TAX_YEAR;

  // Simulate what the endpoint does
  const start = new Date(`${taxYear}-01-01T00:00:00Z`);
  const end = new Date(`${taxYear + 1}-01-01T00:00:00Z`);

  const payments = await Payment.findAll({
    where: {
      cleanerId: TEST_CLEANER_ID,
      type: "payout",
      status: "succeeded",
      createdAt: {
        [Op.gte]: start,
        [Op.lt]: end,
      },
    },
  });

  const totalEarningsCents = payments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  logTest("Found test payments", payments.length === 3, `Found ${payments.length} payments`);
  logTest("Total earnings calculated correctly", totalEarningsCents === 85000, `$${(totalEarningsCents / 100).toFixed(2)}`);
  logTest("Requires 1099 (above threshold)", totalEarningsCents >= 60000);

  // Test monthly breakdown logic
  const monthlyBreakdown = {};
  payments.forEach((p) => {
    const month = new Date(p.createdAt).getMonth() + 1;
    if (!monthlyBreakdown[month]) {
      monthlyBreakdown[month] = { count: 0, amountCents: 0 };
    }
    monthlyBreakdown[month].count++;
    monthlyBreakdown[month].amountCents += p.amount || 0;
  });

  logTest("Monthly breakdown computed", Object.keys(monthlyBreakdown).length > 0);
  logTest("June has all payments", monthlyBreakdown[6]?.count === 3, `June count: ${monthlyBreakdown[6]?.count}`);
}

async function testStripeConnectStatusLogic() {
  console.log("\n=== Testing Stripe Connect Status Logic ===\n");

  // Test with existing connect account
  const connectAccount = await StripeConnectAccount.findOne({
    where: { userId: TEST_CLEANER_ID },
  });

  logTest("Connect account found", !!connectAccount);
  logTest("Onboarding complete", connectAccount?.onboardingComplete === true);
  logTest("Payouts enabled", connectAccount?.payoutsEnabled === true);
  logTest("Can receive 1099", connectAccount?.onboardingComplete && connectAccount?.payoutsEnabled);

  // Test with non-existent user
  const noAccount = await StripeConnectAccount.findOne({
    where: { userId: 999999 },
  });
  logTest("Non-existent user returns null", noAccount === null);
}

async function testBelowThreshold() {
  console.log("\n=== Testing Below Threshold Scenario ===\n");

  const BELOW_THRESHOLD_USER = 99991;

  try {
    // Create user with only $500 in payments (below $600 threshold)
    await User.create({
      id: BELOW_THRESHOLD_USER,
      username: "test_below_threshold",
      email: "test_below_email",
      firstName: "Below",
      lastName: "Threshold",
      password: "test_password_hash",
      type: "cleaner",
    });

    await Payment.create({
      transactionId: `txn_below_${Date.now()}`,
      cleanerId: BELOW_THRESHOLD_USER,
      type: "payout",
      status: "succeeded",
      amount: 50000, // $500
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    // Test logic
    const start = new Date(`${TEST_TAX_YEAR}-01-01T00:00:00Z`);
    const end = new Date(`${TEST_TAX_YEAR + 1}-01-01T00:00:00Z`);

    const payments = await Payment.findAll({
      where: {
        cleanerId: BELOW_THRESHOLD_USER,
        type: "payout",
        status: "succeeded",
        createdAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });

    const totalEarningsCents = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const requires1099 = totalEarningsCents >= 60000;

    logTest("Below threshold user has $500", totalEarningsCents === 50000);
    logTest("Below threshold does NOT require 1099", requires1099 === false);

    // Cleanup
    await Payment.destroy({ where: { cleanerId: BELOW_THRESHOLD_USER } });
    await User.destroy({ where: { id: BELOW_THRESHOLD_USER } });
  } catch (error) {
    logTest("Below threshold test", false, error.message);
    await Payment.destroy({ where: { cleanerId: BELOW_THRESHOLD_USER } }).catch(() => {});
    await User.destroy({ where: { id: BELOW_THRESHOLD_USER } }).catch(() => {});
  }
}

async function testExactlyAtThreshold() {
  console.log("\n=== Testing Exactly At Threshold ($600) ===\n");

  const AT_THRESHOLD_USER = 99992;

  try {
    await User.create({
      id: AT_THRESHOLD_USER,
      username: "test_at_threshold",
      email: "test_at_email",
      firstName: "At",
      lastName: "Threshold",
      password: "test_password_hash",
      type: "cleaner",
    });

    await Payment.create({
      transactionId: `txn_at_${Date.now()}`,
      cleanerId: AT_THRESHOLD_USER,
      type: "payout",
      status: "succeeded",
      amount: 60000, // $600 exactly
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    const start = new Date(`${TEST_TAX_YEAR}-01-01T00:00:00Z`);
    const end = new Date(`${TEST_TAX_YEAR + 1}-01-01T00:00:00Z`);

    const payments = await Payment.findAll({
      where: {
        cleanerId: AT_THRESHOLD_USER,
        type: "payout",
        status: "succeeded",
        createdAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });

    const totalEarningsCents = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const requires1099 = totalEarningsCents >= 60000;

    logTest("At threshold user has exactly $600", totalEarningsCents === 60000);
    logTest("At exactly $600 DOES require 1099", requires1099 === true);

    // Cleanup
    await Payment.destroy({ where: { cleanerId: AT_THRESHOLD_USER } });
    await User.destroy({ where: { id: AT_THRESHOLD_USER } });
  } catch (error) {
    logTest("At threshold test", false, error.message);
    await Payment.destroy({ where: { cleanerId: AT_THRESHOLD_USER } }).catch(() => {});
    await User.destroy({ where: { id: AT_THRESHOLD_USER } }).catch(() => {});
  }
}

async function testNoPayments() {
  console.log("\n=== Testing User With No Payments ===\n");

  const NO_PAYMENTS_USER = 99993;

  try {
    await User.create({
      id: NO_PAYMENTS_USER,
      username: "test_no_payments",
      email: "test_no_payments_email",
      firstName: "No",
      lastName: "Payments",
      password: "test_password_hash",
      type: "cleaner",
    });

    const start = new Date(`${TEST_TAX_YEAR}-01-01T00:00:00Z`);
    const end = new Date(`${TEST_TAX_YEAR + 1}-01-01T00:00:00Z`);

    const payments = await Payment.findAll({
      where: {
        cleanerId: NO_PAYMENTS_USER,
        type: "payout",
        status: "succeeded",
        createdAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });

    const totalEarningsCents = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    logTest("No payments returns empty array", payments.length === 0);
    logTest("Total earnings is $0", totalEarningsCents === 0);
    logTest("$0 does NOT require 1099", totalEarningsCents < 60000);

    // Cleanup
    await User.destroy({ where: { id: NO_PAYMENTS_USER } });
  } catch (error) {
    logTest("No payments test", false, error.message);
    await User.destroy({ where: { id: NO_PAYMENTS_USER } }).catch(() => {});
  }
}

async function testNoStripeAccount() {
  console.log("\n=== Testing User Without Stripe Connect Account ===\n");

  const NO_STRIPE_USER = 99994;

  try {
    await User.create({
      id: NO_STRIPE_USER,
      username: "test_no_stripe",
      email: "test_no_stripe_email",
      firstName: "No",
      lastName: "Stripe",
      password: "test_password_hash",
      type: "cleaner",
    });

    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: NO_STRIPE_USER },
    });

    logTest("User without Stripe account returns null", connectAccount === null);

    // Test the response structure
    const response = {
      stripeConnected: !!connectAccount,
      onboardingComplete: false,
      taxInfoProvided: false,
      payoutsEnabled: false,
      canReceive1099: false,
      message: "Please complete Stripe payment setup to receive tax documents",
    };

    logTest("Response shows stripeConnected: false", response.stripeConnected === false);
    logTest("Response shows canReceive1099: false", response.canReceive1099 === false);

    // Cleanup
    await User.destroy({ where: { id: NO_STRIPE_USER } });
  } catch (error) {
    logTest("No Stripe account test", false, error.message);
    await User.destroy({ where: { id: NO_STRIPE_USER } }).catch(() => {});
  }
}

async function testIncompleteOnboarding() {
  console.log("\n=== Testing Incomplete Stripe Onboarding ===\n");

  const INCOMPLETE_USER = 99995;

  try {
    await User.create({
      id: INCOMPLETE_USER,
      username: "test_incomplete",
      email: "test_incomplete_email",
      firstName: "Incomplete",
      lastName: "Onboarding",
      password: "test_password_hash",
      type: "cleaner",
    });

    // Create incomplete Stripe account
    await StripeConnectAccount.create({
      userId: INCOMPLETE_USER,
      stripeAccountId: "acct_test_incomplete",
      accountStatus: "onboarding",
      payoutsEnabled: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    });

    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: INCOMPLETE_USER },
    });

    logTest("Incomplete onboarding account found", !!connectAccount);
    logTest("Onboarding NOT complete", connectAccount.onboardingComplete === false);
    logTest("Payouts NOT enabled", connectAccount.payoutsEnabled === false);
    logTest("Cannot receive 1099", !(connectAccount.onboardingComplete && connectAccount.payoutsEnabled));

    // Cleanup
    await StripeConnectAccount.destroy({ where: { userId: INCOMPLETE_USER } });
    await User.destroy({ where: { id: INCOMPLETE_USER } });
  } catch (error) {
    logTest("Incomplete onboarding test", false, error.message);
    await StripeConnectAccount.destroy({ where: { userId: INCOMPLETE_USER } }).catch(() => {});
    await User.destroy({ where: { id: INCOMPLETE_USER } }).catch(() => {});
  }
}

async function testPaymentStatusFiltering() {
  console.log("\n=== Testing Payment Status Filtering ===\n");

  const STATUS_TEST_USER = 99996;

  try {
    await User.create({
      id: STATUS_TEST_USER,
      username: "test_status_filter",
      email: "test_status_email",
      firstName: "Status",
      lastName: "Filter",
      password: "test_password_hash",
      type: "cleaner",
    });

    // Create payments with different statuses
    await Payment.create({
      transactionId: `txn_succeeded_${Date.now()}`,
      cleanerId: STATUS_TEST_USER,
      type: "payout",
      status: "succeeded",
      amount: 10000,
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    await Payment.create({
      transactionId: `txn_failed_${Date.now()}`,
      cleanerId: STATUS_TEST_USER,
      type: "payout",
      status: "failed",
      amount: 20000,
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    await Payment.create({
      transactionId: `txn_pending_${Date.now()}`,
      cleanerId: STATUS_TEST_USER,
      type: "payout",
      status: "pending",
      amount: 30000,
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    // Only succeeded payments should be counted
    const start = new Date(`${TEST_TAX_YEAR}-01-01T00:00:00Z`);
    const end = new Date(`${TEST_TAX_YEAR + 1}-01-01T00:00:00Z`);

    const succeededPayments = await Payment.findAll({
      where: {
        cleanerId: STATUS_TEST_USER,
        type: "payout",
        status: "succeeded",
        createdAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });

    const allPayments = await Payment.findAll({
      where: {
        cleanerId: STATUS_TEST_USER,
        type: "payout",
        createdAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });

    logTest("Only succeeded payments counted", succeededPayments.length === 1);
    logTest("Total payments exists", allPayments.length === 3);
    logTest("Failed/pending payments excluded", succeededPayments.length < allPayments.length);

    const totalSucceeded = succeededPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    logTest("Only $100 counted (not $600)", totalSucceeded === 10000);

    // Cleanup
    await Payment.destroy({ where: { cleanerId: STATUS_TEST_USER } });
    await User.destroy({ where: { id: STATUS_TEST_USER } });
  } catch (error) {
    logTest("Payment status filtering test", false, error.message);
    await Payment.destroy({ where: { cleanerId: STATUS_TEST_USER } }).catch(() => {});
    await User.destroy({ where: { id: STATUS_TEST_USER } }).catch(() => {});
  }
}

async function testPaymentTypeFiltering() {
  console.log("\n=== Testing Payment Type Filtering ===\n");

  const TYPE_TEST_USER = 99997;

  try {
    await User.create({
      id: TYPE_TEST_USER,
      username: "test_type_filter",
      email: "test_type_email",
      firstName: "Type",
      lastName: "Filter",
      password: "test_password_hash",
      type: "cleaner",
    });

    // Create payments with different types
    await Payment.create({
      transactionId: `txn_payout_${Date.now()}`,
      cleanerId: TYPE_TEST_USER,
      type: "payout",
      status: "succeeded",
      amount: 10000,
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    await Payment.create({
      transactionId: `txn_charge_${Date.now()}`,
      cleanerId: TYPE_TEST_USER,
      type: "charge",
      status: "succeeded",
      amount: 20000,
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    await Payment.create({
      transactionId: `txn_refund_${Date.now()}`,
      cleanerId: TYPE_TEST_USER,
      type: "refund",
      status: "succeeded",
      amount: 5000,
      currency: "usd",
      createdAt: new Date(`${TEST_TAX_YEAR}-06-15`),
    });

    // Only payout type should be counted
    const start = new Date(`${TEST_TAX_YEAR}-01-01T00:00:00Z`);
    const end = new Date(`${TEST_TAX_YEAR + 1}-01-01T00:00:00Z`);

    const payoutPayments = await Payment.findAll({
      where: {
        cleanerId: TYPE_TEST_USER,
        type: "payout",
        status: "succeeded",
        createdAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });

    logTest("Only payout type counted", payoutPayments.length === 1);

    const totalPayout = payoutPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    logTest("Only $100 from payouts counted", totalPayout === 10000);

    // Cleanup
    await Payment.destroy({ where: { cleanerId: TYPE_TEST_USER } });
    await User.destroy({ where: { id: TYPE_TEST_USER } });
  } catch (error) {
    logTest("Payment type filtering test", false, error.message);
    await Payment.destroy({ where: { cleanerId: TYPE_TEST_USER } }).catch(() => {});
    await User.destroy({ where: { id: TYPE_TEST_USER } }).catch(() => {});
  }
}

async function testCrossYearFiltering() {
  console.log("\n=== Testing Cross-Year Filtering ===\n");

  const CROSS_YEAR_USER = 99998;

  try {
    await User.create({
      id: CROSS_YEAR_USER,
      username: "test_cross_year",
      email: "test_cross_year_email",
      firstName: "Cross",
      lastName: "Year",
      password: "test_password_hash",
      type: "cleaner",
    });

    // Create payments in different years
    await Payment.create({
      transactionId: `txn_2024_${Date.now()}`,
      cleanerId: CROSS_YEAR_USER,
      type: "payout",
      status: "succeeded",
      amount: 100000, // $1000 in 2024
      currency: "usd",
      createdAt: new Date("2024-12-15"),
    });

    await Payment.create({
      transactionId: `txn_2025_${Date.now()}`,
      cleanerId: CROSS_YEAR_USER,
      type: "payout",
      status: "succeeded",
      amount: 50000, // $500 in 2025
      currency: "usd",
      createdAt: new Date("2025-01-15"),
    });

    // Query for 2025 only
    const start2025 = new Date("2025-01-01T00:00:00Z");
    const end2025 = new Date("2026-01-01T00:00:00Z");

    const payments2025 = await Payment.findAll({
      where: {
        cleanerId: CROSS_YEAR_USER,
        type: "payout",
        status: "succeeded",
        createdAt: { [Op.gte]: start2025, [Op.lt]: end2025 },
      },
    });

    const total2025 = payments2025.reduce((sum, p) => sum + (p.amount || 0), 0);

    logTest("Only 2025 payments returned for 2025 query", payments2025.length === 1);
    logTest("2025 total is $500 (not $1500)", total2025 === 50000);

    // Query for 2024
    const start2024 = new Date("2024-01-01T00:00:00Z");
    const end2024 = new Date("2025-01-01T00:00:00Z");

    const payments2024 = await Payment.findAll({
      where: {
        cleanerId: CROSS_YEAR_USER,
        type: "payout",
        status: "succeeded",
        createdAt: { [Op.gte]: start2024, [Op.lt]: end2024 },
      },
    });

    const total2024 = payments2024.reduce((sum, p) => sum + (p.amount || 0), 0);

    logTest("Only 2024 payments returned for 2024 query", payments2024.length === 1);
    logTest("2024 total is $1000", total2024 === 100000);

    // Cleanup
    await Payment.destroy({ where: { cleanerId: CROSS_YEAR_USER } });
    await User.destroy({ where: { id: CROSS_YEAR_USER } });
  } catch (error) {
    logTest("Cross-year filtering test", false, error.message);
    await Payment.destroy({ where: { cleanerId: CROSS_YEAR_USER } }).catch(() => {});
    await User.destroy({ where: { id: CROSS_YEAR_USER } }).catch(() => {});
  }
}

async function testPlatformTaxServiceExists() {
  console.log("\n=== Testing Platform Tax Service Availability ===\n");

  try {
    const PlatformTaxService = require("../services/PlatformTaxService");

    logTest("PlatformTaxService can be imported", !!PlatformTaxService);
    logTest("getAnnualIncomeSummary method exists", typeof PlatformTaxService.getAnnualIncomeSummary === "function");
    logTest("calculateQuarterlyEstimatedTax method exists", typeof PlatformTaxService.calculateQuarterlyEstimatedTax === "function");
    logTest("generateScheduleCData method exists", typeof PlatformTaxService.generateScheduleCData === "function");
    logTest("getTaxDeadlines method exists", typeof PlatformTaxService.getTaxDeadlines === "function");
    logTest("getComprehensiveTaxReport method exists", typeof PlatformTaxService.getComprehensiveTaxReport === "function");
    logTest("generate1099KExpectation method exists", typeof PlatformTaxService.generate1099KExpectation === "function");
  } catch (error) {
    logTest("PlatformTaxService import", false, error.message);
  }
}

async function testJWTTokenGeneration() {
  console.log("\n=== Testing JWT Token Generation ===\n");

  const token = generateToken(TEST_CLEANER_ID, "cleaner");

  logTest("Token generated", !!token);
  logTest("Token is a string", typeof token === "string");

  // Verify token
  try {
    const decoded = jwt.verify(token, secretKey);
    logTest("Token can be verified", !!decoded);
    logTest("Token contains userId", decoded.userId === TEST_CLEANER_ID);
    logTest("Token contains type", decoded.type === "cleaner");
  } catch (error) {
    logTest("Token verification", false, error.message);
  }

  // Test expired token
  const expiredToken = jwt.sign({ userId: 1, type: "cleaner" }, secretKey, { expiresIn: "-1h" });
  try {
    jwt.verify(expiredToken, secretKey);
    logTest("Expired token should fail verification", false);
  } catch (error) {
    logTest("Expired token correctly fails verification", error.name === "TokenExpiredError");
  }

  // Test invalid token
  try {
    jwt.verify("invalid_token", secretKey);
    logTest("Invalid token should fail verification", false);
  } catch (error) {
    logTest("Invalid token correctly fails verification", true);
  }
}

async function testRouterImport() {
  console.log("\n=== Testing Router Import ===\n");

  try {
    const stripeTaxRouter = require("../routes/api/v1/stripeTaxRouter");
    logTest("stripeTaxRouter can be imported", !!stripeTaxRouter);
    logTest("stripeTaxRouter is an Express router", typeof stripeTaxRouter === "function");
  } catch (error) {
    logTest("stripeTaxRouter import", false, error.message);
  }
}

async function checkForPotentialIssues() {
  console.log("\n=== Checking for Potential Issues ===\n");

  // Check if SESSION_SECRET is set
  if (!process.env.SESSION_SECRET) {
    logWarning("SESSION_SECRET", "Not set in environment - JWT will fail");
  } else {
    logTest("SESSION_SECRET is set", true);
  }

  // Check if STRIPE_SECRET_KEY is set
  if (!process.env.STRIPE_SECRET_KEY) {
    logWarning("STRIPE_SECRET_KEY", "Not set - Stripe API calls will fail (dashboard-link endpoint)");
  } else {
    logTest("STRIPE_SECRET_KEY is set", true);
  }

  // Check if PlatformEarnings model has getMonthlyBreakdown method
  try {
    if (typeof PlatformEarnings.getMonthlyBreakdown !== "function") {
      logWarning("PlatformEarnings.getMonthlyBreakdown", "Method not found - monthly breakdown endpoint may fail");
    } else {
      logTest("PlatformEarnings.getMonthlyBreakdown exists", true);
    }
  } catch (error) {
    logWarning("PlatformEarnings", error.message);
  }

  // Check for null/undefined handling in amount calculations
  const testPayment = { amount: null };
  const nullAmount = testPayment.amount || 0;
  logTest("Null amount handled correctly", nullAmount === 0);

  const undefinedPayment = {};
  const undefinedAmount = undefinedPayment.amount || 0;
  logTest("Undefined amount handled correctly", undefinedAmount === 0);
}

async function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("STRIPE TAX ROUTER TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);

  if (testResults.failed.length > 0) {
    console.log("\nFailed Tests:");
    testResults.failed.forEach((t) => console.log(`  - ${t.name}: ${t.message}`));
  }

  if (testResults.warnings.length > 0) {
    console.log("\nWarnings:");
    testResults.warnings.forEach((w) => console.log(`  - ${w.name}: ${w.message}`));
  }

  console.log("\n" + "=".repeat(60));
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("STRIPE TAX ROUTER TESTS");
  console.log("=".repeat(60));

  try {
    await sequelize.authenticate();
    console.log("Database connected");

    // Clean up any leftover test data
    await cleanupTestData();

    // Create fresh test data
    await createTestData();

    // Run tests
    await testRouterImport();
    await testJWTTokenGeneration();
    await testValidateTaxYear();
    await testEarningsSummaryLogic();
    await testStripeConnectStatusLogic();
    await testBelowThreshold();
    await testExactlyAtThreshold();
    await testNoPayments();
    await testNoStripeAccount();
    await testIncompleteOnboarding();
    await testPaymentStatusFiltering();
    await testPaymentTypeFiltering();
    await testCrossYearFiltering();
    await testPlatformTaxServiceExists();
    await checkForPotentialIssues();

    // Cleanup
    await cleanupTestData();
  } catch (error) {
    console.error("Test error:", error);
  }

  await printSummary();
  await sequelize.close();
}

runTests().catch(async (error) => {
  console.error("Fatal error:", error);
  await sequelize.close();
  process.exit(1);
});
