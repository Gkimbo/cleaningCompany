"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Payouts", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      stripeTransferId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      grossAmount: {
        type: Sequelize.INTEGER, // Amount in cents (total job price / num cleaners)
        allowNull: false,
      },
      platformFee: {
        type: Sequelize.INTEGER, // 10% platform fee in cents
        allowNull: false,
      },
      netAmount: {
        type: Sequelize.INTEGER, // 90% to cleaner in cents
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending",
        // pending (awaiting job completion), held (payment captured, awaiting release),
        // processing (transfer initiated), completed (transfer successful), failed
      },
      paymentCapturedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      transferInitiatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failureReason: {
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

    // Add indexes for faster lookups
    await queryInterface.addIndex("Payouts", ["appointmentId"]);
    await queryInterface.addIndex("Payouts", ["cleanerId"]);
    await queryInterface.addIndex("Payouts", ["status"]);
    await queryInterface.addIndex("Payouts", ["stripeTransferId"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Payouts");
  },
};
