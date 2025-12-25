'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'internal' conversation type for owner-HR messaging
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'internal';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum and table
    console.log('Note: Cannot remove enum value in PostgreSQL without recreating the type');
  },
};
