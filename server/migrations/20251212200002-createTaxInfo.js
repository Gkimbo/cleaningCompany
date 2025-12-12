"use strict";

/**
 * Migration: Create TaxInfo Table
 *
 * Stores W-9 tax information for cleaners (independent contractors).
 * Required for 1099-NEC generation at year end.
 *
 * IMPORTANT: tinEncrypted field stores encrypted SSN/EIN data.
 * Ensure proper encryption key management in production.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
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
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // W-9 Line 1: Name
      legalName: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      // W-9 Line 2: Business name (optional)
      businessName: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // W-9 Line 3: Federal tax classification
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

      // W-9 Line 4: Exemptions
      exemptPayeeCode: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      fatcaExemptionCode: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },

      // W-9 Lines 5-6: Address
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
        type: Sequelize.STRING(2),
        allowNull: false,
      },
      zipCode: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },

      // W-9 Part I: TIN
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

      // W-9 Part II: Certification
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

      // Status and verification
      status: {
        type: Sequelize.ENUM(
          "pending",
          "verified",
          "needs_update",
          "invalid"
        ),
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

      // 1099 tracking
      form1099Required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // Backup withholding
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

      // Metadata
      lastUpdatedBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Timestamps
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

    // Add indexes
    await queryInterface.addIndex("TaxInfos", ["userId"], {
      unique: true,
      name: "tax_infos_user_id_unique",
    });
    await queryInterface.addIndex("TaxInfos", ["status"], {
      name: "tax_infos_status",
    });
    await queryInterface.addIndex("TaxInfos", ["form1099Required"], {
      name: "tax_infos_form_1099_required",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("TaxInfos");
  },
};
