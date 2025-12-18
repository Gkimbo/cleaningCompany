"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Change notifications array to use TEXT instead of VARCHAR(255)
    await queryInterface.changeColumn("Users", "notifications", {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to VARCHAR(255) array
    await queryInterface.changeColumn("Users", "notifications", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });
  },
};
