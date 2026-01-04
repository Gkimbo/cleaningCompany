"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CleanerJobCompletions", {
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
      multiCleanerJobId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "MultiCleanerJobs",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      checklistProgress: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: "Progress per section: {sectionKey: {completed: [], total: []}}",
      },
      photosSubmitted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      beforePhotoCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      afterPhotoCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      payoutId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Payouts",
          key: "id",
        },
        onDelete: "SET NULL",
      },
      actualMinutesWorked: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Actual time spent cleaning",
      },
      status: {
        type: Sequelize.ENUM(
          "assigned",
          "started",
          "completed",
          "dropped_out",
          "no_show"
        ),
        allowNull: false,
        defaultValue: "assigned",
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
    await queryInterface.addIndex("CleanerJobCompletions", ["appointmentId"]);
    await queryInterface.addIndex("CleanerJobCompletions", ["cleanerId"]);
    await queryInterface.addIndex("CleanerJobCompletions", ["multiCleanerJobId"]);
    await queryInterface.addIndex("CleanerJobCompletions", ["status"]);

    // Unique constraint: one completion record per cleaner per appointment
    await queryInterface.addIndex("CleanerJobCompletions", ["appointmentId", "cleanerId"], {
      unique: true,
      name: "unique_cleaner_appointment_completion",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CleanerJobCompletions");
  },
};
