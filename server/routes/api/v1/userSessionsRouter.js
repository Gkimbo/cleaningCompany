/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const express = require("express");
const passport = require("passport");
const { User } = require("../../../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const authenticateToken = require("../../../middleware/authenticatedToken");

const sessionRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

sessionRouter.post("/", passport.authenticate("local"), async (req, res) => {
	try {
		const user = await User.findOne({ where: { id: req.user.id } });
		res.status(201).json(user);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});

sessionRouter.post("/login", async (req, res) => {
	const { username, password } = req.body;

	try {
		const user = await User.findOne({ where: { username } });
		if (user) {
			const passwordMatch = await bcrypt.compare(password, user.password);
			if (passwordMatch) {
				req.login(user, (err) => {
					if (err) {
						console.error(err);
						res.status(500).json({ message: "Internal server error" });
					} else {
						const serializedUser = UserSerializer.login(user);
						const token = jwt.sign({ userId: user.id }, secretKey);
						return res.status(201).json({ user: serializedUser, token: token });
					}
				});
			} else {
				res.status(401).json({ error: "Invalid password" });
			}
		} else {
			res.status(404).json({ error: "No Username" });
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});

sessionRouter.get("/current", authenticateToken, async (req, res) => {
	try {
		const user = await User.findOne({
			where: { id: req.userId },
		});
		const serializedUser = UserSerializer.serializeOne(user);
		const token = jwt.sign({ userId: user.id }, secretKey);
		res.status(200).json({ user: serializedUser, token });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});

sessionRouter.post("/logout", (req, res) => {
	req.session.destroy();
	res.clearCookie("token");
	res.status(200).json({ message: "Logout successful" });
});

module.exports = sessionRouter;
