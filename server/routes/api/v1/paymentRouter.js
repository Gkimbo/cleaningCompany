// ------------------------------------------------------
// Payment Router — Handles Stripe payments and scheduling
// ------------------------------------------------------

const express = require("express");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cron = require("node-cron");
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
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const { getPricingConfig } = require("../../../config/businessConfig");

const paymentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// ============================================================================
// HELPER: Record payment transaction in database
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
}) {
  try {
    const taxYear = new Date().getFullYear();
    const isReportable = type === "payout" && status === "succeeded";

    const payment = await Payment.create({
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
    });

    return payment;
  } catch (error) {
    console.error("[Payment] Failed to record transaction:", error);
    // Don't throw - we don't want to fail the main operation
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
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  console.log("Stripe publishable key loaded:", key ? `${key.substring(0, 12)}...${key.substring(key.length - 4)}` : "NOT SET");
  console.log("Key length:", key ? key.length : 0);
  res.json({
    publishableKey: key,
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

  try {
    const appointments = await UserAppointments.findAll({
      where: { userId },
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

  try {
    // Get platform fee from database
    const pricing = await getPricingConfig();
    const platformFeePercent = pricing.platform.feePercent;

    // First try to get earnings from Payout records (more accurate)
    const payouts = await Payout.findAll({
      where: { cleanerId: employeeId },
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
        totalEarnings: totalEarnings.toFixed(2),
        pendingEarnings: pendingEarnings.toFixed(2),
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

    // Calculate with dynamic cleaner percentage from database
    const totalEarnings = employeeAppointments.reduce((total, appt) => {
      const price = parseFloat(appt.price) || 0;
      const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
      const grossPerCleaner = price / employeeCount;
      const netPerCleaner = grossPerCleaner * (1 - platformFeePercent);
      return total + netPerCleaner;
    }, 0);

    const pendingEarnings = await UserAppointments.findAll({
      where: {
        paid: true,
        completed: false,
        hasBeenAssigned: true,
      },
    }).then((appts) =>
      appts
        .filter((appt) => appt.employeesAssigned && appt.employeesAssigned.includes(employeeId))
        .reduce((total, appt) => {
          const price = parseFloat(appt.price) || 0;
          const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
          const grossPerCleaner = price / employeeCount;
          const netPerCleaner = grossPerCleaner * (1 - platformFeePercent);
          return total + netPerCleaner;
        }, 0)
    );

    return res.json({
      totalEarnings: totalEarnings.toFixed(2),
      pendingEarnings: pendingEarnings.toFixed(2),
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

    console.log(`[Payment] Fetching payment methods for user ${userId}, stripeCustomerId: ${user.stripeCustomerId}`);

    let paymentMethods = [];
    let hasValidPaymentMethod = user.hasPaymentMethod;

    // If user has a Stripe customer ID, verify payment methods exist
    if (user.stripeCustomerId) {
      try {
        const methods = await stripe.paymentMethods.list({
          customer: user.stripeCustomerId,
          type: "card",
        });
        console.log(`[Payment] Found ${methods.data.length} payment methods for customer ${user.stripeCustomerId}`);

        paymentMethods = methods.data.map((pm) => ({
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }));
        hasValidPaymentMethod = methods.data.length > 0;

        // Update user if status changed
        if (user.hasPaymentMethod !== hasValidPaymentMethod) {
          console.log(`[Payment] Updating user ${userId} hasPaymentMethod: ${user.hasPaymentMethod} -> ${hasValidPaymentMethod}`);
          await user.update({ hasPaymentMethod: hasValidPaymentMethod });
        }
      } catch (stripeError) {
        console.error("Error fetching payment methods from Stripe:", stripeError);
      }
    } else {
      console.log(`[Payment] User ${userId} has no stripeCustomerId`);
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
 * 4️⃣ Get Appointments for a Specific Home
 * ------------------------------------------------------
 */
paymentRouter.get("/:homeId", async (req, res) => {
  const { homeId } = req.params;
  try {
    const appointments = await UserAppointments.findAll({ where: { homeId } });
    const serializedAppointments =
      AppointmentSerializer.serializeArray(appointments);
    return res.status(200).json({ appointments: serializedAppointments });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Unable to fetch appointments" });
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
  const { token } = req.body;

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Create or get Stripe Customer
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
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
  const { token, successUrl, cancelUrl } = req.body;

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Create or get Stripe Customer
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
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
  const { token, sessionId } = req.body;

  try {
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
  const { token, setupIntentId } = req.body;

  try {
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
          price: parseFloat(apt.price) || 0,
          daysUntil,
          isWithinCancellationWindow,
          cancellationFee: isWithinCancellationWindow ? cancellationFeeAmount : 0,
          hasCleanerAssigned: apt.hasBeenAssigned && apt.employeesAssigned?.length > 0,
          paymentIntentId: apt.paymentIntentId,
          paymentStatus: apt.paymentStatus,
        };
      });

    // Calculate totals
    const totalToPrepay = unpaidAppointmentDetails.reduce((sum, apt) => sum + apt.price, 0);
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
      totalToPrepay,
      totalCancellationFees,
      options: canRemove ? null : {
        canPrepayAll: hasUnpaidAppointments && totalToPrepay > 0,
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
paymentRouter.delete("/payment-method/:paymentMethodId", async (req, res) => {
  const { paymentMethodId } = req.params;
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

    // Check current payment methods count
    const methods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

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
paymentRouter.post("/prepay-all-and-remove", async (req, res) => {
  const { paymentMethodId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  if (!paymentMethodId) {
    return res.status(400).json({ error: "Payment method ID required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Step 1: Pay any outstanding fees first
    const userBill = await UserBills.findOne({ where: { userId } });
    const outstandingTotal = Number(userBill?.totalDue) || 0;

    if (outstandingTotal > 0) {
      console.log(`[Prepay & Remove] Paying outstanding fees: $${outstandingTotal}`);

      const feePaymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(outstandingTotal * 100),
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
          // No payment intent - create and capture a new one
          const price = parseFloat(appointment.price) || 0;
          const amountCents = Math.round(price * 100);

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
                amount: price,
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
    return res.status(500).json({ error: error.message || "Failed to process prepayment" });
  }
});

/**
 * Cancel all appointments and remove payment method
 * Used when client wants to cancel all booked appointments before removing their card
 * Cancellation fees apply for appointments within 7 days
 */
paymentRouter.post("/cancel-all-and-remove", async (req, res) => {
  const { paymentMethodId, acknowledgedCancellationFees } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  if (!paymentMethodId) {
    return res.status(400).json({ error: "Payment method ID required" });
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
    if (newTotalDue > 0) {
      console.log(`[Cancel & Remove] Paying total fees: $${newTotalDue}`);

      const feePaymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(newTotalDue * 100),
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
    return res.status(500).json({ error: error.message || "Failed to process cancellation" });
  }
});

/**
 * ------------------------------------------------------
 * 2️⃣ Create Payment Intent (Authorize Only)
 * Used when booking an appointment
 * ------------------------------------------------------
 */
paymentRouter.post("/create-payment-intent", async (req, res) => {
  const { token, homeId, amount, appointmentDate } = req.body;

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const home = await UserHomes.findByPk(homeId);
    if (!home) return res.status(404).json({ error: "Home not found" });

    // Create Stripe payment intent (authorization only)
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: "usd",
      capture_method: "manual",
      metadata: { userId, homeId },
    });

    // Create appointment in DB
    const appointment = await UserAppointments.create({
      userId,
      homeId,
      amount: amount / 100,
      appointmentDate,
      status: "pending",
      paymentIntentId: paymentIntent.id,
    });

    // Record authorization in Payment table
    await recordPaymentTransaction({
      type: "authorization",
      status: "pending",
      amount,
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
 * Used by React Native Bill.js (no JWT)
 * ------------------------------------------------------
 */
paymentRouter.post("/create-intent", async (req, res) => {
  const { amount, email } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
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
paymentRouter.post("/pay-bill", async (req, res) => {
  console.log("[Pay Bill] Request received:", { amount: req.body.amount });

  const { amount } = req.body; // amount in cents
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[Pay Bill] No authorization header");
    return res.status(401).json({ error: "Authorization required" });
  }

  if (!amount || amount <= 0) {
    console.log("[Pay Bill] Invalid amount:", amount);
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;
    console.log("[Pay Bill] User ID:", userId, "Amount (cents):", amount);

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

    // Handle Stripe card errors
    if (error.type === "StripeCardError") {
      return res.status(400).json({ error: error.message || "Your card was declined." });
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

    // Find the user's bill
    const bill = await UserBills.findOne({ where: { userId } });
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // Amount is in cents from frontend, convert to dollars for bill (stored in dollars)
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
 * Helper: Process payouts to cleaners after job completion
 * Records all transactions in Payment table for tax reporting
 * ------------------------------------------------------
 */
async function processCleanerPayouts(appointment) {
  const cleanerIds = appointment.employeesAssigned || [];
  const results = [];

  // Get platform fee from database
  const pricing = await getPricingConfig();
  const platformFeePercent = pricing.platform.feePercent;

  for (const cleanerId of cleanerIds) {
    try {
      // Get or create payout record
      let payout = await Payout.findOne({
        where: { appointmentId: appointment.id, cleanerId }
      });

      if (payout && payout.status === "completed") {
        results.push({ cleanerId, status: "already_paid" });
        continue;
      }

      // Get cleaner's Stripe Connect account
      const connectAccount = await StripeConnectAccount.findOne({
        where: { userId: cleanerId }
      });

      if (!connectAccount || !connectAccount.payoutsEnabled) {
        results.push({
          cleanerId,
          status: "skipped",
          reason: "Cleaner has not completed Stripe onboarding"
        });
        continue;
      }

      // Calculate amounts using database pricing
      const priceInCents = Math.round(parseFloat(appointment.price) * 100);
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
        });
      } else {
        await payout.update({
          grossAmount: perCleanerGross,
          platformFee,
          netAmount,
          status: "processing",
          transferInitiatedAt: new Date(),
        });
      }

      // Get the charge ID from the payment intent to use as source_transaction
      // This links the transfer to the original customer payment
      let chargeId = null;
      if (appointment.paymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
          chargeId = paymentIntent.latest_charge;
        } catch (err) {
          console.error(`Could not retrieve payment intent ${appointment.paymentIntentId}:`, err.message);
        }
      }

      // Create Stripe Transfer to cleaner
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

      // Use source_transaction if we have the charge ID
      // This links the transfer to the specific charge, ensuring funds are available
      if (chargeId) {
        transferParams.source_transaction = chargeId;
      }

      const transfer = await stripe.transfers.create(transferParams);

      await payout.update({
        stripeTransferId: transfer.id,
        status: "completed",
        completedAt: new Date(),
      });

      // Record payout transaction in Payment table (for 1099 reporting)
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
      });

      results.push({
        cleanerId,
        status: "success",
        transferId: transfer.id,
        amountCents: netAmount,
      });
    } catch (error) {
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
 * ------------------------------------------------------
 */
paymentRouter.post("/capture-payment", async (req, res) => {
  const { appointmentId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });

    if (!appointment.hasBeenAssigned)
      return res.status(400).json({ error: "Cannot charge without a cleaner assigned" });

    if (!appointment.paymentIntentId)
      return res.status(400).json({ error: "No payment intent found for this appointment" });

    const paymentIntent = await stripe.paymentIntents.capture(
      appointment.paymentIntentId
    );

    await appointment.update({
      paymentStatus: "captured",
      paid: true,
      completed: true,
      amountPaid: paymentIntent.amount_received || paymentIntent.amount
    });

    // Clean up any pending requests for this completed appointment
    await UserPendingRequests.destroy({
      where: { appointmentId: appointment.id },
    });

    // Record capture transaction in Payment table
    await recordPaymentTransaction({
      type: "capture",
      status: "succeeded",
      amount: paymentIntent.amount_received || paymentIntent.amount,
      userId: appointment.userId,
      appointmentId: appointment.id,
      stripePaymentIntentId: appointment.paymentIntentId,
      stripeChargeId: paymentIntent.latest_charge,
      description: `Payment captured for appointment ${appointment.id}`,
    });

    // Process payouts to cleaners (90% of their share)
    const payoutResults = await processCleanerPayouts(appointment);

    return res.json({ success: true, paymentIntent, payoutResults });
  } catch (error) {
    console.error("Capture error:", error);
    return res.status(400).json({ error: "Payment capture failed" });
  }
});

/**
 * ------------------------------------------------------
 * Mark Job Complete & Process Payouts
 * Called when cleaner marks job as done (payment already captured)
 * Requires before AND after photos to be uploaded first
 * ------------------------------------------------------
 */
paymentRouter.post("/complete-job", async (req, res) => {
  const { appointmentId, cleanerId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });

    if (!appointment.paid)
      return res.status(400).json({ error: "Payment not yet captured" });

    if (appointment.completed)
      return res.status(400).json({ error: "Job already marked as complete" });

    // Verify photos have been uploaded
    const cleanerIdToCheck = cleanerId || (appointment.employeesAssigned && appointment.employeesAssigned[0]);

    if (!cleanerIdToCheck) {
      return res.status(400).json({ error: "No cleaner assigned to this job" });
    }

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

    // Mark as completed
    await appointment.update({ completed: true });

    // Clean up any pending requests for this completed appointment
    await UserPendingRequests.destroy({
      where: { appointmentId: appointment.id },
    });

    // Process payouts to cleaners (90% of their share)
    const payoutResults = await processCleanerPayouts(appointment);

    // Send completion notifications to homeowner
    try {
      const homeowner = await User.findByPk(appointment.userId);
      const home = await UserHomes.findByPk(appointment.homeId);
      const cleanerIdForNotification = cleanerId || (appointment.employeesAssigned && appointment.employeesAssigned[0]);
      const cleaner = cleanerIdForNotification ? await User.findByPk(cleanerIdForNotification) : null;

      if (homeowner && home) {
        const address = {
          street: home.address,
          city: home.city,
          state: home.state,
          zipcode: home.zipcode,
        };
        const cleanerName = cleaner?.username || "Your Cleaner";

        // Send push notification
        if (homeowner.expoPushToken) {
          await PushNotification.sendPushCleaningCompleted(
            homeowner.expoPushToken,
            homeowner.username || homeowner.firstName,
            appointment.date,
            address
          );
        }

        // Send email notification
        if (homeowner.email) {
          await Email.sendCleaningCompletedNotification(
            homeowner.email,
            homeowner.username || homeowner.firstName,
            address,
            appointment.date,
            cleanerName
          );
        }

        console.log(`[Complete Job] Notifications sent to homeowner ${homeowner.id} for appointment ${appointment.id}`);
      }
    } catch (notificationError) {
      // Don't fail the job completion if notifications fail
      console.error("Error sending completion notifications:", notificationError);
    }

    return res.json({
      success: true,
      message: "Job completed and payouts processed",
      payoutResults,
      photosVerified: {
        before: beforePhotos,
        after: afterPhotos
      }
    });
  } catch (error) {
    console.error("Complete job error:", error);
    return res.status(400).json({ error: "Failed to complete job" });
  }
});

// Alias for frontend compatibility
paymentRouter.post("/capture", async (req, res) => {
  const { appointmentId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });

    if (!appointment.hasBeenAssigned)
      return res.status(400).json({ error: "Cannot charge without a cleaner assigned" });

    // If payment is already captured, just mark complete and process payouts
    if (appointment.paid && appointment.paymentStatus === "captured") {
      await appointment.update({ completed: true });
      // Clean up any pending requests for this completed appointment
      await UserPendingRequests.destroy({
        where: { appointmentId: appointment.id },
      });
      const payoutResults = await processCleanerPayouts(appointment);
      return res.json({ success: true, payoutResults });
    }

    if (!appointment.paymentIntentId)
      return res.status(400).json({ error: "No payment intent found for this appointment" });

    const paymentIntent = await stripe.paymentIntents.capture(
      appointment.paymentIntentId
    );

    await appointment.update({
      paymentStatus: "captured",
      paid: true,
      completed: true,
      amountPaid: paymentIntent.amount_received || paymentIntent.amount
    });

    // Clean up any pending requests for this completed appointment
    await UserPendingRequests.destroy({
      where: { appointmentId: appointment.id },
    });

    // Record capture transaction in Payment table
    await recordPaymentTransaction({
      type: "capture",
      status: "succeeded",
      amount: paymentIntent.amount_received || paymentIntent.amount,
      userId: appointment.userId,
      appointmentId: appointment.id,
      stripePaymentIntentId: appointment.paymentIntentId,
      stripeChargeId: paymentIntent.latest_charge,
      description: `Payment captured for appointment ${appointment.id}`,
    });

    // Process payouts to cleaners (90% of their share)
    const payoutResults = await processCleanerPayouts(appointment);

    return res.json({ success: true, paymentIntent, payoutResults });
  } catch (error) {
    console.error("Capture error:", error);
    return res.status(400).json({ error: "Payment capture failed" });
  }
});

/**
 * POST /retry-payment
 * Allows homeowner to manually retry a failed payment capture
 */
paymentRouter.post("/retry-payment", async (req, res) => {
  const { appointmentId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);
    const userId = decoded.userId;

    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify user is the homeowner for this appointment
    if (appointment.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to retry payment for this appointment" });
    }

    // Check if payment is already completed
    if (appointment.paid && appointment.paymentStatus === "captured") {
      return res.json({
        success: true,
        message: "Payment already completed",
        alreadyPaid: true
      });
    }

    if (!appointment.paymentIntentId) {
      return res.status(400).json({ error: "No payment intent found for this appointment" });
    }

    // Try to capture the payment
    const paymentIntent = await stripe.paymentIntents.capture(
      appointment.paymentIntentId
    );

    // Update appointment status
    await appointment.update({
      paymentStatus: "captured",
      paid: true,
      paymentCaptureFailed: false,
      amountPaid: paymentIntent.amount_received || paymentIntent.amount,
    });

    // Update payout records to "held"
    await Payout.update(
      { status: "held", paymentCapturedAt: new Date() },
      { where: { appointmentId: appointment.id } }
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
    });

    console.log(`[Retry Payment] Successfully captured payment for appointment ${appointment.id}`);

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
    console.error("[Retry Payment] Error:", error);

    // Check if it's a Stripe error
    if (error.type === "StripeCardError" || error.type === "StripeInvalidRequestError") {
      return res.status(400).json({
        error: "Payment failed",
        message: error.message,
        code: error.code
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
paymentRouter.post("/pre-pay", async (req, res) => {
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

      const priceInCents = Math.round(parseFloat(appointment.price) * 100);

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
    if (error.type === "StripeCardError") {
      return res.status(400).json({ error: error.message });
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
paymentRouter.post("/pre-pay-batch", async (req, res) => {
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
      results.failed.push({
        id: appointmentId,
        error: err.type === "StripeCardError" ? err.message : "Payment failed"
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
            street: home.address,
            city: home.city,
            state: home.state,
            zipcode: home.zipcode,
          };
          await Email.sendUnassignedAppointmentWarning(
            user.email,
            homeAddress,
            user.firstName,
            appointmentDate
          );

          // Send push notification
          if (user.expoPushToken) {
            await PushNotification.sendPushUnassignedWarning(
              user.expoPushToken,
              user.firstName,
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
          notifications.unshift(
            `Heads up! Your cleaning on ${formattedDate} at ${home.address} doesn't have a cleaner assigned yet. There's still time for one to pick it up, but you may want to have a backup plan.`
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
                await appointment.update({ paymentCaptureFailed: true });
                continue;
              }

              const priceInCents = Math.round(parseFloat(appointment.price) * 100);

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
          } catch (err) {
            console.error("Stripe capture failed:", err.message);
            // Mark as failed so we notify homeowner
            await appointment.update({ paymentCaptureFailed: true });
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
              street: home.address,
              city: home.city,
              state: home.state,
              zipcode: home.zipcode,
            };

            // Send email notification
            await Email.sendEmailCancellation(
              user.email,
              cancelAddress,
              user.firstName,
              appointmentDate
            );

            // Send push notification
            if (user.expoPushToken) {
              await PushNotification.sendPushCancellation(
                user.expoPushToken,
                user.firstName,
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
              `Your cleaning appointment for ${formattedDate} at ${home.address} has been cancelled because no cleaner was available. You have not been charged.`
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
            street: home.address,
            city: home.city,
            state: home.state,
            zipcode: home.zipcode,
          };

          // Send cancellation email
          await Email.sendEmailCancellation(
            user.email,
            cancelAddress,
            user.firstName,
            appointmentDate
          );

          // Send push notification
          if (user.expoPushToken) {
            await PushNotification.sendPushCancellation(
              user.expoPushToken,
              user.firstName,
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
            `Your cleaning appointment for ${formattedDate} at ${home.address} has been cancelled due to payment failure. Please rebook when ready.`
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
            street: home.address,
            city: home.city,
            state: home.state,
            zipcode: home.zipcode,
          };

          const formattedDate = appointmentDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          // Send email about payment failure
          await Email.sendPaymentFailedReminder(
            user.email,
            user.firstName,
            homeAddress,
            appointmentDate,
            diffInDays
          );

          // Send push notification
          if (user.expoPushToken) {
            await PushNotification.sendPushPaymentFailed(
              user.expoPushToken,
              user.firstName,
              formattedDate,
              diffInDays
            );
          }

          // Add in-app notification
          const notifications = user.notifications || [];
          notifications.unshift(
            `Payment failed for your cleaning on ${formattedDate} at ${home.address}. Your appointment will be cancelled in ${diffInDays} day${diffInDays !== 1 ? "s" : ""} if payment is not completed. Please log in and retry payment.`
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
    if (!user || user.role !== "owner") {
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
            await Email.sendAdjustmentNeedsOwnerReview(
              ownerNotificationEmail,
              owner.firstName,
              request.id,
              request.cleaner?.firstName || "Cleaner",
              request.homeowner?.firstName || "Homeowner",
              request.home ? `${request.home.address}, ${request.home.city}` : "Unknown address"
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
                `[Cron] Supply reminder skipped for ${cleaner.firstName} (snoozed until ${snoozeEnd.toISOString()})`
              );
              continue;
            }
          }

          const home = appointment.home;
          if (!home) continue;

          const address = {
            street: home.street,
            city: home.city,
          };

          await PushNotification.sendPushSupplyReminder(
            cleaner.expoPushToken,
            cleaner.firstName,
            appointment.date,
            address
          );

          console.log(
            `[Cron] Supply reminder sent to ${cleaner.firstName} (ID: ${cleanerId})`
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
            user.email,
            user.username || user.firstName,
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
            user.username || user.firstName,
            pendingCount
          );
        }
        if (user.email) {
          await Email.sendReviewReminderNotification(
            user.email,
            user.username || user.firstName,
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
 * ------------------------------------------------------
 */
const handleCancelOrRefund = async (req, res) => {
  const { appointmentId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });

    if (!appointment.paymentIntentId)
      return res.status(400).json({ error: "No payment intent found for this appointment" });

    const paymentIntent = await stripe.paymentIntents.retrieve(
      appointment.paymentIntentId
    );

    let result;
    if (paymentIntent.status === "requires_capture") {
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
    } else if (paymentIntent.status === "succeeded") {
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
      });
    } else {
      return res
        .status(400)
        .json({ error: "Cannot cancel or refund this payment" });
    }

    console.log(`Appointment ${appointmentId} ${appointment.paymentStatus}`);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("Cancel/refund error:", error);
    return res.status(400).json({ error: "Refund or cancellation failed" });
  }
};

paymentRouter.post("/cancel-or-refund", handleCancelOrRefund);
paymentRouter.post("/refund", handleCancelOrRefund);

/**
 * ------------------------------------------------------
 * 7️⃣ Stripe Webhook — Handle Payment Events
 * ------------------------------------------------------
 */
paymentRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case "payment_intent.succeeded":
          const paymentIntent = event.data.object;
          console.log(`PaymentIntent succeeded: ${paymentIntent.id}`);

          const appointment = await UserAppointments.findOne({
            where: { paymentIntentId: paymentIntent.id },
          });
          if (appointment) {
            await appointment.update({
              paymentStatus: "succeeded",
              paid: true,
              amountPaid: paymentIntent.amount
            });
          }
          break;

        case "payment_intent.payment_failed":
          const failedIntent = event.data.object;
          console.error(`Payment failed: ${failedIntent.id}`);

          const failedAppointment = await UserAppointments.findOne({
            where: { paymentIntentId: failedIntent.id },
          });
          if (failedAppointment) {
            await failedAppointment.update({ paymentStatus: "failed" });
          }
          break;

        case "charge.refunded":
          const refund = event.data.object;
          console.log(`Charge refunded: ${refund.payment_intent}`);

          const refundedAppointment = await UserAppointments.findOne({
            where: { paymentIntentId: refund.payment_intent },
          });
          if (refundedAppointment) {
            await refundedAppointment.update({
              paymentStatus: "refunded",
              paid: false
            });
          }
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

module.exports = paymentRouter;
module.exports.recordPaymentTransaction = recordPaymentTransaction;

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
