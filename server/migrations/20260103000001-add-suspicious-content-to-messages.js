"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Messages", "hasSuspiciousContent", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("Messages", "suspiciousContentTypes", {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Messages", "hasSuspiciousContent");
    await queryInterface.removeColumn("Messages", "suspiciousContentTypes");
  },
};
