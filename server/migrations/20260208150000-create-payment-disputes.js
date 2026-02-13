"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PaymentDisputes", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      payoutId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Payouts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "UserAppointments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      issueType: {
        type: Sequelize.ENUM("missing_payout", "wrong_amount", "delayed_payout"),
        allowNull: false,
      },
      expectedAmount: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      receivedAmount: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("submitted", "under_review", "resolved", "denied"),
        allowNull: false,
        defaultValue: "submitted",
      },
      priority: {
        type: Sequelize.ENUM("normal", "high", "urgent"),
        allowNull: false,
        defaultValue: "normal",
      },
      assignedTo: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      assignedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reviewedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resolution: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      resolutionNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      slaDeadline: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      submittedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      closedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes for common queries
    await queryInterface.addIndex("PaymentDisputes", ["cleanerId"]);
    await queryInterface.addIndex("PaymentDisputes", ["appointmentId"]);
    await queryInterface.addIndex("PaymentDisputes", ["status"]);
    await queryInterface.addIndex("PaymentDisputes", ["payoutId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("PaymentDisputes");
  },
};
