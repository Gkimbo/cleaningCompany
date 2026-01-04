/**
 * ============================================================================
 * STRIPE CONNECT ROUTER
 * Production-ready implementation for cleaner onboarding and payouts
 * ============================================================================
 *
 * This router handles:
 * - Creating connected accounts for cleaners (using controller properties)
 * - Onboarding cleaners via Stripe Account Links
 * - Processing payouts after job completion (90/10 split)
 * - Webhook handling for account status updates
 *
 * API Version: 2025-11-17.clover
 *
 * ============================================================================
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const EncryptionService = require("../../../services/EncryptionService");

// ============================================================================
// CONFIGURATION & VALIDATION
// ============================================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;
const STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

// Validate required environment variables at startup
if (!STRIPE_SECRET_KEY) {
  console.error("============================================================================");
  console.error("ERROR: STRIPE_SECRET_KEY is not set in environment variables.");
  console.error("");
  console.error("To fix this:");
  console.error("1. Go to https://dashboard.stripe.com/apikeys");
  console.error("2. Copy your Secret Key (starts with sk_test_ or sk_live_)");
  console.error("3. Add to .env: STRIPE_SECRET_KEY=sk_test_...");
  console.error("============================================================================");
  throw new Error("Missing required STRIPE_SECRET_KEY environment variable");
}

if (!SESSION_SECRET) {
  console.error("============================================================================");
  console.error("ERROR: SESSION_SECRET is not set in environment variables.");
  console.error("============================================================================");
  throw new Error("Missing required SESSION_SECRET environment variable");
}

// Initialize Stripe with the latest API version
const stripe = require("stripe")(STRIPE_SECRET_KEY, {
  apiVersion: "2025-11-17.clover",
});

// Import models
const {
  User,
  UserAppointments,
  StripeConnectAccount,
  Payout,
  PlatformEarnings,
  Payment,
} = require("../../../models");

// Import services
const PlatformTaxService = require("../../../services/PlatformTaxService");

const stripeConnectRouter = express.Router();

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Platform fee percentage (10%)
 * Platform keeps 10%, cleaner receives 90%
 */
const PLATFORM_FEE_PERCENT = 0.10;

/**
 * Valid payout statuses
 */
const PAYOUT_STATUS = {
  PENDING: "pending",       // Waiting for payment capture
  HELD: "held",             // Payment captured, awaiting job completion
  PROCESSING: "processing", // Transfer initiated
  COMPLETED: "completed",   // Transfer successful
  FAILED: "failed",         // Transfer failed
};

/**
 * Valid account statuses
 */
const ACCOUNT_STATUS = {
  PENDING: "pending",       // Account created, not started onboarding
  ONBOARDING: "onboarding", // In the middle of onboarding
  RESTRICTED: "restricted", // Onboarding complete but pending verification
  ACTIVE: "active",         // Fully active, can receive payments
  DISABLED: "disabled",     // Account disabled
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verifies a JWT token and returns the decoded payload.
 *
 * @param {string} token - JWT token to verify
 * @returns {object|null} - Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  if (!token) return null;

  try {
    return jwt.verify(token, SESSION_SECRET);
  } catch (error) {
    console.error("[StripeConnect] Token verification failed:", error.message);
    return null;
  }
};

/**
 * Calculates the platform fee and net amount for a payout.
 *
 * @param {number} grossAmountCents - Gross amount in cents
 * @returns {object} - { platformFee, netAmount } in cents
 */
const calculatePayoutSplit = (grossAmountCents) => {
  const platformFee = Math.round(grossAmountCents * PLATFORM_FEE_PERCENT);
  const netAmount = grossAmountCents - platformFee;
  return { platformFee, netAmount };
};

/**
 * Determines the account status based on Stripe account data.
 *
 * @param {object} stripeAccount - Stripe account object
 * @returns {string} - Account status
 */
const determineAccountStatus = (stripeAccount) => {
  if (stripeAccount.payouts_enabled && stripeAccount.charges_enabled) {
    return ACCOUNT_STATUS.ACTIVE;
  }
  if (stripeAccount.details_submitted) {
    return ACCOUNT_STATUS.RESTRICTED;
  }
  if (stripeAccount.requirements?.currently_due?.length > 0) {
    return ACCOUNT_STATUS.ONBOARDING;
  }
  return ACCOUNT_STATUS.PENDING;
};

/**
 * Validates that a user ID is a positive integer.
 *
 * @param {any} userId - User ID to validate
 * @returns {number|null} - Parsed user ID or null if invalid
 */
const validateUserId = (userId) => {
  const parsed = parseInt(userId, 10);
  if (isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

/**
 * Builds the base URL for redirects.
 *
 * @param {object} req - Express request object
 * @returns {string} - Base URL
 */
const getBaseUrl = (req) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
};

// ============================================================================
// ROUTES: ACCOUNT STATUS
// ============================================================================

/**
 * GET /account-status/:userId
 *
 * Gets the current Stripe Connect account status for a user.
 * Fetches latest status from Stripe API and updates local record.
 *
 * @param {string} userId - User ID to check
 * @returns {object} - Account status information
 */
stripeConnectRouter.get("/account-status/:userId", async (req, res) => {
  const userId = validateUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({
      error: "Invalid user ID",
      code: "INVALID_USER_ID",
    });
  }

  try {
    // Find local account record
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId },
    });

    // No account exists yet
    if (!connectAccount) {
      return res.json({
        hasAccount: false,
        accountStatus: null,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
        requirements: null,
      });
    }

    // Fetch latest status from Stripe
    let stripeAccount;
    try {
      stripeAccount = await stripe.accounts.retrieve(connectAccount.stripeAccountId);
    } catch (stripeErr) {
      // Account may have been deleted or is inaccessible
      console.error("[StripeConnect] Error fetching Stripe account:", stripeErr.message);

      return res.json({
        hasAccount: true,
        accountStatus: connectAccount.accountStatus,
        payoutsEnabled: connectAccount.payoutsEnabled,
        chargesEnabled: connectAccount.chargesEnabled,
        detailsSubmitted: connectAccount.detailsSubmitted,
        onboardingComplete: connectAccount.onboardingComplete,
        stripeAccountId: connectAccount.stripeAccountId,
        error: "Could not fetch latest status from Stripe",
      });
    }

    // Update local record with latest Stripe data
    const newStatus = determineAccountStatus(stripeAccount);
    const isOnboardingComplete = stripeAccount.payouts_enabled && stripeAccount.details_submitted;

    await connectAccount.update({
      payoutsEnabled: stripeAccount.payouts_enabled,
      chargesEnabled: stripeAccount.charges_enabled,
      detailsSubmitted: stripeAccount.details_submitted,
      onboardingComplete: isOnboardingComplete,
      accountStatus: newStatus,
    });

    return res.json({
      hasAccount: true,
      accountStatus: newStatus,
      payoutsEnabled: stripeAccount.payouts_enabled,
      chargesEnabled: stripeAccount.charges_enabled,
      detailsSubmitted: stripeAccount.details_submitted,
      onboardingComplete: isOnboardingComplete,
      stripeAccountId: connectAccount.stripeAccountId,
      requirements: {
        currentlyDue: stripeAccount.requirements?.currently_due || [],
        eventuallyDue: stripeAccount.requirements?.eventually_due || [],
        pastDue: stripeAccount.requirements?.past_due || [],
      },
    });
  } catch (error) {
    console.error("[StripeConnect] Error fetching account status:", error);
    return res.status(500).json({
      error: "Failed to fetch account status",
      code: "INTERNAL_ERROR",
    });
  }
});

// ============================================================================
// ROUTES: ACCOUNT CREATION
// ============================================================================

/**
 * POST /create-account
 *
 * Creates a new Stripe Connected Account for a cleaner.
 *
 * IMPORTANT: Uses `controller` properties instead of `type: 'express'`.
 * This is the modern approach for creating connected accounts.
 *
 * Controller configuration:
 * - fees.payer: 'application' - Platform pays Stripe fees
 * - losses.payments: 'application' - Platform handles refunds/chargebacks
 * - stripe_dashboard.type: 'express' - Cleaner gets Express Dashboard access
 *
 * @body {string} token - JWT authentication token
 * @body {object} personalInfo - Optional pre-filled personal info (dob, address, ssn_last_4)
 * @returns {object} - Created account details
 */
stripeConnectRouter.post("/create-account", async (req, res) => {
  const { token, personalInfo } = req.body;

  // Validate token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: "Invalid or expired authentication token",
      code: "INVALID_TOKEN",
    });
  }

  try {
    // Find user
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Check if user is a cleaner
    if (user.type !== "cleaner") {
      return res.status(403).json({
        error: "Only cleaners can create Stripe Connect accounts",
        code: "NOT_A_CLEANER",
      });
    }

    // Check if account already exists
    const existingAccount = await StripeConnectAccount.findOne({
      where: { userId: user.id },
    });

    if (existingAccount) {
      return res.status(409).json({
        error: "Stripe Connect account already exists for this user",
        code: "ACCOUNT_EXISTS",
        stripeAccountId: existingAccount.stripeAccountId,
        accountStatus: existingAccount.accountStatus,
      });
    }

    // Build individual info from user data and personalInfo
    const individual = {
      first_name: user.firstName || undefined,
      last_name: user.lastName || undefined,
      email: user.email || undefined,
      phone: user.phone || undefined,
    };

    // Add DOB if provided
    if (personalInfo?.dob) {
      const dobParts = personalInfo.dob.split("-");
      if (dobParts.length === 3) {
        individual.dob = {
          year: parseInt(dobParts[0]),
          month: parseInt(dobParts[1]),
          day: parseInt(dobParts[2]),
        };
      }
    }

    // Add address if provided
    if (personalInfo?.address) {
      individual.address = {
        line1: personalInfo.address.line1 || undefined,
        line2: personalInfo.address.line2 || undefined,
        city: personalInfo.address.city || undefined,
        state: personalInfo.address.state || undefined,
        postal_code: personalInfo.address.postalCode || undefined,
        country: "US",
      };
    }

    // Add SSN last 4 if provided
    if (personalInfo?.ssn_last_4) {
      individual.ssn_last_4 = personalInfo.ssn_last_4;
    }

    /**
     * Create Stripe Connected Account using controller properties.
     *
     * DO NOT use `type: 'express'` at the top level.
     * Instead, use controller.stripe_dashboard.type: 'express'.
     */
    const account = await stripe.accounts.create({
      // Controller defines the relationship between platform and connected account
      controller: {
        // Platform is responsible for pricing and fee collection
        fees: {
          payer: "application",
        },
        // Platform is responsible for losses (refunds, chargebacks)
        losses: {
          payments: "application",
        },
        // Give connected account access to Express Dashboard
        stripe_dashboard: {
          type: "express",
        },
      },
      // Account email for Stripe communications
      email: user.email || undefined,
      // Request transfer capability for receiving payments
      capabilities: {
        transfers: { requested: true },
      },
      // Business information
      business_type: "individual",
      country: "US",
      // Pre-fill business profile to skip business details step
      business_profile: {
        // MCC 7349 = Cleaning and Maintenance Services
        mcc: "7349",
        // Product description for cleaning services
        product_description: "Professional residential cleaning services",
        // Use platform URL since cleaners don't have individual websites
        url: "https://keanr.com",
      },
      // Pre-fill individual info to reduce what user needs to enter on Stripe
      individual,
      // Metadata for tracking
      metadata: {
        platform: "cleaning_company",
        user_id: user.id.toString(),
        username: user.username,
      },
    });

    // Save account to database
    const connectAccount = await StripeConnectAccount.create({
      userId: user.id,
      stripeAccountId: account.id,
      accountStatus: ACCOUNT_STATUS.PENDING,
      payoutsEnabled: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    });

    console.log(`[StripeConnect] Created account ${account.id} for user ${user.id}`);

    return res.status(201).json({
      success: true,
      stripeAccountId: account.id,
      connectAccountId: connectAccount.id,
      accountStatus: ACCOUNT_STATUS.PENDING,
    });
  } catch (error) {
    console.error("[StripeConnect] Error creating account:", error);

    // Handle specific Stripe errors
    if (error.type === "StripeInvalidRequestError") {
      if (error.message.includes("signed up for Connect")) {
        return res.status(400).json({
          error: "Stripe Connect is not enabled for this platform",
          code: "CONNECT_NOT_ENABLED",
          help: "Please enable Stripe Connect at https://dashboard.stripe.com/settings/connect",
        });
      }
    }

    return res.status(500).json({
      error: "Failed to create Stripe Connect account",
      code: "CREATE_FAILED",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /complete-setup
 *
 * Creates a fully-onboarded Stripe Connect account in one step.
 * Collects all required info (personal, SSN, bank account) and submits to Stripe.
 *
 * @body {string} token - JWT authentication token
 * @body {object} personalInfo - Personal information (dob, address, full SSN)
 * @body {object} bankAccount - Bank account details (routingNumber, accountNumber)
 * @returns {object} - Account status
 */
stripeConnectRouter.post("/complete-setup", async (req, res) => {
  const { token, personalInfo, bankAccount } = req.body;

  // Validate token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: "Invalid or expired authentication token",
      code: "INVALID_TOKEN",
    });
  }

  try {
    // Find user
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Check if user is a cleaner
    if (user.type !== "cleaner") {
      return res.status(403).json({
        error: "Only cleaners can create Stripe Connect accounts",
        code: "NOT_A_CLEANER",
      });
    }

    // Check if account already exists
    let connectAccount = await StripeConnectAccount.findOne({
      where: { userId: user.id },
    });

    let stripeAccountId;

    if (connectAccount) {
      stripeAccountId = connectAccount.stripeAccountId;
      console.log(`[StripeConnect] Updating existing account ${stripeAccountId}`);
    } else {
      // Build individual info
      const individual = {
        first_name: user.firstName || undefined,
        last_name: user.lastName || undefined,
        email: user.email || undefined,
        phone: user.phone || undefined,
      };

      // Add DOB
      if (personalInfo?.dob) {
        const dobParts = personalInfo.dob.split("-");
        if (dobParts.length === 3) {
          individual.dob = {
            year: parseInt(dobParts[0]),
            month: parseInt(dobParts[1]),
            day: parseInt(dobParts[2]),
          };
        }
      }

      // Add address
      if (personalInfo?.address) {
        individual.address = {
          line1: personalInfo.address.line1 || undefined,
          line2: personalInfo.address.line2 || undefined,
          city: personalInfo.address.city || undefined,
          state: personalInfo.address.state || undefined,
          postal_code: personalInfo.address.postalCode || undefined,
          country: "US",
        };
      }

      // Add full SSN
      if (personalInfo?.ssn) {
        individual.id_number = personalInfo.ssn;
      }

      // Create Stripe account
      // Note: For Express accounts, ToS must be accepted by user via Stripe's hosted flow
      const account = await stripe.accounts.create({
        controller: {
          fees: { payer: "application" },
          losses: { payments: "application" },
          stripe_dashboard: { type: "express" },
        },
        email: user.email || undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        country: "US",
        business_profile: {
          mcc: "7349",
          product_description: "Professional residential cleaning services",
          url: "https://keanr.com",
        },
        individual,
        metadata: {
          platform: "cleaning_company",
          user_id: user.id.toString(),
          username: user.username,
        },
      });

      stripeAccountId = account.id;

      // Save to database
      connectAccount = await StripeConnectAccount.create({
        userId: user.id,
        stripeAccountId: account.id,
        accountStatus: ACCOUNT_STATUS.ONBOARDING,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
      });

      console.log(`[StripeConnect] Created account ${account.id} for user ${user.id}`);
    }

    // Add bank account
    if (bankAccount?.routingNumber && bankAccount?.accountNumber) {
      try {
        // Create a bank account token
        const bankToken = await stripe.tokens.create({
          bank_account: {
            country: "US",
            currency: "usd",
            account_holder_name: `${user.firstName ? EncryptionService.decrypt(user.firstName) : ""} ${user.lastName ? EncryptionService.decrypt(user.lastName) : ""}`.trim() || EncryptionService.decrypt(user.email),
            account_holder_type: "individual",
            routing_number: bankAccount.routingNumber,
            account_number: bankAccount.accountNumber,
          },
        });

        // Attach bank account to connected account
        await stripe.accounts.createExternalAccount(stripeAccountId, {
          external_account: bankToken.id,
        });

        console.log(`[StripeConnect] Added bank account to ${stripeAccountId}`);
      } catch (bankError) {
        console.error("[StripeConnect] Error adding bank account:", bankError.message);
        return res.status(400).json({
          error: bankError.message || "Failed to add bank account",
          code: "BANK_ACCOUNT_ERROR",
        });
      }
    }

    // Fetch latest status from Stripe
    const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);

    // Update local record
    const newStatus = determineAccountStatus(stripeAccount);
    const isOnboardingComplete = stripeAccount.payouts_enabled && stripeAccount.details_submitted;

    await connectAccount.update({
      payoutsEnabled: stripeAccount.payouts_enabled,
      chargesEnabled: stripeAccount.charges_enabled,
      detailsSubmitted: stripeAccount.details_submitted,
      onboardingComplete: isOnboardingComplete,
      accountStatus: newStatus,
    });

    console.log(`[StripeConnect] Setup complete for ${stripeAccountId}. Status: ${newStatus}, Payouts enabled: ${stripeAccount.payouts_enabled}`);

    // Check if user still needs to complete requirements (like ToS acceptance)
    const hasPendingRequirements = stripeAccount.requirements?.currently_due?.length > 0;
    let onboardingUrl = null;

    if (hasPendingRequirements) {
      // Generate onboarding link for ToS acceptance
      // Since we pre-filled all the data, they just need to accept ToS
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: "http://localhost:3000/earnings?refresh=true",
        return_url: "http://localhost:3000/earnings?return=true",
        type: "account_onboarding",
      });
      onboardingUrl = accountLink.url;
      console.log(`[StripeConnect] Generated onboarding link for ToS: ${onboardingUrl}`);
    }

    return res.json({
      success: true,
      stripeAccountId,
      accountStatus: newStatus,
      payoutsEnabled: stripeAccount.payouts_enabled,
      onboardingComplete: isOnboardingComplete,
      requirements: {
        currentlyDue: stripeAccount.requirements?.currently_due || [],
        eventuallyDue: stripeAccount.requirements?.eventually_due || [],
      },
      // Include onboarding URL if ToS still needs to be accepted
      onboardingUrl,
    });
  } catch (error) {
    console.error("[StripeConnect] Error in complete-setup:", error);

    // Handle specific Stripe errors
    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).json({
        error: error.message || "Invalid request to Stripe",
        code: "STRIPE_ERROR",
      });
    }

    return res.status(500).json({
      error: "Failed to complete account setup",
      code: "SETUP_FAILED",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ============================================================================
// ROUTES: ONBOARDING
// ============================================================================

/**
 * POST /onboarding-link
 *
 * Generates a Stripe Account Link for onboarding.
 * Account Links are single-use and expire after a few minutes.
 *
 * @body {string} token - JWT authentication token
 * @body {string} returnUrl - URL to redirect after successful onboarding
 * @body {string} refreshUrl - URL to redirect if link expires
 * @returns {object} - Onboarding URL and expiration
 */
stripeConnectRouter.post("/onboarding-link", async (req, res) => {
  const { token, returnUrl, refreshUrl } = req.body;

  // Validate token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: "Invalid or expired authentication token",
      code: "INVALID_TOKEN",
    });
  }

  try {
    // Find Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: decoded.userId },
    });

    if (!connectAccount) {
      return res.status(404).json({
        error: "No Stripe Connect account found. Please create one first.",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    // Build redirect URLs
    const baseUrl = getBaseUrl(req);
    const finalReturnUrl = returnUrl || `${baseUrl}/earnings`;
    const finalRefreshUrl = refreshUrl || `${baseUrl}/earnings`;

    // Create Account Link
    const accountLink = await stripe.accountLinks.create({
      account: connectAccount.stripeAccountId,
      refresh_url: finalRefreshUrl,
      return_url: finalReturnUrl,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
      },
    });

    // Update status to onboarding
    await connectAccount.update({ accountStatus: ACCOUNT_STATUS.ONBOARDING });

    console.log(`[StripeConnect] Generated onboarding link for account ${connectAccount.stripeAccountId}`);

    return res.json({
      success: true,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error("[StripeConnect] Error generating onboarding link:", error);

    return res.status(500).json({
      error: "Failed to generate onboarding link",
      code: "LINK_GENERATION_FAILED",
    });
  }
});

/**
 * POST /dashboard-link
 *
 * Generates a login link to the Express Dashboard.
 * Only available for accounts that have completed onboarding.
 *
 * @body {string} token - JWT authentication token
 * @returns {object} - Dashboard URL
 */
stripeConnectRouter.post("/dashboard-link", async (req, res) => {
  const { token } = req.body;

  // Validate token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: "Invalid or expired authentication token",
      code: "INVALID_TOKEN",
    });
  }

  try {
    // Find Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: decoded.userId },
    });

    if (!connectAccount) {
      return res.status(404).json({
        error: "No Stripe Connect account found",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    // Account must have completed onboarding
    if (!connectAccount.detailsSubmitted) {
      return res.status(400).json({
        error: "Please complete onboarding before accessing the dashboard",
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
    });
  } catch (error) {
    console.error("[StripeConnect] Error generating dashboard link:", error);

    return res.status(500).json({
      error: "Failed to generate dashboard link",
      code: "LINK_GENERATION_FAILED",
    });
  }
});

// ============================================================================
// ROUTES: PAYOUTS
// ============================================================================

/**
 * GET /payouts/:userId
 *
 * Gets payout history for a cleaner.
 *
 * @param {string} userId - User ID
 * @returns {object} - Payout history and totals
 */
stripeConnectRouter.get("/payouts/:userId", async (req, res) => {
  const userId = validateUserId(req.params.userId);

  if (!userId) {
    return res.status(400).json({
      error: "Invalid user ID",
      code: "INVALID_USER_ID",
    });
  }

  try {
    // Fetch payouts with appointment details
    const payouts = await Payout.findAll({
      where: { cleanerId: userId },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price", "homeId", "completed"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate totals
    const totals = payouts.reduce(
      (acc, payout) => {
        if (payout.status === PAYOUT_STATUS.COMPLETED) {
          acc.totalPaid += payout.netAmount;
          acc.completedCount++;
        } else if (
          payout.status === PAYOUT_STATUS.HELD ||
          payout.status === PAYOUT_STATUS.PROCESSING
        ) {
          acc.pendingAmount += payout.netAmount;
          acc.pendingCount++;
        }
        return acc;
      },
      { totalPaid: 0, pendingAmount: 0, completedCount: 0, pendingCount: 0 }
    );

    return res.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        appointmentId: p.appointmentId,
        appointmentDate: p.appointment?.date,
        grossAmount: p.grossAmount,
        platformFee: p.platformFee,
        netAmount: p.netAmount,
        status: p.status,
        stripeTransferId: p.stripeTransferId,
        paymentCapturedAt: p.paymentCapturedAt,
        transferInitiatedAt: p.transferInitiatedAt,
        completedAt: p.completedAt,
        failureReason: p.failureReason,
        createdAt: p.createdAt,
      })),
      totals: {
        totalPaidCents: totals.totalPaid,
        totalPaidDollars: (totals.totalPaid / 100).toFixed(2),
        pendingAmountCents: totals.pendingAmount,
        pendingAmountDollars: (totals.pendingAmount / 100).toFixed(2),
        completedCount: totals.completedCount,
        pendingCount: totals.pendingCount,
      },
      platformFeePercent: PLATFORM_FEE_PERCENT * 100,
      cleanerPercent: (1 - PLATFORM_FEE_PERCENT) * 100,
    });
  } catch (error) {
    console.error("[StripeConnect] Error fetching payouts:", error);

    return res.status(500).json({
      error: "Failed to fetch payout history",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * POST /process-payout
 *
 * Processes payouts to cleaners after job completion.
 * Creates Stripe transfers to connected accounts.
 *
 * @body {number} appointmentId - Appointment ID
 * @returns {object} - Payout results for each cleaner
 */
stripeConnectRouter.post("/process-payout", async (req, res) => {
  const { appointmentId } = req.body;

  if (!appointmentId) {
    return res.status(400).json({
      error: "Appointment ID is required",
      code: "MISSING_APPOINTMENT_ID",
    });
  }

  try {
    // Find appointment
    const appointment = await UserAppointments.findByPk(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        error: "Appointment not found",
        code: "APPOINTMENT_NOT_FOUND",
      });
    }

    // Validate appointment state
    if (!appointment.completed) {
      return res.status(400).json({
        error: "Job must be marked as complete before processing payout",
        code: "JOB_NOT_COMPLETE",
      });
    }

    if (!appointment.paid) {
      return res.status(400).json({
        error: "Payment must be captured before processing payout",
        code: "PAYMENT_NOT_CAPTURED",
      });
    }

    // Get assigned cleaners
    const cleanerIds = appointment.employeesAssigned || [];

    if (cleanerIds.length === 0) {
      return res.status(400).json({
        error: "No cleaners assigned to this appointment",
        code: "NO_CLEANERS_ASSIGNED",
      });
    }

    // Process payout for each cleaner
    const results = [];

    for (const cleanerIdStr of cleanerIds) {
      const cleanerIdInt = parseInt(cleanerIdStr, 10);
      const result = await processCleanerPayout(appointment, cleanerIdInt, cleanerIds.length);
      results.push(result);
    }

    // Summary
    const successCount = results.filter((r) => r.status === "success").length;
    const failCount = results.filter((r) => r.status === "failed").length;

    console.log(`[StripeConnect] Processed payouts for appointment ${appointmentId}: ${successCount} success, ${failCount} failed`);

    return res.json({
      success: true,
      appointmentId,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount,
      },
    });
  } catch (error) {
    console.error("[StripeConnect] Error processing payouts:", error);

    return res.status(500).json({
      error: "Failed to process payouts",
      code: "PROCESS_FAILED",
    });
  }
});

/**
 * Processes payout for a single cleaner.
 *
 * @param {object} appointment - Appointment record
 * @param {string} cleanerId - Cleaner user ID
 * @param {number} totalCleaners - Total number of cleaners
 * @returns {object} - Payout result
 */
async function processCleanerPayout(appointment, cleanerId, totalCleaners) {
  try {
    // Check for existing payout
    let payout = await Payout.findOne({
      where: { appointmentId: appointment.id, cleanerId },
    });

    // Already completed
    if (payout && payout.status === PAYOUT_STATUS.COMPLETED) {
      return {
        cleanerId,
        status: "already_completed",
        payoutId: payout.id,
        transferId: payout.stripeTransferId,
      };
    }

    // Get cleaner's Stripe Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: cleanerId },
    });

    if (!connectAccount) {
      return {
        cleanerId,
        status: "failed",
        error: "Cleaner has not set up a Stripe Connect account",
        code: "NO_CONNECT_ACCOUNT",
      };
    }

    if (!connectAccount.payoutsEnabled) {
      return {
        cleanerId,
        status: "failed",
        error: "Cleaner has not completed Stripe onboarding",
        code: "ONBOARDING_INCOMPLETE",
      };
    }

    // Calculate amounts
    const priceInCents = Math.round(parseFloat(appointment.price) * 100);
    const perCleanerGross = Math.round(priceInCents / totalCleaners);
    const { platformFee, netAmount } = calculatePayoutSplit(perCleanerGross);

    // Create or update payout record
    if (!payout) {
      payout = await Payout.create({
        appointmentId: appointment.id,
        cleanerId,
        grossAmount: perCleanerGross,
        platformFee,
        netAmount,
        status: PAYOUT_STATUS.PROCESSING,
        paymentCapturedAt: new Date(),
        transferInitiatedAt: new Date(),
      });
    } else {
      await payout.update({
        grossAmount: perCleanerGross,
        platformFee,
        netAmount,
        status: PAYOUT_STATUS.PROCESSING,
        transferInitiatedAt: new Date(),
      });
    }

    // Create Stripe Transfer
    const transfer = await stripe.transfers.create({
      amount: netAmount,
      currency: "usd",
      destination: connectAccount.stripeAccountId,
      metadata: {
        platform: "cleaning_company",
        appointment_id: appointment.id.toString(),
        cleaner_id: cleanerId.toString(),
        payout_id: payout.id.toString(),
        gross_amount: perCleanerGross.toString(),
        platform_fee: platformFee.toString(),
      },
    });

    // Update payout as completed
    await payout.update({
      stripeTransferId: transfer.id,
      status: PAYOUT_STATUS.COMPLETED,
      completedAt: new Date(),
    });

    // Record platform earnings for tax purposes
    try {
      await PlatformTaxService.recordPlatformEarnings({
        appointmentId: appointment.id,
        paymentId: null, // Could be linked if we have the Payment record
        payoutId: payout.id,
        customerId: appointment.userId,
        cleanerId: parseInt(cleanerId),
        grossServiceAmount: perCleanerGross,
        platformFeeAmount: platformFee,
        stripeFeeAmount: 0, // Stripe fees handled separately
      });
      console.log(`[StripeConnect] Platform earnings recorded: $${(platformFee / 100).toFixed(2)} for appointment ${appointment.id}`);
    } catch (earningsError) {
      // Log but don't fail the payout
      console.error(`[StripeConnect] Failed to record platform earnings:`, earningsError.message);
    }

    console.log(`[StripeConnect] Transfer ${transfer.id} completed for cleaner ${cleanerId}: $${(netAmount / 100).toFixed(2)}`);

    return {
      cleanerId,
      status: "success",
      payoutId: payout.id,
      transferId: transfer.id,
      grossAmount: perCleanerGross,
      platformFee,
      netAmount,
    };
  } catch (error) {
    console.error(`[StripeConnect] Transfer failed for cleaner ${cleanerId}:`, error);

    // Update payout as failed if it exists
    const payout = await Payout.findOne({
      where: { appointmentId: appointment.id, cleanerId },
    });

    if (payout) {
      await payout.update({
        status: PAYOUT_STATUS.FAILED,
        failureReason: error.message,
      });
    }

    return {
      cleanerId,
      status: "failed",
      error: error.message,
      code: error.type || "TRANSFER_FAILED",
    };
  }
}

/**
 * POST /create-payout-record
 *
 * Creates a payout record when a cleaner is assigned to an appointment.
 * The payout starts in "pending" status.
 *
 * @body {number} appointmentId - Appointment ID
 * @body {number} cleanerId - Cleaner user ID
 * @returns {object} - Created payout record
 */
stripeConnectRouter.post("/create-payout-record", async (req, res) => {
  const { appointmentId, cleanerId } = req.body;

  if (!appointmentId || !cleanerId) {
    return res.status(400).json({
      error: "Appointment ID and cleaner ID are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // Find appointment
    const appointment = await UserAppointments.findByPk(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        error: "Appointment not found",
        code: "APPOINTMENT_NOT_FOUND",
      });
    }

    // Check if payout already exists
    const existingPayout = await Payout.findOne({
      where: { appointmentId, cleanerId },
    });

    if (existingPayout) {
      return res.json({
        success: true,
        payout: existingPayout,
        message: "Payout record already exists",
      });
    }

    // Calculate amounts
    const cleanerCount = appointment.employeesAssigned?.length || 1;
    const priceInCents = Math.round(parseFloat(appointment.price) * 100);
    const perCleanerGross = Math.round(priceInCents / cleanerCount);
    const { platformFee, netAmount } = calculatePayoutSplit(perCleanerGross);

    // Create payout record
    const payout = await Payout.create({
      appointmentId,
      cleanerId,
      grossAmount: perCleanerGross,
      platformFee,
      netAmount,
      status: PAYOUT_STATUS.PENDING,
    });

    console.log(`[StripeConnect] Created payout record ${payout.id} for appointment ${appointmentId}, cleaner ${cleanerId}`);

    return res.status(201).json({
      success: true,
      payout,
    });
  } catch (error) {
    console.error("[StripeConnect] Error creating payout record:", error);

    return res.status(500).json({
      error: "Failed to create payout record",
      code: "CREATE_FAILED",
    });
  }
});

// ============================================================================
// ROUTES: WEBHOOKS
// ============================================================================

/**
 * POST /webhook
 *
 * Handles Stripe Connect webhook events.
 * Verifies webhook signature and processes events.
 *
 * Important events:
 * - account.updated: Account status changed
 * - transfer.created: Transfer was created
 * - transfer.failed: Transfer failed
 */
stripeConnectRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    // Webhook secret is optional in development
    if (!STRIPE_CONNECT_WEBHOOK_SECRET) {
      console.warn("[StripeConnect] No webhook secret configured, skipping signature verification");

      // In development, try to parse the body directly
      if (process.env.NODE_ENV === "development") {
        try {
          const event = JSON.parse(req.body.toString());
          await handleWebhookEvent(event);
          return res.json({ received: true });
        } catch (err) {
          return res.status(400).json({ error: "Invalid webhook payload" });
        }
      }

      return res.status(400).json({
        error: "Webhook secret not configured",
        code: "WEBHOOK_SECRET_MISSING",
      });
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_CONNECT_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("[StripeConnect] Webhook signature verification failed:", err.message);
      return res.status(400).json({
        error: "Webhook signature verification failed",
        code: "INVALID_SIGNATURE",
      });
    }

    // Handle the event
    try {
      await handleWebhookEvent(event);
      res.json({ received: true });
    } catch (err) {
      console.error("[StripeConnect] Webhook handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);

/**
 * Handles a webhook event.
 *
 * @param {object} event - Stripe webhook event
 */
async function handleWebhookEvent(event) {
  console.log(`[StripeConnect] Received webhook event: ${event.type}`);

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object;
      await handleAccountUpdated(account);
      break;
    }

    case "transfer.created": {
      const transfer = event.data.object;
      console.log(`[StripeConnect] Transfer created: ${transfer.id}, amount: ${transfer.amount}`);
      break;
    }

    case "transfer.failed": {
      const transfer = event.data.object;
      await handleTransferFailed(transfer);
      break;
    }

    case "payout.failed": {
      const payout = event.data.object;
      console.error(`[StripeConnect] Payout failed: ${payout.id}, reason: ${payout.failure_message}`);
      break;
    }

    default:
      console.log(`[StripeConnect] Unhandled event type: ${event.type}`);
  }
}

/**
 * Handles account.updated webhook event.
 *
 * @param {object} account - Stripe account object
 */
async function handleAccountUpdated(account) {
  const connectAccount = await StripeConnectAccount.findOne({
    where: { stripeAccountId: account.id },
  });

  if (!connectAccount) {
    console.warn(`[StripeConnect] Received update for unknown account: ${account.id}`);
    return;
  }

  const wasComplete = connectAccount.onboardingComplete;
  const newStatus = determineAccountStatus(account);
  const isNowComplete = account.payouts_enabled && account.details_submitted;

  await connectAccount.update({
    payoutsEnabled: account.payouts_enabled,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    onboardingComplete: isNowComplete,
    accountStatus: newStatus,
  });

  // Log status change
  if (!wasComplete && isNowComplete) {
    console.log(`[StripeConnect] Account ${account.id} onboarding completed`);

    // Could send notification email here
    const user = await User.findByPk(connectAccount.userId);
    if (user) {
      console.log(`[StripeConnect] User ${user.id} can now receive payouts`);
    }
  }
}

/**
 * Handles transfer.failed webhook event.
 *
 * @param {object} transfer - Stripe transfer object
 */
async function handleTransferFailed(transfer) {
  console.error(`[StripeConnect] Transfer failed: ${transfer.id}`);

  const payout = await Payout.findOne({
    where: { stripeTransferId: transfer.id },
  });

  if (payout) {
    await payout.update({
      status: PAYOUT_STATUS.FAILED,
      failureReason: transfer.failure_message || "Transfer failed",
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = stripeConnectRouter;

// Export helper functions for testing
module.exports.calculatePayoutSplit = calculatePayoutSplit;
module.exports.determineAccountStatus = determineAccountStatus;
module.exports.validateUserId = validateUserId;
module.exports.PLATFORM_FEE_PERCENT = PLATFORM_FEE_PERCENT;
module.exports.PAYOUT_STATUS = PAYOUT_STATUS;
module.exports.ACCOUNT_STATUS = ACCOUNT_STATUS;
