"use strict";

/**
 * Migration: Convert CleanerClient.defaultPrice from dollars (DECIMAL) to cents (INTEGER)
 *
 * This migration was missed in the original pricing-to-cents conversion.
 * It converts CleanerClient.defaultPrice from DECIMAL(10, 2) dollars to INTEGER cents.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("Converting CleanerClient.defaultPrice from dollars to cents...");

      // Add new INTEGER column for cents
      await queryInterface.addColumn("CleanerClients", "defaultPriceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      // Convert existing DECIMAL dollars to INTEGER cents
      await queryInterface.sequelize.query(`
        UPDATE "CleanerClients" SET
          "defaultPriceCents" = ROUND("defaultPrice" * 100)
        WHERE "defaultPrice" IS NOT NULL
      `, { transaction });

      // Drop old DECIMAL column
      await queryInterface.removeColumn("CleanerClients", "defaultPrice", { transaction });

      // Rename new column to original name
      await queryInterface.renameColumn("CleanerClients", "defaultPriceCents", "defaultPrice", { transaction });

      await transaction.commit();
      console.log("Migration complete: CleanerClient.defaultPrice converted to cents");

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("Reverting CleanerClient.defaultPrice from cents to dollars...");

      // Add new DECIMAL column for dollars
      await queryInterface.addColumn("CleanerClients", "defaultPriceDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      // Convert INTEGER cents back to DECIMAL dollars
      await queryInterface.sequelize.query(`
        UPDATE "CleanerClients" SET
          "defaultPriceDollars" = "defaultPrice"::NUMERIC / 100
        WHERE "defaultPrice" IS NOT NULL
      `, { transaction });

      // Drop INTEGER column
      await queryInterface.removeColumn("CleanerClients", "defaultPrice", { transaction });

      // Rename back to original name
      await queryInterface.renameColumn("CleanerClients", "defaultPriceDollars", "defaultPrice", { transaction });

      await transaction.commit();
      console.log("Revert complete: CleanerClient.defaultPrice back to dollars");

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
