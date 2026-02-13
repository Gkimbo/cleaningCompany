'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change photoUrl from VARCHAR(500) to TEXT to store full base64 images
    await queryInterface.changeColumn('HomeSizeAdjustmentPhotos', 'photoUrl', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to VARCHAR(500) - note: this may truncate existing data
    await queryInterface.changeColumn('HomeSizeAdjustmentPhotos', 'photoUrl', {
      type: Sequelize.STRING(500),
      allowNull: false,
    });
  }
};
