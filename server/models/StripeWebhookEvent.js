/**
 * StripeWebhookEvent Model
 *
 * Tracks processed Stripe webhook events to prevent duplicate processing.
 * Stripe may retry webhook delivery, so we need to ensure idempotent handling.
 *
 * Key Features:
 * - Stores Stripe event ID to detect duplicates
 * - Tracks processing status for debugging
 * - Auto-cleanup of old events (configurable retention)
 */
module.exports = (sequelize, DataTypes) => {
  const StripeWebhookEvent = sequelize.define("StripeWebhookEvent", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    // Stripe event identification
    stripeEventId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Stripe event ID (evt_...)",
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Stripe event type (e.g., payment_intent.succeeded)",
    },
    // Processing status
    status: {
      type: DataTypes.ENUM("processing", "completed", "failed", "skipped"),
      allowNull: false,
      defaultValue: "processing",
      comment: "Processing status of the webhook event",
    },
    // Which webhook endpoint received this
    source: {
      type: DataTypes.ENUM("payments", "connect", "tax"),
      allowNull: false,
      defaultValue: "payments",
      comment: "Which webhook endpoint received this event",
    },
    // Related entity for debugging
    relatedEntityType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Type of entity affected (appointment, payout, account, etc.)",
    },
    relatedEntityId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "ID of the affected entity",
    },
    // Processing details
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the event was successfully processed",
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error message if processing failed",
    },
    // Raw event data for debugging
    eventData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Raw Stripe event data (for debugging)",
    },
    // Stripe webhook metadata
    stripeCreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When Stripe created this event",
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of times Stripe retried this webhook",
    },
  }, {
    tableName: "StripeWebhookEvents",
    indexes: [
      {
        unique: true,
        fields: ["stripeEventId"],
      },
      {
        fields: ["eventType"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["createdAt"],
      },
      {
        fields: ["source", "eventType"],
      },
    ],
  });

  /**
   * Check if an event has already been processed
   * @param {string} eventId - Stripe event ID
   * @returns {Promise<boolean>} - True if already processed
   */
  StripeWebhookEvent.isProcessed = async (eventId) => {
    const existing = await StripeWebhookEvent.findOne({
      where: { stripeEventId: eventId },
    });
    return existing && existing.status === "completed";
  };

  /**
   * Check if an event is currently being processed (for race condition detection)
   * @param {string} eventId - Stripe event ID
   * @returns {Promise<boolean>} - True if currently processing
   */
  StripeWebhookEvent.isProcessing = async (eventId) => {
    const existing = await StripeWebhookEvent.findOne({
      where: { stripeEventId: eventId },
    });
    return existing && existing.status === "processing";
  };

  /**
   * Attempt to claim an event for processing (with row-level lock)
   * Returns the event record if successfully claimed, null if already claimed/processed
   * @param {object} event - Stripe event object
   * @param {string} source - Which webhook endpoint (payments, connect, tax)
   * @param {object} transaction - Sequelize transaction (optional)
   * @returns {Promise<object|null>} - Created record or null if duplicate
   */
  StripeWebhookEvent.claimEvent = async (event, source, transaction = null) => {
    try {
      const record = await StripeWebhookEvent.create({
        stripeEventId: event.id,
        eventType: event.type,
        source,
        status: "processing",
        stripeCreatedAt: event.created ? new Date(event.created * 1000) : null,
        eventData: process.env.NODE_ENV === "development" ? event.data : null, // Only store in dev
      }, { transaction });
      return record;
    } catch (error) {
      // Unique constraint violation means event was already claimed
      if (error.name === "SequelizeUniqueConstraintError") {
        // Check if it's still processing (might be a retry)
        const existing = await StripeWebhookEvent.findOne({
          where: { stripeEventId: event.id },
          transaction,
        });
        if (existing) {
          // Increment retry count
          await existing.increment("retryCount", { transaction });
        }
        return null;
      }
      throw error;
    }
  };

  /**
   * Mark an event as successfully processed
   * @param {string} eventId - Stripe event ID
   * @param {string} relatedEntityType - Type of affected entity
   * @param {string|number} relatedEntityId - ID of affected entity
   */
  StripeWebhookEvent.markCompleted = async (eventId, relatedEntityType = null, relatedEntityId = null) => {
    await StripeWebhookEvent.update({
      status: "completed",
      processedAt: new Date(),
      relatedEntityType,
      relatedEntityId: relatedEntityId ? String(relatedEntityId) : null,
    }, {
      where: { stripeEventId: eventId },
    });
  };

  /**
   * Mark an event as failed
   * @param {string} eventId - Stripe event ID
   * @param {string} errorMessage - Error message
   */
  StripeWebhookEvent.markFailed = async (eventId, errorMessage) => {
    await StripeWebhookEvent.update({
      status: "failed",
      errorMessage,
      processedAt: new Date(),
    }, {
      where: { stripeEventId: eventId },
    });
  };

  /**
   * Mark an event as skipped (no action needed)
   * @param {string} eventId - Stripe event ID
   * @param {string} reason - Reason for skipping
   */
  StripeWebhookEvent.markSkipped = async (eventId, reason = null) => {
    await StripeWebhookEvent.update({
      status: "skipped",
      errorMessage: reason,
      processedAt: new Date(),
    }, {
      where: { stripeEventId: eventId },
    });
  };

  /**
   * Clean up old processed events (for maintenance)
   * @param {number} daysToKeep - Number of days to retain events
   * @returns {Promise<number>} - Number of deleted records
   */
  StripeWebhookEvent.cleanupOldEvents = async (daysToKeep = 30) => {
    const { Op } = require("sequelize");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await StripeWebhookEvent.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        status: { [Op.in]: ["completed", "skipped"] },
      },
    });
    return result;
  };

  return StripeWebhookEvent;
};
