"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("HomeSizeAdjustmentRequests", "caseNumber", {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });

    // Add index for case number lookups
    await queryInterface.addIndex("HomeSizeAdjustmentRequests", ["caseNumber"], {
      unique: true,
      name: "home_size_adjustments_case_number_unique",
    });

    // Backfill existing records with case numbers
    const [adjustments] = await queryInterface.sequelize.query(
      'SELECT id, "createdAt" FROM "HomeSizeAdjustmentRequests" WHERE "caseNumber" IS NULL ORDER BY id'
    );

    for (const adjustment of adjustments) {
      const dateStr = new Date(adjustment.createdAt)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const paddedId = String(adjustment.id).padStart(5, "0");
      const caseNumber = `ADJ-${dateStr}-${paddedId}`;

      await queryInterface.sequelize.query(
        'UPDATE "HomeSizeAdjustmentRequests" SET "caseNumber" = ? WHERE id = ?',
        {
          replacements: [caseNumber, adjustment.id],
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "HomeSizeAdjustmentRequests",
      "home_size_adjustments_case_number_unique"
    );
    await queryInterface.removeColumn("HomeSizeAdjustmentRequests", "caseNumber");
  },
};
