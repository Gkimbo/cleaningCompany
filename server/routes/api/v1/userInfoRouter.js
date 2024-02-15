const express = require("express");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const {
	User,
	UserHomes,
	UserAppointments,
	UserBills,
} = require("../../../models");

const HomeClass = require("../../../services/HomeClass");
const { Op } = require("sequelize");

const userInfoRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

userInfoRouter.get("/", async (req, res) => {
	const token = req.headers.authorization.split(" ")[1];
	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;
		const user = await User.findByPk(userId, {
			include: [
				{
					model: UserHomes,
					as: "homes",
				},
				{
					model: UserAppointments,
					as: "appointments",
				},
				{
					model: UserBills,
					as: "bills",
				},
			],
		});
		let serializedUser = UserSerializer.serializeOne(user.dataValues);
		return res.status(200).json({ user: serializedUser });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

userInfoRouter.post("/home", async (req, res) => {
	const { token } = req.body.user;
	const {
		nickName,
		address,
		city,
		state,
		zipcode,
		numBeds,
		numBaths,
		sheetsProvided,
		towelsProvided,
		keyPadCode,
		keyLocation,
		recyclingLocation,
		compostLocation,
		trashLocation,
		contact,
		specialNotes,
	} = req.body.home;
	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;
		const user = await User.findOne({
			where: { id: userId },
		});
		const checkZipCode = await HomeClass.checkZipCodeExists(zipcode);
		if (!checkZipCode) {
			return res.status(400).json("Cannot find zipcode");
		}
		const userInfo = await UserInfo.addHomeToDB({
			nickName,
			userId,
			address,
			city,
			state,
			zipcode,
			numBeds,
			numBaths,
			sheetsProvided,
			towelsProvided,
			keyPadCode,
			keyLocation,
			recyclingLocation,
			compostLocation,
			trashLocation,
			contact,
			specialNotes,
		});

		return res.status(201).json({ user });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

userInfoRouter.patch("/home", async (req, res) => {
	const {
		id,
		nickName,
		address,
		city,
		state,
		zipcode,
		numBeds,
		numBaths,
		sheetsProvided,
		towelsProvided,
		keyPadCode,
		keyLocation,
		recyclingLocation,
		compostLocation,
		trashLocation,
		contact,
		specialNotes,
	} = req.body;

	try {
		const checkZipCode = await HomeClass.checkZipCodeExists(zipcode);
		if (!checkZipCode) {
			return res.status(400).json({ error: "Cannot find zipcode" });
		}

		const userInfo = await UserInfo.editHomeInDB({
			id,
			nickName,
			address,
			city,
			state,
			zipcode,
			numBeds,
			numBaths,
			sheetsProvided,
			towelsProvided,
			keyPadCode,
			keyLocation,
			recyclingLocation,
			compostLocation,
			trashLocation,
			contact,
			specialNotes,
		});

		return res.status(200).json({ user: userInfo });
	} catch (error) {
		console.error(error);

		if (error.name === "TokenExpiredError") {
			return res.status(401).json({ error: "Token has expired" });
		}

		return res.status(401).json({ error: "Invalid token" });
	}
});

userInfoRouter.delete("/home", async (req, res) => {
	const id = req.body.id;
	try {
		const today = new Date();
		const oneWeekFromToday = new Date(today);
		oneWeekFromToday.setDate(oneWeekFromToday.getDate() + 7);

		const homeToDelete = await UserHomes.findAll({
			where: {
				id: id,
			},
		});

		const billToUpdate = await UserBills.findOne({
			where: {
				userId: homeToDelete[0].dataValues.userId,
			},
		});

		const appointmentsWithinWeek = await UserAppointments.findAll({
			where: {
				homeId: id,
				date: {
					[Op.between]: [today, oneWeekFromToday],
				},
			},
		});

		if (appointmentsWithinWeek.length > 0) {
			const cancellationFee = 25 * appointmentsWithinWeek.length;
			const oldFee = Number(billToUpdate.dataValues.cancellationFee);

			const total =
				Number(billToUpdate.dataValues.cancellationFee) +
				Number(billToUpdate.dataValues.appointmentDue);

			await billToUpdate.update({
				cancellationFee: oldFee + cancellationFee,
				totalDue: total + cancellationFee,
			});
			console.log(`Cancellation fee charged: $${cancellationFee}`);
		}

		await UserAppointments.destroy({
			where: {
				homeId: id,
			},
		});

		const deleteHome = await UserInfo.deleteHomeInfo(id);
		return res.status(201).json({ message: "home deleted" });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

module.exports = userInfoRouter;
