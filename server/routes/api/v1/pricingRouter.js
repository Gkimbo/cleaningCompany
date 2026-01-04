/**
 * Pricing Router
 * API endpoints for managing pricing configuration
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { User, PricingConfig } = require("../../../models");
const { getPricingConfig, businessConfig } = require("../../../config/businessConfig");
const EncryptionService = require("../../../services/EncryptionService");

const pricingRouter = express.Router();
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

/**
 * GET /current
 * Get current pricing configuration (public endpoint for calculations)
 * Falls back to static config if no database record exists
 */
pricingRouter.get("/current", async (req, res) => {
  try {
    // Get staffing config (always from static config)
    const staffing = businessConfig.staffing;

    // Try to get pricing from database first
    const dbPricing = await PricingConfig.getFormattedPricing();

    if (dbPricing) {
      return res.json({
        source: "database",
        pricing: dbPricing,
        staffing,
      });
    }

    // Fall back to static config via getPricingConfig (which has its own fallback)
    const fallbackPricing = await getPricingConfig();
    return res.json({
      source: "config",
      pricing: fallbackPricing,
      staffing,
    });
  } catch (error) {
    console.error("[Pricing API] Error fetching current pricing:", error);
    // On error, fall back to static config via getPricingConfig
    const fallbackPricing = await getPricingConfig();
    return res.json({
      source: "config",
      pricing: fallbackPricing,
      staffing: businessConfig.staffing,
    });
  }
});

/**
 * GET /config
 * Get full pricing configuration with metadata (owner only)
 */
pricingRouter.get("/config", verifyOwner, async (req, res) => {
  try {
    const activeConfig = await PricingConfig.getActive();

    if (activeConfig) {
      return res.json({
        source: "database",
        config: activeConfig,
        formattedPricing: await PricingConfig.getFormattedPricing(),
      });
    }

    // No database config, return values from getPricingConfig (which has fallback to static)
    const pricing = await getPricingConfig();
    return res.json({
      source: "config",
      config: null,
      formattedPricing: pricing,
      staticDefaults: {
        basePrice: pricing.basePrice,
        extraBedBathFee: pricing.extraBedBathFee,
        halfBathFee: pricing.halfBathFee,
        sheetFeePerBed: pricing.linens.sheetFeePerBed,
        towelFee: pricing.linens.towelFee,
        faceClothFee: pricing.linens.faceClothFee,
        timeWindowAnytime: pricing.timeWindows.anytime,
        timeWindow10To3: pricing.timeWindows["10-3"],
        timeWindow11To4: pricing.timeWindows["11-4"],
        timeWindow12To2: pricing.timeWindows["12-2"],
        cancellationFee: pricing.cancellation.fee,
        cancellationWindowDays: pricing.cancellation.windowDays,
        homeownerPenaltyDays: pricing.cancellation.homeownerPenaltyDays,
        cleanerPenaltyDays: pricing.cancellation.cleanerPenaltyDays,
        refundPercentage: pricing.cancellation.refundPercentage,
        platformFeePercent: pricing.platform.feePercent,
        highVolumeFee: pricing.highVolumeFee,
      },
    });
  } catch (error) {
    console.error("[Pricing API] Error fetching config:", error);
    res.status(500).json({ error: "Failed to fetch pricing configuration" });
  }
});

/**
 * PUT /config
 * Update pricing configuration (owner only)
 */
pricingRouter.put("/config", verifyOwner, async (req, res) => {
  try {
    const {
      basePrice,
      extraBedBathFee,
      halfBathFee,
      sheetFeePerBed,
      towelFee,
      faceClothFee,
      timeWindowAnytime,
      timeWindow10To3,
      timeWindow11To4,
      timeWindow12To2,
      cancellationFee,
      cancellationWindowDays,
      homeownerPenaltyDays,
      cleanerPenaltyDays,
      refundPercentage,
      platformFeePercent,
      businessOwnerFeePercent,
      highVolumeFee,
      changeNote,
    } = req.body;

    // Validate required fields
    const requiredFields = {
      basePrice,
      extraBedBathFee,
      halfBathFee,
      sheetFeePerBed,
      towelFee,
      faceClothFee,
      timeWindowAnytime,
      timeWindow10To3,
      timeWindow11To4,
      timeWindow12To2,
      cancellationFee,
      cancellationWindowDays,
      homeownerPenaltyDays,
      cleanerPenaltyDays,
      refundPercentage,
      platformFeePercent,
      businessOwnerFeePercent,
      highVolumeFee,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields,
      });
    }

    // Validate numeric values
    const numericFields = {
      basePrice,
      extraBedBathFee,
      halfBathFee,
      sheetFeePerBed,
      towelFee,
      faceClothFee,
      timeWindowAnytime,
      timeWindow10To3,
      timeWindow11To4,
      timeWindow12To2,
      cancellationFee,
      cancellationWindowDays,
      homeownerPenaltyDays,
      cleanerPenaltyDays,
      highVolumeFee,
    };

    for (const [field, value] of Object.entries(numericFields)) {
      if (typeof value !== "number" || value < 0) {
        return res.status(400).json({
          error: `Invalid value for ${field}: must be a non-negative number`,
        });
      }
    }

    // Validate percentage fields (0 to 1)
    if (refundPercentage < 0 || refundPercentage > 1) {
      return res.status(400).json({
        error: "refundPercentage must be between 0 and 1",
      });
    }

    if (platformFeePercent < 0 || platformFeePercent > 1) {
      return res.status(400).json({
        error: "platformFeePercent must be between 0 and 1",
      });
    }

    if (businessOwnerFeePercent < 0 || businessOwnerFeePercent > 1) {
      return res.status(400).json({
        error: "businessOwnerFeePercent must be between 0 and 1",
      });
    }

    // Create new pricing config
    const newConfig = await PricingConfig.updatePricing(
      {
        basePrice,
        extraBedBathFee,
        halfBathFee,
        sheetFeePerBed,
        towelFee,
        faceClothFee,
        timeWindowAnytime,
        timeWindow10To3,
        timeWindow11To4,
        timeWindow12To2,
        cancellationFee,
        cancellationWindowDays,
        homeownerPenaltyDays,
        cleanerPenaltyDays,
        refundPercentage,
        platformFeePercent,
        businessOwnerFeePercent,
        highVolumeFee,
      },
      req.user.id,
      changeNote || null
    );

    console.log(
      `[Pricing API] Pricing updated by owner ${req.user.id} (${req.user.username})`
    );

    res.json({
      success: true,
      message: "Pricing configuration updated successfully",
      config: newConfig,
      formattedPricing: await PricingConfig.getFormattedPricing(),
    });
  } catch (error) {
    console.error("[Pricing API] Error updating config:", error);
    res.status(500).json({ error: "Failed to update pricing configuration" });
  }
});

/**
 * GET /history
 * Get pricing change history (owner only)
 */
pricingRouter.get("/history", verifyOwner, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await PricingConfig.getHistory(limit);

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
        pricing: {
          basePrice: config.basePrice,
          extraBedBathFee: config.extraBedBathFee,
          halfBathFee: config.halfBathFee,
          sheetFeePerBed: config.sheetFeePerBed,
          towelFee: config.towelFee,
          faceClothFee: config.faceClothFee,
          timeWindowAnytime: config.timeWindowAnytime,
          timeWindow10To3: config.timeWindow10To3,
          timeWindow11To4: config.timeWindow11To4,
          timeWindow12To2: config.timeWindow12To2,
          cancellationFee: config.cancellationFee,
          cancellationWindowDays: config.cancellationWindowDays,
          homeownerPenaltyDays: config.homeownerPenaltyDays,
          cleanerPenaltyDays: config.cleanerPenaltyDays,
          refundPercentage: parseFloat(config.refundPercentage),
          platformFeePercent: parseFloat(config.platformFeePercent),
          businessOwnerFeePercent: parseFloat(config.businessOwnerFeePercent || config.platformFeePercent),
          highVolumeFee: config.highVolumeFee,
        },
      })),
    });
  } catch (error) {
    console.error("[Pricing API] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch pricing history" });
  }
});

module.exports = pricingRouter;
