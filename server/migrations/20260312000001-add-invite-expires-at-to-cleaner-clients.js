"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("CleanerClients", "inviteExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Invitation expiration date (7 days from creation)",
    });

    // Set expiration for existing pending invitations (7 days from now)
    // This gives existing invitations a grace period
    await queryInterface.sequelize.query(`
      UPDATE "CleanerClients"
      SET "inviteExpiresAt" = NOW() + INTERVAL '7 days'
      WHERE status = 'pending_invite'
      AND "inviteExpiresAt" IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("CleanerClients", "inviteExpiresAt");
  },
};
