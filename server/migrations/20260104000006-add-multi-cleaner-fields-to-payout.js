"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Payouts", "multiCleanerJobId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "MultiCleanerJobs",
        key: "id",
      },
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("Payouts", "isPartialPayout", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this is a partial payout for incomplete work",
    });

    await queryInterface.addColumn("Payouts", "originalGrossAmount", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Original gross amount before any adjustments (in cents)",
    });

    await queryInterface.addColumn("Payouts", "adjustmentReason", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Reason for adjustment: solo_completion_bonus, partial_work, etc.",
    });

    // Add index for multi-cleaner job payouts
    await queryInterface.addIndex("Payouts", ["multiCleanerJobId"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("Payouts", ["multiCleanerJobId"]);
    await queryInterface.removeColumn("Payouts", "adjustmentReason");
    await queryInterface.removeColumn("Payouts", "originalGrossAmount");
    await queryInterface.removeColumn("Payouts", "isPartialPayout");
    await queryInterface.removeColumn("Payouts", "multiCleanerJobId");
  },
};
