"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("AnalyticsEvents", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      eventType: {
        type: Sequelize.ENUM(
          "flow_started",
          "flow_step_completed",
          "flow_abandoned",
          "flow_completed",
          "job_started",
          "job_completed",
          "offline_session_started",
          "offline_session_synced",
          "dispute_created",
          "dispute_resolved",
          "pay_override_applied"
        ),
        allowNull: false,
      },
      eventCategory: {
        type: Sequelize.ENUM(
          "flow_abandonment",
          "job_duration",
          "offline_usage",
          "disputes",
          "pay_override"
        ),
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      sessionId: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      dateOnly: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      hourOfDay: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes for efficient querying
    await queryInterface.addIndex("AnalyticsEvents", ["eventType"]);
    await queryInterface.addIndex("AnalyticsEvents", ["eventCategory"]);
    await queryInterface.addIndex("AnalyticsEvents", ["dateOnly"]);
    await queryInterface.addIndex("AnalyticsEvents", ["userId"]);
    await queryInterface.addIndex("AnalyticsEvents", ["sessionId"]);
    await queryInterface.addIndex("AnalyticsEvents", ["eventCategory", "dateOnly"]);
    await queryInterface.addIndex("AnalyticsEvents", ["eventType", "dateOnly"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("AnalyticsEvents");
  },
};
