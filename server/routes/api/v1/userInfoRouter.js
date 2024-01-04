const express = require("express");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const { User, UserHomes } = require("../../../models");

const HomeClass = require("../../../services/HomeClass");

const userInfoRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

userInfoRouter.get("/", async (req, res) => {
	const token = req.headers.authorization.split(" ")[1];
	try {
		const decodedToken = jwt.verify(token, secretKey);
		const userId = decodedToken.userId;
		const user = await User.findOne({
			where: { id: userId },
			include: [{ model: UserHomes, as: "userHomes" }],
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
		address,
		city,
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
			userId,
			address,
			city,
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
		});

		return res.status(201).json({ user });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

userInfoRouter.delete("/home", async (req, res) => {
	const id = req.body.id;
	try {
		const deleteHome = await UserInfo.deleteHomeInfo(id);
		return res.status(201).json({ message: "home deleted" });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "Invalid or expired token" });
	}
});

// userInfoRouter.patch("/basic", async (req, res) => {
// 	const { token } = req.body.data.user;
// 	const {
// 		zipcode,
// 		homeOwnership,
// 		milesDriven,
// 		milesDrivenUnit,
// 		commute,
// 		transportation,
// 		daysCommute,
// 		hasCar,
// 	} = req.body.data;
// 	try {
// 		const decodedToken = jwt.verify(token, secretKey);
// 		const userId = decodedToken.userId;
// 		const user = await User.findOne({
// 			where: { id: userId },
// 		});
// 		if (user) {
// 			await UserInfo.updateUserInfo({
// 				userId,
// 				zipcode,
// 				homeOwnership,
// 				milesDriven,
// 				milesDrivenUnit,
// 				commute,
// 				transportation,
// 				daysCommute,
// 				hasCar,
// 			});
// 		}
// 		return res.status(201).json("User Information has been deleted!");
// 	} catch (error) {
// 		console.log(error);
// 		return res.status(401).json({ error: "Invalid or expired token" });
// 	}
// });

module.exports = userInfoRouter;
