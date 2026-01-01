/**
 * Incentives Router
 * API endpoints for managing incentive configuration
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { User, IncentiveConfig } = require("../../../models");
const IncentiveService = require("../../../services/IncentiveService");

const incentivesRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

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

// Middleware to verify authenticated user
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

/**
 * GET /current
 * Get current incentive configuration (public endpoint for landing page banners)
 */
incentivesRouter.get("/current", async (req, res) => {
  try {
    const config = await IncentiveConfig.getFormattedConfig();

    return res.json({
      cleaner: {
        enabled: config.cleaner.enabled,
        feeReductionPercent: config.cleaner.feeReductionPercent,
        eligibilityDays: config.cleaner.eligibilityDays,
        maxCleanings: config.cleaner.maxCleanings,
      },
      homeowner: {
        enabled: config.homeowner.enabled,
        discountPercent: config.homeowner.discountPercent,
        maxCleanings: config.homeowner.maxCleanings,
      },
    });
  } catch (error) {
    console.error("[Incentives API] Error fetching current incentives:", error);
    // Return disabled incentives on error
    return res.json({
      cleaner: {
        enabled: false,
        feeReductionPercent: 0,
        eligibilityDays: 0,
        maxCleanings: 0,
      },
      homeowner: {
        enabled: false,
        discountPercent: 0,
        maxCleanings: 0,
      },
    });
  }
});

/**
 * GET /config
 * Get full incentive configuration with metadata (owner only)
 */
incentivesRouter.get("/config", verifyOwner, async (req, res) => {
  try {
    const activeConfig = await IncentiveConfig.getActive();

    if (activeConfig) {
      return res.json({
        source: "database",
        config: {
          id: activeConfig.id,
          cleanerIncentiveEnabled: activeConfig.cleanerIncentiveEnabled,
          cleanerFeeReductionPercent: parseFloat(activeConfig.cleanerFeeReductionPercent),
          cleanerEligibilityDays: activeConfig.cleanerEligibilityDays,
          cleanerMaxCleanings: activeConfig.cleanerMaxCleanings,
          homeownerIncentiveEnabled: activeConfig.homeownerIncentiveEnabled,
          homeownerDiscountPercent: parseFloat(activeConfig.homeownerDiscountPercent),
          homeownerMaxCleanings: activeConfig.homeownerMaxCleanings,
          isActive: activeConfig.isActive,
          updatedBy: activeConfig.updatedBy,
          changeNote: activeConfig.changeNote,
          createdAt: activeConfig.createdAt,
          updatedAt: activeConfig.updatedAt,
        },
        formattedConfig: await IncentiveConfig.getFormattedConfig(),
      });
    }

    // No database config, return defaults
    return res.json({
      source: "defaults",
      config: null,
      formattedConfig: await IncentiveConfig.getFormattedConfig(),
    });
  } catch (error) {
    console.error("[Incentives API] Error fetching config:", error);
    res.status(500).json({ error: "Failed to fetch incentive configuration" });
  }
});

/**
 * PUT /config
 * Update incentive configuration (owner only)
 */
incentivesRouter.put("/config", verifyOwner, async (req, res) => {
  try {
    const {
      cleanerIncentiveEnabled,
      cleanerFeeReductionPercent,
      cleanerEligibilityDays,
      cleanerMaxCleanings,
      homeownerIncentiveEnabled,
      homeownerDiscountPercent,
      homeownerMaxCleanings,
      changeNote,
    } = req.body;

    // Validate boolean fields
    if (typeof cleanerIncentiveEnabled !== "boolean") {
      return res.status(400).json({
        error: "cleanerIncentiveEnabled must be a boolean",
      });
    }

    if (typeof homeownerIncentiveEnabled !== "boolean") {
      return res.status(400).json({
        error: "homeownerIncentiveEnabled must be a boolean",
      });
    }

    // Validate numeric fields
    const numericValidations = [
      { field: "cleanerFeeReductionPercent", value: cleanerFeeReductionPercent, min: 0, max: 1 },
      { field: "cleanerEligibilityDays", value: cleanerEligibilityDays, min: 1, max: 365 },
      { field: "cleanerMaxCleanings", value: cleanerMaxCleanings, min: 1, max: 100 },
      { field: "homeownerDiscountPercent", value: homeownerDiscountPercent, min: 0, max: 1 },
      { field: "homeownerMaxCleanings", value: homeownerMaxCleanings, min: 1, max: 100 },
    ];

    for (const { field, value, min, max } of numericValidations) {
      if (typeof value !== "number" || value < min || value > max) {
        return res.status(400).json({
          error: `${field} must be a number between ${min} and ${max}`,
        });
      }
    }

    // Create new incentive config
    const newConfig = await IncentiveConfig.updateIncentives(
      {
        cleanerIncentiveEnabled,
        cleanerFeeReductionPercent,
        cleanerEligibilityDays,
        cleanerMaxCleanings,
        homeownerIncentiveEnabled,
        homeownerDiscountPercent,
        homeownerMaxCleanings,
      },
      req.user.id,
      changeNote || null
    );

    console.log(
      `[Incentives API] Incentives updated by owner ${req.user.id} (${req.user.username})`
    );

    res.json({
      success: true,
      message: "Incentive configuration updated successfully",
      config: {
        id: newConfig.id,
        cleanerIncentiveEnabled: newConfig.cleanerIncentiveEnabled,
        cleanerFeeReductionPercent: parseFloat(newConfig.cleanerFeeReductionPercent),
        cleanerEligibilityDays: newConfig.cleanerEligibilityDays,
        cleanerMaxCleanings: newConfig.cleanerMaxCleanings,
        homeownerIncentiveEnabled: newConfig.homeownerIncentiveEnabled,
        homeownerDiscountPercent: parseFloat(newConfig.homeownerDiscountPercent),
        homeownerMaxCleanings: newConfig.homeownerMaxCleanings,
        isActive: newConfig.isActive,
        createdAt: newConfig.createdAt,
      },
      formattedConfig: await IncentiveConfig.getFormattedConfig(),
    });
  } catch (error) {
    console.error("[Incentives API] Error updating config:", error);
    res.status(500).json({ error: "Failed to update incentive configuration" });
  }
});

/**
 * GET /history
 * Get incentive config change history (owner only)
 */
incentivesRouter.get("/history", verifyOwner, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await IncentiveConfig.getHistory(limit);

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
              email: config.updatedByUser.email,
            }
          : null,
        changeNote: config.changeNote,
        cleaner: {
          enabled: config.cleanerIncentiveEnabled,
          feeReductionPercent: parseFloat(config.cleanerFeeReductionPercent),
          eligibilityDays: config.cleanerEligibilityDays,
          maxCleanings: config.cleanerMaxCleanings,
        },
        homeowner: {
          enabled: config.homeownerIncentiveEnabled,
          discountPercent: parseFloat(config.homeownerDiscountPercent),
          maxCleanings: config.homeownerMaxCleanings,
        },
      })),
    });
  } catch (error) {
    console.error("[Incentives API] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch incentive history" });
  }
});

/**
 * GET /cleaner-eligibility
 * Check if the current authenticated cleaner is eligible for incentives
 */
incentivesRouter.get("/cleaner-eligibility", verifyUser, async (req, res) => {
  try {
    const eligibility = await IncentiveService.isCleanerEligible(req.user.id);
    res.json(eligibility);
  } catch (error) {
    console.error("[Incentives API] Error checking cleaner eligibility:", error);
    res.status(500).json({ error: "Failed to check eligibility" });
  }
});

/**
 * GET /homeowner-eligibility
 * Check if the current authenticated homeowner is eligible for incentives
 */
incentivesRouter.get("/homeowner-eligibility", verifyUser, async (req, res) => {
  try {
    const eligibility = await IncentiveService.isHomeownerEligible(req.user.id);
    res.json(eligibility);
  } catch (error) {
    console.error("[Incentives API] Error checking homeowner eligibility:", error);
    res.status(500).json({ error: "Failed to check eligibility" });
  }
});

module.exports = incentivesRouter;
