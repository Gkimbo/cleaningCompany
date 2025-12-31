"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Additional Homeowner reviewing Cleaner aspects
    await queryInterface.addColumn("UserReviews", "attentionToDetail", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "thoroughness", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "respectOfProperty", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "followedInstructions", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    // Additional Cleaner reviewing Homeowner aspects
    await queryInterface.addColumn("UserReviews", "homeCondition", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "respectfulness", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "suppliesAvailable", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "safetyConditions", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove Homeowner reviewing Cleaner aspects
    await queryInterface.removeColumn("UserReviews", "attentionToDetail");
    await queryInterface.removeColumn("UserReviews", "thoroughness");
    await queryInterface.removeColumn("UserReviews", "respectOfProperty");
    await queryInterface.removeColumn("UserReviews", "followedInstructions");

    // Remove Cleaner reviewing Homeowner aspects
    await queryInterface.removeColumn("UserReviews", "homeCondition");
    await queryInterface.removeColumn("UserReviews", "respectfulness");
    await queryInterface.removeColumn("UserReviews", "suppliesAvailable");
    await queryInterface.removeColumn("UserReviews", "safetyConditions");
  },
};
