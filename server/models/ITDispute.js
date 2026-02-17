module.exports = (sequelize, DataTypes) => {
  const ITDispute = sequelize.define("ITDispute", {
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
    reporterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    category: {
      type: DataTypes.ENUM(
        // Technical
        "app_crash",
        "login_problem",
        "system_outage",
        "performance_issue",
        // Profile
        "profile_change",
        "account_access",
        "password_reset",
        "data_correction",
        // Billing/Payment
        "billing_error",
        "payment_system_error",
        // Security
        "security_issue",
        "suspicious_activity",
        // Data
        "data_request" // GDPR/export requests
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("submitted", "in_progress", "awaiting_info", "resolved", "closed"),
      allowNull: false,
      defaultValue: "submitted",
    },
    priority: {
      type: DataTypes.ENUM("low", "normal", "high", "critical"),
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
    resolvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    resolvedAt: {
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
    // Device/environment info for technical issues
    deviceInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    appVersion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    platform: {
      type: DataTypes.STRING, // ios, android, web
      allowNull: true,
    },
    // Attachments (screenshots, logs)
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
  });

  ITDispute.associate = (models) => {
    ITDispute.belongsTo(models.User, {
      foreignKey: "reporterId",
      as: "reporter",
    });
    ITDispute.belongsTo(models.User, {
      foreignKey: "assignedTo",
      as: "assignee",
    });
    ITDispute.belongsTo(models.User, {
      foreignKey: "resolvedBy",
      as: "resolver",
    });
  };

  // Instance methods
  ITDispute.prototype.isOpen = function () {
    return ["submitted", "in_progress", "awaiting_info"].includes(this.status);
  };

  ITDispute.prototype.isPastSLA = function () {
    return (
      this.slaDeadline &&
      new Date() > new Date(this.slaDeadline) &&
      this.isOpen()
    );
  };

  // Helper to get category group
  ITDispute.prototype.getCategoryGroup = function () {
    const technicalCategories = ["app_crash", "login_problem", "system_outage", "performance_issue"];
    const profileCategories = ["profile_change", "account_access", "password_reset", "data_correction"];
    const billingCategories = ["billing_error", "payment_system_error"];
    const securityCategories = ["security_issue", "suspicious_activity"];
    const dataCategories = ["data_request"];

    if (technicalCategories.includes(this.category)) return "technical";
    if (profileCategories.includes(this.category)) return "profile";
    if (billingCategories.includes(this.category)) return "billing";
    if (securityCategories.includes(this.category)) return "security";
    if (dataCategories.includes(this.category)) return "data";
    return "other";
  };

  // Generate case number after creation (IT-YYYYMMDD-00001)
  ITDispute.afterCreate(async (dispute, options) => {
    if (!dispute.caseNumber) {
      try {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const paddedId = String(dispute.id).padStart(5, "0");
        const caseNumber = `IT-${dateStr}-${paddedId}`;
        await dispute.update({ caseNumber }, { transaction: options.transaction });
      } catch (error) {
        console.error(`Failed to generate case number for IT dispute ${dispute.id}:`, error);
        // Don't throw - the dispute is created, case number can be generated later
      }
    }
  });

  // Set SLA deadline based on priority before creation
  ITDispute.beforeCreate((dispute) => {
    const now = new Date();
    const slaHours = {
      low: 72,
      normal: 48,
      high: 24,
      critical: 4,
    };
    const hours = slaHours[dispute.priority] || 48;
    dispute.slaDeadline = new Date(now.getTime() + hours * 60 * 60 * 1000);
  });

  return ITDispute;
};
