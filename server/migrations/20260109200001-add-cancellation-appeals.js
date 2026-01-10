"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types first
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_CancellationAppeals_category" AS ENUM (
        'medical_emergency',
        'family_emergency',
        'natural_disaster',
        'property_issue',
        'transportation',
        'scheduling_error',
        'other'
      );
    `).catch(() => {}); // Ignore if already exists

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_CancellationAppeals_severity" AS ENUM (
        'low', 'medium', 'high', 'critical'
      );
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_CancellationAppeals_status" AS ENUM (
        'submitted', 'under_review', 'awaiting_documents',
        'approved', 'partially_approved', 'denied', 'escalated'
      );
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_CancellationAppeals_priority" AS ENUM (
        'normal', 'high', 'urgent'
      );
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_CancellationAppeals_appealerType" AS ENUM (
        'homeowner', 'cleaner'
      );
    `).catch(() => {});

    await queryInterface.createTable("CancellationAppeals", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
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

      // Appellant info
      appealerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      appealerType: {
        type: Sequelize.ENUM("homeowner", "cleaner"),
        allowNull: false,
      },

      // Appeal classification
      category: {
        type: Sequelize.ENUM(
          "medical_emergency",
          "family_emergency",
          "natural_disaster",
          "property_issue",
          "transportation",
          "scheduling_error",
          "other"
        ),
        allowNull: false,
      },
      severity: {
        type: Sequelize.ENUM("low", "medium", "high", "critical"),
        defaultValue: "medium",
      },

      // Details
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      supportingDocuments: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: "Array of {url, type, uploadedAt}",
      },

      // What's being contested
      contestingItems: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: "{penalty: bool, fee: bool, refund: bool, freeze: bool}",
      },

      // Financial impact
      originalPenaltyAmount: {
        type: Sequelize.INTEGER,
        comment: "Amount in cents that was charged as penalty",
      },
      originalRefundWithheld: {
        type: Sequelize.INTEGER,
        comment: "Amount in cents that was kept from them",
      },
      requestedRelief: {
        type: Sequelize.TEXT,
        comment: "What the appellant is requesting",
      },

      // Status workflow
      status: {
        type: Sequelize.ENUM(
          "submitted",
          "under_review",
          "awaiting_documents",
          "approved",
          "partially_approved",
          "denied",
          "escalated"
        ),
        defaultValue: "submitted",
      },
      priority: {
        type: Sequelize.ENUM("normal", "high", "urgent"),
        defaultValue: "normal",
      },

      // Assignment & review
      assignedTo: {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "HR/Owner handling the case",
      },
      assignedAt: {
        type: Sequelize.DATE,
      },

      reviewedBy: {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reviewedAt: {
        type: Sequelize.DATE,
      },
      reviewDecision: {
        type: Sequelize.TEXT,
        comment: "Explanation of decision",
      },

      // Resolution
      resolution: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: "{penaltyWaived, feeRefunded, refundAmount, accountUnfrozen, ratingRemoved}",
      },
      resolutionNotes: {
        type: Sequelize.TEXT,
      },

      // SLA tracking
      slaDeadline: {
        type: Sequelize.DATE,
        comment: "48 hours from submission",
      },
      escalatedAt: {
        type: Sequelize.DATE,
      },
      escalationReason: {
        type: Sequelize.TEXT,
      },

      // Timestamps
      submittedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      lastActivityAt: {
        type: Sequelize.DATE,
      },
      closedAt: {
        type: Sequelize.DATE,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create indexes
    await queryInterface.addIndex("CancellationAppeals", ["status"], {
      name: "idx_appeals_status",
    });
    await queryInterface.addIndex("CancellationAppeals", ["priority"], {
      name: "idx_appeals_priority",
    });
    await queryInterface.addIndex("CancellationAppeals", ["assignedTo"], {
      name: "idx_appeals_assigned",
    });
    await queryInterface.addIndex("CancellationAppeals", ["slaDeadline"], {
      name: "idx_appeals_sla",
    });
    await queryInterface.addIndex("CancellationAppeals", ["appealerId"], {
      name: "idx_appeals_appealer",
    });
    await queryInterface.addIndex("CancellationAppeals", ["appointmentId"], {
      name: "idx_appeals_appointment",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CancellationAppeals");

    // Drop ENUMs
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_CancellationAppeals_category";
      DROP TYPE IF EXISTS "enum_CancellationAppeals_severity";
      DROP TYPE IF EXISTS "enum_CancellationAppeals_status";
      DROP TYPE IF EXISTS "enum_CancellationAppeals_priority";
      DROP TYPE IF EXISTS "enum_CancellationAppeals_appealerType";
    `);
  },
};
