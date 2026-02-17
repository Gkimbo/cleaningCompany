"use strict";

/**
 * Migration to add 'payment_terms' to the TermsAndConditions type ENUM
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'payment_terms' to the existing ENUM type
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_TermsAndConditions_type" ADD VALUE IF NOT EXISTS 'payment_terms';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL doesn't support removing values from ENUM types easily
    // This would require recreating the type and all dependent columns
    console.log("Cannot remove ENUM value in PostgreSQL - manual intervention required");
  },
};
