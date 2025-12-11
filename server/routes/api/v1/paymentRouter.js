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
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const Email = require("../../../services/sendNotifications/EmailClass");

const paymentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

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
 * 3️⃣ Get Employee Earnings
 * Must be defined BEFORE /:homeId to avoid route conflict
 * ------------------------------------------------------
 */
paymentRouter.get("/earnings/:employeeId", async (req, res) => {
  const { employeeId } = req.params;

  try {
    // Get appointments where this employee was assigned
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

    const totalEarnings = employeeAppointments.reduce((total, appt) => {
      const price = parseFloat(appt.price) || 0;
      const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
      return total + (price / employeeCount);
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
          return total + (price / employeeCount);
        }, 0)
    );

    return res.json({
      totalEarnings: totalEarnings.toFixed(2),
      pendingEarnings: pendingEarnings.toFixed(2),
      completedJobs: employeeAppointments.length,
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return res.status(400).json({ error: "Failed to fetch earnings" });
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
      completed: true
    });
    return res.json({ success: true, paymentIntent });
  } catch (error) {
    console.error("Capture error:", error);
    return res.status(400).json({ error: "Payment capture failed" });
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

    if (!appointment.paymentIntentId)
      return res.status(400).json({ error: "No payment intent found for this appointment" });

    const paymentIntent = await stripe.paymentIntents.capture(
      appointment.paymentIntentId
    );

    await appointment.update({
      paymentStatus: "captured",
      paid: true,
      completed: true
    });
    return res.json({ success: true, paymentIntent });
  } catch (error) {
    console.error("Capture error:", error);
    return res.status(400).json({ error: "Payment capture failed" });
  }
});

/**
 * ------------------------------------------------------
 * 5️⃣ Daily Scheduler — Charge 2 Days Before Appointment
 * ------------------------------------------------------
 */
cron.schedule("0 7 * * *", async () => {
  console.log("Running daily payment check...");

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

      // Only act 2 days before the appointment
      if (diffInDays === 2) {
        const user = await User.findByPk(appointment.userId);
        const home = await UserHomes.findByPk(appointment.homeId);
        if (!user || !home) continue;

        if (appointment.hasBeenAssigned && appointment.paymentIntentId) {
          // Capture payment if cleaner assigned
          try {
            await stripe.paymentIntents.capture(appointment.paymentIntentId);
            await appointment.update({
              paymentStatus: "captured",
              paid: true
            });
            console.log(`Charged client for appointment ${appointment.id}`);
          } catch (err) {
            console.error("Stripe capture failed:", err.message);
          }
        } else if (appointment.paymentIntentId) {
          // No cleaner — cancel payment & notify client
          try {
            await stripe.paymentIntents.cancel(appointment.paymentIntentId);
            await appointment.update({ paymentStatus: "cancelled" });

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
    } else if (paymentIntent.status === "succeeded") {
      result = await stripe.refunds.create({
        payment_intent: paymentIntent.id,
      });
      await appointment.update({ paymentStatus: "refunded", paid: false });
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
