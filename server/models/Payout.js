module.exports = (sequelize, DataTypes) => {
  const Payout = sequelize.define("Payout", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stripeTransferId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    grossAmount: {
      type: DataTypes.INTEGER, // Amount in cents (total job price / num cleaners)
      allowNull: false,
    },
    platformFee: {
      type: DataTypes.INTEGER, // 10% platform fee in cents
      allowNull: false,
    },
    netAmount: {
      type: DataTypes.INTEGER, // 90% to cleaner in cents
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      // pending, held, processing, completed, failed
    },
    paymentCapturedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transferInitiatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Incentive tracking
    incentiveApplied: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    originalPlatformFee: {
      type: DataTypes.INTEGER, // Original fee before incentive reduction (in cents)
      allowNull: true,
    },
    // Multi-cleaner job fields
    multiCleanerJobId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    isPartialPayout: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    originalGrossAmount: {
      type: DataTypes.INTEGER, // Original amount before adjustments (in cents)
      allowNull: true,
    },
    adjustmentReason: {
      type: DataTypes.TEXT, // 'solo_completion_bonus', 'partial_work', 'co_cleaner_dropout', etc.
      allowNull: true,
    },
    // Business employee payout fields
    payoutType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "marketplace",
      // 'marketplace', 'business_employee', 'business_owner_self'
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    employeeJobAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    paidOutsidePlatform: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Preferred cleaner perk tracking
    preferredBonusApplied: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    preferredBonusPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Bonus percentage applied from preferred cleaner tier",
    },
    preferredBonusAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Bonus amount in cents added to payout",
    },
    cleanerTierAtPayout: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Cleaner tier level at time of payout (bronze/silver/gold/platinum)",
    },
    isPreferredHomeJob: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this job was at a home where cleaner is preferred",
    },
  });

  Payout.associate = (models) => {
    Payout.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    Payout.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
    Payout.belongsTo(models.MultiCleanerJob, {
      foreignKey: "multiCleanerJobId",
      as: "multiCleanerJob",
    });
    Payout.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });
    Payout.belongsTo(models.EmployeeJobAssignment, {
      foreignKey: "employeeJobAssignmentId",
      as: "employeeJobAssignment",
    });
  };

  // Helper to calculate platform/cleaner split
  // NOTE: Prefer using getPricingConfig() to get feePercent from database
  // This method is a convenience for when you already have the feePercent
  Payout.calculateSplit = (grossAmountCents, feePercent = 0.10) => {
    const platformFee = Math.round(grossAmountCents * feePercent);
    const netAmount = grossAmountCents - platformFee;
    return { platformFee, netAmount };
  };

  return Payout;
};
