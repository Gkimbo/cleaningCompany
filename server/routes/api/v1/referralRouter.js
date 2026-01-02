/**
 * Referral Router
 * API endpoints for managing referral programs and tracking referrals
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const models = require("../../../models");
const { User, ReferralConfig, Referral } = models;
const ReferralService = require("../../../services/ReferralService");

const referralRouter = express.Router();
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

// =====================
// PUBLIC ENDPOINTS
// =====================

/**
 * GET /validate/:code
 * Validate a referral code during signup
 * Public endpoint
 */
referralRouter.get("/validate/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const { userType } = req.query; // 'homeowner' or 'cleaner'

    const result = await ReferralService.validateReferralCode(
      code,
      userType || "homeowner",
      models
    );

    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        error: result.error,
        errorCode: result.errorCode
      });
    }

    res.json({
      valid: true,
      referrer: {
        firstName: result.referrer.firstName,
      },
      programType: result.programType,
      rewards: {
        referrerReward: result.rewards.referrerReward,
        referredReward: result.rewards.referredReward,
        cleaningsRequired: result.rewards.cleaningsRequired,
      },
    });
  } catch (error) {
    console.error("[Referral API] Error validating code:", error);
    res.status(500).json({
      valid: false,
      error: "Unable to validate referral code. Please try again.",
      errorCode: "SERVER_ERROR"
    });
  }
});

/**
 * GET /current
 * Get current active referral programs for marketing display
 * Public endpoint
 */
referralRouter.get("/current", async (req, res) => {
  try {
    const programs = await ReferralService.getCurrentPrograms(models);
    res.json(programs);
  } catch (error) {
    console.error("[Referral API] Error fetching current programs:", error);
    res.status(500).json({ active: false, programs: [] });
  }
});

// =====================
// OWNER ENDPOINTS
// =====================

/**
 * GET /config
 * Get full referral configuration (owner only)
 */
referralRouter.get("/config", verifyOwner, async (req, res) => {
  try {
    const activeConfig = await ReferralConfig.getActive();

    if (activeConfig) {
      return res.json({
        source: "database",
        config: activeConfig,
        formattedConfig: await ReferralConfig.getFormattedConfig(),
      });
    }

    // No config exists yet, return defaults
    res.json({
      source: "defaults",
      config: null,
      formattedConfig: {
        clientToClient: {
          enabled: false,
          referrerReward: 2500,
          referredReward: 2500,
          cleaningsRequired: 1,
          rewardType: "credit",
          maxPerMonth: null,
        },
        clientToCleaner: {
          enabled: false,
          referrerReward: 5000,
          cleaningsRequired: 3,
          rewardType: "credit",
          maxPerMonth: null,
        },
        cleanerToCleaner: {
          enabled: false,
          referrerReward: 5000,
          cleaningsRequired: 1,
          rewardType: "bonus",
          maxPerMonth: null,
        },
        cleanerToClient: {
          enabled: false,
          discountPercent: 10,
          minReferrals: 3,
          rewardType: "discount_percent",
          maxPerMonth: null,
        },
      },
    });
  } catch (error) {
    console.error("[Referral API] Error fetching config:", error);
    res.status(500).json({ error: "Failed to fetch referral configuration" });
  }
});

/**
 * PUT /config
 * Update referral configuration (owner only)
 */
referralRouter.put("/config", verifyOwner, async (req, res) => {
  try {
    const { clientToClient, clientToCleaner, cleanerToCleaner, cleanerToClient, changeNote } = req.body;

    // Validate that at least one program config is provided
    if (!clientToClient && !clientToCleaner && !cleanerToCleaner && !cleanerToClient) {
      return res.status(400).json({ error: "At least one program configuration is required" });
    }

    // Validate reward amounts are non-negative
    const validateProgram = (program, name) => {
      if (!program) return null;

      if (program.referrerReward !== undefined && program.referrerReward < 0) {
        return `${name}.referrerReward must be non-negative`;
      }
      if (program.referredReward !== undefined && program.referredReward < 0) {
        return `${name}.referredReward must be non-negative`;
      }
      if (program.cleaningsRequired !== undefined && program.cleaningsRequired < 1) {
        return `${name}.cleaningsRequired must be at least 1`;
      }
      if (program.maxPerMonth !== undefined && program.maxPerMonth !== null && program.maxPerMonth < 1) {
        return `${name}.maxPerMonth must be at least 1 or null for unlimited`;
      }
      return null;
    };

    const errors = [
      validateProgram(clientToClient, "clientToClient"),
      validateProgram(clientToCleaner, "clientToCleaner"),
      validateProgram(cleanerToCleaner, "cleanerToCleaner"),
      validateProgram(cleanerToClient, "cleanerToClient"),
    ].filter(Boolean);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(", ") });
    }

    // Create new config
    const newConfig = await ReferralConfig.updateConfig(
      { clientToClient, clientToCleaner, cleanerToCleaner, cleanerToClient },
      req.user.id,
      changeNote || null
    );

    console.log(`[Referral API] Config updated by owner ${req.user.id} (${req.user.username})`);

    res.json({
      success: true,
      message: "Referral configuration updated successfully",
      config: newConfig,
      formattedConfig: await ReferralConfig.getFormattedConfig(),
    });
  } catch (error) {
    console.error("[Referral API] Error updating config:", error);
    res.status(500).json({ error: "Failed to update referral configuration" });
  }
});

/**
 * GET /history
 * Get referral config change history (owner only)
 */
referralRouter.get("/history", verifyOwner, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await ReferralConfig.getHistory(limit);

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
            }
          : null,
        changeNote: config.changeNote,
      })),
    });
  } catch (error) {
    console.error("[Referral API] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch referral history" });
  }
});

/**
 * GET /all
 * Get all referrals with filters (owner only)
 */
referralRouter.get("/all", verifyOwner, async (req, res) => {
  try {
    const { status, programType, startDate, endDate } = req.query;

    const referrals = await ReferralService.getAllReferrals(
      { status, programType, startDate, endDate },
      models
    );

    res.json({
      count: referrals.length,
      referrals: referrals.map((r) => ({
        id: r.id,
        referrer: r.referrer ? {
          id: r.referrer.id,
          firstName: r.referrer.firstName,
          lastName: r.referrer.lastName,
          type: r.referrer.type,
        } : null,
        referred: r.referred ? {
          id: r.referred.id,
          firstName: r.referred.firstName,
          lastName: r.referred.lastName,
          type: r.referred.type,
        } : null,
        programType: r.programType,
        status: r.status,
        cleaningsRequired: r.cleaningsRequired,
        cleaningsCompleted: r.cleaningsCompleted,
        referrerRewardAmount: r.referrerRewardAmount,
        referredRewardAmount: r.referredRewardAmount,
        referrerRewardApplied: r.referrerRewardApplied,
        referredRewardApplied: r.referredRewardApplied,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
      })),
    });
  } catch (error) {
    console.error("[Referral API] Error fetching all referrals:", error);
    res.status(500).json({ error: "Failed to fetch referrals" });
  }
});

/**
 * PATCH /:id/status
 * Manually update referral status (owner only)
 */
referralRouter.patch("/:id/status", verifyOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const referral = await ReferralService.updateReferralStatus(parseInt(id), status, models);

    res.json({
      success: true,
      message: `Referral status updated to ${status}`,
      referral: {
        id: referral.id,
        status: referral.status,
        qualifiedAt: referral.qualifiedAt,
        referrerRewardApplied: referral.referrerRewardApplied,
        referredRewardApplied: referral.referredRewardApplied,
      },
    });
  } catch (error) {
    console.error("[Referral API] Error updating status:", error);
    res.status(500).json({ error: error.message || "Failed to update referral status" });
  }
});

// =====================
// AUTHENTICATED USER ENDPOINTS
// =====================

/**
 * GET /my-code
 * Get or generate user's referral code
 */
referralRouter.get("/my-code", verifyUser, async (req, res) => {
  try {
    let code = req.user.referralCode;

    // Generate code if user doesn't have one
    if (!code) {
      code = await ReferralService.generateReferralCode(req.user, models);
    }

    // Get current programs to show what user can share
    const programs = await ReferralService.getCurrentPrograms(models);

    res.json({
      referralCode: code,
      shareMessage: `Use my code ${code} to sign up for Kleanr and we both get rewards!`,
      programs: programs.programs.filter((p) => {
        // Filter programs based on user type
        const userType = req.user.type || "homeowner";
        if (userType === "homeowner" || userType === null) {
          return p.type === "client_to_client" || p.type === "client_to_cleaner";
        } else if (userType === "cleaner") {
          return p.type === "cleaner_to_cleaner" || p.type === "cleaner_to_client";
        }
        return false;
      }),
    });
  } catch (error) {
    console.error("[Referral API] Error getting my-code:", error);
    res.status(500).json({ error: "Failed to get referral code" });
  }
});

/**
 * GET /my-referrals
 * Get user's referral history and stats
 */
referralRouter.get("/my-referrals", verifyUser, async (req, res) => {
  try {
    const stats = await ReferralService.getUserReferralStats(req.user.id, models);

    // Get list of referrals made by this user
    const referrals = await Referral.findByReferrer(req.user.id, {
      include: [
        { association: "referred", attributes: ["id", "firstName", "type"] },
      ],
    });

    res.json({
      referralCode: stats.referralCode,
      availableCredits: stats.availableCredits,
      stats: {
        totalReferrals: stats.totalReferrals,
        pending: stats.pending,
        qualified: stats.qualified,
        rewarded: stats.rewarded,
        totalEarned: stats.totalEarned,
      },
      referrals: referrals.map((r) => ({
        id: r.id,
        referred: r.referred ? {
          firstName: r.referred.firstName,
          type: r.referred.type,
        } : null,
        programType: r.programType,
        status: r.status,
        cleaningsCompleted: r.cleaningsCompleted,
        cleaningsRequired: r.cleaningsRequired,
        rewardAmount: r.referrerRewardAmount,
        rewardApplied: r.referrerRewardApplied,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Referral API] Error getting my-referrals:", error);
    res.status(500).json({ error: "Failed to get referral history" });
  }
});

/**
 * GET /my-credits
 * Get available referral credits
 */
referralRouter.get("/my-credits", verifyUser, async (req, res) => {
  try {
    const credits = await ReferralService.getAvailableCredits(req.user.id, models);

    res.json({
      availableCredits: credits,
      availableDollars: (credits / 100).toFixed(2),
    });
  } catch (error) {
    console.error("[Referral API] Error getting credits:", error);
    res.status(500).json({ error: "Failed to get referral credits" });
  }
});

/**
 * POST /apply-credits
 * Apply referral credits to an appointment
 */
referralRouter.post("/apply-credits", verifyUser, async (req, res) => {
  try {
    const { appointmentId, amount } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: "appointmentId is required" });
    }

    const amountCents = amount ? parseInt(amount) : Infinity; // Apply max if not specified

    const result = await ReferralService.applyCreditsToAppointment(
      req.user.id,
      appointmentId,
      amountCents,
      models
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      amountApplied: result.amountApplied,
      amountAppliedDollars: (result.amountApplied / 100).toFixed(2),
      remainingCredits: result.remainingCredits,
      newPrice: result.newPrice,
    });
  } catch (error) {
    console.error("[Referral API] Error applying credits:", error);
    res.status(500).json({ error: "Failed to apply referral credits" });
  }
});

/**
 * POST /share
 * Log a share action (for analytics)
 */
referralRouter.post("/share", verifyUser, async (req, res) => {
  try {
    const { platform } = req.body; // 'copy', 'sms', 'email', 'social'

    // Just log for now, could store in analytics table later
    console.log(`[Referral API] User ${req.user.id} shared referral code via ${platform || "unknown"}`);

    res.json({ success: true });
  } catch (error) {
    console.error("[Referral API] Error logging share:", error);
    res.status(500).json({ error: "Failed to log share action" });
  }
});

module.exports = referralRouter;
