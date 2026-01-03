/**
 * Recurring Schedules Router
 * API endpoints for managing recurring cleaning schedules
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const models = require("../../../models");
const {
  User,
  CleanerClient,
  UserHomes,
  RecurringSchedule,
  UserAppointments,
  UserCleanerAppointments,
  UserBills,
  Payout,
} = models;
const calculatePrice = require("../../../services/CalculatePrice");
const IncentiveService = require("../../../services/IncentiveService");
const EncryptionService = require("../../../services/EncryptionService");

const recurringSchedulesRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify cleaner access
const verifyCleaner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.type !== "cleaner") {
      return res.status(403).json({ error: "Cleaner access required" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * Generate appointments for a recurring schedule
 * Creates appointments up to a certain horizon based on frequency
 * @param {RecurringSchedule} schedule - The schedule to generate for
 * @param {number} weeksAhead - How many weeks ahead to generate (default: 4 for weekly, 8 for biweekly, 12 for monthly)
 * @returns {Array} Created appointments
 */
async function generateAppointmentsForSchedule(schedule, weeksAhead = null) {
  // Determine how far ahead to generate
  if (!weeksAhead) {
    weeksAhead = schedule.frequency === "weekly" ? 4 :
                 schedule.frequency === "biweekly" ? 8 : 12;
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + (weeksAhead * 7));

  // Get client and home for appointment creation
  const cleanerClient = await CleanerClient.findByPk(schedule.cleanerClientId, {
    include: [
      { model: User, as: "client" },
      { model: UserHomes, as: "home" },
    ],
  });

  if (!cleanerClient || !cleanerClient.client || !cleanerClient.home) {
    throw new Error("Client or home not found");
  }

  const client = cleanerClient.client;
  const home = cleanerClient.home;
  const createdAppointments = [];

  // Start from last generated date or start date
  let currentDate = schedule.lastGeneratedDate
    ? new Date(schedule.lastGeneratedDate)
    : new Date(schedule.startDate);
  currentDate.setDate(currentDate.getDate() + 1); // Start from day after

  // Calculate the platform fee percentage
  const platformFeePercent = await IncentiveService.calculateCleanerFee(
    schedule.cleanerId,
    models
  );

  while (currentDate <= horizon) {
    // Calculate next occurrence
    const nextDate = schedule.calculateNextDate(currentDate);

    if (!nextDate || nextDate > horizon) {
      break;
    }

    // Check if schedule is paused
    if (schedule.isPaused && schedule.pausedUntil) {
      if (nextDate <= new Date(schedule.pausedUntil)) {
        currentDate = new Date(nextDate);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
    }

    // Check for end date
    if (schedule.endDate && nextDate > new Date(schedule.endDate)) {
      break;
    }

    const dateString = nextDate.toISOString().split("T")[0];

    // Check if appointment already exists
    const existingAppointment = await UserAppointments.findOne({
      where: {
        homeId: home.id,
        date: dateString,
      },
    });

    if (!existingAppointment) {
      // Create the appointment
      const appointment = await UserAppointments.create({
        userId: client.id,
        homeId: home.id,
        date: dateString,
        price: schedule.price.toString(),
        originalPrice: schedule.price.toString(),
        completed: false,
        paid: false,
        hasBeenAssigned: true,
        employeesAssigned: [schedule.cleanerId.toString()],
        empoyeesNeeded: home.cleanersNeeded || 1,
        timeToBeCompleted: schedule.timeWindow || "anytime",
        bringSheets: home.bringSheets || "no",
        bringTowels: home.bringTowels || "no",
        keyPadCode: home.keyPadCode || null,
        keyLocation: home.keyLocation || null,
        bookedByCleanerId: schedule.cleanerId,
        recurringScheduleId: schedule.id,
        autoPayEnabled: cleanerClient.autoPayEnabled !== false,
        discountApplied: false,
      });

      // Create cleaner assignment
      await UserCleanerAppointments.create({
        appointmentId: appointment.id,
        employeeId: schedule.cleanerId,
      });

      // Update or create user bill
      let userBill = await UserBills.findOne({
        where: { userId: client.id },
      });

      const appointmentPrice = parseFloat(schedule.price);

      if (!userBill) {
        userBill = await UserBills.create({
          userId: client.id,
          appointmentDue: appointmentPrice,
          cancellationDue: 0,
          totalDue: appointmentPrice,
          appointmentPaid: 0,
          cancellationPaid: 0,
          totalPaid: 0,
        });
      } else {
        await userBill.update({
          appointmentDue: parseFloat(userBill.appointmentDue || 0) + appointmentPrice,
          totalDue: parseFloat(userBill.totalDue || 0) + appointmentPrice,
        });
      }

      // Create payout record
      const platformFee = appointmentPrice * (platformFeePercent / 100);
      const cleanerPayout = appointmentPrice - platformFee;

      await Payout.create({
        cleanerId: schedule.cleanerId,
        appointmentId: appointment.id,
        amount: cleanerPayout,
        platformFee: platformFee,
        status: "pending",
      });

      createdAppointments.push(appointment);

      // Update last generated date
      await schedule.update({ lastGeneratedDate: dateString });
    }

    // Move to next day after this occurrence
    currentDate = new Date(nextDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Update next scheduled date
  const nextScheduled = schedule.calculateNextDate(new Date());
  if (nextScheduled) {
    await schedule.update({
      nextScheduledDate: nextScheduled.toISOString().split("T")[0],
    });
  }

  return createdAppointments;
}

// =====================
// CLEANER ENDPOINTS
// =====================

/**
 * POST /
 * Create a new recurring schedule
 */
recurringSchedulesRouter.post("/", verifyCleaner, async (req, res) => {
  try {
    const {
      cleanerClientId,
      frequency,
      dayOfWeek,
      timeWindow,
      price,
      startDate,
      endDate,
    } = req.body;

    // Validate required fields
    if (!cleanerClientId) {
      return res.status(400).json({ error: "Client ID is required" });
    }
    if (!frequency || !["weekly", "biweekly", "monthly"].includes(frequency)) {
      return res.status(400).json({ error: "Valid frequency is required (weekly, biweekly, monthly)" });
    }
    if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: "Valid day of week is required (0-6)" });
    }
    if (!startDate) {
      return res.status(400).json({ error: "Start date is required" });
    }

    // Verify the cleaner-client relationship
    const cleanerClient = await CleanerClient.findOne({
      where: {
        id: cleanerClientId,
        cleanerId: req.user.id,
        status: "active",
      },
      include: [
        { model: User, as: "client" },
        { model: UserHomes, as: "home" },
      ],
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Active client relationship not found" });
    }

    if (!cleanerClient.client || !cleanerClient.home) {
      return res.status(400).json({ error: "Client must have account and home set up" });
    }

    // Calculate price if not provided
    let schedulePrice = price;
    if (!schedulePrice && cleanerClient.defaultPrice) {
      schedulePrice = cleanerClient.defaultPrice;
    }
    if (!schedulePrice) {
      schedulePrice = await calculatePrice(
        cleanerClient.home.bringSheets || "no",
        cleanerClient.home.bringTowels || "no",
        cleanerClient.home.numBeds,
        cleanerClient.home.numBaths,
        timeWindow || "anytime"
      );
    }

    // Create the recurring schedule
    const schedule = await RecurringSchedule.create({
      cleanerClientId,
      homeId: cleanerClient.home.id,
      cleanerId: req.user.id,
      clientId: cleanerClient.client.id,
      frequency,
      dayOfWeek,
      timeWindow: timeWindow || "anytime",
      price: schedulePrice,
      startDate,
      endDate: endDate || null,
      isActive: true,
      isPaused: false,
    });

    // Generate initial appointments
    const appointments = await generateAppointmentsForSchedule(schedule);

    res.status(201).json({
      success: true,
      message: `Recurring schedule created. ${appointments.length} appointments generated.`,
      schedule: {
        id: schedule.id,
        frequency: schedule.frequency,
        dayOfWeek: schedule.dayOfWeek,
        timeWindow: schedule.timeWindow,
        price: schedule.price,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        nextScheduledDate: schedule.nextScheduledDate,
        isActive: schedule.isActive,
      },
      appointmentsCreated: appointments.length,
    });
  } catch (err) {
    console.error("Error creating recurring schedule:", err);
    res.status(500).json({ error: "Failed to create recurring schedule" });
  }
});

/**
 * GET /
 * Get all recurring schedules for the cleaner
 */
recurringSchedulesRouter.get("/", verifyCleaner, async (req, res) => {
  try {
    const { cleanerClientId, activeOnly } = req.query;

    const where = { cleanerId: req.user.id };
    if (cleanerClientId) {
      where.cleanerClientId = cleanerClientId;
    }
    if (activeOnly === "true") {
      where.isActive = true;
    }

    const schedules = await RecurringSchedule.findAll({
      where,
      include: [
        {
          model: CleanerClient,
          as: "cleanerClient",
          include: [
            { model: User, as: "client", attributes: ["id", "firstName", "lastName"] },
          ],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city", "numBeds", "numBaths"],
        },
      ],
      order: [["nextScheduledDate", "ASC"]],
    });

    res.json({
      schedules: schedules.map((s) => ({
        id: s.id,
        frequency: s.frequency,
        dayOfWeek: s.dayOfWeek,
        timeWindow: s.timeWindow,
        price: s.price,
        startDate: s.startDate,
        endDate: s.endDate,
        nextScheduledDate: s.nextScheduledDate,
        isActive: s.isActive,
        isPaused: s.isPaused,
        pausedUntil: s.pausedUntil,
        client: s.cleanerClient?.client
          ? {
              id: s.cleanerClient.client.id,
              name: `${s.cleanerClient.client.firstName} ${s.cleanerClient.client.lastName}`,
            }
          : null,
        home: s.home
          ? {
              id: s.home.id,
              address: `${EncryptionService.decrypt(s.home.address)}, ${EncryptionService.decrypt(s.home.city)}`,
              beds: s.home.numBeds,
              baths: s.home.numBaths,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("Error fetching schedules:", err);
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
});

/**
 * GET /:id
 * Get a specific recurring schedule with upcoming appointments
 */
recurringSchedulesRouter.get("/:id", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await RecurringSchedule.findOne({
      where: { id, cleanerId: req.user.id },
      include: [
        {
          model: CleanerClient,
          as: "cleanerClient",
          include: [
            { model: User, as: "client", attributes: ["id", "firstName", "lastName", "email"] },
          ],
        },
        {
          model: UserHomes,
          as: "home",
        },
        {
          model: UserAppointments,
          as: "appointments",
          where: {
            date: { [Op.gte]: new Date().toISOString().split("T")[0] },
          },
          required: false,
          order: [["date", "ASC"]],
          limit: 10,
        },
      ],
    });

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json({
      schedule: {
        id: schedule.id,
        frequency: schedule.frequency,
        dayOfWeek: schedule.dayOfWeek,
        timeWindow: schedule.timeWindow,
        price: schedule.price,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        nextScheduledDate: schedule.nextScheduledDate,
        lastGeneratedDate: schedule.lastGeneratedDate,
        isActive: schedule.isActive,
        isPaused: schedule.isPaused,
        pausedUntil: schedule.pausedUntil,
        pauseReason: schedule.pauseReason,
        client: schedule.cleanerClient?.client,
        home: schedule.home,
        upcomingAppointments: schedule.appointments || [],
      },
    });
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

/**
 * PATCH /:id
 * Update a recurring schedule
 */
recurringSchedulesRouter.patch("/:id", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency, dayOfWeek, timeWindow, price, endDate } = req.body;

    const schedule = await RecurringSchedule.findOne({
      where: { id, cleanerId: req.user.id },
    });

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Build update object
    const updates = {};
    if (frequency !== undefined) updates.frequency = frequency;
    if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
    if (timeWindow !== undefined) updates.timeWindow = timeWindow;
    if (price !== undefined) updates.price = price;
    if (endDate !== undefined) updates.endDate = endDate;

    await schedule.update(updates);

    // Recalculate next scheduled date if frequency or day changed
    if (frequency !== undefined || dayOfWeek !== undefined) {
      const nextScheduled = schedule.calculateNextDate(new Date());
      if (nextScheduled) {
        await schedule.update({
          nextScheduledDate: nextScheduled.toISOString().split("T")[0],
        });
      }
    }

    res.json({
      success: true,
      message: "Schedule updated successfully",
      schedule,
    });
  } catch (err) {
    console.error("Error updating schedule:", err);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

/**
 * DELETE /:id
 * Deactivate a recurring schedule (soft delete)
 */
recurringSchedulesRouter.delete("/:id", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelFutureAppointments } = req.query;

    const schedule = await RecurringSchedule.findOne({
      where: { id, cleanerId: req.user.id },
    });

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Deactivate the schedule
    await schedule.update({ isActive: false });

    // Optionally cancel future appointments
    let cancelledCount = 0;
    if (cancelFutureAppointments === "true") {
      const today = new Date().toISOString().split("T")[0];
      const result = await UserAppointments.destroy({
        where: {
          recurringScheduleId: id,
          date: { [Op.gt]: today },
          completed: false,
        },
      });
      cancelledCount = result;
    }

    res.json({
      success: true,
      message: "Schedule deactivated",
      cancelledAppointments: cancelledCount,
    });
  } catch (err) {
    console.error("Error deactivating schedule:", err);
    res.status(500).json({ error: "Failed to deactivate schedule" });
  }
});

/**
 * POST /:id/pause
 * Pause a recurring schedule
 */
recurringSchedulesRouter.post("/:id/pause", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const { until, reason } = req.body;

    const schedule = await RecurringSchedule.findOne({
      where: { id, cleanerId: req.user.id, isActive: true },
    });

    if (!schedule) {
      return res.status(404).json({ error: "Active schedule not found" });
    }

    await schedule.update({
      isPaused: true,
      pausedUntil: until || null,
      pauseReason: reason || null,
    });

    res.json({
      success: true,
      message: until ? `Schedule paused until ${until}` : "Schedule paused indefinitely",
      schedule,
    });
  } catch (err) {
    console.error("Error pausing schedule:", err);
    res.status(500).json({ error: "Failed to pause schedule" });
  }
});

/**
 * POST /:id/resume
 * Resume a paused recurring schedule
 */
recurringSchedulesRouter.post("/:id/resume", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await RecurringSchedule.findOne({
      where: { id, cleanerId: req.user.id, isActive: true },
    });

    if (!schedule) {
      return res.status(404).json({ error: "Active schedule not found" });
    }

    await schedule.update({
      isPaused: false,
      pausedUntil: null,
      pauseReason: null,
    });

    // Generate any missing appointments
    const appointments = await generateAppointmentsForSchedule(schedule);

    res.json({
      success: true,
      message: `Schedule resumed. ${appointments.length} new appointments generated.`,
      schedule,
      appointmentsCreated: appointments.length,
    });
  } catch (err) {
    console.error("Error resuming schedule:", err);
    res.status(500).json({ error: "Failed to resume schedule" });
  }
});

/**
 * POST /:id/generate
 * Manually trigger appointment generation for a schedule
 */
recurringSchedulesRouter.post("/:id/generate", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const { weeksAhead } = req.body;

    const schedule = await RecurringSchedule.findOne({
      where: { id, cleanerId: req.user.id, isActive: true },
    });

    if (!schedule) {
      return res.status(404).json({ error: "Active schedule not found" });
    }

    if (schedule.isPaused) {
      return res.status(400).json({ error: "Cannot generate for paused schedule" });
    }

    const appointments = await generateAppointmentsForSchedule(schedule, weeksAhead);

    res.json({
      success: true,
      message: `${appointments.length} appointments generated`,
      appointmentsCreated: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        date: a.date,
        price: a.price,
      })),
    });
  } catch (err) {
    console.error("Error generating appointments:", err);
    res.status(500).json({ error: "Failed to generate appointments" });
  }
});

/**
 * POST /generate-all
 * Generate appointments for all active schedules (cron job endpoint)
 * This should be called by a scheduled task
 */
recurringSchedulesRouter.post("/generate-all", async (req, res) => {
  try {
    // Verify internal API key or admin access
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      // Also allow authenticated owner/admin
      const authHeader = req.headers.authorization;
      if (authHeader) {
        try {
          const token = authHeader.split(" ")[1];
          const decoded = jwt.verify(token, secretKey);
          const user = await User.findByPk(decoded.userId);
          if (!user || user.type !== "owner") {
            return res.status(403).json({ error: "Admin access required" });
          }
        } catch {
          return res.status(401).json({ error: "Invalid token" });
        }
      } else {
        return res.status(401).json({ error: "Authentication required" });
      }
    }

    // Find all active, non-paused schedules
    const schedules = await RecurringSchedule.findAll({
      where: {
        isActive: true,
        isPaused: false,
      },
    });

    let totalAppointments = 0;
    const results = [];

    for (const schedule of schedules) {
      try {
        // Check if paused until date has passed
        if (schedule.pausedUntil && new Date(schedule.pausedUntil) > new Date()) {
          continue;
        }

        const appointments = await generateAppointmentsForSchedule(schedule);
        totalAppointments += appointments.length;
        results.push({
          scheduleId: schedule.id,
          appointmentsCreated: appointments.length,
        });
      } catch (err) {
        console.error(`Error generating for schedule ${schedule.id}:`, err);
        results.push({
          scheduleId: schedule.id,
          error: err.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Generated ${totalAppointments} appointments across ${schedules.length} schedules`,
      totalAppointments,
      results,
    });
  } catch (err) {
    console.error("Error in generate-all:", err);
    res.status(500).json({ error: "Failed to generate appointments" });
  }
});

// =====================
// CLIENT ENDPOINTS (for homeowners to see their schedules)
// =====================

// Middleware to verify homeowner access
const verifyHomeowner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.type !== "homeowner") {
      return res.status(403).json({ error: "Homeowner access required" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * GET /my-schedules
 * Get all recurring schedules for the authenticated homeowner
 */
recurringSchedulesRouter.get("/my-schedules", verifyHomeowner, async (req, res) => {
  try {
    const schedules = await RecurringSchedule.findAll({
      where: {
        clientId: req.user.id,
        isActive: true,
      },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "profilePhoto"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "nickName", "address", "city"],
        },
      ],
      order: [["nextScheduledDate", "ASC"]],
    });

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    res.json({
      schedules: schedules.map((s) => ({
        id: s.id,
        frequency: s.frequency,
        dayOfWeek: s.dayOfWeek,
        dayName: days[s.dayOfWeek],
        timeWindow: s.timeWindow,
        price: s.price,
        nextScheduledDate: s.nextScheduledDate,
        isPaused: s.isPaused,
        pausedUntil: s.pausedUntil,
        cleaner: s.cleaner
          ? {
              id: s.cleaner.id,
              firstName: s.cleaner.firstName,
              lastName: s.cleaner.lastName,
              profilePhoto: s.cleaner.profilePhoto,
            }
          : null,
        home: s.home
          ? {
              id: s.home.id,
              nickName: s.home.nickName,
              address: `${EncryptionService.decrypt(s.home.address)}, ${EncryptionService.decrypt(s.home.city)}`,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("Error fetching my schedules:", err);
    res.status(500).json({ error: "Failed to fetch recurring schedules" });
  }
});

module.exports = recurringSchedulesRouter;
module.exports.generateAppointmentsForSchedule = generateAppointmentsForSchedule;
