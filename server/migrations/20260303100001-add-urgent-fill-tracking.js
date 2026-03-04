"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add urgent fill tracking fields to UserAppointments
    await queryInterface.addColumn("UserAppointments", "isUrgentFill", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if appointment was flagged for urgent fill due to cleaner removal within 7 days",
    });

    await queryInterface.addColumn("UserAppointments", "urgentFillNotificationsSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When urgent fill notifications were sent to cleaners within 10 miles",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("UserAppointments", "isUrgentFill");
    await queryInterface.removeColumn("UserAppointments", "urgentFillNotificationsSentAt");
  },
};
