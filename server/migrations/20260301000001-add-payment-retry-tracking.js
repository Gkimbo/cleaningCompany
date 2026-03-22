"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add payment retry tracking fields to UserAppointments
    await queryInterface.addColumn("UserAppointments", "paymentRetryCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of payment retry attempts made",
    });

    await queryInterface.addColumn("UserAppointments", "paymentFirstFailedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Timestamp of first payment failure (for 2-day auto-cancel window)",
    });

    await queryInterface.addColumn("UserAppointments", "lastPaymentRetryAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Timestamp of last payment retry attempt",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("UserAppointments", "paymentRetryCount");
    await queryInterface.removeColumn("UserAppointments", "paymentFirstFailedAt");
    await queryInterface.removeColumn("UserAppointments", "lastPaymentRetryAt");
  },
};
