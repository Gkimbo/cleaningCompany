const express = require("express");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");

const paymentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

/**
 * ------------------------------------------------------
 * 1️⃣ Get Appointments for a Specific Home
 * ------------------------------------------------------
 */
paymentRouter.get("/:homeId", async (req, res) => {
  const { homeId } = req.params;
  try {
    const appointments = await UserAppointments.findAll({ where: { homeId } });
    const serializedAppointments = AppointmentSerializer.serializeArray(appointments);
    return res.status(200).json({ appointments: serializedAppointments });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Unable to fetch appointments" });
  }
});

/**
 * ------------------------------------------------------
 * 2️⃣ Create Payment Intent (Authorize Only)
 * ------------------------------------------------------
 */
paymentRouter.post("/create-payment-intent", async (req, res) => {
  const { token, homeId, amount } = req.body;

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const home = await UserHomes.findByPk(homeId);
    if (!home) return res.status(404).json({ error: "Home not found" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: "usd",
      capture_method: "manual", // authorize only
      metadata: { userId, homeId },
    });

    const appointment = await UserAppointments.create({
      userId,
      homeId,
      amount: amount / 100,
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
 * 3️⃣ Capture Payment & Pay Cleaner After Completion
 * ------------------------------------------------------
 */
paymentRouter.post("/capture-payment", async (req, res) => {
  const { token, appointmentId } = req.body;

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    const paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);

    const cleaner = await User.findByPk(appointment.cleanerId);
    if (!cleaner || !cleaner.stripeAccountId)
      return res.status(400).json({ error: "Cleaner Stripe account missing" });

    // Example platform fee: 10%
    const platformFee = Math.round(appointment.amount * 10);
    const transfer = await stripe.transfers.create({
      amount: appointment.amount * 100 - platformFee,
      currency: "usd",
      destination: cleaner.stripeAccountId,
      source_transaction: paymentIntent.charges.data[0].id,
      metadata: { appointmentId, cleanerId: cleaner.id },
    });

    await appointment.update({
      status: "completed",
      paidOut: true,
    });

    const userBill = await UserBills.findOne({ where: { userId } });
    if (userBill) {
      await userBill.update({
        appointmentDue: 0,
        totalDue: userBill.totalDue + appointment.amount,
      });
    }

    return res.json({ success: true, transfer });
  } catch (error) {
    console.error("Capture error:", error);
    return res.status(400).json({ error: "Payment capture failed" });
  }
});

/**
 * ------------------------------------------------------
 * 4️⃣ Handle Cancellations or Refunds
 * ------------------------------------------------------
 * - If appointment is pending (not captured), cancel authorization.
 * - If captured, issue refund to client.
 */
paymentRouter.post("/cancel-or-refund", async (req, res) => {
  const { token, appointmentId } = req.body;

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    const paymentIntentId = appointment.paymentIntentId;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    let result;

    if (paymentIntent.status === "requires_capture") {
      // Payment authorized but not captured — cancel it
      result = await stripe.paymentIntents.cancel(paymentIntentId);
      await appointment.update({ status: "cancelled" });
    } else if (paymentIntent.status === "succeeded") {
      // Payment captured — issue refund
      result = await stripe.refunds.create({ payment_intent: paymentIntentId });
      await appointment.update({ status: "refunded" });
    } else {
      return res.status(400).json({ error: "Cannot cancel or refund this payment" });
    }

    console.log(`✅ Appointment ${appointmentId} ${appointment.status}`);
    return res.json({ success: true, result });
  } catch (error) {
    console.error("Cancel/refund error:", error);
    return res.status(400).json({ error: "Refund or cancellation failed" });
  }
});

/**
 * ------------------------------------------------------
 * 5️⃣ Stripe Webhook — Confirm Payments
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

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const { userId, homeId } = paymentIntent.metadata;

        const existingBill = await UserBills.findOne({ where: { userId } });
        if (existingBill) {
          await existingBill.update({
            appointmentDue: existingBill.appointmentDue + paymentIntent.amount / 100,
            totalDue: existingBill.totalDue + paymentIntent.amount / 100,
          });
        }

        console.log("✅ Payment recorded for user:", userId);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err.message);
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
