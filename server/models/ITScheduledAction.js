/**
 * IT Scheduled Action Model
 * For scheduling future account actions (unlock, unfreeze, etc.)
 */
module.exports = (sequelize, DataTypes) => {
  const ITScheduledAction = sequelize.define("ITScheduledAction", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    // Target user
    targetUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Action type
    actionType: {
      type: DataTypes.ENUM(
        "unlock_account",
        "unfreeze_account",
        "lock_account",
        "freeze_account",
        "reset_password",
        "force_logout",
        "send_notification",
        "custom"
      ),
      allowNull: false,
    },
    // Action parameters
    actionParams: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Additional parameters for the action",
    },
    // Scheduling
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Recurrence (optional)
    isRecurring: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    recurrencePattern: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "daily, weekly, monthly, or cron expression",
    },
    recurrenceEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Execution tracking
    status: {
      type: DataTypes.ENUM("pending", "executing", "completed", "failed", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    executedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    executionResult: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Result or error details from execution",
    },
    // Retry logic
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    lastRetryAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Reason/notes
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Creator
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Cancellation
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelledBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    cancelReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  });

  ITScheduledAction.associate = (models) => {
    ITScheduledAction.belongsTo(models.User, {
      foreignKey: "targetUserId",
      as: "targetUser",
    });
    ITScheduledAction.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    ITScheduledAction.belongsTo(models.User, {
      foreignKey: "cancelledBy",
      as: "canceller",
    });
  };

  return ITScheduledAction;
};
