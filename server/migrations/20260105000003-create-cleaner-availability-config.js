"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CleanerAvailabilityConfigs", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      maxDailyJobs: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Cleaner override for max jobs per day (null = use platform default)",
      },
      maxConcurrentJobs: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Cleaner override for max overlapping jobs (null = use platform default)",
      },
      blackoutDates: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: "Array of dates the cleaner is unavailable",
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

    // Add index for fast lookups
    await queryInterface.addIndex("CleanerAvailabilityConfigs", ["cleanerId"], {
      name: "idx_cleaner_availability_cleaner",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CleanerAvailabilityConfigs");
  },
};
