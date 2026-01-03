const express = require("express");
const models = require("../../../models");
const {
  User,
  UserBills,
  UserAppointments,
  UserCleanerAppointments,
  UserPendingRequests,
  UserReviews,
  TermsAndConditions,
  UserTermsAcceptance,
  Conversation,
  ConversationParticipant,
} = models;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const Email = require("../../../services/sendNotifications/EmailClass");
const ReferralService = require("../../../services/ReferralService");
const { Op } = require("sequelize");

const secretKey = process.env.SESSION_SECRET;

const usersRouter = express.Router();

// Password strength validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!password || password.length < minLength) {
    return "Password must be at least 8 characters";
  }
  if (!hasUpperCase) {
    return "Password must contain an uppercase letter";
  }
  if (!hasLowerCase) {
    return "Password must contain a lowercase letter";
  }
  if (!hasNumbers) {
    return "Password must contain a number";
  }
  if (!hasSpecialChar) {
    return "Password must contain a special character (!@#$%^&*(),.?\":{}|<>)";
  }
  return null;
};

usersRouter.post("/", async (req, res) => {
  try {
    const { firstName, lastName, username, password, email, termsId, privacyPolicyId, referralCode } = req.body;

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Validate username doesn't contain "owner"
    if (username && username.toLowerCase().includes("owner")) {
      return res.status(400).json("Username cannot contain the word 'owner'");
    }

    let existingUser = null;
    existingUser = await User.findOne({ where: { email } });
    if (!existingUser) {
      existingUser = await User.findOne({ where: { username } });
      if (!existingUser) {
        // Get terms version if termsId provided
        let termsVersion = null;
        let termsRecord = null;
        if (termsId) {
          termsRecord = await TermsAndConditions.findByPk(termsId);
          if (termsRecord) {
            termsVersion = termsRecord.version;
          }
        }

        // Get privacy policy version if privacyPolicyId provided
        let privacyVersion = null;
        let privacyRecord = null;
        if (privacyPolicyId) {
          privacyRecord = await TermsAndConditions.findByPk(privacyPolicyId);
          if (privacyRecord) {
            privacyVersion = privacyRecord.version;
          }
        }

        const newUser = await User.create({
          firstName,
          lastName,
          username,
          password,
          email,
          notifications: ["phone", "email"],
          termsAcceptedVersion: termsVersion,
          privacyPolicyAcceptedVersion: privacyVersion,
        });
        const newBill = await UserBills.create({
          userId: newUser.dataValues.id,
          appointmentDue: 0,
          cancellationFee: 0,
          totalDue: 0,
        });

        const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

        // Record terms acceptance if terms were accepted
        if (termsId && termsRecord) {
          await UserTermsAcceptance.create({
            userId: newUser.dataValues.id,
            termsId,
            acceptedAt: new Date(),
            ipAddress,
            termsContentSnapshot: termsRecord.contentType === "text" ? termsRecord.content : null,
          });
        }

        // Record privacy policy acceptance if privacy policy was accepted
        if (privacyPolicyId && privacyRecord) {
          await UserTermsAcceptance.create({
            userId: newUser.dataValues.id,
            termsId: privacyPolicyId,
            acceptedAt: new Date(),
            ipAddress,
            termsContentSnapshot: privacyRecord.contentType === "text" ? privacyRecord.content : null,
          });
        }

        // Process referral code if provided
        if (referralCode) {
          try {
            // Validate the referral code
            const validation = await ReferralService.validateReferralCode(
              referralCode,
              "homeowner",
              models
            );

            if (validation.valid) {
              // Generate a referral code for the new user first
              await ReferralService.generateReferralCode(newUser, models);

              // Create the referral record
              await ReferralService.createReferral(
                referralCode,
                newUser,
                validation.programType,
                validation.rewards,
                models
              );
              console.log(`[Referral] New user ${newUser.id} referred by code ${referralCode}`);
            }
          } catch (referralError) {
            // Don't fail signup if referral processing fails
            console.error("[Referral] Error processing referral:", referralError.message);
          }
        } else {
          // Generate a referral code for new user even without being referred
          try {
            await ReferralService.generateReferralCode(newUser, models);
          } catch (codeError) {
            console.error("[Referral] Error generating code:", codeError.message);
          }
        }

        await newUser.update({ lastLogin: new Date() });
        const serializedUser = UserSerializer.login(newUser.dataValues);
        const token = jwt.sign({ userId: serializedUser.id }, secretKey, { expiresIn: '24h' });
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

// POST /api/v1/users/business-owner - Business owner self-registration
usersRouter.post("/business-owner", async (req, res) => {
  try {
    const { firstName, lastName, username, password, email, phone, businessName, yearsInBusiness } = req.body;

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Validate username doesn't contain "owner"
    if (username && username.toLowerCase().includes("owner")) {
      return res.status(400).json({ error: "Username cannot contain the word 'owner'" });
    }

    // Validate required fields
    if (!firstName || !lastName || !email || !username || !password) {
      return res.status(400).json({ error: "First name, last name, email, username, and password are required" });
    }

    // Check for existing email
    let existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "An account already has this email" });
    }

    // Check for existing username
    existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(410).json({ error: "Username already exists" });
    }

    // Create business owner account (type: cleaner, isBusinessOwner: true)
    const newUser = await User.create({
      firstName,
      lastName,
      username,
      password,
      email,
      phone: phone || null,
      type: "cleaner",
      isBusinessOwner: true,
      businessName: businessName || null,
      yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness, 10) : null,
      notifications: ["phone", "email"],
    });

    // Create billing record
    await UserBills.create({
      userId: newUser.id,
      appointmentDue: 0,
      cancellationFee: 0,
      totalDue: 0,
    });

    // Generate referral code for the business owner
    try {
      await ReferralService.generateReferralCode(newUser, models);
    } catch (codeError) {
      console.error("[Referral] Error generating code for business owner:", codeError.message);
    }

    await newUser.update({ lastLogin: new Date() });

    const serializedUser = UserSerializer.login(newUser.dataValues);
    const token = jwt.sign({ userId: serializedUser.id }, secretKey, { expiresIn: '24h' });

    console.log(`✅ New business owner account created: ${username}`);

    return res.status(201).json({ user: serializedUser, token });
  } catch (error) {
    console.error("Error creating business owner account:", error);
    return res.status(500).json({ error: "Failed to create account" });
  }
});

usersRouter.post("/new-employee", async (req, res) => {
  try {
    const { username, password, email, type, firstName, lastName, phone } = req.body;
    let existingUser = null;
    existingUser = await User.findOne({ where: { email } });
    if (!existingUser) {
      existingUser = await User.findOne({ where: { username } });
      if (!existingUser) {
        const newUser = await User.create({
          firstName: firstName || "",
          lastName: lastName || "",
          username,
          password,
          email,
          type,
          phone: phone || null,
          notifications: ["phone", "email"],
        });
        const newBill = await UserBills.create({
          userId: newUser.dataValues.id,
          appointmentDue: 0,
          cancellationFee: 0,
          totalDue: 0,
        });
        await newUser.update({ lastLogin: new Date() });
        const serializedUser = UserSerializer.serializeOne(newUser.dataValues);

        // Send welcome email with login credentials
        const employeeFirstName = firstName || username;
        const employeeLastName = lastName || "";

        await Email.sendEmailCongragulations(
          employeeFirstName,
          employeeLastName,
          username,
          password,
          email,
          type,
        );

        console.log(`✅ New employee created and welcome email sent`);
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

// POST /api/v1/users/new-hr - Owner creates HR account
usersRouter.post("/new-hr", async (req, res) => {
  try {
    const { firstName, lastName, username, password, email, phone } = req.body;

    // Verify caller is owner
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const caller = await User.findByPk(decoded.userId);
    if (!caller || caller.type !== "owner") {
      return res.status(403).json({ error: "Only owner can create HR accounts" });
    }

    // Validate required fields
    if (!username || !password || !email) {
      return res.status(400).json({ error: "Username, password, and email are required" });
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Check if username or email already exists
    let existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(410).json({ error: "Username already exists" });
    }

    // Create HR user (password is hashed by User model's beforeCreate hook)
    const newUser = await User.create({
      firstName: firstName || "",
      lastName: lastName || "",
      username,
      password,
      email,
      phone: phone || null,
      type: "humanResources",
      notifications: ["phone", "email"],
    });

    // Create UserBills record
    await UserBills.create({
      userId: newUser.id,
      appointmentDue: 0,
      cancellationFee: 0,
      totalDue: 0,
    });

    // Add HR user to all existing support conversations
    const supportConversations = await Conversation.findAll({
      where: { conversationType: "support" },
    });

    for (const conv of supportConversations) {
      await ConversationParticipant.findOrCreate({
        where: {
          conversationId: conv.id,
          userId: newUser.id,
        },
      });
    }

    // Add HR user to existing "HR Team" internal conversation if it exists
    const hrGroupConvo = await Conversation.findOne({
      where: { conversationType: "internal", title: "HR Team" },
    });
    if (hrGroupConvo) {
      await ConversationParticipant.findOrCreate({
        where: {
          conversationId: hrGroupConvo.id,
          userId: newUser.id,
        },
      });
      console.log(`✅ Added new HR to existing HR Team conversation`);
    }

    // Send welcome email with credentials
    const hrFirstName = firstName || username;
    const hrLastName = lastName || "";

    await Email.sendEmailCongragulations(
      hrFirstName,
      hrLastName,
      username,
      password,
      email,
      "humanResources"
    );

    console.log(`✅ New HR account created: ${username}`);

    const serializedUser = UserSerializer.serializeOne(newUser.dataValues);
    return res.status(201).json({ user: serializedUser });
  } catch (error) {
    console.error("Error creating HR account:", error);
    res.status(500).json({ error: "Failed to create HR account" });
  }
});

// GET /api/v1/users/hr-staff - Owner gets list of all HR employees
usersRouter.get("/hr-staff", async (req, res) => {
  try {
    // Verify caller is owner
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const caller = await User.findByPk(decoded.userId);
    if (!caller || caller.type !== "owner") {
      return res.status(403).json({ error: "Only owner can access HR staff list" });
    }

    // Fetch all HR employees
    const hrStaff = await User.findAll({
      where: { type: "humanResources" },
      order: [["createdAt", "DESC"]],
    });

    // Explicitly decrypt PII fields (afterFind hook should handle this, but ensure it's done)
    const EncryptionService = require("../../../services/EncryptionService");
    const serializedHrStaff = hrStaff.map((user) => ({
      id: user.id,
      firstName: EncryptionService.decrypt(user.firstName),
      lastName: EncryptionService.decrypt(user.lastName),
      username: user.username,
      email: EncryptionService.decrypt(user.email),
      phone: user.phone ? EncryptionService.decrypt(user.phone) : null,
      createdAt: user.createdAt,
    }));

    return res.status(200).json({ hrStaff: serializedHrStaff });
  } catch (error) {
    console.error("Error fetching HR staff:", error);
    return res.status(500).json({ error: "Failed to fetch HR staff" });
  }
});

// PATCH /api/v1/users/hr-staff/:id - Owner updates HR employee details
usersRouter.patch("/hr-staff/:id", async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone } = req.body;

  try {
    // Verify caller is owner
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const caller = await User.findByPk(decoded.userId);
    if (!caller || caller.type !== "owner") {
      return res.status(403).json({ error: "Only owner can update HR staff" });
    }

    // Find the HR employee
    const hrUser = await User.findByPk(id);
    if (!hrUser) {
      return res.status(404).json({ error: "HR employee not found" });
    }

    if (hrUser.type !== "humanResources") {
      return res.status(400).json({ error: "User is not an HR employee" });
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address" });
      }

      // Check if email is already taken by another user
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(409).json({ error: "Email is already in use" });
      }
    }

    // Update HR employee details
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;

    await hrUser.update(updateData);

    console.log(`✅ HR employee ${id} updated by owner ${caller.id}`);

    // Decrypt PII fields for response
    const EncryptionService = require("../../../services/EncryptionService");
    return res.status(200).json({
      message: "HR employee updated successfully",
      user: {
        id: hrUser.id,
        firstName: EncryptionService.decrypt(hrUser.firstName),
        lastName: EncryptionService.decrypt(hrUser.lastName),
        username: hrUser.username,
        email: EncryptionService.decrypt(hrUser.email),
        phone: hrUser.phone ? EncryptionService.decrypt(hrUser.phone) : null,
      },
    });
  } catch (error) {
    console.error("Error updating HR employee:", error);
    return res.status(500).json({ error: "Failed to update HR employee" });
  }
});

// DELETE /api/v1/users/hr-staff/:id - Owner removes HR employee
usersRouter.delete("/hr-staff/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Verify caller is owner
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const caller = await User.findByPk(decoded.userId);
    if (!caller || caller.type !== "owner") {
      return res.status(403).json({ error: "Only owner can remove HR staff" });
    }

    // Find the HR employee
    const hrUser = await User.findByPk(id);
    if (!hrUser) {
      return res.status(404).json({ error: "HR employee not found" });
    }

    if (hrUser.type !== "humanResources") {
      return res.status(400).json({ error: "User is not an HR employee" });
    }

    // Remove associated records
    await UserBills.destroy({ where: { userId: id } });
    await ConversationParticipant.destroy({ where: { userId: id } });

    // Cancel any referrals associated with this user
    const { Referral } = models;
    if (Referral) {
      // Cancel referrals where this user was the referrer
      await Referral.update(
        { status: "cancelled" },
        { where: { referrerId: id, status: { [Op.in]: ["pending", "qualified"] } } }
      );
      // Cancel referrals where this user was referred
      await Referral.update(
        { status: "cancelled" },
        { where: { referredId: id, status: { [Op.in]: ["pending", "qualified"] } } }
      );
    }

    // Delete the HR user
    await hrUser.destroy();

    console.log(`✅ HR employee ${id} removed by owner ${caller.id}`);

    return res.status(200).json({ message: "HR employee removed successfully" });
  } catch (error) {
    console.error("Error removing HR employee:", error);
    return res.status(500).json({ error: "Failed to remove HR employee" });
  }
});

usersRouter.get("/employees", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
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
  const { id, username, password, email, type, firstName, lastName, phone } = req.body;
  try {
    const userInfo = await UserInfo.editEmployeeInDB({
      id,
      username,
      password,
      email,
      type,
      firstName,
      lastName,
      phone,
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
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const requesterId = decodedToken.userId;

    // Verify requester is an owner
    const requester = await User.findByPk(requesterId);
    if (!requester || requester.type !== "owner") {
      return res.status(403).json({ error: "Only owners can delete employees" });
    }

    const userId = req.body.id;
    if (!userId) {
      return res.status(400).json({ error: "Employee ID is required" });
    }

    // Verify employee exists
    const employee = await User.findByPk(userId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Don't allow deleting owners
    if (employee.type === "owner") {
      return res.status(403).json({ error: "Cannot delete owner accounts" });
    }

    // Clean up related records
    await UserBills.destroy({
      where: {
        userId: userId,
      },
    });

    await UserCleanerAppointments.destroy({
      where: {
        employeeId: userId,
      },
    });

    // Remove employee from any pending requests
    await UserPendingRequests.destroy({
      where: {
        employeeId: userId,
      },
    });

    // Store reviewer name on reviews written BY this employee before deletion
    // This preserves the name even after reviewerId is set to NULL by cascade
    const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username;
    await UserReviews.update(
      { reviewerName: employeeName },
      { where: { reviewerId: userId, reviewerName: null } }
    );

    // Delete reviews where employee is the subject (reviews about them)
    // Reviews written BY the employee will have reviewerId set to NULL by database cascade
    await UserReviews.destroy({
      where: {
        userId: userId,
      },
    });

    // Update appointments to remove this employee from assigned lists
    const appointmentsToUpdate = await UserAppointments.findAll({
      where: {
        employeesAssigned: {
          [Op.contains]: [String(userId)],
        },
      },
    });

    for (const appointment of appointmentsToUpdate) {
      let employees = Array.isArray(appointment.employeesAssigned)
        ? [...appointment.employeesAssigned]
        : [];

      const updatedEmployees = employees.filter(
        (empId) => empId !== String(userId)
      );

      if (updatedEmployees.length !== employees.length) {
        await appointment.update({
          employeesAssigned: updatedEmployees,
        });
      }
    }

    // Cancel any referrals associated with this user
    const { Referral } = models;
    if (Referral) {
      // Cancel referrals where this user was the referrer
      await Referral.update(
        { status: "cancelled" },
        { where: { referrerId: userId, status: { [Op.in]: ["pending", "qualified"] } } }
      );
      // Cancel referrals where this user was referred
      await Referral.update(
        { status: "cancelled" },
        { where: { referredId: userId, status: { [Op.in]: ["pending", "qualified"] } } }
      );
    }

    // Delete the user (cascading deletes should handle StripeConnectAccount, Payouts, etc.)
    const deleted = await User.destroy({
      where: {
        id: userId,
      },
    });

    if (deleted === 0) {
      return res.status(404).json({ error: "Employee not found or already deleted" });
    }

    return res.status(200).json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(500).json({ error: "Failed to delete employee" });
  }
});
usersRouter.get("/appointments", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
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

usersRouter.get("/appointments/employee", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const userAppointments = await UserAppointments.findAll();

    const requestsForCleaning = await UserPendingRequests.findAll({
      where: { employeeId: userId },
    });

    const requestedAppointmentIds = new Set(
      requestsForCleaning.map((req) => req.dataValues.appointmentId)
    );

    const filteredAppointments = userAppointments.filter((appointment) => {
      const assignedEmployees = appointment.dataValues.employeesAssigned;
      return (
        !requestedAppointmentIds.has(appointment.dataValues.id) &&
        (assignedEmployees === null ||
          assignedEmployees.length === 0 ||
          assignedEmployees.includes(String(userId)))
      );
    });

    // Get appointments for pending requests only (not approved/denied)
    const pendingRequestIds = requestsForCleaning
      .filter((req) => req.dataValues.status === "pending")
      .map((req) => req.dataValues.appointmentId);

    const requestedAppointments = await UserAppointments.findAll({
      where: {
        id: pendingRequestIds,
      },
    });

    const serializedAppointments =
      AppointmentSerializer.serializeArray(filteredAppointments);

    const serializedRequests = AppointmentSerializer.serializeArray(
      requestedAppointments
    );

    return res.status(200).json({
      appointments: serializedAppointments,
      requested: serializedRequests,
    });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// PATCH: Update username
usersRouter.patch("/update-username", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const { username } = req.body;

    // Validate username
    if (!username || username.length < 4) {
      return res.status(400).json({ error: "Username must be at least 4 characters" });
    }

    if (username.length > 20) {
      return res.status(400).json({ error: "Username must be 20 characters or less" });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
    }

    // Check if username contains "owner" (restricted word)
    if (username.toLowerCase().includes("owner")) {
      return res.status(400).json({ error: "Username cannot contain the word 'owner'" });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    // Update username
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({ username });
    console.log(`✅ Username updated for user ${userId}`);

    return res.status(200).json({ message: "Username updated successfully", username });
  } catch (error) {
    console.error("Error updating username:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(500).json({ error: "Failed to update username" });
  }
});

// PATCH: Update password
usersRouter.patch("/update-password", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const { currentPassword, newPassword } = req.body;

    // Validate inputs
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }

    // Validate password strength
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Find user and verify current password
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValidPassword = await user.validPassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash and update new password
    const bcrypt = require("bcrypt");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await user.update({ password: hashedPassword });
    console.log(`✅ Password updated for user ${userId}`);

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(500).json({ error: "Failed to update password" });
  }
});

// PATCH: Update email
usersRouter.patch("/update-email", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const { email } = req.body;

    // Validate email format
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({ error: "This email is already associated with another account" });
    }

    // Find and update user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({ email });
    console.log(`✅ Email updated for user ${userId}`);

    return res.status(200).json({ message: "Email updated successfully", email });
  } catch (error) {
    console.error("Error updating email:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    return res.status(500).json({ error: "Failed to update email" });
  }
});

// PATCH: Update phone number
usersRouter.patch("/update-phone", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const { phone } = req.body;

    // Validate phone - allow empty string to clear phone number
    if (phone === undefined) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // If phone is provided (not empty), validate format
    if (phone && phone.length > 0) {
      // Remove all non-digit characters for validation
      const digitsOnly = phone.replace(/\D/g, "");

      // Must have 10-15 digits (supports international numbers)
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return res.status(400).json({ error: "Please enter a valid phone number (10-15 digits)" });
      }
    }

    // Find and update user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Store empty string as null in database
    const phoneToStore = phone && phone.length > 0 ? phone : null;
    await user.update({ phone: phoneToStore });
    console.log(`✅ Phone updated for user ${userId}`);

    return res.status(200).json({ message: "Phone number updated successfully", phone: phoneToStore });
  } catch (error) {
    console.error("Error updating phone:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    return res.status(500).json({ error: "Failed to update phone number" });
  }
});

// GET: Get preferred home IDs for the current cleaner
usersRouter.get("/preferred-homes", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const cleanerId = decodedToken.userId;

    // Get the HomePreferredCleaner model from models
    const { HomePreferredCleaner } = models;

    // Find all homes where this cleaner has preferred status
    const preferredRecords = await HomePreferredCleaner.findAll({
      where: { cleanerId },
      attributes: ["homeId"],
    });

    const preferredHomeIds = preferredRecords.map((record) => record.homeId);

    return res.status(200).json({ preferredHomeIds });
  } catch (error) {
    console.error("Error fetching preferred homes:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    return res.status(500).json({ error: "Failed to fetch preferred homes" });
  }
});

module.exports = usersRouter;
