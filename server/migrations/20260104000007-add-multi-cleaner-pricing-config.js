"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add multi-cleaner pricing fields to PricingConfig
    await queryInterface.addColumn("PricingConfigs", "multiCleanerPlatformFeePercent", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.13,
      comment: "Platform fee for multi-cleaner jobs (0.13 = 13%)",
    });

    await queryInterface.addColumn("PricingConfigs", "soloLargeHomeBonus", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Bonus in cents for solo cleaner on large home",
    });

    await queryInterface.addColumn("PricingConfigs", "largeHomeBedsThreshold", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: "Minimum beds to trigger large home (3 = 3+ beds)",
    });

    await queryInterface.addColumn("PricingConfigs", "largeHomeBathsThreshold", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: "Minimum baths to trigger large home (3 = 3+ baths)",
    });

    await queryInterface.addColumn("PricingConfigs", "multiCleanerOfferExpirationHours", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 48,
      comment: "Hours before job offer expires",
    });

    await queryInterface.addColumn("PricingConfigs", "urgentFillDays", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 7,
      comment: "Days before appointment to send urgent fill notifications",
    });

    await queryInterface.addColumn("PricingConfigs", "finalWarningDays", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: "Days before appointment for homeowner final warning",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("PricingConfigs", "finalWarningDays");
    await queryInterface.removeColumn("PricingConfigs", "urgentFillDays");
    await queryInterface.removeColumn("PricingConfigs", "multiCleanerOfferExpirationHours");
    await queryInterface.removeColumn("PricingConfigs", "largeHomeBathsThreshold");
    await queryInterface.removeColumn("PricingConfigs", "largeHomeBedsThreshold");
    await queryInterface.removeColumn("PricingConfigs", "soloLargeHomeBonus");
    await queryInterface.removeColumn("PricingConfigs", "multiCleanerPlatformFeePercent");
  },
};
