"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("PricingConfigs", "idVerificationEnabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether to enable OCR-based ID name verification for applications",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("PricingConfigs", "idVerificationEnabled");
  },
};
