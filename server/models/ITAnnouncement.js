/**
 * IT Announcement Model
 * For sending mass communications to groups of users
 */
module.exports = (sequelize, DataTypes) => {
  const ITAnnouncement = sequelize.define("ITAnnouncement", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Target audience
    targetUserTypes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: "Array of user types to target: cleaner, homeowner, employee, etc.",
    },
    targetUserIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: "Specific user IDs if targeting individuals",
    },
    // Delivery channels
    channels: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ["in_app"],
      comment: "Array: in_app, push, email",
    },
    // Priority/urgency
    priority: {
      type: DataTypes.ENUM("low", "normal", "high", "urgent"),
      allowNull: false,
      defaultValue: "normal",
    },
    // Scheduling
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "If set, announcement will be sent at this time",
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Tracking
    recipientCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    deliveredCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Status
    status: {
      type: DataTypes.ENUM("draft", "scheduled", "sending", "sent", "failed", "cancelled"),
      allowNull: false,
      defaultValue: "draft",
    },
    // Metadata
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Expiration for in-app messages
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  ITAnnouncement.associate = (models) => {
    ITAnnouncement.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
  };

  return ITAnnouncement;
};
