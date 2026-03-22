"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ITDisputes", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      caseNumber: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true,
      },
      reporterId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      category: {
        type: Sequelize.ENUM(
          // Technical
          "app_crash",
          "login_problem",
          "system_outage",
          "performance_issue",
          // Profile
          "profile_change",
          "account_access",
          "password_reset",
          "data_correction",
          // Billing/Payment
          "billing_error",
          "payment_system_error",
          // Security
          "security_issue",
          "suspicious_activity",
          // Data
          "data_request"
        ),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("submitted", "in_progress", "awaiting_info", "resolved", "closed"),
        allowNull: false,
        defaultValue: "submitted",
      },
      priority: {
        type: Sequelize.ENUM("low", "normal", "high", "critical"),
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
      resolvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      resolvedAt: {
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
      deviceInfo: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      appVersion: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      platform: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      attachments: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
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
    await queryInterface.addIndex("ITDisputes", ["reporterId"]);
    await queryInterface.addIndex("ITDisputes", ["assignedTo"]);
    await queryInterface.addIndex("ITDisputes", ["status"]);
    await queryInterface.addIndex("ITDisputes", ["priority"]);
    await queryInterface.addIndex("ITDisputes", ["category"]);
    await queryInterface.addIndex("ITDisputes", ["caseNumber"]);
    await queryInterface.addIndex("ITDisputes", ["slaDeadline"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ITDisputes");
  },
};
