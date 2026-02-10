"use strict";

/**
 * Migration: Add Employee Review Copy Field
 *
 * Adds isEmployeeReviewCopy field to UserReviews to distinguish
 * review copies created for individual employees when multiple
 * employees complete a business owner's job.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserReviews", "isEmployeeReviewCopy", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this is a copy created for an employee's profile from a multi-employee job",
    });

    // Add index for efficient filtering
    await queryInterface.addIndex("UserReviews", ["isEmployeeReviewCopy"], {
      name: "idx_user_reviews_employee_copy",
    });

    console.log("Migration completed: Added isEmployeeReviewCopy field to UserReviews");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("UserReviews", "idx_user_reviews_employee_copy");
    await queryInterface.removeColumn("UserReviews", "isEmployeeReviewCopy");
    console.log("Migration reverted: Removed isEmployeeReviewCopy field from UserReviews");
  },
};
