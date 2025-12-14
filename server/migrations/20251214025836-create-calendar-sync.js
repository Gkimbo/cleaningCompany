"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CalendarSyncs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserHomes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      platform: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "other",
      },
      icalUrl: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastSyncAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastSyncStatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      lastSyncError: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      syncedEventUids: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },
      autoCreateAppointments: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      daysAfterCheckout: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("CalendarSyncs", ["userId"]);
    await queryInterface.addIndex("CalendarSyncs", ["homeId"]);
    await queryInterface.addIndex("CalendarSyncs", ["isActive"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CalendarSyncs");
  },
};
