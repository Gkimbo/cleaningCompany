"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns to UserReviews table
    await queryInterface.addColumn("UserReviews", "reviewType", {
      type: Sequelize.ENUM("homeowner_to_cleaner", "cleaner_to_homeowner"),
      allowNull: true, // Allow null for existing reviews
    });

    await queryInterface.addColumn("UserReviews", "isPublished", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    // Homeowner reviewing Cleaner aspects
    await queryInterface.addColumn("UserReviews", "cleaningQuality", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "punctuality", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "professionalism", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "communication", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "wouldRecommend", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    // Cleaner reviewing Homeowner aspects
    await queryInterface.addColumn("UserReviews", "accuracyOfDescription", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "homeReadiness", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "easeOfAccess", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserReviews", "wouldWorkForAgain", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    // Public/private comment options
    await queryInterface.addColumn("UserReviews", "privateComment", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Mark existing reviews as published (backwards compatibility)
    await queryInterface.sequelize.query(
      `UPDATE "UserReviews" SET "isPublished" = true WHERE "isPublished" IS NULL OR "isPublished" = false`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("UserReviews", "reviewType");
    await queryInterface.removeColumn("UserReviews", "isPublished");
    await queryInterface.removeColumn("UserReviews", "cleaningQuality");
    await queryInterface.removeColumn("UserReviews", "punctuality");
    await queryInterface.removeColumn("UserReviews", "professionalism");
    await queryInterface.removeColumn("UserReviews", "communication");
    await queryInterface.removeColumn("UserReviews", "wouldRecommend");
    await queryInterface.removeColumn("UserReviews", "accuracyOfDescription");
    await queryInterface.removeColumn("UserReviews", "homeReadiness");
    await queryInterface.removeColumn("UserReviews", "easeOfAccess");
    await queryInterface.removeColumn("UserReviews", "wouldWorkForAgain");
    await queryInterface.removeColumn("UserReviews", "privateComment");

    // Remove ENUM type
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_UserReviews_reviewType";'
    );
  },
};
