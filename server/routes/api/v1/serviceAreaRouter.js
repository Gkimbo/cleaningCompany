/**
 * Service Area Router
 * API endpoints for managing service area configuration
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { User, UserHomes, ServiceAreaConfig } = require("../../../models");
const { businessConfig, updateAllHomesServiceAreaStatus } = require("../../../config/businessConfig");
const { calculateDistance } = require("../../../utils/geoUtils");
const EncryptionService = require("../../../services/EncryptionService");
const EmailClass = require("../../../services/sendNotifications/EmailClass");

const serviceAreaRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Convert miles to meters
const MILES_TO_METERS = 1609.34;

// Middleware to verify owner access
const verifyOwner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.type !== "owner") {
      return res.status(403).json({ error: "Owner access required" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * Get statistics about homes in/out of service area
 */
async function getServiceAreaStats() {
  try {
    const totalHomes = await UserHomes.count();
    const homesOutside = await UserHomes.count({
      where: { outsideServiceArea: true },
    });
    const homesInside = totalHomes - homesOutside;

    return {
      totalHomes,
      homesInArea: homesInside,
      homesOutsideArea: homesOutside,
    };
  } catch (error) {
    console.error("[ServiceArea] Error getting stats:", error);
    return {
      totalHomes: 0,
      homesInArea: 0,
      homesOutsideArea: 0,
    };
  }
}

/**
 * GET /config
 * Get full service area configuration with metadata (owner only)
 */
serviceAreaRouter.get("/config", verifyOwner, async (req, res) => {
  try {
    const activeConfig = await ServiceAreaConfig.getActive();
    const stats = await getServiceAreaStats();

    if (activeConfig) {
      return res.json({
        source: "database",
        config: {
          id: activeConfig.id,
          enabled: activeConfig.enabled,
          mode: activeConfig.mode,
          cities: activeConfig.cities || [],
          states: activeConfig.states || [],
          zipcodes: activeConfig.zipcodes || [],
          centerAddress: activeConfig.centerAddress,
          centerLatitude: activeConfig.centerLatitude ? parseFloat(activeConfig.centerLatitude) : null,
          centerLongitude: activeConfig.centerLongitude ? parseFloat(activeConfig.centerLongitude) : null,
          radiusMiles: activeConfig.radiusMiles ? parseFloat(activeConfig.radiusMiles) : 25,
          outsideAreaMessage: activeConfig.outsideAreaMessage,
          isActive: activeConfig.isActive,
          updatedBy: activeConfig.updatedBy,
          changeNote: activeConfig.changeNote,
          createdAt: activeConfig.createdAt,
          updatedAt: activeConfig.updatedAt,
        },
        stats,
      });
    }

    // No database config, return values from static config
    const staticConfig = businessConfig.serviceAreas;
    return res.json({
      source: "config",
      config: {
        enabled: staticConfig.enabled,
        mode: "list",
        cities: staticConfig.cities || [],
        states: staticConfig.states || [],
        zipcodes: staticConfig.zipcodes || [],
        centerAddress: null,
        centerLatitude: null,
        centerLongitude: null,
        radiusMiles: 25,
        outsideAreaMessage: staticConfig.outsideAreaMessage,
      },
      stats,
    });
  } catch (error) {
    console.error("[ServiceArea API] Error fetching config:", error);
    res.status(500).json({ error: "Failed to fetch service area configuration" });
  }
});

/**
 * PUT /config
 * Update service area configuration (owner only)
 */
serviceAreaRouter.put("/config", verifyOwner, async (req, res) => {
  try {
    const {
      enabled,
      mode,
      // List mode fields
      cities,
      states,
      zipcodes,
      // Radius mode fields
      centerAddress,
      centerLatitude,
      centerLongitude,
      radiusMiles,
      // Common
      outsideAreaMessage,
      changeNote,
    } = req.body;

    // Validate required fields
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }

    if (!["list", "radius"].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'list' or 'radius'" });
    }

    // Validate mode-specific fields
    if (mode === "list") {
      if (!Array.isArray(cities) || !Array.isArray(states) || !Array.isArray(zipcodes)) {
        return res.status(400).json({
          error: "cities, states, and zipcodes must be arrays",
        });
      }
    }

    if (mode === "radius") {
      if (!centerAddress || typeof centerAddress !== "string") {
        return res.status(400).json({ error: "centerAddress is required for radius mode" });
      }
      if (typeof centerLatitude !== "number" || centerLatitude < -90 || centerLatitude > 90) {
        return res.status(400).json({ error: "centerLatitude must be a valid latitude (-90 to 90)" });
      }
      if (typeof centerLongitude !== "number" || centerLongitude < -180 || centerLongitude > 180) {
        return res.status(400).json({ error: "centerLongitude must be a valid longitude (-180 to 180)" });
      }
      if (typeof radiusMiles !== "number" || radiusMiles <= 0 || radiusMiles > 500) {
        return res.status(400).json({ error: "radiusMiles must be a positive number (max 500)" });
      }
    }

    // Build config data
    const configData = {
      enabled,
      mode,
      cities: mode === "list" ? cities.map(c => c.trim()).filter(c => c) : [],
      states: mode === "list" ? states.map(s => s.trim().toUpperCase()).filter(s => s) : [],
      zipcodes: mode === "list" ? zipcodes.map(z => z.trim()).filter(z => z) : [],
      centerAddress: mode === "radius" ? centerAddress : null,
      centerLatitude: mode === "radius" ? centerLatitude : null,
      centerLongitude: mode === "radius" ? centerLongitude : null,
      radiusMiles: mode === "radius" ? radiusMiles : null,
      outsideAreaMessage: outsideAreaMessage || "We don't currently service this area. We're expanding soon!",
    };

    // Create new config
    const newConfig = await ServiceAreaConfig.updateConfig(
      configData,
      req.user.id,
      changeNote || null
    );

    console.log(
      `[ServiceArea API] Config updated by owner ${req.user.id} (${req.user.username}), mode: ${mode}`
    );

    // Get updated stats
    const stats = await getServiceAreaStats();

    res.json({
      success: true,
      message: "Service area configuration updated successfully",
      config: {
        id: newConfig.id,
        enabled: newConfig.enabled,
        mode: newConfig.mode,
        cities: newConfig.cities || [],
        states: newConfig.states || [],
        zipcodes: newConfig.zipcodes || [],
        centerAddress: newConfig.centerAddress,
        centerLatitude: newConfig.centerLatitude ? parseFloat(newConfig.centerLatitude) : null,
        centerLongitude: newConfig.centerLongitude ? parseFloat(newConfig.centerLongitude) : null,
        radiusMiles: newConfig.radiusMiles ? parseFloat(newConfig.radiusMiles) : 25,
        outsideAreaMessage: newConfig.outsideAreaMessage,
        createdAt: newConfig.createdAt,
      },
      stats,
    });
  } catch (error) {
    console.error("[ServiceArea API] Error updating config:", error);
    res.status(500).json({ error: "Failed to update service area configuration" });
  }
});

/**
 * GET /history
 * Get service area config change history (owner only)
 */
serviceAreaRouter.get("/history", verifyOwner, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await ServiceAreaConfig.getHistory(limit);

    res.json({
      count: history.length,
      history: history.map((config) => ({
        id: config.id,
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedBy: config.updatedByUser
          ? {
              id: config.updatedByUser.id,
              username: config.updatedByUser.username,
              email: EncryptionService.decrypt(config.updatedByUser.email),
            }
          : null,
        changeNote: config.changeNote,
        config: {
          enabled: config.enabled,
          mode: config.mode,
          cities: config.cities || [],
          states: config.states || [],
          zipcodes: config.zipcodes || [],
          centerAddress: config.centerAddress,
          radiusMiles: config.radiusMiles ? parseFloat(config.radiusMiles) : null,
          outsideAreaMessage: config.outsideAreaMessage,
        },
      })),
    });
  } catch (error) {
    console.error("[ServiceArea API] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch service area history" });
  }
});

/**
 * POST /recheck-all-homes
 * Re-validate all homes against current service area config (owner only)
 */
serviceAreaRouter.post("/recheck-all-homes", verifyOwner, async (req, res) => {
  try {
    console.log(`[ServiceArea API] Rechecking all homes, triggered by owner ${req.user.id}`);

    const result = await updateAllHomesServiceAreaStatus(
      UserHomes,
      User,
      EmailClass
    );

    res.json({
      success: true,
      message: `Service area status updated for ${result.updated} homes`,
      totalHomes: result.totalHomes,
      updated: result.updated,
      changes: result.results,
    });
  } catch (error) {
    console.error("[ServiceArea API] Error rechecking homes:", error);
    res.status(500).json({ error: "Failed to recheck homes" });
  }
});

/**
 * POST /validate-address
 * Test if a specific address is within the service area (owner only)
 */
serviceAreaRouter.post("/validate-address", verifyOwner, async (req, res) => {
  try {
    const { city, state, zipcode, latitude, longitude } = req.body;

    if (!city && !zipcode && (latitude === undefined || longitude === undefined)) {
      return res.status(400).json({
        error: "Provide either city/state/zipcode or latitude/longitude",
      });
    }

    // Get active config
    const dbConfig = await ServiceAreaConfig.getActive();
    const config = dbConfig || {
      enabled: businessConfig.serviceAreas.enabled,
      mode: "list",
      cities: businessConfig.serviceAreas.cities,
      states: businessConfig.serviceAreas.states,
      zipcodes: businessConfig.serviceAreas.zipcodes,
      outsideAreaMessage: businessConfig.serviceAreas.outsideAreaMessage,
    };

    if (!config.enabled) {
      return res.json({
        isServiceable: true,
        message: "",
        reason: "Service area restrictions are disabled",
      });
    }

    let isServiceable = false;
    let reason = "";

    if (config.mode === "radius" && dbConfig) {
      // Radius mode requires coordinates
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          error: "Latitude and longitude required for radius-based service area validation",
        });
      }

      const distance = calculateDistance(
        parseFloat(dbConfig.centerLatitude),
        parseFloat(dbConfig.centerLongitude),
        latitude,
        longitude
      );

      if (distance === null) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      const radiusMeters = parseFloat(dbConfig.radiusMiles) * MILES_TO_METERS;
      isServiceable = distance <= radiusMeters;
      const distanceMiles = (distance / MILES_TO_METERS).toFixed(1);

      reason = isServiceable
        ? `Within service area (${distanceMiles} miles from center)`
        : `Outside service area (${distanceMiles} miles from center, max ${dbConfig.radiusMiles} miles)`;
    } else {
      // List mode
      const normalizedCity = city?.toLowerCase().trim();
      const normalizedState = state?.toUpperCase().trim();
      const normalizedZipcode = zipcode?.trim();

      const cityMatch = (config.cities || []).some(
        (serviceCity) => serviceCity.toLowerCase() === normalizedCity
      );
      const stateMatch = (config.states || []).some(
        (serviceState) => serviceState.toUpperCase() === normalizedState
      );
      const zipcodeMatch = (config.zipcodes || []).some((serviceZip) =>
        normalizedZipcode?.startsWith(serviceZip)
      );

      isServiceable = (cityMatch && stateMatch) || zipcodeMatch;

      if (isServiceable) {
        reason = zipcodeMatch ? "Zipcode matches" : "City and state match";
      } else {
        const reasons = [];
        if (!cityMatch) reasons.push(`city '${city}' not in list`);
        if (!stateMatch) reasons.push(`state '${state}' not in list`);
        if (!zipcodeMatch && zipcode) reasons.push(`zipcode '${zipcode}' not in list`);
        reason = reasons.join(", ");
      }
    }

    res.json({
      isServiceable,
      message: isServiceable ? "" : config.outsideAreaMessage,
      reason,
    });
  } catch (error) {
    console.error("[ServiceArea API] Error validating address:", error);
    res.status(500).json({ error: "Failed to validate address" });
  }
});

/**
 * GET /stats
 * Get service area statistics (owner only)
 */
serviceAreaRouter.get("/stats", verifyOwner, async (req, res) => {
  try {
    const stats = await getServiceAreaStats();
    res.json(stats);
  } catch (error) {
    console.error("[ServiceArea API] Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = serviceAreaRouter;
