/**
 * ReferralService - Handles referral business logic
 * Manages referral code generation, validation, tracking, and reward application
 */

const crypto = require("crypto");

class ReferralService {
  /**
   * Generate a unique referral code for a user
   * Format: First 4 chars of first name (uppercase) + 4 random alphanumeric chars
   * Example: "JOHN7X2K"
   * @param {Object} user - User object with firstName
   * @param {Object} models - Sequelize models object
   * @returns {string} Unique referral code
   */
  static async generateReferralCode(user, models) {
    const { User } = models;
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Get first 4 chars of first name, uppercase, padded with X if needed
      const firstName = (user.firstName || "USER").toUpperCase();
      const prefix = firstName.slice(0, 4).padEnd(4, "X");

      // Generate 4 random alphanumeric characters
      // Use 6 bytes to ensure enough alphanumeric chars after filtering base64 special chars
      const randomChars = crypto
        .randomBytes(6)
        .toString("base64")
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase()
        .slice(0, 4);

      const code = prefix + randomChars;

      // Check if code already exists
      const existing = await User.findOne({
        where: { referralCode: code },
      });

      if (!existing) {
        // Update user with the new code
        await User.update(
          { referralCode: code },
          { where: { id: user.id } }
        );
        return code;
      }

      attempts++;
    }

    // Fallback: use user ID in the code
    const fallbackCode = `REF${user.id}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    await User.update(
      { referralCode: fallbackCode },
      { where: { id: user.id } }
    );
    return fallbackCode;
  }

  /**
   * Validate a referral code and determine the program type
   * @param {string} code - Referral code to validate
   * @param {string} referredUserType - Type of user being referred ('homeowner' or 'cleaner')
   * @param {Object} models - Sequelize models object
   * @returns {Object} { valid, referrer, programType, rewards, error, errorCode }
   */
  static async validateReferralCode(code, referredUserType, models) {
    const { User, ReferralConfig } = models;

    if (!code) {
      return {
        valid: false,
        error: "No referral code provided",
        errorCode: "NO_CODE"
      };
    }

    // Validate code format (should be alphanumeric, 6-12 chars)
    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(cleanCode)) {
      return {
        valid: false,
        error: "Invalid code format. Referral codes contain only letters and numbers.",
        errorCode: "INVALID_FORMAT"
      };
    }

    // Find the referrer by code
    const referrer = await User.findOne({
      where: { referralCode: cleanCode },
    });

    if (!referrer) {
      return {
        valid: false,
        error: "This referral code doesn't exist. Please check the code and try again.",
        errorCode: "CODE_NOT_FOUND"
      };
    }

    // Check if the referrer's account is frozen/deactivated
    if (referrer.accountFrozen) {
      return {
        valid: false,
        error: "This referral code is no longer active. The account associated with it has been suspended.",
        errorCode: "ACCOUNT_FROZEN"
      };
    }

    // Get active referral config
    const config = await ReferralConfig.getActive();
    if (!config) {
      return {
        valid: false,
        error: "The referral program is not currently active. Please try again later.",
        errorCode: "PROGRAM_INACTIVE"
      };
    }

    // Determine program type based on referrer and referred user types
    const referrerType = referrer.type || "homeowner"; // null type means homeowner
    let programType;
    let programConfig;

    if (referrerType === "homeowner" || referrerType === null) {
      // Referrer is a client/homeowner
      if (referredUserType === "homeowner") {
        programType = "client_to_client";
        programConfig = {
          enabled: config.clientToClientEnabled,
          referrerReward: config.clientToClientReferrerReward,
          referredReward: config.clientToClientReferredReward,
          cleaningsRequired: config.clientToClientCleaningsRequired,
          rewardType: config.clientToClientRewardType,
          maxPerMonth: config.clientToClientMaxPerMonth,
        };
      } else if (referredUserType === "cleaner") {
        programType = "client_to_cleaner";
        programConfig = {
          enabled: config.clientToCleanerEnabled,
          referrerReward: config.clientToCleanerReferrerReward,
          referredReward: 0,
          cleaningsRequired: config.clientToCleanerCleaningsRequired,
          rewardType: config.clientToCleanerRewardType,
          maxPerMonth: config.clientToCleanerMaxPerMonth,
        };
      }
    } else if (referrerType === "cleaner") {
      // Referrer is a cleaner
      if (referredUserType === "cleaner") {
        programType = "cleaner_to_cleaner";
        programConfig = {
          enabled: config.cleanerToCleanerEnabled,
          referrerReward: config.cleanerToCleanerReferrerReward,
          referredReward: 0,
          cleaningsRequired: config.cleanerToCleanerCleaningsRequired,
          rewardType: config.cleanerToCleanerRewardType,
          maxPerMonth: config.cleanerToCleanerMaxPerMonth,
        };
      } else if (referredUserType === "homeowner") {
        programType = "cleaner_to_client";
        programConfig = {
          enabled: config.cleanerToClientEnabled,
          referrerReward: 0,
          referredReward: 0,
          discountPercent: parseFloat(config.cleanerToClientDiscountPercent),
          minReferrals: config.cleanerToClientMinReferrals,
          rewardType: config.cleanerToClientRewardType,
          maxPerMonth: config.cleanerToClientMaxPerMonth,
        };
      }
    }

    if (!programConfig) {
      return {
        valid: false,
        error: "This referral code cannot be used for your account type.",
        errorCode: "INVALID_COMBINATION"
      };
    }

    if (!programConfig.enabled) {
      // Provide specific message based on program type
      const programNames = {
        client_to_client: "Client-to-Client referral program",
        client_to_cleaner: "Client-to-Cleaner referral program",
        cleaner_to_cleaner: "Cleaner-to-Cleaner referral program",
        cleaner_to_client: "Cleaner-to-Client referral program",
      };
      return {
        valid: false,
        error: `The ${programNames[programType] || "referral program"} is not currently active.`,
        errorCode: "PROGRAM_TYPE_DISABLED"
      };
    }

    // Check monthly limit if set
    if (programConfig.maxPerMonth !== null && programConfig.maxPerMonth > 0) {
      const { Referral } = models;
      const monthlyCount = await Referral.countMonthlyReferrals(referrer.id, programType);
      if (monthlyCount >= programConfig.maxPerMonth) {
        return {
          valid: false,
          error: "This referrer has reached their maximum referrals for this month. Please try again next month or use a different code.",
          errorCode: "MONTHLY_LIMIT_REACHED"
        };
      }
    }

    return {
      valid: true,
      referrer: {
        id: referrer.id,
        firstName: referrer.firstName,
        type: referrerType,
      },
      programType,
      rewards: programConfig,
    };
  }

  /**
   * Create a new referral when a user signs up with a referral code
   * @param {string} referralCode - The referral code used
   * @param {Object} referredUser - The new user who was referred
   * @param {string} programType - The referral program type
   * @param {Object} rewards - The reward configuration snapshot
   * @param {Object} models - Sequelize models object
   * @returns {Object} Created referral record
   */
  static async createReferral(referralCode, referredUser, programType, rewards, models) {
    const { User, Referral } = models;

    // Find the referrer
    const referrer = await User.findOne({
      where: { referralCode: referralCode.toUpperCase() },
    });

    if (!referrer) {
      throw new Error("Invalid referral code");
    }

    // Check if this user was already referred
    const existingReferral = await Referral.findOne({
      where: { referredId: referredUser.id },
    });

    if (existingReferral) {
      throw new Error("User has already been referred");
    }

    // Create the referral record
    const referral = await Referral.create({
      referrerId: referrer.id,
      referredId: referredUser.id,
      referralCode: referralCode.toUpperCase(),
      programType,
      status: "pending",
      cleaningsRequired: rewards.cleaningsRequired || 1,
      cleaningsCompleted: 0,
      referrerRewardAmount: rewards.referrerReward || 0,
      referredRewardAmount: rewards.referredReward || 0,
      referrerRewardType: rewards.rewardType,
      referredRewardType: rewards.rewardType,
    });

    return referral;
  }

  /**
   * Process a completed appointment and update referral progress
   * Called when an appointment is marked as completed
   * @param {number} appointmentId - The completed appointment ID
   * @param {number} userId - The user who completed the appointment
   * @param {Object} models - Sequelize models object
   * @returns {Object|null} Updated referral if qualified, null otherwise
   */
  static async processCompletedAppointment(appointmentId, userId, models) {
    const { Referral, User } = models;

    // Find any pending referrals where this user is the referred party
    const pendingReferral = await Referral.findOne({
      where: {
        referredId: userId,
        status: "pending",
      },
    });

    if (!pendingReferral) {
      return null; // No pending referral for this user
    }

    // Increment completed cleanings
    pendingReferral.cleaningsCompleted += 1;

    // Check if requirements are met
    if (pendingReferral.cleaningsCompleted >= pendingReferral.cleaningsRequired) {
      pendingReferral.status = "qualified";
      pendingReferral.qualifiedAt = new Date();

      // Auto-apply rewards
      await this.applyRewards(pendingReferral, models);
    }

    await pendingReferral.save();
    return pendingReferral;
  }

  /**
   * Apply rewards for a qualified referral
   * @param {Object} referral - The qualified referral record
   * @param {Object} models - Sequelize models object
   */
  static async applyRewards(referral, models) {
    const { User } = models;

    // Apply referrer reward (add to credits)
    if (referral.referrerRewardAmount > 0 && !referral.referrerRewardApplied) {
      const referrer = await User.findByPk(referral.referrerId);
      if (referrer) {
        await User.update(
          { referralCredits: (referrer.referralCredits || 0) + referral.referrerRewardAmount },
          { where: { id: referrer.id } }
        );
        referral.referrerRewardApplied = true;
        referral.referrerRewardAppliedAt = new Date();
      }
    }

    // Apply referred user reward (add to credits)
    if (referral.referredRewardAmount > 0 && !referral.referredRewardApplied) {
      const referred = await User.findByPk(referral.referredId);
      if (referred) {
        await User.update(
          { referralCredits: (referred.referralCredits || 0) + referral.referredRewardAmount },
          { where: { id: referred.id } }
        );
        referral.referredRewardApplied = true;
        referral.referredRewardAppliedAt = new Date();
      }
    }

    // Update status to rewarded
    referral.status = "rewarded";
    await referral.save();
  }

  /**
   * Get available referral credits for a user
   * @param {number} userId - User ID
   * @param {Object} models - Sequelize models object
   * @returns {number} Available credits in cents
   */
  static async getAvailableCredits(userId, models) {
    const { User } = models;
    const user = await User.findByPk(userId);
    return user ? (user.referralCredits || 0) : 0;
  }

  /**
   * Apply referral credits to an appointment
   * @param {number} userId - User ID
   * @param {number} appointmentId - Appointment ID
   * @param {number} amountCents - Amount to apply in cents
   * @param {Object} models - Sequelize models object
   * @returns {Object} { success, amountApplied, remainingCredits }
   */
  static async applyCreditsToAppointment(userId, appointmentId, amountCents, models) {
    const { User, UserAppointments } = models;
    const sequelize = models.sequelize;

    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId, { transaction });
      const appointment = await UserAppointments.findByPk(appointmentId, { transaction });

      if (!user || !appointment) {
        await transaction.rollback();
        return { success: false, error: "User or appointment not found" };
      }

      const availableCredits = user.referralCredits || 0;
      const appointmentPrice = parseInt(appointment.price) * 100; // Convert to cents

      // Calculate how much to apply (can't apply more than available or more than price)
      const maxApplicable = Math.min(availableCredits, appointmentPrice, amountCents);

      if (maxApplicable <= 0) {
        await transaction.rollback();
        return { success: false, error: "No credits available to apply" };
      }

      // Deduct credits from user
      await User.update(
        { referralCredits: availableCredits - maxApplicable },
        { where: { id: userId }, transaction }
      );

      // Update appointment price (store original if not already stored)
      const newPrice = (appointmentPrice - maxApplicable) / 100; // Convert back to dollars
      await UserAppointments.update(
        { price: newPrice.toString() },
        { where: { id: appointmentId }, transaction }
      );

      await transaction.commit();

      return {
        success: true,
        amountApplied: maxApplicable,
        remainingCredits: availableCredits - maxApplicable,
        newPrice,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get user's referral statistics
   * @param {number} userId - User ID
   * @param {Object} models - Sequelize models object
   * @returns {Object} Referral stats
   */
  static async getUserReferralStats(userId, models) {
    const { User, Referral } = models;

    const user = await User.findByPk(userId);
    if (!user) {
      return null;
    }

    const stats = await Referral.getStats(userId);

    return {
      referralCode: user.referralCode,
      availableCredits: user.referralCredits || 0,
      ...stats,
    };
  }

  /**
   * Get all referrals for admin view with filters
   * @param {Object} filters - Filter options { status, programType, startDate, endDate }
   * @param {Object} models - Sequelize models object
   * @returns {Array} List of referrals
   */
  static async getAllReferrals(filters = {}, models) {
    const { Referral } = models;
    const { Op } = models.Sequelize;

    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.programType) {
      where.programType = filters.programType;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    return Referral.findAll({
      where,
      include: [
        { association: "referrer", attributes: ["id", "firstName", "lastName", "email", "type"] },
        { association: "referred", attributes: ["id", "firstName", "lastName", "email", "type"] },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Manually update referral status (for admin use)
   * @param {number} referralId - Referral ID
   * @param {string} newStatus - New status
   * @param {Object} models - Sequelize models object
   * @returns {Object} Updated referral
   */
  static async updateReferralStatus(referralId, newStatus, models) {
    const { Referral } = models;

    const referral = await Referral.findByPk(referralId);
    if (!referral) {
      throw new Error("Referral not found");
    }

    const validStatuses = ["pending", "qualified", "rewarded", "expired", "cancelled"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error("Invalid status");
    }

    referral.status = newStatus;

    // If marking as qualified, set qualifiedAt
    if (newStatus === "qualified" && !referral.qualifiedAt) {
      referral.qualifiedAt = new Date();
    }

    // If marking as rewarded, apply rewards
    if (newStatus === "rewarded" && referral.status !== "rewarded") {
      await this.applyRewards(referral, models);
    }

    await referral.save();
    return referral;
  }

  /**
   * Get current active referral programs for public display
   * @param {Object} models - Sequelize models object
   * @returns {Object} Active programs with reward info
   */
  static async getCurrentPrograms(models) {
    const { ReferralConfig } = models;
    const config = await ReferralConfig.getFormattedConfig();

    if (!config) {
      return { active: false, programs: [] };
    }

    const programs = [];

    if (config.clientToClient.enabled) {
      programs.push({
        type: "client_to_client",
        name: "Refer a Friend",
        description: `Give $${config.clientToClient.referredReward / 100}, Get $${config.clientToClient.referrerReward / 100}`,
        referrerReward: config.clientToClient.referrerReward,
        referredReward: config.clientToClient.referredReward,
        cleaningsRequired: config.clientToClient.cleaningsRequired,
      });
    }

    if (config.clientToCleaner.enabled) {
      programs.push({
        type: "client_to_cleaner",
        name: "Refer a Cleaner",
        description: `Earn $${config.clientToCleaner.referrerReward / 100} when they complete ${config.clientToCleaner.cleaningsRequired} cleaning(s)`,
        referrerReward: config.clientToCleaner.referrerReward,
        cleaningsRequired: config.clientToCleaner.cleaningsRequired,
      });
    }

    if (config.cleanerToCleaner.enabled) {
      programs.push({
        type: "cleaner_to_cleaner",
        name: "Cleaner Referral Bonus",
        description: `Earn $${config.cleanerToCleaner.referrerReward / 100} bonus when your referral completes ${config.cleanerToCleaner.cleaningsRequired} cleaning(s)`,
        referrerReward: config.cleanerToCleaner.referrerReward,
        cleaningsRequired: config.cleanerToCleaner.cleaningsRequired,
      });
    }

    if (config.cleanerToClient.enabled) {
      programs.push({
        type: "cleaner_to_client",
        name: "Cleaner Client Referral",
        description: `Refer ${config.cleanerToClient.minReferrals} clients for a ${config.cleanerToClient.discountPercent}% discount`,
        minReferrals: config.cleanerToClient.minReferrals,
        discountPercent: config.cleanerToClient.discountPercent,
      });
    }

    return {
      active: programs.length > 0,
      programs,
    };
  }
}

module.exports = ReferralService;
