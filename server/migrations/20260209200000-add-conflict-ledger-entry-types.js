"use strict";

/**
 * Migration to add conflict_refund and conflict_payout entry types
 * to the JobLedger entryType ENUM.
 *
 * This fixes a bug where ConflictResolutionService.processRefund() and
 * processCleanerPayout() call JobLedgerService with entry types that
 * don't exist in the database ENUM, causing constraint violations.
 */
module.exports = {
  async up(queryInterface) {
    // Add conflict_refund to the enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_JobLedgers_entryType" ADD VALUE IF NOT EXISTS 'conflict_refund';
    `);

    // Add conflict_payout to the enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_JobLedgers_entryType" ADD VALUE IF NOT EXISTS 'conflict_payout';
    `);
  },

  async down() {
    // PostgreSQL doesn't easily support removing enum values
    // Would require recreating the type which is complex with existing data
    // This is safe to leave as-is since unused values don't cause issues
    console.log(
      "Note: PostgreSQL does not support removing enum values. " +
        "conflict_refund and conflict_payout will remain in the enum."
    );
  },
};
