/**
 * ============================================================================
 * TAX ROUTER
 * Handles W-9 submission, tax info management, and 1099-NEC generation
 * ============================================================================
 *
 * Endpoints:
 * - POST /submit-w9        Submit W-9 tax information
 * - GET /tax-info/:userId  Get cleaner's tax info
 * - PUT /tax-info/:userId  Update cleaner's tax info
 * - GET /1099/:userId/:year Generate 1099-NEC for cleaner
 * - GET /1099-summary/:year Get summary of all 1099s for a year
 * - GET /earnings-summary/:userId/:year Get annual earnings summary
 *
 * ============================================================================
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  User,
  TaxInfo,
  TaxDocument,
  Payment,
  Payout,
} = require("../../../models");
const TaxDocumentService = require("../../../services/TaxDocumentService");

const taxRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Encryption key for TIN storage (should be from environment in production)
const ENCRYPTION_KEY = process.env.TAX_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ENCRYPTION_IV_LENGTH = 16;

// ============================================================================
// ENCRYPTION HELPERS
// ============================================================================

/**
 * Encrypt sensitive data (TIN)
 */
function encrypt(text) {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypt sensitive data (TIN)
 */
function decrypt(text) {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("[Tax] Decryption failed:", error.message);
    return null;
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate SSN format (XXX-XX-XXXX)
 */
function validateSSN(ssn) {
  const cleaned = ssn.replace(/\D/g, "");
  if (cleaned.length !== 9) return { valid: false, error: "SSN must be 9 digits" };

  const area = cleaned.substring(0, 3);
  const group = cleaned.substring(3, 5);
  const serial = cleaned.substring(5, 9);

  if (area === "000" || group === "00" || serial === "0000") {
    return { valid: false, error: "Invalid SSN format" };
  }
  if (area === "666" || parseInt(area) >= 900) {
    return { valid: false, error: "Invalid SSN area number" };
  }

  return { valid: true, cleaned };
}

/**
 * Validate EIN format (XX-XXXXXXX)
 */
function validateEIN(ein) {
  const cleaned = ein.replace(/\D/g, "");
  if (cleaned.length !== 9) return { valid: false, error: "EIN must be 9 digits" };

  const validPrefixes = [
    "10", "12", "20", "27", "30", "32", "35", "36", "37", "38", "39",
    "40", "41", "42", "43", "44", "45", "46", "47", "48", "50", "51",
    "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62",
    "63", "64", "65", "66", "67", "68", "71", "72", "73", "74", "75",
    "76", "77", "80", "81", "82", "83", "84", "85", "86", "87", "88",
    "90", "91", "92", "93", "94", "95", "98", "99",
  ];

  const prefix = cleaned.substring(0, 2);
  if (!validPrefixes.includes(prefix)) {
    return { valid: false, error: "Invalid EIN prefix" };
  }

  return { valid: true, cleaned };
}

/**
 * Validate US state abbreviation
 */
const VALID_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP",
];

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /submit-w9
 * Submit W-9 tax information for a cleaner
 */
taxRouter.post("/submit-w9", async (req, res) => {
  const {
    token,
    legalName,
    businessName,
    taxClassification,
    addressLine1,
    addressLine2,
    city,
    state,
    zipCode,
    tinType,
    tin,
    certificationSignature,
  } = req.body;

  // Validate token
  let decoded;
  try {
    decoded = jwt.verify(token, secretKey);
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }

  const userId = decoded.userId;

  // Validate required fields
  if (!legalName || !addressLine1 || !city || !state || !zipCode || !tin || !certificationSignature) {
    return res.status(400).json({
      error: "Missing required fields",
      code: "MISSING_FIELDS",
      required: ["legalName", "addressLine1", "city", "state", "zipCode", "tin", "certificationSignature"],
    });
  }

  // Validate state
  if (!VALID_STATES.includes(state.toUpperCase())) {
    return res.status(400).json({
      error: "Invalid state abbreviation",
      code: "INVALID_STATE",
    });
  }

  // Validate TIN
  const tinTypeValue = tinType || "ssn";
  let tinValidation;
  if (tinTypeValue === "ssn") {
    tinValidation = validateSSN(tin);
  } else if (tinTypeValue === "ein") {
    tinValidation = validateEIN(tin);
  } else {
    return res.status(400).json({
      error: "Invalid TIN type",
      code: "INVALID_TIN_TYPE",
    });
  }

  if (!tinValidation.valid) {
    return res.status(400).json({
      error: tinValidation.error,
      code: "INVALID_TIN",
    });
  }

  try {
    // Check if user exists and is a cleaner
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (user.type !== "cleaner") {
      return res.status(403).json({
        error: "Only cleaners can submit W-9 information",
        code: "NOT_A_CLEANER",
      });
    }

    // Check for existing tax info
    let taxInfo = await TaxInfo.findOne({ where: { userId } });

    const encryptedTin = encrypt(tinValidation.cleaned);
    const tinLast4 = tinValidation.cleaned.slice(-4);

    const taxData = {
      userId,
      legalName: legalName.trim(),
      businessName: businessName ? businessName.trim() : null,
      taxClassification: taxClassification || "individual",
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2 ? addressLine2.trim() : null,
      city: city.trim(),
      state: state.toUpperCase(),
      zipCode: zipCode.trim(),
      tinType: tinTypeValue,
      tinEncrypted: encryptedTin,
      tinLast4,
      certificationDate: new Date(),
      certificationSignature: certificationSignature.trim(),
      certificationIpAddress: req.ip || req.headers["x-forwarded-for"],
      status: "pending",
      lastUpdatedBy: "user",
    };

    if (taxInfo) {
      // Update existing
      await taxInfo.update(taxData);
    } else {
      // Create new
      taxInfo = await TaxInfo.create(taxData);
    }

    console.log(`[Tax] W-9 submitted for user ${userId}`);

    return res.status(201).json({
      success: true,
      message: "W-9 information submitted successfully",
      taxInfo: {
        id: taxInfo.id,
        legalName: taxInfo.legalName,
        tinType: taxInfo.tinType,
        tinLast4: taxInfo.tinLast4,
        status: taxInfo.status,
        certificationDate: taxInfo.certificationDate,
      },
    });
  } catch (error) {
    console.error("[Tax] Error submitting W-9:", error);
    return res.status(500).json({
      error: "Failed to submit W-9 information",
      code: "SUBMIT_FAILED",
    });
  }
});

/**
 * GET /tax-info/:userId
 * Get cleaner's tax info (masked TIN)
 */
taxRouter.get("/tax-info/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const taxInfo = await TaxInfo.findOne({ where: { userId } });

    if (!taxInfo) {
      return res.status(404).json({
        error: "Tax information not found",
        code: "TAX_INFO_NOT_FOUND",
        hasTaxInfo: false,
      });
    }

    // Format masked TIN
    const maskedTin = taxInfo.tinType === "ssn"
      ? `XXX-XX-${taxInfo.tinLast4}`
      : `XX-XXX${taxInfo.tinLast4}`;

    return res.json({
      hasTaxInfo: true,
      taxInfo: {
        id: taxInfo.id,
        legalName: taxInfo.legalName,
        businessName: taxInfo.businessName,
        taxClassification: taxInfo.taxClassification,
        addressLine1: taxInfo.addressLine1,
        addressLine2: taxInfo.addressLine2,
        city: taxInfo.city,
        state: taxInfo.state,
        zipCode: taxInfo.zipCode,
        tinType: taxInfo.tinType,
        tinMasked: maskedTin,
        tinLast4: taxInfo.tinLast4,
        certificationDate: taxInfo.certificationDate,
        status: taxInfo.status,
        tinVerified: taxInfo.tinVerified,
        form1099Required: taxInfo.form1099Required,
      },
    });
  } catch (error) {
    console.error("[Tax] Error fetching tax info:", error);
    return res.status(500).json({
      error: "Failed to fetch tax information",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /earnings-summary/:userId/:year
 * Get annual earnings summary for 1099 determination
 */
taxRouter.get("/earnings-summary/:userId/:year", async (req, res) => {
  const { userId, year } = req.params;
  const taxYear = parseInt(year);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    // Get all completed payouts for the year
    const payments = await Payment.findAll({
      where: {
        cleanerId: userId,
        type: "payout",
        status: "succeeded",
        taxYear,
        reportable: true,
      },
      order: [["processedAt", "ASC"]],
    });

    const totalAmountCents = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalAmountDollars = (totalAmountCents / 100).toFixed(2);
    const requires1099 = totalAmountCents >= 60000; // $600 threshold

    // Get monthly breakdown
    const monthlyBreakdown = {};
    payments.forEach((p) => {
      const month = new Date(p.processedAt).getMonth() + 1;
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = { count: 0, amountCents: 0 };
      }
      monthlyBreakdown[month].count++;
      monthlyBreakdown[month].amountCents += p.amount;
    });

    // Update TaxInfo if we have one
    const taxInfo = await TaxInfo.findOne({ where: { userId } });
    if (taxInfo && taxInfo.form1099Required !== requires1099) {
      await taxInfo.update({ form1099Required: requires1099 });
    }

    return res.json({
      userId: parseInt(userId),
      taxYear,
      totalAmountCents,
      totalAmountDollars,
      transactionCount: payments.length,
      requires1099,
      threshold: {
        amountCents: 60000,
        amountDollars: "600.00",
        met: requires1099,
      },
      monthlyBreakdown: Object.entries(monthlyBreakdown).map(([month, data]) => ({
        month: parseInt(month),
        count: data.count,
        amountCents: data.amountCents,
        amountDollars: (data.amountCents / 100).toFixed(2),
      })),
      hasTaxInfoOnFile: !!taxInfo,
    });
  } catch (error) {
    console.error("[Tax] Error fetching earnings summary:", error);
    return res.status(500).json({
      error: "Failed to fetch earnings summary",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /1099/:userId/:year
 * Generate 1099-NEC data for a cleaner
 */
taxRouter.get("/1099/:userId/:year", async (req, res) => {
  const { userId, year } = req.params;
  const taxYear = parseInt(year);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    // Get cleaner's tax info
    const taxInfo = await TaxInfo.findOne({ where: { userId } });
    if (!taxInfo) {
      return res.status(400).json({
        error: "Cleaner has not submitted W-9 information",
        code: "NO_TAX_INFO",
      });
    }

    // Get total reportable payments
    const totalResult = await Payment.getTotalReportableAmount(userId, taxYear);

    if (totalResult.totalAmountCents < 60000) {
      return res.json({
        requires1099: false,
        message: "Total payments below $600 threshold - no 1099 required",
        totalAmountDollars: totalResult.totalAmountDollars,
        threshold: "600.00",
      });
    }

    // Get user info
    const user = await User.findByPk(userId);

    // Platform information (should come from config in production)
    const platformInfo = {
      name: process.env.COMPANY_NAME || "Cleaning Company Platform",
      ein: process.env.COMPANY_EIN || "XX-XXXXXXX",
      address: process.env.COMPANY_ADDRESS || "123 Platform St, City, ST 12345",
      phone: process.env.COMPANY_PHONE || "555-555-5555",
    };

    // Generate 1099-NEC data
    const form1099Data = {
      taxYear,
      documentType: "1099-NEC",

      // Payer (Platform)
      payer: {
        name: platformInfo.name,
        tin: platformInfo.ein,
        address: platformInfo.address,
        phone: platformInfo.phone,
      },

      // Recipient (Cleaner)
      recipient: {
        name: taxInfo.legalName,
        tin: `XXX-XX-${taxInfo.tinLast4}`, // Masked for display
        tinLast4: taxInfo.tinLast4,
        address: [
          taxInfo.addressLine1,
          taxInfo.addressLine2,
          `${taxInfo.city}, ${taxInfo.state} ${taxInfo.zipCode}`,
        ].filter(Boolean).join("\n"),
      },

      // Box 1: Nonemployee compensation
      box1: {
        description: "Nonemployee compensation",
        amountCents: totalResult.totalAmountCents,
        amountDollars: totalResult.totalAmountDollars,
      },

      // Box 4: Federal income tax withheld (typically 0)
      box4: {
        description: "Federal income tax withheld",
        amountCents: 0,
        amountDollars: "0.00",
      },

      // Summary
      summary: {
        transactionCount: totalResult.transactionCount,
        requires1099: true,
      },
    };

    return res.json({
      requires1099: true,
      form1099: form1099Data,
    });
  } catch (error) {
    console.error("[Tax] Error generating 1099:", error);
    return res.status(500).json({
      error: "Failed to generate 1099 data",
      code: "GENERATE_FAILED",
    });
  }
});

/**
 * GET /1099-summary/:year
 * Get summary of all cleaners requiring 1099s for a year (admin endpoint)
 */
taxRouter.get("/1099-summary/:year", async (req, res) => {
  const { year } = req.params;
  const taxYear = parseInt(year);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    // Get all cleaners with reportable payments
    const { sequelize } = require("../../../models");
    const [results] = await sequelize.query(`
      SELECT
        p."cleanerId",
        SUM(p.amount) as "totalAmountCents",
        COUNT(p.id) as "transactionCount"
      FROM "Payments" p
      WHERE p.type = 'payout'
        AND p.status = 'succeeded'
        AND p."taxYear" = :taxYear
        AND p.reportable = true
      GROUP BY p."cleanerId"
      HAVING SUM(p.amount) >= 60000
      ORDER BY SUM(p.amount) DESC
    `, {
      replacements: { taxYear },
      type: sequelize.QueryTypes.SELECT,
    });

    // Enrich with user and tax info
    const cleanersRequiring1099 = await Promise.all(
      (results || []).map(async (row) => {
        const user = await User.findByPk(row.cleanerId, {
          attributes: ["id", "username", "email"],
        });
        const taxInfo = await TaxInfo.findOne({
          where: { userId: row.cleanerId },
          attributes: ["legalName", "tinLast4", "status"],
        });

        return {
          userId: row.cleanerId,
          username: user?.username,
          email: user?.email,
          legalName: taxInfo?.legalName,
          tinLast4: taxInfo?.tinLast4,
          taxInfoStatus: taxInfo?.status || "not_submitted",
          totalAmountCents: parseInt(row.totalAmountCents),
          totalAmountDollars: (parseInt(row.totalAmountCents) / 100).toFixed(2),
          transactionCount: parseInt(row.transactionCount),
        };
      })
    );

    return res.json({
      taxYear,
      threshold: {
        amountCents: 60000,
        amountDollars: "600.00",
      },
      cleanersRequiring1099: cleanersRequiring1099.length,
      totalPaymentsAboveThreshold: cleanersRequiring1099.reduce(
        (sum, c) => sum + c.totalAmountCents,
        0
      ),
      cleaners: cleanersRequiring1099,
    });
  } catch (error) {
    console.error("[Tax] Error fetching 1099 summary:", error);
    return res.status(500).json({
      error: "Failed to fetch 1099 summary",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /tax-documents/:userId
 * Get all tax documents for a user
 */
taxRouter.get("/tax-documents/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const documents = await TaxDocument.findAll({
      where: { userId },
      order: [["taxYear", "DESC"], ["createdAt", "DESC"]],
    });

    return res.json({
      documents: documents.map((doc) => ({
        id: doc.id,
        documentId: doc.documentId,
        documentType: doc.documentType,
        taxYear: doc.taxYear,
        status: doc.status,
        box1Amount: doc.box1NonemployeeCompensation
          ? (doc.box1NonemployeeCompensation / 100).toFixed(2)
          : null,
        generatedAt: doc.generatedAt,
        sentToRecipientAt: doc.sentToRecipientAt,
      })),
    });
  } catch (error) {
    console.error("[Tax] Error fetching tax documents:", error);
    return res.status(500).json({
      error: "Failed to fetch tax documents",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * POST /generate-1099/:userId/:year
 * Generate 1099-NEC for a specific cleaner (admin endpoint)
 */
taxRouter.post("/generate-1099/:userId/:year", async (req, res) => {
  const { userId, year } = req.params;
  const taxYear = parseInt(year);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    // Check if already generated
    const existing = await TaxDocument.existsForUserYear(userId, taxYear);
    if (existing) {
      return res.status(409).json({
        error: "1099-NEC already generated for this user and year",
        code: "ALREADY_GENERATED",
      });
    }

    // Validate tax info is complete
    const validation = await TaxDocumentService.validateTaxInfoComplete(userId);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Incomplete tax information",
        code: "INCOMPLETE_TAX_INFO",
        missing: validation.missing,
      });
    }

    // Generate form data
    const formData = await TaxDocumentService.generate1099NECData(userId, taxYear);

    if (!formData.requires1099) {
      return res.json({
        generated: false,
        message: "Below $600 threshold - no 1099 required",
        totalAmountDollars: (formData.totalAmountCents / 100).toFixed(2),
      });
    }

    // Create document record
    const document = await TaxDocumentService.createTaxDocumentRecord(
      userId,
      taxYear,
      formData
    );

    // Mark payments as reported
    await Payment.update(
      { reported: true },
      {
        where: {
          cleanerId: userId,
          taxYear,
          type: "payout",
          status: "succeeded",
          reportable: true,
        },
      }
    );

    return res.status(201).json({
      generated: true,
      document: {
        documentId: document.documentId,
        taxYear: document.taxYear,
        status: document.status,
        box1Amount: formData.boxes.box1.amountDollars,
      },
      formData,
    });
  } catch (error) {
    console.error("[Tax] Error generating 1099:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate 1099",
      code: "GENERATE_FAILED",
    });
  }
});

/**
 * POST /generate-all-1099s/:year
 * Generate 1099-NECs for all eligible cleaners (admin endpoint)
 */
taxRouter.post("/generate-all-1099s/:year", async (req, res) => {
  const { year } = req.params;
  const taxYear = parseInt(year);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const results = await TaxDocumentService.generateAll1099NECsForYear(taxYear);

    return res.json({
      success: true,
      taxYear,
      summary: {
        total: results.total,
        generated: results.generated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      generated: results.generated,
      skipped: results.skipped,
      errors: results.errors,
    });
  } catch (error) {
    console.error("[Tax] Error generating all 1099s:", error);
    return res.status(500).json({
      error: "Failed to generate 1099s",
      code: "GENERATE_FAILED",
    });
  }
});

/**
 * GET /tax-year-summary/:year
 * Get summary statistics for a tax year (admin endpoint)
 */
taxRouter.get("/tax-year-summary/:year", async (req, res) => {
  const { year } = req.params;
  const taxYear = parseInt(year);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  try {
    const summary = await TaxDocumentService.getTaxYearSummary(taxYear);
    return res.json(summary);
  } catch (error) {
    console.error("[Tax] Error fetching tax year summary:", error);
    return res.status(500).json({
      error: "Failed to fetch summary",
      code: "FETCH_FAILED",
    });
  }
});

/**
 * GET /deadlines/:year
 * Get tax filing deadlines for a year
 */
taxRouter.get("/deadlines/:year", async (req, res) => {
  const { year } = req.params;
  const taxYear = parseInt(year);

  if (isNaN(taxYear) || taxYear < 2020 || taxYear > 2100) {
    return res.status(400).json({
      error: "Invalid tax year",
      code: "INVALID_YEAR",
    });
  }

  const deadlines = TaxDocumentService.getTaxDeadlines(taxYear);
  return res.json(deadlines);
});

module.exports = taxRouter;
