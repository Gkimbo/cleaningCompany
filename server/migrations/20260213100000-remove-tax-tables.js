"use strict";

/**
 * Migration to remove TaxInfo and TaxDocument tables.
 *
 * These tables stored W-9 data and 1099 documents locally.
 * We're now using Stripe Tax Reporting which:
 * - Collects SSN/EIN during Connect onboarding
 * - Handles 1099 generation and delivery
 * - Manages IRS compliance
 *
 * IMPORTANT: Run this migration only after confirming no data needs to be preserved.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if tables exist before dropping
    const tables = await queryInterface.showAllTables();

    if (tables.includes("TaxDocuments")) {
      console.log("Dropping TaxDocuments table...");
      await queryInterface.dropTable("TaxDocuments");
      console.log("TaxDocuments table dropped.");
    } else {
      console.log("TaxDocuments table does not exist, skipping.");
    }

    if (tables.includes("TaxInfos")) {
      console.log("Dropping TaxInfos table...");
      await queryInterface.dropTable("TaxInfos");
      console.log("TaxInfos table dropped.");
    } else {
      console.log("TaxInfos table does not exist, skipping.");
    }

    console.log("Tax tables removal complete. Using Stripe Tax Reporting.");
  },

  async down(queryInterface, Sequelize) {
    // Recreate TaxInfos table
    await queryInterface.createTable("TaxInfos", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      legalName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      businessName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      taxClassification: {
        type: Sequelize.ENUM(
          "individual",
          "sole_proprietor",
          "single_member_llc",
          "c_corporation",
          "s_corporation",
          "partnership",
          "trust_estate",
          "llc_c",
          "llc_s",
          "llc_p",
          "other"
        ),
        allowNull: false,
        defaultValue: "individual",
      },
      exemptPayeeCode: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      fatcaExemptionCode: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      addressLine1: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      addressLine2: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      state: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      zipCode: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      tinType: {
        type: Sequelize.ENUM("ssn", "ein"),
        allowNull: false,
        defaultValue: "ssn",
      },
      tinEncrypted: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tinLast4: {
        type: Sequelize.STRING(4),
        allowNull: false,
      },
      certificationDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      certificationSignature: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      certificationIpAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("pending", "verified", "needs_update", "invalid"),
        allowNull: false,
        defaultValue: "pending",
      },
      tinVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      tinVerifiedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      form1099Required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      backupWithholdingRequired: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      backupWithholdingRate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        defaultValue: 0.24,
      },
      lastUpdatedBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Recreate TaxDocuments table
    await queryInterface.createTable("TaxDocuments", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      documentId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      taxYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      documentType: {
        type: Sequelize.ENUM("1099-NEC", "1099-K", "W-2"),
        allowNull: false,
        defaultValue: "1099-NEC",
      },
      status: {
        type: Sequelize.ENUM(
          "pending",
          "generated",
          "sent",
          "delivered",
          "filed",
          "corrected",
          "voided"
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      box1NonemployeeCompensation: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      box4FederalTaxWithheld: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      recipientName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      recipientTinLast4: {
        type: Sequelize.STRING(4),
        allowNull: true,
      },
      transactionCount: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      generatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sentToRecipientAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sentToIrsAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      pdfPath: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      pdfHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      downloadCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lastDownloadedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      correctionOf: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      correctionReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      formData: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    console.log("Tax tables recreated.");
  },
};
