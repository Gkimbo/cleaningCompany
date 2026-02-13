"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SupportTickets", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      conversationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Conversations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reporterId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      subjectUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      subjectType: {
        type: Sequelize.ENUM("cleaner", "homeowner", "general"),
        allowNull: true,
      },
      category: {
        type: Sequelize.ENUM(
          "account_issue",
          "behavior_concern",
          "service_complaint",
          "billing_question",
          "technical_issue",
          "policy_violation",
          "other"
        ),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("submitted", "under_review", "pending_info", "resolved", "closed"),
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
    await queryInterface.addIndex("SupportTickets", ["conversationId"]);
    await queryInterface.addIndex("SupportTickets", ["reporterId"]);
    await queryInterface.addIndex("SupportTickets", ["subjectUserId"]);
    await queryInterface.addIndex("SupportTickets", ["status"]);
    await queryInterface.addIndex("SupportTickets", ["priority"]);
    await queryInterface.addIndex("SupportTickets", ["category"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("SupportTickets");
  },
};
