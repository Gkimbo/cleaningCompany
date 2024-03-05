const express = require("express");
const jwt = require("jsonwebtoken");
const {
	User,
	UserAppointments,
	UserHomes,
	UserBills,
	UserCleanerAppointments,
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const calculatePrice = require("../../../services/CalculatePrice");

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
	const { token, homeId, dateArray, keyPadCode, keyLocation } = req.body;
	let appointmentTotal = 0;
	const home = await UserHomes.findOne({ where: { id: homeId } });

	dateArray.forEach((date) => {
		const price = calculatePrice(
			date.bringSheets,
			date.bringTowels,
			home.dataValues.numBeds,
			home.dataValues.numBaths
		);
		date.price = price;
		appointmentTotal += price;
	});
	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;
		const existingBill = await UserBills.findOne({
			where: { userId },
		});
		const oldAppt = existingBill.dataValues.appointmentDue;
		const total =
			existingBill.dataValues.cancellationFee +
			existingBill.dataValues.appointmentDue;

		await existingBill.update({
			appointmentDue: oldAppt + appointmentTotal,
			totalDue: total + appointmentTotal,
		});

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
					keyPadCode,
					keyLocation,
					completed: false,
				});
				const appointmentId = newAppointment.dataValues.id;
				//Change this to find all employees who want to work that day, if the employee doesn't already have 2 cleanings that day then assign them, otherwise move on to the next
				const day = new Date(date.date);
				const daysOfWeek = [
					"Monday",
					"Tuesday",
					"Wednesday",
					"Thursday",
					"Friday",
					"Saturday",
					"Sunday",
				];
				const dayOfWeekIndex = day.getDay();
				const dayOfWeek = daysOfWeek[dayOfWeekIndex];
				console.log(dayOfWeek);

				const cleaners = await User.findAll({
					where: { type: "cleaner" },
				});

				// const employeeId = cleanerAssigned.dataValues.id;
				const newConnection = await UserCleanerAppointments.create({
					appointmentId,
					employeeId: 2,
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
	const { fee, user } = req.body;
	try {
		const decodedToken = jwt.verify(user, secretKey);
		const userId = decodedToken.userId;
		const existingBill = await UserBills.findOne({
			where: { userId },
		});

		const appointmentToDelete = await UserAppointments.findOne({
			where: { id: id },
		});
		const appointmentTotal = Number(appointmentToDelete.dataValues.price);
		const oldFee = Number(existingBill.dataValues.cancellationFee);
		const oldAppt = Number(existingBill.dataValues.appointmentDue);

		const total =
			Number(existingBill.dataValues.cancellationFee) +
			Number(existingBill.dataValues.appointmentDue);

		await existingBill.update({
			cancellationFee: oldFee + fee,
			appointmentDue: oldAppt - appointmentTotal,
			totalDue: total + fee - appointmentTotal,
		});
		const connectionsToDelete = await UserCleanerAppointments.destroy({
			where: { appointmentId: id },
		});

		const deletedAppointmentInfo = await UserAppointments.destroy({
			where: { id: id },
		});

		return res.status(201).json({ message: "Appointment Deleted" });
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

appointmentRouter.patch("/:id", async (req, res) => {
	const { id, bringTowels, bringSheets, keyPadCode, keyLocation } = req.body;
	let userInfo;

	try {
		if (bringSheets) {
			userInfo = await UserInfo.editSheetsInDB({
				id,
				bringSheets,
			});
		}
		if (bringTowels) {
			userInfo = await UserInfo.editTowelsInDB({
				id,
				bringTowels,
			});
		}
		if (keyPadCode) {
			userInfo = await UserInfo.editCodeKeyInDB({
				id,
				keyPadCode,
				keyLocation: "",
			});
		}
		if (keyLocation) {
			userInfo = await UserInfo.editCodeKeyInDB({
				id,
				keyLocation,
				keyPadCode: "",
			});
		}
		return res.status(200).json({ user: userInfo });
	} catch (error) {
		console.error(error);

		if (error.name === "TokenExpiredError") {
			return res.status(401).json({ error: "Token has expired" });
		}

		return res.status(401).json({ error: "Invalid token" });
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
