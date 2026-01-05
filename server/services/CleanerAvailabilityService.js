/**
 * CleanerAvailabilityService
 * Handles cleaner availability checks and overbooking prevention
 */

const { Op } = require("sequelize");

// Default platform limits (can be overridden by owner config)
const PLATFORM_DEFAULTS = {
  maxDailyJobs: 5,
  maxConcurrentJobs: 3,
};

class CleanerAvailabilityService {
  /**
   * Check if a cleaner can accept a job on a specific date
   * @param {number} cleanerId - The cleaner's user ID
   * @param {string} date - The date (YYYY-MM-DD)
   * @param {Object} models - Sequelize models
   * @param {Object} platformConfig - Optional platform config override
   * @returns {Object} { canBook, reason, existingJobCount, maxAllowed }
   */
  static async checkAvailability(cleanerId, date, models, platformConfig = null) {
    const { CleanerAvailabilityConfig, UserAppointments, PreferredPerksConfig } = models;

    // Get platform defaults from config (if available) or use hardcoded defaults
    let platformMaxDaily = PLATFORM_DEFAULTS.maxDailyJobs;
    let platformMaxConcurrent = PLATFORM_DEFAULTS.maxConcurrentJobs;

    if (PreferredPerksConfig) {
      try {
        const config = await PreferredPerksConfig.findOne();
        if (config) {
          platformMaxDaily = config.platformMaxDailyJobs || PLATFORM_DEFAULTS.maxDailyJobs;
          platformMaxConcurrent = config.platformMaxConcurrentJobs || PLATFORM_DEFAULTS.maxConcurrentJobs;
        }
      } catch (err) {
        console.log("[CleanerAvailability] PreferredPerksConfig not found, using defaults");
      }
    }

    // Get cleaner's personal config (if any)
    let cleanerConfig = null;
    if (CleanerAvailabilityConfig) {
      cleanerConfig = await CleanerAvailabilityConfig.findOne({
        where: { cleanerId },
      });
    }

    // Check blackout dates
    if (cleanerConfig?.blackoutDates?.length > 0) {
      const dateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];
      if (cleanerConfig.blackoutDates.includes(dateStr)) {
        return {
          canBook: false,
          reason: "Cleaner is unavailable on this date (blackout date)",
          existingJobCount: 0,
          maxAllowed: 0,
        };
      }
    }

    // Calculate effective max (cleaner can lower but not exceed platform max)
    const effectiveMaxDaily = cleanerConfig?.maxDailyJobs
      ? Math.min(cleanerConfig.maxDailyJobs, platformMaxDaily)
      : platformMaxDaily;

    // Count existing jobs for this date
    const existingJobCount = await UserAppointments.count({
      where: {
        date,
        [Op.or]: [
          { employeesAssigned: { [Op.contains]: [cleanerId.toString()] } },
          { bookedByCleanerId: cleanerId },
        ],
        // Exclude cancelled/completed appointments
        completed: false,
      },
    });

    if (existingJobCount >= effectiveMaxDaily) {
      return {
        canBook: false,
        reason: `Cleaner has reached maximum jobs for this date (${existingJobCount}/${effectiveMaxDaily})`,
        existingJobCount,
        maxAllowed: effectiveMaxDaily,
      };
    }

    return {
      canBook: true,
      reason: null,
      existingJobCount,
      maxAllowed: effectiveMaxDaily,
    };
  }

  /**
   * Get or create cleaner availability config
   * @param {number} cleanerId - The cleaner's user ID
   * @param {Object} models - Sequelize models
   * @returns {Object} The cleaner's availability config
   */
  static async getCleanerConfig(cleanerId, models) {
    const { CleanerAvailabilityConfig } = models;

    let config = await CleanerAvailabilityConfig.findOne({
      where: { cleanerId },
    });

    if (!config) {
      // Return defaults without creating a record
      return {
        cleanerId,
        maxDailyJobs: null,
        maxConcurrentJobs: null,
        blackoutDates: [],
      };
    }

    return config;
  }

  /**
   * Update cleaner availability config
   * @param {number} cleanerId - The cleaner's user ID
   * @param {Object} updates - Fields to update
   * @param {Object} models - Sequelize models
   * @returns {Object} The updated config
   */
  static async updateCleanerConfig(cleanerId, updates, models) {
    const { CleanerAvailabilityConfig, PreferredPerksConfig } = models;

    // Validate against platform maximums
    let platformMaxDaily = PLATFORM_DEFAULTS.maxDailyJobs;
    let platformMaxConcurrent = PLATFORM_DEFAULTS.maxConcurrentJobs;

    if (PreferredPerksConfig) {
      try {
        const config = await PreferredPerksConfig.findOne();
        if (config) {
          platformMaxDaily = config.platformMaxDailyJobs || PLATFORM_DEFAULTS.maxDailyJobs;
          platformMaxConcurrent = config.platformMaxConcurrentJobs || PLATFORM_DEFAULTS.maxConcurrentJobs;
        }
      } catch (err) {
        // Use defaults
      }
    }

    // Ensure cleaner doesn't exceed platform limits
    if (updates.maxDailyJobs !== undefined && updates.maxDailyJobs !== null) {
      if (updates.maxDailyJobs > platformMaxDaily) {
        throw new Error(`Cannot exceed platform maximum of ${platformMaxDaily} jobs per day`);
      }
      if (updates.maxDailyJobs < 1) {
        throw new Error("Must allow at least 1 job per day");
      }
    }

    if (updates.maxConcurrentJobs !== undefined && updates.maxConcurrentJobs !== null) {
      if (updates.maxConcurrentJobs > platformMaxConcurrent) {
        throw new Error(`Cannot exceed platform maximum of ${platformMaxConcurrent} concurrent jobs`);
      }
      if (updates.maxConcurrentJobs < 1) {
        throw new Error("Must allow at least 1 concurrent job");
      }
    }

    // Find or create config
    let [config, created] = await CleanerAvailabilityConfig.findOrCreate({
      where: { cleanerId },
      defaults: {
        cleanerId,
        ...updates,
      },
    });

    if (!created) {
      await config.update(updates);
    }

    return {
      ...config.toJSON(),
      platformMaxDaily,
      platformMaxConcurrent,
    };
  }

  /**
   * Add or remove blackout dates for a cleaner
   * @param {number} cleanerId - The cleaner's user ID
   * @param {string[]} datesToAdd - Dates to add (YYYY-MM-DD)
   * @param {string[]} datesToRemove - Dates to remove
   * @param {Object} models - Sequelize models
   * @returns {Object} Updated blackout dates
   */
  static async updateBlackoutDates(cleanerId, datesToAdd = [], datesToRemove = [], models) {
    const { CleanerAvailabilityConfig } = models;

    let [config, created] = await CleanerAvailabilityConfig.findOrCreate({
      where: { cleanerId },
      defaults: {
        cleanerId,
        blackoutDates: datesToAdd,
      },
    });

    if (!created) {
      let dates = config.blackoutDates || [];

      // Add new dates
      for (const date of datesToAdd) {
        if (!dates.includes(date)) {
          dates.push(date);
        }
      }

      // Remove dates
      dates = dates.filter((d) => !datesToRemove.includes(d));

      // Sort dates
      dates.sort();

      await config.update({ blackoutDates: dates });
    }

    return {
      blackoutDates: config.blackoutDates,
    };
  }

  /**
   * Get cleaner's job count for a date range
   * @param {number} cleanerId - The cleaner's user ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} models - Sequelize models
   * @returns {Object} Job counts by date
   */
  static async getJobCountsByDate(cleanerId, startDate, endDate, models) {
    const { UserAppointments } = models;

    const appointments = await UserAppointments.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        [Op.or]: [
          { employeesAssigned: { [Op.contains]: [cleanerId.toString()] } },
          { bookedByCleanerId: cleanerId },
        ],
        completed: false,
      },
      attributes: ["date"],
    });

    const countsByDate = {};
    for (const apt of appointments) {
      const date = apt.date;
      countsByDate[date] = (countsByDate[date] || 0) + 1;
    }

    return countsByDate;
  }
}

module.exports = CleanerAvailabilityService;
