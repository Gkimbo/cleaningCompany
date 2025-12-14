/**
 * ============================================================================
 * TAX DOCUMENT SERVICE
 * Service for generating 1099-NEC and other tax documents
 * ============================================================================
 *
 * This service handles:
 * - 1099-NEC form data generation
 * - Document record creation
 * - Tax year calculations
 * - IRS compliance helpers
 *
 * Note: For actual PDF generation, you would typically use a service like:
 * - Tax1099.com API
 * - Track1099.com API
 * - PDFKit for custom PDF generation
 *
 * This implementation provides the data structure and record keeping.
 * ============================================================================
 */

const crypto = require("crypto");
const {
  User,
  TaxInfo,
  TaxDocument,
  Payment,
} = require("../models");

// IRS thresholds and constants
const IRS_1099_NEC_THRESHOLD_CENTS = 60000; // $600.00
const BACKUP_WITHHOLDING_RATE = 0.24; // 24%

// Platform information (should come from environment in production)
const PLATFORM_INFO = {
  name: process.env.COMPANY_NAME || "Cleaning Company Platform",
  ein: process.env.COMPANY_EIN || "XX-XXXXXXX",
  addressLine1: process.env.COMPANY_ADDRESS_LINE1 || "123 Platform Street",
  addressLine2: process.env.COMPANY_ADDRESS_LINE2 || "",
  city: process.env.COMPANY_CITY || "Your City",
  state: process.env.COMPANY_STATE || "ST",
  zipCode: process.env.COMPANY_ZIP || "12345",
  phone: process.env.COMPANY_PHONE || "555-555-5555",
};

class TaxDocumentService {
  /**
   * Get all cleaners requiring 1099-NEC for a tax year
   */
  static async getCleanersRequiring1099(taxYear) {
    const { sequelize } = require("../models");

    // Get all cleaners with payments >= $600
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
      HAVING SUM(p.amount) >= :threshold
      ORDER BY SUM(p.amount) DESC
    `, {
      replacements: {
        taxYear,
        threshold: IRS_1099_NEC_THRESHOLD_CENTS,
      },
    });

    return results || [];
  }

  /**
   * Generate 1099-NEC data for a specific cleaner
   */
  static async generate1099NECData(userId, taxYear) {
    // Get cleaner's tax info
    const taxInfo = await TaxInfo.findOne({ where: { userId } });
    if (!taxInfo) {
      throw new Error("Cleaner has not submitted W-9 information");
    }

    // Get user info
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get total reportable amount
    const total = await Payment.getTotalReportableAmount(userId, taxYear);

    if (total.totalAmountCents < IRS_1099_NEC_THRESHOLD_CENTS) {
      return {
        requires1099: false,
        totalAmountCents: total.totalAmountCents,
        threshold: IRS_1099_NEC_THRESHOLD_CENTS,
      };
    }

    // Build recipient address
    const recipientAddress = [
      taxInfo.addressLine1,
      taxInfo.addressLine2,
      `${taxInfo.city}, ${taxInfo.state} ${taxInfo.zipCode}`,
    ].filter(Boolean).join("\n");

    // Build payer address
    const payerAddress = [
      PLATFORM_INFO.addressLine1,
      PLATFORM_INFO.addressLine2,
      `${PLATFORM_INFO.city}, ${PLATFORM_INFO.state} ${PLATFORM_INFO.zipCode}`,
    ].filter(Boolean).join("\n");

    return {
      requires1099: true,
      taxYear,
      formType: "1099-NEC",

      // Payer (Platform) - Boxes at top
      payer: {
        name: PLATFORM_INFO.name,
        tin: PLATFORM_INFO.ein,
        address: payerAddress,
        phone: PLATFORM_INFO.phone,
      },

      // Recipient (Cleaner)
      recipient: {
        name: taxInfo.legalName,
        tinType: taxInfo.tinType,
        tinLast4: taxInfo.tinLast4,
        address: recipientAddress,
        accountNumber: user.id.toString(), // Optional account number
      },

      // Form boxes
      boxes: {
        // Box 1: Nonemployee compensation
        box1: {
          label: "Nonemployee compensation",
          amountCents: total.totalAmountCents,
          amountDollars: total.totalAmountDollars,
        },
        // Box 2: Checkbox - not typically used
        box2: {
          label: "Payer made direct sales totaling $5,000 or more",
          checked: false,
        },
        // Box 4: Federal income tax withheld
        box4: {
          label: "Federal income tax withheld",
          amountCents: 0,
          amountDollars: "0.00",
        },
        // Box 5: State tax withheld (if any)
        box5: {
          label: "State tax withheld",
          amountCents: 0,
          amountDollars: "0.00",
        },
        // Box 6: State/Payer's state no.
        box6: {
          label: "State/Payer's state no.",
          value: "",
        },
        // Box 7: State income
        box7: {
          label: "State income",
          amountCents: total.totalAmountCents,
          amountDollars: total.totalAmountDollars,
        },
      },

      // Metadata
      transactionCount: total.transactionCount,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a tax document record in the database
   */
  static async createTaxDocumentRecord(userId, taxYear, form1099Data) {
    const taxInfo = await TaxInfo.findOne({ where: { userId } });

    const documentId = TaxDocument.generateDocumentId(taxYear, "1099-NEC", userId);

    const document = await TaxDocument.create({
      documentId,
      userId,
      documentType: "1099-NEC",
      taxYear,

      // Box amounts
      box1NonemployeeCompensation: form1099Data.boxes.box1.amountCents,
      box4FederalTaxWithheld: form1099Data.boxes.box4.amountCents,
      box5StateTaxWithheld: form1099Data.boxes.box5.amountCents,
      box6StatePayersNo: form1099Data.boxes.box6.value || null,
      box7StateIncome: form1099Data.boxes.box7.amountCents,

      // Payer info
      payerName: form1099Data.payer.name,
      payerTin: form1099Data.payer.tin,
      payerAddress: form1099Data.payer.address,

      // Recipient info (snapshot)
      recipientName: form1099Data.recipient.name,
      recipientTin: taxInfo.tinEncrypted, // Encrypted
      recipientTinLast4: form1099Data.recipient.tinLast4,
      recipientAddress: form1099Data.recipient.address,

      // Status
      status: "generated",
      generatedAt: new Date(),
      generatedBy: "system",
    });

    return document;
  }

  /**
   * Generate 1099-NEC forms for all eligible cleaners for a tax year
   */
  static async generateAll1099NECsForYear(taxYear) {
    const cleaners = await this.getCleanersRequiring1099(taxYear);
    const results = {
      taxYear,
      total: cleaners.length,
      generated: [],
      skipped: [],
      errors: [],
    };

    for (const cleaner of cleaners) {
      try {
        // Check if already generated
        const existing = await TaxDocument.existsForUserYear(cleaner.cleanerId, taxYear);
        if (existing) {
          results.skipped.push({
            userId: cleaner.cleanerId,
            reason: "Already generated",
          });
          continue;
        }

        // Generate form data
        const formData = await this.generate1099NECData(cleaner.cleanerId, taxYear);

        if (!formData.requires1099) {
          results.skipped.push({
            userId: cleaner.cleanerId,
            reason: "Below threshold",
          });
          continue;
        }

        // Create document record
        const document = await this.createTaxDocumentRecord(
          cleaner.cleanerId,
          taxYear,
          formData
        );

        // Mark payments as reported
        await Payment.update(
          { reported: true },
          {
            where: {
              cleanerId: cleaner.cleanerId,
              taxYear,
              type: "payout",
              status: "succeeded",
              reportable: true,
            },
          }
        );

        results.generated.push({
          userId: cleaner.cleanerId,
          documentId: document.documentId,
          amountDollars: formData.boxes.box1.amountDollars,
        });
      } catch (error) {
        results.errors.push({
          userId: cleaner.cleanerId,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get tax filing deadlines
   */
  static getTaxDeadlines(taxYear) {
    // 1099-NEC deadline is January 31st of the following year
    const nextYear = taxYear + 1;
    return {
      taxYear,
      form1099NECRecipientDeadline: new Date(nextYear, 0, 31), // Jan 31
      form1099NECIRSDeadline: new Date(nextYear, 0, 31), // Jan 31 (same for e-file)
      form1099NECIRSMailDeadline: new Date(nextYear, 1, 28), // Feb 28 (paper)
    };
  }

  /**
   * Calculate backup withholding if required
   */
  static calculateBackupWithholding(amountCents) {
    return Math.round(amountCents * BACKUP_WITHHOLDING_RATE);
  }

  /**
   * Validate tax info is complete for 1099 generation
   */
  static async validateTaxInfoComplete(userId) {
    const taxInfo = await TaxInfo.findOne({ where: { userId } });

    if (!taxInfo) {
      return {
        valid: false,
        missing: ["W-9 not submitted"],
      };
    }

    const missing = [];

    if (!taxInfo.legalName) missing.push("Legal name");
    if (!taxInfo.addressLine1) missing.push("Address");
    if (!taxInfo.city) missing.push("City");
    if (!taxInfo.state) missing.push("State");
    if (!taxInfo.zipCode) missing.push("ZIP code");
    if (!taxInfo.tinEncrypted) missing.push("TIN (SSN/EIN)");
    if (!taxInfo.certificationSignature) missing.push("Certification signature");

    return {
      valid: missing.length === 0,
      missing,
      status: taxInfo.status,
    };
  }

  /**
   * Get summary statistics for tax year
   */
  static async getTaxYearSummary(taxYear) {
    const cleanersRequiring1099 = await this.getCleanersRequiring1099(taxYear);

    const totalPaymentsCents = cleanersRequiring1099.reduce(
      (sum, c) => sum + parseInt(c.totalAmountCents),
      0
    );

    const documentsGenerated = await TaxDocument.count({
      where: {
        taxYear,
        documentType: "1099-NEC",
        status: { [require("sequelize").Op.ne]: "voided" },
      },
    });

    const documentsFiledWithIrs = await TaxDocument.count({
      where: {
        taxYear,
        documentType: "1099-NEC",
        status: "filed_with_irs",
      },
    });

    return {
      taxYear,
      cleanersRequiring1099: cleanersRequiring1099.length,
      totalPaymentsCents,
      totalPaymentsDollars: (totalPaymentsCents / 100).toFixed(2),
      documentsGenerated,
      documentsFiledWithIrs,
      deadlines: this.getTaxDeadlines(taxYear),
    };
  }
}

module.exports = TaxDocumentService;
