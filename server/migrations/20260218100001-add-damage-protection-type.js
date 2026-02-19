"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'damage_protection' to the enum type
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_TermsAndConditions_type" ADD VALUE IF NOT EXISTS 'damage_protection';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum type
    console.log("Cannot remove enum value - manual intervention required if needed");
  },
};
