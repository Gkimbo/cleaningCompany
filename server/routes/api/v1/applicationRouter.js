const express = require("express");
const jwt = require("jsonwebtoken");
const UserInfo = require("../../../services/UserInfoClass");
const ApplicationInfoClass = require("../../../services/ApplicationInfoClass")
const ApplicationSerializer = require("../../../serializers/ApplicationSerializer")
const { UserApplications } = require("../../../models")


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

  applicationRouter.get("/all-applications", async (req, res) => {
    try {
      const applications = await UserApplications.findAll({});
      const serializedApplications =
        ApplicationSerializer.serializeArray(applications);
      return res.status(200).json({ serializedApplications });
    } catch (error) {
      console.error(error);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  });

  applicationRouter.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const applicationToDelete = await UserApplications.findOne({
        where: { id: id },
      });
      const deletedAppointmentInfo = await UserApplications.destroy({
        where: { id: id },
      });
      return res.status(201).json({ message: "Application Deleted" });
    } catch (error) {
      console.error(error);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  });

module.exports = applicationRouter