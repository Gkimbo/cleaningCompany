const express = require("express");
const { verifyIdName } = require("../../../services/idVerificationService");
const { PricingConfig } = require("../../../models");

const idVerificationRouter = express.Router();

/**
 * GET /api/v1/id-verification/status
 * Check if ID verification is enabled
 */
idVerificationRouter.get("/status", async (req, res) => {
  try {
    const config = await PricingConfig.getActive();
    const enabled = config?.idVerificationEnabled && !!process.env.GOOGLE_CLOUD_VISION_API_KEY;
    return res.status(200).json({ enabled });
  } catch (error) {
    // On any error, just say it's disabled
    return res.status(200).json({ enabled: false });
  }
});

/**
 * POST /api/v1/id-verification/verify
 * Verify that the name on an ID photo matches the applicant's entered name
 *
 * Body:
 * - imageBase64: The ID photo as a base64-encoded string (with or without data URL prefix)
 * - firstName: The applicant's entered first name
 * - lastName: The applicant's entered last name
 *
 * Response always returns 200 to prevent frontend errors.
 * Use 'verified', 'skipped', and 'confidence' fields to determine result.
 */
idVerificationRouter.post("/verify", async (req, res) => {
  try {
    const { imageBase64, firstName, lastName } = req.body;

    // Check if ID verification is enabled in settings
    try {
      const config = await PricingConfig.getActive();
      if (!config || !config.idVerificationEnabled) {
        return res.status(200).json({
          verified: null,
          confidence: 0,
          message: "",
          skipped: true,
          disabled: true,
        });
      }
    } catch (configError) {
      // If we can't check the config, skip verification silently
      console.warn("Could not check ID verification config:", configError.message);
      return res.status(200).json({
        verified: null,
        confidence: 0,
        message: "",
        skipped: true,
      });
    }

    // Validate required fields - return skipped response instead of error
    if (!imageBase64) {
      return res.status(200).json({
        verified: null,
        confidence: 0,
        message: "",
        skipped: true,
      });
    }

    if (!firstName || !lastName) {
      return res.status(200).json({
        verified: null,
        confidence: 0,
        message: "",
        skipped: true,
      });
    }

    // Check if Google Cloud Vision API is configured
    if (!process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      // Silently skip - no error message needed
      return res.status(200).json({
        verified: null,
        confidence: 0,
        message: "",
        skipped: true,
      });
    }

    // Validate base64 image size (max ~10MB after base64 encoding)
    const base64Size = imageBase64.length * 0.75; // Approximate decoded size
    if (base64Size > 10 * 1024 * 1024) {
      return res.status(200).json({
        verified: null,
        confidence: 0,
        message: "Image file is too large. Please use a smaller image.",
        skipped: true,
      });
    }

    // Verify the ID
    const result = await verifyIdName(imageBase64, firstName, lastName);

    // Ensure we always return a valid response structure
    return res.status(200).json({
      verified: result.verified ?? null,
      confidence: result.confidence ?? 0,
      message: result.message || "",
      extractedText: result.extractedText || "",
      suggestedNames: result.suggestedNames || [],
      detectedName: result.detectedName || null,
      skipped: result.skipped || false,
    });
  } catch (error) {
    // Log the error but return a graceful response
    console.error("Error in ID verification endpoint:", error);

    // Always return 200 with skipped flag so the app continues to work
    return res.status(200).json({
      verified: null,
      confidence: 0,
      message: "ID verification temporarily unavailable. Your application will be reviewed manually.",
      skipped: true,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = idVerificationRouter;
