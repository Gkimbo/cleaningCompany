const express = require("express");
const { User, UserBills, UserAppointments } = require("../../../models");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");

const secretKey = process.env.SESSION_SECRET;

const usersRouter = express.Router();

usersRouter.post("/", async (req, res) => {
	try {
		const { username, password, email } = req.body;
		let existingUser = null;
		existingUser = await User.findOne({ where: { email } });
		if (!existingUser) {
			existingUser = await User.findOne({ where: { username } });
			if (!existingUser) {
				const newUser = await User.create({
					username,
					password,
					email,
				});
				const newBill = await UserBills.create({
					userId: newUser.dataValues.id,
					appointmentDue: 0,
					cancellationFee: 0,
					totalDue: 0,
				});
				await newUser.update({ lastLogin: new Date() });
				const serializedUser = UserSerializer.login(newUser.dataValues);
				const token = jwt.sign({ userId: serializedUser.id }, secretKey);
				return res.status(201).json({ user: serializedUser, token: token });
			} else {
				return res.status(410).json("Username already exists");
			}
		} else {
			return res.status(409).json("User already exists");
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to create user" });
	}
});

usersRouter.post("/new-employee", async (req, res) => {
	try {
		const { username, password, email, type } = req.body;
		let existingUser = null;
		existingUser = await User.findOne({ where: { email } });
		if (!existingUser) {
			existingUser = await User.findOne({ where: { username } });
			if (!existingUser) {
				const newUser = await User.create({
					username,
					password,
					email,
					type,
				});
				const newBill = await UserBills.create({
					userId: newUser.dataValues.id,
					appointmentDue: 0,
					cancellationFee: 0,
					totalDue: 0,
				});
				await newUser.update({ lastLogin: new Date() });
				const serializedUser = UserSerializer.serializeOne(newUser.dataValues);
				return res.status(201).json({ user: serializedUser });
			} else {
				return res.status(410).json("Username already exists");
			}
		} else {
			return res.status(409).json("User already exists");
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to create employee account" });
	}
});

usersRouter.get("/employees", async (req, res) => {
	const token = req.headers.authorization.split(" ")[1];
	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;

		const users = await User.findAll({
			where: {
				type: "cleaner",
			},
		});

		let serializedUsers = users.map((user) =>
			UserSerializer.serializeOne(user.dataValues)
		);
		return res.status(200).json({ users: serializedUsers });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

usersRouter.patch("/employee", async (req, res) => {
	const { id, username, password, email, type } = req.body;
	try {
		const userInfo = await UserInfo.editEmployeeInDB({
			id,
			username,
			password,
			email,
			type,
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

usersRouter.delete("/employee", async (req, res) => {
	const userId = req.body.id;
	try {
		await UserBills.destroy({
			where: {
				userId: userId,
			},
		});

		await User.destroy({
			where: {
				id: userId,
			},
		});
		return res.status(201).json({ message: "Employee Deleted from DB" });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});
usersRouter.get("/appointments", async (req, res) => {
	const token = req.headers.authorization.split(" ")[1];
	try {
		const userAppointments = await UserAppointments.findAll();
		const serializedAppointments =
			AppointmentSerializer.serializeArray(userAppointments);

		return res.status(200).json({ appointments: serializedAppointments });
	} catch (error) {
		console.error(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

module.exports = usersRouter;
