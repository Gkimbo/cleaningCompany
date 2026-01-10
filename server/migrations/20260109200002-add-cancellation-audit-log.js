"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM types first
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_CancellationAuditLog_eventType" AS ENUM (
        'cancellation_info_requested',
        'cancellation_initiated',
        'cancellation_confirmed',
        'cancellation_reversed',
        'fee_charge_attempted',
        'fee_charge_succeeded',
        'fee_charge_failed',
        'fee_added_to_bill',
        'refund_initiated',
        'refund_completed',
        'refund_failed',
        'payout_created',
        'payout_completed',
        'penalty_rating_applied',
        'penalty_rating_removed',
        'account_freeze_triggered',
        'account_freeze_lifted',
        'appeal_submitted',
        'appeal_assigned',
        'appeal_status_changed',
        'appeal_documents_uploaded',
        'appeal_resolved',
        'notification_sent_email',
        'notification_sent_push',
        'notification_sent_sms'
      );
    `).catch(() => {}); // Ignore if already exists

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_CancellationAuditLog_actorType" AS ENUM (
        'homeowner', 'cleaner', 'system', 'hr', 'owner', 'support'
      );
    `).catch(() => {});

    await queryInterface.createTable("CancellationAuditLogs", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      // Reference
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
      appealId: {
        type: Sequelize.INTEGER,
        references: {
          model: "CancellationAppeals",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "If related to an appeal",
      },

      // Event classification
      eventType: {
        type: Sequelize.ENUM(
          "cancellation_info_requested",
          "cancellation_initiated",
          "cancellation_confirmed",
          "cancellation_reversed",
          "fee_charge_attempted",
          "fee_charge_succeeded",
          "fee_charge_failed",
          "fee_added_to_bill",
          "refund_initiated",
          "refund_completed",
          "refund_failed",
          "payout_created",
          "payout_completed",
          "penalty_rating_applied",
          "penalty_rating_removed",
          "account_freeze_triggered",
          "account_freeze_lifted",
          "appeal_submitted",
          "appeal_assigned",
          "appeal_status_changed",
          "appeal_documents_uploaded",
          "appeal_resolved",
          "notification_sent_email",
          "notification_sent_push",
          "notification_sent_sms"
        ),
        allowNull: false,
      },

      // Who did it
      actorId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      actorType: {
        type: Sequelize.ENUM(
          "homeowner",
          "cleaner",
          "system",
          "hr",
          "owner",
          "support"
        ),
        defaultValue: "system",
      },

      // Detailed payload
      eventData: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: "Event-specific structured data",
      },
      previousState: {
        type: Sequelize.JSONB,
        comment: "State before this event",
      },
      newState: {
        type: Sequelize.JSONB,
        comment: "State after this event",
      },

      // Request context
      requestId: {
        type: Sequelize.STRING,
        comment: "Correlation ID for tracing",
      },
      ipAddress: {
        type: Sequelize.STRING,
      },
      userAgent: {
        type: Sequelize.STRING,
      },
      deviceInfo: {
        type: Sequelize.JSONB,
        comment: "{platform, appVersion, os}",
      },

      // Flags
      isSystemGenerated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isSensitive: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: "PII/financial data",
      },

      // Immutable timestamp
      occurredAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },

      // For searching
      searchText: {
        type: Sequelize.STRING(500),
        comment: "Denormalized searchable summary",
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
    await queryInterface.addIndex("CancellationAuditLogs", ["appointmentId"], {
      name: "idx_audit_appointment",
    });
    await queryInterface.addIndex("CancellationAuditLogs", ["eventType"], {
      name: "idx_audit_type",
    });
    await queryInterface.addIndex("CancellationAuditLogs", ["actorId", "actorType"], {
      name: "idx_audit_actor",
    });
    await queryInterface.addIndex("CancellationAuditLogs", ["occurredAt"], {
      name: "idx_audit_occurred",
    });
    await queryInterface.addIndex("CancellationAuditLogs", ["appealId"], {
      name: "idx_audit_appeal",
    });
    await queryInterface.addIndex("CancellationAuditLogs", ["requestId"], {
      name: "idx_audit_request",
    });

    // Full text search index on searchText (PostgreSQL specific)
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_search ON "CancellationAuditLogs"
      USING gin(to_tsvector('english', "searchText"))
      WHERE "searchText" IS NOT NULL;
    `).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CancellationAuditLogs");

    // Drop ENUMs
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_CancellationAuditLog_eventType";
      DROP TYPE IF EXISTS "enum_CancellationAuditLog_actorType";
    `);
  },
};
