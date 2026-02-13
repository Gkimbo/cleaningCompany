/**
 * ============================================================================
 * STRIPE TAX ROUTER
 * Simplified tax endpoints using Stripe Tax Reporting
 * ============================================================================
 *
 * This router replaces the custom tax document system. Stripe handles:
 * - SSN/EIN collection during Connect onboarding
 * - 1099 form generation and delivery
 * - IRS filing compliance
 *
 * Endpoints:
 * - GET /earnings/:year - Get earnings summary for a tax year
 * - GET /dashboard-link - Get Stripe Express Dashboard link (for tax forms)
 * - GET /status - Check if user's Stripe account is tax-ready
 *
 * Platform Tax Endpoints (for business owner's own taxes):
 * - GET /platform/income-summary/:year
 * - GET /platform/quarterly-tax/:year/:quarter
 * - GET /platform/schedule-c/:year
 * - GET /platform/1099-k-expectation/:year
 * - GET /platform/deadlines/:year
 * - GET /platform/comprehensive-report/:year
 * - GET /platform/monthly-breakdown/:year
 *
 * ============================================================================
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const {
  User,
  Payment,
  StripeConnectAccount,
  PlatformEarnings,
} = require("../../../models");
const PlatformTaxService = require("../../../services/PlatformTaxService");

const stripeTaxRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? require("stripe")(STRIPE_SECRET_KEY) : null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verifies JWT token and returns decoded payload
 */
const verifyToken = (token) => {
  if (!token) return null;
  try {
    return jwt.verify(token, secretKey);
  } catch (error) {
    return null;
  }
};

/**
 * Extracts and verifies token from Authorization header
 */
const getAuthenticatedUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  return verifyToken(token);
};

/**
 * Validates tax year parameter
 */
const validateTaxYear = (year) => {
  const taxYear = parseInt(year, 10);
  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    return null;
  }
  return taxYear;
};

// ============================================================================
// CLEANER TAX ENDPOINTS
// ============================================================================

/**
 * GET /earnings/:year
 * Get earnings summary for a tax year (for cleaners/employees)
 *
 * Returns earnings from Payment records - no sensitive PII stored.
 * Cleaners access their 1099 forms via Stripe Express Dashboard.
 */
stripeTaxRouter.get("/earnings/:year", async (req, res) => {
  const { year } = req.params;
  const taxYear = validateTaxYear(year);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  // Authenticate user
  const decoded = getAuthenticatedUser(req);
  if (!decoded) {
    return res.status(401).json({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }

  const userId = decoded.userId;

  try {
    // Get date range for the tax year
    const start = new Date(`${taxYear}-01-01T00:00:00Z`);
    const end = new Date(`${taxYear + 1}-01-01T00:00:00Z`);

    // Get all completed payouts for the year
    const payments = await Payment.findAll({
      where: {
        cleanerId: userId,
        type: "payout",
        status: "succeeded",
        createdAt: {
          [Op.gte]: start,
          [Op.lt]: end,
        },
      },
      order: [["createdAt", "ASC"]],
    });

    const totalEarningsCents = payments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );
    const transactionCount = payments.length;
    const requires1099 = totalEarningsCents >= 60000; // $600 threshold

    // Get monthly breakdown
    const monthlyBreakdown = {};
    payments.forEach((p) => {
      const month = new Date(p.createdAt).getMonth() + 1;
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = { count: 0, amountCents: 0 };
      }
      monthlyBreakdown[month].count++;
      monthlyBreakdown[month].amountCents += p.amount || 0;
    });

    return res.json({
      taxYear,
      totalEarningsCents,
      totalEarningsDollars: (totalEarningsCents / 100).toFixed(2),
      transactionCount,
      requires1099,
      threshold: {
        amountCents: 60000,
        amountDollars: "600.00",
      },
      message: requires1099
        ? "You will receive a 1099 form from Stripe. Access it via your Stripe Dashboard."
        : "Your earnings are below the $600 threshold. No 1099 form required.",
      monthlyBreakdown: Object.entries(monthlyBreakdown).map(
        ([month, data]) => ({
          month: parseInt(month),
          count: data.count,
          amountCents: data.amountCents,
          amountDollars: (data.amountCents / 100).toFixed(2),
        })
      ),
    });
  } catch (error) {
    console.error("[StripeTax] Error fetching earnings:", error);
    return res.status(500).json({
      error: "Failed to fetch earnings summary",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /dashboard-link
 * Generate Stripe Express Dashboard login link
 *
 * Cleaners access their 1099 forms and payout details through
 * the Stripe Express Dashboard.
 */
stripeTaxRouter.get("/dashboard-link", async (req, res) => {
  // Authenticate user
  const decoded = getAuthenticatedUser(req);
  if (!decoded) {
    return res.status(401).json({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }

  if (!stripe) {
    return res.status(500).json({
      error: "Stripe is not configured",
      code: "STRIPE_NOT_CONFIGURED",
    });
  }

  try {
    // Find Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: decoded.userId },
    });

    if (!connectAccount) {
      return res.status(404).json({
        error: "No Stripe Connect account found. Please complete payment setup first.",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    // Account must have completed onboarding
    if (!connectAccount.detailsSubmitted) {
      return res.status(400).json({
        error: "Please complete Stripe onboarding before accessing the dashboard",
        code: "ONBOARDING_INCOMPLETE",
      });
    }

    // Create Login Link
    const loginLink = await stripe.accounts.createLoginLink(
      connectAccount.stripeAccountId
    );

    return res.json({
      success: true,
      url: loginLink.url,
      message: "Access your tax forms (1099) and payout details in the Stripe Dashboard",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Links typically expire in ~5 min
    });
  } catch (error) {
    console.error("[StripeTax] Error generating dashboard link:", error);
    return res.status(500).json({
      error: "Failed to generate dashboard link",
      code: "LINK_GENERATION_FAILED",
    });
  }
});

/**
 * GET /status
 * Check if user's Stripe account is ready for tax reporting
 */
stripeTaxRouter.get("/status", async (req, res) => {
  // Authenticate user
  const decoded = getAuthenticatedUser(req);
  if (!decoded) {
    return res.status(401).json({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }

  try {
    // Find Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: decoded.userId },
    });

    if (!connectAccount) {
      return res.json({
        stripeConnected: false,
        onboardingComplete: false,
        taxInfoProvided: false,
        payoutsEnabled: false,
        canReceive1099: false,
        message: "Please complete Stripe payment setup to receive tax documents",
      });
    }

    // Fetch latest status from Stripe if available
    let stripeData = null;
    if (stripe) {
      try {
        stripeData = await stripe.accounts.retrieve(connectAccount.stripeAccountId);
      } catch (stripeErr) {
        console.warn("[StripeTax] Could not fetch Stripe account:", stripeErr.message);
      }
    }

    const onboardingComplete = connectAccount.onboardingComplete ||
      (stripeData?.payouts_enabled && stripeData?.details_submitted);
    const payoutsEnabled = connectAccount.payoutsEnabled || stripeData?.payouts_enabled || false;

    // In Stripe Connect, tax info (SSN/EIN) is collected during onboarding
    // If onboarding is complete, tax info was provided
    const taxInfoProvided = onboardingComplete;

    return res.json({
      stripeConnected: true,
      onboardingComplete,
      taxInfoProvided,
      payoutsEnabled,
      canReceive1099: onboardingComplete && payoutsEnabled,
      accountStatus: connectAccount.accountStatus,
      message: onboardingComplete
        ? "Your Stripe account is set up. Tax forms (1099) will be available in your Stripe Dashboard."
        : "Please complete Stripe onboarding to receive tax documents.",
    });
  } catch (error) {
    console.error("[StripeTax] Error fetching status:", error);
    return res.status(500).json({
      error: "Failed to fetch tax status",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /contractor/tax-summary/:year
 * Alias for /earnings/:year - kept for backwards compatibility
 */
stripeTaxRouter.get("/contractor/tax-summary/:year", async (req, res) => {
  const { year } = req.params;
  const taxYear = validateTaxYear(year);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  // Authenticate user
  const decoded = getAuthenticatedUser(req);
  if (!decoded) {
    return res.status(401).json({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }

  const userId = decoded.userId;

  try {
    const start = new Date(`${taxYear}-01-01T00:00:00Z`);
    const end = new Date(`${taxYear + 1}-01-01T00:00:00Z`);

    const payments = await Payment.findAll({
      where: {
        cleanerId: userId,
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

    return res.json({
      taxYear,
      totalEarningsCents,
      jobCount: payments.length,
      requires1099: totalEarningsCents >= 60000,
    });
  } catch (error) {
    console.error("[StripeTax] Error fetching contractor tax summary:", error);
    return res.status(500).json({
      error: "Failed to fetch tax summary",
      code: "FETCH_FAILED",
    });
  }
});

// ============================================================================
// PLATFORM TAX ENDPOINTS (Business Owner's Own Taxes)
// ============================================================================

/**
 * Middleware to verify business owner access for platform tax endpoints
 */
const requireBusinessOwner = async (req, res, next) => {
  const decoded = getAuthenticatedUser(req);
  if (!decoded) {
    return res.status(401).json({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }

  try {
    const user = await User.findByPk(decoded.userId);
    // Allow access if user is a business owner OR has type "owner" (platform owner)
    const hasAccess = user && (user.isBusinessOwner || user.type === "owner");
    if (!hasAccess) {
      return res.status(403).json({
        error: "Business owner access required",
        code: "FORBIDDEN",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("[StripeTax] Error verifying business owner:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      code: "AUTH_FAILED",
    });
  }
};

/**
 * GET /platform/income-summary/:year
 * Get annual income summary for the platform/company
 */
stripeTaxRouter.get("/platform/income-summary/:year", requireBusinessOwner, async (req, res) => {
  const { year } = req.params;
  const taxYear = validateTaxYear(year);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const summary = await PlatformTaxService.getAnnualIncomeSummary(taxYear);
    return res.json(summary);
  } catch (error) {
    console.error("[StripeTax] Error fetching platform income summary:", error);
    return res.status(500).json({
      error: "Failed to fetch income summary",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /platform/quarterly-tax/:year/:quarter
 * Get quarterly estimated tax calculation
 */
stripeTaxRouter.get("/platform/quarterly-tax/:year/:quarter", requireBusinessOwner, async (req, res) => {
  const { year, quarter } = req.params;
  const taxYear = validateTaxYear(year);
  const taxQuarter = parseInt(quarter, 10);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  if (isNaN(taxQuarter) || taxQuarter < 1 || taxQuarter > 4) {
    return res.status(400).json({
      error: "Invalid quarter (must be 1-4)",
      code: "INVALID_QUARTER",
    });
  }

  try {
    const taxData = await PlatformTaxService.calculateQuarterlyEstimatedTax(
      taxYear,
      taxQuarter
    );
    return res.json(taxData);
  } catch (error) {
    console.error("[StripeTax] Error calculating quarterly tax:", error);
    return res.status(500).json({
      error: "Failed to calculate quarterly tax",
      code: "CALCULATION_FAILED",
    });
  }
});

/**
 * GET /platform/schedule-c/:year
 * Generate Schedule C data for tax filing
 */
stripeTaxRouter.get("/platform/schedule-c/:year", requireBusinessOwner, async (req, res) => {
  const { year } = req.params;
  const taxYear = validateTaxYear(year);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const scheduleCData = await PlatformTaxService.generateScheduleCData(taxYear);
    return res.json(scheduleCData);
  } catch (error) {
    console.error("[StripeTax] Error generating Schedule C:", error);
    return res.status(500).json({
      error: "Failed to generate Schedule C data",
      code: "GENERATE_FAILED",
    });
  }
});

/**
 * GET /platform/1099-k-expectation/:year
 * Check if company should expect a 1099-K from Stripe
 */
stripeTaxRouter.get("/platform/1099-k-expectation/:year", requireBusinessOwner, async (req, res) => {
  const { year } = req.params;
  const taxYear = validateTaxYear(year);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const expectation = await PlatformTaxService.generate1099KExpectation(taxYear);
    return res.json(expectation);
  } catch (error) {
    console.error("[StripeTax] Error checking 1099-K expectation:", error);
    return res.status(500).json({
      error: "Failed to check 1099-K expectation",
      code: "CHECK_FAILED",
    });
  }
});

/**
 * GET /platform/deadlines/:year
 * Get company tax filing deadlines
 */
stripeTaxRouter.get("/platform/deadlines/:year", requireBusinessOwner, async (req, res) => {
  const { year } = req.params;
  const taxYear = parseInt(year, 10);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > 2100) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const deadlines = PlatformTaxService.getTaxDeadlines(taxYear);
    return res.json(deadlines);
  } catch (error) {
    console.error("[StripeTax] Error fetching platform deadlines:", error);
    return res.status(500).json({
      error: "Failed to fetch deadlines",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /platform/comprehensive-report/:year
 * Get comprehensive tax report for the year
 */
stripeTaxRouter.get("/platform/comprehensive-report/:year", requireBusinessOwner, async (req, res) => {
  const { year } = req.params;
  const taxYear = validateTaxYear(year);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const report = await PlatformTaxService.getComprehensiveTaxReport(taxYear);
    return res.json(report);
  } catch (error) {
    console.error("[StripeTax] Error generating comprehensive report:", error);
    return res.status(500).json({
      error: "Failed to generate comprehensive report",
      code: "GENERATE_FAILED",
    });
  }
});

/**
 * GET /platform/monthly-breakdown/:year
 * Get monthly earnings breakdown for the year
 */
stripeTaxRouter.get("/platform/monthly-breakdown/:year", requireBusinessOwner, async (req, res) => {
  const { year } = req.params;
  const taxYear = validateTaxYear(year);

  if (!taxYear) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const breakdown = await PlatformEarnings.getMonthlyBreakdown(taxYear);
    return res.json({
      taxYear,
      months: breakdown,
    });
  } catch (error) {
    console.error("[StripeTax] Error fetching monthly breakdown:", error);
    return res.status(500).json({
      error: "Failed to fetch monthly breakdown",
      code: "FETCH_FAILED",
    });
  }
});

// ============================================================================
// ADMIN VERIFICATION ENDPOINTS
// ============================================================================

/**
 * GET /admin/verify-setup
 * Verify Stripe tax reporting setup (business owner only)
 *
 * This endpoint checks the Stripe configuration and returns a detailed
 * status report to help ensure everything is set up correctly for tax reporting.
 */
stripeTaxRouter.get("/admin/verify-setup", requireBusinessOwner, async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test",
    checks: [],
    summary: {
      passed: 0,
      warnings: 0,
      failed: 0,
    },
  };

  const addCheck = (name, status, message, details = null) => {
    checks.checks.push({ name, status, message, details });
    if (status === "passed") checks.summary.passed++;
    else if (status === "warning") checks.summary.warnings++;
    else checks.summary.failed++;
  };

  // Check 1: Stripe API connection
  if (!stripe) {
    addCheck(
      "Stripe API",
      "failed",
      "Stripe is not configured - STRIPE_SECRET_KEY not set"
    );
    return res.json(checks);
  }

  try {
    const account = await stripe.accounts.retrieve();
    addCheck("Stripe API", "passed", "Connected to Stripe", {
      accountId: account.id,
      businessName: account.business_profile?.name || account.settings?.dashboard?.display_name,
      country: account.country,
    });
  } catch (error) {
    addCheck("Stripe API", "failed", `Cannot connect to Stripe: ${error.message}`);
    return res.json(checks);
  }

  // Check 2: Stripe Connect
  try {
    const accounts = await stripe.accounts.list({ limit: 1 });
    addCheck("Stripe Connect", "passed", "Stripe Connect is enabled");
  } catch (error) {
    addCheck("Stripe Connect", "failed", "Stripe Connect may not be enabled", {
      error: error.message,
    });
  }

  // Check 3: Connected accounts status
  try {
    const accounts = await stripe.accounts.list({ limit: 100 });
    const total = accounts.data.length;
    let complete = 0;
    let pending = 0;
    let payoutsEnabled = 0;

    for (const acc of accounts.data) {
      if (acc.details_submitted) complete++;
      else pending++;
      if (acc.payouts_enabled) payoutsEnabled++;
    }

    if (total === 0) {
      addCheck(
        "Connected Accounts",
        "warning",
        "No connected accounts yet - cleaners need to complete payment setup"
      );
    } else {
      addCheck("Connected Accounts", "passed", `${total} connected account(s)`, {
        total,
        onboardingComplete: complete,
        onboardingPending: pending,
        payoutsEnabled,
      });
    }
  } catch (error) {
    addCheck("Connected Accounts", "warning", `Could not fetch accounts: ${error.message}`);
  }

  // Check 4: Database connection and models
  try {
    const connectAccountCount = await StripeConnectAccount.count();
    const paymentCount = await Payment.count();

    addCheck("Database Models", "passed", "Database models accessible", {
      stripeConnectAccounts: connectAccountCount,
      payments: paymentCount,
    });
  } catch (error) {
    addCheck("Database Models", "failed", `Database error: ${error.message}`);
  }

  // Check 5: Current year earnings tracking
  try {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01T00:00:00Z`);
    const yearEnd = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

    const yearPayments = await Payment.findAll({
      where: {
        type: "payout",
        status: "succeeded",
        createdAt: {
          [Op.gte]: yearStart,
          [Op.lt]: yearEnd,
        },
      },
      attributes: ["amount", "cleanerId"],
    });

    const totalAmount = yearPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const uniqueCleaners = new Set(yearPayments.map(p => p.cleanerId)).size;

    // Count how many would get 1099s (earned >= $600)
    const earningsByUser = {};
    yearPayments.forEach(p => {
      if (!earningsByUser[p.cleanerId]) earningsByUser[p.cleanerId] = 0;
      earningsByUser[p.cleanerId] += p.amount || 0;
    });
    const requires1099Count = Object.values(earningsByUser).filter(amt => amt >= 60000).length;

    addCheck("Earnings Tracking", "passed", `Tracking ${currentYear} earnings`, {
      year: currentYear,
      totalPayouts: yearPayments.length,
      totalAmountCents: totalAmount,
      totalAmountDollars: (totalAmount / 100).toFixed(2),
      uniqueCleaners,
      cleanersRequiring1099: requires1099Count,
    });
  } catch (error) {
    addCheck("Earnings Tracking", "warning", `Could not fetch earnings: ${error.message}`);
  }

  // Check 6: Tax reporting reminder
  addCheck(
    "Tax Reporting Settings",
    "warning",
    "Manual verification required in Stripe Dashboard",
    {
      action: "Verify these settings in Stripe Dashboard → Settings → Connect → Tax reporting",
      checklist: [
        "1099 tax form support is enabled",
        "Payer information is complete (business name, EIN, address)",
        "Delivery method is configured (e-delivery recommended)",
        "Form type is set to 1099-NEC",
      ],
      dashboardUrl: "https://dashboard.stripe.com/settings/connect/tax-reporting",
    }
  );

  // Add overall status
  checks.overallStatus =
    checks.summary.failed > 0
      ? "action_required"
      : checks.summary.warnings > 0
      ? "review_recommended"
      : "ready";

  checks.nextSteps = [];

  if (checks.summary.failed > 0) {
    checks.nextSteps.push("Resolve failed checks before going live");
  }

  if (checks.summary.warnings > 0) {
    checks.nextSteps.push("Review warnings and complete manual setup steps");
  }

  checks.nextSteps.push(
    "Complete tax reporting setup in Stripe Dashboard",
    "Run: node scripts/verify-stripe-tax-setup.js for detailed CLI verification"
  );

  return res.json(checks);
});

/**
 * GET /admin/connected-accounts-summary
 * Get summary of all connected accounts for tax reporting purposes
 */
stripeTaxRouter.get("/admin/connected-accounts-summary", requireBusinessOwner, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      error: "Stripe is not configured",
      code: "STRIPE_NOT_CONFIGURED",
    });
  }

  try {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01T00:00:00Z`);
    const yearEnd = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

    // Get all connected accounts from database
    const dbAccounts = await StripeConnectAccount.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
      ],
    });

    // Get earnings for each account
    const accountsWithEarnings = await Promise.all(
      dbAccounts.map(async (account) => {
        const payments = await Payment.findAll({
          where: {
            cleanerId: account.userId,
            type: "payout",
            status: "succeeded",
            createdAt: {
              [Op.gte]: yearStart,
              [Op.lt]: yearEnd,
            },
          },
        });

        const totalEarningsCents = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
          id: account.id,
          stripeAccountId: account.stripeAccountId,
          user: account.user
            ? {
                id: account.user.id,
                email: account.user.email,
                name: `${account.user.firstName || ""} ${account.user.lastName || ""}`.trim(),
              }
            : null,
          onboardingComplete: account.onboardingComplete,
          payoutsEnabled: account.payoutsEnabled,
          detailsSubmitted: account.detailsSubmitted,
          currentYearEarnings: {
            cents: totalEarningsCents,
            dollars: (totalEarningsCents / 100).toFixed(2),
            payoutCount: payments.length,
          },
          requires1099: totalEarningsCents >= 60000,
          createdAt: account.createdAt,
        };
      })
    );

    // Summary statistics
    const summary = {
      totalAccounts: accountsWithEarnings.length,
      onboardingComplete: accountsWithEarnings.filter((a) => a.onboardingComplete).length,
      onboardingPending: accountsWithEarnings.filter((a) => !a.onboardingComplete).length,
      payoutsEnabled: accountsWithEarnings.filter((a) => a.payoutsEnabled).length,
      accountsRequiring1099: accountsWithEarnings.filter((a) => a.requires1099).length,
      totalEarningsCents: accountsWithEarnings.reduce(
        (sum, a) => sum + a.currentYearEarnings.cents,
        0
      ),
    };

    summary.totalEarningsDollars = (summary.totalEarningsCents / 100).toFixed(2);

    return res.json({
      year: currentYear,
      summary,
      accounts: accountsWithEarnings,
    });
  } catch (error) {
    console.error("[StripeTax] Error fetching accounts summary:", error);
    return res.status(500).json({
      error: "Failed to fetch connected accounts summary",
      code: "FETCH_FAILED",
    });
  }
});

module.exports = stripeTaxRouter;
