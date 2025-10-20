const express = require("express");
const ApplicationInfoClass = require("../../../services/ApplicationInfoClass");
const ApplicationSerializer = require("../../../serializers/ApplicationSerializer");
const { UserApplications } = require("../../../models");

const applicationRouter = express.Router();

// POST: submit new application
applicationRouter.post("/submitted", async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    experience,
    message,
    idPhoto,
    backgroundConsent,
  } = req.body;

  try {
    console.log(req.body)
    const applicationInfo = await ApplicationInfoClass.addApplicationToDB({
      firstName,
      lastName,
      email,
      phone,
      experience,
      message,
      idPhoto,
      backgroundConsent,
    });

    return res.status(201).json({ applicationInfo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to connect to database" });
  }
});
// GET: fetch all applications
applicationRouter.get("/all-applications", async (req, res) => {
  try {
    const applications = await UserApplications.findAll({});
    console.log(applications)
    const serializedApplications = ApplicationSerializer.serializeArray(applications);
    return res.status(200).json({ serializedApplications });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// DELETE: delete a specific application by ID
applicationRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await UserApplications.destroy({ where: { id } });
    return res.status(200).json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete application" });
  }
});

module.exports = applicationRouter;
