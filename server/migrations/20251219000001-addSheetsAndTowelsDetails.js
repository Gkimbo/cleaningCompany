"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add columns to UserHomes for location fields (when homeowner provides linens)
    await queryInterface.addColumn("UserHomes", "cleanSheetsLocation", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("UserHomes", "dirtySheetsLocation", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("UserHomes", "cleanTowelsLocation", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("UserHomes", "dirtyTowelsLocation", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add columns to UserHomes for bed/bathroom configurations (when company brings linens)
    await queryInterface.addColumn("UserHomes", "bedConfigurations", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("UserHomes", "bathroomConfigurations", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // Add columns to UserAppointments for per-appointment overrides
    await queryInterface.addColumn("UserAppointments", "sheetConfigurations", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("UserAppointments", "towelConfigurations", {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns from UserHomes
    await queryInterface.removeColumn("UserHomes", "cleanSheetsLocation");
    await queryInterface.removeColumn("UserHomes", "dirtySheetsLocation");
    await queryInterface.removeColumn("UserHomes", "cleanTowelsLocation");
    await queryInterface.removeColumn("UserHomes", "dirtyTowelsLocation");
    await queryInterface.removeColumn("UserHomes", "bedConfigurations");
    await queryInterface.removeColumn("UserHomes", "bathroomConfigurations");

    // Remove columns from UserAppointments
    await queryInterface.removeColumn("UserAppointments", "sheetConfigurations");
    await queryInterface.removeColumn("UserAppointments", "towelConfigurations");
  },
};
