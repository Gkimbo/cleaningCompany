/**
 * PricingConfig Model
 *
 * Stores the company's pricing configuration.
 * Only one row should be active at a time (isActive: true).
 * Historical records are kept for audit trail.
 */
module.exports = (sequelize, DataTypes) => {
  const PricingConfig = sequelize.define("PricingConfig", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Base pricing (in dollars)
    basePrice: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 150,
      comment: "Base price for 1 bed, 1 bath cleaning",
    },
    extraBedBathFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      comment: "Additional fee per extra bed or full bath",
    },
    halfBathFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 25,
      comment: "Additional fee per half bathroom",
    },

    // Linen services (in dollars)
    sheetFeePerBed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Fee per bed for sheet service",
    },
    towelFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: "Fee per towel",
    },
    faceClothFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      comment: "Fee per face cloth",
    },

    // Time window surcharges (in dollars)
    timeWindowAnytime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Surcharge for anytime window",
    },
    timeWindow10To3: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 25,
      comment: "Surcharge for 10am-3pm window",
    },
    timeWindow11To4: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 25,
      comment: "Surcharge for 11am-4pm window",
    },
    timeWindow12To2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Surcharge for 12pm-2pm window",
    },

    // Cancellation policy
    cancellationFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 25,
      comment: "Flat cancellation fee",
    },
    cancellationWindowDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7,
      comment: "Days before appointment when cancellation is free",
    },
    homeownerPenaltyDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: "Days before appointment when homeowner penalty applies",
    },
    cleanerPenaltyDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
      comment: "Days before appointment when cleaner penalty applies",
    },
    refundPercentage: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.50,
      comment: "Refund percentage for late cancellations (0.50 = 50%)",
    },

    // Platform fees
    platformFeePercent: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.10,
      comment: "Platform fee percentage (0.10 = 10%)",
    },
    businessOwnerFeePercent: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.10,
      comment: "Platform fee percentage for business owner cleaners (0.10 = 10%)",
    },

    // Incentive cancellation settings
    incentiveRefundPercent: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.10,
      comment: "Refund percentage for incentive cancellations (0.10 = 10%)",
    },
    incentiveCleanerPercent: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.40,
      comment: "Percentage of original price cleaner receives on incentive cancellation (0.40 = 40%)",
    },

    // High volume fee
    highVolumeFee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      comment: "Additional fee for high volume days",
    },

    // Audit fields
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether this is the current active pricing config",
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID of owner who made the update",
    },
    changeNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Note describing why the change was made",
    },
  });

  PricingConfig.associate = (models) => {
    PricingConfig.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updatedByUser",
    });
  };

  /**
   * Get the current active pricing configuration.
   * Returns null if no active config exists.
   */
  PricingConfig.getActive = async () => {
    return PricingConfig.findOne({
      where: { isActive: true },
      order: [["createdAt", "DESC"]],
    });
  };

  /**
   * Get pricing in the format expected by businessConfig.js
   */
  PricingConfig.getFormattedPricing = async () => {
    const config = await PricingConfig.getActive();
    if (!config) return null;

    return {
      basePrice: config.basePrice,
      extraBedBathFee: config.extraBedBathFee,
      halfBathFee: config.halfBathFee,
      linens: {
        sheetFeePerBed: config.sheetFeePerBed,
        towelFee: config.towelFee,
        faceClothFee: config.faceClothFee,
      },
      timeWindows: {
        anytime: {
          surcharge: config.timeWindowAnytime,
          label: "Anytime",
          description: config.timeWindowAnytime > 0 ? `+$${config.timeWindowAnytime} per cleaning` : "Most flexible, best pricing",
        },
        "10-3": {
          surcharge: config.timeWindow10To3,
          label: "10am - 3pm",
          description: `+$${config.timeWindow10To3} per cleaning`,
        },
        "11-4": {
          surcharge: config.timeWindow11To4,
          label: "11am - 4pm",
          description: `+$${config.timeWindow11To4} per cleaning`,
        },
        "12-2": {
          surcharge: config.timeWindow12To2,
          label: "12pm - 2pm",
          description: `+$${config.timeWindow12To2} per cleaning`,
        },
      },
      cancellation: {
        fee: config.cancellationFee,
        windowDays: config.cancellationWindowDays,
        homeownerPenaltyDays: config.homeownerPenaltyDays,
        cleanerPenaltyDays: config.cleanerPenaltyDays,
        refundPercentage: parseFloat(config.refundPercentage),
        incentiveRefundPercent: parseFloat(config.incentiveRefundPercent),
        incentiveCleanerPercent: parseFloat(config.incentiveCleanerPercent),
      },
      platform: {
        feePercent: parseFloat(config.platformFeePercent),
        businessOwnerFeePercent: parseFloat(config.businessOwnerFeePercent || config.platformFeePercent),
      },
      highVolumeFee: config.highVolumeFee,
    };
  };

  /**
   * Create a new pricing config and deactivate the old one.
   * @param {Object} pricingData - New pricing values
   * @param {number} ownerId - ID of the owner making the change
   * @param {string} changeNote - Optional note about the change
   */
  PricingConfig.updatePricing = async (pricingData, ownerId, changeNote = null) => {
    const transaction = await sequelize.transaction();

    try {
      // Deactivate current active config
      await PricingConfig.update(
        { isActive: false },
        { where: { isActive: true }, transaction }
      );

      // Create new active config
      const newConfig = await PricingConfig.create(
        {
          ...pricingData,
          isActive: true,
          updatedBy: ownerId,
          changeNote,
        },
        { transaction }
      );

      await transaction.commit();
      return newConfig;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  /**
   * Get pricing change history
   */
  PricingConfig.getHistory = async (limit = 20) => {
    return PricingConfig.findAll({
      order: [["createdAt", "DESC"]],
      limit,
      include: [
        {
          association: "updatedByUser",
          attributes: ["id", "username", "email"],
        },
      ],
    });
  };

  return PricingConfig;
};
