'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('EmployeeBonuses', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      businessOwnerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      employeeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      businessEmployeeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'BusinessEmployees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Bonus amount in cents',
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      paidNote: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add indexes for common queries
    await queryInterface.addIndex('EmployeeBonuses', ['businessOwnerId']);
    await queryInterface.addIndex('EmployeeBonuses', ['employeeId']);
    await queryInterface.addIndex('EmployeeBonuses', ['businessEmployeeId']);
    await queryInterface.addIndex('EmployeeBonuses', ['status']);
    await queryInterface.addIndex('EmployeeBonuses', ['businessOwnerId', 'status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('EmployeeBonuses');
  }
};
