module.exports = (sequelize, DataTypes) => {
  const SupportTicket = sequelize.define("SupportTicket", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    caseNumber: {
      type: DataTypes.STRING(20),
      allowNull: true, // Will be set by hook after creation
      unique: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Links to support conversation (optional)
      references: { model: "Conversations", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reporterId: {
      type: DataTypes.INTEGER,
      allowNull: false, // HR/owner creating the ticket
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    subjectUserId: {
      type: DataTypes.INTEGER,
      allowNull: true, // User being discussed (cleaner/homeowner)
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    subjectType: {
      type: DataTypes.ENUM("cleaner", "homeowner", "general"),
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM(
        "account_issue",
        "behavior_concern",
        "service_complaint",
        "billing_question",
        "technical_issue",
        "policy_violation",
        "other"
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("submitted", "under_review", "pending_info", "resolved", "closed"),
      allowNull: false,
      defaultValue: "submitted",
    },
    priority: {
      type: DataTypes.ENUM("normal", "high", "urgent"),
      allowNull: false,
      defaultValue: "normal",
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resolution: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    resolutionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    slaDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  SupportTicket.associate = (models) => {
    SupportTicket.belongsTo(models.Conversation, {
      foreignKey: "conversationId",
      as: "conversation",
    });
    SupportTicket.belongsTo(models.User, {
      foreignKey: "reporterId",
      as: "reporter",
    });
    SupportTicket.belongsTo(models.User, {
      foreignKey: "subjectUserId",
      as: "subject",
    });
    SupportTicket.belongsTo(models.User, {
      foreignKey: "assignedTo",
      as: "assignee",
    });
    SupportTicket.belongsTo(models.User, {
      foreignKey: "reviewedBy",
      as: "reviewer",
    });
  };

  // Instance methods
  SupportTicket.prototype.isOpen = function () {
    return ["submitted", "under_review", "pending_info"].includes(this.status);
  };

  SupportTicket.prototype.isPastSLA = function () {
    return (
      this.slaDeadline &&
      new Date() > new Date(this.slaDeadline) &&
      this.isOpen()
    );
  };

  // Generate case number after creation
  SupportTicket.afterCreate(async (ticket, options) => {
    if (!ticket.caseNumber) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const paddedId = String(ticket.id).padStart(5, "0");
      const caseNumber = `ST-${dateStr}-${paddedId}`;
      await ticket.update({ caseNumber }, { transaction: options.transaction });
    }
  });

  return SupportTicket;
};
