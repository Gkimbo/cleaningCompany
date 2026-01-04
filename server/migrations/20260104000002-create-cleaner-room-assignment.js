"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CleanerRoomAssignments", {
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
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "SET NULL",
        comment: "Null if room not yet assigned to a cleaner",
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
      roomType: {
        type: Sequelize.ENUM(
          "bedroom",
          "bathroom",
          "kitchen",
          "living_room",
          "dining_room",
          "other"
        ),
        allowNull: false,
      },
      roomNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "e.g., Bedroom 1, Bathroom 2",
      },
      roomLabel: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "e.g., Master Bedroom, Guest Bath",
      },
      estimatedMinutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Estimated time to clean this room",
      },
      status: {
        type: Sequelize.ENUM("pending", "in_progress", "completed"),
        allowNull: false,
        defaultValue: "pending",
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cleanerEarningsShare: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Pre-calculated earnings share for this room assignment in cents",
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

    // Indexes for efficient queries
    await queryInterface.addIndex("CleanerRoomAssignments", ["multiCleanerJobId"]);
    await queryInterface.addIndex("CleanerRoomAssignments", ["cleanerId"]);
    await queryInterface.addIndex("CleanerRoomAssignments", ["appointmentId"]);
    await queryInterface.addIndex("CleanerRoomAssignments", ["status"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CleanerRoomAssignments");
  },
};
