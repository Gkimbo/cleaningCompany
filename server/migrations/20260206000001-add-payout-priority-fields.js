"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Payouts", "payoutPriority", {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: "normal",
      comment: "Payout priority: 'high' for Gold/Platinum tiers, 'normal' for Bronze/Silver",
    });

    await queryInterface.addColumn("Payouts", "expectedPayoutHours", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Expected hours until payout based on cleaner tier (e.g., 24 for Gold, 48 for normal)",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Payouts", "payoutPriority");
    await queryInterface.removeColumn("Payouts", "expectedPayoutHours");
  },
};
