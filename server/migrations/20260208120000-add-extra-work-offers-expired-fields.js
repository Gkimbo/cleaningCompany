"use strict";

/**
 * Migration to add extra work offers expired tracking fields
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("MultiCleanerJobs", "extraWorkOffersExpired", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("MultiCleanerJobs", "extraWorkOffersExpiredAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("MultiCleanerJobs", "extraWorkOffersExpired");
    await queryInterface.removeColumn("MultiCleanerJobs", "extraWorkOffersExpiredAt");
  },
};
