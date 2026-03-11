/**
 * IT Satisfaction Survey Model
 * For collecting feedback after dispute resolution
 */
module.exports = (sequelize, DataTypes) => {
  const ITSatisfactionSurvey = sequelize.define("ITSatisfactionSurvey", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    disputeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "ITDisputes", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      comment: "The user who received the survey (reporter)",
    },
    // Survey request tracking
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Response data
    overallRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
      comment: "1-5 star rating",
    },
    responseTimeRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    resolutionQualityRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    staffHelpfulnessRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    // Free-form feedback
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Would recommend?
    wouldRecommend: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    // Issue resolved?
    issueResolved: {
      type: DataTypes.ENUM("yes", "partially", "no"),
      allowNull: true,
    },
    // Status
    status: {
      type: DataTypes.ENUM("pending", "completed", "expired", "skipped"),
      allowNull: false,
      defaultValue: "pending",
    },
    // Reminder tracking
    remindersSent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastReminderAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  ITSatisfactionSurvey.associate = (models) => {
    ITSatisfactionSurvey.belongsTo(models.ITDispute, {
      foreignKey: "disputeId",
      as: "dispute",
    });
    ITSatisfactionSurvey.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return ITSatisfactionSurvey;
};
