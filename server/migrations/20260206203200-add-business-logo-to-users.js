'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'businessLogo', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Base64 encoded business logo image (for business owners)',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'businessLogo');
  }
};
