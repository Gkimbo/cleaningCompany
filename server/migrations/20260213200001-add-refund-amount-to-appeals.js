"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add refundAmount column to track refund amounts for dispute resolution
    await queryInterface.addColumn("CancellationAppeals", "refundAmount", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Amount in cents that was refunded as part of appeal resolution",
    });

    // Add index for reporting/analytics on refund amounts
    await queryInterface.addIndex("CancellationAppeals", ["refundAmount"], {
      name: "idx_appeals_refund_amount",
      where: {
        refundAmount: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("CancellationAppeals", "idx_appeals_refund_amount");
    await queryInterface.removeColumn("CancellationAppeals", "refundAmount");
  },
};
