"use strict";

module.exports = (sequelize, DataTypes) => {
  const SuspiciousActivityReport = sequelize.define("SuspiciousActivityReport", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Messages",
        key: "id",
      },
    },
    reporterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
    reportedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Conversations",
        key: "id",
      },
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "UserAppointments",
        key: "id",
      },
    },
    suspiciousContentTypes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    messageContent: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "reviewed", "dismissed", "action_taken"),
      allowNull: false,
      defaultValue: "pending",
    },
    reviewedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  SuspiciousActivityReport.associate = (models) => {
    SuspiciousActivityReport.belongsTo(models.Message, {
      foreignKey: "messageId",
      as: "message",
    });
    SuspiciousActivityReport.belongsTo(models.User, {
      foreignKey: "reporterId",
      as: "reporter",
    });
    SuspiciousActivityReport.belongsTo(models.User, {
      foreignKey: "reportedUserId",
      as: "reportedUser",
    });
    SuspiciousActivityReport.belongsTo(models.Conversation, {
      foreignKey: "conversationId",
      as: "conversation",
    });
    SuspiciousActivityReport.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    SuspiciousActivityReport.belongsTo(models.User, {
      foreignKey: "reviewedById",
      as: "reviewedBy",
    });
  };

  return SuspiciousActivityReport;
};
