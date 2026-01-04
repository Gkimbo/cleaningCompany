'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add payoutType field
    await queryInterface.addColumn('Payouts', 'payoutType', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'marketplace',
    });

    // Add businessOwnerId field
    await queryInterface.addColumn('Payouts', 'businessOwnerId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add employeeJobAssignmentId field
    await queryInterface.addColumn('Payouts', 'employeeJobAssignmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'EmployeeJobAssignments',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add paidOutsidePlatform field
    await queryInterface.addColumn('Payouts', 'paidOutsidePlatform', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Add indexes
    await queryInterface.addIndex('Payouts', ['payoutType']);
    await queryInterface.addIndex('Payouts', ['businessOwnerId']);
    await queryInterface.addIndex('Payouts', ['employeeJobAssignmentId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Payouts', 'payoutType');
    await queryInterface.removeColumn('Payouts', 'businessOwnerId');
    await queryInterface.removeColumn('Payouts', 'employeeJobAssignmentId');
    await queryInterface.removeColumn('Payouts', 'paidOutsidePlatform');
  }
};
