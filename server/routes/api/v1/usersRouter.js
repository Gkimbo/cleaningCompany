const express = require("express");
const {
  User,
  UserBills,
  UserAppointments,
  UserCleanerAppointments,
  UserPendingRequests,
} = require("../../../models");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const Email = require("../../../services/sendNotifications/EmailClass");
const { Op } = require("sequelize");

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
          notifications: ["phone", "email"],
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
    const { username, password, email, type, firstName, lastName } = req.body;
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

        console.log(`✅ New employee created and welcome email sent to ${email}`);
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

    await UserCleanerAppointments.destroy({
      where: {
        employeeId: userId,
      },
    });

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

    const requestedAppointments = await UserAppointments.findAll({
      where: {
        id: Array.from(requestedAppointmentIds),
        hasBeenAssigned: false,
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
    console.log(`✅ Username updated for user ${userId}: ${username}`);

    return res.status(200).json({ message: "Username updated successfully", username });
  } catch (error) {
    console.error("Error updating username:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
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

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
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
    return res.status(500).json({ error: "Failed to update password" });
  }
});

module.exports = usersRouter;
