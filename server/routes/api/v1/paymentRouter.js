// ------------------------------------------------------
// Payment Router — Handles Stripe payments and scheduling
// ------------------------------------------------------

const express = require("express");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-11-17.clover",
});
const cron = require("node-cron");
const rateLimit = require("express-rate-limit");
const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
  Payout,
  StripeConnectAccount,
  Payment,
  JobPhoto,
  HomeSizeAdjustmentRequest,
  UserPendingRequests,
  MultiCleanerJob,
  CleanerRoomAssignment,
  CleanerJobCompletion,
  EmployeeJobAssignment,
  BusinessEmployee,
  StripeWebhookEvent,
  sequelize,
} = require("../../../models");
const MultiCleanerPricingService = require("../../../services/MultiCleanerPricingService");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const { getPricingConfig } = require("../../../config/businessConfig");
const BusinessVolumeService = require("../../../services/BusinessVolumeService");
const EncryptionService = require("../../../services/EncryptionService");
const NotificationService = require("../../../services/NotificationService");
const {
  parseTimeWindow,
  getAutoCompleteConfig,
} = require("../../../services/cron/AutoCompleteMonitor");
const { notifyInitialPaymentFailure } = require("../../../services/cron/PaymentRetryMonitor");

const paymentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// ============================================================================
// RATE LIMITERS - Protect payment endpoints from abuse
// ============================================================================

/**
 * Standard payment rate limiter
 * Used for: creating payment intents, capturing payments
 * Limit: 30 requests per 15 minutes per user/IP
 */
const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: "Too many payment requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    // Rate limit by user ID from JWT if available, otherwise by IP
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, secretKey);
        return `user_${decoded.userId}`;
      }
    } catch {
      // Fall through to IP-based limiting
    }
    return req.ip || "unknown";
  },
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === "test";
  },
});

/**
 * Strict rate limiter for sensitive operations
 * Used for: refunds, payment method removal, high-value operations
 * Limit: 10 requests per 15 minutes per user/IP
 */
const strictPaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many sensitive payment operations. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, secretKey);
        return `user_${decoded.userId}`;
      }
    } catch {
      // Fall through to IP-based limiting
    }
    return req.ip || "unknown";
  },
  skip: (req) => {
    return process.env.NODE_ENV === "test";
  },
});

/**
 * Very strict rate limiter for payout operations
 * Used for: triggering payouts, multi-cleaner payouts
 * Limit: 5 requests per 15 minutes per user/IP
 */
const payoutRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many payout requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, secretKey);
        return `user_${decoded.userId}`;
      }
    } catch {
      // Fall through to IP-based limiting
    }
    return req.ip || "unknown";
  },
  skip: (req) => {
    return process.env.NODE_ENV === "test";
  },
});

// ============================================================================
// HELPER: Validate Stripe payment method ID format
// ============================================================================
/**
 * Validates that a payment method ID has the correct Stripe format.
 * Stripe payment method IDs start with "pm_" followed by alphanumeric characters.
 *
 * @param {string} paymentMethodId - The payment method ID to validate
 * @returns {boolean} - True if valid format
 */
const isValidPaymentMethodId = (paymentMethodId) => {
  if (!paymentMethodId || typeof paymentMethodId !== "string") {
    return false;
  }
  // Stripe payment method IDs: pm_ followed by alphanumeric chars (typically 24+, but allow shorter for flexibility)
  // Must start with pm_ and have at least some alphanumeric characters
  return /^pm_[a-zA-Z0-9]{4,}$/.test(paymentMethodId);
};

// ============================================================================
// HELPER: Validate early completion timing
// ============================================================================
async function validateCompletionTimingForPayment(appointment, cleanerId = null) {
  const now = new Date();
  const config = await getAutoCompleteConfig();
  const minOnSiteMinutes = config.minOnSiteMinutes || 30;

  // Parse appointment date and time window
  const [year, month, day] = appointment.date.split("-").map(Number);
  const timeWindow = parseTimeWindow(appointment.timeToBeCompleted);
  const windowStartTime = new Date(year, month - 1, day, timeWindow.start, 0, 0);

  // Check 1: Has time window started?
  const timeWindowStarted = now >= windowStartTime;

  // Check 2: Has cleaner been on-site long enough?
  let jobStartedAt = appointment.jobStartedAt;

  if (appointment.isMultiCleanerJob && cleanerId) {
    const completion = await CleanerJobCompletion.findOne({
      where: { appointmentId: appointment.id, cleanerId },
    });
    if (completion) {
      jobStartedAt = completion.jobStartedAt;
    }
  }

  const onSiteLongEnough = jobStartedAt &&
    (now.getTime() - new Date(jobStartedAt).getTime()) >= minOnSiteMinutes * 60 * 1000;

  if (!timeWindowStarted && !onSiteLongEnough) {
    const windowLabel = timeWindow.start === 8 ? "anytime (8 AM)" : `${timeWindow.start}:00`;
    return {
      allowed: false,
      reason: "early_completion_blocked",
      message: `Cannot complete yet. Either wait until the time window starts (${windowLabel}) or be on-site for at least ${minOnSiteMinutes} minutes.`,
      timeWindowStarted,
      onSiteLongEnough,
      jobStartedAt: jobStartedAt ? new Date(jobStartedAt).toISOString() : null,
      windowStartTime: windowStartTime.toISOString(),
    };
  }

  return { allowed: true };
}

// ============================================================================
// HELPER: Record payment transaction in database
// Supports optional transaction parameter for atomicity
//
// IMPORTANT: This function does NOT throw errors by default to avoid failing
// the main Stripe operation. However, it logs CRITICAL errors with full
// transaction data for manual recovery if the audit record fails to save.
// ============================================================================
async function recordPaymentTransaction({
  type,
  status,
  amount,
  userId = null,
  cleanerId = null,
  appointmentId = null,
  payoutId = null,
  stripePaymentIntentId = null,
  stripeTransferId = null,
  stripeRefundId = null,
  stripeChargeId = null,
  platformFeeAmount = null,
  netAmount = null,
  description = null,
  metadata = null,
  transaction = null,
  throwOnError = false, // Set to true for critical records that must be saved
}) {
  const taxYear = new Date().getFullYear();
  const isReportable = (type === "payout" || type === "payout_reversal") && status === "succeeded";

  // Build the transaction data object for both creation and error logging
  const transactionData = {
    transactionId: Payment.generateTransactionId(),
    type,
    status,
    amount,
    currency: "usd",
    userId,
    cleanerId,
    appointmentId,
    payoutId,
    stripePaymentIntentId,
    stripeTransferId,
    stripeRefundId,
    stripeChargeId,
    platformFeeAmount,
    netAmount,
    taxYear,
    reportable: isReportable,
    reported: false,
    description,
    metadata,
    processedAt: status === "succeeded" ? new Date() : null,
  };

  try {
    const createOptions = transaction ? { transaction } : {};
    const payment = await Payment.create(transactionData, createOptions);
    return payment;
  } catch (error) {
    // Log CRITICAL error with full transaction data for manual recovery
    // This ensures we can recreate the record even if the database insert fails
    const criticalLevel = isReportable ? "CRITICAL" : "ERROR";
    console.error(`[Payment] ${criticalLevel}: Failed to record ${type} transaction:`, {
      error: error.message,
      errorStack: error.stack,
      // Include all data needed to manually recreate this record
      recoveryData: {
        type,
        status,
        amount,
        userId,
        cleanerId,
        appointmentId,
        payoutId,
        stripePaymentIntentId,
        stripeTransferId,
        stripeRefundId,
        stripeChargeId,
        platformFeeAmount,
        netAmount,
        taxYear,
        reportable: isReportable,
        description,
        metadata,
        timestamp: new Date().toISOString(),
      },
    });

    // For reportable transactions (payouts), this is a tax compliance issue
    if (isReportable) {
      console.error(
        `[Payment] CRITICAL: Tax-reportable transaction (${type}) failed to record. ` +
        `Stripe transfer ${stripeTransferId} succeeded but Payment record was not created. ` +
        `Manual intervention required for 1099 compliance.`
      );
    }

    // Optionally throw for callers that need guaranteed audit trail
    if (throwOnError) {
      throw error;
    }

    return null;
  }
}

// ✅ Environment variable check
if (!process.env.STRIPE_SECRET_KEY || !process.env.SESSION_SECRET) {
  throw new Error("❌ Missing required Stripe or JWT environment variables.");
}

/**
 * ------------------------------------------------------
 * 1️⃣ Get Stripe Config (publishable key for frontend)
 * Must be defined BEFORE /:homeId to avoid route conflict
 * ------------------------------------------------------
 */
paymentRouter.get("/config", (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

/**
 * ------------------------------------------------------
 * 2️⃣ Get Payment History for a User
 * Must be defined BEFORE /:homeId to avoid route conflict
 * ------------------------------------------------------
 */
paymentRouter.get("/history/:userId", async (req, res) => {
  const { userId } = req.params;
  const requestedUserId = parseInt(userId, 10);

  // Validate userId is a valid integer
  if (isNaN(requestedUserId) || requestedUserId <= 0) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  // Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Check authorization: user can only view their own history, or admin/owner can view any
  const requestingUser = await User.findByPk(decoded.userId);
  if (!requestingUser) {
    return res.status(401).json({ error: "User not found" });
  }

  const isOwnerOrAdmin = requestingUser.type === "owner" || requestingUser.type === "admin";
  const isOwnHistory = decoded.userId === requestedUserId;

  if (!isOwnHistory && !isOwnerOrAdmin) {
    return res.status(403).json({ error: "Not authorized to view this payment history" });
  }

  try {
    const appointments = await UserAppointments.findAll({
      where: { userId: requestedUserId },
      attributes: [
        "id",
        "date",
        "price",
        "paid",
        "paymentStatus",
        "amountPaid",
        "paymentIntentId",
        "createdAt"
      ],
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    return res.json({ payments: appointments });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return res.status(400).json({ error: "Failed to fetch payment history" });
  }
});

/**
 * ------------------------------------------------------
 * 3️⃣ Get Employee Earnings (90% of gross after platform fee)
 * Must be defined BEFORE /:homeId to avoid route conflict
 * ------------------------------------------------------
 */
paymentRouter.get("/earnings/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  const cleanerIdInt = parseInt(employeeId, 10);

  // Validate employeeId is a valid integer
  if (isNaN(cleanerIdInt) || cleanerIdInt <= 0) {
    return res.status(400).json({ error: "Invalid employee ID" });
  }

  // Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Check authorization: employee can only view their own earnings, or admin/owner can view any
  const requestingUser = await User.findByPk(decoded.userId);
  if (!requestingUser) {
    return res.status(401).json({ error: "User not found" });
  }

  const isOwnerOrAdmin = requestingUser.type === "owner" || requestingUser.type === "admin";
  const isOwnEarnings = decoded.userId === cleanerIdInt;

  if (!isOwnEarnings && !isOwnerOrAdmin) {
    return res.status(403).json({ error: "Not authorized to view this employee's earnings" });
  }

  try {
    // Get platform fee from database
    const pricing = await getPricingConfig();
    const platformFeePercent = pricing.platform.feePercent;

    // First try to get earnings from Payout records (more accurate)
    const payouts = await Payout.findAll({
      where: { cleanerId: cleanerIdInt },
      include: [{
        model: UserAppointments,
        as: "appointment",
        attributes: ["id", "date", "price", "completed", "paid"]
      }]
    });

    if (payouts.length > 0) {
      // Use payout records for accurate split
      const completedPayouts = payouts.filter(p => p.status === "completed");
      const pendingPayouts = payouts.filter(p => ["pending", "held", "processing"].includes(p.status));

      const totalEarnings = completedPayouts.reduce((total, p) => total + p.netAmount, 0) / 100;
      const pendingEarnings = pendingPayouts.reduce((total, p) => total + p.netAmount, 0) / 100;

      return res.json({
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
        completedJobs: completedPayouts.length,
        platformFeePercent: platformFeePercent * 100,
        cleanerPercent: (1 - platformFeePercent) * 100,
      });
    }

    // Fallback: Calculate from appointments if no payout records exist yet
    const appointments = await UserAppointments.findAll({
      where: {
        paid: true,
        completed: true,
      },
    });

    // Filter to only appointments where this employee is in the employeesAssigned array
    const employeeAppointments = appointments.filter(
      (appt) => appt.employeesAssigned && appt.employeesAssigned.includes(employeeId)
    );

    // Calculate with dynamic cleaner percentage from database (prices in cents)
    const totalEarningsCents = employeeAppointments.reduce((total, appt) => {
      const priceCents = appt.price || 0;
      const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
      const grossPerCleaner = priceCents / employeeCount;
      const netPerCleaner = grossPerCleaner * (1 - platformFeePercent);
      return total + netPerCleaner;
    }, 0);

    const pendingEarningsCents = await UserAppointments.findAll({
      where: {
        paid: true,
        completed: false,
        hasBeenAssigned: true,
      },
    }).then((appts) =>
      appts
        .filter((appt) => appt.employeesAssigned && appt.employeesAssigned.includes(employeeId))
        .reduce((total, appt) => {
          const priceCents = appt.price || 0;
          const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
          const grossPerCleaner = priceCents / employeeCount;
          const netPerCleaner = grossPerCleaner * (1 - platformFeePercent);
          return total + netPerCleaner;
        }, 0)
    );

    return res.json({
      totalEarnings: Math.round(totalEarningsCents) / 100, // Convert cents to dollars
      pendingEarnings: Math.round(pendingEarningsCents) / 100, // Convert cents to dollars
      completedJobs: employeeAppointments.length,
      platformFeePercent: platformFeePercent * 100,
      cleanerPercent: (1 - platformFeePercent) * 100,
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return res.status(400).json({ error: "Failed to fetch earnings" });
  }
});

/**
 * Get payment method status for a user
 * IMPORTANT: This must be defined BEFORE /:homeId to avoid route conflict
 */
paymentRouter.get("/payment-method-status", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    console.log(`[Payment] Fetching payment methods for user ${userId}`);

    let paymentMethods = [];
    let hasValidPaymentMethod = user.hasPaymentMethod;

    // If user has a Stripe customer ID, fetch payment methods
    if (user.stripeCustomerId) {
      try {
        const methods = await stripe.paymentMethods.list({
          customer: user.stripeCustomerId,
          type: "card",
        });
        console.log(`[Payment] Found ${methods.data.length} payment methods for user ${userId}`);

        paymentMethods = methods.data.map((pm) => ({
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }));
        hasValidPaymentMethod = methods.data.length > 0;

        // Update user if status changed (skip for demo accounts to preserve manual settings)
        if (!user.isDemoAccount && user.hasPaymentMethod !== hasValidPaymentMethod) {
          console.log(`[Payment] Updating user ${userId} hasPaymentMethod: ${user.hasPaymentMethod} -> ${hasValidPaymentMethod}`);
          await user.update({ hasPaymentMethod: hasValidPaymentMethod });
        }
      } catch (stripeError) {
        console.error("Error fetching payment methods from Stripe:", stripeError);
        // For demo accounts, trust the database flag if Stripe call fails
        if (user.isDemoAccount && user.hasPaymentMethod) {
          console.log(`[Payment] Demo account ${userId} - Stripe error, trusting database hasPaymentMethod: true`);
          hasValidPaymentMethod = true;
        }
      }
    } else {
      console.log(`[Payment] User ${userId} has no payment customer configured`);
      // For demo accounts without stripeCustomerId, trust the database flag
      if (user.isDemoAccount && user.hasPaymentMethod) {
        hasValidPaymentMethod = true;
      }
    }

    return res.json({
      hasPaymentMethod: hasValidPaymentMethod,
      paymentMethods,
    });
  } catch (error) {
    console.error("Error getting payment method status:", error);
    return res.status(400).json({ error: "Failed to get payment method status" });
  }
});

/**
 * ------------------------------------------------------
 * PAYMENT METHOD SETUP FOR HOMEOWNERS
 * Ensures homeowners have a valid payment method before booking
 * ------------------------------------------------------
 */

/**
 * Create a SetupIntent for adding a payment method
 * This allows the client to save a card for future payments
 */
paymentRouter.post("/setup-intent", async (req, res) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Create or get Stripe Customer
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: EncryptionService.decrypt(user.email),
        name: `${EncryptionService.decrypt(user.firstName)} ${EncryptionService.decrypt(user.lastName)}`,
        metadata: { userId: userId.toString() },
      });
      stripeCustomerId = customer.id;
      await user.update({ stripeCustomerId });
    }

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      metadata: { userId: userId.toString() },
    });

    return res.json({
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return res.status(400).json({ error: "Failed to create setup intent" });
  }
});

/**
 * Create a Checkout Session for adding a payment method (web only)
 * Uses Stripe's hosted checkout page for card collection
 */
paymentRouter.post("/setup-checkout-session", async (req, res) => {
  const { successUrl, cancelUrl } = req.body;

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Create or get Stripe Customer
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: EncryptionService.decrypt(user.email),
        name: `${EncryptionService.decrypt(user.firstName)} ${EncryptionService.decrypt(user.lastName)}`,
        metadata: { userId: userId.toString() },
      });
      stripeCustomerId = customer.id;
      await user.update({ stripeCustomerId });
    }

    // Create Checkout Session in setup mode
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      success_url: successUrl || `${process.env.CLIENT_URL}/payment-setup?setup_complete=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL}/payment-setup?canceled=true`,
      metadata: { userId: userId.toString() },
    });

    return res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(400).json({ error: "Failed to create checkout session" });
  }
});

/**
 * Confirm payment method was saved from Checkout Session (web only)
 * Called after the client returns from Stripe Checkout
 */
paymentRouter.post("/confirm-checkout-session", async (req, res) => {
  const { sessionId } = req.body;

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    if (session.status !== "complete") {
      return res.status(400).json({ error: "Checkout session not completed" });
    }

    const setupIntent = session.setup_intent;
    if (!setupIntent || setupIntent.status !== "succeeded") {
      return res.status(400).json({ error: "Payment method setup not completed" });
    }

    // Set the payment method as the default for the customer
    if (setupIntent.payment_method) {
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: setupIntent.payment_method,
        },
      });
    }

    // Update user record
    await user.update({ hasPaymentMethod: true });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error confirming checkout session:", error);
    return res.status(400).json({ error: "Failed to confirm checkout session" });
  }
});

/**
 * Confirm payment method was saved successfully
 * Called after the client successfully completes the SetupIntent
 */
paymentRouter.post("/confirm-payment-method", async (req, res) => {
  const { setupIntentId } = req.body;

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify the SetupIntent was successful with retry for timing issues
    let setupIntent;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      console.log(`[Payment] SetupIntent ${setupIntentId} status: ${setupIntent.status} (attempt ${attempts + 1})`);

      if (setupIntent.status === "succeeded") {
        break;
      }

      // Wait a bit before retrying (timing issue with Stripe)
      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      attempts++;
    }

    if (setupIntent.status !== "succeeded") {
      console.error(`[Payment] SetupIntent not succeeded after ${maxAttempts} attempts. Status: ${setupIntent.status}`);
      return res.status(400).json({
        error: "Payment method setup not completed",
        status: setupIntent.status,
      });
    }

    // Set the payment method as the default for the customer
    if (setupIntent.payment_method) {
      console.log(`[Payment] Setting default payment method: ${setupIntent.payment_method}`);
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: setupIntent.payment_method,
        },
      });
    } else {
      console.warn(`[Payment] No payment_method on succeeded SetupIntent`);
    }

    // Update user record
    await user.update({ hasPaymentMethod: true });
    console.log(`[Payment] User ${userId} hasPaymentMethod set to true`);

    return res.json({
      success: true,
      message: "Payment method saved successfully",
      hasPaymentMethod: true,
    });
  } catch (error) {
    console.error("Error confirming payment method:", error);
    return res.status(400).json({ error: "Failed to confirm payment method" });
  }
});

/**
 * Check eligibility to remove a payment method
 * Returns whether user can remove the payment method and what options they have
 */
paymentRouter.get("/removal-eligibility/:paymentMethodId", async (req, res) => {
  const { paymentMethodId } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  // Validate payment method ID format
  if (!isValidPaymentMethodId(paymentMethodId)) {
    return res.status(400).json({ error: "Invalid payment method ID format" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get all payment methods for this user
    const methods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    // SECURITY: Verify the payment method belongs to this user
    const paymentMethodBelongsToUser = methods.data.some(m => m.id === paymentMethodId);
    if (!paymentMethodBelongsToUser) {
      return res.status(403).json({ error: "Payment method does not belong to this user" });
    }

    const paymentMethodCount = methods.data.length;
    const isLastPaymentMethod = paymentMethodCount === 1;

    // If not the last payment method, can always remove
    if (!isLastPaymentMethod) {
      return res.json({
        canRemove: true,
        paymentMethodCount,
        isLastPaymentMethod: false,
        outstandingFees: null,
        unpaidAppointments: [],
        options: null,
      });
    }

    // Check for outstanding fees
    const userBill = await UserBills.findOne({ where: { userId } });
    const outstandingFees = {
      cancellationFee: Number(userBill?.cancellationFee) || 0,
      appointmentDue: Number(userBill?.appointmentDue) || 0,
      totalDue: Number(userBill?.totalDue) || 0,
    };

    // Get pricing config for cancellation window
    const pricingConfig = await getPricingConfig();
    const cancellationWindowDays = pricingConfig.cancellation.windowDays;
    const cancellationFeeAmount = pricingConfig.cancellation.fee;

    // Get unpaid appointments (future appointments that aren't paid/completed)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unpaidAppointments = await UserAppointments.findAll({
      where: {
        userId,
        completed: false,
        paid: false,
      },
    });

    // Filter to future appointments and calculate details
    const unpaidAppointmentDetails = unpaidAppointments
      .filter((apt) => new Date(apt.date) >= today)
      .map((apt) => {
        const appointmentDate = new Date(apt.date);
        appointmentDate.setHours(0, 0, 0, 0);
        const diffTime = appointmentDate - today;
        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isWithinCancellationWindow = daysUntil <= cancellationWindowDays;

        return {
          id: apt.id,
          date: apt.date,
          priceCents: apt.price || 0, // Price in cents
          priceDollars: (apt.price || 0) / 100, // Price in dollars for display
          daysUntil,
          isWithinCancellationWindow,
          cancellationFee: isWithinCancellationWindow ? cancellationFeeAmount : 0,
          hasCleanerAssigned: apt.hasBeenAssigned && apt.employeesAssigned?.length > 0,
          paymentIntentId: apt.paymentIntentId,
          paymentStatus: apt.paymentStatus,
        };
      });

    // Calculate totals (in cents)
    const totalToPrepayCents = unpaidAppointmentDetails.reduce((sum, apt) => sum + apt.priceCents, 0);
    const totalCancellationFees = unpaidAppointmentDetails.reduce((sum, apt) => sum + apt.cancellationFee, 0);

    // Determine if user can remove
    const hasOutstandingFees = outstandingFees.totalDue > 0;
    const hasUnpaidAppointments = unpaidAppointmentDetails.length > 0;
    const canRemove = !hasOutstandingFees && !hasUnpaidAppointments;

    return res.json({
      canRemove,
      paymentMethodCount,
      isLastPaymentMethod: true,
      outstandingFees,
      unpaidAppointments: unpaidAppointmentDetails,
      totalToPrepay: totalToPrepayCents / 100, // Convert cents to dollars for display
      totalToPrepayCents, // Also include cents for Stripe
      totalCancellationFees,
      options: canRemove ? null : {
        canPrepayAll: hasUnpaidAppointments && totalToPrepayCents > 0,
        canCancelAll: hasUnpaidAppointments,
        mustPayOutstandingFirst: hasOutstandingFees,
      },
    });
  } catch (error) {
    console.error("Error checking removal eligibility:", error);
    return res.status(500).json({ error: "Failed to check eligibility" });
  }
});

/**
 * Remove a payment method
 * Now includes eligibility checks for last payment method
 */
paymentRouter.delete("/payment-method/:paymentMethodId", strictPaymentLimiter, async (req, res) => {
  const { paymentMethodId } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  // Validate payment method ID format
  if (!isValidPaymentMethodId(paymentMethodId)) {
    return res.status(400).json({ error: "Invalid payment method ID format" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check current payment methods count
    const methods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    // SECURITY: Verify the payment method belongs to this user
    const paymentMethodBelongsToUser = methods.data.some(m => m.id === paymentMethodId);
    if (!paymentMethodBelongsToUser) {
      return res.status(403).json({ error: "Payment method does not belong to this user" });
    }

    const isLastPaymentMethod = methods.data.length === 1;

    // If this is the last payment method, check eligibility
    if (isLastPaymentMethod) {
      // Check for outstanding fees
      const userBill = await UserBills.findOne({ where: { userId } });
      const hasOutstandingFees = (Number(userBill?.totalDue) || 0) > 0;

      if (hasOutstandingFees) {
        return res.status(400).json({
          error: "Cannot remove last payment method with outstanding fees",
          code: "OUTSTANDING_FEES",
          outstandingFees: {
            cancellationFee: Number(userBill?.cancellationFee) || 0,
            appointmentDue: Number(userBill?.appointmentDue) || 0,
            totalDue: Number(userBill?.totalDue) || 0,
          },
        });
      }

      // Check for unpaid appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const unpaidAppointments = await UserAppointments.findAll({
        where: {
          userId,
          completed: false,
          paid: false,
        },
      });

      const futureUnpaidAppointments = unpaidAppointments.filter(
        (apt) => new Date(apt.date) >= today
      );

      if (futureUnpaidAppointments.length > 0) {
        return res.status(400).json({
          error: "Cannot remove last payment method with unpaid appointments",
          code: "UNPAID_APPOINTMENTS",
          appointmentCount: futureUnpaidAppointments.length,
        });
      }
    }

    // All checks passed - detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    // Refresh payment methods list
    const updatedMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    const hasPaymentMethod = updatedMethods.data.length > 0;
    await user.update({ hasPaymentMethod });

    return res.json({
      success: true,
      hasPaymentMethod,
    });
  } catch (error) {
    console.error("Error removing payment method:", error);
    return res.status(400).json({ error: "Failed to remove payment method" });
  }
});

/**
 * Prepay all appointments and remove payment method
 * Used when client wants to prepay all booked appointments before removing their card
 */
paymentRouter.post("/prepay-all-and-remove", strictPaymentLimiter, async (req, res) => {
  const { paymentMethodId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  if (!paymentMethodId) {
    return res.status(400).json({ error: "Payment method ID required" });
  }

  // Validate payment method ID format
  if (!isValidPaymentMethodId(paymentMethodId)) {
    return res.status(400).json({ error: "Invalid payment method ID format" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // SECURITY: Verify the payment method belongs to this user
    const userPaymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });
    const paymentMethodBelongsToUser = userPaymentMethods.data.some(m => m.id === paymentMethodId);
    if (!paymentMethodBelongsToUser) {
      return res.status(403).json({ error: "Payment method does not belong to this user" });
    }

    // Step 1: Pay any outstanding fees first
    const userBill = await UserBills.findOne({ where: { userId } });
    // totalDue is stored in cents
    const outstandingTotal = Number(userBill?.totalDue) || 0;

    if (outstandingTotal > 0) {
      console.log(`[Prepay & Remove] Paying outstanding fees: $${(outstandingTotal / 100).toFixed(2)}`);

      const feePaymentIntent = await stripe.paymentIntents.create({
        amount: outstandingTotal, // Already in cents
        currency: "usd",
        customer: user.stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        description: "Outstanding fees payment before card removal",
        metadata: {
          userId: userId.toString(),
          type: "outstanding_fees",
        },
      });

      if (feePaymentIntent.status !== "succeeded") {
        return res.status(400).json({ error: "Failed to pay outstanding fees" });
      }

      // Clear the bill
      await userBill.update({
        cancellationFee: 0,
        appointmentDue: 0,
        totalDue: 0,
      });
    }

    // Step 2: Capture all unpaid appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unpaidAppointments = await UserAppointments.findAll({
      where: {
        userId,
        completed: false,
        paid: false,
      },
    });

    const futureUnpaidAppointments = unpaidAppointments.filter(
      (apt) => new Date(apt.date) >= today
    );

    const capturedAppointments = [];
    const failedAppointments = [];

    for (const appointment of futureUnpaidAppointments) {
      try {
        if (appointment.paymentIntentId && appointment.paymentStatus === "pending") {
          // Capture the existing payment intent
          const paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);

          await appointment.update({
            paymentStatus: "captured",
            paid: true,
            amountPaid: paymentIntent.amount_received || paymentIntent.amount,
          });

          capturedAppointments.push({
            id: appointment.id,
            date: appointment.date,
            amount: (paymentIntent.amount_received || paymentIntent.amount) / 100,
          });

          console.log(`[Prepay & Remove] Captured payment for appointment ${appointment.id}`);
        } else if (!appointment.paymentIntentId) {
          // No payment intent - create and capture a new one (price already in cents)
          const amountCents = appointment.price || 0;

          if (amountCents > 0) {
            const newPaymentIntent = await stripe.paymentIntents.create({
              amount: amountCents,
              currency: "usd",
              customer: user.stripeCustomerId,
              payment_method: paymentMethodId,
              confirm: true,
              off_session: true,
              description: `Prepayment for appointment on ${appointment.date}`,
              metadata: {
                appointmentId: appointment.id.toString(),
                userId: userId.toString(),
                type: "prepayment",
              },
            });

            if (newPaymentIntent.status === "succeeded") {
              await appointment.update({
                paymentIntentId: newPaymentIntent.id,
                paymentStatus: "captured",
                paid: true,
                amountPaid: newPaymentIntent.amount,
              });

              capturedAppointments.push({
                id: appointment.id,
                date: appointment.date,
                amount: newPaymentIntent.amount / 100, // Convert cents to dollars for response
              });

              console.log(`[Prepay & Remove] Created and captured payment for appointment ${appointment.id}`);
            } else {
              failedAppointments.push({ id: appointment.id, date: appointment.date });
            }
          }
        }
      } catch (err) {
        console.error(`[Prepay & Remove] Failed to capture appointment ${appointment.id}:`, err.message);
        failedAppointments.push({ id: appointment.id, date: appointment.date, error: err.message });
      }
    }

    // If any appointments failed, don't remove the card
    if (failedAppointments.length > 0) {
      return res.status(400).json({
        error: "Some appointments could not be prepaid",
        failedAppointments,
        capturedAppointments,
      });
    }

    // Step 3: Remove the payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    // Update user's payment method status
    const updatedMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    const hasPaymentMethod = updatedMethods.data.length > 0;
    await user.update({ hasPaymentMethod });

    return res.json({
      success: true,
      message: "All appointments prepaid and payment method removed",
      capturedAppointments,
      totalPrepaid: capturedAppointments.reduce((sum, apt) => sum + apt.amount, 0),
      outstandingFeesPaid: outstandingTotal,
      hasPaymentMethod,
    });
  } catch (error) {
    console.error("[Prepay & Remove] Error:", error);
    // Don't leak internal error details to client
    return res.status(500).json({ error: "Failed to process prepayment. Please try again." });
  }
});

/**
 * Cancel all appointments and remove payment method
 * Used when client wants to cancel all booked appointments before removing their card
 * Cancellation fees apply for appointments within 7 days
 */
paymentRouter.post("/cancel-all-and-remove", strictPaymentLimiter, async (req, res) => {
  const { paymentMethodId, acknowledgedCancellationFees } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  if (!paymentMethodId) {
    return res.status(400).json({ error: "Payment method ID required" });
  }

  // Validate payment method ID format
  if (!isValidPaymentMethodId(paymentMethodId)) {
    return res.status(400).json({ error: "Invalid payment method ID format" });
  }

  if (!acknowledgedCancellationFees) {
    return res.status(400).json({ error: "Must acknowledge cancellation fees" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // SECURITY: Verify the payment method belongs to this user
    const userPaymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });
    const paymentMethodBelongsToUser = userPaymentMethods.data.some(m => m.id === paymentMethodId);
    if (!paymentMethodBelongsToUser) {
      return res.status(403).json({ error: "Payment method does not belong to this user" });
    }

    // Get pricing config
    const pricingConfig = await getPricingConfig();
    const cancellationWindowDays = pricingConfig.cancellation.windowDays;
    const cancellationFeeAmount = pricingConfig.cancellation.fee;

    // Get all unpaid future appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unpaidAppointments = await UserAppointments.findAll({
      where: {
        userId,
        completed: false,
        paid: false,
      },
    });

    const futureUnpaidAppointments = unpaidAppointments.filter(
      (apt) => new Date(apt.date) >= today
    );

    const cancelledAppointments = [];
    let totalCancellationFees = 0;

    // Step 1: Cancel all appointments and calculate fees
    for (const appointment of futureUnpaidAppointments) {
      const appointmentDate = new Date(appointment.date);
      appointmentDate.setHours(0, 0, 0, 0);
      const diffTime = appointmentDate - today;
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isWithinWindow = daysUntil <= cancellationWindowDays;
      const fee = isWithinWindow ? cancellationFeeAmount : 0;

      // Cancel the payment intent if it exists
      if (appointment.paymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(appointment.paymentIntentId);
        } catch (err) {
          // Payment intent might already be cancelled or in a different state
          console.log(`[Cancel & Remove] Could not cancel payment intent for appointment ${appointment.id}:`, err.message);
        }
      }

      // Delete any pending requests for this appointment
      await UserPendingRequests.destroy({
        where: { appointmentId: appointment.id },
      });

      // Notify assigned cleaners if any
      const cleanerIds = appointment.employeesAssigned || [];
      if (cleanerIds.length > 0) {
        const home = await UserHomes.findByPk(appointment.homeId);
        for (const cleanerId of cleanerIds) {
          try {
            const cleaner = await User.findByPk(cleanerId);
            if (cleaner?.expoPushToken) {
              const formattedDate = new Date(appointment.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              });
              await PushNotification.sendPushCancellation(
                cleaner.expoPushToken,
                cleaner.firstName,
                new Date(appointment.date),
                { street: home?.address || "Address" }
              );
            }
          } catch (err) {
            console.log(`[Cancel & Remove] Could not notify cleaner ${cleanerId}:`, err.message);
          }
        }
      }

      // Delete the appointment
      await appointment.destroy();

      cancelledAppointments.push({
        id: appointment.id,
        date: appointment.date,
        cancellationFee: fee,
        wasWithinWindow: isWithinWindow,
      });

      totalCancellationFees += fee;
    }

    // Step 2: Get current bill and add cancellation fees
    let userBill = await UserBills.findOne({ where: { userId } });
    const currentCancellationFee = Number(userBill?.cancellationFee) || 0;
    const currentTotalDue = Number(userBill?.totalDue) || 0;

    const newCancellationFee = currentCancellationFee + totalCancellationFees;
    const newTotalDue = currentTotalDue + totalCancellationFees;

    if (userBill) {
      await userBill.update({
        cancellationFee: newCancellationFee,
        totalDue: newTotalDue,
      });
    }

    // Step 3: Pay all outstanding fees (including new cancellation fees)
    // newTotalDue is in cents (sum of integer cent values from DB)
    if (newTotalDue > 0) {
      console.log(`[Cancel & Remove] Paying total fees: $${(newTotalDue / 100).toFixed(2)}`);

      const feePaymentIntent = await stripe.paymentIntents.create({
        amount: newTotalDue, // Already in cents
        currency: "usd",
        customer: user.stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        description: "Cancellation fees and outstanding balance",
        metadata: {
          userId: userId.toString(),
          type: "cancellation_fees_and_outstanding",
          cancellationFees: totalCancellationFees.toString(),
        },
      });

      if (feePaymentIntent.status !== "succeeded") {
        return res.status(400).json({
          error: "Failed to charge cancellation fees",
          cancelledAppointments,
          totalCancellationFees,
        });
      }

      // Clear the bill
      await userBill.update({
        cancellationFee: 0,
        appointmentDue: 0,
        totalDue: 0,
      });

      console.log(`[Cancel & Remove] Fees paid successfully: $${newTotalDue}`);
    }

    // Step 4: Remove the payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    // Update user's payment method status
    const updatedMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    const hasPaymentMethod = updatedMethods.data.length > 0;
    await user.update({ hasPaymentMethod });

    return res.json({
      success: true,
      message: "All appointments cancelled and payment method removed",
      cancelledAppointments,
      totalCancellationFees,
      totalFeesPaid: newTotalDue,
      hasPaymentMethod,
    });
  } catch (error) {
    console.error("[Cancel & Remove] Error:", error);
    // Don't leak internal error details to client
    return res.status(500).json({ error: "Failed to process cancellation. Please try again." });
  }
});

/**
 * ------------------------------------------------------
 * 2️⃣ Create Payment Intent (Authorize Only)
 * Used when booking an appointment
 * ------------------------------------------------------
 */
paymentRouter.post("/create-payment-intent", paymentRateLimiter, async (req, res) => {
  const { homeId, amount, appointmentDate } = req.body;

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  // ============================================================================
  // INPUT VALIDATION - Amount
  // Validate amount is a positive integer within reasonable bounds
  // ============================================================================
  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: "Amount is required" });
  }

  const amountInt = parseInt(amount, 10);
  if (isNaN(amountInt) || amountInt !== Number(amount)) {
    return res.status(400).json({ error: "Amount must be an integer (in cents)" });
  }

  // Minimum $10.00 (1000 cents), Maximum $10,000.00 (1000000 cents)
  const MIN_AMOUNT_CENTS = 1000;
  const MAX_AMOUNT_CENTS = 1000000;

  if (amountInt < MIN_AMOUNT_CENTS) {
    return res.status(400).json({ error: `Amount must be at least $${(MIN_AMOUNT_CENTS / 100).toFixed(2)}` });
  }

  if (amountInt > MAX_AMOUNT_CENTS) {
    return res.status(400).json({ error: `Amount cannot exceed $${(MAX_AMOUNT_CENTS / 100).toFixed(2)}` });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Check if user account is frozen
    const user = await User.findByPk(userId, {
      attributes: ["id", "accountFrozen", "accountFrozenReason"],
    });
    if (user && user.accountFrozen) {
      return res.status(403).json({
        error: "Your account has been suspended. You cannot book new appointments.",
        reason: user.accountFrozenReason || "Please contact support for more information",
        accountSuspended: true,
      });
    }

    const home = await UserHomes.findByPk(homeId);
    if (!home) return res.status(404).json({ error: "Home not found" });

    // Validate amount against home's base price if available
    // Allow up to 3x the base price to account for add-ons, but flag manipulation attempts
    if (home.price) {
      const basePriceCents = Math.round(parseFloat(home.price) * 100);
      const maxAllowedAmount = basePriceCents * 3; // Allow up to 3x for add-ons
      const minAllowedAmount = Math.round(basePriceCents * 0.5); // At least 50% of base price

      if (amountInt < minAllowedAmount) {
        console.warn(`[Payment] Amount below minimum threshold for home ${homeId}`);
        return res.status(400).json({ error: "Amount is below the minimum for this home" });
      }

      if (amountInt > maxAllowedAmount) {
        console.warn(`[Payment] Amount exceeds maximum threshold for home ${homeId}`);
        return res.status(400).json({ error: "Amount exceeds the maximum for this home" });
      }
    }

    // Create Stripe payment intent (authorization only)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInt, // in cents - validated
      currency: "usd",
      capture_method: "manual",
      metadata: { userId, homeId },
    });

    // Create appointment in DB
    // Note: Uses correct field names and keeps price in cents for Stripe compatibility
    const appointment = await UserAppointments.create({
      userId,
      homeId,
      date: appointmentDate,
      price: amountInt, // Keep in cents (e.g., 15000 = $150.00) - validated integer
      paid: false,
      bringTowels: home.towelsProvided ? "no" : "yes",
      bringSheets: home.sheetsProvided ? "no" : "yes",
      keyPadCode: home.keyPadCode || null,
      keyLocation: home.keyLocation || null,
      completed: false,
      hasBeenAssigned: false,
      employeesNeeded: home.cleanersNeeded || 1,
      timeToBeCompleted: "anytime",
      paymentIntentId: paymentIntent.id,
      paymentStatus: "pending",
    });

    // Record authorization in Payment table
    await recordPaymentTransaction({
      type: "authorization",
      status: "pending",
      amount: amountInt,
      userId,
      appointmentId: appointment.id,
      stripePaymentIntentId: paymentIntent.id,
      description: `Payment authorization for appointment ${appointment.id}`,
      metadata: { homeId, appointmentDate },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      appointmentId: appointment.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return res.status(400).json({ error: "Payment creation failed" });
  }
});

/**
 * ------------------------------------------------------
 * 3️⃣ Simple Payment Intent for Mobile App
 * Used by React Native Bill.js
 * ------------------------------------------------------
 */
paymentRouter.post("/create-intent", paymentRateLimiter, async (req, res) => {
  const { amount, email } = req.body;

  // ============================================================================
  // AUTHENTICATION - Require valid JWT token
  // ============================================================================
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Verify user exists
  const user = await User.findByPk(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  // Validate amount - must be positive integer within reasonable bounds
  // Min: $1 (100 cents), Max: $10,000 (1000000 cents) for bill payments
  const MIN_AMOUNT_CENTS = 100;
  const MAX_AMOUNT_CENTS = 1000000;

  if (!amount || typeof amount !== "number" || !Number.isInteger(amount)) {
    return res.status(400).json({ error: "Amount must be a valid integer in cents" });
  }

  if (amount < MIN_AMOUNT_CENTS || amount > MAX_AMOUNT_CENTS) {
    return res.status(400).json({ error: "Amount must be between $1.00 and $10,000.00" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: email || user.email,
      metadata: {
        userId: decoded.userId,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(400).json({ error: "Payment creation failed" });
  }
});

/**
 * ------------------------------------------------------
 * Pay Bill - Charge saved card directly
 * Uses the customer's saved payment method to pay their bill
 * ------------------------------------------------------
 */
paymentRouter.post("/pay-bill", paymentRateLimiter, async (req, res) => {
  const { amount } = req.body; // amount in cents
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  // Strict amount validation - must be a positive integer
  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: "Amount is required" });
  }

  // Reject non-numeric types and ensure it's an integer
  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    return res.status(400).json({ error: "Amount must be an integer (in cents)" });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: "Amount must be positive" });
  }

  // Reasonable bounds: $1 minimum, $50,000 maximum for bill payments
  const MAX_BILL_PAYMENT_CENTS = 5000000;
  if (amount > MAX_BILL_PAYMENT_CENTS) {
    return res.status(400).json({ error: "Amount exceeds maximum allowed" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;
    console.log("[Pay Bill] Processing bill payment request");

    const user = await User.findByPk(userId);
    if (!user) {
      console.log("[Pay Bill] User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.stripeCustomerId) {
      console.log("[Pay Bill] No Stripe customer ID for user:", userId);
      return res.status(400).json({ error: "No payment method on file. Please add a card first." });
    }

    // Get the customer's default payment method
    console.log("[Pay Bill] Retrieving Stripe customer:", user.stripeCustomerId);
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethod) {
      console.log("[Pay Bill] No default payment method for customer:", user.stripeCustomerId);
      return res.status(400).json({ error: "No payment method on file. Please add a card first." });
    }

    // Create and confirm a PaymentIntent using the saved card
    console.log("[Pay Bill] Creating PaymentIntent with payment method:", defaultPaymentMethod);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // in cents
      currency: "usd",
      customer: user.stripeCustomerId,
      payment_method: defaultPaymentMethod,
      confirm: true,
      off_session: true,
      description: "Bill payment",
      metadata: {
        userId: userId.toString(),
        type: "bill_payment",
      },
    });
    console.log("[Pay Bill] PaymentIntent created:", paymentIntent.id, "Status:", paymentIntent.status);

    if (paymentIntent.status !== "succeeded") {
      console.error(`[Pay Bill] Payment failed with status: ${paymentIntent.status}`);
      return res.status(400).json({ error: "Payment failed. Please try again or update your card." });
    }

    // Find and update the user's bill
    const bill = await UserBills.findOne({ where: { userId } });
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // Amount is in cents, convert to dollars for bill (stored in dollars)
    const paymentAmountDollars = amount / 100;

    // Get current values
    let currentCancellationFee = Number(bill.cancellationFee) || 0;
    let currentAppointmentDue = Number(bill.appointmentDue) || 0;
    let remainingPayment = paymentAmountDollars;

    // Apply payment to cancellation fee first
    if (remainingPayment > 0 && currentCancellationFee > 0) {
      const feePayment = Math.min(remainingPayment, currentCancellationFee);
      currentCancellationFee -= feePayment;
      remainingPayment -= feePayment;
    }

    // Then apply to appointment dues
    if (remainingPayment > 0 && currentAppointmentDue > 0) {
      const duePayment = Math.min(remainingPayment, currentAppointmentDue);
      currentAppointmentDue -= duePayment;
      remainingPayment -= duePayment;
    }

    // Calculate new total
    const newTotalDue = currentCancellationFee + currentAppointmentDue;

    // Update the bill
    await bill.update({
      cancellationFee: Math.max(0, currentCancellationFee),
      appointmentDue: Math.max(0, currentAppointmentDue),
      totalDue: Math.max(0, newTotalDue),
    });

    // Record the payment transaction
    await recordPaymentTransaction({
      type: "bill_payment",
      status: "succeeded",
      amount: amount, // in cents
      userId,
      stripePaymentIntentId: paymentIntent.id,
      description: `Bill payment - $${paymentAmountDollars.toFixed(2)}`,
    });

    console.log(`[Pay Bill] User ${userId} paid $${paymentAmountDollars.toFixed(2)} - Bill updated`);

    return res.json({
      success: true,
      bill: {
        cancellationFee: Math.max(0, currentCancellationFee),
        appointmentDue: Math.max(0, currentAppointmentDue),
        totalDue: Math.max(0, newTotalDue),
      },
    });
  } catch (error) {
    console.error("[Pay Bill] Error:", error);

    // Handle Stripe card errors - use generic message to avoid leaking card details
    if (error.type === "StripeCardError") {
      // Log the actual error for debugging but return generic message to client
      console.error("[Pay Bill] Stripe card error details:", error.code, error.decline_code);
      return res.status(400).json({ error: "Your card was declined. Please check your card details or try a different payment method." });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }

    return res.status(500).json({ error: "Payment failed. Please try again." });
  }
});

/**
 * ------------------------------------------------------
 * Record Bill Payment
 * Called after successful Stripe payment to update the user's bill
 * Applies payment to cancellation fees first, then appointment dues
 * ------------------------------------------------------
 */
paymentRouter.post("/record-bill-payment", async (req, res) => {
  const { amount, paymentIntentId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;

    // Validate paymentIntentId is provided
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return res.status(400).json({ error: "Valid payment intent ID is required" });
    }

    // Verify the payment intent belongs to this user
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Check that the payment intent metadata matches this user
      if (paymentIntent.metadata?.userId !== String(userId)) {
        console.warn(`[Bill Payment] User ${userId} tried to use payment intent ${paymentIntentId} belonging to user ${paymentIntent.metadata?.userId}`);
        return res.status(403).json({ error: "This payment does not belong to you" });
      }

      // Verify the payment was actually successful
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ error: "Payment has not been completed" });
      }

      // Verify the amount matches what was actually charged
      if (paymentIntent.amount !== amount) {
        console.warn(`[Bill Payment] Amount mismatch: user ${userId} claimed ${amount} but payment intent was ${paymentIntent.amount}`);
        return res.status(400).json({ error: "Amount does not match payment" });
      }
    } catch (stripeError) {
      console.error("[Bill Payment] Stripe verification error:", stripeError.message);
      return res.status(400).json({ error: "Invalid payment intent" });
    }

    // Find the user's bill
    const bill = await UserBills.findOne({ where: { userId } });
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // Use verified amount from Stripe (in cents), convert to dollars for bill
    const paymentAmountDollars = amount / 100;

    // Get current values
    let currentCancellationFee = Number(bill.cancellationFee) || 0;
    let currentAppointmentDue = Number(bill.appointmentDue) || 0;
    let remainingPayment = paymentAmountDollars;

    // Apply payment to cancellation fee first
    if (remainingPayment > 0 && currentCancellationFee > 0) {
      const feePayment = Math.min(remainingPayment, currentCancellationFee);
      currentCancellationFee -= feePayment;
      remainingPayment -= feePayment;
    }

    // Then apply to appointment dues
    if (remainingPayment > 0 && currentAppointmentDue > 0) {
      const duePayment = Math.min(remainingPayment, currentAppointmentDue);
      currentAppointmentDue -= duePayment;
      remainingPayment -= duePayment;
    }

    // Calculate new total
    const newTotalDue = currentCancellationFee + currentAppointmentDue;

    // Update the bill
    await bill.update({
      cancellationFee: Math.max(0, currentCancellationFee),
      appointmentDue: Math.max(0, currentAppointmentDue),
      totalDue: Math.max(0, newTotalDue),
    });

    // Record the payment transaction
    await recordPaymentTransaction({
      type: "bill_payment",
      status: "succeeded",
      amount: amount, // in cents
      userId,
      stripePaymentIntentId: paymentIntentId,
      description: `Bill payment - $${paymentAmountDollars.toFixed(2)}`,
      metadata: {
        cancellationFeePaid: paymentAmountDollars - remainingPayment,
      },
    });

    console.log(`[Bill Payment] User ${userId} paid $${paymentAmountDollars.toFixed(2)} - Bill updated`);

    return res.json({
      success: true,
      bill: {
        cancellationFee: Math.max(0, currentCancellationFee),
        appointmentDue: Math.max(0, currentAppointmentDue),
        totalDue: Math.max(0, newTotalDue),
      },
    });
  } catch (error) {
    console.error("[Bill Payment] Error:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(500).json({ error: "Failed to record payment" });
  }
});

/**
 * ------------------------------------------------------
 * Helper: Process payouts for multi-cleaner jobs
 * Uses proportional room-based earnings splits
 * Uses database transactions to ensure atomicity (like single-cleaner payouts)
 * ------------------------------------------------------
 */
async function processMultiCleanerPayouts(appointment, multiCleanerJob) {
  const results = [];

  try {
    // Get room assignments for this job
    const roomAssignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId: multiCleanerJob.id },
    });

    // Get job completions to identify which cleaners to pay
    const completions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId: multiCleanerJob.id,
        status: { [require("sequelize").Op.in]: ["completed", "started"] },
      },
    });

    if (completions.length === 0) {
      console.log("[MultiCleanerPayout] No completed cleaners found for job", multiCleanerJob.id);
      return results;
    }

    // Calculate total price
    const home = await UserHomes.findByPk(appointment.homeId);
    const totalPriceCents = await MultiCleanerPricingService.calculateTotalJobPrice(
      home,
      appointment,
      multiCleanerJob.totalCleanersRequired
    );

    // Calculate earnings breakdown using proportional split
    const earningsBreakdown = await MultiCleanerPricingService.calculatePerCleanerEarnings(
      totalPriceCents,
      completions.length,
      roomAssignments
    );

    // Get the charge ID from the payment intent (read-only Stripe call)
    let chargeId = null;
    if (appointment.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
        chargeId = paymentIntent.latest_charge;
      } catch (err) {
        console.error(`[MultiCleanerPayout] Could not retrieve payment intent ${appointment.paymentIntentId}:`, err.message);
      }
    }

    // Get pricing config for fee calculations
    const pricing = await getPricingConfig();
    const regularFeePercent = pricing?.platform?.feePercent || 0.10;
    const businessOwnerFeePercent = pricing?.platform?.businessOwnerFeePercent || regularFeePercent;
    const largeBusinessFeePercent = pricing?.platform?.largeBusinessFeePercent || 0.07;

    // Process payout for each completed cleaner with proper transaction isolation
    for (const completion of completions) {
      const cleanerId = completion.cleanerId;

      // Use a transaction for each cleaner's payout to ensure atomicity
      const t = await sequelize.transaction();

      try {
        // Check if already paid WITH row lock to prevent race conditions
        let payout = await Payout.findOne({
          where: {
            appointmentId: appointment.id,
            cleanerId,
            multiCleanerJobId: multiCleanerJob.id,
          },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        // Check if already paid OR currently being processed (prevents race condition)
        if (payout && (payout.status === "completed" || payout.status === "processing")) {
          await t.commit();
          results.push({
            cleanerId,
            status: payout.status === "completed" ? "already_paid" : "in_progress"
          });
          continue;
        }

        // Check if this cleaner is a business employee for this job
        let isBusinessEmployee = false;
        let businessOwnerId = null;
        let payoutRecipientId = cleanerId;
        let applicableFeePercent = earningsBreakdown.platformFeePercent;

        const employeeAssignment = await EmployeeJobAssignment.findOne({
          where: { appointmentId: appointment.id },
          include: [{
            model: BusinessEmployee,
            as: "employee",
            where: { userId: cleanerId },
            required: true,
          }],
          transaction: t,
        });

        if (employeeAssignment) {
          isBusinessEmployee = true;
          businessOwnerId = employeeAssignment.businessOwnerId;
          payoutRecipientId = businessOwnerId; // Route payout to business owner

          // Check if business qualifies for large business discount
          const qualification = await BusinessVolumeService.qualifiesForLargeBusinessFee(businessOwnerId);
          if (qualification.qualifies) {
            applicableFeePercent = largeBusinessFeePercent;
          } else {
            applicableFeePercent = businessOwnerFeePercent;
          }

          console.log(`[MultiCleanerPayout] Processing business employee payout with discounted fee`);
        }

        // Get the payout recipient's Stripe Connect account
        const connectAccount = await StripeConnectAccount.findOne({
          where: { userId: payoutRecipientId },
          transaction: t,
        });

        if (!connectAccount || !connectAccount.payoutsEnabled) {
          await t.commit();
          results.push({
            cleanerId,
            status: "skipped",
            reason: isBusinessEmployee
              ? "Business owner has not completed Stripe onboarding"
              : "Cleaner has not completed Stripe onboarding",
          });
          continue;
        }

        // Calculate earnings - recalculate if business employee (different fee)
        // NOTE: Business employees get lower platform fees (7-10%) compared to
        // standard multi-cleaner fee (13%). This is intentional business logic.
        let grossAmount, platformFee, netAmount, percentOfWork;
        let originalFeePercent = earningsBreakdown.platformFeePercent; // Track for metadata
        let feeDiscountApplied = false;

        if (isBusinessEmployee) {
          // Recalculate with business owner fee instead of multi-cleaner fee
          // Business owners get reduced platform fees as a volume/partnership benefit
          const cleanerAssignments = roomAssignments.filter(a => String(a.cleanerId) === String(cleanerId));
          const totalEffort = roomAssignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
          const cleanerEffort = cleanerAssignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);

          const effortRatio = totalEffort > 0 ? cleanerEffort / totalEffort : 1 / completions.length;
          grossAmount = Math.round(totalPriceCents * effortRatio);

          // Calculate what the fee WOULD have been at standard rate for tracking
          const standardFee = Math.round(grossAmount * originalFeePercent);
          platformFee = Math.round(grossAmount * applicableFeePercent);
          feeDiscountApplied = platformFee < standardFee;

          netAmount = grossAmount - platformFee;
          percentOfWork = Math.round(effortRatio * 100);

          if (feeDiscountApplied) {
            console.log(
              `[MultiCleanerPayout] Business employee fee discount: standard ${(originalFeePercent * 100).toFixed(1)}% = $${(standardFee / 100).toFixed(2)}, ` +
              `applied ${(applicableFeePercent * 100).toFixed(1)}% = $${(platformFee / 100).toFixed(2)}, ` +
              `savings: $${((standardFee - platformFee) / 100).toFixed(2)}`
            );
          }
        } else {
          // Use standard multi-cleaner earnings breakdown
          // Try multiple matching strategies since earnings may be keyed by cleanerId or cleanerSlotIndex
          let cleanerEarning = earningsBreakdown.cleanerEarnings.find(
            (e) => String(e.cleanerId) === String(cleanerId)
          );

          // If no match by cleanerId, try matching by index position
          // This handles cases where room assignments used cleanerSlotIndex instead of actual cleaner IDs
          if (!cleanerEarning) {
            const completionIndex = completions.findIndex(c => c.cleanerId === cleanerId);
            if (completionIndex >= 0 && completionIndex < earningsBreakdown.cleanerEarnings.length) {
              // Check if earnings are indexed (cleanerIndex matches position)
              const earningByIndex = earningsBreakdown.cleanerEarnings.find(
                (e) => e.cleanerIndex === completionIndex || String(e.cleanerId) === String(completionIndex)
              );
              if (earningByIndex) {
                cleanerEarning = earningByIndex;
                console.log(`[MultiCleanerPayout] Matched cleaner ${cleanerId} by index position ${completionIndex}`);
              }
            }
          }

          if (!cleanerEarning) {
            // Fallback to equal split if cleaner not found in breakdown
            await t.commit();
            const equalShare = Math.round(earningsBreakdown.netForCleaners / completions.length);
            console.log(`[MultiCleanerPayout] Using equal split fallback for cleaner ${cleanerId}`);

            await processCleanerPayoutWithAmount(
              cleanerId,
              appointment,
              equalShare,
              Math.round(earningsBreakdown.platformFee / completions.length),
              multiCleanerJob.id,
              chargeId,
              false,
              results
            );
            continue;
          }

          grossAmount = cleanerEarning.grossAmount;
          platformFee = cleanerEarning.platformFee;
          netAmount = cleanerEarning.netAmount;
          percentOfWork = cleanerEarning.percentOfWork;
        }

        // Create or update payout record within transaction
        if (!payout) {
          payout = await Payout.create({
            appointmentId: appointment.id,
            cleanerId,
            multiCleanerJobId: multiCleanerJob.id,
            grossAmount,
            platformFee,
            netAmount,
            isPartialPayout: completion.status === "started",
            status: "processing",
            paymentCapturedAt: new Date(),
            transferInitiatedAt: new Date(),
            payoutType: isBusinessEmployee ? "business_employee" : "marketplace",
          }, { transaction: t });
        } else {
          await payout.update({
            grossAmount,
            platformFee,
            netAmount,
            isPartialPayout: completion.status === "started",
            status: "processing",
            transferInitiatedAt: new Date(),
            payoutType: isBusinessEmployee ? "business_employee" : "marketplace",
          }, { transaction: t });
        }

        // Commit the "processing" state before calling Stripe
        // This releases the lock but ensures we have a record of the payout attempt
        await t.commit();

        // Create Stripe Transfer (external API call - cannot hold DB lock during this)
        const transferParams = {
          amount: netAmount,
          currency: "usd",
          destination: connectAccount.stripeAccountId,
          metadata: {
            appointmentId: appointment.id.toString(),
            cleanerId: cleanerId.toString(),
            payoutId: payout.id.toString(),
            multiCleanerJobId: multiCleanerJob.id.toString(),
            percentOfWork: percentOfWork.toString(),
            ...(isBusinessEmployee && {
              isBusinessEmployee: "true",
              businessOwnerId: businessOwnerId.toString(),
              payoutRecipientId: payoutRecipientId.toString(),
            }),
          },
        };

        if (chargeId) {
          transferParams.source_transaction = chargeId;
        }

        let transfer;
        try {
          // Use idempotency key to prevent duplicate transfers on retry
          const idempotencyKey = `transfer-mc-${appointment.id}-${cleanerId}-${payout.id}`;
          transfer = await stripe.transfers.create(transferParams, { idempotencyKey });
        } catch (stripeError) {
          // Stripe transfer failed - update payout status to failed in a new transaction
          const tFailed = await sequelize.transaction();
          try {
            await payout.update({
              status: "failed",
              failureReason: stripeError.message || "Stripe transfer failed",
              completedAt: new Date(),
            }, { transaction: tFailed });
            await tFailed.commit();
          } catch (updateErr) {
            await tFailed.rollback();
            console.error(`[MultiCleanerPayout] Failed to update payout status to failed:`, updateErr);
          }

          console.error(`[MultiCleanerPayout] Stripe transfer failed for cleaner ${cleanerId}:`, stripeError.message);
          results.push({
            cleanerId,
            status: "failed",
            error: stripeError.message,
          });
          continue;
        }

        // Stripe transfer succeeded - update all records atomically in a new transaction
        const tSuccess = await sequelize.transaction();
        try {
          await payout.update({
            stripeTransferId: transfer.id,
            status: "completed",
            completedAt: new Date(),
          }, { transaction: tSuccess });

          // Update completion record with payout ID
          await completion.update({ payoutId: payout.id }, { transaction: tSuccess });

          // Update EmployeeJobAssignment payout status if business employee
          if (isBusinessEmployee && employeeAssignment) {
            await employeeAssignment.update({ payoutStatus: "completed" }, { transaction: tSuccess });
          }

          // Record payout transaction (tax-reportable)
          await recordPaymentTransaction({
            type: "payout",
            status: "succeeded",
            amount: netAmount,
            cleanerId: payoutRecipientId,
            appointmentId: appointment.id,
            payoutId: payout.id,
            stripeTransferId: transfer.id,
            platformFeeAmount: platformFee,
            netAmount,
            description: isBusinessEmployee
              ? `Multi-cleaner payout to business owner (employee ${cleanerId}, ${percentOfWork}% of work) for appointment ${appointment.id}`
              : `Multi-cleaner payout (${percentOfWork}% of work) for appointment ${appointment.id}`,
            metadata: {
              grossAmount,
              cleanerCount: completions.length,
              stripeAccountId: connectAccount.stripeAccountId,
              multiCleanerJobId: multiCleanerJob.id,
              percentOfWork,
              isBusinessEmployee,
              ...(isBusinessEmployee && { businessOwnerId, employeeCleanerId: cleanerId }),
            },
            transaction: tSuccess,
            throwOnError: true, // Tax-reportable transaction must be recorded
          });

          // Record platform fee with discount tracking for business employees
          await recordPaymentTransaction({
            type: "platform_fee",
            status: "succeeded",
            amount: platformFee,
            appointmentId: appointment.id,
            payoutId: payout.id,
            description: isBusinessEmployee && feeDiscountApplied
              ? `Platform fee from multi-cleaner appointment ${appointment.id} (business discount applied)`
              : `Platform fee from multi-cleaner appointment ${appointment.id}`,
            metadata: {
              cleanerId,
              grossAmount,
              feePercent: applicableFeePercent * 100,
              multiCleanerJobId: multiCleanerJob.id,
              isBusinessEmployee,
              // Track fee discount for reconciliation
              ...(isBusinessEmployee && {
                standardFeePercent: originalFeePercent * 100,
                feeDiscountApplied,
                standardFeeAmount: Math.round(grossAmount * originalFeePercent),
                feeSavings: Math.round(grossAmount * originalFeePercent) - platformFee,
              }),
            },
            transaction: tSuccess,
          });

          await tSuccess.commit();
        } catch (updateErr) {
          await tSuccess.rollback();
          // Critical: Stripe transfer succeeded but we couldn't update the records
          console.error(`[MultiCleanerPayout] CRITICAL: Stripe transfer ${transfer.id} succeeded but failed to update records:`, updateErr);
          results.push({
            cleanerId,
            status: "success_db_error",
            transferId: transfer.id,
            amountCents: netAmount,
            error: "Transfer succeeded but database update failed - requires manual reconciliation",
          });
          continue;
        }

        results.push({
          cleanerId,
          status: "success",
          transferId: transfer.id,
          amountCents: netAmount,
          percentOfWork,
          isBusinessEmployee,
          payoutRecipientId,
        });
      } catch (error) {
        // Rollback transaction if it's still active
        try {
          await t.rollback();
        } catch (rollbackErr) {
          // Transaction may already be committed/rolled back
        }
        console.error(`[MultiCleanerPayout] Failed for cleaner ${cleanerId}:`, error);
        results.push({
          cleanerId,
          status: "failed",
          error: error.message,
        });
      }
    }

    // Update job status if all cleaners have been processed
    // Count success, already_paid, and skipped as "handled" - skipped means cleaner
    // hasn't completed Stripe onboarding, but the job itself is done
    const handledStatuses = ["success", "already_paid", "skipped", "success_db_error"];
    const handledCount = results.filter((r) => handledStatuses.includes(r.status)).length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    if (handledCount + failedCount === completions.length) {
      // All cleaners processed - mark job as completed if at least one was paid
      // or if all were handled (even if some were skipped)
      const paidCount = results.filter((r) => r.status === "success" || r.status === "already_paid").length;
      if (paidCount > 0 || handledCount === completions.length) {
        await multiCleanerJob.update({ status: "completed" });
      } else if (failedCount === completions.length) {
        // All failed - mark as failed for retry
        await multiCleanerJob.update({ status: "payout_failed" });
      }
    }

    return results;
  } catch (error) {
    console.error("[MultiCleanerPayout] Error processing payouts:", error);
    throw error;
  }
}

/**
 * Helper: Process individual cleaner payout with a specific amount
 * Uses transactions to ensure atomicity and proper error recovery
 */
async function processCleanerPayoutWithAmount(cleanerId, appointment, netAmount, platformFee, multiCleanerJobId, chargeId, isPartial, results) {
  // Start transaction for initial payout creation
  const t = await sequelize.transaction();

  try {
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: cleanerId },
      transaction: t,
    });

    if (!connectAccount || !connectAccount.payoutsEnabled) {
      await t.commit();
      results.push({
        cleanerId,
        status: "skipped",
        reason: "Cleaner has not completed Stripe onboarding",
      });
      return;
    }

    const payout = await Payout.create({
      appointmentId: appointment.id,
      cleanerId,
      multiCleanerJobId,
      grossAmount: netAmount + platformFee,
      platformFee,
      netAmount,
      isPartialPayout: isPartial,
      status: "processing",
      paymentCapturedAt: new Date(),
      transferInitiatedAt: new Date(),
    }, { transaction: t });

    // Commit before Stripe call to release lock
    await t.commit();

    const transferParams = {
      amount: netAmount,
      currency: "usd",
      destination: connectAccount.stripeAccountId,
      metadata: {
        appointmentId: appointment.id.toString(),
        cleanerId: cleanerId.toString(),
        payoutId: payout.id.toString(),
      },
    };

    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }

    let transfer;
    try {
      // Use idempotency key to prevent duplicate transfers on retry
      const idempotencyKey = `transfer-pwa-${appointment.id}-${cleanerId}-${payout.id}`;
      transfer = await stripe.transfers.create(transferParams, { idempotencyKey });
    } catch (stripeError) {
      // Stripe transfer failed - update payout status to failed
      const tFailed = await sequelize.transaction();
      try {
        await payout.update({
          status: "failed",
          failureReason: stripeError.message || "Stripe transfer failed",
          completedAt: new Date(),
        }, { transaction: tFailed });
        await tFailed.commit();
      } catch (updateErr) {
        await tFailed.rollback();
        console.error(`[processCleanerPayoutWithAmount] Failed to update payout status to failed:`, updateErr);
      }

      console.error(`[processCleanerPayoutWithAmount] Stripe transfer failed for cleaner ${cleanerId}:`, stripeError.message);
      results.push({
        cleanerId,
        status: "failed",
        error: stripeError.message,
      });
      return;
    }

    // Stripe succeeded - update payout in new transaction
    const tSuccess = await sequelize.transaction();
    try {
      await payout.update({
        stripeTransferId: transfer.id,
        status: "completed",
        completedAt: new Date(),
      }, { transaction: tSuccess });
      await tSuccess.commit();
    } catch (updateErr) {
      await tSuccess.rollback();
      console.error(`[processCleanerPayoutWithAmount] CRITICAL: Stripe transfer ${transfer.id} succeeded but failed to update payout record:`, updateErr);
      results.push({
        cleanerId,
        status: "success_db_error",
        transferId: transfer.id,
        amountCents: netAmount,
        error: "Transfer succeeded but database update failed - requires manual reconciliation",
      });
      return;
    }

    results.push({
      cleanerId,
      status: "success",
      transferId: transfer.id,
      amountCents: netAmount,
    });
  } catch (error) {
    // Rollback transaction if still active
    try {
      await t.rollback();
    } catch (rollbackErr) {
      // Transaction may already be committed/rolled back
    }
    console.error(`[processCleanerPayoutWithAmount] Payout failed for cleaner ${cleanerId}:`, error);
    results.push({
      cleanerId,
      status: "failed",
      error: error.message,
    });
  }
}

/**
 * ------------------------------------------------------
 * Helper: Process payouts to cleaners after job completion
 * Records all transactions in Payment table for tax reporting
 * Delegates to processMultiCleanerPayouts for multi-cleaner jobs
 * Uses database transactions to ensure atomicity
 * ------------------------------------------------------
 */
async function processCleanerPayouts(appointment) {
  // Check if this is a multi-cleaner job
  if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
    const multiCleanerJob = await MultiCleanerJob.findByPk(appointment.multiCleanerJobId);
    if (multiCleanerJob) {
      console.log(`[Payout] Processing multi-cleaner payouts for job ${multiCleanerJob.id}`);
      return processMultiCleanerPayouts(appointment, multiCleanerJob);
    }
  }

  // Standard single-cleaner payout logic
  const cleanerIds = appointment.employeesAssigned || [];
  const results = [];

  // Get platform fee from database
  const pricing = await getPricingConfig();
  const platformFeePercent = pricing.platform.feePercent;

  for (const cleanerIdStr of cleanerIds) {
    const cleanerId = parseInt(cleanerIdStr, 10);

    // Use a transaction for each cleaner's payout to ensure atomicity
    const t = await sequelize.transaction();

    try {
      // Get or create payout record with row lock
      let payout = await Payout.findOne({
        where: { appointmentId: appointment.id, cleanerId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (payout && payout.status === "completed") {
        await t.commit();
        results.push({ cleanerId, status: "already_paid" });
        continue;
      }

      // Get cleaner's Stripe Connect account
      const connectAccount = await StripeConnectAccount.findOne({
        where: { userId: cleanerId },
        transaction: t,
      });

      if (!connectAccount || !connectAccount.payoutsEnabled) {
        await t.commit();
        results.push({
          cleanerId,
          status: "skipped",
          reason: "Cleaner has not completed Stripe onboarding"
        });
        continue;
      }

      // Calculate amounts using database pricing (prices already stored in cents)
      // Use original price for cleaner payout if discount was applied (platform absorbs the discount)
      // Note: parseInt handles both number and string types for backwards compatibility
      const priceInCents = appointment.discountApplied && appointment.originalPrice
        ? parseInt(appointment.originalPrice, 10)
        : appointment.price;
      const perCleanerGross = Math.round(priceInCents / cleanerIds.length);
      const platformFee = Math.round(perCleanerGross * platformFeePercent);
      const netAmount = perCleanerGross - platformFee;

      // Create payout record if it doesn't exist
      if (!payout) {
        payout = await Payout.create({
          appointmentId: appointment.id,
          cleanerId,
          grossAmount: perCleanerGross,
          platformFee,
          netAmount,
          status: "processing",
          paymentCapturedAt: new Date(),
          transferInitiatedAt: new Date(),
        }, { transaction: t });
      } else {
        await payout.update({
          grossAmount: perCleanerGross,
          platformFee,
          netAmount,
          status: "processing",
          transferInitiatedAt: new Date(),
        }, { transaction: t });
      }

      // Commit the "processing" state before calling Stripe
      await t.commit();

      // Get the charge ID from the payment intent (outside transaction - read-only Stripe call)
      let chargeId = null;
      if (appointment.paymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
          chargeId = paymentIntent.latest_charge;
        } catch (err) {
          console.error(`Could not retrieve payment intent ${appointment.paymentIntentId}:`, err.message);
        }
      }

      // Create Stripe Transfer to cleaner (external API call)
      const transferParams = {
        amount: netAmount,
        currency: "usd",
        destination: connectAccount.stripeAccountId,
        metadata: {
          appointmentId: appointment.id.toString(),
          cleanerId: cleanerId.toString(),
          payoutId: payout.id.toString(),
        },
      };

      if (chargeId) {
        transferParams.source_transaction = chargeId;
      }

      let transfer;
      try {
        // Use idempotency key to prevent duplicate transfers on retry
        const idempotencyKey = `transfer-batch-${appointment.id}-${cleanerId}-${payout.id}`;
        transfer = await stripe.transfers.create(transferParams, { idempotencyKey });
      } catch (stripeError) {
        // Stripe transfer failed - update payout status
        const tFailed = await sequelize.transaction();
        try {
          await payout.update({
            status: "failed",
            failureReason: stripeError.message || "Stripe transfer failed",
            completedAt: new Date(),
          }, { transaction: tFailed });
          await tFailed.commit();
        } catch (updateErr) {
          await tFailed.rollback();
          console.error(`Failed to update payout status to failed:`, updateErr);
        }

        results.push({
          cleanerId,
          status: "failed",
          error: stripeError.message,
        });
        continue;
      }

      // Stripe transfer succeeded - update payout and record transactions atomically
      const tSuccess = await sequelize.transaction();
      try {
        await payout.update({
          stripeTransferId: transfer.id,
          status: "completed",
          completedAt: new Date(),
        }, { transaction: tSuccess });

        // Record payout transaction in Payment table (for 1099 reporting)
        // CRITICAL: throwOnError ensures tax-reportable transaction is recorded
        await recordPaymentTransaction({
          type: "payout",
          status: "succeeded",
          amount: netAmount,
          cleanerId,
          appointmentId: appointment.id,
          payoutId: payout.id,
          stripeTransferId: transfer.id,
          platformFeeAmount: platformFee,
          netAmount,
          description: `Payout to cleaner for appointment ${appointment.id}`,
          metadata: {
            grossAmount: perCleanerGross,
            cleanerCount: cleanerIds.length,
            stripeAccountId: connectAccount.stripeAccountId,
          },
          transaction: tSuccess,
          throwOnError: true, // Tax-reportable transaction must be recorded
        });

        // Record platform fee as separate transaction
        await recordPaymentTransaction({
          type: "platform_fee",
          status: "succeeded",
          amount: platformFee,
          appointmentId: appointment.id,
          payoutId: payout.id,
          description: `Platform fee from appointment ${appointment.id}`,
          metadata: {
            cleanerId,
            grossAmount: perCleanerGross,
            feePercent: platformFeePercent * 100,
          },
          transaction: tSuccess,
        });

        await tSuccess.commit();
      } catch (updateErr) {
        await tSuccess.rollback();
        // Critical: Stripe transfer succeeded but we couldn't update the records
        console.error(`CRITICAL: Stripe transfer ${transfer.id} succeeded but failed to update records:`, updateErr);
        console.error(`RECONCILIATION DATA: cleanerId=${cleanerId}, appointmentId=${appointment.id}, transferId=${transfer.id}, amount=${netAmount}`);

        // Try to create an emergency payout audit record for reconciliation
        try {
          await recordPaymentTransaction({
            type: "payout",
            status: "succeeded",
            amount: netAmount,
            cleanerId,
            appointmentId: appointment.id,
            stripeTransferId: transfer.id,
            description: `EMERGENCY AUDIT: Payout transfer succeeded but payout record update failed - requires manual reconciliation`,
            metadata: { dbError: updateErr.message, requiresReconciliation: true, payoutId: payout?.id },
          });
          console.log(`Emergency payout audit record created for cleaner ${cleanerId}, appointment ${appointment.id}`);
        } catch (auditError) {
          console.error(`CRITICAL: Failed to create emergency payout audit record:`, auditError);
        }

        results.push({
          cleanerId,
          status: "success_db_error",
          transferId: transfer.id,
          amountCents: netAmount,
          error: "Transfer succeeded but database update failed - requires manual reconciliation",
        });
        continue;
      }

      results.push({
        cleanerId,
        status: "success",
        transferId: transfer.id,
        amountCents: netAmount,
      });
    } catch (error) {
      // Rollback transaction if it's still active
      try {
        await t.rollback();
      } catch (rollbackErr) {
        // Transaction may already be committed/rolled back
      }
      console.error(`Payout failed for cleaner ${cleanerId}:`, error);
      results.push({
        cleanerId,
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * ------------------------------------------------------
 * 4️⃣ Capture Payment Manually (Cleaner or Admin Trigger)
 * Uses row-level locking to prevent race conditions and ensure atomicity
 * ------------------------------------------------------
 */
paymentRouter.post("/capture-payment", paymentRateLimiter, async (req, res) => {
  const { appointmentId } = req.body;

  // Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Start transaction immediately with row lock to prevent race conditions
  const t = await sequelize.transaction();

  try {
    // Acquire exclusive lock on the appointment row FIRST
    // This serializes concurrent capture requests for the same appointment
    const appointment = await UserAppointments.findByPk(appointmentId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Authorization: verify user is assigned cleaner or admin/owner
    const requestingUser = await User.findByPk(decoded.userId, { transaction: t });
    if (!requestingUser) {
      await t.rollback();
      return res.status(401).json({ error: "User not found" });
    }

    const isOwnerOrAdmin = requestingUser.type === "owner" || requestingUser.type === "admin";
    const isAssignedCleaner = appointment.employeesAssigned &&
      appointment.employeesAssigned.includes(String(decoded.userId));

    if (!isAssignedCleaner && !isOwnerOrAdmin) {
      await t.rollback();
      return res.status(403).json({ error: "Not authorized to capture payment for this appointment" });
    }

    // Check if appointment is paused or cancelled (after acquiring lock)
    if (appointment.isPaused) {
      await t.rollback();
      return res.status(403).json({ error: "This appointment is currently paused", isPaused: true });
    }
    if (appointment.wasCancelled) {
      await t.rollback();
      return res.status(400).json({ error: "This appointment has been cancelled" });
    }

    if (!appointment.hasBeenAssigned) {
      await t.rollback();
      return res.status(400).json({ error: "Cannot charge without a cleaner assigned" });
    }

    if (!appointment.paymentIntentId) {
      await t.rollback();
      return res.status(400).json({ error: "No payment intent found for this appointment" });
    }

    // Check if already captured (with lock held - prevents race condition)
    if (appointment.paymentStatus === "captured" || appointment.paid === true) {
      await t.rollback();
      return res.status(400).json({ error: "Payment has already been captured" });
    }

    // Check if capture is already in progress (another request got here first)
    if (appointment.paymentStatus === "capture_in_progress") {
      await t.rollback();
      return res.status(409).json({ error: "Payment capture already in progress" });
    }

    // Mark capture as in progress to prevent concurrent capture attempts
    // This provides an additional safety layer even if lock is released
    await appointment.update({
      paymentStatus: "capture_in_progress",
    }, { transaction: t });

    // Commit the "in progress" status before calling Stripe
    // This releases the lock but leaves a marker that capture is happening
    await t.commit();

    // Capture payment via Stripe (external API call - cannot hold DB lock during this)
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.capture(
        appointment.paymentIntentId
      );
    } catch (stripeError) {
      // Stripe capture failed - revert the status
      const tRevert = await sequelize.transaction();
      try {
        await appointment.update({
          paymentStatus: "pending", // Revert to previous status
        }, { transaction: tRevert });
        await tRevert.commit();
      } catch (revertErr) {
        await tRevert.rollback();
        console.error(`Failed to revert capture_in_progress status:`, revertErr);
      }

      console.error("Stripe capture error:", stripeError);
      return res.status(400).json({
        error: "Payment capture failed. Please try again or contact support.",
      });
    }

    // Stripe capture succeeded - update database with final status
    // NOTE: completed is NOT set here - job completion follows the 2-step approval workflow:
    // 1. Cleaner submits completion (completionStatus: "submitted")
    // 2. Homeowner approves OR auto-approval triggers (completed: true + payout)
    const tFinal = await sequelize.transaction();
    try {
      await appointment.update({
        paymentStatus: "captured",
        paid: true,
        // completed is NOT set here - requires completion approval workflow
        amountPaid: paymentIntent.amount_received || paymentIntent.amount
      }, { transaction: tFinal });

      // Clean up any pending requests for this completed appointment
      await UserPendingRequests.destroy({
        where: { appointmentId: appointment.id },
        transaction: tFinal,
      });

      // Record capture transaction in Payment table with full audit trail
      await recordPaymentTransaction({
        type: "capture",
        status: "succeeded",
        amount: paymentIntent.amount_received || paymentIntent.amount,
        userId: appointment.userId,
        appointmentId: appointment.id,
        stripePaymentIntentId: appointment.paymentIntentId,
        stripeChargeId: paymentIntent.latest_charge,
        description: `Payment captured for appointment ${appointment.id}`,
        metadata: {
          capturedBy: decoded.userId,
          capturedByType: requestingUser.type,
          capturedAt: new Date().toISOString(),
        },
        transaction: tFinal,
      });

      await tFinal.commit();
    } catch (dbError) {
      await tFinal.rollback();
      // Critical: Stripe capture succeeded but database update failed
      console.error(`CRITICAL: Stripe capture succeeded for appointment ${appointmentId} but database update failed:`, dbError);
      console.error(`RECONCILIATION DATA: appointmentId=${appointmentId}, paymentIntentId=${appointment.paymentIntentId}, chargeId=${paymentIntent.latest_charge}, amount=${paymentIntent.amount_received || paymentIntent.amount}`);

      // Try to create an emergency audit record for reconciliation
      try {
        await recordPaymentTransaction({
          type: "capture",
          status: "succeeded",
          amount: paymentIntent.amount_received || paymentIntent.amount,
          userId: appointment.userId,
          appointmentId: appointment.id,
          stripePaymentIntentId: appointment.paymentIntentId,
          stripeChargeId: paymentIntent.latest_charge,
          description: `EMERGENCY AUDIT: Capture succeeded but appointment update failed - requires manual reconciliation`,
          metadata: { dbError: dbError.message, requiresReconciliation: true },
        });
        console.log(`Emergency audit record created for appointment ${appointmentId}`);
      } catch (auditError) {
        console.error(`CRITICAL: Failed to create emergency audit record for appointment ${appointmentId}:`, auditError);
      }

      return res.status(500).json({
        error: "Payment captured but database update failed - requires manual reconciliation",
        stripePaymentIntentId: appointment.paymentIntentId,
        captured: true,
      });
    }

    // NOTE: Payouts are NOT processed here at capture time.
    // Payouts are triggered after job completion approval in completionRouter.js:
    // - Homeowner approves the completed job, OR
    // - Auto-approval triggers after 48 hours (CompletionApprovalMonitor)
    // This ensures cleaners are only paid after work is verified.

    return res.json({ success: true, paymentIntent });
  } catch (error) {
    // Rollback transaction if it's still active
    try {
      await t.rollback();
    } catch (rollbackErr) {
      // Transaction may already be committed/rolled back
    }
    console.error("Capture error:", error);
    return res.status(400).json({ error: "Payment capture failed" });
  }
});

/**
 * ------------------------------------------------------
 * Mark Job Complete - 2-Step Completion Flow
 * Called when cleaner marks job as done (payment already captured)
 * Now submits for homeowner approval instead of immediate payout
 * Requires before AND after photos to be uploaded first
 * ------------------------------------------------------
 */
paymentRouter.post("/complete-job", async (req, res) => {
  const { appointmentId, cleanerId, checklistData, hoursWorked, offlineCompletedAt } = req.body;
  const { calculateAutoApprovalExpiration } = require("../../../services/cron/CompletionApprovalMonitor");
  const NotificationService = require("../../../services/NotificationService");
  const { PricingConfig } = require("../../../models");

  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION
  // Only assigned cleaners or owners can mark jobs complete
  // ============================================================================
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const requestingUser = await User.findByPk(decoded.userId);
  if (!requestingUser) {
    return res.status(401).json({ error: "User not found" });
  }

  // Validate appointmentId
  if (!appointmentId) {
    return res.status(400).json({ error: "Appointment ID is required" });
  }

  const appointmentIdInt = parseInt(appointmentId, 10);
  if (isNaN(appointmentIdInt) || appointmentIdInt <= 0) {
    return res.status(400).json({ error: "Invalid appointment ID" });
  }

  try {
    const appointment = await UserAppointments.findByPk(appointmentIdInt);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });

    // Authorization: Must be assigned cleaner or owner
    const isOwner = requestingUser.type === "owner";
    const isAssignedCleaner = appointment.employeesAssigned &&
      (appointment.employeesAssigned.includes(String(decoded.userId)) ||
       appointment.employeesAssigned.includes(decoded.userId));

    // If cleanerId is provided, verify it matches the requesting user (unless owner)
    const effectiveCleanerId = cleanerId || decoded.userId;
    const isRequestingOwnCompletion = String(effectiveCleanerId) === String(decoded.userId);

    if (!isOwner && !isAssignedCleaner) {
      return res.status(403).json({ error: "Not authorized to complete this job" });
    }

    if (!isOwner && !isRequestingOwnCompletion) {
      return res.status(403).json({ error: "Cleaners can only complete their own assignments" });
    }

    // Check if appointment is paused or cancelled
    if (appointment.isPaused) {
      return res.status(403).json({ error: "This appointment is currently paused", isPaused: true });
    }
    if (appointment.wasCancelled) {
      return res.status(400).json({ error: "This appointment has been cancelled" });
    }

    if (!appointment.paid)
      return res.status(400).json({ error: "Payment not yet captured" });

    // Validate early completion timing
    const cleanerIdForValidation = cleanerId || (appointment.employeesAssigned && appointment.employeesAssigned[0]);
    const timingValidation = await validateCompletionTimingForPayment(appointment, cleanerIdForValidation);
    if (!timingValidation.allowed) {
      return res.status(400).json({
        error: timingValidation.message,
        reason: timingValidation.reason,
        timeWindowStarted: timingValidation.timeWindowStarted,
        onSiteLongEnough: timingValidation.onSiteLongEnough,
        jobStartedAt: timingValidation.jobStartedAt,
        windowStartTime: timingValidation.windowStartTime,
      });
    }

    // Check if already submitted or approved
    if (appointment.completionStatus === "submitted") {
      return res.status(400).json({ error: "Completion already submitted. Awaiting homeowner approval." });
    }

    if (appointment.completionStatus === "approved" || appointment.completionStatus === "auto_approved") {
      return res.status(400).json({ error: "Job already approved" });
    }

    if (appointment.completed)
      return res.status(400).json({ error: "Job already marked as complete" });

    // Verify photos have been uploaded
    const cleanerIdToCheck = cleanerId || (appointment.employeesAssigned && appointment.employeesAssigned[0]);

    if (!cleanerIdToCheck) {
      return res.status(400).json({ error: "No cleaner assigned to this job" });
    }

    // Check if this is a business owner completing a job for their client
    // Business owners (preferred cleaners) can skip photo requirements
    const home = await UserHomes.findByPk(appointment.homeId);
    const isBusinessOwner = home && home.preferredCleanerId === parseInt(cleanerIdToCheck, 10);

    const beforePhotos = await JobPhoto.count({
      where: {
        appointmentId,
        cleanerId: cleanerIdToCheck,
        photoType: "before"
      },
    });

    const afterPhotos = await JobPhoto.count({
      where: {
        appointmentId,
        cleanerId: cleanerIdToCheck,
        photoType: "after"
      },
    });

    // Check if photos are required by platform config
    const config = await PricingConfig.getActive();
    const photosRequired = config?.completionRequiresPhotos || false;

    // Only require photos for non-business-owner cleaners (or if platform requires)
    if (!isBusinessOwner || photosRequired) {
      if (beforePhotos === 0) {
        return res.status(400).json({
          error: "Before photos are required to complete the job",
          missingPhotos: "before"
        });
      }

      if (afterPhotos === 0) {
        return res.status(400).json({
          error: "After photos are required to complete the job",
          missingPhotos: "after"
        });
      }
    }

    // Calculate auto-approval expiration
    const autoApprovalExpiresAt = await calculateAutoApprovalExpiration();

    // Submit for approval (don't mark complete yet - that happens after approval)
    await appointment.update({
      completionStatus: "submitted",
      completionSubmittedAt: new Date(),
      completionChecklistData: checklistData || null,
      autoApprovalExpiresAt,
    });

    // Update EmployeeJobAssignment if exists (for offline sync support)
    try {
      const { EmployeeJobAssignment } = require("../../../models");
      const EmployeeJobAssignmentService = require("../../../services/EmployeeJobAssignmentService");
      const { Op } = require("sequelize");

      // Find the employee assignment for this appointment
      const assignment = await EmployeeJobAssignment.findOne({
        where: {
          appointmentId: appointment.id,
          status: { [Op.in]: ["assigned", "started"] },
        },
      });

      if (assignment) {
        const completedAt = offlineCompletedAt ? new Date(offlineCompletedAt) : new Date();
        const updateData = {
          status: "completed",
          completedAt,
        };

        // Calculate hours worked if not provided
        if (hoursWorked && typeof hoursWorked === "number" && hoursWorked > 0) {
          updateData.hoursWorked = hoursWorked;
        } else if (assignment.startedAt) {
          updateData.hoursWorked = EmployeeJobAssignmentService.calculateHoursWorked(
            assignment.startedAt,
            completedAt
          );
        }

        // Calculate pay based on pay type
        const payType = assignment.payType;
        if (payType === "hourly" && updateData.hoursWorked) {
          const hourlyRate = assignment.hourlyRateAtAssignment || 0;
          updateData.payAmount = Math.round(hourlyRate * updateData.hoursWorked);
        }

        await assignment.update(updateData);
        console.log(`[Complete Job] Updated EmployeeJobAssignment ${assignment.id} with hoursWorked: ${updateData.hoursWorked}`);
      }
    } catch (assignmentError) {
      // Don't fail job completion if assignment update fails
      console.error("[Complete Job] Error updating EmployeeJobAssignment:", assignmentError);
    }

    // Send notifications to homeowner about pending approval
    try {
      const homeowner = await User.findByPk(appointment.userId);
      const cleaner = cleanerIdToCheck ? await User.findByPk(cleanerIdToCheck) : null;

      if (homeowner && home) {
        const address = {
          street: EncryptionService.decrypt(home.address),
          city: EncryptionService.decrypt(home.city),
          state: EncryptionService.decrypt(home.state),
          zipcode: EncryptionService.decrypt(home.zipcode),
        };
        const cleanerName = cleaner
          ? EncryptionService.decrypt(cleaner.firstName)
          : "Your Cleaner";
        const homeAddress = `${address.street}, ${address.city}`;
        const hoursUntilAutoApproval = Math.round((autoApprovalExpiresAt - new Date()) / 3600000);

        // In-app notification
        await NotificationService.createNotification({
          userId: homeowner.id,
          type: "completion_submitted",
          title: "Cleaning Complete!",
          body: `${cleanerName} has finished cleaning ${homeAddress}. Please review and approve.`,
          data: { appointmentId: appointment.id },
          actionRequired: true,
          relatedAppointmentId: appointment.id,
        });

        // Send push notification
        if (homeowner.expoPushToken) {
          await PushNotification.sendPushCompletionAwaitingApproval(
            homeowner.expoPushToken,
            appointment.date,
            cleanerName
          );
        }

        // Send email notification
        if (homeowner.email) {
          await Email.sendCompletionSubmittedHomeowner(
            EncryptionService.decrypt(homeowner.email),
            EncryptionService.decrypt(homeowner.firstName),
            appointment.date,
            homeAddress,
            cleanerName,
            hoursUntilAutoApproval
          );
        }

        console.log(`[Complete Job] Submission notifications sent to homeowner ${homeowner.id} for appointment ${appointment.id}`);
      }
    } catch (notificationError) {
      // Don't fail the submission if notifications fail
      console.error("Error sending completion submission notifications:", notificationError);
    }

    // Send notification to business owner if an employee completed this job
    try {
      const { EmployeeJobAssignment, BusinessEmployee } = require("../../../models");

      // Find if there's an employee assignment for this appointment (not a self-assignment)
      const employeeAssignment = await EmployeeJobAssignment.findOne({
        where: {
          appointmentId: appointment.id,
          isSelfAssignment: false,
        },
        include: [{
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "userId"],
          include: [{
            model: User,
            as: "user",
            attributes: ["id", "firstName"],
          }],
        }],
      });

      if (employeeAssignment && employeeAssignment.businessOwnerId) {
        const businessOwner = await User.findByPk(employeeAssignment.businessOwnerId);

        if (businessOwner) {
          const homeowner = await User.findByPk(appointment.userId);
          const employeeName = employeeAssignment.employee?.user?.firstName
            ? EncryptionService.decrypt(employeeAssignment.employee.user.firstName)
            : "Your employee";
          const clientName = homeowner
            ? EncryptionService.decrypt(homeowner.firstName)
            : "your client";
          const homeAddress = home
            ? `${EncryptionService.decrypt(home.address)}, ${EncryptionService.decrypt(home.city)}`
            : "the scheduled location";

          // In-app notification for business owner
          await NotificationService.createNotification({
            userId: businessOwner.id,
            type: "employee_completed_job",
            title: "Employee Completed Job",
            body: `${employeeName} has finished cleaning for ${clientName} at ${homeAddress}.`,
            data: { appointmentId: appointment.id, employeeAssignmentId: employeeAssignment.id },
            relatedAppointmentId: appointment.id,
          });

          // Send push notification to business owner
          if (businessOwner.expoPushToken) {
            await PushNotification.sendPushNotification(
              businessOwner.expoPushToken,
              "Employee Completed Job",
              `${employeeName} has finished cleaning for ${clientName}.`,
              { appointmentId: appointment.id, type: "employee_completed_job" }
            );
          }

          console.log(`[Complete Job] Business owner notification sent to ${businessOwner.id} for employee job completion`);
        }
      }
    } catch (businessNotificationError) {
      // Don't fail the submission if business owner notifications fail
      console.error("Error sending business owner notification:", businessNotificationError);
    }

    return res.json({
      success: true,
      message: "Job submitted for homeowner approval. Payout will be processed after approval.",
      completionStatus: "submitted",
      autoApprovalExpiresAt,
      photosVerified: {
        before: beforePhotos,
        after: afterPhotos
      }
    });
  } catch (error) {
    console.error("Complete job error:", error);
    return res.status(400).json({ error: "Failed to submit job completion" });
  }
});

// Alias for frontend compatibility
paymentRouter.post("/capture", paymentRateLimiter, async (req, res) => {
  const { appointmentId } = req.body;

  // Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Use transaction with row-level locking to prevent race conditions
  const t = await sequelize.transaction();

  try {
    // Fetch appointment with exclusive lock
    const appointment = await UserAppointments.findByPk(appointmentId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Authorization: verify user is assigned cleaner or admin/owner
    const requestingUser = await User.findByPk(decoded.userId, { transaction: t });
    if (!requestingUser) {
      await t.rollback();
      return res.status(401).json({ error: "User not found" });
    }

    const isOwnerOrAdmin = requestingUser.type === "owner" || requestingUser.type === "admin";
    const isAssignedCleaner = appointment.employeesAssigned &&
      appointment.employeesAssigned.includes(String(decoded.userId));

    if (!isAssignedCleaner && !isOwnerOrAdmin) {
      await t.rollback();
      return res.status(403).json({ error: "Not authorized to capture payment for this appointment" });
    }

    // Check if appointment is paused or cancelled
    if (appointment.isPaused) {
      await t.rollback();
      return res.status(403).json({ error: "This appointment is currently paused", isPaused: true });
    }
    if (appointment.wasCancelled) {
      await t.rollback();
      return res.status(400).json({ error: "This appointment has been cancelled" });
    }

    if (!appointment.hasBeenAssigned) {
      await t.rollback();
      return res.status(400).json({ error: "Cannot charge without a cleaner assigned" });
    }

    // If payment is already captured, just mark complete and process payouts
    if (appointment.paid && appointment.paymentStatus === "captured") {
      await appointment.update({ completed: true }, { transaction: t });
      // Clean up any pending requests for this completed appointment
      await UserPendingRequests.destroy({
        where: { appointmentId: appointment.id },
        transaction: t,
      });
      await t.commit();
      const payoutResults = await processCleanerPayouts(appointment);
      return res.json({ success: true, payoutResults });
    }

    // Check if capture is already in progress (another request is processing)
    if (appointment.paymentStatus === "capture_in_progress") {
      await t.rollback();
      return res.status(409).json({ error: "Payment capture already in progress" });
    }

    if (!appointment.paymentIntentId) {
      await t.rollback();
      return res.status(400).json({ error: "No payment intent found for this appointment" });
    }

    // Mark as capture_in_progress to prevent concurrent captures
    await appointment.update({
      paymentStatus: "capture_in_progress",
    }, { transaction: t });
    await t.commit();

    // Perform Stripe capture outside transaction (external API call)
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);
    } catch (stripeError) {
      // Stripe capture failed - revert status
      await appointment.update({ paymentStatus: "pending" });
      console.error("Stripe capture error:", stripeError);
      return res.status(400).json({ error: "Payment capture failed", details: stripeError.message });
    }

    // Update appointment with captured status
    const tFinal = await sequelize.transaction();
    try {
      await appointment.update({
        paymentStatus: "captured",
        paid: true,
        completed: true,
        amountPaid: paymentIntent.amount_received || paymentIntent.amount
      }, { transaction: tFinal });

      // Clean up any pending requests for this completed appointment
      await UserPendingRequests.destroy({
        where: { appointmentId: appointment.id },
        transaction: tFinal,
      });

      // Record capture transaction in Payment table with full audit trail
      await recordPaymentTransaction({
        type: "capture",
        status: "succeeded",
        amount: paymentIntent.amount_received || paymentIntent.amount,
        userId: appointment.userId,
        appointmentId: appointment.id,
        stripePaymentIntentId: appointment.paymentIntentId,
        stripeChargeId: paymentIntent.latest_charge,
        description: `Payment captured for appointment ${appointment.id}`,
        metadata: {
          capturedBy: decoded.userId,
          capturedByType: requestingUser.type,
          capturedAt: new Date().toISOString(),
          endpoint: "/capture",
        },
        transaction: tFinal,
      });

      await tFinal.commit();
    } catch (dbError) {
      await tFinal.rollback();
      // Critical: Stripe capture succeeded but database update failed
      console.error(`CRITICAL: Stripe capture succeeded for appointment ${appointmentId} but database update failed:`, dbError);
      return res.status(500).json({
        error: "Payment captured but database update failed. Please contact support.",
        stripePaymentIntentId: appointment.paymentIntentId,
        captured: true,
      });
    }

    // Process payouts to cleaners (90% of their share)
    const payoutResults = await processCleanerPayouts(appointment);

    return res.json({ success: true, paymentIntent, payoutResults });
  } catch (error) {
    // Rollback transaction if it hasn't been committed
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error("Capture error:", error);
    return res.status(400).json({ error: "Payment capture failed" });
  }
});

/**
 * POST /retry-payment
 * Allows homeowner to manually retry a failed payment capture
 */
paymentRouter.post("/retry-payment", paymentRateLimiter, async (req, res) => {
  const { appointmentId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  // Use transaction with row-level locking to prevent race conditions
  const t = await sequelize.transaction();

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);
    const userId = decoded.userId;

    // Fetch appointment with exclusive lock
    const appointment = await UserAppointments.findByPk(appointmentId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if appointment is paused or cancelled
    if (appointment.isPaused) {
      await t.rollback();
      return res.status(403).json({ error: "This appointment is currently paused", isPaused: true });
    }
    if (appointment.wasCancelled) {
      await t.rollback();
      return res.status(400).json({ error: "This appointment has been cancelled" });
    }

    // Verify user is the homeowner for this appointment
    if (appointment.userId !== userId) {
      await t.rollback();
      return res.status(403).json({ error: "Not authorized to retry payment for this appointment" });
    }

    // Check if payment is already completed
    if (appointment.paid && appointment.paymentStatus === "captured") {
      await t.rollback();
      return res.json({
        success: true,
        message: "Payment already completed",
        alreadyPaid: true
      });
    }

    // Check if capture is already in progress (another request is processing)
    if (appointment.paymentStatus === "capture_in_progress") {
      await t.rollback();
      return res.status(409).json({ error: "Payment capture already in progress" });
    }

    if (!appointment.paymentIntentId) {
      await t.rollback();
      return res.status(400).json({ error: "No payment intent found for this appointment" });
    }

    // Mark as capture_in_progress to prevent concurrent captures
    await appointment.update({
      paymentStatus: "capture_in_progress",
    }, { transaction: t });
    await t.commit();

    // Perform Stripe capture outside transaction (external API call)
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);
    } catch (stripeError) {
      // Stripe capture failed - revert status
      await appointment.update({
        paymentStatus: "pending",
        lastPaymentRetryAt: new Date(),
      });
      console.error("[Retry Payment] Stripe capture failed:", stripeError);
      throw stripeError; // Re-throw to be handled by outer catch
    }

    // Update appointment and payout status in a new transaction
    const tFinal = await sequelize.transaction();
    try {
      await appointment.update({
        paymentStatus: "captured",
        paid: true,
        paymentCaptureFailed: false,
        amountPaid: paymentIntent.amount_received || paymentIntent.amount,
      }, { transaction: tFinal });

      // Update payout records to "held"
      await Payout.update(
        { status: "held", paymentCapturedAt: new Date() },
        { where: { appointmentId: appointment.id }, transaction: tFinal }
      );

      // Record capture transaction
      await recordPaymentTransaction({
        type: "capture",
        status: "succeeded",
        amount: paymentIntent.amount_received || paymentIntent.amount,
        userId: appointment.userId,
        appointmentId: appointment.id,
        stripePaymentIntentId: appointment.paymentIntentId,
        stripeChargeId: paymentIntent.latest_charge,
        description: `Manual payment retry for appointment ${appointment.id}`,
        transaction: tFinal,
      });

      await tFinal.commit();
    } catch (dbError) {
      await tFinal.rollback();
      // Critical: Stripe capture succeeded but database update failed
      console.error(`CRITICAL: Stripe capture succeeded for appointment ${appointmentId} but database update failed:`, dbError);
      return res.status(500).json({
        error: "Payment captured but database update failed. Please contact support.",
        stripePaymentIntentId: appointment.paymentIntentId,
        captured: true,
      });
    }

    console.log(`[Retry Payment] Successfully captured payment for appointment ${appointment.id}`);

    // Notify assigned cleaner(s) that payment issue is resolved
    if (appointment.employeesAssigned && appointment.employeesAssigned.length > 0) {
      const home = await UserHomes.findByPk(appointment.homeId);
      const homeAddress = home
        ? `${EncryptionService.decrypt(home.address)}, ${EncryptionService.decrypt(home.city)}`
        : "the property";

      for (const cleanerId of appointment.employeesAssigned) {
        try {
          const cleaner = await User.findByPk(cleanerId);
          if (cleaner) {
            // In-app notification
            await NotificationService.createNotification({
              userId: cleaner.id,
              type: "payment_retry_success",
              title: "Payment Issue Resolved",
              body: `Good news! The payment issue for the job on ${appointment.date} at ${homeAddress} has been resolved. The job is confirmed.`,
              data: {
                appointmentId: appointment.id,
                date: appointment.date,
              },
              relatedAppointmentId: appointment.id,
            });

            // Push notification
            if (cleaner.expoPushToken) {
              await PushNotification.sendPushNotification(
                cleaner.expoPushToken,
                "Payment Issue Resolved",
                `Job on ${appointment.date} is confirmed - payment resolved!`,
                { appointmentId: appointment.id, type: "payment_retry_success" }
              );
            }
          }
        } catch (notifyErr) {
          console.error(`[Retry Payment] Error notifying cleaner ${cleanerId}:`, notifyErr.message);
        }
      }
    }

    return res.json({
      success: true,
      message: "Payment successful! Your appointment is confirmed.",
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
      }
    });
  } catch (error) {
    // Rollback transaction if it hasn't been committed
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error("[Retry Payment] Error:", error);

    // Check if it's a Stripe error - use generic message to avoid leaking card details
    if (error.type === "StripeCardError" || error.type === "StripeInvalidRequestError") {
      console.error("[Retry Payment] Stripe error details:", error.code, error.decline_code);
      return res.status(400).json({
        error: "Payment failed. Please check your card details or try a different payment method."
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }

    return res.status(500).json({ error: "Failed to process payment. Please try again." });
  }
});

/**
 * ------------------------------------------------------
 * Pre-Pay Endpoint — Allow customers to pay before auto-capture
 * Captures payment early and marks as manually paid
 * ------------------------------------------------------
 */
paymentRouter.post("/pre-pay", paymentRateLimiter, async (req, res) => {
  const { appointmentId } = req.body;
  const authHeader = req.headers.authorization;

  // 1. Auth check
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }
  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    // 2. Find appointment
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // 3. Verify ownership
    if (appointment.userId !== decoded.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // 4. Check not already paid
    if (appointment.paid) {
      return res.status(400).json({ error: "Appointment already paid" });
    }

    // 5. Check cleaner assigned
    if (!appointment.hasBeenAssigned) {
      return res.status(400).json({
        error: "Cannot pre-pay until a cleaner is assigned"
      });
    }

    // 6. Get or create payment intent
    let paymentIntent;

    if (!appointment.paymentIntentId) {
      // Create payment intent if one doesn't exist
      const user = await User.findByPk(appointment.userId);
      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ error: "No payment method on file. Please add a payment method first." });
      }

      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

      if (!defaultPaymentMethod) {
        return res.status(400).json({ error: "No default payment method. Please add a payment method first." });
      }

      const priceInCents = appointment.price; // Already stored in cents

      // Create and immediately capture the payment intent
      paymentIntent = await stripe.paymentIntents.create({
        amount: priceInCents,
        currency: "usd",
        customer: user.stripeCustomerId,
        payment_method: defaultPaymentMethod,
        confirm: true,
        off_session: true,
        metadata: {
          userId: appointment.userId,
          homeId: appointment.homeId,
          appointmentId: appointment.id,
        },
      });

      // Update appointment with payment intent ID
      await appointment.update({
        paymentIntentId: paymentIntent.id,
      });
    } else {
      // 7. Capture existing payment intent via Stripe
      paymentIntent = await stripe.paymentIntents.capture(
        appointment.paymentIntentId
      );
    }

    // 8. Update appointment
    await appointment.update({
      paymentStatus: "captured",
      paid: true,
      manuallyPaid: true,
      paymentCaptureFailed: false,
      amountPaid: paymentIntent.amount_received || paymentIntent.amount,
    });

    // 9. Update Payout records
    await Payout.update(
      { status: "held", paymentCapturedAt: new Date() },
      { where: { appointmentId, status: "pending" } }
    );

    // 10. Record transaction
    await recordPaymentTransaction({
      type: "capture",
      status: "succeeded",
      amount: paymentIntent.amount_received || paymentIntent.amount,
      userId: appointment.userId,
      appointmentId: appointment.id,
      stripePaymentIntentId: appointment.paymentIntentId,
      stripeChargeId: paymentIntent.latest_charge,
      description: `Pre-payment captured for appointment ${appointment.id}`,
    });

    // 11. Clean up any pending requests for this appointment
    await UserPendingRequests.destroy({
      where: { appointmentId: appointment.id },
    });

    return res.json({
      success: true,
      message: "Payment successful! Your appointment is confirmed.",
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
      },
    });
  } catch (error) {
    console.error("Pre-pay error:", error);
    // Use generic message to avoid leaking card details
    if (error.type === "StripeCardError") {
      console.error("[Pre-pay] Stripe card error details:", error.code, error.decline_code);
      return res.status(400).json({ error: "Your card was declined. Please check your card details or try a different payment method." });
    }
    return res.status(400).json({ error: "Payment failed. Please try again." });
  }
});

/**
 * ------------------------------------------------------
 * Pre-Pay Batch Endpoint — Pay multiple appointments at once
 * Allows customers to select and pay for multiple upcoming appointments
 * ------------------------------------------------------
 */
paymentRouter.post("/pre-pay-batch", paymentRateLimiter, async (req, res) => {
  const { appointmentIds } = req.body;
  const authHeader = req.headers.authorization;

  // 1. Auth check
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }
  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // 2. Validate input
  if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
    return res.status(400).json({ error: "No appointments selected" });
  }

  // 3. Limit batch size
  if (appointmentIds.length > 20) {
    return res.status(400).json({ error: "Maximum 20 appointments per batch" });
  }

  const results = {
    successCount: 0,
    failedCount: 0,
    failed: [],
    totalCaptured: 0,
  };

  // 4. Process each appointment
  for (const appointmentId of appointmentIds) {
    try {
      const appointment = await UserAppointments.findByPk(appointmentId);

      if (!appointment) {
        results.failed.push({ id: appointmentId, error: "Not found" });
        results.failedCount++;
        continue;
      }

      if (appointment.userId !== decoded.userId) {
        results.failed.push({ id: appointmentId, error: "Not authorized" });
        results.failedCount++;
        continue;
      }

      if (appointment.paid) {
        results.failed.push({ id: appointmentId, error: "Already paid" });
        results.failedCount++;
        continue;
      }

      if (!appointment.hasBeenAssigned) {
        results.failed.push({ id: appointmentId, error: "No cleaner assigned" });
        results.failedCount++;
        continue;
      }

      if (!appointment.paymentIntentId) {
        results.failed.push({ id: appointmentId, error: "No payment on file" });
        results.failedCount++;
        continue;
      }

      // Capture payment via Stripe
      const paymentIntent = await stripe.paymentIntents.capture(
        appointment.paymentIntentId
      );

      if (paymentIntent.status === "succeeded") {
        // Update appointment
        await appointment.update({
          paymentStatus: "captured",
          paid: true,
          manuallyPaid: true,
          paymentCaptureFailed: false,
          amountPaid: paymentIntent.amount_received || paymentIntent.amount,
        });

        // Update Payout records
        await Payout.update(
          { status: "held", paymentCapturedAt: new Date() },
          { where: { appointmentId, status: "pending" } }
        );

        // Record transaction
        await recordPaymentTransaction({
          type: "capture",
          status: "succeeded",
          amount: paymentIntent.amount_received || paymentIntent.amount,
          userId: appointment.userId,
          appointmentId: appointment.id,
          stripePaymentIntentId: appointment.paymentIntentId,
          stripeChargeId: paymentIntent.latest_charge,
          description: `Batch pre-payment captured for appointment ${appointment.id}`,
        });

        // Clean up pending requests
        await UserPendingRequests.destroy({
          where: { appointmentId: appointment.id },
        });

        results.successCount++;
        results.totalCaptured += paymentIntent.amount;
      } else {
        results.failed.push({ id: appointmentId, error: "Capture failed" });
        results.failedCount++;
      }
    } catch (err) {
      console.error(`Batch pre-pay error for appointment ${appointmentId}:`, err);
      // Use generic message to avoid leaking card details
      if (err.type === "StripeCardError") {
        console.error(`[Batch Pre-pay] Stripe card error details:`, err.code, err.decline_code);
      }
      results.failed.push({
        id: appointmentId,
        error: "Payment failed"
      });
      results.failedCount++;
    }
  }

  // 5. Return results
  if (results.successCount === 0) {
    return res.status(400).json({
      error: "All payments failed",
      details: results.failed,
    });
  }

  return res.status(200).json({
    success: true,
    message: `${results.successCount} payment(s) captured successfully`,
    ...results,
  });
});

/**
 * ------------------------------------------------------
 * 5️⃣ Daily Scheduler — Charge 3 Days Before Appointment
 * Payment is captured and held until job completion
 * ------------------------------------------------------
 */

// Extracted function for testing
async function runDailyPaymentCheck() {
  console.log("Running daily payment check (3-day trigger)...");

  const now = new Date();

  try {
    // ============================================================
    // PART 1: Send unassigned appointment warnings (3 days before)
    // ============================================================
    const unassignedAppointments = await UserAppointments.findAll({
      where: {
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        isDemoAppointment: false, // Don't send real notifications for demo appointments
      },
    });

    for (const appointment of unassignedAppointments) {
      const appointmentDate = new Date(appointment.date);
      const diffInDays = Math.floor(
        (appointmentDate - now) / (1000 * 60 * 60 * 24)
      );

      // Send warning 3 days before (or less, if not already sent)
      if (diffInDays <= 3 && diffInDays >= 0) {
        try {
          const user = await User.findByPk(appointment.userId);
          const home = await UserHomes.findByPk(appointment.homeId);
          if (!user || !home) continue;

          // Send email notification
          const homeAddress = {
            street: EncryptionService.decrypt(home.address),
            city: EncryptionService.decrypt(home.city),
            state: EncryptionService.decrypt(home.state),
            zipcode: EncryptionService.decrypt(home.zipcode),
          };
          await Email.sendUnassignedAppointmentWarning(
            EncryptionService.decrypt(user.email),
            homeAddress,
            EncryptionService.decrypt(user.firstName),
            appointmentDate
          );

          // Send push notification
          if (user.expoPushToken) {
            await PushNotification.sendPushUnassignedWarning(
              user.expoPushToken,
              EncryptionService.decrypt(user.firstName),
              appointmentDate,
              homeAddress
            );
          }

          // Add in-app notification
          const notifications = user.notifications || [];
          const formattedDate = appointmentDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const decryptedAddress = EncryptionService.decrypt(home.address);
          notifications.unshift(
            `Heads up! Your cleaning on ${formattedDate} at ${decryptedAddress} doesn't have a cleaner assigned yet. There's still time for one to pick it up, but you may want to have a backup plan.`
          );
          await user.update({ notifications: notifications.slice(0, 50) });

          // Mark warning as sent
          await appointment.update({ unassignedWarningSent: true });

          console.log(`[Cron] Unassigned warning sent for appointment ${appointment.id} to ${user.email}`);
        } catch (err) {
          console.error(`[Cron] Failed to send unassigned warning for appointment ${appointment.id}:`, err);
        }
      }
    }

    // ============================================================
    // PART 2: Payment processing (existing logic)
    // ============================================================
    // Find appointments with pending payments that have a paymentIntentId
    const appointments = await UserAppointments.findAll({
      where: {
        paymentStatus: "pending",
        paid: false,
      },
    });

    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.date);
      const diffInDays = Math.floor(
        (appointmentDate - now) / (1000 * 60 * 60 * 24)
      );

      // Only act 3 days before the appointment (changed from 2)
      if (diffInDays <= 3 && diffInDays >= 0) {
        const user = await User.findByPk(appointment.userId);
        const home = await UserHomes.findByPk(appointment.homeId);
        if (!user || !home) continue;

        // Check for pending edge case decision on multi-cleaner jobs
        const multiCleanerJob = await MultiCleanerJob.findOne({
          where: { appointmentId: appointment.id },
        });
        if (multiCleanerJob && multiCleanerJob.hasEdgeCaseDecisionPending()) {
          console.log(
            `[Cron] Skipping payment capture for appointment ${appointment.id} - awaiting edge case homeowner decision`
          );
          continue;
        }

        if (appointment.hasBeenAssigned) {
          // Capture payment if cleaner assigned - money is now held by the platform
          try {
            let paymentIntent;

            if (!appointment.paymentIntentId) {
              // No payment intent exists - create and capture a new one
              console.log(`Creating payment intent for appointment ${appointment.id} (cleaner assigned but no payment intent)`);

              const customer = await stripe.customers.retrieve(user.stripeCustomerId);
              const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

              if (!defaultPaymentMethod) {
                console.error(`No payment method on file for user ${user.id}, appointment ${appointment.id}`);
                await appointment.update({
                  paymentCaptureFailed: true,
                  paymentFirstFailedAt: new Date(),
                  paymentRetryCount: 0,
                });
                // Send initial payment failure notification
                try {
                  await notifyInitialPaymentFailure(appointment);
                } catch (notifyErr) {
                  console.error("Failed to send payment failure notification:", notifyErr.message);
                }
                continue;
              }

              const priceInCents = appointment.price; // Already stored in cents

              paymentIntent = await stripe.paymentIntents.create({
                amount: priceInCents,
                currency: "usd",
                customer: user.stripeCustomerId,
                payment_method: defaultPaymentMethod,
                confirm: true,
                off_session: true,
                metadata: {
                  userId: appointment.userId,
                  homeId: appointment.homeId,
                  appointmentId: appointment.id,
                },
              });

              await appointment.update({ paymentIntentId: paymentIntent.id });
            } else {
              // Existing payment intent - capture it
              paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);
            }

            await appointment.update({
              paymentStatus: "captured",
              paid: true,
              amountPaid: paymentIntent.amount_received || paymentIntent.amount
            });
            console.log(`Payment captured for appointment ${appointment.id} - funds held`);

            // Record capture in Payment table
            await recordPaymentTransaction({
              type: "capture",
              status: "succeeded",
              amount: paymentIntent.amount_received || paymentIntent.amount,
              userId: appointment.userId,
              appointmentId: appointment.id,
              stripePaymentIntentId: appointment.paymentIntentId,
              stripeChargeId: paymentIntent.latest_charge,
              description: `Scheduled payment capture for appointment ${appointment.id}`,
            });

            // Update payout records to "held" status
            const cleanerIds = appointment.employeesAssigned || [];
            for (const cleanerId of cleanerIds) {
              const payout = await Payout.findOne({
                where: { appointmentId: appointment.id, cleanerId }
              });
              if (payout) {
                await payout.update({
                  status: "held",
                  paymentCapturedAt: new Date()
                });
              }
            }

            // Notify homeowner that payment was captured
            try {
              let cleanerName = "your cleaner";
              if (cleanerIds.length > 0) {
                const cleaner = await User.findByPk(cleanerIds[0], {
                  attributes: ["firstName"]
                });
                if (cleaner && cleaner.firstName) {
                  cleanerName = EncryptionService.decrypt(cleaner.firstName);
                }
              }

              await NotificationService.notifyPaymentCaptured({
                userId: appointment.userId,
                amount: paymentIntent.amount_received || paymentIntent.amount,
                appointmentDate,
                appointmentId: appointment.id,
                cleanerName,
                io: null
              });
              console.log(`Payment notification sent to user ${appointment.userId}`);
            } catch (notifyErr) {
              console.error("Failed to send payment captured notification:", notifyErr.message);
            }
          } catch (err) {
            console.error("Stripe capture failed:", err.message);
            // Mark as failed and initialize retry tracking
            await appointment.update({
              paymentCaptureFailed: true,
              paymentFirstFailedAt: new Date(),
              paymentRetryCount: 0,
            });
            // Send initial payment failure notification
            try {
              await notifyInitialPaymentFailure(appointment);
            } catch (notifyErr) {
              console.error("Failed to send payment failure notification:", notifyErr.message);
            }
          }
        } else if (appointment.paymentIntentId && diffInDays <= 1) {
          // No cleaner assigned and we're 1 day out — cancel payment & notify client
          try {
            await stripe.paymentIntents.cancel(appointment.paymentIntentId);
            await appointment.update({ paymentStatus: "cancelled" });

            // Clean up any pending requests for this appointment
            await UserPendingRequests.destroy({
              where: { appointmentId: appointment.id },
            });

            // Record cancellation in Payment table
            await recordPaymentTransaction({
              type: "authorization",
              status: "canceled",
              amount: 0, // Unknown at this point
              userId: appointment.userId,
              appointmentId: appointment.id,
              stripePaymentIntentId: appointment.paymentIntentId,
              description: `Scheduled cancellation - no cleaner assigned for appointment ${appointment.id}`,
            });

            const cancelAddress = {
              street: EncryptionService.decrypt(home.address),
              city: EncryptionService.decrypt(home.city),
              state: EncryptionService.decrypt(home.state),
              zipcode: EncryptionService.decrypt(home.zipcode),
            };

            // Send email notification
            await Email.sendEmailCancellation(
              EncryptionService.decrypt(user.email),
              cancelAddress,
              EncryptionService.decrypt(user.firstName),
              appointmentDate
            );

            // Send push notification
            if (user.expoPushToken) {
              await PushNotification.sendPushCancellation(
                user.expoPushToken,
                EncryptionService.decrypt(user.firstName),
                appointmentDate,
                cancelAddress
              );
            }

            // Add in-app notification
            const formattedDate = appointmentDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const notifications = user.notifications || [];
            notifications.unshift(
              `Your cleaning appointment for ${formattedDate} at ${cancelAddress.street} has been cancelled because no cleaner was available. You have not been charged.`
            );
            await user.update({ notifications: notifications.slice(0, 50) });

            console.log(
              `Appointment ${appointment.id} cancelled — user notified via email, push, and in-app (${user.email})`
            );
          } catch (err) {
            console.error(
              "Failed to cancel appointment or send notifications:",
              err
            );
          }
        }
      }
    }

    // ============================================================
    // PART 3: Notify homeowners about failed payment captures
    // ============================================================
    const failedCaptureAppointments = await UserAppointments.findAll({
      where: {
        paymentCaptureFailed: true,
        paymentStatus: "pending",
        paid: false,
        completed: false,
      },
    });

    for (const appointment of failedCaptureAppointments) {
      const appointmentDate = new Date(appointment.date);
      const diffInDays = Math.floor(
        (appointmentDate - now) / (1000 * 60 * 60 * 24)
      );

      // Cancel if 1 day or less and still not paid
      if (diffInDays <= 1) {
        try {
          // Cancel the appointment
          if (appointment.paymentIntentId) {
            await stripe.paymentIntents.cancel(appointment.paymentIntentId);
          }
          await appointment.update({
            paymentStatus: "cancelled",
            paymentCaptureFailed: false,
          });

          // Clean up any pending requests for this appointment
          await UserPendingRequests.destroy({
            where: { appointmentId: appointment.id },
          });

          const user = await User.findByPk(appointment.userId);
          const home = await UserHomes.findByPk(appointment.homeId);
          if (!user || !home) continue;

          const cancelAddress = {
            street: EncryptionService.decrypt(home.address),
            city: EncryptionService.decrypt(home.city),
            state: EncryptionService.decrypt(home.state),
            zipcode: EncryptionService.decrypt(home.zipcode),
          };

          // Send cancellation email
          await Email.sendEmailCancellation(
            EncryptionService.decrypt(user.email),
            cancelAddress,
            EncryptionService.decrypt(user.firstName),
            appointmentDate
          );

          // Send push notification
          if (user.expoPushToken) {
            await PushNotification.sendPushCancellation(
              user.expoPushToken,
              EncryptionService.decrypt(user.firstName),
              appointmentDate,
              cancelAddress
            );
          }

          // Add in-app notification
          const formattedDate = appointmentDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const notifications = user.notifications || [];
          notifications.unshift(
            `Your cleaning appointment for ${formattedDate} at ${cancelAddress.street} has been cancelled due to payment failure. Please rebook when ready.`
          );
          await user.update({ notifications: notifications.slice(0, 50) });

          console.log(
            `[Cron] Appointment ${appointment.id} cancelled due to payment failure — user notified (${user.email})`
          );
        } catch (err) {
          console.error(
            `[Cron] Failed to cancel appointment ${appointment.id} with payment failure:`,
            err
          );
        }
      } else {
        // More than 1 day out - send daily reminder to fix payment
        try {
          const user = await User.findByPk(appointment.userId);
          const home = await UserHomes.findByPk(appointment.homeId);
          if (!user || !home) continue;

          const homeAddress = {
            street: EncryptionService.decrypt(home.address),
            city: EncryptionService.decrypt(home.city),
            state: EncryptionService.decrypt(home.state),
            zipcode: EncryptionService.decrypt(home.zipcode),
          };

          const formattedDate = appointmentDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          // Send email about payment failure
          await Email.sendPaymentFailedReminder(
            EncryptionService.decrypt(user.email),
            EncryptionService.decrypt(user.firstName),
            homeAddress,
            appointmentDate,
            diffInDays
          );

          // Send push notification
          if (user.expoPushToken) {
            await PushNotification.sendPushPaymentFailed(
              user.expoPushToken,
              EncryptionService.decrypt(user.firstName),
              formattedDate,
              diffInDays
            );
          }

          // Add in-app notification
          const notifications = user.notifications || [];
          notifications.unshift(
            `Payment failed for your cleaning on ${formattedDate} at ${homeAddress.street}. Your appointment will be cancelled in ${diffInDays} day${diffInDays !== 1 ? "s" : ""} if payment is not completed. Please log in and retry payment.`
          );
          await user.update({ notifications: notifications.slice(0, 50) });

          console.log(
            `[Cron] Payment failure reminder sent for appointment ${appointment.id} to ${user.email} (${diffInDays} days remaining)`
          );
        } catch (err) {
          console.error(
            `[Cron] Failed to send payment failure reminder for appointment ${appointment.id}:`,
            err
          );
        }
      }
    }
  } catch (err) {
    console.error("Cron job error:", err);
  }
}

// Schedule the cron job to run daily at 7 AM
cron.schedule("0 7 * * *", runDailyPaymentCheck);

/**
 * Test endpoint to manually trigger the daily payment check
 * Only available in development/test environments
 */
paymentRouter.post("/run-daily-check", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;

    // Verify user is an owner
    const user = await User.findByPk(userId);
    if (!user || user.type !== "owner") {
      return res.status(403).json({ error: "Owner access required" });
    }

    console.log(`[Manual Trigger] Daily payment check triggered by owner ${userId}`);
    await runDailyPaymentCheck();

    return res.json({ success: true, message: "Daily payment check completed" });
  } catch (error) {
    console.error("[Manual Trigger] Error:", error);
    return res.status(500).json({ error: "Failed to run daily check" });
  }
});

/**
 * ------------------------------------------------------
 * Home Size Adjustment Auto-Escalation Cron Job
 * Runs hourly to escalate expired adjustment requests to owners
 * ------------------------------------------------------
 */
cron.schedule("0 * * * *", async () => {
  console.log("[Cron] Running home size adjustment expiration check...");

  try {
    const { Op } = require("sequelize");
    const now = new Date();

    // Find expired pending requests
    const expiredRequests = await HomeSizeAdjustmentRequest.findAll({
      where: {
        status: "pending_homeowner",
        expiresAt: { [Op.lte]: now },
      },
      include: [
        { model: UserHomes, as: "home" },
        { model: User, as: "cleaner" },
        { model: User, as: "homeowner" },
      ],
    });

    if (expiredRequests.length === 0) {
      console.log("[Cron] No expired adjustment requests found.");
      return;
    }

    console.log(`[Cron] Found ${expiredRequests.length} expired adjustment request(s)`);

    // Get all owners
    const owners = await User.findAll({
      where: { role: "owner" },
    });

    for (const request of expiredRequests) {
      try {
        // Update status to expired (which triggers owner review)
        await request.update({ status: "expired" });

        // Notify all owners
        for (const owner of owners) {
          // Send email notification (use notificationEmail if set, otherwise main email)
          const ownerNotificationEmail = owner.getNotificationEmail();
          if (ownerNotificationEmail) {
            const homeAddress = request.home
              ? `${EncryptionService.decrypt(request.home.address)}, ${EncryptionService.decrypt(request.home.city)}`
              : "Unknown address";
            await Email.sendAdjustmentNeedsOwnerReview(
              ownerNotificationEmail,
              owner.firstName,
              request.id,
              request.cleaner?.firstName || "Cleaner",
              request.homeowner?.firstName || "Homeowner",
              homeAddress
            );
          }

          // Send push notification
          if (owner.expoPushToken) {
            await PushNotification.sendPushAdjustmentNeedsReview(
              owner.expoPushToken,
              request.id
            );
          }

          // Add in-app notification
          const notifications = owner.notifications || [];
          notifications.unshift(
            `Home size adjustment request #${request.id} has expired and needs your review.`
          );
          await owner.update({ notifications: notifications.slice(0, 50) });
        }

        console.log(`[Cron] Escalated request ${request.id} to owners`);
      } catch (err) {
        console.error(`[Cron] Failed to escalate request ${request.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Cron] Home size adjustment expiration check error:", err);
  }
});

// ============================================================
// CRON JOB: Daily Supply Reminder (7:00 AM)
// Sends push notifications to cleaners with appointments today
// Reminds them to bring: toilet paper, paper towels, trash bags
// ============================================================
cron.schedule("0 7 * * *", async () => {
  console.log("[Cron] Running daily supply reminder...");

  const today = new Date();
  const todayString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

  try {
    // Find all appointments for today that have assigned cleaners
    const todaysAppointments = await UserAppointments.findAll({
      where: {
        date: todayString,
        hasBeenAssigned: true,
        completed: false,
      },
      include: [{ model: UserHomes, as: "home" }],
    });

    console.log(
      `[Cron] Found ${todaysAppointments.length} appointments for today`
    );

    for (const appointment of todaysAppointments) {
      // Get assigned cleaners from employeesAssigned array
      const cleanerIds = appointment.employeesAssigned || [];

      for (const cleanerId of cleanerIds) {
        try {
          const cleaner = await User.findByPk(cleanerId);
          if (!cleaner || !cleaner.expoPushToken) continue;

          // Check if cleaner has snoozed supply reminders
          if (cleaner.supplyReminderSnoozedUntil) {
            const snoozeEnd = new Date(cleaner.supplyReminderSnoozedUntil);
            if (snoozeEnd > new Date()) {
              console.log(
                `[Cron] Supply reminder skipped for cleaner ${cleanerId} (snoozed until ${snoozeEnd.toISOString()})`
              );
              continue;
            }
          }

          const home = appointment.home;
          if (!home) continue;

          const address = {
            street: EncryptionService.decrypt(home.address),
            city: EncryptionService.decrypt(home.city),
          };

          await PushNotification.sendPushSupplyReminder(
            cleaner.expoPushToken,
            EncryptionService.decrypt(cleaner.firstName),
            appointment.date,
            address
          );

          console.log(
            `[Cron] Supply reminder sent to cleaner ${cleanerId}`
          );
        } catch (cleanerError) {
          console.error(
            `[Cron] Failed to send reminder to cleaner ${cleanerId}:`,
            cleanerError
          );
        }
      }
    }

    console.log("[Cron] Daily supply reminder complete");
  } catch (error) {
    console.error("[Cron] Error in supply reminder job:", error);
  }
});

// ============================================================
// CRON JOB: Daily Review Reminder (9:00 AM)
// Sends push notifications and emails to homeowners with
// completed appointments that haven't been reviewed yet
// ============================================================
cron.schedule("0 9 * * *", async () => {
  console.log("[Cron] Running daily review reminder...");

  try {
    const { Op } = require("sequelize");

    // Find all homeowners with completed appointments that haven't been reviewed
    const pendingReviewAppointments = await UserAppointments.findAll({
      where: {
        completed: true,
        hasClientReview: { [Op.or]: [false, null] },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "firstName", "email", "expoPushToken"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "nickName", "address", "city", "state", "zipcode"],
        },
      ],
    });

    if (pendingReviewAppointments.length === 0) {
      console.log("[Cron] No pending reviews found");
      return;
    }

    // Group appointments by user
    const userAppointments = {};
    for (const appointment of pendingReviewAppointments) {
      if (!appointment.user) continue;
      const userId = appointment.user.id;
      if (!userAppointments[userId]) {
        userAppointments[userId] = {
          user: appointment.user,
          appointments: [],
        };
      }
      userAppointments[userId].appointments.push({
        id: appointment.id,
        date: appointment.date,
        homeName: appointment.home?.nickName || appointment.home?.address || "Your Home",
        address: appointment.home?.address || "",
      });
    }

    // Send notifications to each user
    for (const userId in userAppointments) {
      const { user, appointments } = userAppointments[userId];
      const pendingCount = appointments.length;

      try {
        // Send push notification
        if (user.expoPushToken) {
          await PushNotification.sendPushReviewReminder(
            user.expoPushToken,
            user.username || user.firstName,
            pendingCount
          );
          console.log(`[Cron] Review reminder push sent to user ${userId}`);
        }

        // Send email notification
        if (user.email) {
          await Email.sendReviewReminderNotification(
            EncryptionService.decrypt(user.email),
            user.username || EncryptionService.decrypt(user.firstName),
            appointments
          );
          console.log(`[Cron] Review reminder email sent to user ${userId}`);
        }
      } catch (userError) {
        console.error(`[Cron] Failed to send review reminder to user ${userId}:`, userError);
      }
    }

    console.log(`[Cron] Daily review reminder complete. Notified ${Object.keys(userAppointments).length} users`);
  } catch (error) {
    console.error("[Cron] Error in review reminder job:", error);
  }
});

/**
 * Test endpoint to manually trigger the review reminder
 * Only available in development/test environments
 */
paymentRouter.post("/run-review-reminder", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  try {
    const { Op } = require("sequelize");

    // Find all homeowners with completed appointments that haven't been reviewed
    const pendingReviewAppointments = await UserAppointments.findAll({
      where: {
        completed: true,
        hasClientReview: { [Op.or]: [false, null] },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "firstName", "email", "expoPushToken"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "nickName", "address", "city", "state", "zipcode"],
        },
      ],
    });

    // Group appointments by user
    const userAppointments = {};
    for (const appointment of pendingReviewAppointments) {
      if (!appointment.user) continue;
      const userId = appointment.user.id;
      if (!userAppointments[userId]) {
        userAppointments[userId] = {
          user: appointment.user,
          appointments: [],
        };
      }
      userAppointments[userId].appointments.push({
        id: appointment.id,
        date: appointment.date,
        homeName: appointment.home?.nickName || appointment.home?.address || "Your Home",
        address: appointment.home?.address || "",
      });
    }

    // Send notifications to each user
    let notifiedCount = 0;
    for (const userId in userAppointments) {
      const { user, appointments } = userAppointments[userId];
      const pendingCount = appointments.length;

      try {
        if (user.expoPushToken) {
          await PushNotification.sendPushReviewReminder(
            user.expoPushToken,
            user.username || EncryptionService.decrypt(user.firstName),
            pendingCount
          );
        }
        if (user.email) {
          await Email.sendReviewReminderNotification(
            EncryptionService.decrypt(user.email),
            user.username || EncryptionService.decrypt(user.firstName),
            appointments
          );
        }
        notifiedCount++;
      } catch (err) {
        console.error(`Failed to notify user ${userId}:`, err);
      }
    }

    return res.json({
      success: true,
      message: `Review reminder sent to ${notifiedCount} users`,
      totalPendingReviews: pendingReviewAppointments.length,
    });
  } catch (error) {
    console.error("Manual review reminder error:", error);
    return res.status(500).json({ error: "Failed to run review reminder" });
  }
});

/**
 * ------------------------------------------------------
 * 6️⃣ Cancel or Refund Payment
 * Includes payout reversal when cleaners have already been paid
 * IMPORTANT: Only owners can cancel/refund payments
 * ------------------------------------------------------
 */
const handleCancelOrRefund = async (req, res) => {
  const { appointmentId, skipPayoutReversal = false } = req.body;
  const { Op } = require("sequelize");

  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION
  // Only owners can cancel/refund payments to prevent unauthorized refunds
  // ============================================================================
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const requestingUser = await User.findByPk(decoded.userId);
  if (!requestingUser) {
    return res.status(401).json({ error: "User not found" });
  }

  // Only owners can process refunds/cancellations
  if (requestingUser.type !== "owner") {
    return res.status(403).json({ error: "Only owners can cancel or refund payments" });
  }

  // Validate appointmentId
  if (!appointmentId) {
    return res.status(400).json({ error: "Appointment ID is required" });
  }

  const appointmentIdInt = parseInt(appointmentId, 10);
  if (isNaN(appointmentIdInt) || appointmentIdInt <= 0) {
    return res.status(400).json({ error: "Invalid appointment ID" });
  }

  // Use transaction with row-level locking to prevent race conditions
  const t = await sequelize.transaction();

  try {
    // Fetch appointment with exclusive lock
    const appointment = await UserAppointments.findByPk(appointmentIdInt, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if already refunded/cancelled (with lock held)
    if (appointment.paymentStatus === "refunded" || appointment.paymentStatus === "cancelled") {
      await t.rollback();
      return res.status(400).json({ error: "Payment already refunded or cancelled" });
    }

    if (!appointment.paymentIntentId) {
      await t.rollback();
      return res.status(400).json({ error: "No payment intent found for this appointment" });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      appointment.paymentIntentId
    );

    let result;
    let payoutReversalResults = [];

    if (paymentIntent.status === "requires_capture") {
      // Mark as in-progress, commit lock, then cancel
      await appointment.update({ paymentStatus: "cancellation_in_progress" }, { transaction: t });
      await t.commit();

      result = await stripe.paymentIntents.cancel(paymentIntent.id);
      await appointment.update({ paymentStatus: "cancelled" });

      // Clean up any pending requests for this appointment
      await UserPendingRequests.destroy({
        where: { appointmentId: appointment.id },
      });

      // Record cancellation - update authorization status
      await recordPaymentTransaction({
        type: "authorization",
        status: "canceled",
        amount: paymentIntent.amount,
        userId: appointment.userId,
        appointmentId: appointment.id,
        stripePaymentIntentId: appointment.paymentIntentId,
        description: `Payment authorization cancelled for appointment ${appointment.id}`,
      });

      // Update any pending payouts to cancelled
      await Payout.update(
        { status: "cancelled", completedAt: new Date() },
        { where: { appointmentId: appointment.id, status: { [Op.in]: ["pending", "processing"] } } }
      );

    } else if (paymentIntent.status === "succeeded") {
      // Fetch completed payouts WITH exclusive lock to prevent concurrent reversals
      const completedPayouts = await Payout.findAll({
        where: {
          appointmentId: appointment.id,
          status: "completed",
          stripeTransferId: { [Op.ne]: null },
        },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      // Mark appointment as refund in progress and release lock
      await appointment.update({ paymentStatus: "refund_in_progress" }, { transaction: t });
      await t.commit();

      // Reverse payouts if any exist and skipPayoutReversal is not set
      let allReversalsSucceeded = true;

      if (completedPayouts.length > 0 && !skipPayoutReversal) {
        console.log(`[Refund] Found ${completedPayouts.length} completed payouts to reverse for appointment ${appointmentId}`);

        for (const payout of completedPayouts) {
          // Skip if already being reversed or reversed
          if (payout.status === "reversed" || payout.reversalId) {
            payoutReversalResults.push({
              cleanerId: payout.cleanerId,
              status: "already_reversed",
            });
            continue;
          }

          try {
            // Create Stripe transfer reversal with idempotency key
            const idempotencyKey = `reversal-${appointment.id}-${payout.id}-${Date.now()}`;
            const reversal = await stripe.transfers.createReversal(
              payout.stripeTransferId,
              {
                amount: payout.netAmount, // Reverse the full amount paid to cleaner
                metadata: {
                  appointmentId: appointmentId.toString(),
                  cleanerId: payout.cleanerId.toString(),
                  payoutId: payout.id.toString(),
                  reason: "customer_refund",
                },
              },
              { idempotencyKey }
            );

            // Update payout record
            const tPayout = await sequelize.transaction();
            try {
              await payout.update({
                status: "reversed",
                reversalId: reversal.id,
                reversedAt: new Date(),
                reversalReason: "customer_refund",
              }, { transaction: tPayout });

              // Record reversal transaction
              // CRITICAL: throwOnError ensures tax-reportable reversal is recorded
              await recordPaymentTransaction({
                type: "payout_reversal",
                status: "succeeded",
                amount: payout.netAmount,
                cleanerId: payout.cleanerId,
                appointmentId: appointment.id,
                payoutId: payout.id,
                stripeTransferId: payout.stripeTransferId,
                description: `Payout reversal for appointment ${appointment.id} due to customer refund`,
                metadata: {
                  reversalId: reversal.id,
                  originalTransferId: payout.stripeTransferId,
                  grossAmount: payout.grossAmount,
                  platformFee: payout.platformFee,
                },
                transaction: tPayout,
                throwOnError: true, // Tax-reportable transaction must be recorded
              });

              await tPayout.commit();

              payoutReversalResults.push({
                cleanerId: payout.cleanerId,
                status: "reversed",
                reversalId: reversal.id,
                amountReversed: payout.netAmount,
              });

              console.log(`[Refund] Successfully reversed payout ${payout.id} for cleaner ${payout.cleanerId}`);
            } catch (dbError) {
              await tPayout.rollback();
              console.error(`[Refund] Failed to update payout record after reversal:`, dbError);
              console.error(`RECONCILIATION DATA: payoutId=${payout.id}, reversalId=${reversal.id}, cleanerId=${payout.cleanerId}`);
              // Reversal succeeded in Stripe, so we count this as success but flag for reconciliation
              payoutReversalResults.push({
                cleanerId: payout.cleanerId,
                status: "reversed_db_error",
                reversalId: reversal.id,
                error: "Reversal succeeded but database update failed - requires reconciliation",
              });
            }
          } catch (reversalError) {
            console.error(`[Refund] Failed to reverse payout ${payout.id}:`, reversalError);

            // Check if it's because the transfer was already reversed
            if (reversalError.code === "transfer_reversed" || reversalError.message?.includes("already been reversed")) {
              await payout.update({
                status: "reversed",
                reversedAt: new Date(),
                reversalReason: "already_reversed",
              });
              payoutReversalResults.push({
                cleanerId: payout.cleanerId,
                status: "already_reversed",
              });
            } else {
              allReversalsSucceeded = false;
              payoutReversalResults.push({
                cleanerId: payout.cleanerId,
                status: "reversal_failed",
                error: reversalError.message,
              });
            }
          }
        }
      } else if (completedPayouts.length > 0 && skipPayoutReversal) {
        console.log(`[Refund] Skipping payout reversal for ${completedPayouts.length} payouts (skipPayoutReversal=true)`);
        payoutReversalResults = completedPayouts.map(p => ({
          cleanerId: p.cleanerId,
          status: "skipped",
          reason: "skipPayoutReversal flag set",
        }));
      }

      // Only proceed with customer refund if all payout reversals succeeded (or were skipped/already reversed)
      const failedReversals = payoutReversalResults.filter(r => r.status === "reversal_failed");
      if (failedReversals.length > 0 && !skipPayoutReversal) {
        // Revert appointment status since we can't complete the refund
        await appointment.update({ paymentStatus: "captured" });
        console.error(`[Refund] Aborting customer refund - ${failedReversals.length} payout reversals failed`);
        return res.status(400).json({
          error: "Cannot process refund - some payout reversals failed",
          message: "Cleaner payouts could not be reversed. Please resolve manually before issuing customer refund.",
          payoutReversals: payoutReversalResults,
        });
      }

      // Create the customer refund
      result = await stripe.refunds.create({
        payment_intent: paymentIntent.id,
      });
      await appointment.update({ paymentStatus: "refunded", paid: false });

      // Clean up any pending requests for this appointment
      await UserPendingRequests.destroy({
        where: { appointmentId: appointment.id },
      });

      // Record refund transaction
      await recordPaymentTransaction({
        type: "refund",
        status: "succeeded",
        amount: result.amount,
        userId: appointment.userId,
        appointmentId: appointment.id,
        stripePaymentIntentId: appointment.paymentIntentId,
        stripeRefundId: result.id,
        description: `Refund processed for appointment ${appointment.id}`,
        metadata: {
          payoutReversals: payoutReversalResults.length,
          payoutsReversedSuccessfully: payoutReversalResults.filter(r => r.status === "reversed" || r.status === "already_reversed").length,
        },
      });
    } else {
      await t.rollback();
      return res
        .status(400)
        .json({ error: "Cannot cancel or refund this payment" });
    }

    console.log(`Appointment ${appointmentId} ${appointment.paymentStatus}`);
    return res.json({
      success: true,
      result,
      payoutReversals: payoutReversalResults.length > 0 ? payoutReversalResults : undefined,
    });
  } catch (error) {
    // Rollback transaction if it hasn't been committed
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error("Cancel/refund error:", error);
    return res.status(400).json({ error: "Refund or cancellation failed" });
  }
};

paymentRouter.post("/cancel-or-refund", strictPaymentLimiter, handleCancelOrRefund);
paymentRouter.post("/refund", strictPaymentLimiter, handleCancelOrRefund);

/**
 * ------------------------------------------------------
 * 7️⃣ Stripe Webhook — Handle Payment Events
 * With idempotency/deduplication to prevent duplicate processing
 * ------------------------------------------------------
 */
paymentRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    // Validate webhook secret is configured
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("[PaymentWebhook] CRITICAL: STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({
        error: "Webhook secret not configured",
        code: "WEBHOOK_SECRET_MISSING",
      });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("[PaymentWebhook] Signature verification failed");
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }

    // Validate event timestamp to prevent replay attacks (reject events older than 5 minutes)
    const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000; // 5 minutes
    const eventAgeMs = Date.now() - (event.created * 1000);
    if (eventAgeMs > MAX_WEBHOOK_AGE_MS) {
      console.warn(`[PaymentWebhook] Rejected stale event ${event.id} (age: ${Math.round(eventAgeMs / 1000)}s)`);
      return res.status(400).json({ error: "Event too old", code: "STALE_EVENT" });
    }

    // Attempt to claim this event for processing (prevents duplicate processing)
    const webhookRecord = await StripeWebhookEvent.claimEvent(event, "payments");
    if (!webhookRecord) {
      // Event already processed or being processed
      console.log(`[PaymentWebhook] Event ${event.id} already processed, skipping`);
      return res.json({ received: true, duplicate: true });
    }

    try {
      let relatedEntityType = null;
      let relatedEntityId = null;

      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          console.log(`[PaymentWebhook] PaymentIntent succeeded: ${paymentIntent.id}`);

          // Use transaction with row-level locking to prevent race conditions
          await sequelize.transaction(async (t) => {
            const appointment = await UserAppointments.findOne({
              where: { paymentIntentId: paymentIntent.id },
              lock: t.LOCK.UPDATE,
              transaction: t,
            });

            if (appointment) {
              // Only update if not already in succeeded state (idempotent)
              if (appointment.paymentStatus !== "succeeded") {
                await appointment.update({
                  paymentStatus: "succeeded",
                  paid: true,
                  amountPaid: paymentIntent.amount,
                }, { transaction: t });
              }
              relatedEntityType = "appointment";
              relatedEntityId = appointment.id;
            }
          });
          break;
        }

        case "payment_intent.payment_failed": {
          const failedIntent = event.data.object;
          console.error(`[PaymentWebhook] Payment failed: ${failedIntent.id}`);

          await sequelize.transaction(async (t) => {
            const failedAppointment = await UserAppointments.findOne({
              where: { paymentIntentId: failedIntent.id },
              lock: t.LOCK.UPDATE,
              transaction: t,
            });

            if (failedAppointment) {
              // Only update if not already marked as failed
              if (failedAppointment.paymentStatus !== "failed") {
                await failedAppointment.update({
                  paymentStatus: "failed",
                }, { transaction: t });
              }
              relatedEntityType = "appointment";
              relatedEntityId = failedAppointment.id;
            }
          });
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object;
          console.log(`[PaymentWebhook] Charge refunded: ${charge.payment_intent}`);

          await sequelize.transaction(async (t) => {
            const refundedAppointment = await UserAppointments.findOne({
              where: { paymentIntentId: charge.payment_intent },
              lock: t.LOCK.UPDATE,
              transaction: t,
            });

            if (refundedAppointment) {
              // Check if fully refunded
              const isFullRefund = charge.amount_refunded >= charge.amount;
              if (isFullRefund) {
                await refundedAppointment.update({
                  paymentStatus: "refunded",
                  paid: false,
                }, { transaction: t });
              } else {
                // Partial refund - keep as paid but update refund amount
                await refundedAppointment.update({
                  refundAmount: (refundedAppointment.refundAmount || 0) + charge.amount_refunded,
                }, { transaction: t });
              }
              relatedEntityType = "appointment";
              relatedEntityId = refundedAppointment.id;
            }
          });
          break;
        }

        default:
          console.log(`[PaymentWebhook] Unhandled event type: ${event.type}`);
          await StripeWebhookEvent.markSkipped(event.id, `Unhandled event type: ${event.type}`);
          return res.json({ received: true });
      }

      // Mark event as successfully processed
      await StripeWebhookEvent.markCompleted(event.id, relatedEntityType, relatedEntityId);
      res.json({ received: true });

    } catch (err) {
      console.error(`[PaymentWebhook] Error processing event ${event.id}:`, err);
      await StripeWebhookEvent.markFailed(event.id, err.message);
      // Still return 200 to prevent Stripe from retrying indefinitely
      // The error is logged and can be investigated
      res.json({ received: true, error: true });
    }
  }
);

/**
 * ------------------------------------------------------
 * Process partial payout for multi-cleaner job
 * Used when a cleaner completes their portion of a job
 * ------------------------------------------------------
 */
paymentRouter.post("/multi-cleaner/partial-payout", payoutRateLimiter, async (req, res) => {
  const { appointmentId, cleanerId } = req.body;

  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION
  // Only assigned cleaners (for their own payout) or owners can trigger payouts
  // ============================================================================
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const requestingUser = await User.findByPk(decoded.userId);
  if (!requestingUser) {
    return res.status(401).json({ error: "User not found" });
  }

  // Validate cleanerId
  if (!cleanerId) {
    return res.status(400).json({ error: "Cleaner ID is required" });
  }

  const cleanerIdInt = parseInt(cleanerId, 10);
  if (isNaN(cleanerIdInt) || cleanerIdInt <= 0) {
    return res.status(400).json({ error: "Invalid cleaner ID" });
  }

  // Authorization: Must be owner OR the cleaner requesting their own payout
  const isOwner = requestingUser.type === "owner";
  const isOwnPayout = decoded.userId === cleanerIdInt;

  if (!isOwner && !isOwnPayout) {
    return res.status(403).json({ error: "Not authorized to process this payout" });
  }

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (!appointment.isMultiCleanerJob || !appointment.multiCleanerJobId) {
      return res.status(400).json({ error: "This is not a multi-cleaner job" });
    }

    const multiCleanerJob = await MultiCleanerJob.findByPk(appointment.multiCleanerJobId);
    if (!multiCleanerJob) {
      return res.status(404).json({ error: "Multi-cleaner job not found" });
    }

    // Find the cleaner's completion record
    const completion = await CleanerJobCompletion.findOne({
      where: {
        multiCleanerJobId: multiCleanerJob.id,
        cleanerId,
      },
    });

    if (!completion || completion.status !== "completed") {
      return res.status(400).json({
        error: "Cleaner has not completed their portion of the job",
      });
    }

    // Check if already paid
    const existingPayout = await Payout.findOne({
      where: {
        appointmentId,
        cleanerId,
        multiCleanerJobId: multiCleanerJob.id,
        status: "completed",
      },
    });

    if (existingPayout) {
      return res.status(400).json({ error: "Cleaner has already been paid for this job" });
    }

    // Get room assignments for this cleaner
    const roomAssignments = await CleanerRoomAssignment.findAll({
      where: {
        multiCleanerJobId: multiCleanerJob.id,
        cleanerId,
      },
    });

    // Calculate this cleaner's earnings
    const home = await UserHomes.findByPk(appointment.homeId);
    const totalPriceCents = await MultiCleanerPricingService.calculateTotalJobPrice(
      home,
      appointment,
      multiCleanerJob.totalCleanersRequired
    );

    const allAssignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId: multiCleanerJob.id },
    });

    const earningsBreakdown = await MultiCleanerPricingService.calculatePerCleanerEarnings(
      totalPriceCents,
      multiCleanerJob.totalCleanersRequired,
      allAssignments
    );

    const cleanerEarning = earningsBreakdown.cleanerEarnings.find(
      (e) => String(e.cleanerId) === String(cleanerId)
    );

    if (!cleanerEarning) {
      return res.status(400).json({ error: "Could not calculate cleaner earnings" });
    }

    // Get Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: cleanerId },
    });

    if (!connectAccount || !connectAccount.payoutsEnabled) {
      return res.status(400).json({
        error: "Cleaner has not completed Stripe onboarding",
      });
    }

    // Get charge ID
    let chargeId = null;
    if (appointment.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
        chargeId = paymentIntent.latest_charge;
      } catch (err) {
        console.error(`Could not retrieve payment intent:`, err.message);
      }
    }

    // Create payout record
    const payout = await Payout.create({
      appointmentId,
      cleanerId,
      multiCleanerJobId: multiCleanerJob.id,
      grossAmount: cleanerEarning.grossAmount,
      platformFee: cleanerEarning.platformFee,
      netAmount: cleanerEarning.netAmount,
      isPartialPayout: true,
      status: "processing",
      paymentCapturedAt: new Date(),
      transferInitiatedAt: new Date(),
    });

    // Create Stripe Transfer
    const transferParams = {
      amount: cleanerEarning.netAmount,
      currency: "usd",
      destination: connectAccount.stripeAccountId,
      metadata: {
        appointmentId: appointmentId.toString(),
        cleanerId: cleanerId.toString(),
        payoutId: payout.id.toString(),
        multiCleanerJobId: multiCleanerJob.id.toString(),
        isPartialPayout: "true",
        percentOfWork: cleanerEarning.percentOfWork.toString(),
      },
    };

    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }

    // Use idempotency key to prevent duplicate transfers on retry
    const idempotencyKey = `transfer-partial-${appointmentId}-${cleanerId}-${payout.id}`;
    const transfer = await stripe.transfers.create(transferParams, { idempotencyKey });

    await payout.update({
      stripeTransferId: transfer.id,
      status: "completed",
      completedAt: new Date(),
    });

    await completion.update({ payoutId: payout.id });

    // Record transaction
    await recordPaymentTransaction({
      type: "payout",
      status: "succeeded",
      amount: cleanerEarning.netAmount,
      cleanerId,
      appointmentId,
      payoutId: payout.id,
      stripeTransferId: transfer.id,
      platformFeeAmount: cleanerEarning.platformFee,
      netAmount: cleanerEarning.netAmount,
      description: `Partial multi-cleaner payout (${cleanerEarning.percentOfWork}% of work)`,
      metadata: {
        multiCleanerJobId: multiCleanerJob.id,
        percentOfWork: cleanerEarning.percentOfWork,
        isPartial: true,
      },
    });

    return res.json({
      success: true,
      payout: {
        id: payout.id,
        netAmount: cleanerEarning.netAmount,
        percentOfWork: cleanerEarning.percentOfWork,
        transferId: transfer.id,
      },
    });
  } catch (error) {
    console.error("[Partial Payout] Error:", error);
    return res.status(500).json({ error: "Failed to process partial payout" });
  }
});

/**
 * ------------------------------------------------------
 * Process solo completion payout
 * Used when one cleaner takes over the full job after dropout
 * ------------------------------------------------------
 */
paymentRouter.post("/multi-cleaner/solo-completion-payout", payoutRateLimiter, async (req, res) => {
  const { appointmentId, cleanerId } = req.body;

  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION
  // Only assigned cleaners (for their own payout) or owners can trigger payouts
  // ============================================================================
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const requestingUser = await User.findByPk(decoded.userId);
  if (!requestingUser) {
    return res.status(401).json({ error: "User not found" });
  }

  // Validate cleanerId
  if (!cleanerId) {
    return res.status(400).json({ error: "Cleaner ID is required" });
  }

  const cleanerIdInt = parseInt(cleanerId, 10);
  if (isNaN(cleanerIdInt) || cleanerIdInt <= 0) {
    return res.status(400).json({ error: "Invalid cleaner ID" });
  }

  // Authorization: Must be owner OR the cleaner requesting their own payout
  const isOwner = requestingUser.type === "owner";
  const isOwnPayout = decoded.userId === cleanerIdInt;

  if (!isOwner && !isOwnPayout) {
    return res.status(403).json({ error: "Not authorized to process this payout" });
  }

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (!appointment.isMultiCleanerJob || !appointment.multiCleanerJobId) {
      return res.status(400).json({ error: "This is not a multi-cleaner job" });
    }

    const multiCleanerJob = await MultiCleanerJob.findByPk(appointment.multiCleanerJobId);
    if (!multiCleanerJob) {
      return res.status(404).json({ error: "Multi-cleaner job not found" });
    }

    // Check for existing payout
    const existingPayout = await Payout.findOne({
      where: {
        appointmentId,
        cleanerId,
        status: "completed",
      },
    });

    if (existingPayout) {
      return res.status(400).json({ error: "Cleaner has already been paid for this job" });
    }

    // Calculate solo completion earnings (full amount minus platform fee)
    const soloEarnings = await MultiCleanerPricingService.calculateSoloCompletionEarnings(appointmentId);

    // Get Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: cleanerId },
    });

    if (!connectAccount || !connectAccount.payoutsEnabled) {
      return res.status(400).json({
        error: "Cleaner has not completed Stripe onboarding",
      });
    }

    // Get charge ID
    let chargeId = null;
    if (appointment.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
        chargeId = paymentIntent.latest_charge;
      } catch (err) {
        console.error(`Could not retrieve payment intent:`, err.message);
      }
    }

    const pricing = await getPricingConfig();
    const platformFeePercent = pricing.platform.feePercent || 0.10;
    const home = await UserHomes.findByPk(appointment.homeId);
    const totalPriceCents = await MultiCleanerPricingService.calculateTotalJobPrice(
      home,
      appointment,
      1
    );
    const platformFee = Math.round(totalPriceCents * platformFeePercent);

    // Create payout record
    const payout = await Payout.create({
      appointmentId,
      cleanerId,
      multiCleanerJobId: multiCleanerJob.id,
      grossAmount: totalPriceCents,
      platformFee,
      netAmount: soloEarnings,
      originalGrossAmount: totalPriceCents,
      adjustmentReason: "Solo completion of multi-cleaner job",
      isPartialPayout: false,
      status: "processing",
      paymentCapturedAt: new Date(),
      transferInitiatedAt: new Date(),
    });

    // Create Stripe Transfer
    const transferParams = {
      amount: soloEarnings,
      currency: "usd",
      destination: connectAccount.stripeAccountId,
      metadata: {
        appointmentId: appointmentId.toString(),
        cleanerId: cleanerId.toString(),
        payoutId: payout.id.toString(),
        multiCleanerJobId: multiCleanerJob.id.toString(),
        isSoloCompletion: "true",
      },
    };

    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }

    // Use idempotency key to prevent duplicate transfers on retry
    const idempotencyKey = `transfer-solo-${appointmentId}-${cleanerId}-${payout.id}`;
    const transfer = await stripe.transfers.create(transferParams, { idempotencyKey });

    await payout.update({
      stripeTransferId: transfer.id,
      status: "completed",
      completedAt: new Date(),
    });

    // Update multi-cleaner job status
    await multiCleanerJob.update({ status: "completed" });

    // Mark appointment as completed
    await appointment.update({ completed: true });

    // Record transaction
    await recordPaymentTransaction({
      type: "payout",
      status: "succeeded",
      amount: soloEarnings,
      cleanerId,
      appointmentId,
      payoutId: payout.id,
      stripeTransferId: transfer.id,
      platformFeeAmount: platformFee,
      netAmount: soloEarnings,
      description: `Solo completion payout for multi-cleaner job ${multiCleanerJob.id}`,
      metadata: {
        multiCleanerJobId: multiCleanerJob.id,
        originalCleanersRequired: multiCleanerJob.totalCleanersRequired,
        isSoloCompletion: true,
      },
    });

    return res.json({
      success: true,
      payout: {
        id: payout.id,
        netAmount: soloEarnings,
        netAmountFormatted: `$${(soloEarnings / 100).toFixed(2)}`,
        transferId: transfer.id,
        isSoloCompletion: true,
      },
    });
  } catch (error) {
    console.error("[Solo Completion Payout] Error:", error);
    return res.status(500).json({ error: "Failed to process solo completion payout" });
  }
});

/**
 * ------------------------------------------------------
 * Get earnings breakdown for a multi-cleaner job
 * ------------------------------------------------------
 */
paymentRouter.get("/multi-cleaner/earnings/:multiCleanerJobId", async (req, res) => {
  const { multiCleanerJobId } = req.params;
  const jobIdInt = parseInt(multiCleanerJobId, 10);

  // Validate jobId is a valid integer
  if (isNaN(jobIdInt) || jobIdInt <= 0) {
    return res.status(400).json({ error: "Invalid job ID" });
  }

  // Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    // Check authorization: user must be involved in the job or admin/owner
    const requestingUser = await User.findByPk(decoded.userId);
    if (!requestingUser) {
      return res.status(401).json({ error: "User not found" });
    }

    // Get the appointment to check authorization
    const appointment = await UserAppointments.findByPk(jobIdInt);
    if (!appointment) {
      return res.status(404).json({ error: "Job not found" });
    }

    const isOwnerOrAdmin = requestingUser.type === "owner" || requestingUser.type === "admin";
    const isHomeowner = appointment.userId === decoded.userId;
    const isAssignedCleaner = appointment.employeesAssigned &&
      appointment.employeesAssigned.includes(String(decoded.userId));

    if (!isHomeowner && !isAssignedCleaner && !isOwnerOrAdmin) {
      return res.status(403).json({ error: "Not authorized to view earnings for this job" });
    }

    const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(jobIdInt);

    return res.json({ breakdown });
  } catch (error) {
    console.error("[Earnings Breakdown] Error:", error);
    return res.status(500).json({ error: "Failed to get earnings breakdown" });
  }
});

/**
 * ------------------------------------------------------
 * Get Appointments for a Specific Home (MUST BE LAST - catch-all route)
 * ------------------------------------------------------
 */
paymentRouter.get("/:homeId", async (req, res) => {
  const { homeId } = req.params;
  const homeIdInt = parseInt(homeId, 10);

  // Validate homeId is a valid integer
  if (isNaN(homeIdInt) || homeIdInt <= 0) {
    return res.status(400).json({ error: "Invalid home ID" });
  }

  // Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, secretKey);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    // Check authorization: user must own the home or be admin/owner
    const requestingUser = await User.findByPk(decoded.userId);
    if (!requestingUser) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check if user owns this home
    const home = await UserHomes.findByPk(homeIdInt);
    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    const isOwnerOrAdmin = requestingUser.type === "owner" || requestingUser.type === "admin";
    const isHomeOwner = home.userId === decoded.userId;

    if (!isHomeOwner && !isOwnerOrAdmin) {
      return res.status(403).json({ error: "Not authorized to view appointments for this home" });
    }

    const appointments = await UserAppointments.findAll({ where: { homeId: homeIdInt } });
    const serializedAppointments =
      AppointmentSerializer.serializeArray(appointments);
    return res.status(200).json({ appointments: serializedAppointments });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Unable to fetch appointments" });
  }
});

module.exports = paymentRouter;
module.exports.recordPaymentTransaction = recordPaymentTransaction;
module.exports.runDailyPaymentCheck = runDailyPaymentCheck;

// const user = await User.findByPk(userId, {
// 	include: [
// 		{
// 			model: UserHomes,
// 			as: "homes",
// 		},
// 		{
// 			model: UserAppointments,
// 			as: "appointments",
// 		},
// 	],
// });

// const home = await UserHomes.findByPk(homeId, {
// 	include: [
// 		{
// 			model: User,
// 			as: "user",
// 		},
// 		{
// 			model: UserAppointments,
// 			as: "appointments",
// 		},
// 	],
// });
