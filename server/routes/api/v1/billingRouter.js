/**
 * Billing Router
 * API endpoints for billing history and payment management
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const models = require("../../../models");
const { User } = models;
const BillingService = require("../../../services/BillingService");
const EncryptionService = require("../../../services/EncryptionService");

const billingRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify user authentication
const verifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

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
 * GET /history
 * Get billing history for the authenticated user
 */
billingRouter.get("/history", verifyUser, async (req, res) => {
  try {
    const { limit, offset } = req.query;

    const result = await BillingService.getClientBillingHistory(
      req.user.id,
      models,
      {
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0,
      }
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching billing history:", err);
    res.status(500).json({ error: "Failed to fetch billing history" });
  }
});

/**
 * POST /complete-with-autopay
 * Complete a cleaner-booked appointment with automatic payment processing
 * For cleaners to mark their booked appointments as complete
 */
billingRouter.post("/complete-with-autopay", verifyCleaner, async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: "Appointment ID is required" });
    }

    const result = await BillingService.completeCleanerBookedAppointment(
      appointmentId,
      req.user.id,
      models
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: "Appointment completed successfully",
      ...result,
    });
  } catch (err) {
    console.error("Error completing appointment with autopay:", err);
    res.status(500).json({ error: "Failed to complete appointment" });
  }
});

/**
 * GET /pending-reminders
 * Get appointments with pending payments (admin/cron endpoint)
 */
billingRouter.get("/pending-reminders", async (req, res) => {
  try {
    // Verify admin access
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, secretKey);
      const user = await User.findByPk(decoded.userId);
      if (!user || user.type !== "owner") {
        return res.status(403).json({ error: "Admin access required" });
      }
    } else {
      // Check for internal API key
      const apiKey = req.headers["x-api-key"];
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ error: "Authentication required" });
      }
    }

    const daysOverdue = parseInt(req.query.days) || 3;
    const appointments = await BillingService.getPendingPaymentReminders(
      models,
      daysOverdue
    );

    res.json({
      count: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        date: a.date,
        price: a.price,
        homeowner: a.homeowner
          ? {
              id: a.homeowner.id,
              name: `${EncryptionService.decrypt(a.homeowner.firstName)} ${EncryptionService.decrypt(a.homeowner.lastName)}`,
              email: EncryptionService.decrypt(a.homeowner.email),
            }
          : null,
        home: a.home
          ? {
              address: `${EncryptionService.decrypt(a.home.address)}, ${EncryptionService.decrypt(a.home.city)}`,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("Error fetching pending reminders:", err);
    res.status(500).json({ error: "Failed to fetch pending reminders" });
  }
});

/**
 * GET /summary
 * Get billing summary for the authenticated user
 */
billingRouter.get("/summary", verifyUser, async (req, res) => {
  try {
    const { UserBills, UserAppointments } = models;
    const { Op } = require("sequelize");

    // Get user's bill record
    const bill = await UserBills.findOne({
      where: { userId: req.user.id },
    });

    // Get upcoming appointments count
    const today = new Date().toISOString().split("T")[0];
    const upcomingAppointments = await UserAppointments.count({
      where: {
        userId: req.user.id,
        date: { [Op.gte]: today },
        completed: false,
      },
    });

    // Get completed appointments this month
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const completedThisMonth = await UserAppointments.count({
      where: {
        userId: req.user.id,
        completed: true,
        date: { [Op.gte]: firstOfMonth.toISOString().split("T")[0] },
      },
    });

    res.json({
      summary: {
        totalDue: bill ? parseFloat(bill.totalDue || 0) : 0,
        totalPaid: bill ? parseFloat(bill.totalPaid || 0) : 0,
        appointmentDue: bill ? parseFloat(bill.appointmentDue || 0) : 0,
        cancellationDue: bill ? parseFloat(bill.cancellationDue || 0) : 0,
        upcomingAppointments,
        completedThisMonth,
      },
    });
  } catch (err) {
    console.error("Error fetching billing summary:", err);
    res.status(500).json({ error: "Failed to fetch billing summary" });
  }
});

module.exports = billingRouter;
