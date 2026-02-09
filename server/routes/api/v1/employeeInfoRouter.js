const express = require("express");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const {
  User,
  UserHomes,
  UserAppointments,
  UserCleanerAppointments,
  UserBills,
  UserReviews,
  MultiCleanerJob,
  CleanerRoomAssignment,
} = require("../../../models");

const HomeClass = require("../../../services/HomeClass");
const EncryptionService = require("../../../services/EncryptionService");
const { Op } = require("sequelize");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");

const employeeInfoRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

employeeInfoRouter.get("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    let employee = await User.findByPk(userId, {
      include: [
        {
          model: UserCleanerAppointments,
          as: "cleanerAppointments",
        },
      ],
    });

    if (!employee) {
      return res.status(401).json({ error: "User not found" });
    }

    const appointmentIds = (employee.dataValues.cleanerAppointments || []).map(
      (appointment) => appointment.appointmentId
    );
    const appointments = await UserAppointments.findAll({
      where: {
        id: appointmentIds,
        wasCancelled: false, // Exclude cancelled appointments
      },
      include: [
        {
          model: MultiCleanerJob,
          as: "multiCleanerJob",
          required: false,
        },
      ],
    });

    // Get all cleaner reviews for these appointments
    const cleanerReviews = await UserReviews.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        reviewerId: userId,
        reviewType: "cleaner_to_homeowner",
      },
      attributes: ["appointmentId"],
    });
    const reviewedAppointmentIds = new Set(cleanerReviews.map((r) => r.appointmentId));

    // Get room assignments for multi-cleaner jobs
    const multiCleanerAppointmentIds = appointments
      .filter((apt) => apt.isMultiCleanerJob)
      .map((apt) => apt.id);

    let roomAssignmentsByAppointment = {};
    if (multiCleanerAppointmentIds.length > 0) {
      const roomAssignments = await CleanerRoomAssignment.findAll({
        where: {
          appointmentId: { [Op.in]: multiCleanerAppointmentIds },
          cleanerId: userId,
        },
      });
      // Group by appointmentId
      roomAssignments.forEach((ra) => {
        if (!roomAssignmentsByAppointment[ra.appointmentId]) {
          roomAssignmentsByAppointment[ra.appointmentId] = [];
        }
        roomAssignmentsByAppointment[ra.appointmentId].push({
          roomType: ra.roomType,
          roomNumber: ra.roomNumber,
          roomLabel: ra.roomLabel,
        });
      });
    }

    // Add hasCleanerReview to each appointment and include multiCleanerJob data
    const appointmentsWithReviewStatus = appointments
      .map((apt) => ({
        ...apt.dataValues,
        hasCleanerReview: reviewedAppointmentIds.has(apt.id),
        // Include multiCleanerJob data for display
        multiCleanerJob: apt.multiCleanerJob ? {
          id: apt.multiCleanerJob.id,
          totalCleanersRequired: apt.multiCleanerJob.totalCleanersRequired,
          cleanersConfirmed: apt.multiCleanerJob.cleanersConfirmed,
          status: apt.multiCleanerJob.status,
          primaryCleanerId: apt.multiCleanerJob.primaryCleanerId,
        } : null,
        // Include room assignments for multi-cleaner jobs
        cleanerRoomAssignments: roomAssignmentsByAppointment[apt.id] || null,
      }))
      // Filter out completed appointments that have been reviewed by cleaner
      .filter((apt) => !(apt.completed && apt.hasCleanerReview));

    const serializedAppointments = await AppointmentSerializer.serializeArray(
      appointmentsWithReviewStatus
    );
    const serializedEmployee = UserSerializer.serializeOne(employee.dataValues);
    serializedEmployee.cleanerAppointments = serializedAppointments;
    return res.status(200).json({ employee: serializedEmployee });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

employeeInfoRouter.get("/home/:id", async (req, res) => {
  const { id } = req.params;
  try {
    let home = await UserHomes.findOne({
      where: {
        id,
      },
    });

    return res.status(200).json({ home });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

employeeInfoRouter.get("/home/LL/:id", async (req, res) => {
  const { id } = req.params;
  try {
    let home = await UserHomes.findOne({
      where: {
        id,
      },
    });

    // Use stored coordinates if available
    if (home.latitude && home.longitude) {
      return res.status(200).json({
        latitude: parseFloat(home.latitude),
        longitude: parseFloat(home.longitude),
      });
    }

    // Fallback to ZIP code lookup for old homes without coordinates
    const { latitude, longitude } = await HomeClass.getLatAndLong(EncryptionService.decrypt(home.zipcode));
    return res.status(200).json({ latitude, longitude });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Error fetching coordinates" });
  }
});

employeeInfoRouter.get("/employeeSchedule", async (req, res) => {
  try {
    const employees = await User.findAll({
      where: {
        type: "cleaner",
      },
    });
    return res.status(200).json({ employees });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Get cleaner profile with reviews by ID
employeeInfoRouter.get("/cleaner/:id", async (req, res) => {
  const { id } = req.params;
  const { UserReviews } = require("../../../models");

  try {
    const cleaner = await User.findByPk(id, {
      include: [
        {
          model: UserReviews,
          as: "reviews",
        },
        {
          model: UserCleanerAppointments,
          as: "cleanerAppointments",
        },
      ],
    });

    if (!cleaner) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    // Count total completed appointments
    const completedAppointments = await UserAppointments.count({
      where: {
        completed: true,
        employeesAssigned: {
          [Op.contains]: [String(id)],
        },
      },
    });

    const serializedCleaner = {
      id: cleaner.id,
      username: cleaner.username,
      type: cleaner.type,
      daysWorking: cleaner.daysWorking || [],
      reviews: cleaner.reviews || [],
      completedJobs: completedAppointments,
      totalReviews: cleaner.reviews?.length || 0,
      memberSince: cleaner.createdAt,
    };

    return res.status(200).json({ cleaner: serializedCleaner });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Server error" });
  }
});

employeeInfoRouter.post("/shifts", async (req, res) => {
  const { token } = req.body.user;
  const daysArray = req.body.days;
  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const user = await User.findOne({
      where: { id: userId },
    });
    await user.update({
      daysWorking: daysArray,
    });
    return res.status(201).json({ user });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

/**
 * GET /bonuses - Get bonuses received by the employee
 */
employeeInfoRouter.get("/bonuses", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const EmployeeBonusService = require("../../../services/EmployeeBonusService");
    const bonuses = await EmployeeBonusService.getBonusesForEmployee(userId, {
      limit: parseInt(req.query.limit) || 50,
      includePending: req.query.includePending === "true",
    });

    res.json(bonuses);
  } catch (error) {
    console.error("Error fetching employee bonuses:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = employeeInfoRouter;
