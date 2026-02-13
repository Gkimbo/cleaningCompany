"use strict";

/**
 * Migration: Add Business Review Fields
 *
 * Adds fields to support dual review system where reviews for employees
 * also appear on their business owner's profile.
 *
 * Fields:
 * - businessOwnerId: The business owner who owns the employee
 * - isBusinessReview: True if this is a copy created for the business profile
 * - sourceReviewId: Links to the original employee review (for business copies)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add businessOwnerId column
      await queryInterface.addColumn(
        "UserReviews",
        "businessOwnerId",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "Users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          comment: "The business owner who owns the reviewed employee",
        },
        { transaction }
      );

      // Add isBusinessReview column
      await queryInterface.addColumn(
        "UserReviews",
        "isBusinessReview",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: "True if this is a copy created for the business profile",
        },
        { transaction }
      );

      // Add sourceReviewId column (self-referential FK)
      await queryInterface.addColumn(
        "UserReviews",
        "sourceReviewId",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "UserReviews",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          comment: "Links to the original employee review (for business copies)",
        },
        { transaction }
      );

      // Add index for efficient business review queries
      await queryInterface.addIndex(
        "UserReviews",
        ["businessOwnerId", "isBusinessReview"],
        {
          name: "idx_user_reviews_business_owner",
          transaction,
        }
      );

      // Add index for finding source reviews
      await queryInterface.addIndex(
        "UserReviews",
        ["sourceReviewId"],
        {
          name: "idx_user_reviews_source",
          transaction,
        }
      );

      await transaction.commit();
      console.log("Migration completed: Added business review fields to UserReviews");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes first
      await queryInterface.removeIndex(
        "UserReviews",
        "idx_user_reviews_source",
        { transaction }
      );

      await queryInterface.removeIndex(
        "UserReviews",
        "idx_user_reviews_business_owner",
        { transaction }
      );

      // Remove columns
      await queryInterface.removeColumn("UserReviews", "sourceReviewId", { transaction });
      await queryInterface.removeColumn("UserReviews", "isBusinessReview", { transaction });
      await queryInterface.removeColumn("UserReviews", "businessOwnerId", { transaction });

      await transaction.commit();
      console.log("Migration reverted: Removed business review fields from UserReviews");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
