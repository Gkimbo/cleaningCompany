'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'business_employee' to the conversationType enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'business_employee';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum type, which is complex
    // For rollback, we'll leave the enum value in place
    console.log('Cannot remove enum value - PostgreSQL limitation');
  }
};
