'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add assignedToBusinessEmployee field
    await queryInterface.addColumn('UserAppointments', 'assignedToBusinessEmployee', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Add businessEmployeeAssignmentId field
    await queryInterface.addColumn('UserAppointments', 'businessEmployeeAssignmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'EmployeeJobAssignments',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add index
    await queryInterface.addIndex('UserAppointments', ['assignedToBusinessEmployee']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserAppointments', 'assignedToBusinessEmployee');
    await queryInterface.removeColumn('UserAppointments', 'businessEmployeeAssignmentId');
  }
};
