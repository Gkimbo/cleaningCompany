"use strict";

/**
 * Migration to add extra work tracking fields
 * Allows tracking when cleaners accept/decline extra work after a co-cleaner dropout
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add extra work tracking to MultiCleanerJob
    await queryInterface.addColumn("MultiCleanerJobs", "extraWorkOffersSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("MultiCleanerJobs", "extraWorkOffersExpireAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add extra work tracking to CleanerJobCompletion
    await queryInterface.addColumn("CleanerJobCompletions", "extraWorkAccepted", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("CleanerJobCompletions", "extraWorkAcceptedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("CleanerJobCompletions", "extraWorkDeclined", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("CleanerJobCompletions", "extraWorkDeclinedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("CleanerJobCompletions", "extraWorkDeclineReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    // Remove from MultiCleanerJobs
    await queryInterface.removeColumn("MultiCleanerJobs", "extraWorkOffersSentAt");
    await queryInterface.removeColumn("MultiCleanerJobs", "extraWorkOffersExpireAt");

    // Remove from CleanerJobCompletions
    await queryInterface.removeColumn("CleanerJobCompletions", "extraWorkAccepted");
    await queryInterface.removeColumn("CleanerJobCompletions", "extraWorkAcceptedAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "extraWorkDeclined");
    await queryInterface.removeColumn("CleanerJobCompletions", "extraWorkDeclinedAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "extraWorkDeclineReason");
  },
};
