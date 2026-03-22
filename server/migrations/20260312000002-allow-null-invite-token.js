"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Allow inviteToken to be null (cleared after acceptance for security)
    await queryInterface.changeColumn("CleanerClients", "inviteToken", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Note: This down migration may fail if there are null values
    await queryInterface.changeColumn("CleanerClients", "inviteToken", {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    });
  },
};
