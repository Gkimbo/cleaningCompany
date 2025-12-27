"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("CalendarSyncs", "autoSync", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Enable automatic syncing every 6 hours",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("CalendarSyncs", "autoSync");
  },
};
