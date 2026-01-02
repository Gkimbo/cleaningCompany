"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add incentive cancellation fields to PricingConfigs table
    await queryInterface.addColumn("PricingConfigs", "incentiveRefundPercent", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.10,
      comment: "Refund percentage for incentive cancellations (0.10 = 10%)",
    });

    await queryInterface.addColumn("PricingConfigs", "incentiveCleanerPercent", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.40,
      comment: "Percentage of original price cleaner receives on incentive cancellation (0.40 = 40%)",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("PricingConfigs", "incentiveRefundPercent");
    await queryInterface.removeColumn("PricingConfigs", "incentiveCleanerPercent");
  },
};
