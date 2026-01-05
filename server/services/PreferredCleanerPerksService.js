/**
 * PreferredCleanerPerksService
 * Handles gamification and loyalty perks for preferred cleaners
 */

class PreferredCleanerPerksService {
  /**
   * Get or create a cleaner's perk record
   * @param {number} cleanerId - The cleaner's user ID
   * @param {Object} models - Sequelize models
   * @returns {Object} CleanerPreferredPerks record
   */
  static async getOrCreatePerks(cleanerId, models) {
    const { CleanerPreferredPerks } = models;

    let perks = await CleanerPreferredPerks.findOne({
      where: { cleanerId },
    });

    if (!perks) {
      // Create with default bronze tier
      perks = await CleanerPreferredPerks.create({
        cleanerId,
        tierLevel: "bronze",
        preferredHomeCount: 0,
        bonusPercent: 0,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        lastCalculatedAt: new Date(),
      });
    }

    return perks;
  }

  /**
   * Get the platform's preferred perks configuration
   * @param {Object} models - Sequelize models
   * @returns {Object} PreferredPerksConfig or default config
   */
  static async getPerksConfig(models) {
    const { PreferredPerksConfig } = models;

    let config = await PreferredPerksConfig.findOne({
      order: [["updatedAt", "DESC"]],
    });

    if (!config) {
      // Return default configuration
      return {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };
    }

    return config;
  }

  /**
   * Calculate tier and perks for a home count using config
   * @param {number} homeCount - Number of preferred homes
   * @param {Object} config - PreferredPerksConfig
   * @returns {Object} Tier info with perks
   */
  static calculateTierFromConfig(homeCount, config) {
    if (homeCount >= config.platinumMinHomes) {
      return {
        tier: "platinum",
        bonusPercent: parseFloat(config.platinumBonusPercent),
        fasterPayouts: config.platinumFasterPayouts,
        payoutHours: config.platinumPayoutHours,
        earlyAccess: config.platinumEarlyAccess,
      };
    }

    if (homeCount >= config.goldMinHomes && homeCount <= config.goldMaxHomes) {
      return {
        tier: "gold",
        bonusPercent: parseFloat(config.goldBonusPercent),
        fasterPayouts: config.goldFasterPayouts,
        payoutHours: config.goldPayoutHours,
        earlyAccess: false,
      };
    }

    if (homeCount >= config.silverMinHomes && homeCount <= config.silverMaxHomes) {
      return {
        tier: "silver",
        bonusPercent: parseFloat(config.silverBonusPercent),
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
      };
    }

    return {
      tier: "bronze",
      bonusPercent: parseFloat(config.bronzeBonusPercent || 0),
      fasterPayouts: false,
      payoutHours: 48,
      earlyAccess: false,
    };
  }

  /**
   * Recalculate and update a cleaner's tier based on current preferred home count
   * @param {number} cleanerId - The cleaner's user ID
   * @param {Object} models - Sequelize models
   * @returns {Object} Updated CleanerPreferredPerks record
   */
  static async recalculateTier(cleanerId, models) {
    const { HomePreferredCleaner } = models;

    // Count preferred homes for this cleaner
    const homeCount = await HomePreferredCleaner.count({
      where: { cleanerId },
    });

    // Get platform config
    const config = await this.getPerksConfig(models);

    // Calculate tier
    const tierInfo = this.calculateTierFromConfig(homeCount, config);

    // Get or create perk record
    const perks = await this.getOrCreatePerks(cleanerId, models);

    // Update perk record
    await perks.update({
      tierLevel: tierInfo.tier,
      preferredHomeCount: homeCount,
      bonusPercent: tierInfo.bonusPercent,
      fasterPayouts: tierInfo.fasterPayouts,
      payoutHours: tierInfo.payoutHours,
      earlyAccess: tierInfo.earlyAccess,
      lastCalculatedAt: new Date(),
    });

    return perks;
  }

  /**
   * Check if a cleaner is preferred at a specific home
   * @param {number} cleanerId - The cleaner's user ID
   * @param {number} homeId - The home ID
   * @param {Object} models - Sequelize models
   * @returns {boolean} True if cleaner is preferred at this home
   */
  static async isPreferredAtHome(cleanerId, homeId, models) {
    const { HomePreferredCleaner } = models;

    const preference = await HomePreferredCleaner.findOne({
      where: { cleanerId, homeId },
    });

    return !!preference;
  }

  /**
   * Calculate bonus for a payout on a preferred home job
   * Bonus is applied by reducing the platform fee (giving more to cleaner)
   * @param {number} cleanerId - The cleaner's user ID
   * @param {number} homeId - The home ID for the job
   * @param {number} grossAmountCents - The gross payout amount in cents
   * @param {number} platformFeePercent - Current platform fee percentage
   * @param {Object} models - Sequelize models
   * @returns {Object} { isPreferredJob, bonusApplied, bonusPercent, bonusAmountCents, tierLevel, adjustedPlatformFee, adjustedNetAmount }
   */
  static async calculatePayoutBonus(cleanerId, homeId, grossAmountCents, platformFeePercent, models) {
    // Check if this is a preferred home job
    const isPreferredJob = await this.isPreferredAtHome(cleanerId, homeId, models);

    if (!isPreferredJob) {
      // Not a preferred job, no bonus
      const platformFee = Math.round(grossAmountCents * (platformFeePercent / 100));
      return {
        isPreferredJob: false,
        bonusApplied: false,
        bonusPercent: 0,
        bonusAmountCents: 0,
        tierLevel: null,
        adjustedPlatformFee: platformFee,
        adjustedNetAmount: grossAmountCents - platformFee,
      };
    }

    // Get cleaner's current tier (recalculate to ensure it's current)
    const perks = await this.recalculateTier(cleanerId, models);

    const bonusPercent = parseFloat(perks.bonusPercent) || 0;

    if (bonusPercent <= 0) {
      // Bronze tier or no bonus configured
      const platformFee = Math.round(grossAmountCents * (platformFeePercent / 100));
      return {
        isPreferredJob: true,
        bonusApplied: false,
        bonusPercent: 0,
        bonusAmountCents: 0,
        tierLevel: perks.tierLevel,
        adjustedPlatformFee: platformFee,
        adjustedNetAmount: grossAmountCents - platformFee,
      };
    }

    // Calculate bonus as reduction in platform fee
    // Bonus comes from the platform fee, not from client payment
    const originalPlatformFee = Math.round(grossAmountCents * (platformFeePercent / 100));
    const bonusAmountCents = Math.round(originalPlatformFee * (bonusPercent / 100));
    const adjustedPlatformFee = originalPlatformFee - bonusAmountCents;
    const adjustedNetAmount = grossAmountCents - adjustedPlatformFee;

    return {
      isPreferredJob: true,
      bonusApplied: true,
      bonusPercent,
      bonusAmountCents,
      tierLevel: perks.tierLevel,
      originalPlatformFee,
      adjustedPlatformFee,
      adjustedNetAmount,
    };
  }

  /**
   * Get cleaner's perk status for display
   * @param {number} cleanerId - The cleaner's user ID
   * @param {Object} models - Sequelize models
   * @returns {Object} Perk status info for display
   */
  static async getCleanerPerkStatus(cleanerId, models) {
    const perks = await this.recalculateTier(cleanerId, models);
    const config = await this.getPerksConfig(models);

    // Calculate progress to next tier
    let nextTier = null;
    let homesNeeded = null;

    switch (perks.tierLevel) {
      case "bronze":
        nextTier = "silver";
        homesNeeded = config.silverMinHomes - perks.preferredHomeCount;
        break;
      case "silver":
        nextTier = "gold";
        homesNeeded = config.goldMinHomes - perks.preferredHomeCount;
        break;
      case "gold":
        nextTier = "platinum";
        homesNeeded = config.platinumMinHomes - perks.preferredHomeCount;
        break;
      case "platinum":
        nextTier = null;
        homesNeeded = 0;
        break;
    }

    return {
      cleanerId,
      tier: perks.tierLevel,
      preferredHomeCount: perks.preferredHomeCount,
      bonusPercent: parseFloat(perks.bonusPercent),
      fasterPayouts: perks.fasterPayouts,
      payoutHours: perks.payoutHours,
      earlyAccess: perks.earlyAccess,
      nextTier,
      homesNeededForNextTier: homesNeeded > 0 ? homesNeeded : 0,
      lastCalculatedAt: perks.lastCalculatedAt,
      tierBenefits: this.getTierBenefits(perks.tierLevel, config),
    };
  }

  /**
   * Get benefits description for a tier
   * @param {string} tier - The tier level
   * @param {Object} config - PreferredPerksConfig
   * @returns {Array} List of benefit descriptions
   */
  static getTierBenefits(tier, config) {
    const benefits = [];

    switch (tier) {
      case "platinum":
        benefits.push(`${config.platinumBonusPercent}% bonus on preferred jobs`);
        if (config.platinumFasterPayouts) {
          benefits.push(`Faster payouts (${config.platinumPayoutHours}h)`);
        }
        if (config.platinumEarlyAccess) {
          benefits.push("Early access to new homes");
        }
        break;
      case "gold":
        benefits.push(`${config.goldBonusPercent}% bonus on preferred jobs`);
        if (config.goldFasterPayouts) {
          benefits.push(`Faster payouts (${config.goldPayoutHours}h)`);
        }
        break;
      case "silver":
        benefits.push(`${config.silverBonusPercent}% bonus on preferred jobs`);
        break;
      case "bronze":
        benefits.push("Build your reputation");
        benefits.push("Become preferred at more homes to unlock perks");
        break;
    }

    return benefits;
  }

  /**
   * Get all cleaners at a specific tier
   * @param {string} tier - The tier level to query
   * @param {Object} models - Sequelize models
   * @returns {Array} List of cleaner IDs at this tier
   */
  static async getCleanersByTier(tier, models) {
    const { CleanerPreferredPerks } = models;

    const records = await CleanerPreferredPerks.findAll({
      where: { tierLevel: tier },
      attributes: ["cleanerId", "preferredHomeCount", "lastCalculatedAt"],
    });

    return records;
  }

  /**
   * Recalculate tiers for all cleaners (for use after config changes)
   * @param {Object} models - Sequelize models
   * @returns {Object} Summary of recalculation
   */
  static async recalculateAllTiers(models) {
    const { HomePreferredCleaner, CleanerPreferredPerks } = models;
    const { Op } = require("sequelize");

    // Get all unique cleaners who are preferred somewhere
    const cleanerRecords = await HomePreferredCleaner.findAll({
      attributes: [[models.sequelize.fn("DISTINCT", models.sequelize.col("cleanerId")), "cleanerId"]],
      raw: true,
    });

    const cleanerIds = cleanerRecords.map((r) => r.cleanerId);

    let updated = 0;
    const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

    for (const cleanerId of cleanerIds) {
      const perks = await this.recalculateTier(cleanerId, models);
      tierCounts[perks.tierLevel]++;
      updated++;
    }

    // Also clean up orphaned perk records (cleaners no longer preferred anywhere)
    const orphaned = await CleanerPreferredPerks.update(
      { tierLevel: "bronze", preferredHomeCount: 0, bonusPercent: 0 },
      {
        where: {
          cleanerId: { [Op.notIn]: cleanerIds },
          preferredHomeCount: { [Op.gt]: 0 },
        },
      }
    );

    return {
      totalCleanersUpdated: updated,
      tierDistribution: tierCounts,
      orphanedRecordsReset: orphaned[0],
    };
  }
}

module.exports = PreferredCleanerPerksService;
