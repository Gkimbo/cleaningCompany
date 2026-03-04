"use strict";

/**
 * Migration: Convert all pricing fields from dollars to cents
 *
 * This migration converts:
 * - PricingConfig: All price fields (multiply by 100)
 * - UserAppointments: price, originalPrice, lastMinuteFeeApplied, businessOwnerPrice
 * - RecurringSchedule: price
 * - HomeSizeAdjustmentRequest: originalPrice, calculatedNewPrice, priceDifference
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ============================================
      // 1. PRICINGCONFIG - Convert dollars to cents
      // ============================================
      console.log("Converting PricingConfig to cents...");

      // Multiply all price fields by 100
      await queryInterface.sequelize.query(`
        UPDATE "PricingConfigs" SET
          "basePrice" = "basePrice" * 100,
          "extraBedBathFee" = "extraBedBathFee" * 100,
          "halfBathFee" = "halfBathFee" * 100,
          "sheetFeePerBed" = "sheetFeePerBed" * 100,
          "towelFee" = "towelFee" * 100,
          "faceClothFee" = "faceClothFee" * 100,
          "timeWindowAnytime" = "timeWindowAnytime" * 100,
          "timeWindow10To3" = "timeWindow10To3" * 100,
          "timeWindow11To4" = "timeWindow11To4" * 100,
          "timeWindow12To2" = "timeWindow12To2" * 100,
          "cancellationFee" = "cancellationFee" * 100,
          "highVolumeFee" = "highVolumeFee" * 100,
          "lastMinuteFee" = "lastMinuteFee" * 100
      `, { transaction });

      // ============================================
      // 2. USERAPPOINTMENTS - Convert to cents
      // ============================================
      console.log("Converting UserAppointments prices to cents...");

      // First, add new INTEGER columns for cents
      await queryInterface.addColumn("UserAppointments", "priceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("UserAppointments", "originalPriceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      // Convert existing STRING prices to INTEGER cents
      await queryInterface.sequelize.query(`
        UPDATE "UserAppointments" SET
          "priceCents" = ROUND(CAST("price" AS NUMERIC) * 100),
          "originalPriceCents" = CASE
            WHEN "originalPrice" IS NOT NULL AND "originalPrice" != ''
            THEN ROUND(CAST("originalPrice" AS NUMERIC) * 100)
            ELSE NULL
          END
      `, { transaction });

      // Drop old STRING columns
      await queryInterface.removeColumn("UserAppointments", "price", { transaction });
      await queryInterface.removeColumn("UserAppointments", "originalPrice", { transaction });

      // Rename new columns to original names
      await queryInterface.renameColumn("UserAppointments", "priceCents", "price", { transaction });
      await queryInterface.renameColumn("UserAppointments", "originalPriceCents", "originalPrice", { transaction });

      // Make price NOT NULL (it was required before)
      await queryInterface.changeColumn("UserAppointments", "price", {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      // Convert lastMinuteFeeApplied from dollars to cents (already INTEGER, just multiply)
      await queryInterface.sequelize.query(`
        UPDATE "UserAppointments" SET
          "lastMinuteFeeApplied" = "lastMinuteFeeApplied" * 100
        WHERE "lastMinuteFeeApplied" IS NOT NULL
      `, { transaction });

      // Convert businessOwnerPrice from DECIMAL dollars to INTEGER cents
      await queryInterface.addColumn("UserAppointments", "businessOwnerPriceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "UserAppointments" SET
          "businessOwnerPriceCents" = ROUND("businessOwnerPrice" * 100)
        WHERE "businessOwnerPrice" IS NOT NULL
      `, { transaction });

      await queryInterface.removeColumn("UserAppointments", "businessOwnerPrice", { transaction });
      await queryInterface.renameColumn("UserAppointments", "businessOwnerPriceCents", "businessOwnerPrice", { transaction });

      // ============================================
      // 3. RECURRINGSCHEDULE - Convert to cents
      // ============================================
      console.log("Converting RecurringSchedule prices to cents...");

      await queryInterface.addColumn("RecurringSchedules", "priceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "RecurringSchedules" SET
          "priceCents" = ROUND("price" * 100)
        WHERE "price" IS NOT NULL
      `, { transaction });

      await queryInterface.removeColumn("RecurringSchedules", "price", { transaction });
      await queryInterface.renameColumn("RecurringSchedules", "priceCents", "price", { transaction });

      // ============================================
      // 4. HOMESIZEADJUSTMENTREQUEST - Convert to cents
      // ============================================
      console.log("Converting HomeSizeAdjustmentRequest prices to cents...");

      // Add new INTEGER columns
      await queryInterface.addColumn("HomeSizeAdjustmentRequests", "originalPriceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("HomeSizeAdjustmentRequests", "calculatedNewPriceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("HomeSizeAdjustmentRequests", "priceDifferenceCents", {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      // Convert values
      await queryInterface.sequelize.query(`
        UPDATE "HomeSizeAdjustmentRequests" SET
          "originalPriceCents" = ROUND("originalPrice" * 100),
          "calculatedNewPriceCents" = ROUND("calculatedNewPrice" * 100),
          "priceDifferenceCents" = ROUND("priceDifference" * 100)
      `, { transaction });

      // Drop old columns
      await queryInterface.removeColumn("HomeSizeAdjustmentRequests", "originalPrice", { transaction });
      await queryInterface.removeColumn("HomeSizeAdjustmentRequests", "calculatedNewPrice", { transaction });
      await queryInterface.removeColumn("HomeSizeAdjustmentRequests", "priceDifference", { transaction });

      // Rename new columns
      await queryInterface.renameColumn("HomeSizeAdjustmentRequests", "originalPriceCents", "originalPrice", { transaction });
      await queryInterface.renameColumn("HomeSizeAdjustmentRequests", "calculatedNewPriceCents", "calculatedNewPrice", { transaction });
      await queryInterface.renameColumn("HomeSizeAdjustmentRequests", "priceDifferenceCents", "priceDifference", { transaction });

      // Make columns NOT NULL
      await queryInterface.changeColumn("HomeSizeAdjustmentRequests", "originalPrice", {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn("HomeSizeAdjustmentRequests", "calculatedNewPrice", {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn("HomeSizeAdjustmentRequests", "priceDifference", {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      await transaction.commit();
      console.log("Migration complete: All prices converted to cents");

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ============================================
      // 1. PRICINGCONFIG - Convert cents back to dollars
      // ============================================
      await queryInterface.sequelize.query(`
        UPDATE "PricingConfigs" SET
          "basePrice" = "basePrice" / 100,
          "extraBedBathFee" = "extraBedBathFee" / 100,
          "halfBathFee" = "halfBathFee" / 100,
          "sheetFeePerBed" = "sheetFeePerBed" / 100,
          "towelFee" = "towelFee" / 100,
          "faceClothFee" = "faceClothFee" / 100,
          "timeWindowAnytime" = "timeWindowAnytime" / 100,
          "timeWindow10To3" = "timeWindow10To3" / 100,
          "timeWindow11To4" = "timeWindow11To4" / 100,
          "timeWindow12To2" = "timeWindow12To2" / 100,
          "cancellationFee" = "cancellationFee" / 100,
          "highVolumeFee" = "highVolumeFee" / 100,
          "lastMinuteFee" = "lastMinuteFee" / 100
      `, { transaction });

      // ============================================
      // 2. USERAPPOINTMENTS - Convert cents back to dollars STRING
      // ============================================
      await queryInterface.addColumn("UserAppointments", "priceDollars", {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("UserAppointments", "originalPriceDollars", {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "UserAppointments" SET
          "priceDollars" = CAST("price"::NUMERIC / 100 AS VARCHAR),
          "originalPriceDollars" = CASE
            WHEN "originalPrice" IS NOT NULL
            THEN CAST("originalPrice"::NUMERIC / 100 AS VARCHAR)
            ELSE NULL
          END
      `, { transaction });

      await queryInterface.removeColumn("UserAppointments", "price", { transaction });
      await queryInterface.removeColumn("UserAppointments", "originalPrice", { transaction });
      await queryInterface.renameColumn("UserAppointments", "priceDollars", "price", { transaction });
      await queryInterface.renameColumn("UserAppointments", "originalPriceDollars", "originalPrice", { transaction });

      await queryInterface.changeColumn("UserAppointments", "price", {
        type: Sequelize.STRING,
        allowNull: false,
      }, { transaction });

      // Convert lastMinuteFeeApplied back to dollars
      await queryInterface.sequelize.query(`
        UPDATE "UserAppointments" SET
          "lastMinuteFeeApplied" = "lastMinuteFeeApplied" / 100
        WHERE "lastMinuteFeeApplied" IS NOT NULL
      `, { transaction });

      // Convert businessOwnerPrice back to DECIMAL
      await queryInterface.addColumn("UserAppointments", "businessOwnerPriceDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "UserAppointments" SET
          "businessOwnerPriceDollars" = "businessOwnerPrice"::NUMERIC / 100
        WHERE "businessOwnerPrice" IS NOT NULL
      `, { transaction });

      await queryInterface.removeColumn("UserAppointments", "businessOwnerPrice", { transaction });
      await queryInterface.renameColumn("UserAppointments", "businessOwnerPriceDollars", "businessOwnerPrice", { transaction });

      // ============================================
      // 3. RECURRINGSCHEDULE - Convert back to DECIMAL dollars
      // ============================================
      await queryInterface.addColumn("RecurringSchedules", "priceDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "RecurringSchedules" SET
          "priceDollars" = "price"::NUMERIC / 100
        WHERE "price" IS NOT NULL
      `, { transaction });

      await queryInterface.removeColumn("RecurringSchedules", "price", { transaction });
      await queryInterface.renameColumn("RecurringSchedules", "priceDollars", "price", { transaction });

      // ============================================
      // 4. HOMESIZEADJUSTMENTREQUEST - Convert back to DECIMAL dollars
      // ============================================
      await queryInterface.addColumn("HomeSizeAdjustmentRequests", "originalPriceDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("HomeSizeAdjustmentRequests", "calculatedNewPriceDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn("HomeSizeAdjustmentRequests", "priceDifferenceDollars", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "HomeSizeAdjustmentRequests" SET
          "originalPriceDollars" = "originalPrice"::NUMERIC / 100,
          "calculatedNewPriceDollars" = "calculatedNewPrice"::NUMERIC / 100,
          "priceDifferenceDollars" = "priceDifference"::NUMERIC / 100
      `, { transaction });

      await queryInterface.removeColumn("HomeSizeAdjustmentRequests", "originalPrice", { transaction });
      await queryInterface.removeColumn("HomeSizeAdjustmentRequests", "calculatedNewPrice", { transaction });
      await queryInterface.removeColumn("HomeSizeAdjustmentRequests", "priceDifference", { transaction });

      await queryInterface.renameColumn("HomeSizeAdjustmentRequests", "originalPriceDollars", "originalPrice", { transaction });
      await queryInterface.renameColumn("HomeSizeAdjustmentRequests", "calculatedNewPriceDollars", "calculatedNewPrice", { transaction });
      await queryInterface.renameColumn("HomeSizeAdjustmentRequests", "priceDifferenceDollars", "priceDifference", { transaction });

      await queryInterface.changeColumn("HomeSizeAdjustmentRequests", "originalPrice", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn("HomeSizeAdjustmentRequests", "calculatedNewPrice", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn("HomeSizeAdjustmentRequests", "priceDifference", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      }, { transaction });

      await transaction.commit();

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
