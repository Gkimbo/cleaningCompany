"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PaymentDisputes", "caseNumber", {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });

    // Add index for case number lookups
    await queryInterface.addIndex("PaymentDisputes", ["caseNumber"], {
      unique: true,
      name: "payment_disputes_case_number_unique",
    });

    // Backfill existing records with case numbers
    const [disputes] = await queryInterface.sequelize.query(
      'SELECT id, "createdAt" FROM "PaymentDisputes" WHERE "caseNumber" IS NULL ORDER BY id'
    );

    for (const dispute of disputes) {
      const dateStr = new Date(dispute.createdAt)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const paddedId = String(dispute.id).padStart(5, "0");
      const caseNumber = `PD-${dateStr}-${paddedId}`;

      await queryInterface.sequelize.query(
        'UPDATE "PaymentDisputes" SET "caseNumber" = ? WHERE id = ?',
        {
          replacements: [caseNumber, dispute.id],
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "PaymentDisputes",
      "payment_disputes_case_number_unique"
    );
    await queryInterface.removeColumn("PaymentDisputes", "caseNumber");
  },
};
