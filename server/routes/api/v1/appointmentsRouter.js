const express = require("express");
const jwt = require("jsonwebtoken");
const { User, UserAppointments, UserHomes } = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");

const appointmentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

appointmentRouter.get("/:homeId", async (req, res) => {
	const { homeId } = req.params;
	try {
		const appointments = await UserAppointments.findAll({
			where: {
				homeId: homeId,
			},
		});
		const serializedAppointments =
			AppointmentSerializer.serializeArray(appointments);
		return res.status(200).json({ appointments: serializedAppointments });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

appointmentRouter.post("/", async (req, res) => {
	const { token, homeId, dateArray } = req.body;

	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;

		const appointments = await Promise.all(
			dateArray.map(async (date) => {
				const newAppointment = await UserAppointments.create({
					userId,
					homeId,
					date: date.date,
					price: date.price,
					paid: date.paid,
					bringTowels: date.bringTowels,
					bringSheets: date.bringSheets,
				});

				return newAppointment;
			})
		);

		return res.status(201).json({ appointments });
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

appointmentRouter.delete("/:id", async (req, res) => {
	const { id } = req.params;
	try {
		const deletedAppointmentInfo = await UserAppointments.destroy({
			where: { id: id },
		});
		return res.status(201).json({ message: "Appointment Deleted" });
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

module.exports = appointmentRouter;

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
