"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("IncentiveConfigs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      // Cleaner Incentive Settings
      cleanerIncentiveEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      cleanerFeeReductionPercent: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.0,
      },
      cleanerEligibilityDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      cleanerMaxCleanings: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      // Homeowner Incentive Settings
      homeownerIncentiveEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      homeownerDiscountPercent: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.1,
      },
      homeownerMaxCleanings: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 4,
      },
      // Audit fields
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      changeNote: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add index for quick lookup of active config
    await queryInterface.addIndex("IncentiveConfigs", ["isActive"], {
      name: "incentive_config_active_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("IncentiveConfigs");
  },
};
