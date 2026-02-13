"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add fields to track business owner reminder notifications for unassigned appointments
    await queryInterface.addColumn("UserAppointments", "businessOwnerRemindersSent", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Count of unassigned appointment reminders sent to business owner",
    });

    await queryInterface.addColumn("UserAppointments", "lastBusinessOwnerReminderAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When the last business owner reminder was sent",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("UserAppointments", "businessOwnerRemindersSent");
    await queryInterface.removeColumn("UserAppointments", "lastBusinessOwnerReminderAt");
  },
};
