"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add earlyAccessMinutes to PreferredPerksConfigs
    await queryInterface.addColumn("PreferredPerksConfigs", "earlyAccessMinutes", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Minutes of early access for platinum cleaners to new jobs",
    });

    // Add earlyAccessUntil to UserAppointments
    await queryInterface.addColumn("UserAppointments", "earlyAccessUntil", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Timestamp until which the job is only visible to platinum cleaners",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("PreferredPerksConfigs", "earlyAccessMinutes");
    await queryInterface.removeColumn("UserAppointments", "earlyAccessUntil");
  },
};
