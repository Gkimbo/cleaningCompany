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
  };

  // Helper to calculate 90/10 split
  Payout.calculateSplit = (grossAmountCents) => {
    const platformFee = Math.round(grossAmountCents * 0.10); // 10% to platform
    const netAmount = grossAmountCents - platformFee; // 90% to cleaner
    return { platformFee, netAmount };
  };

  return Payout;
};
