"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add multi-cleaner fields to UserAppointments
    await queryInterface.addColumn("UserAppointments", "isMultiCleanerJob", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserAppointments", "multiCleanerJobId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "MultiCleanerJobs",
        key: "id",
      },
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("UserAppointments", "cleanerSlotsRemaining", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of cleaner slots still available",
    });

    await queryInterface.addColumn("UserAppointments", "soloCleanerConsent", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Cleaner agreed to clean large home solo",
    });

    await queryInterface.addColumn("UserAppointments", "homeownerSoloWarningAcknowledged", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Homeowner acknowledged cleaner may take longer",
    });

    // Add index for multi-cleaner jobs
    await queryInterface.addIndex("UserAppointments", ["isMultiCleanerJob"]);
    await queryInterface.addIndex("UserAppointments", ["multiCleanerJobId"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("UserAppointments", ["multiCleanerJobId"]);
    await queryInterface.removeIndex("UserAppointments", ["isMultiCleanerJob"]);
    await queryInterface.removeColumn("UserAppointments", "homeownerSoloWarningAcknowledged");
    await queryInterface.removeColumn("UserAppointments", "soloCleanerConsent");
    await queryInterface.removeColumn("UserAppointments", "cleanerSlotsRemaining");
    await queryInterface.removeColumn("UserAppointments", "multiCleanerJobId");
    await queryInterface.removeColumn("UserAppointments", "isMultiCleanerJob");
  },
};
