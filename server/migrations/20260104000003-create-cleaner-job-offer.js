"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CleanerJobOffers", {
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
        allowNull: false,
        references: {
          model: "Users",
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
      offerType: {
        type: Sequelize.ENUM("primary_invite", "market_open", "urgent_fill"),
        allowNull: false,
        defaultValue: "market_open",
      },
      status: {
        type: Sequelize.ENUM("pending", "accepted", "declined", "expired", "withdrawn"),
        allowNull: false,
        defaultValue: "pending",
      },
      earningsOffered: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Upfront earnings display in cents",
      },
      roomsOffered: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Array of room assignment IDs or room details",
      },
      offeredAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When the offer expires if not responded to",
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
    await queryInterface.addIndex("CleanerJobOffers", ["multiCleanerJobId"]);
    await queryInterface.addIndex("CleanerJobOffers", ["cleanerId"]);
    await queryInterface.addIndex("CleanerJobOffers", ["status"]);
    await queryInterface.addIndex("CleanerJobOffers", ["expiresAt"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CleanerJobOffers");
  },
};
