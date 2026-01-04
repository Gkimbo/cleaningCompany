"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PricingConfigs", "businessOwnerFeePercent", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.10,
      comment: "Platform fee percentage for business owner cleaners (0.10 = 10%)",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("PricingConfigs", "businessOwnerFeePercent");
  },
};
