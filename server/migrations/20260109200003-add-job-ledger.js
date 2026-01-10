"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types first
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_JobLedger_entryType" AS ENUM (
        'booking_revenue',
        'addon_linens',
        'addon_time_window',
        'addon_high_volume',
        'addon_last_minute',
        'cancellation_fee_revenue',
        'cancellation_refund',
        'cancellation_partial_refund',
        'cleaner_payout_job',
        'cleaner_payout_cancellation',
        'cleaner_bonus',
        'platform_fee_standard',
        'platform_fee_business',
        'platform_fee_large_business',
        'appeal_refund',
        'appeal_fee_reversal',
        'manual_adjustment',
        'stripe_fee',
        'dispute_chargeback',
        'dispute_reversal'
      );
    `).catch(() => {}); // Ignore if already exists

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_JobLedger_direction" AS ENUM ('debit', 'credit');
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_JobLedger_accountType" AS ENUM (
        'accounts_receivable',
        'revenue',
        'refunds_payable',
        'payouts_payable',
        'platform_revenue',
        'stripe_fees'
      );
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_JobLedger_partyType" AS ENUM (
        'homeowner', 'cleaner', 'platform', 'stripe'
      );
    `).catch(() => {});

    await queryInterface.createTable("JobLedgers", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      // References
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      relatedLedgerId: {
        type: Sequelize.INTEGER,
        references: {
          model: "JobLedgers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "For double-entry pairs",
      },

      // Transaction classification
      entryType: {
        type: Sequelize.ENUM(
          "booking_revenue",
          "addon_linens",
          "addon_time_window",
          "addon_high_volume",
          "addon_last_minute",
          "cancellation_fee_revenue",
          "cancellation_refund",
          "cancellation_partial_refund",
          "cleaner_payout_job",
          "cleaner_payout_cancellation",
          "cleaner_bonus",
          "platform_fee_standard",
          "platform_fee_business",
          "platform_fee_large_business",
          "appeal_refund",
          "appeal_fee_reversal",
          "manual_adjustment",
          "stripe_fee",
          "dispute_chargeback",
          "dispute_reversal"
        ),
        allowNull: false,
      },

      // Accounting
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Amount in cents, always positive",
      },
      direction: {
        type: Sequelize.ENUM("debit", "credit"),
        allowNull: false,
      },

      accountType: {
        type: Sequelize.ENUM(
          "accounts_receivable",
          "revenue",
          "refunds_payable",
          "payouts_payable",
          "platform_revenue",
          "stripe_fees"
        ),
        allowNull: false,
      },

      // Parties
      partyType: {
        type: Sequelize.ENUM("homeowner", "cleaner", "platform", "stripe"),
        allowNull: false,
      },
      partyUserId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // External references
      stripeObjectType: {
        type: Sequelize.STRING,
        comment: "payment_intent, refund, transfer, etc.",
      },
      stripeObjectId: {
        type: Sequelize.STRING,
      },
      paymentRecordId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Payments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      payoutRecordId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Payouts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      appealId: {
        type: Sequelize.INTEGER,
        references: {
          model: "CancellationAppeals",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // Metadata
      description: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      memo: {
        type: Sequelize.TEXT,
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },

      // Tax
      taxYear: {
        type: Sequelize.INTEGER,
      },
      taxQuarter: {
        type: Sequelize.INTEGER,
      },
      taxReportable: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      taxCategory: {
        type: Sequelize.STRING,
        comment: "income, refund, expense, payout",
      },
      form1099Eligible: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // Reconciliation
      reconciled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      reconciledAt: {
        type: Sequelize.DATE,
      },
      reconciledBy: {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reconciliationBatch: {
        type: Sequelize.STRING,
        comment: "Group reconciled entries",
      },
      discrepancyAmount: {
        type: Sequelize.INTEGER,
        comment: "Amount of any discrepancy in cents",
      },
      discrepancyNotes: {
        type: Sequelize.TEXT,
      },

      // Timestamps
      effectiveDate: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "When this financially occurred",
      },
      postedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: "When we recorded it",
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create indexes
    await queryInterface.addIndex("JobLedgers", ["appointmentId"], {
      name: "idx_ledger_appointment",
    });
    await queryInterface.addIndex("JobLedgers", ["entryType"], {
      name: "idx_ledger_type",
    });
    await queryInterface.addIndex("JobLedgers", ["partyType", "partyUserId"], {
      name: "idx_ledger_party",
    });
    await queryInterface.addIndex("JobLedgers", ["effectiveDate"], {
      name: "idx_ledger_effective",
    });
    await queryInterface.addIndex("JobLedgers", ["taxYear", "taxQuarter"], {
      name: "idx_ledger_tax",
    });
    await queryInterface.addIndex("JobLedgers", ["reconciled"], {
      name: "idx_ledger_reconciled",
    });
    await queryInterface.addIndex("JobLedgers", ["stripeObjectId"], {
      name: "idx_ledger_stripe",
    });
    await queryInterface.addIndex("JobLedgers", ["appealId"], {
      name: "idx_ledger_appeal",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("JobLedgers");

    // Drop ENUMs
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_JobLedger_entryType";
      DROP TYPE IF EXISTS "enum_JobLedger_direction";
      DROP TYPE IF EXISTS "enum_JobLedger_accountType";
      DROP TYPE IF EXISTS "enum_JobLedger_partyType";
    `);
  },
};
