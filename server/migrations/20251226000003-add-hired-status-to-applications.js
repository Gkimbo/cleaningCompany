"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'hired' to the status enum for UserApplications
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_UserApplications_status" ADD VALUE IF NOT EXISTS 'hired';`
    );
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing values from enums directly
    // To truly revert, you would need to recreate the enum without 'hired'
    // This is left as a no-op for safety
    console.log("Note: Cannot remove enum value 'hired' from PostgreSQL enum. Manual intervention required if needed.");
  },
};
