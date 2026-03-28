"use strict";

/**
 * Migration to add business owner agreement version tracking to Users table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "businessOwnerAgreementAcceptedVersion", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Users", "businessOwnerAgreementAcceptedVersion");
  },
};
