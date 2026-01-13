"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserAppointments", "replacementNotificationsSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When replacement notifications were sent after cleaner cancellation",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("UserAppointments", "replacementNotificationsSentAt");
  },
};
