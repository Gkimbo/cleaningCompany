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
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const Email = require("../../../services/sendNotifications/EmailClass");

// Platform fee percentage (10%)
const PLATFORM_FEE_PERCENT = 0.10;

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
      // Use payout records for accurate 90/10 split
      const completedPayouts = payouts.filter(p => p.status === "completed");
      const pendingPayouts = payouts.filter(p => ["pending", "held", "processing"].includes(p.status));

      const totalEarnings = completedPayouts.reduce((total, p) => total + p.netAmount, 0) / 100;
      const pendingEarnings = pendingPayouts.reduce((total, p) => total + p.netAmount, 0) / 100;

      return res.json({
        totalEarnings: totalEarnings.toFixed(2),
        pendingEarnings: pendingEarnings.toFixed(2),
        completedJobs: completedPayouts.length,
        platformFeePercent: 10,
        cleanerPercent: 90,
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

    // Calculate with 90% (cleaner gets 90%, platform keeps 10%)
    const totalEarnings = employeeAppointments.reduce((total, appt) => {
      const price = parseFloat(appt.price) || 0;
      const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
      const grossPerCleaner = price / employeeCount;
      const netPerCleaner = grossPerCleaner * (1 - PLATFORM_FEE_PERCENT); // 90%
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
          const netPerCleaner = grossPerCleaner * (1 - PLATFORM_FEE_PERCENT); // 90%
          return total + netPerCleaner;
        }, 0)
    );

    return res.json({
      totalEarnings: totalEarnings.toFixed(2),
      pendingEarnings: pendingEarnings.toFixed(2),
      completedJobs: employeeAppointments.length,
      platformFeePercent: 10,
      cleanerPercent: 90,
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
 * Remove a payment method
 */
paymentRouter.delete("/payment-method/:paymentMethodId", async (req, res) => {
  const { paymentMethodId } = req.params;
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

    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);

    // Check if user still has other payment methods
    const methods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    const hasPaymentMethod = methods.data.length > 0;
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
 * Helper: Process payouts to cleaners after job completion
 * Records all transactions in Payment table for tax reporting
 * ------------------------------------------------------
 */
async function processCleanerPayouts(appointment) {
  const cleanerIds = appointment.employeesAssigned || [];
  const results = [];

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

      // Calculate amounts
      const priceInCents = Math.round(parseFloat(appointment.price) * 100);
      const perCleanerGross = Math.round(priceInCents / cleanerIds.length);
      const platformFee = Math.round(perCleanerGross * PLATFORM_FEE_PERCENT);
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

      // Create Stripe Transfer to cleaner
      const transfer = await stripe.transfers.create({
        amount: netAmount,
        currency: "usd",
        destination: connectAccount.stripeAccountId,
        metadata: {
          appointmentId: appointment.id.toString(),
          cleanerId: cleanerId.toString(),
          payoutId: payout.id.toString(),
        },
      });

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
          feePercent: PLATFORM_FEE_PERCENT * 100,
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

    // Process payouts to cleaners (90% of their share)
    const payoutResults = await processCleanerPayouts(appointment);

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
 * 5️⃣ Daily Scheduler — Charge 3 Days Before Appointment
 * Payment is captured and held until job completion
 * ------------------------------------------------------
 */
cron.schedule("0 7 * * *", async () => {
  console.log("Running daily payment check (3-day trigger)...");

  const now = new Date();

  try {
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

        if (appointment.hasBeenAssigned && appointment.paymentIntentId) {
          // Capture payment if cleaner assigned - money is now held by the platform
          try {
            const paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);
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
          }
        } else if (appointment.paymentIntentId && diffInDays <= 2) {
          // No cleaner assigned and we're 2 days out — cancel payment & notify client
          try {
            await stripe.paymentIntents.cancel(appointment.paymentIntentId);
            await appointment.update({ paymentStatus: "cancelled" });

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

            await Email.sendEmailCancellation(
              user.email,
              home,
              user.firstName,
              appointmentDate
            );

            console.log(
              `Appointment ${appointment.id} cancelled — user notified (${user.email})`
            );
          } catch (err) {
            console.error(
              "Failed to cancel appointment or send email:",
              err
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("Cron job error:", err);
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
