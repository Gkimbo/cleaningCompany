"use strict";

/**
 * Migration: Add auto-complete tracking fields
 *
 * Adds fields to support:
 * 1. Auto-complete after X hours if cleaner forgets
 * 2. Early completion blocking (time window OR 30 min on-site)
 * 3. 24-hour payout dispute window
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add fields to UserAppointments
    await queryInterface.addColumn("UserAppointments", "scheduledEndTime", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Calculated end time based on date + timeToBeCompleted",
    });

    await queryInterface.addColumn("UserAppointments", "autoCompleteAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When auto-complete triggers (scheduledEndTime + 4 hours)",
    });

    await queryInterface.addColumn("UserAppointments", "autoCompleteRemindersSent", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of auto-complete reminders sent (0-5)",
    });

    await queryInterface.addColumn("UserAppointments", "lastReminderSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the last reminder was sent",
    });

    await queryInterface.addColumn("UserAppointments", "autoCompletedBySystem", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if job was auto-completed by system",
    });

    await queryInterface.addColumn("UserAppointments", "jobStartedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When first before photo was uploaded (job start time)",
    });

    // Add same fields to CleanerJobCompletion for multi-cleaner jobs
    await queryInterface.addColumn("CleanerJobCompletions", "autoCompleteAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When auto-complete triggers for this cleaner",
    });

    await queryInterface.addColumn("CleanerJobCompletions", "autoCompleteRemindersSent", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of auto-complete reminders sent to this cleaner",
    });

    await queryInterface.addColumn("CleanerJobCompletions", "lastReminderSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the last reminder was sent to this cleaner",
    });

    await queryInterface.addColumn("CleanerJobCompletions", "autoCompletedBySystem", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this cleaner's job was auto-completed",
    });

    await queryInterface.addColumn("CleanerJobCompletions", "jobStartedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When this cleaner uploaded their first before photo",
    });

    // Add auto-complete settings to PricingConfigs
    await queryInterface.addColumn("PricingConfigs", "autoCompleteHoursAfterEnd", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 4,
      comment: "Hours after scheduled end to trigger auto-complete",
    });

    await queryInterface.addColumn("PricingConfigs", "autoCompleteReminderIntervals", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [30, 60, 120, 180, 210],
      comment: "Minutes after scheduled end to send reminders",
    });

    await queryInterface.addColumn("PricingConfigs", "minOnSiteMinutes", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Minimum minutes on-site before early completion allowed",
    });

    // Update default completionAutoApprovalHours from 4 to 24 for new configs
    // (Existing configs keep their value; this only affects new configs)
    await queryInterface.changeColumn("PricingConfigs", "completionAutoApprovalHours", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 24,
      comment: "Hours before auto-approval triggers (24-hour dispute window)",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove from UserAppointments
    await queryInterface.removeColumn("UserAppointments", "scheduledEndTime");
    await queryInterface.removeColumn("UserAppointments", "autoCompleteAt");
    await queryInterface.removeColumn("UserAppointments", "autoCompleteRemindersSent");
    await queryInterface.removeColumn("UserAppointments", "lastReminderSentAt");
    await queryInterface.removeColumn("UserAppointments", "autoCompletedBySystem");
    await queryInterface.removeColumn("UserAppointments", "jobStartedAt");

    // Remove from CleanerJobCompletions
    await queryInterface.removeColumn("CleanerJobCompletions", "autoCompleteAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "autoCompleteRemindersSent");
    await queryInterface.removeColumn("CleanerJobCompletions", "lastReminderSentAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "autoCompletedBySystem");
    await queryInterface.removeColumn("CleanerJobCompletions", "jobStartedAt");

    // Remove from PricingConfigs
    await queryInterface.removeColumn("PricingConfigs", "autoCompleteHoursAfterEnd");
    await queryInterface.removeColumn("PricingConfigs", "autoCompleteReminderIntervals");
    await queryInterface.removeColumn("PricingConfigs", "minOnSiteMinutes");

    // Revert default back to 4 hours
    await queryInterface.changeColumn("PricingConfigs", "completionAutoApprovalHours", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 4,
      comment: "Hours before auto-approval triggers (configurable by owners)",
    });
  },
};
