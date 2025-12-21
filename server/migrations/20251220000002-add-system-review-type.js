'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add system_cancellation_penalty to reviewType ENUM
    // PostgreSQL requires recreating the type or using ALTER TYPE
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_UserReviews_reviewType" ADD VALUE IF NOT EXISTS 'system_cancellation_penalty';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing values from ENUMs easily
    // This would require recreating the entire type which is complex
    // Leaving as no-op for safety
    console.log('Cannot remove ENUM value - manual migration required if needed');
  }
};
