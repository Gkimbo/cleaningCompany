'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HomeSizeAdjustmentRequests', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'UserAppointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'UserHomes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      homeownerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      originalNumBeds: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      originalNumBaths: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      originalPrice: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Original price in cents",
      },
      reportedNumBeds: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      reportedNumBaths: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      calculatedNewPrice: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Calculated new price in cents",
      },
      priceDifference: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Price difference in cents",
      },
      status: {
        type: Sequelize.ENUM(
          'pending_homeowner',
          'approved',
          'denied',
          'pending_owner',
          'owner_approved',
          'owner_denied',
          'expired'
        ),
        allowNull: false,
        defaultValue: 'pending_homeowner',
      },
      cleanerNote: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      homeownerResponse: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ownerNote: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ownerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
      },
      chargePaymentIntentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      chargeStatus: {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed', 'waived'),
        allowNull: true,
      },
      homeownerRespondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ownerResolvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes for common queries
    await queryInterface.addIndex('HomeSizeAdjustmentRequests', ['appointmentId']);
    await queryInterface.addIndex('HomeSizeAdjustmentRequests', ['homeownerId', 'status']);
    await queryInterface.addIndex('HomeSizeAdjustmentRequests', ['status', 'expiresAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('HomeSizeAdjustmentRequests');
  },
};
