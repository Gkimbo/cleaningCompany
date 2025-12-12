"use strict";

/**
 * Migration: Create TaxDocuments Table
 *
 * Tracks generated tax documents (1099-NEC forms) for record keeping
 * and IRS compliance.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
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
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // Document details
      documentType: {
        type: Sequelize.ENUM("1099-NEC", "1099-K", "W-9"),
        allowNull: false,
      },
      taxYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      // 1099-NEC specific fields (amounts in cents)
      box1NonemployeeCompensation: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      box4FederalTaxWithheld: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      box5StateTaxWithheld: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      box6StatePayersNo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      box7StateIncome: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      // Payer information (platform)
      payerName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      payerTin: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      payerAddress: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      // Recipient information
      recipientName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      recipientTin: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      recipientTinLast4: {
        type: Sequelize.STRING(4),
        allowNull: false,
      },
      recipientAddress: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      // Document status
      status: {
        type: Sequelize.ENUM(
          "draft",
          "generated",
          "sent_to_recipient",
          "filed_with_irs",
          "corrected",
          "voided"
        ),
        allowNull: false,
        defaultValue: "draft",
      },

      // Filing and delivery tracking
      generatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sentToRecipientAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sentToRecipientMethod: {
        type: Sequelize.ENUM("email", "mail", "portal"),
        allowNull: true,
      },
      filedWithIrsAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      irsConfirmationNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // Corrections
      isCorrection: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      originalDocumentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      correctionReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Storage
      pdfPath: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      pdfHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // Metadata
      generatedBy: {
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
    await queryInterface.addIndex("TaxDocuments", ["documentId"], {
      unique: true,
      name: "tax_documents_document_id_unique",
    });
    await queryInterface.addIndex("TaxDocuments", ["userId"], {
      name: "tax_documents_user_id",
    });
    await queryInterface.addIndex("TaxDocuments", ["taxYear"], {
      name: "tax_documents_tax_year",
    });
    await queryInterface.addIndex("TaxDocuments", ["userId", "taxYear", "documentType"], {
      name: "tax_documents_user_year_type",
    });
    await queryInterface.addIndex("TaxDocuments", ["status"], {
      name: "tax_documents_status",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("TaxDocuments");
  },
};
