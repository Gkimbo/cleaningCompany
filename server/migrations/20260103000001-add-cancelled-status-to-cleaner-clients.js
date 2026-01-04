"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'cancelled' to the status enum for CleanerClients
    // This allows business owners to cancel pending invitations
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_CleanerClients_status" ADD VALUE IF NOT EXISTS 'cancelled';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing values from ENUMs easily
    // To fully reverse this, you would need to:
    // 1. Create a new enum type without 'cancelled'
    // 2. Update the column to use the new type
    // 3. Drop the old type
    // For simplicity, we leave this as a no-op
  },
};
