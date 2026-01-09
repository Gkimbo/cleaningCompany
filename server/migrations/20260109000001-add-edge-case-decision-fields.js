"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add edge case decision fields to MultiCleanerJobs table
    await queryInterface.addColumn("MultiCleanerJobs", "edgeCaseDecisionRequired", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this edge case home needs homeowner decision (1 cleaner confirmed, needs 2)",
    });

    await queryInterface.addColumn("MultiCleanerJobs", "edgeCaseDecisionSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the edge case decision notification was sent to homeowner",
    });

    await queryInterface.addColumn("MultiCleanerJobs", "edgeCaseDecisionExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the homeowner decision window expires (24 hours after sent)",
    });

    await queryInterface.addColumn("MultiCleanerJobs", "homeownerDecision", {
      type: Sequelize.ENUM("pending", "proceed", "cancel", "auto_proceeded"),
      allowNull: true,
      defaultValue: null,
      comment: "Homeowner decision for edge case: proceed with 1 cleaner, cancel, or auto-proceeded after timeout",
    });

    await queryInterface.addColumn("MultiCleanerJobs", "homeownerDecisionAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the homeowner made their decision",
    });

    // Add index for finding pending edge case decisions
    await queryInterface.addIndex("MultiCleanerJobs", ["homeownerDecision"], {
      name: "idx_multi_cleaner_jobs_homeowner_decision",
    });

    await queryInterface.addIndex("MultiCleanerJobs", ["edgeCaseDecisionExpiresAt"], {
      name: "idx_multi_cleaner_jobs_edge_case_expires",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex("MultiCleanerJobs", "idx_multi_cleaner_jobs_homeowner_decision");
    await queryInterface.removeIndex("MultiCleanerJobs", "idx_multi_cleaner_jobs_edge_case_expires");

    // Remove columns
    await queryInterface.removeColumn("MultiCleanerJobs", "homeownerDecisionAt");
    await queryInterface.removeColumn("MultiCleanerJobs", "homeownerDecision");
    await queryInterface.removeColumn("MultiCleanerJobs", "edgeCaseDecisionExpiresAt");
    await queryInterface.removeColumn("MultiCleanerJobs", "edgeCaseDecisionSentAt");
    await queryInterface.removeColumn("MultiCleanerJobs", "edgeCaseDecisionRequired");

    // Remove the ENUM type
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_MultiCleanerJobs_homeownerDecision";'
    );
  },
};
