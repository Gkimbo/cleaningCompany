"use strict";

/**
 * Migration to add paymentTermsAcceptedVersion column to Users table
 * This tracks which version of the Payment Terms each user has accepted
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "paymentTermsAcceptedVersion", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Users", "paymentTermsAcceptedVersion");
  },
};
