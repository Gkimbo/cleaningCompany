"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add backup cleaner notification tracking fields
    await queryInterface.addColumn("UserAppointments", "backupCleanersNotified", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether backup preferred cleaners have been notified",
    });

    await queryInterface.addColumn("UserAppointments", "backupNotificationSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When backup cleaners were notified",
    });

    await queryInterface.addColumn("UserAppointments", "backupNotificationExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When backup notification window expires",
    });

    // Add index for finding appointments waiting for backup response
    await queryInterface.addIndex("UserAppointments", ["backupCleanersNotified", "backupNotificationExpiresAt"], {
      name: "idx_appointments_backup_pending",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_backup_pending");
    await queryInterface.removeColumn("UserAppointments", "backupNotificationExpiresAt");
    await queryInterface.removeColumn("UserAppointments", "backupNotificationSentAt");
    await queryInterface.removeColumn("UserAppointments", "backupCleanersNotified");
  },
};
