"use strict";

/**
 * Migration to add solo offer tracking fields
 * Allows tracking when cleaners decline or don't respond to solo completion offers
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add solo offer tracking to MultiCleanerJob
    await queryInterface.addColumn("MultiCleanerJobs", "soloOfferDeclined", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("MultiCleanerJobs", "soloOfferDeclinedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("MultiCleanerJobs", "soloOfferExpired", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("MultiCleanerJobs", "soloOfferExpiredAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add solo decline tracking to CleanerJobCompletion
    await queryInterface.addColumn("CleanerJobCompletions", "soloDeclined", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("CleanerJobCompletions", "soloDeclinedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("CleanerJobCompletions", "soloDeclineReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    // Remove from MultiCleanerJobs
    await queryInterface.removeColumn("MultiCleanerJobs", "soloOfferDeclined");
    await queryInterface.removeColumn("MultiCleanerJobs", "soloOfferDeclinedAt");
    await queryInterface.removeColumn("MultiCleanerJobs", "soloOfferExpired");
    await queryInterface.removeColumn("MultiCleanerJobs", "soloOfferExpiredAt");

    // Remove from CleanerJobCompletions
    await queryInterface.removeColumn("CleanerJobCompletions", "soloDeclined");
    await queryInterface.removeColumn("CleanerJobCompletions", "soloDeclinedAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "soloDeclineReason");
  },
};
