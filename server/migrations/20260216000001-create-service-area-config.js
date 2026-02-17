"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ServiceAreaConfigs", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      mode: {
        type: Sequelize.ENUM("list", "radius"),
        allowNull: false,
        defaultValue: "list",
      },
      // List mode fields
      cities: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },
      states: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },
      zipcodes: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },
      // Radius mode fields
      centerAddress: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      centerLatitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      centerLongitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      radiusMiles: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 25.0,
      },
      // Common fields
      outsideAreaMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: "We don't currently service this area. We're expanding soon!",
      },
      // Audit fields
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      changeNote: {
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

    // Add indexes
    await queryInterface.addIndex("ServiceAreaConfigs", ["isActive"]);
    await queryInterface.addIndex("ServiceAreaConfigs", ["mode"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ServiceAreaConfigs");
  },
};
