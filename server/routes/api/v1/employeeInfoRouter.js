const express = require("express");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const HomeSerializer = require("../../../serializers/homesSerializer");
const ReviewSerializer = require("../../../serializers/ReviewSerializer");
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
        isPaused: { [Op.ne]: true }, // Exclude paused appointments (homeowner frozen)
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

// Note: /home/LL/:id must come BEFORE /home/:id to avoid route interception
employeeInfoRouter.get("/home/LL/:id", async (req, res) => {
  // Authentication check
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  const { id } = req.params;

  try {
    // Verify token and get user ID
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Verify user is assigned to an appointment at this home
    const isAssigned = await UserCleanerAppointments.findOne({
      include: [{
        model: UserAppointments,
        as: "appointment",
        where: { homeId: id },
        required: true,
      }],
      where: { employeeId: userId },
    });

    // Also allow homeowners to access their own home coordinates
    const home = await UserHomes.findOne({
      where: { id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    const isHomeOwner = home.userId === userId;

    if (!isAssigned && !isHomeOwner) {
      return res.status(403).json({ error: "You don't have permission to access this home's location" });
    }

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
    console.error(error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(500).json({ error: "Error fetching coordinates" });
  }
});

employeeInfoRouter.get("/home/:id", async (req, res) => {
  // Authentication check
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  const { id } = req.params;

  try {
    // Verify token and get user ID
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Find the home first
    const home = await UserHomes.findOne({
      where: { id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Check if user is the homeowner
    const isHomeOwner = home.userId === userId;

    // Check if user is assigned to an appointment at this home
    const isAssigned = await UserCleanerAppointments.findOne({
      include: [{
        model: UserAppointments,
        as: "appointment",
        where: { homeId: id },
        required: true,
      }],
      where: { employeeId: userId },
    });

    if (!isHomeOwner && !isAssigned) {
      return res.status(403).json({ error: "You don't have permission to view this home" });
    }

    return res.status(200).json({ home: HomeSerializer.serializeOne(home) });
  } catch (error) {
    console.error(error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(500).json({ error: "Failed to fetch home" });
  }
});

employeeInfoRouter.get("/employeeSchedule", async (req, res) => {
  // Authentication check
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    // Verify token and get user ID
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Verify user is an owner (admin) - only owners can view all employee schedules
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.type !== "owner") {
      return res.status(403).json({ error: "Owner access required to view all employee schedules" });
    }

    const employees = await User.findAll({
      where: {
        type: "cleaner",
      },
    });
    return res.status(200).json({ employees: employees.map(e => UserSerializer.serializeOne(e.dataValues || e)) });
  } catch (error) {
    console.error(error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(500).json({ error: "Failed to fetch employee schedules" });
  }
});

// Get cleaner profile with reviews by ID
// Requires authentication - homeowners can view cleaner profiles when selecting cleaners
employeeInfoRouter.get("/cleaner/:id", async (req, res) => {
  // Authentication check
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  const { id } = req.params;
  const { UserReviews } = require("../../../models");

  try {
    // Verify token
    const decodedToken = jwt.verify(token, secretKey);
    // Token is valid - any authenticated user can view cleaner profiles

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

    // Verify the requested user is actually a cleaner
    if (cleaner.type !== "cleaner") {
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
      reviews: ReviewSerializer.serializeArray(cleaner.reviews || []),
      completedJobs: completedAppointments,
      totalReviews: cleaner.reviews?.length || 0,
      memberSince: cleaner.createdAt,
    };

    return res.status(200).json({ cleaner: serializedCleaner });
  } catch (error) {
    console.error(error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
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
    return res.status(201).json({ user: UserSerializer.serializeOne(user.dataValues || user) });
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
