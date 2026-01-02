/**
 * ReferralConfig Model
 *
 * Stores the company's referral program configuration.
 * Only one row should be active at a time (isActive: true).
 * Historical records are kept for audit trail.
 */
module.exports = (sequelize, DataTypes) => {
  const ReferralConfig = sequelize.define("ReferralConfig", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // === Client -> Client Program ("Give $25, Get $25") ===
    clientToClientEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether client-to-client referrals are enabled",
    },
    clientToClientReferrerReward: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2500,
      comment: "Reward for referrer in cents ($25 default)",
    },
    clientToClientReferredReward: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2500,
      comment: "Reward for referred user in cents ($25 default)",
    },
    clientToClientCleaningsRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Number of cleanings before reward triggers",
    },
    clientToClientRewardType: {
      type: DataTypes.ENUM("credit", "discount_percent", "flat_discount"),
      allowNull: false,
      defaultValue: "credit",
      comment: "Type of reward to give",
    },
    clientToClientMaxPerMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Max referrals per month (null = unlimited)",
    },

    // === Client -> Cleaner Program ===
    clientToCleanerEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether client-to-cleaner referrals are enabled",
    },
    clientToCleanerReferrerReward: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5000,
      comment: "Reward for referrer in cents ($50 default)",
    },
    clientToCleanerCleaningsRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: "Number of cleanings before reward triggers",
    },
    clientToCleanerRewardType: {
      type: DataTypes.ENUM("credit", "discount_percent", "flat_discount"),
      allowNull: false,
      defaultValue: "credit",
      comment: "Type of reward to give",
    },
    clientToCleanerMaxPerMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Max referrals per month (null = unlimited)",
    },

    // === Cleaner -> Cleaner Program ===
    cleanerToCleanerEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether cleaner-to-cleaner referrals are enabled",
    },
    cleanerToCleanerReferrerReward: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5000,
      comment: "Bonus for referrer in cents ($50 default)",
    },
    cleanerToCleanerCleaningsRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Number of cleanings before bonus triggers",
    },
    cleanerToCleanerRewardType: {
      type: DataTypes.ENUM("bonus", "fee_reduction"),
      allowNull: false,
      defaultValue: "bonus",
      comment: "Type of reward: bonus payment or fee reduction",
    },
    cleanerToCleanerMaxPerMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Max referrals per month (null = unlimited)",
    },

    // === Cleaner -> Client Program (bulk discount) ===
    cleanerToClientEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether cleaner-to-client referrals are enabled",
    },
    cleanerToClientDiscountPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 10.0,
      comment: "Discount percent for bulk referrals (10 = 10%)",
    },
    cleanerToClientMinReferrals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: "Minimum referrals for bulk discount",
    },
    cleanerToClientRewardType: {
      type: DataTypes.ENUM("discount_percent", "flat_discount", "bonus"),
      allowNull: false,
      defaultValue: "discount_percent",
      comment: "Type of reward for cleaner",
    },
    cleanerToClientMaxPerMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Max referrals per month (null = unlimited)",
    },

    // === Audit fields ===
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether this is the current active config",
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

  ReferralConfig.associate = (models) => {
    ReferralConfig.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updatedByUser",
    });
  };

  /**
   * Get the current active referral configuration.
   * Returns null if no active config exists.
   */
  ReferralConfig.getActive = async () => {
    return ReferralConfig.findOne({
      where: { isActive: true },
      order: [["createdAt", "DESC"]],
    });
  };

  /**
   * Get referral config in a formatted structure for API responses.
   */
  ReferralConfig.getFormattedConfig = async () => {
    const config = await ReferralConfig.getActive();
    if (!config) return null;

    return {
      clientToClient: {
        enabled: config.clientToClientEnabled,
        referrerReward: config.clientToClientReferrerReward,
        referredReward: config.clientToClientReferredReward,
        cleaningsRequired: config.clientToClientCleaningsRequired,
        rewardType: config.clientToClientRewardType,
        maxPerMonth: config.clientToClientMaxPerMonth,
      },
      clientToCleaner: {
        enabled: config.clientToCleanerEnabled,
        referrerReward: config.clientToCleanerReferrerReward,
        cleaningsRequired: config.clientToCleanerCleaningsRequired,
        rewardType: config.clientToCleanerRewardType,
        maxPerMonth: config.clientToCleanerMaxPerMonth,
      },
      cleanerToCleaner: {
        enabled: config.cleanerToCleanerEnabled,
        referrerReward: config.cleanerToCleanerReferrerReward,
        cleaningsRequired: config.cleanerToCleanerCleaningsRequired,
        rewardType: config.cleanerToCleanerRewardType,
        maxPerMonth: config.cleanerToCleanerMaxPerMonth,
      },
      cleanerToClient: {
        enabled: config.cleanerToClientEnabled,
        discountPercent: parseFloat(config.cleanerToClientDiscountPercent),
        minReferrals: config.cleanerToClientMinReferrals,
        rewardType: config.cleanerToClientRewardType,
        maxPerMonth: config.cleanerToClientMaxPerMonth,
      },
    };
  };

  /**
   * Create a new referral config and deactivate the old one.
   * @param {Object} configData - New config values
   * @param {number} ownerId - ID of the owner making the change
   * @param {string} changeNote - Optional note about the change
   */
  ReferralConfig.updateConfig = async (configData, ownerId, changeNote = null) => {
    const transaction = await sequelize.transaction();

    try {
      // Deactivate current active config
      await ReferralConfig.update(
        { isActive: false },
        { where: { isActive: true }, transaction }
      );

      // Flatten nested config data if needed
      const flatData = {};

      if (configData.clientToClient) {
        flatData.clientToClientEnabled = configData.clientToClient.enabled;
        flatData.clientToClientReferrerReward = configData.clientToClient.referrerReward;
        flatData.clientToClientReferredReward = configData.clientToClient.referredReward;
        flatData.clientToClientCleaningsRequired = configData.clientToClient.cleaningsRequired;
        flatData.clientToClientRewardType = configData.clientToClient.rewardType;
        flatData.clientToClientMaxPerMonth = configData.clientToClient.maxPerMonth;
      }

      if (configData.clientToCleaner) {
        flatData.clientToCleanerEnabled = configData.clientToCleaner.enabled;
        flatData.clientToCleanerReferrerReward = configData.clientToCleaner.referrerReward;
        flatData.clientToCleanerCleaningsRequired = configData.clientToCleaner.cleaningsRequired;
        flatData.clientToCleanerRewardType = configData.clientToCleaner.rewardType;
        flatData.clientToCleanerMaxPerMonth = configData.clientToCleaner.maxPerMonth;
      }

      if (configData.cleanerToCleaner) {
        flatData.cleanerToCleanerEnabled = configData.cleanerToCleaner.enabled;
        flatData.cleanerToCleanerReferrerReward = configData.cleanerToCleaner.referrerReward;
        flatData.cleanerToCleanerCleaningsRequired = configData.cleanerToCleaner.cleaningsRequired;
        flatData.cleanerToCleanerRewardType = configData.cleanerToCleaner.rewardType;
        flatData.cleanerToCleanerMaxPerMonth = configData.cleanerToCleaner.maxPerMonth;
      }

      if (configData.cleanerToClient) {
        flatData.cleanerToClientEnabled = configData.cleanerToClient.enabled;
        flatData.cleanerToClientDiscountPercent = configData.cleanerToClient.discountPercent;
        flatData.cleanerToClientMinReferrals = configData.cleanerToClient.minReferrals;
        flatData.cleanerToClientRewardType = configData.cleanerToClient.rewardType;
        flatData.cleanerToClientMaxPerMonth = configData.cleanerToClient.maxPerMonth;
      }

      // Create new active config
      const newConfig = await ReferralConfig.create(
        {
          ...flatData,
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
   * Get referral config change history
   */
  ReferralConfig.getHistory = async (limit = 20) => {
    return ReferralConfig.findAll({
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

  return ReferralConfig;
};
