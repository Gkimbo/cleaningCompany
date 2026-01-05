module.exports = (sequelize, DataTypes) => {
  const PreferredPerksConfig = sequelize.define(
    "PreferredPerksConfig",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      // Bronze tier
      bronzeMinHomes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      bronzeMaxHomes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      bronzeBonusPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // Silver tier
      silverMinHomes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      silverMaxHomes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      silverBonusPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 3,
      },

      // Gold tier
      goldMinHomes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 6,
      },
      goldMaxHomes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
      },
      goldBonusPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 5,
      },
      goldFasterPayouts: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      goldPayoutHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 24,
      },

      // Platinum tier
      platinumMinHomes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 11,
      },
      platinumBonusPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 7,
      },
      platinumFasterPayouts: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      platinumPayoutHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 24,
      },
      platinumEarlyAccess: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // Backup cleaner notification settings
      backupCleanerTimeoutHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 24,
        comment: "Hours backup cleaners have to respond before escalating",
      },

      // Platform overbooking limits
      platformMaxDailyJobs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: "Maximum jobs per cleaner per day",
      },
      platformMaxConcurrentJobs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
        comment: "Maximum overlapping jobs per cleaner",
      },

      // Audit
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "PreferredPerksConfigs",
      timestamps: true,
    }
  );

  PreferredPerksConfig.associate = (models) => {
    PreferredPerksConfig.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updater",
    });
  };

  // Helper to get tier for a cleaner based on preferred home count
  PreferredPerksConfig.prototype.getTierForHomeCount = function(homeCount) {
    if (homeCount >= this.platinumMinHomes) {
      return {
        tier: "platinum",
        bonusPercent: parseFloat(this.platinumBonusPercent),
        fasterPayouts: this.platinumFasterPayouts,
        payoutHours: this.platinumPayoutHours,
        earlyAccess: this.platinumEarlyAccess,
      };
    }
    if (homeCount >= this.goldMinHomes && homeCount <= this.goldMaxHomes) {
      return {
        tier: "gold",
        bonusPercent: parseFloat(this.goldBonusPercent),
        fasterPayouts: this.goldFasterPayouts,
        payoutHours: this.goldPayoutHours,
        earlyAccess: false,
      };
    }
    if (homeCount >= this.silverMinHomes && homeCount <= this.silverMaxHomes) {
      return {
        tier: "silver",
        bonusPercent: parseFloat(this.silverBonusPercent),
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
      };
    }
    return {
      tier: "bronze",
      bonusPercent: parseFloat(this.bronzeBonusPercent),
      fasterPayouts: false,
      payoutHours: 48,
      earlyAccess: false,
    };
  };

  return PreferredPerksConfig;
};
