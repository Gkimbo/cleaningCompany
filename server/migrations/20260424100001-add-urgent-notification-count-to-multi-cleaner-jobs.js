"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("MultiCleanerJobs", "urgentNotificationCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total number of urgent fill notifications sent for this job",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("MultiCleanerJobs", "urgentNotificationCount");
  },
};
