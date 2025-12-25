"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'onHold' to the status enum for UserPendingRequests
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_UserPendingRequests_status" ADD VALUE 'onHold';`
    );
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum type and updating the column
    // For safety, we leave the enum value in place
  },
};
