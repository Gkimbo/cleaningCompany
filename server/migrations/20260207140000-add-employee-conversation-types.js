'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new conversation types for employee messaging
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'employee_group';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'employee_broadcast';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'employee_peer';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Conversations_conversationType" ADD VALUE IF NOT EXISTS 'job_chat';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    console.log('Cannot remove enum values - PostgreSQL limitation');
  }
};
