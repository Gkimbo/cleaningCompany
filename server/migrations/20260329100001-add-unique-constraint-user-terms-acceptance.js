"use strict";

/**
 * Migration: Add unique constraint on (userId, termsId) in UserTermsAcceptances
 *
 * This prevents duplicate acceptance records when users rapidly click "Accept"
 * or in race condition scenarios.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, remove any existing duplicates (keep only the earliest acceptance per user/terms combo)
    await queryInterface.sequelize.query(`
      DELETE FROM "UserTermsAcceptances" a
      USING "UserTermsAcceptances" b
      WHERE a.id > b.id
        AND a."userId" = b."userId"
        AND a."termsId" = b."termsId"
    `);

    // Add the unique constraint
    await queryInterface.addIndex("UserTermsAcceptances", ["userId", "termsId"], {
      unique: true,
      name: "user_terms_acceptance_unique",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("UserTermsAcceptances", "user_terms_acceptance_unique");
  },
};
