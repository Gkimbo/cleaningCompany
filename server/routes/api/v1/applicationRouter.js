const express = require("express");
const ApplicationInfoClass = require("../../../services/ApplicationInfoClass");
const ApplicationSerializer = require("../../../serializers/ApplicationSerializer");
const { UserApplications } = require("../../../models");

const applicationRouter = express.Router();

// POST: submit new application
applicationRouter.post("/submitted", async (req, res) => {
  const {
    // Basic Information
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    // Address
    streetAddress,
    city,
    state,
    zipCode,
    // Identity Verification
    ssnLast4,
    driversLicenseNumber,
    driversLicenseState,
    idPhoto,
    // Work Eligibility
    isAuthorizedToWork,
    hasValidDriversLicense,
    hasReliableTransportation,
    // Experience
    experience,
    // Previous Employment
    previousEmployer,
    previousEmployerPhone,
    previousEmploymentDuration,
    reasonForLeaving,
    // References
    references,
    // Criminal History
    hasCriminalHistory,
    criminalHistoryExplanation,
    // Emergency Contact
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    // Availability
    availableStartDate,
    availableDays,
    // Personal Statement
    message,
    // Consents
    backgroundConsent,
    drugTestConsent,
    referenceCheckConsent,
  } = req.body;

  try {
    console.log(req.body);
    const applicationInfo = await ApplicationInfoClass.addApplicationToDB({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      streetAddress,
      city,
      state,
      zipCode,
      ssnLast4,
      driversLicenseNumber,
      driversLicenseState,
      idPhoto,
      isAuthorizedToWork,
      hasValidDriversLicense,
      hasReliableTransportation,
      experience,
      previousEmployer,
      previousEmployerPhone,
      previousEmploymentDuration,
      reasonForLeaving,
      references,
      hasCriminalHistory,
      criminalHistoryExplanation,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      availableStartDate,
      availableDays,
      message,
      backgroundConsent,
      drugTestConsent,
      referenceCheckConsent,
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

// PATCH: update application status
applicationRouter.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["pending", "under_review", "background_check", "approved", "rejected"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    const application = await UserApplications.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    await application.update({ status });
    return res.status(200).json({ message: "Status updated successfully", status });
  } catch (error) {
    console.error("Error updating application status:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

// PATCH: update application admin notes
applicationRouter.patch("/:id/notes", async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  try {
    const application = await UserApplications.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    await application.update({ adminNotes });
    return res.status(200).json({ message: "Notes updated successfully" });
  } catch (error) {
    console.error("Error updating application notes:", error);
    return res.status(500).json({ error: "Failed to update notes" });
  }
});

// GET: fetch single application by ID
applicationRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const application = await UserApplications.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.status(200).json({ application });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch application" });
  }
});

module.exports = applicationRouter;
