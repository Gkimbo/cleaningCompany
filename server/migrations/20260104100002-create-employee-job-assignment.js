'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('EmployeeJobAssignments', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      businessEmployeeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'BusinessEmployees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'UserAppointments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      assignedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      assignedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'assigned',
      },
      payAmount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      payType: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'flat_rate',
      },
      hoursWorked: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      payAdjustmentReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isSelfAssignment: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      payoutId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Payouts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      payoutStatus: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'pending',
      },
      paidOutsidePlatformAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      paidOutsidePlatformNote: {
        type: Sequelize.TEXT,
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

    // Add indexes
    await queryInterface.addIndex('EmployeeJobAssignments', ['businessEmployeeId']);
    await queryInterface.addIndex('EmployeeJobAssignments', ['appointmentId']);
    await queryInterface.addIndex('EmployeeJobAssignments', ['businessOwnerId']);
    await queryInterface.addIndex('EmployeeJobAssignments', ['status']);
    await queryInterface.addIndex('EmployeeJobAssignments', ['payoutStatus']);
    await queryInterface.addIndex('EmployeeJobAssignments', ['isSelfAssignment']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('EmployeeJobAssignments');
  }
};
