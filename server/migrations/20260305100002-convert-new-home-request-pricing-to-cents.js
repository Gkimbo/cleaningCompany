"use strict";

/**
 * Migration: Convert NewHomeRequest price fields from dollars (DECIMAL) to cents (INTEGER)
 *
 * This migration converts:
 * - NewHomeRequest.calculatedPrice from DECIMAL(10, 2) dollars to INTEGER cents
 * - NewHomeRequest.hourlyRate from DECIMAL(10, 2) dollars to INTEGER cents
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("Converting NewHomeRequest price fields from dollars to cents...");

      // Add new INTEGER columns for cents
      await queryInterface.addColumn("NewHomeRequests", "calculatedPriceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("NewHomeRequests", "hourlyRateCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      // Convert existing DECIMAL dollars to INTEGER cents
      await queryInterface.sequelize.query(`
        UPDATE "NewHomeRequests" SET
          "calculatedPriceCents" = ROUND("calculatedPrice" * 100),
          "hourlyRateCents" = ROUND("hourlyRate" * 100)
        WHERE "calculatedPrice" IS NOT NULL OR "hourlyRate" IS NOT NULL
      `, { transaction });

      // Drop old DECIMAL columns
      await queryInterface.removeColumn("NewHomeRequests", "calculatedPrice", { transaction });
      await queryInterface.removeColumn("NewHomeRequests", "hourlyRate", { transaction });

      // Rename new columns to original names
      await queryInterface.renameColumn("NewHomeRequests", "calculatedPriceCents", "calculatedPrice", { transaction });
      await queryInterface.renameColumn("NewHomeRequests", "hourlyRateCents", "hourlyRate", { transaction });

      await transaction.commit();
      console.log("Migration complete: NewHomeRequest price fields converted to cents");

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("Reverting NewHomeRequest price fields from cents to dollars...");

      // Add new DECIMAL columns for dollars
      await queryInterface.addColumn("NewHomeRequests", "calculatedPriceDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("NewHomeRequests", "hourlyRateDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      // Convert INTEGER cents back to DECIMAL dollars
      await queryInterface.sequelize.query(`
        UPDATE "NewHomeRequests" SET
          "calculatedPriceDollars" = "calculatedPrice"::NUMERIC / 100,
          "hourlyRateDollars" = "hourlyRate"::NUMERIC / 100
        WHERE "calculatedPrice" IS NOT NULL OR "hourlyRate" IS NOT NULL
      `, { transaction });

      // Drop INTEGER columns
      await queryInterface.removeColumn("NewHomeRequests", "calculatedPrice", { transaction });
      await queryInterface.removeColumn("NewHomeRequests", "hourlyRate", { transaction });

      // Rename back to original names
      await queryInterface.renameColumn("NewHomeRequests", "calculatedPriceDollars", "calculatedPrice", { transaction });
      await queryInterface.renameColumn("NewHomeRequests", "hourlyRateDollars", "hourlyRate", { transaction });

      await transaction.commit();
      console.log("Revert complete: NewHomeRequest price fields back to dollars");

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
