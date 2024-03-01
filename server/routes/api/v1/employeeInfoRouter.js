const express = require("express");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const {
	User,
	UserHomes,
	UserAppointments,
	UserCleanerAppointments,
	UserBills,
} = require("../../../models");

const HomeClass = require("../../../services/HomeClass");
const { Op } = require("sequelize");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");

const employeeInfoRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

employeeInfoRouter.get("/", async (req, res) => {
	const token = req.headers.authorization.split(" ")[1];
	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;
		let employee = await User.findByPk(userId, {
			include: [
				{
					model: UserCleanerAppointments,
					as: "cleanerAppointments",
				},
			],
		});
		const appointmentIds = employee.dataValues.cleanerAppointments.map(
			(appointment) => appointment.appointmentId
		);
		const appointments = await UserAppointments.findAll({
			where: {
				id: appointmentIds,
			},
		});
		const serializedAppointments = await AppointmentSerializer.serializeArray(
			appointments
		);
		const serializedEmployee = UserSerializer.serializeOne(employee.dataValues);
		serializedEmployee.cleanerAppointments = serializedAppointments;
		return res.status(200).json({ employee: serializedEmployee });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

module.exports = employeeInfoRouter;
