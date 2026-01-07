"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CustomJobFlows", {
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
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "active",
        comment: "active, archived",
      },
      photoRequirement: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "optional",
        comment: "required, optional, hidden",
      },
      jobNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Job-level notes/instructions for employees",
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

    // Index for querying flows by business owner
    await queryInterface.addIndex("CustomJobFlows", ["businessOwnerId"], {
      name: "idx_custom_job_flows_business_owner",
    });

    // Index for finding default flow
    await queryInterface.addIndex("CustomJobFlows", ["businessOwnerId", "isDefault"], {
      name: "idx_custom_job_flows_default",
    });

    // Index for active flows
    await queryInterface.addIndex("CustomJobFlows", ["businessOwnerId", "status"], {
      name: "idx_custom_job_flows_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("CustomJobFlows", "idx_custom_job_flows_status");
    await queryInterface.removeIndex("CustomJobFlows", "idx_custom_job_flows_default");
    await queryInterface.removeIndex("CustomJobFlows", "idx_custom_job_flows_business_owner");
    await queryInterface.dropTable("CustomJobFlows");
  },
};
