module.exports = (sequelize, DataTypes) => {
  const HomeSizeAdjustmentRequest = sequelize.define('HomeSizeAdjustmentRequest', {
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
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'UserAppointments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    homeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'UserHomes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    homeownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    originalNumBeds: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    originalNumBaths: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    originalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    reportedNumBeds: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reportedNumBaths: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    calculatedNewPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    priceDifference: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        'pending_homeowner',
        'approved',
        'denied',
        'pending_owner',
        'owner_approved',
        'owner_denied',
        'expired'
      ),
      allowNull: false,
      defaultValue: 'pending_homeowner',
    },
    cleanerNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    homeownerResponse: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ownerNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    },
    chargePaymentIntentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    chargeStatus: {
      type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'waived'),
      allowNull: true,
    },
    homeownerRespondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ownerResolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  HomeSizeAdjustmentRequest.associate = (models) => {
    HomeSizeAdjustmentRequest.belongsTo(models.UserAppointments, {
      foreignKey: 'appointmentId',
      as: 'appointment',
    });
    HomeSizeAdjustmentRequest.belongsTo(models.UserHomes, {
      foreignKey: 'homeId',
      as: 'home',
    });
    HomeSizeAdjustmentRequest.belongsTo(models.User, {
      foreignKey: 'cleanerId',
      as: 'cleaner',
    });
    HomeSizeAdjustmentRequest.belongsTo(models.User, {
      foreignKey: 'homeownerId',
      as: 'homeowner',
    });
    HomeSizeAdjustmentRequest.belongsTo(models.User, {
      foreignKey: 'ownerId',
      as: 'owner',
    });
    HomeSizeAdjustmentRequest.hasMany(models.HomeSizeAdjustmentPhoto, {
      foreignKey: 'adjustmentRequestId',
      as: 'photos',
    });
  };

  // Generate case number after creation
  HomeSizeAdjustmentRequest.afterCreate(async (adjustment, options) => {
    if (!adjustment.caseNumber) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const paddedId = String(adjustment.id).padStart(5, "0");
      const caseNumber = `ADJ-${dateStr}-${paddedId}`;
      await adjustment.update({ caseNumber }, { transaction: options.transaction });
    }
  });

  return HomeSizeAdjustmentRequest;
};
