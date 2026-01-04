"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserHomes", "isSetupComplete", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true, // Existing homes are assumed complete
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("UserHomes", "isSetupComplete");
  },
};
