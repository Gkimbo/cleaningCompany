"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("CancellationAppeals", "caseNumber", {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });

    // Add index for case number lookups
    await queryInterface.addIndex("CancellationAppeals", ["caseNumber"], {
      unique: true,
      name: "cancellation_appeals_case_number_unique",
    });

    // Backfill existing records with case numbers
    const [appeals] = await queryInterface.sequelize.query(
      'SELECT id, "createdAt" FROM "CancellationAppeals" WHERE "caseNumber" IS NULL ORDER BY id'
    );

    for (const appeal of appeals) {
      const dateStr = new Date(appeal.createdAt)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const paddedId = String(appeal.id).padStart(5, "0");
      const caseNumber = `APL-${dateStr}-${paddedId}`;

      await queryInterface.sequelize.query(
        'UPDATE "CancellationAppeals" SET "caseNumber" = ? WHERE id = ?',
        {
          replacements: [caseNumber, appeal.id],
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "CancellationAppeals",
      "cancellation_appeals_case_number_unique"
    );
    await queryInterface.removeColumn("CancellationAppeals", "caseNumber");
  },
};
