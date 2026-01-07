'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add employeeOfBusinessId field
    await queryInterface.addColumn('Users', 'employeeOfBusinessId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add isMarketplaceCleaner field
    await queryInterface.addColumn('Users', 'isMarketplaceCleaner', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    // Add index on employeeOfBusinessId
    await queryInterface.addIndex('Users', ['employeeOfBusinessId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'employeeOfBusinessId');
    await queryInterface.removeColumn('Users', 'isMarketplaceCleaner');
  }
};
