'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add availability schedule - JSON object with per-day availability
    // Format: { "monday": { "available": true, "start": "09:00", "end": "17:00" }, ... }
    await queryInterface.addColumn('BusinessEmployees', 'availableSchedule', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'JSON object with per-day availability (day -> {available, start, end})',
    });

    // Add default job types this employee can be assigned to
    // Format: ["standard", "deep", "move_in", "move_out"]
    await queryInterface.addColumn('BusinessEmployees', 'defaultJobTypes', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'JSON array of job types employee can be assigned to',
    });

    // Add max jobs per day limit
    await queryInterface.addColumn('BusinessEmployees', 'maxJobsPerDay', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Maximum number of jobs this employee can have per day',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('BusinessEmployees', 'availableSchedule');
    await queryInterface.removeColumn('BusinessEmployees', 'defaultJobTypes');
    await queryInterface.removeColumn('BusinessEmployees', 'maxJobsPerDay');
  }
};
