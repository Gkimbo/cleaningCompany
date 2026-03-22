"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add reversal tracking fields to Payouts table
    await queryInterface.addColumn("Payouts", "reversalId", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Stripe transfer reversal ID",
    });

    await queryInterface.addColumn("Payouts", "reversedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the payout was reversed",
    });

    await queryInterface.addColumn("Payouts", "reversalReason", {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: "Reason for reversal: customer_refund, already_reversed, dispute, etc.",
    });

    // Add index for finding reversed payouts
    await queryInterface.addIndex("Payouts", ["status"], {
      name: "payouts_status_idx",
      where: {
        status: "reversed",
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("Payouts", "payouts_status_idx");
    await queryInterface.removeColumn("Payouts", "reversalReason");
    await queryInterface.removeColumn("Payouts", "reversedAt");
    await queryInterface.removeColumn("Payouts", "reversalId");
  },
};
