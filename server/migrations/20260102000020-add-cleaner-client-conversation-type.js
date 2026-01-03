'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'cleaner-client' to the conversationType ENUM
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'cleaner-client';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing values from ENUMs easily
    // This would require recreating the ENUM type which is complex
    // For safety, we'll leave the enum value in place on rollback
    console.log('Note: cleaner-client value left in enum on rollback');
  }
};
