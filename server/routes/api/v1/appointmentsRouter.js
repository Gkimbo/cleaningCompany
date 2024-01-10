const express = require("express");
const jwt = require("jsonwebtoken");
const { User, UserAppointments } = require("../../../models");

const appointmentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

appointmentRouter.post("/add", async (req, res) => {
	try {
		const { token, userId, homeId, date } = req.body.appointment;
		const decodedToken = jwt.verify(token, secretKey);

		if (decodedToken.userId !== userId) {
			return res
				.status(401)
				.json({ error: "Invalid user for this appointment" });
		}

		const user = await User.findByPk(userId);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		const newAppointment = await UserAppointments.create({
			userId,
			homeId,
			date,
		});

		return res.status(201).json({ appointment: newAppointment });
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

module.exports = appointmentRouter;
