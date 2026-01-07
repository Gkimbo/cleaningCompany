"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Users", "calendarSyncDisclaimerAcceptedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Timestamp when user accepted the calendar sync disclaimer",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Users", "calendarSyncDisclaimerAcceptedAt");
  },
};
