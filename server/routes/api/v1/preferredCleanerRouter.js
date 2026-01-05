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
const HomePreferredCleanerSerializer = require("../../../serializers/HomePreferredCleanerSerializer");
const CleanerPreferredPerksSerializer = require("../../../serializers/CleanerPreferredPerksSerializer");
const PreferredPerksConfigSerializer = require("../../../serializers/PreferredPerksConfigSerializer");
const CleanerAvailabilityConfigSerializer = require("../../../serializers/CleanerAvailabilityConfigSerializer");

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
                name: `${EncryptionService.decrypt(cleaner.firstName)} ${EncryptionService.decrypt(cleaner.lastName)}`,
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

// =====================
// HOMEOWNER PREFERRED CLEANER MANAGEMENT ENDPOINTS
// =====================

/**
 * GET /homes/:homeId/preferred-cleaners
 * List all preferred cleaners for a home
 */
preferredCleanerRouter.get("/homes/:homeId/preferred-cleaners", verifyHomeowner, async (req, res) => {
  try {
    const { homeId } = req.params;
    const { HomePreferredCleaner, UserHomes, User } = models;

    // Verify homeowner owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.user.id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Get all preferred cleaners for this home
    // Order by preferenceLevel (preferred first), then priority (higher first), then setAt
    const preferredCleaners = await HomePreferredCleaner.findAll({
      where: { homeId },
      include: [{
        model: User,
        as: "cleaner",
        attributes: ["id", "firstName", "lastName", "username"],
      }],
      order: [
        ["preferenceLevel", "ASC"], // 'preferred' comes before 'favorite' alphabetically
        ["priority", "DESC"],
        ["setAt", "DESC"],
      ],
    });

    res.json({
      preferredCleaners: HomePreferredCleanerSerializer.serializeArray(preferredCleaners),
      usePreferredCleaners: home.usePreferredCleaners,
    });
  } catch (err) {
    console.error("Error fetching preferred cleaners:", err);
    res.status(500).json({ error: "Failed to fetch preferred cleaners" });
  }
});

/**
 * PATCH /homes/:homeId/cleaners/:cleanerId/preference
 * Update preference level for a cleaner (preferred or favorite)
 */
preferredCleanerRouter.patch("/homes/:homeId/cleaners/:cleanerId/preference", verifyHomeowner, async (req, res) => {
  try {
    const { homeId, cleanerId } = req.params;
    const { preferenceLevel, priority } = req.body;
    const { HomePreferredCleaner, UserHomes } = models;

    // Validate preferenceLevel
    if (preferenceLevel && !["preferred", "favorite"].includes(preferenceLevel)) {
      return res.status(400).json({ error: "preferenceLevel must be 'preferred' or 'favorite'" });
    }

    // Verify homeowner owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.user.id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Find the preferred cleaner record
    const preferredCleaner = await HomePreferredCleaner.findOne({
      where: { homeId, cleanerId },
    });

    if (!preferredCleaner) {
      return res.status(404).json({ error: "Cleaner not found in preferred list" });
    }

    // Update the fields
    const updates = {};
    if (preferenceLevel !== undefined) updates.preferenceLevel = preferenceLevel;
    if (priority !== undefined) updates.priority = priority;

    await preferredCleaner.update(updates);

    console.log(`[PreferredCleaner] Updated cleaner ${cleanerId} for home ${homeId}: ${JSON.stringify(updates)}`);

    res.json({
      success: true,
      preferenceLevel: preferredCleaner.preferenceLevel,
      priority: preferredCleaner.priority,
    });
  } catch (err) {
    console.error("Error updating preference level:", err);
    res.status(500).json({ error: "Failed to update preference level" });
  }
});

/**
 * DELETE /homes/:homeId/cleaners/:cleanerId
 * Remove a cleaner from the preferred list
 */
preferredCleanerRouter.delete("/homes/:homeId/cleaners/:cleanerId", verifyHomeowner, async (req, res) => {
  try {
    const { homeId, cleanerId } = req.params;
    const { HomePreferredCleaner, UserHomes } = models;

    // Verify homeowner owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.user.id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Find and delete the preferred cleaner record
    const deleted = await HomePreferredCleaner.destroy({
      where: { homeId, cleanerId },
    });

    if (deleted === 0) {
      return res.status(404).json({ error: "Cleaner not found in preferred list" });
    }

    console.log(`[PreferredCleaner] Removed cleaner ${cleanerId} from home ${homeId}`);

    res.json({ success: true, message: "Cleaner removed from preferred list" });
  } catch (err) {
    console.error("Error removing preferred cleaner:", err);
    res.status(500).json({ error: "Failed to remove preferred cleaner" });
  }
});

/**
 * PATCH /homes/:homeId/preferred-settings
 * Toggle usePreferredCleaners for a home
 */
preferredCleanerRouter.patch("/homes/:homeId/preferred-settings", verifyHomeowner, async (req, res) => {
  try {
    const { homeId } = req.params;
    const { usePreferredCleaners } = req.body;
    const { UserHomes } = models;

    if (typeof usePreferredCleaners !== "boolean") {
      return res.status(400).json({ error: "usePreferredCleaners must be a boolean" });
    }

    // Verify homeowner owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.user.id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    await home.update({ usePreferredCleaners });

    console.log(`[PreferredCleaner] Updated usePreferredCleaners=${usePreferredCleaners} for home ${homeId}`);

    res.json({
      success: true,
      usePreferredCleaners: home.usePreferredCleaners,
      message: usePreferredCleaners
        ? "Only preferred cleaners can now request jobs for this home"
        : "All cleaners can now request jobs for this home",
    });
  } catch (err) {
    console.error("Error updating preferred settings:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/**
 * GET /homes/:homeId/cleaners/:cleanerId/stats
 * Get stats for a specific cleaner at a specific home
 */
preferredCleanerRouter.get("/homes/:homeId/cleaners/:cleanerId/stats", verifyHomeowner, async (req, res) => {
  try {
    const { homeId, cleanerId } = req.params;
    const { UserHomes } = models;

    // Verify homeowner owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.user.id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    const stats = await PreferredCleanerService.getCleanerStatsForHome(
      parseInt(homeId, 10),
      parseInt(cleanerId, 10),
      models
    );

    res.json(stats);
  } catch (err) {
    console.error("Error fetching cleaner stats:", err);
    res.status(500).json({ error: "Failed to fetch cleaner stats" });
  }
});

/**
 * GET /homes/:homeId/cleaners/:cleanerId/is-preferred
 * Check if a specific cleaner is preferred for a home
 */
preferredCleanerRouter.get("/homes/:homeId/cleaners/:cleanerId/is-preferred", verifyHomeowner, async (req, res) => {
  try {
    const { homeId, cleanerId } = req.params;
    const { HomePreferredCleaner, UserHomes } = models;

    // Verify homeowner owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.user.id },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    const isPreferred = await HomePreferredCleaner.findOne({
      where: { homeId, cleanerId },
    });

    res.json({ isPreferred: !!isPreferred });
  } catch (err) {
    console.error("Error checking preferred status:", err);
    res.status(500).json({ error: "Failed to check preferred status" });
  }
});

// =====================
// CLEANER PREFERRED HOMES ENDPOINTS
// =====================

/**
 * GET /my-preferred-homes
 * List all homes where the cleaner has preferred status
 * Returns home IDs and basic info for filtering jobs
 */
preferredCleanerRouter.get("/my-preferred-homes", verifyCleaner, async (req, res) => {
  try {
    const { HomePreferredCleaner, UserHomes } = models;

    const preferredHomes = await HomePreferredCleaner.findAll({
      where: { cleanerId: req.user.id },
      include: [{
        model: UserHomes,
        as: "home",
        attributes: ["id", "nickName", "address", "city"],
      }],
      order: [["setAt", "DESC"]],
    });

    res.json({
      preferredHomes: preferredHomes.map((ph) => HomePreferredCleanerSerializer.serializeForCleanerView(ph)),
      homeIds: preferredHomes.map((ph) => ph.homeId),
    });
  } catch (err) {
    console.error("Error fetching preferred homes:", err);
    res.status(500).json({ error: "Failed to fetch preferred homes" });
  }
});

/**
 * GET /my-perk-status
 * Get cleaner's current perk tier and benefits
 */
preferredCleanerRouter.get("/my-perk-status", verifyCleaner, async (req, res) => {
  try {
    const PreferredCleanerPerksService = require("../../../services/PreferredCleanerPerksService");

    const perkStatus = await PreferredCleanerPerksService.getCleanerPerkStatus(
      req.user.id,
      models
    );

    res.json(CleanerPreferredPerksSerializer.serializeForDashboard(perkStatus));
  } catch (err) {
    console.error("Error fetching perk status:", err);
    res.status(500).json({ error: "Failed to fetch perk status" });
  }
});

/**
 * GET /perk-tier-info
 * Get information about all tier levels and benefits (public info for cleaners)
 */
preferredCleanerRouter.get("/perk-tier-info", verifyCleaner, async (req, res) => {
  try {
    const PreferredCleanerPerksService = require("../../../services/PreferredCleanerPerksService");

    const config = await PreferredCleanerPerksService.getPerksConfig(models);

    // Use serializer to format tier info
    const serialized = PreferredPerksConfigSerializer.serializeByTier(config);
    res.json({ tiers: Object.values(serialized.tiers) });
  } catch (err) {
    console.error("Error fetching tier info:", err);
    res.status(500).json({ error: "Failed to fetch tier info" });
  }
});

// =====================
// CLEANER AVAILABILITY CONFIG ENDPOINTS
// =====================

/**
 * GET /my-availability-config
 * Get cleaner's current availability configuration
 */
preferredCleanerRouter.get("/my-availability-config", verifyCleaner, async (req, res) => {
  try {
    const CleanerAvailabilityService = require("../../../services/CleanerAvailabilityService");
    const { PreferredPerksConfig, CleanerAvailabilityConfig } = models;

    // Get cleaner's config
    const cleanerConfig = await CleanerAvailabilityConfig?.findOne({
      where: { cleanerId: req.user.id },
    });

    // Get platform config for defaults
    const platformConfig = await PreferredPerksConfig?.findOne();

    // Use serializer to format response
    res.json(CleanerAvailabilityConfigSerializer.serializeForForm(cleanerConfig, platformConfig));
  } catch (err) {
    console.error("Error fetching availability config:", err);
    res.status(500).json({ error: "Failed to fetch availability config" });
  }
});

/**
 * PUT /my-availability-config
 * Update cleaner's availability configuration (max jobs)
 */
preferredCleanerRouter.put("/my-availability-config", verifyCleaner, async (req, res) => {
  try {
    const CleanerAvailabilityService = require("../../../services/CleanerAvailabilityService");
    const { maxDailyJobs, maxConcurrentJobs } = req.body;

    // Validate input
    if (maxDailyJobs !== undefined && maxDailyJobs !== null) {
      if (!Number.isInteger(maxDailyJobs) || maxDailyJobs < 1) {
        return res.status(400).json({ error: "maxDailyJobs must be a positive integer" });
      }
    }

    if (maxConcurrentJobs !== undefined && maxConcurrentJobs !== null) {
      if (!Number.isInteger(maxConcurrentJobs) || maxConcurrentJobs < 1) {
        return res.status(400).json({ error: "maxConcurrentJobs must be a positive integer" });
      }
    }

    const updatedConfig = await CleanerAvailabilityService.updateCleanerConfig(
      req.user.id,
      { maxDailyJobs, maxConcurrentJobs },
      models
    );

    console.log(`[PreferredCleaner] Updated availability config for cleaner ${req.user.id}`);

    // Get platform config for serializer
    const { PreferredPerksConfig } = models;
    const platformConfig = await PreferredPerksConfig?.findOne();

    res.json({
      success: true,
      ...CleanerAvailabilityConfigSerializer.serializeOne(updatedConfig, platformConfig),
    });
  } catch (err) {
    console.error("Error updating availability config:", err);
    res.status(400).json({ error: err.message || "Failed to update availability config" });
  }
});

/**
 * POST /my-blackout-dates
 * Add or remove blackout dates
 */
preferredCleanerRouter.post("/my-blackout-dates", verifyCleaner, async (req, res) => {
  try {
    const CleanerAvailabilityService = require("../../../services/CleanerAvailabilityService");
    const { add, remove } = req.body;

    // Validate dates format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (add && Array.isArray(add)) {
      for (const date of add) {
        if (!dateRegex.test(date)) {
          return res.status(400).json({ error: `Invalid date format: ${date}. Use YYYY-MM-DD` });
        }
      }
    }

    if (remove && Array.isArray(remove)) {
      for (const date of remove) {
        if (!dateRegex.test(date)) {
          return res.status(400).json({ error: `Invalid date format: ${date}. Use YYYY-MM-DD` });
        }
      }
    }

    const result = await CleanerAvailabilityService.updateBlackoutDates(
      req.user.id,
      add || [],
      remove || [],
      models
    );

    console.log(`[PreferredCleaner] Updated blackout dates for cleaner ${req.user.id}: +${(add || []).length} -${(remove || []).length}`);

    res.json({
      success: true,
      blackoutDates: result.blackoutDates,
    });
  } catch (err) {
    console.error("Error updating blackout dates:", err);
    res.status(500).json({ error: "Failed to update blackout dates" });
  }
});

/**
 * GET /my-job-counts
 * Get job counts for a date range (for calendar display)
 */
preferredCleanerRouter.get("/my-job-counts", verifyCleaner, async (req, res) => {
  try {
    const CleanerAvailabilityService = require("../../../services/CleanerAvailabilityService");
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
    }

    const countsByDate = await CleanerAvailabilityService.getJobCountsByDate(
      req.user.id,
      startDate,
      endDate,
      models
    );

    res.json({ countsByDate });
  } catch (err) {
    console.error("Error fetching job counts:", err);
    res.status(500).json({ error: "Failed to fetch job counts" });
  }
});

/**
 * GET /check-availability/:date
 * Check if cleaner can accept a job on a specific date
 */
preferredCleanerRouter.get("/check-availability/:date", verifyCleaner, async (req, res) => {
  try {
    const CleanerAvailabilityService = require("../../../services/CleanerAvailabilityService");
    const { date } = req.params;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }

    const availability = await CleanerAvailabilityService.checkAvailability(
      req.user.id,
      date,
      models
    );

    res.json(availability);
  } catch (err) {
    console.error("Error checking availability:", err);
    res.status(500).json({ error: "Failed to check availability" });
  }
});

module.exports = preferredCleanerRouter;
