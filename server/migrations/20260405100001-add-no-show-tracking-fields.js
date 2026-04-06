"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add no-show tracking fields to UserAppointments
    await queryInterface.addColumn("UserAppointments", "noShowWarningsSent", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of no-show warnings sent (0-3)",
    });

    await queryInterface.addColumn("UserAppointments", "lastNoShowWarningAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the last no-show warning was sent",
    });

    await queryInterface.addColumn("UserAppointments", "noShowProcessedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the cleaner was marked as no-show",
    });

    await queryInterface.addColumn("UserAppointments", "noShowCleanerId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "ID of cleaner who was marked as no-show",
    });

    // Add no-show tracking fields to CleanerJobCompletions
    await queryInterface.addColumn("CleanerJobCompletions", "noShowWarningsSent", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of no-show warnings sent to this cleaner (0-3)",
    });

    await queryInterface.addColumn("CleanerJobCompletions", "lastNoShowWarningAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the last no-show warning was sent",
    });

    await queryInterface.addColumn("CleanerJobCompletions", "noShowProcessedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When this cleaner was marked as no-show",
    });

    // Add no-show tracking fields to Users
    await queryInterface.addColumn("Users", "noShowCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of no-shows recorded for this cleaner",
    });

    await queryInterface.addColumn("Users", "lastNoShowAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the last no-show was recorded",
    });
  },

  async down(queryInterface) {
    // Remove from UserAppointments
    await queryInterface.removeColumn("UserAppointments", "noShowWarningsSent");
    await queryInterface.removeColumn("UserAppointments", "lastNoShowWarningAt");
    await queryInterface.removeColumn("UserAppointments", "noShowProcessedAt");
    await queryInterface.removeColumn("UserAppointments", "noShowCleanerId");

    // Remove from CleanerJobCompletions
    await queryInterface.removeColumn("CleanerJobCompletions", "noShowWarningsSent");
    await queryInterface.removeColumn("CleanerJobCompletions", "lastNoShowWarningAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "noShowProcessedAt");

    // Remove from Users
    await queryInterface.removeColumn("Users", "noShowCount");
    await queryInterface.removeColumn("Users", "lastNoShowAt");
  },
};
