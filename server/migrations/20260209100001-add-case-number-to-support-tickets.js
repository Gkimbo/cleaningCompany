"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("SupportTickets", "caseNumber", {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });

    // Add index for case number lookups
    await queryInterface.addIndex("SupportTickets", ["caseNumber"], {
      unique: true,
      name: "support_tickets_case_number_unique",
    });

    // Backfill existing records with case numbers
    const [tickets] = await queryInterface.sequelize.query(
      'SELECT id, "createdAt" FROM "SupportTickets" WHERE "caseNumber" IS NULL ORDER BY id'
    );

    for (const ticket of tickets) {
      const dateStr = new Date(ticket.createdAt)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const paddedId = String(ticket.id).padStart(5, "0");
      const caseNumber = `ST-${dateStr}-${paddedId}`;

      await queryInterface.sequelize.query(
        'UPDATE "SupportTickets" SET "caseNumber" = ? WHERE id = ?',
        {
          replacements: [caseNumber, ticket.id],
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "SupportTickets",
      "support_tickets_case_number_unique"
    );
    await queryInterface.removeColumn("SupportTickets", "caseNumber");
  },
};
