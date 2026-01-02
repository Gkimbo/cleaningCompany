/**
 * Referral Model
 *
 * Tracks individual referral relationships between users.
 * Records who referred whom, program type, status, and reward tracking.
 */
module.exports = (sequelize, DataTypes) => {
  const Referral = sequelize.define("Referral", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // === Relationship ===
    referrerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "User ID of the person who made the referral",
    },
    referredId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "User ID of the person who was referred",
    },
    referralCode: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "The referral code that was used",
    },

    // === Program type ===
    programType: {
      type: DataTypes.ENUM(
        "client_to_client",
        "client_to_cleaner",
        "cleaner_to_cleaner",
        "cleaner_to_client"
      ),
      allowNull: false,
      comment: "Which referral program this belongs to",
    },

    // === Status tracking ===
    status: {
      type: DataTypes.ENUM(
        "pending",
        "qualified",
        "rewarded",
        "expired",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
      comment: "Current status of the referral",
    },

    // === Progress tracking ===
    cleaningsRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Number of cleanings required to qualify",
    },
    cleaningsCompleted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of cleanings completed by referred user",
    },

    // === Reward details (snapshot from config at time of referral) ===
    referrerRewardAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Reward amount for referrer in cents",
    },
    referredRewardAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Reward amount for referred user in cents",
    },
    referrerRewardType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Type of reward for referrer",
    },
    referredRewardType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Type of reward for referred user",
    },

    // === Reward application tracking ===
    referrerRewardApplied: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether referrer reward has been applied",
    },
    referrerRewardAppliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When referrer reward was applied",
    },
    referrerRewardAppointmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Which appointment the referrer reward was applied to",
    },
    referredRewardApplied: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether referred user reward has been applied",
    },
    referredRewardAppliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When referred user reward was applied",
    },
    referredRewardAppointmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Which appointment the referred reward was applied to",
    },

    // === Timestamps ===
    qualifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the referral became qualified for rewards",
    },
  });

  Referral.associate = (models) => {
    Referral.belongsTo(models.User, {
      foreignKey: "referrerId",
      as: "referrer",
    });
    Referral.belongsTo(models.User, {
      foreignKey: "referredId",
      as: "referred",
    });
    Referral.belongsTo(models.UserAppointments, {
      foreignKey: "referrerRewardAppointmentId",
      as: "referrerRewardAppointment",
    });
    Referral.belongsTo(models.UserAppointments, {
      foreignKey: "referredRewardAppointmentId",
      as: "referredRewardAppointment",
    });
  };

  /**
   * Find all referrals made by a user
   */
  Referral.findByReferrer = async (referrerId, options = {}) => {
    return Referral.findAll({
      where: { referrerId },
      order: [["createdAt", "DESC"]],
      ...options,
    });
  };

  /**
   * Find referral for a referred user
   */
  Referral.findByReferred = async (referredId) => {
    return Referral.findOne({
      where: { referredId },
    });
  };

  /**
   * Count referrals made by a user in the current month for a specific program
   */
  Referral.countMonthlyReferrals = async (referrerId, programType) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return Referral.count({
      where: {
        referrerId,
        programType,
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startOfMonth, endOfMonth],
        },
      },
    });
  };

  /**
   * Get referral statistics for a user
   */
  Referral.getStats = async (userId) => {
    const referralsMade = await Referral.findAll({
      where: { referrerId: userId },
    });

    const pending = referralsMade.filter((r) => r.status === "pending").length;
    const qualified = referralsMade.filter((r) => r.status === "qualified").length;
    const rewarded = referralsMade.filter((r) => r.status === "rewarded").length;
    const totalEarned = referralsMade
      .filter((r) => r.referrerRewardApplied)
      .reduce((sum, r) => sum + r.referrerRewardAmount, 0);

    return {
      totalReferrals: referralsMade.length,
      pending,
      qualified,
      rewarded,
      totalEarned,
    };
  };

  return Referral;
};
