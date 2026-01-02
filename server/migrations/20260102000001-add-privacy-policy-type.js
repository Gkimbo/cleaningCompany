"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'privacy_policy' to the existing ENUM type
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_TermsAndConditions_type" ADD VALUE IF NOT EXISTS 'privacy_policy';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing values from ENUM types easily
    // This would require recreating the type and table, so we'll leave it as is
    console.log("Cannot remove ENUM value in PostgreSQL - skipping");
  },
};
