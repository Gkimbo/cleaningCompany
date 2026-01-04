"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CustomJobFlowChecklists", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      customJobFlowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "CustomJobFlows",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      forkedFromPlatformVersion: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "ChecklistVersion.version if forked from platform, NULL if created from scratch",
      },
      snapshotData: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Full checklist structure with sections, items, and per-item notes",
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

    // Index for querying checklist by flow
    await queryInterface.addIndex("CustomJobFlowChecklists", ["customJobFlowId"], {
      name: "idx_custom_job_flow_checklists_flow",
      unique: true, // One checklist per flow
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("CustomJobFlowChecklists", "idx_custom_job_flow_checklists_flow");
    await queryInterface.dropTable("CustomJobFlowChecklists");
  },
};
