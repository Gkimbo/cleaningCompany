'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Allow NULL for reviewComment - comments are optional
    await queryInterface.changeColumn('UserReviews', 'reviewComment', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Allow NULL for privateComment - also optional
    await queryInterface.changeColumn('UserReviews', 'privateComment', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to NOT NULL (would need to update existing nulls first)
    await queryInterface.changeColumn('UserReviews', 'reviewComment', {
      type: Sequelize.TEXT,
      allowNull: false,
    });

    await queryInterface.changeColumn('UserReviews', 'privateComment', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },
};
