"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("EmployeeJobAssignments", "hourlyRateAtAssignment", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Hourly rate in cents at time of assignment (for hourly pay type)",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("EmployeeJobAssignments", "hourlyRateAtAssignment");
  },
};
