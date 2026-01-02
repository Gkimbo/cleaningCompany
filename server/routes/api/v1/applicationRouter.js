const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const ApplicationInfoClass = require("../../../services/ApplicationInfoClass");
const ApplicationSerializer = require("../../../serializers/ApplicationSerializer");
const models = require("../../../models");
const { UserApplications, User, UserBills } = models;
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const { generateSecurePassword, generateUniqueUsername } = require("../../../utils/passwordGenerator");
const ReferralService = require("../../../services/ReferralService");

const applicationRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Helper to verify token and check owner/HR authorization
const verifyOwnerOrHR = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Authorization token required", status: 401 };
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, secretKey);
  } catch (err) {
    return { error: "Invalid or expired token", status: 401 };
  }

  const caller = await User.findByPk(decoded.userId);
  if (!caller) {
    return { error: "User not found", status: 404 };
  }

  if (caller.type !== "owner" && caller.type !== "humanResources") {
    return { error: "Only owner or HR can access this resource", status: 403 };
  }

  return { caller };
};

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
    // Referral
    referralCode,
  } = req.body;

  try {
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
      referralCode,
    });

    // Notify owners about the new application
    try {
      const owners = await User.findAll({
        where: { type: "owner" },
      });

      const applicantName = `${firstName} ${lastName}`;

      for (const owner of owners) {
        // Send email notification (use notificationEmail if set, otherwise main email)
        const ownerNotificationEmail = owner.getNotificationEmail();
        if (ownerNotificationEmail) {
          await Email.sendNewApplicationNotification(
            ownerNotificationEmail,
            applicantName,
            email,
            experience
          );
        }

        // Send push notification
        if (owner.expoPushToken) {
          await PushNotification.sendPushNewApplication(
            owner.expoPushToken,
            applicantName
          );
        }

        // Add in-app notification
        const notification = {
          id: Date.now().toString() + "-" + owner.id,
          type: "new_application",
          title: "New Cleaner Application",
          message: `${applicantName} has submitted a new cleaner application. Review it in the owner dashboard.`,
          applicantName,
          applicantEmail: email,
          read: false,
          createdAt: new Date().toISOString(),
        };

        const currentNotifications = owner.notifications || [];
        // Handle case where notifications might be stored as strings
        const notificationsArray = Array.isArray(currentNotifications)
          ? currentNotifications
          : [];

        await owner.update({
          notifications: [...notificationsArray, JSON.stringify(notification)],
        });
      }

      console.log(
        `✅ Notified ${owners.length} owner(s) about new application`
      );
    } catch (notifyError) {
      console.error("Error notifying owners:", notifyError);
      // Don't fail the application submission if notifications fail
    }

    return res.status(201).json({ applicationInfo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to connect to database" });
  }
});
// GET: fetch pending application count
applicationRouter.get("/pending-count", async (req, res) => {
  try {
    const count = await UserApplications.count({
      where: { status: "pending" },
    });
    return res.status(200).json({ count });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch pending count", count: 0 });
  }
});

// GET: fetch all applications (Owner or HR only)
applicationRouter.get("/all-applications", async (req, res) => {
  try {
    const auth = await verifyOwnerOrHR(req);
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const applications = await UserApplications.findAll({
      order: [["createdAt", "DESC"]],
    });
    const serializedApplications =
      ApplicationSerializer.serializeArray(applications);
    return res.status(200).json({ serializedApplications });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// DELETE: delete a specific application by ID (Owner or HR only)
applicationRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const auth = await verifyOwnerOrHR(req);
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const application = await UserApplications.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    await UserApplications.destroy({ where: { id } });
    return res
      .status(200)
      .json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete application" });
  }
});

// PATCH: update application status (Owner or HR only)
// On approval: creates cleaner account
// On rejection: sends rejection email
// If HR makes the decision, owner is notified
applicationRouter.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  const validStatuses = [
    "pending",
    "under_review",
    "background_check",
    "approved",
    "rejected",
    "hired",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    // Verify authorization
    const auth = await verifyOwnerOrHR(req);
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const caller = auth.caller;

    // Find application
    const application = await UserApplications.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Prevent changing status of already hired applications
    if (application.status === "hired") {
      return res.status(400).json({ error: "Cannot change status of hired application" });
    }

    // Handle APPROVAL - just update status, account creation happens when hired
    if (status === "approved") {
      await application.update({
        status: "approved",
        reviewedBy: caller.id,
        reviewedAt: new Date(),
      });

      console.log(`✅ Application ${id} approved`);

      return res.status(200).json({
        message: "Application approved",
        application: ApplicationSerializer.serializeOne(application),
      });
    }

    // Handle REJECTION
    if (status === "rejected") {
      // Update application with rejection details
      await application.update({
        status: "rejected",
        rejectionReason: rejectionReason || null,
        reviewedBy: caller.id,
        reviewedAt: new Date(),
      });

      // Send rejection email to applicant
      await Email.sendApplicationRejected(
        application.email,
        application.firstName,
        application.lastName,
        rejectionReason
      );

      // If HR made the decision, notify owner
      if (caller.type === "humanResources") {
        const owners = await User.findAll({
          where: { type: "owner" },
        });
        const hrName = `${caller.firstName || ""} ${caller.lastName || ""}`.trim() || caller.username;
        const applicantName = `${application.firstName} ${application.lastName}`;

        for (const owner of owners) {
          const ownerEmail = owner.getNotificationEmail();
          if (ownerEmail) {
            await Email.sendHRHiringNotification(
              ownerEmail,
              hrName,
              applicantName,
              application.email,
              "rejected",
              rejectionReason
            );
          }
        }
      }

      console.log(`✅ Application ${id} rejected`);

      return res.status(200).json({
        message: "Application rejected",
        application: ApplicationSerializer.serializeOne(application),
      });
    }

    // Handle other status changes (under_review, background_check, pending)
    await application.update({
      status,
      reviewedBy: caller.id,
      reviewedAt: new Date(),
    });

    console.log(`✅ Application ${id} status updated to ${status}`);

    return res.status(200).json({
      message: "Status updated successfully",
      status,
      application: ApplicationSerializer.serializeOne(application),
    });
  } catch (error) {
    console.error("Error updating application status:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

// POST: hire applicant - creates employee account and sets status to hired (Owner or HR only)
applicationRouter.post("/:id/hire", async (req, res) => {
  const { id } = req.params;
  const { username, password, email, firstName, lastName, phone } = req.body;

  try {
    // Verify authorization
    const auth = await verifyOwnerOrHR(req);
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const caller = auth.caller;

    // Find application
    const application = await UserApplications.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Prevent hiring already hired applications
    if (application.status === "hired") {
      return res.status(400).json({ error: "Application has already been hired" });
    }

    // Check for existing email
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ error: "An account already has this email" });
    }

    // Check for existing username
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(410).json({ error: "Username already exists" });
    }

    // Create cleaner user account
    const newUser = await User.create({
      firstName: firstName || application.firstName,
      lastName: lastName || application.lastName,
      username,
      password, // Will be hashed by model's beforeCreate hook
      email: email || application.email,
      phone: phone || application.phone || null,
      type: "cleaner",
      notifications: ["phone", "email"],
    });

    // Create UserBills record
    await UserBills.create({
      userId: newUser.id,
      appointmentDue: 0,
      cancellationFee: 0,
      totalDue: 0,
    });

    // Process referral if application had a referral code
    try {
      // Generate a referral code for the new cleaner
      await ReferralService.generateReferralCode(newUser, models);

      // If application had a referral code, create the referral record
      if (application.referralCode) {
        const validation = await ReferralService.validateReferralCode(
          application.referralCode,
          "cleaner",
          models
        );
        if (validation.valid) {
          await ReferralService.createReferral(
            application.referralCode,
            newUser,
            validation.programType,
            validation.rewards,
            models
          );
          console.log(`✅ Referral created for cleaner ${newUser.username} using code ${application.referralCode}`);
        }
      }
    } catch (referralError) {
      // Don't fail the hire process if referral processing fails
      console.error("Error processing referral during hire:", referralError);
    }

    // Update application with hired details
    await application.update({
      status: "hired",
      userId: newUser.id,
      reviewedBy: caller.id,
      reviewedAt: new Date(),
    });

    // Send welcome email to new cleaner with credentials
    await Email.sendEmailCongragulations(
      newUser.firstName,
      newUser.lastName,
      username,
      password,
      newUser.email,
      "cleaner"
    );

    // If HR made the decision, notify owner
    if (caller.type === "humanResources") {
      const owners = await User.findAll({
        where: { type: "owner" },
      });
      const hrName = `${caller.firstName || ""} ${caller.lastName || ""}`.trim() || caller.username;
      const applicantName = `${newUser.firstName} ${newUser.lastName}`;

      for (const owner of owners) {
        const ownerEmail = owner.getNotificationEmail();
        if (ownerEmail) {
          await Email.sendHRHiringNotification(
            ownerEmail,
            hrName,
            applicantName,
            newUser.email,
            "hired"
          );
        }
      }
    }

    console.log(`✅ Application ${id} hired, cleaner account created: ${username}`);

    return res.status(201).json({
      message: "Applicant hired and cleaner account created",
      application: ApplicationSerializer.serializeOne(application),
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
    });
  } catch (error) {
    console.error("Error hiring applicant:", error);
    return res.status(500).json({ error: "Failed to hire applicant" });
  }
});

// PATCH: update application admin notes (Owner or HR only)
applicationRouter.patch("/:id/notes", async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  try {
    const auth = await verifyOwnerOrHR(req);
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error });
    }

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

// GET: fetch single application by ID (Owner or HR only)
applicationRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const auth = await verifyOwnerOrHR(req);
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const application = await UserApplications.findByPk(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.status(200).json({ application: ApplicationSerializer.serializeOne(application) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch application" });
  }
});

module.exports = applicationRouter;
