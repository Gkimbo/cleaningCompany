"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserAppointments", "isDemoAppointment", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if created by demo account - excluded from marketplace",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("UserAppointments", "isDemoAppointment");
  },
};
