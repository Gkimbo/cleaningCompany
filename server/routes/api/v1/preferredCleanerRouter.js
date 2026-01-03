/**
 * Preferred Cleaner Router
 * API endpoints for business owner cleaners to manage their client's appointments
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const models = require("../../../models");
const { User } = models;
const PreferredCleanerService = require("../../../services/PreferredCleanerService");
const EncryptionService = require("../../../services/EncryptionService");

const preferredCleanerRouter = express.Router();
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

// =====================
// CLEANER (BUSINESS OWNER) ENDPOINTS
// =====================

/**
 * GET /my-client-appointments
 * Get all appointments from the cleaner's clients
 * Grouped by: pending (need response), declined (awaiting client), upcoming (confirmed)
 */
preferredCleanerRouter.get("/my-client-appointments", verifyCleaner, async (req, res) => {
  try {
    const result = await PreferredCleanerService.getClientAppointments(
      req.user.id,
      models
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching client appointments:", err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

/**
 * POST /appointments/:id/accept
 * Business owner accepts an appointment from their client
 */
preferredCleanerRouter.post("/appointments/:id/accept", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await PreferredCleanerService.acceptAppointment(
      parseInt(id, 10),
      req.user.id,
      models
    );

    res.json(result);
  } catch (err) {
    console.error("Error accepting appointment:", err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /appointments/:id/decline
 * Business owner declines an appointment (can't do this date)
 */
preferredCleanerRouter.post("/appointments/:id/decline", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await PreferredCleanerService.declineAppointment(
      parseInt(id, 10),
      req.user.id,
      models
    );

    res.json(result);
  } catch (err) {
    console.error("Error declining appointment:", err);
    res.status(400).json({ error: err.message });
  }
});

// =====================
// CLIENT (HOMEOWNER) ENDPOINTS
// =====================

/**
 * GET /pending-responses
 * Get appointments where the preferred cleaner declined and client needs to respond
 */
preferredCleanerRouter.get("/pending-responses", verifyHomeowner, async (req, res) => {
  try {
    const { UserAppointments, UserHomes, User } = models;

    const appointments = await UserAppointments.findAll({
      where: {
        userId: req.user.id,
        clientResponsePending: true,
      },
      include: [
        { model: UserHomes, as: "home" },
      ],
      order: [["date", "ASC"]],
    });

    // Get the preferred cleaner details for each
    const result = await Promise.all(
      appointments.map(async (apt) => {
        const cleaner = apt.home.preferredCleanerId
          ? await User.findByPk(apt.home.preferredCleanerId, {
              attributes: ["id", "firstName", "lastName"],
            })
          : null;

        return {
          id: apt.id,
          date: apt.date,
          price: apt.price,
          timeWindow: apt.timeToBeCompleted,
          declinedAt: apt.declinedAt,
          home: {
            id: apt.home.id,
            nickName: apt.home.nickName,
            address: `${EncryptionService.decrypt(apt.home.address)}, ${EncryptionService.decrypt(apt.home.city)}`,
          },
          cleaner: cleaner
            ? {
                id: cleaner.id,
                name: `${cleaner.firstName} ${cleaner.lastName}`,
              }
            : null,
        };
      })
    );

    res.json({ appointments: result });
  } catch (err) {
    console.error("Error fetching pending responses:", err);
    res.status(500).json({ error: "Failed to fetch pending responses" });
  }
});

/**
 * POST /appointments/:id/respond
 * Client responds to preferred cleaner declining
 * Body: { action: 'cancel' | 'open_to_market' }
 */
preferredCleanerRouter.post("/appointments/:id/respond", verifyHomeowner, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!action || !["cancel", "open_to_market"].includes(action)) {
      return res.status(400).json({
        error: "Invalid action. Must be 'cancel' or 'open_to_market'",
      });
    }

    const result = await PreferredCleanerService.clientRespond(
      parseInt(id, 10),
      req.user.id,
      action,
      models
    );

    res.json(result);
  } catch (err) {
    console.error("Error responding to decline:", err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = preferredCleanerRouter;
