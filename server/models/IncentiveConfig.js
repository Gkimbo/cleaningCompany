/**
 * IncentiveConfig Model
 *
 * Stores the company's incentive configuration for cleaners and homeowners.
 * Only one row should be active at a time (isActive: true).
 * Historical records are kept for audit trail.
 */
module.exports = (sequelize, DataTypes) => {
  const IncentiveConfig = sequelize.define("IncentiveConfig", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Cleaner Incentive Settings
    cleanerIncentiveEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether cleaner incentive is active",
    },
    cleanerFeeReductionPercent: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 1.0,
      comment: "Platform fee reduction (1.00 = 100% reduction = 0% fees)",
    },
    cleanerEligibilityDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Days since account creation to qualify as new cleaner",
    },
    cleanerMaxCleanings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: "Number of cleanings with reduced fees",
    },

    // Homeowner Incentive Settings
    homeownerIncentiveEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether homeowner incentive is active",
    },
    homeownerDiscountPercent: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.1,
      comment: "Discount percentage (0.10 = 10% off)",
    },
    homeownerMaxCleanings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
      comment: "Number of cleanings with discount",
    },

    // Audit fields
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether this is the current active incentive config",
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

  IncentiveConfig.associate = (models) => {
    IncentiveConfig.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updatedByUser",
    });
  };

  /**
   * Get the current active incentive configuration.
   * Returns null if no active config exists.
   */
  IncentiveConfig.getActive = async () => {
    return IncentiveConfig.findOne({
      where: { isActive: true },
      order: [["createdAt", "DESC"]],
    });
  };

  /**
   * Get incentive config in a formatted structure for API responses.
   */
  IncentiveConfig.getFormattedConfig = async () => {
    const config = await IncentiveConfig.getActive();
    if (!config) {
      // Return default values if no config exists
      return {
        cleaner: {
          enabled: false,
          feeReductionPercent: 1.0,
          eligibilityDays: 30,
          maxCleanings: 5,
        },
        homeowner: {
          enabled: false,
          discountPercent: 0.1,
          maxCleanings: 4,
        },
      };
    }

    return {
      cleaner: {
        enabled: config.cleanerIncentiveEnabled,
        feeReductionPercent: parseFloat(config.cleanerFeeReductionPercent),
        eligibilityDays: config.cleanerEligibilityDays,
        maxCleanings: config.cleanerMaxCleanings,
      },
      homeowner: {
        enabled: config.homeownerIncentiveEnabled,
        discountPercent: parseFloat(config.homeownerDiscountPercent),
        maxCleanings: config.homeownerMaxCleanings,
      },
    };
  };

  /**
   * Create a new incentive config and deactivate the old one.
   * @param {Object} incentiveData - New incentive values
   * @param {number} ownerId - ID of the owner making the change
   * @param {string} changeNote - Optional note about the change
   */
  IncentiveConfig.updateIncentives = async (
    incentiveData,
    ownerId,
    changeNote = null
  ) => {
    const transaction = await sequelize.transaction();

    try {
      // Deactivate current active config
      await IncentiveConfig.update(
        { isActive: false },
        { where: { isActive: true }, transaction }
      );

      // Create new active config
      const newConfig = await IncentiveConfig.create(
        {
          ...incentiveData,
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
   * Get incentive config change history
   */
  IncentiveConfig.getHistory = async (limit = 20) => {
    return IncentiveConfig.findAll({
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

  return IncentiveConfig;
};
