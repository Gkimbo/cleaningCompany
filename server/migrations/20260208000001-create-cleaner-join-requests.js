"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CleanerJoinRequests", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      multiCleanerJobId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "MultiCleanerJobs",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserHomes",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      homeownerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM(
          "pending",
          "approved",
          "declined",
          "auto_approved",
          "expired",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      roomAssignmentIds: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Room IDs tentatively assigned to this cleaner",
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "When the request expires if homeowner does not respond (48 hours)",
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      declineReason: {
        type: Sequelize.TEXT,
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

    // Indexes
    await queryInterface.addIndex("CleanerJoinRequests", ["multiCleanerJobId"]);
    await queryInterface.addIndex("CleanerJoinRequests", ["cleanerId"]);
    await queryInterface.addIndex("CleanerJoinRequests", ["homeownerId"]);
    await queryInterface.addIndex("CleanerJoinRequests", ["status"]);
    await queryInterface.addIndex("CleanerJoinRequests", ["expiresAt"]);

    // Unique constraint: only one pending request per cleaner per job
    await queryInterface.addIndex("CleanerJoinRequests", ["multiCleanerJobId", "cleanerId"], {
      unique: true,
      where: { status: "pending" },
      name: "unique_pending_request_per_cleaner_per_job",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CleanerJoinRequests");
  },
};
