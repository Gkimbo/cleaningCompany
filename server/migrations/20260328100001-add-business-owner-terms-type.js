"use strict";

/**
 * Migration to add 'business_owner' and 'cleaner_agreement' to the TermsAndConditions type ENUM
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'business_owner' to the existing ENUM type
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_TermsAndConditions_type" ADD VALUE IF NOT EXISTS 'business_owner';
    `);

    // Add 'cleaner_agreement' to the existing ENUM type (if not already added)
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_TermsAndConditions_type" ADD VALUE IF NOT EXISTS 'cleaner_agreement';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL doesn't support removing values from ENUM types easily
    // This would require recreating the type and all dependent columns
    console.log("Cannot remove ENUM value in PostgreSQL - manual intervention required");
  },
};
