"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Payouts", "incentiveApplied", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("Payouts", "originalPlatformFee", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Original platform fee before incentive reduction (in cents)",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Payouts", "incentiveApplied");
    await queryInterface.removeColumn("Payouts", "originalPlatformFee");
  },
};
