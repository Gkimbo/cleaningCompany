module.exports = (sequelize, DataTypes) => {
  const PaymentDispute = sequelize.define("PaymentDispute", {
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
    payoutId: {
      type: DataTypes.INTEGER,
      allowNull: true, // null for "missing payout" cases
      references: { model: "Payouts", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "UserAppointments", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    issueType: {
      type: DataTypes.ENUM("missing_payout", "wrong_amount", "delayed_payout"),
      allowNull: false,
    },
    expectedAmount: {
      type: DataTypes.INTEGER, // cents
      allowNull: true,
    },
    receivedAmount: {
      type: DataTypes.INTEGER, // cents
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("submitted", "under_review", "resolved", "denied"),
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

  PaymentDispute.associate = (models) => {
    PaymentDispute.belongsTo(models.Payout, {
      foreignKey: "payoutId",
      as: "payout",
    });
    PaymentDispute.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    PaymentDispute.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
    PaymentDispute.belongsTo(models.User, {
      foreignKey: "assignedTo",
      as: "assignee",
    });
    PaymentDispute.belongsTo(models.User, {
      foreignKey: "reviewedBy",
      as: "reviewer",
    });
  };

  // Instance methods
  PaymentDispute.prototype.isOpen = function () {
    return ["submitted", "under_review"].includes(this.status);
  };

  PaymentDispute.prototype.isPastSLA = function () {
    return (
      this.slaDeadline &&
      new Date() > new Date(this.slaDeadline) &&
      this.isOpen()
    );
  };

  // Generate case number after creation
  PaymentDispute.afterCreate(async (dispute, options) => {
    if (!dispute.caseNumber) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const paddedId = String(dispute.id).padStart(5, "0");
      const caseNumber = `PD-${dateStr}-${paddedId}`;
      await dispute.update({ caseNumber }, { transaction: options.transaction });
    }
  });

  return PaymentDispute;
};
