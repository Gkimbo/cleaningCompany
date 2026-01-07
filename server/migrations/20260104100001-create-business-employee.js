'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BusinessEmployees', {
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
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      firstName: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      email: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      emailHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending_invite',
      },
      inviteToken: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      inviteExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      invitedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      terminatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      terminationReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      defaultHourlyRate: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      paymentMethod: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'direct_payment',
      },
      stripeConnectAccountId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      stripeConnectOnboarded: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      canViewClientDetails: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      canViewJobEarnings: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      canMessageClients: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
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
    await queryInterface.addIndex('BusinessEmployees', ['businessOwnerId']);
    await queryInterface.addIndex('BusinessEmployees', ['userId']);
    await queryInterface.addIndex('BusinessEmployees', ['emailHash']);
    await queryInterface.addIndex('BusinessEmployees', ['status']);
    await queryInterface.addIndex('BusinessEmployees', ['inviteToken'], { unique: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('BusinessEmployees');
  }
};
