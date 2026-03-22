"use strict";

const EncryptionService = require("../services/EncryptionService");

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add invitedEmailHash column
    await queryInterface.addColumn("CleanerClients", "invitedEmailHash", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Hash of invitedEmail for searching (since invitedEmail is encrypted)",
    });

    // Populate hash for existing records
    // First, get all records with their encrypted emails
    const [records] = await queryInterface.sequelize.query(
      `SELECT id, "invitedEmail" FROM "CleanerClients" WHERE "invitedEmail" IS NOT NULL`
    );

    // Update each record with the email hash
    for (const record of records) {
      try {
        // Decrypt the email first
        const decryptedEmail = EncryptionService.decrypt(record.invitedEmail);
        if (decryptedEmail) {
          // Create hash of the lowercase email
          const emailHash = EncryptionService.hash(decryptedEmail.toLowerCase());
          await queryInterface.sequelize.query(
            `UPDATE "CleanerClients" SET "invitedEmailHash" = :hash WHERE id = :id`,
            {
              replacements: { hash: emailHash, id: record.id },
            }
          );
        }
      } catch (err) {
        console.warn(`Failed to hash email for CleanerClient ${record.id}:`, err.message);
      }
    }

    // Add index for faster lookups
    await queryInterface.addIndex("CleanerClients", ["cleanerId", "invitedEmailHash"], {
      name: "cleaner_clients_cleaner_email_hash_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("CleanerClients", "cleaner_clients_cleaner_email_hash_idx");
    await queryInterface.removeColumn("CleanerClients", "invitedEmailHash");
  },
};
