const express = require("express");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Op } = require("sequelize");
const {
	User,
	UserAppointments,
	UserHomes,
	UserBills,
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");

const paymentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

paymentRouter.post("/", async (req, res) => {
	const { token, amount } = req.body;

	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;

		// Use Stripe to create a payment
		const paymentIntent = await stripe.paymentIntents.create({
			amount: Number(amount) * 100, // Amount in cents
			currency: "usd",
			description: "Appointment payment",
			payment_method: token,
			confirm: true,
		});

		// Handle successful payment
		if (paymentIntent.status === "succeeded") {
			// Update UserBills and create UserAppointments
			const existingBill = await UserBills.findOne({
				where: { userId },
			});

			const oldAppt = existingBill.dataValues.appointmentDue;
			const total =
				existingBill.dataValues.cancellationFee +
				existingBill.dataValues.appointmentDue;

			await existingBill.update({
				appointmentDue: oldAppt - Number(amount),
				totalDue: total - Number(amount),
			});

			const todayOrEarlierAppointments = await UserAppointments.findAll({
				where: {
					userId,
					date: {
						[Op.lte]: new Date(), // Op.lte represents "less than or equal to"
					},
				},
			});

			await Promise.all(
				todayOrEarlierAppointments.map(async (appointment) => {
					await appointment.update({ paid: true });
				})
			);

			return res.status(201).json({ success: true, appointments });
		} else {
			return res.status(400).json({ success: false, error: "Payment failed" });
		}
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

module.exports = paymentRouter;

// paymentRouter.get("/:homeId", async (req, res) => {
// 	const { homeId } = req.params;
// 	try {
// 		const appointments = await UserAppointments.findAll({
// 			where: {
// 				homeId: homeId,
// 			},
// 		});
// 		const serializedAppointments =
// 			AppointmentSerializer.serializeArray(appointments);
// 		return res.status(200).json({ appointments: serializedAppointments });
// 	} catch (error) {
// 		console.log(error);
// 		return res.status(401).json({ error: "Invalid or expired token" });
// 	}
// });

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
