/**
 * IncentiveService
 *
 * Handles incentive eligibility checks and calculations for:
 * - New cleaners (reduced/eliminated platform fees)
 * - New homeowners (percentage discount on appointments)
 */

const { IncentiveConfig, User, UserAppointments, Payout } = require("../models");
const { Op } = require("sequelize");

class IncentiveService {
  /**
   * Check if a cleaner is eligible for reduced platform fees.
   * Eligibility is based on:
   * - Account created within X days (configured in IncentiveConfig)
   * - Has fewer than Y completed cleanings (configured in IncentiveConfig)
   *
   * @param {number} cleanerId - The cleaner's user ID
   * @returns {Object} { eligible, remainingCleanings, feeReductionPercent, config }
   */
  static async isCleanerEligible(cleanerId) {
    const config = await IncentiveConfig.getActive();

    // No active config or cleaner incentive disabled
    if (!config || !config.cleanerIncentiveEnabled) {
      return {
        eligible: false,
        remainingCleanings: 0,
        feeReductionPercent: 0,
        config: null,
      };
    }

    // Get cleaner's account creation date
    const cleaner = await User.findByPk(cleanerId);
    if (!cleaner) {
      return {
        eligible: false,
        remainingCleanings: 0,
        feeReductionPercent: 0,
        config: null,
      };
    }

    // Check if account was created within eligibility window
    const accountAge = Math.floor(
      (Date.now() - new Date(cleaner.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (accountAge > config.cleanerEligibilityDays) {
      return {
        eligible: false,
        remainingCleanings: 0,
        feeReductionPercent: 0,
        config: null,
        reason: "Account too old",
      };
    }

    // Count completed cleanings for this cleaner
    const completedCleanings = await Payout.count({
      where: {
        cleanerId,
        status: "completed",
      },
    });

    const remainingCleanings = Math.max(0, config.cleanerMaxCleanings - completedCleanings);
    const eligible = remainingCleanings > 0;

    return {
      eligible,
      remainingCleanings,
      completedCleanings,
      feeReductionPercent: eligible ? parseFloat(config.cleanerFeeReductionPercent) : 0,
      config: {
        maxCleanings: config.cleanerMaxCleanings,
        eligibilityDays: config.cleanerEligibilityDays,
        feeReductionPercent: parseFloat(config.cleanerFeeReductionPercent),
      },
    };
  }

  /**
   * Check if a homeowner is eligible for discounted appointments.
   * Eligibility is based on completed appointments count.
   *
   * @param {number} userId - The homeowner's user ID
   * @returns {Object} { eligible, remainingCleanings, discountPercent, config }
   */
  static async isHomeownerEligible(userId) {
    const config = await IncentiveConfig.getActive();

    // No active config or homeowner incentive disabled
    if (!config || !config.homeownerIncentiveEnabled) {
      return {
        eligible: false,
        remainingCleanings: 0,
        discountPercent: 0,
        config: null,
      };
    }

    // Count completed appointments for this homeowner
    const completedAppointments = await UserAppointments.count({
      where: {
        userId,
        completed: true,
      },
    });

    const remainingCleanings = Math.max(0, config.homeownerMaxCleanings - completedAppointments);
    const eligible = remainingCleanings > 0;

    return {
      eligible,
      remainingCleanings,
      completedAppointments,
      discountPercent: eligible ? parseFloat(config.homeownerDiscountPercent) : 0,
      config: {
        maxCleanings: config.homeownerMaxCleanings,
        discountPercent: parseFloat(config.homeownerDiscountPercent),
      },
    };
  }

  /**
   * Calculate the adjusted platform fee for a cleaner payout.
   *
   * @param {number} cleanerId - The cleaner's user ID
   * @param {number} grossAmountCents - The gross amount in cents
   * @param {number} standardFeePercent - The standard platform fee percent (e.g., 0.10)
   * @returns {Object} { platformFee, netAmount, incentiveApplied, originalPlatformFee }
   */
  static async calculateCleanerFee(cleanerId, grossAmountCents, standardFeePercent) {
    const eligibility = await this.isCleanerEligible(cleanerId);

    const originalPlatformFee = Math.round(grossAmountCents * standardFeePercent);

    if (!eligibility.eligible) {
      return {
        platformFee: originalPlatformFee,
        netAmount: grossAmountCents - originalPlatformFee,
        incentiveApplied: false,
        originalPlatformFee: null,
      };
    }

    // Apply fee reduction
    const feeReduction = eligibility.feeReductionPercent; // e.g., 1.0 = 100% reduction
    const reducedFeePercent = standardFeePercent * (1 - feeReduction);
    const platformFee = Math.round(grossAmountCents * reducedFeePercent);
    const netAmount = grossAmountCents - platformFee;

    return {
      platformFee,
      netAmount,
      incentiveApplied: true,
      originalPlatformFee,
    };
  }

  /**
   * Calculate the discounted price for a homeowner appointment.
   *
   * @param {number} userId - The homeowner's user ID
   * @param {number} originalPrice - The original price (as a number)
   * @returns {Object} { finalPrice, discountApplied, discountPercent, originalPrice }
   */
  static async calculateHomeownerPrice(userId, originalPrice) {
    const eligibility = await this.isHomeownerEligible(userId);

    if (!eligibility.eligible) {
      return {
        finalPrice: originalPrice,
        discountApplied: false,
        discountPercent: null,
        originalPrice: null,
      };
    }

    // Apply discount
    const discountPercent = eligibility.discountPercent;
    const discountAmount = originalPrice * discountPercent;
    const finalPrice = Math.round((originalPrice - discountAmount) * 100) / 100; // Round to 2 decimal places

    return {
      finalPrice,
      discountApplied: true,
      discountPercent,
      originalPrice: originalPrice.toString(),
    };
  }
}

module.exports = IncentiveService;
