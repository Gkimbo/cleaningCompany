'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename the column from empoyeesNeeded to employeesNeeded (fixing typo)
    await queryInterface.renameColumn('UserAppointments', 'empoyeesNeeded', 'employeesNeeded');
  },

  async down(queryInterface, Sequelize) {
    // Revert: rename back to the typo version
    await queryInterface.renameColumn('UserAppointments', 'employeesNeeded', 'empoyeesNeeded');
  }
};
