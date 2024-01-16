const express = require("express");
const { User, UserBills } = require("../../../models");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");

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

module.exports = usersRouter;
