"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("PreferredPerksConfigs", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      // Tier thresholds and bonuses
      bronzeMinHomes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      bronzeMaxHomes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      bronzeBonusPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },

      silverMinHomes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      silverMaxHomes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      silverBonusPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 3,
      },

      goldMinHomes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 6,
      },
      goldMaxHomes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10,
      },
      goldBonusPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 5,
      },
      goldFasterPayouts: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      goldPayoutHours: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 24,
      },

      platinumMinHomes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 11,
      },
      platinumBonusPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 7,
      },
      platinumFasterPayouts: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      platinumPayoutHours: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 24,
      },
      platinumEarlyAccess: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // Backup cleaner notification settings
      backupCleanerTimeoutHours: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 24,
        comment: "Hours backup cleaners have to respond before escalating",
      },

      // Platform overbooking limits
      platformMaxDailyJobs: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: "Maximum jobs per cleaner per day",
      },
      platformMaxConcurrentJobs: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
        comment: "Maximum overlapping jobs per cleaner",
      },

      // Audit fields
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Insert default config
    await queryInterface.bulkInsert("PreferredPerksConfigs", [
      {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
        backupCleanerTimeoutHours: 24,
        platformMaxDailyJobs: 5,
        platformMaxConcurrentJobs: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("PreferredPerksConfigs");
  },
};
