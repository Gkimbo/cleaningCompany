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
      // Serialize config with proper decimal parsing
      const serializedConfig = {
        id: activeConfig.id,
        basePrice: activeConfig.basePrice,
        extraBedBathFee: activeConfig.extraBedBathFee,
        halfBathFee: activeConfig.halfBathFee,
        sheetFeePerBed: activeConfig.sheetFeePerBed,
        towelFee: activeConfig.towelFee,
        faceClothFee: activeConfig.faceClothFee,
        timeWindowAnytime: activeConfig.timeWindowAnytime,
        timeWindow10To3: activeConfig.timeWindow10To3,
        timeWindow11To4: activeConfig.timeWindow11To4,
        timeWindow12To2: activeConfig.timeWindow12To2,
        cancellationFee: activeConfig.cancellationFee,
        cancellationWindowDays: activeConfig.cancellationWindowDays,
        homeownerPenaltyDays: activeConfig.homeownerPenaltyDays,
        cleanerPenaltyDays: activeConfig.cleanerPenaltyDays,
        // Parse decimal fields to ensure they're numbers, not strings
        refundPercentage: parseFloat(activeConfig.refundPercentage),
        platformFeePercent: parseFloat(activeConfig.platformFeePercent),
        businessOwnerFeePercent: parseFloat(activeConfig.businessOwnerFeePercent || activeConfig.platformFeePercent),
        multiCleanerPlatformFeePercent: parseFloat(activeConfig.multiCleanerPlatformFeePercent || 0.13),
        incentiveRefundPercent: parseFloat(activeConfig.incentiveRefundPercent || 0.10),
        incentiveCleanerPercent: parseFloat(activeConfig.incentiveCleanerPercent || 0.40),
        largeBusinessFeePercent: parseFloat(activeConfig.largeBusinessFeePercent || 0.07),
        largeBusinessMonthlyThreshold: activeConfig.largeBusinessMonthlyThreshold || 50,
        largeBusinessLookbackMonths: activeConfig.largeBusinessLookbackMonths || 1,
        soloLargeHomeBonus: activeConfig.soloLargeHomeBonus || 0,
        largeHomeBedsThreshold: activeConfig.largeHomeBedsThreshold || 3,
        largeHomeBathsThreshold: activeConfig.largeHomeBathsThreshold || 3,
        multiCleanerOfferExpirationHours: activeConfig.multiCleanerOfferExpirationHours || 48,
        urgentFillDays: activeConfig.urgentFillDays || 7,
        finalWarningDays: activeConfig.finalWarningDays || 3,
        highVolumeFee: activeConfig.highVolumeFee,
        lastMinuteFee: activeConfig.lastMinuteFee || 50,
        lastMinuteThresholdHours: activeConfig.lastMinuteThresholdHours || 48,
        lastMinuteNotificationRadiusMiles: parseFloat(activeConfig.lastMinuteNotificationRadiusMiles || 25),
        // Completion approval settings
        completionAutoApprovalHours: activeConfig.completionAutoApprovalHours || 4,
        completionRequiresPhotos: activeConfig.completionRequiresPhotos || false,
        isActive: activeConfig.isActive,
        updatedBy: activeConfig.updatedBy,
        changeNote: activeConfig.changeNote,
        createdAt: activeConfig.createdAt,
        updatedAt: activeConfig.updatedAt,
      };

      return res.json({
        source: "database",
        config: serializedConfig,
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
        businessOwnerFeePercent: pricing.platform.businessOwnerFeePercent,
        largeBusinessFeePercent: pricing.platform.largeBusinessFeePercent,
        largeBusinessMonthlyThreshold: pricing.platform.largeBusinessMonthlyThreshold,
        largeBusinessLookbackMonths: pricing.platform.largeBusinessLookbackMonths,
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
      // Base pricing
      basePrice,
      extraBedBathFee,
      halfBathFee,
      sheetFeePerBed,
      towelFee,
      faceClothFee,
      // Time windows
      timeWindowAnytime,
      timeWindow10To3,
      timeWindow11To4,
      timeWindow12To2,
      // Cancellation
      cancellationFee,
      cancellationWindowDays,
      homeownerPenaltyDays,
      cleanerPenaltyDays,
      refundPercentage,
      // Platform fees
      platformFeePercent,
      businessOwnerFeePercent,
      multiCleanerPlatformFeePercent,
      // Incentive settings
      incentiveRefundPercent,
      incentiveCleanerPercent,
      // Multi-cleaner settings
      soloLargeHomeBonus,
      largeHomeBedsThreshold,
      largeHomeBathsThreshold,
      multiCleanerOfferExpirationHours,
      urgentFillDays,
      finalWarningDays,
      // Large business fee settings
      largeBusinessFeePercent,
      largeBusinessMonthlyThreshold,
      largeBusinessLookbackMonths,
      // Last-minute booking settings
      lastMinuteFee,
      lastMinuteThresholdHours,
      lastMinuteNotificationRadiusMiles,
      // Completion approval settings
      completionAutoApprovalHours,
      completionRequiresPhotos,
      // Other
      highVolumeFee,
      changeNote,
    } = req.body;

    // Validate required fields (base fields required, multi-cleaner fields optional)
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

    // Validate optional percentage fields if provided
    if (multiCleanerPlatformFeePercent !== undefined && (multiCleanerPlatformFeePercent < 0 || multiCleanerPlatformFeePercent > 1)) {
      return res.status(400).json({
        error: "multiCleanerPlatformFeePercent must be between 0 and 1",
      });
    }

    if (incentiveRefundPercent !== undefined && (incentiveRefundPercent < 0 || incentiveRefundPercent > 1)) {
      return res.status(400).json({
        error: "incentiveRefundPercent must be between 0 and 1",
      });
    }

    if (incentiveCleanerPercent !== undefined && (incentiveCleanerPercent < 0 || incentiveCleanerPercent > 1)) {
      return res.status(400).json({
        error: "incentiveCleanerPercent must be between 0 and 1",
      });
    }

    if (largeBusinessFeePercent !== undefined && (largeBusinessFeePercent < 0 || largeBusinessFeePercent > 1)) {
      return res.status(400).json({
        error: "largeBusinessFeePercent must be between 0 and 1",
      });
    }

    if (largeBusinessMonthlyThreshold !== undefined && (typeof largeBusinessMonthlyThreshold !== "number" || largeBusinessMonthlyThreshold < 1)) {
      return res.status(400).json({
        error: "largeBusinessMonthlyThreshold must be a positive integer",
      });
    }

    if (largeBusinessLookbackMonths !== undefined && (typeof largeBusinessLookbackMonths !== "number" || largeBusinessLookbackMonths < 1 || largeBusinessLookbackMonths > 12)) {
      return res.status(400).json({
        error: "largeBusinessLookbackMonths must be between 1 and 12",
      });
    }

    // Validate completion approval settings
    if (completionAutoApprovalHours !== undefined && (typeof completionAutoApprovalHours !== "number" || completionAutoApprovalHours < 1 || completionAutoApprovalHours > 24)) {
      return res.status(400).json({
        error: "completionAutoApprovalHours must be between 1 and 24",
      });
    }

    if (completionRequiresPhotos !== undefined && typeof completionRequiresPhotos !== "boolean") {
      return res.status(400).json({
        error: "completionRequiresPhotos must be a boolean",
      });
    }

    // Build config update object with required and optional fields
    const configData = {
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

    // Add optional multi-cleaner and incentive fields if provided
    if (multiCleanerPlatformFeePercent !== undefined) configData.multiCleanerPlatformFeePercent = multiCleanerPlatformFeePercent;
    if (incentiveRefundPercent !== undefined) configData.incentiveRefundPercent = incentiveRefundPercent;
    if (incentiveCleanerPercent !== undefined) configData.incentiveCleanerPercent = incentiveCleanerPercent;
    if (soloLargeHomeBonus !== undefined) configData.soloLargeHomeBonus = soloLargeHomeBonus;
    if (largeHomeBedsThreshold !== undefined) configData.largeHomeBedsThreshold = largeHomeBedsThreshold;
    if (largeHomeBathsThreshold !== undefined) configData.largeHomeBathsThreshold = largeHomeBathsThreshold;
    if (multiCleanerOfferExpirationHours !== undefined) configData.multiCleanerOfferExpirationHours = multiCleanerOfferExpirationHours;
    if (urgentFillDays !== undefined) configData.urgentFillDays = urgentFillDays;
    if (finalWarningDays !== undefined) configData.finalWarningDays = finalWarningDays;
    if (largeBusinessFeePercent !== undefined) configData.largeBusinessFeePercent = largeBusinessFeePercent;
    if (largeBusinessMonthlyThreshold !== undefined) configData.largeBusinessMonthlyThreshold = largeBusinessMonthlyThreshold;
    if (largeBusinessLookbackMonths !== undefined) configData.largeBusinessLookbackMonths = largeBusinessLookbackMonths;
    // Add last-minute booking fields if provided
    if (lastMinuteFee !== undefined) configData.lastMinuteFee = lastMinuteFee;
    if (lastMinuteThresholdHours !== undefined) configData.lastMinuteThresholdHours = lastMinuteThresholdHours;
    if (lastMinuteNotificationRadiusMiles !== undefined) configData.lastMinuteNotificationRadiusMiles = lastMinuteNotificationRadiusMiles;
    // Add completion approval fields if provided
    if (completionAutoApprovalHours !== undefined) configData.completionAutoApprovalHours = completionAutoApprovalHours;
    if (completionRequiresPhotos !== undefined) configData.completionRequiresPhotos = completionRequiresPhotos;

    // Create new pricing config
    const newConfig = await PricingConfig.updatePricing(
      configData,
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
          multiCleanerPlatformFeePercent: parseFloat(config.multiCleanerPlatformFeePercent || 0.13),
          incentiveRefundPercent: parseFloat(config.incentiveRefundPercent || 0.10),
          incentiveCleanerPercent: parseFloat(config.incentiveCleanerPercent || 0.40),
          soloLargeHomeBonus: config.soloLargeHomeBonus || 0,
          largeHomeBedsThreshold: config.largeHomeBedsThreshold || 3,
          largeHomeBathsThreshold: config.largeHomeBathsThreshold || 3,
          multiCleanerOfferExpirationHours: config.multiCleanerOfferExpirationHours || 48,
          urgentFillDays: config.urgentFillDays || 7,
          finalWarningDays: config.finalWarningDays || 3,
          largeBusinessFeePercent: parseFloat(config.largeBusinessFeePercent || 0.07),
          largeBusinessMonthlyThreshold: config.largeBusinessMonthlyThreshold || 50,
          largeBusinessLookbackMonths: config.largeBusinessLookbackMonths || 1,
          highVolumeFee: config.highVolumeFee,
          // Last-minute booking fields
          lastMinuteFee: config.lastMinuteFee || 50,
          lastMinuteThresholdHours: config.lastMinuteThresholdHours || 48,
          lastMinuteNotificationRadiusMiles: parseFloat(config.lastMinuteNotificationRadiusMiles || 25),
          // Completion approval settings
          completionAutoApprovalHours: config.completionAutoApprovalHours || 4,
          completionRequiresPhotos: config.completionRequiresPhotos || false,
        },
      })),
    });
  } catch (error) {
    console.error("[Pricing API] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch pricing history" });
  }
});

/**
 * PATCH /id-verification
 * Toggle ID verification setting (owner only)
 */
pricingRouter.patch("/id-verification", verifyOwner, async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }

    const currentConfig = await PricingConfig.getActive();
    if (!currentConfig) {
      return res.status(404).json({ error: "No active pricing configuration found" });
    }

    // Update the current config directly instead of creating a new one
    await currentConfig.update({
      idVerificationEnabled: enabled,
      updatedBy: req.user.id,
    });

    console.log(
      `[Pricing API] ID verification ${enabled ? "enabled" : "disabled"} by owner ${req.user.id}`
    );

    res.json({
      message: `ID verification ${enabled ? "enabled" : "disabled"} successfully`,
      idVerificationEnabled: enabled,
    });
  } catch (error) {
    console.error("[Pricing API] Error updating ID verification:", error);
    res.status(500).json({ error: "Failed to update ID verification setting" });
  }
});

module.exports = pricingRouter;
