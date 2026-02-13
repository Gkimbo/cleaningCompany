"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserHomes", "isMarketplaceEnabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment:
        "When true, this home is visible on the marketplace for cleaners to pick up jobs",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("UserHomes", "isMarketplaceEnabled");
  },
};
