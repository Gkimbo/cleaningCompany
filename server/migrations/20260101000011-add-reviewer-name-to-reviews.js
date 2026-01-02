"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add reviewerName to store the name at time of review creation
    await queryInterface.addColumn("UserReviews", "reviewerName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Backfill existing reviews with reviewer names
    await queryInterface.sequelize.query(`
      UPDATE "UserReviews"
      SET "reviewerName" = CONCAT(u."firstName", ' ', u."lastName")
      FROM "Users" u
      WHERE "UserReviews"."reviewerId" = u.id
      AND "UserReviews"."reviewerName" IS NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("UserReviews", "reviewerName");
  },
};
