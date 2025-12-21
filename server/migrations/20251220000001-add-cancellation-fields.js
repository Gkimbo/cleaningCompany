'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add account frozen fields to Users table
    await queryInterface.addColumn('Users', 'accountFrozen', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('Users', 'accountFrozenAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'accountFrozenReason', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'accountFrozen');
    await queryInterface.removeColumn('Users', 'accountFrozenAt');
    await queryInterface.removeColumn('Users', 'accountFrozenReason');
  }
};
