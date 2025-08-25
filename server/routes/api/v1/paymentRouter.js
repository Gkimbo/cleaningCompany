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

paymentRouter.get("/:homeId", async (req, res) => {
	const { homeId } = req.params;
	try {
		const appointments = await UserAppointments.findAll({
			where: { homeId },
		});
		const serializedAppointments =
			AppointmentSerializer.serializeArray(appointments);
		return res.status(200).json({ appointments: serializedAppointments });
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

paymentRouter.post("/create-payment-intent", async (req, res) => {
	const { token, homeId, amount } = req.body;

	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;

		const paymentIntent = await stripe.paymentIntents.create({
			amount: amount, // already passed in cents from frontend
			currency: "usd",
			metadata: { userId, homeId },
		});

		return res.json({ clientSecret: paymentIntent.client_secret });
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Payment creation failed" });
	}
});

paymentRouter.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
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

			// (Optionally create appointments or mark them paid here)

			console.log("✅ Payment recorded for user:", userId);
		}

		res.json({ received: true });
	} catch (err) {
		console.error("Webhook error:", err.message);
		res.status(400).send(`Webhook Error: ${err.message}`);
	}
});

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
