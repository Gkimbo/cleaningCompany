"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First create the ENUM type
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_BusinessEmployees_payType" AS ENUM ('hourly', 'per_job', 'percentage');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add payType column
    await queryInterface.addColumn("BusinessEmployees", "payType", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "hourly",
    });

    // Add defaultJobRate column
    await queryInterface.addColumn("BusinessEmployees", "defaultJobRate", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Add payRate column for percentage
    await queryInterface.addColumn("BusinessEmployees", "payRate", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("BusinessEmployees", "payType");
    await queryInterface.removeColumn("BusinessEmployees", "defaultJobRate");
    await queryInterface.removeColumn("BusinessEmployees", "payRate");
  },
};
