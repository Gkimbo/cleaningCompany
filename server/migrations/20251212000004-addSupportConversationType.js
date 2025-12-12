'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // For PostgreSQL, we need to alter the enum type
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'support';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum and table
    // For safety, we'll leave this as a no-op
    console.log('Note: Cannot remove enum value in PostgreSQL without recreating the type');
  },
};
