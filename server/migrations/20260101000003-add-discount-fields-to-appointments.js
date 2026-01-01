"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserAppointments", "discountApplied", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserAppointments", "discountPercent", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: "Discount percentage applied (0.10 = 10% off)",
    });

    await queryInterface.addColumn("UserAppointments", "originalPrice", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Original price before discount was applied",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("UserAppointments", "discountApplied");
    await queryInterface.removeColumn("UserAppointments", "discountPercent");
    await queryInterface.removeColumn("UserAppointments", "originalPrice");
  },
};
