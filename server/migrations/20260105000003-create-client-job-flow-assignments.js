"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ClientJobFlowAssignments", {
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
      cleanerClientId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "CleanerClients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "Assign flow to all jobs for this client",
      },
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "UserHomes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "Assign flow to all jobs for this specific home",
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

    // Index for finding assignment by client
    await queryInterface.addIndex("ClientJobFlowAssignments", ["businessOwnerId", "cleanerClientId"], {
      name: "idx_client_job_flow_assignments_client",
    });

    // Index for finding assignment by home
    await queryInterface.addIndex("ClientJobFlowAssignments", ["businessOwnerId", "homeId"], {
      name: "idx_client_job_flow_assignments_home",
    });

    // Unique constraint: one flow assignment per client
    await queryInterface.addIndex("ClientJobFlowAssignments", ["cleanerClientId"], {
      name: "idx_client_job_flow_assignments_unique_client",
      unique: true,
      where: { cleanerClientId: { [Sequelize.Op.ne]: null } },
    });

    // Unique constraint: one flow assignment per home
    await queryInterface.addIndex("ClientJobFlowAssignments", ["homeId"], {
      name: "idx_client_job_flow_assignments_unique_home",
      unique: true,
      where: { homeId: { [Sequelize.Op.ne]: null } },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ClientJobFlowAssignments", "idx_client_job_flow_assignments_unique_home");
    await queryInterface.removeIndex("ClientJobFlowAssignments", "idx_client_job_flow_assignments_unique_client");
    await queryInterface.removeIndex("ClientJobFlowAssignments", "idx_client_job_flow_assignments_home");
    await queryInterface.removeIndex("ClientJobFlowAssignments", "idx_client_job_flow_assignments_client");
    await queryInterface.dropTable("ClientJobFlowAssignments");
  },
};
