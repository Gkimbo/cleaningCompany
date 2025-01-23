const express = require("express");
const jwt = require("jsonwebtoken");
const UserInfo = require("../../../services/UserInfoClass");
const ApplicationInfoClass = require("../../../services/ApplicationInfoClass")


const applicationRouter = express.Router();

applicationRouter.post("/submitted", async (req, res) => {
    const {firstName, lastName, email, phone, experience, availability, message} = req.body
    try {
		const applicationInfo = await ApplicationInfoClass.addApplicationToDB({
			firstName, 
            lastName, 
            email, 
            phone, 
            experience, 
            availability, 
            message,
		});

		return res.status(201).json({ applicationInfo });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ error: "No connection to database" });
	}
  });

module.exports = applicationRouter