'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PricingConfigs', 'halfBathFee', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 25,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PricingConfigs', 'halfBathFee');
  },
};
