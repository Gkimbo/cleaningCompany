'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add fields for business owner declining a client appointment
    await queryInterface.addColumn('UserAppointments', 'businessOwnerDeclined', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('UserAppointments', 'businessOwnerDeclinedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('UserAppointments', 'businessOwnerDeclineReason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Add index for querying declined appointments
    await queryInterface.addIndex('UserAppointments', ['businessOwnerDeclined', 'bookedByCleanerId'], {
      name: 'appointments_business_owner_declined_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('UserAppointments', 'appointments_business_owner_declined_idx');
    await queryInterface.removeColumn('UserAppointments', 'businessOwnerDeclineReason');
    await queryInterface.removeColumn('UserAppointments', 'businessOwnerDeclinedAt');
    await queryInterface.removeColumn('UserAppointments', 'businessOwnerDeclined');
  }
};
