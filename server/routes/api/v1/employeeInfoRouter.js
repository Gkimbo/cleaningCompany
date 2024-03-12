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

employeeInfoRouter.get("/home/:id", async (req, res) => {
	const { id } = req.params;
	try {
		let home = await UserHomes.findOne({
			where: {
				id,
			},
		});

		return res.status(200).json({ home });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

employeeInfoRouter.get("/employeeSchedule", async (req, res) => {
	try {
		const employees = await User.findAll({
			where: {
				type: "cleaner",
			},
		});

		console.log(employees);
		return res.status(200).json({ employees });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

employeeInfoRouter.post("/shifts", async (req, res) => {
	const { token } = req.body.user;
	const daysArray = req.body.days;
	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;
		const user = await User.findOne({
			where: { id: userId },
		});
		await user.update({
			daysWorking: daysArray,
		});
		return res.status(201).json({ user });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

module.exports = employeeInfoRouter;
