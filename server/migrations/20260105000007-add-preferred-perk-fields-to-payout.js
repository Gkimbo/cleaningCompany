"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add preferred cleaner perk bonus tracking fields
    await queryInterface.addColumn("Payouts", "preferredBonusApplied", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("Payouts", "preferredBonusPercent", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: "Bonus percentage applied from preferred cleaner tier",
    });

    await queryInterface.addColumn("Payouts", "preferredBonusAmount", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Bonus amount in cents added to payout",
    });

    await queryInterface.addColumn("Payouts", "cleanerTierAtPayout", {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: "Cleaner tier level at time of payout (bronze/silver/gold/platinum)",
    });

    await queryInterface.addColumn("Payouts", "isPreferredHomeJob", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this job was at a home where cleaner is preferred",
    });

    // Index for analyzing preferred job payouts
    await queryInterface.addIndex("Payouts", ["preferredBonusApplied", "cleanerTierAtPayout"], {
      name: "idx_payouts_preferred_perks",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("Payouts", "idx_payouts_preferred_perks");
    await queryInterface.removeColumn("Payouts", "isPreferredHomeJob");
    await queryInterface.removeColumn("Payouts", "cleanerTierAtPayout");
    await queryInterface.removeColumn("Payouts", "preferredBonusAmount");
    await queryInterface.removeColumn("Payouts", "preferredBonusPercent");
    await queryInterface.removeColumn("Payouts", "preferredBonusApplied");
  },
};
