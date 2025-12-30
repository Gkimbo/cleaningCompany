"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("UserReviews", "suppliesAvailable");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserReviews", "suppliesAvailable", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },
};
