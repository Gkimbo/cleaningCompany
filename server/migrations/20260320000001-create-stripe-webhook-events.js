"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("StripeWebhookEvents", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      stripeEventId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: "Stripe event ID (evt_...)",
      },
      eventType: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Stripe event type (e.g., payment_intent.succeeded)",
      },
      status: {
        type: Sequelize.ENUM("processing", "completed", "failed", "skipped"),
        allowNull: false,
        defaultValue: "processing",
        comment: "Processing status of the webhook event",
      },
      source: {
        type: Sequelize.ENUM("payments", "connect", "tax"),
        allowNull: false,
        defaultValue: "payments",
        comment: "Which webhook endpoint received this event",
      },
      relatedEntityType: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Type of entity affected (appointment, payout, account, etc.)",
      },
      relatedEntityId: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "ID of the affected entity",
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When the event was successfully processed",
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Error message if processing failed",
      },
      eventData: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: "Raw Stripe event data (for debugging)",
      },
      stripeCreatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When Stripe created this event",
      },
      retryCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Number of times Stripe retried this webhook",
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

    // Add indexes
    await queryInterface.addIndex("StripeWebhookEvents", ["stripeEventId"], {
      unique: true,
      name: "stripe_webhook_events_stripe_event_id_unique",
    });

    await queryInterface.addIndex("StripeWebhookEvents", ["eventType"], {
      name: "stripe_webhook_events_event_type",
    });

    await queryInterface.addIndex("StripeWebhookEvents", ["status"], {
      name: "stripe_webhook_events_status",
    });

    await queryInterface.addIndex("StripeWebhookEvents", ["createdAt"], {
      name: "stripe_webhook_events_created_at",
    });

    await queryInterface.addIndex("StripeWebhookEvents", ["source", "eventType"], {
      name: "stripe_webhook_events_source_event_type",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("StripeWebhookEvents");
  },
};
