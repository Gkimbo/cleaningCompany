"use strict";

/**
 * Migration to add 'payout_reversal' to the Payment type ENUM
 * This is needed to properly track payout reversals when refunds occur
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // For PostgreSQL, we need to add the new value to the existing ENUM type
    // The ENUM type name in Sequelize is typically 'enum_Payments_type'
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Payments_type" ADD VALUE IF NOT EXISTS 'payout_reversal';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Note: PostgreSQL doesn't support removing values from an ENUM type directly
    // To fully reverse this, you would need to:
    // 1. Create a new ENUM type without the value
    // 2. Migrate the column to use the new type
    // 3. Drop the old type
    // This is intentionally left as a no-op since removing ENUM values is complex
    // and payout_reversal records would need to be handled first
    console.log(
      "Note: Removing ENUM values in PostgreSQL requires recreating the type. " +
      "payout_reversal value will remain in the ENUM."
    );
  },
};
