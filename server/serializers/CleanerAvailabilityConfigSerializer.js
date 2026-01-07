/**
 * CleanerAvailabilityConfigSerializer
 * Serializes cleaner availability configuration for overbooking safeguards
 */

class CleanerAvailabilityConfigSerializer {
	/**
	 * Serialize a single config record
	 * @param {Object} config - CleanerAvailabilityConfig model instance
	 * @param {Object} platformConfig - Optional PreferredPerksConfig for platform defaults
	 * @returns {Object} Serialized config
	 */
	static serializeOne(config, platformConfig = null) {
		if (!config) {
			return this.getDefaults(platformConfig);
		}

		const data = config.dataValues || config;
		const platformDefaults = this.getPlatformDefaults(platformConfig);

		return {
			id: data.id,
			cleanerId: data.cleanerId,
			maxDailyJobs: data.maxDailyJobs,
			maxConcurrentJobs: data.maxConcurrentJobs,
			blackoutDates: data.blackoutDates || [],
			// Effective values (cleaner override or platform default)
			effectiveMaxDailyJobs: data.maxDailyJobs !== null ? data.maxDailyJobs : platformDefaults.maxDailyJobs,
			effectiveMaxConcurrentJobs: data.maxConcurrentJobs !== null ? data.maxConcurrentJobs : platformDefaults.maxConcurrentJobs,
			// Flags for UI
			usingPlatformDefaultDaily: data.maxDailyJobs === null,
			usingPlatformDefaultConcurrent: data.maxConcurrentJobs === null,
			// Platform limits
			platformMaxDailyJobs: platformDefaults.maxDailyJobs,
			platformMaxConcurrentJobs: platformDefaults.maxConcurrentJobs,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
		};
	}

	/**
	 * Get platform default values
	 * @param {Object} platformConfig - PreferredPerksConfig instance
	 * @returns {Object} Platform defaults
	 */
	static getPlatformDefaults(platformConfig) {
		if (!platformConfig) {
			return {
				maxDailyJobs: 5,
				maxConcurrentJobs: 3,
			};
		}

		const data = platformConfig.dataValues || platformConfig;
		return {
			maxDailyJobs: data.platformMaxDailyJobs || 5,
			maxConcurrentJobs: data.platformMaxConcurrentJobs || 3,
		};
	}

	/**
	 * Get default config for a cleaner without settings
	 * @param {Object} platformConfig - Optional PreferredPerksConfig
	 * @returns {Object} Default config
	 */
	static getDefaults(platformConfig = null) {
		const platformDefaults = this.getPlatformDefaults(platformConfig);

		return {
			maxDailyJobs: null,
			maxConcurrentJobs: null,
			blackoutDates: [],
			effectiveMaxDailyJobs: platformDefaults.maxDailyJobs,
			effectiveMaxConcurrentJobs: platformDefaults.maxConcurrentJobs,
			usingPlatformDefaultDaily: true,
			usingPlatformDefaultConcurrent: true,
			platformMaxDailyJobs: platformDefaults.maxDailyJobs,
			platformMaxConcurrentJobs: platformDefaults.maxConcurrentJobs,
		};
	}

	/**
	 * Serialize an array of configs
	 * @param {Array} configs - Array of CleanerAvailabilityConfig instances
	 * @param {Object} platformConfig - Optional PreferredPerksConfig
	 * @returns {Array} Serialized array
	 */
	static serializeArray(configs, platformConfig = null) {
		return configs.map((config) => this.serializeOne(config, platformConfig));
	}

	/**
	 * Serialize for cleaner settings form
	 * @param {Object} config - CleanerAvailabilityConfig model instance
	 * @param {Object} platformConfig - PreferredPerksConfig for platform limits
	 * @returns {Object} Form-friendly format
	 */
	static serializeForForm(config, platformConfig = null) {
		const data = config ? (config.dataValues || config) : {};
		const platformDefaults = this.getPlatformDefaults(platformConfig);

		return {
			// Current values (null means using platform default)
			maxDailyJobs: data.maxDailyJobs,
			maxConcurrentJobs: data.maxConcurrentJobs,
			blackoutDates: data.blackoutDates || [],
			// Display values
			displayMaxDailyJobs: data.maxDailyJobs !== null ? data.maxDailyJobs : platformDefaults.maxDailyJobs,
			displayMaxConcurrentJobs: data.maxConcurrentJobs !== null ? data.maxConcurrentJobs : platformDefaults.maxConcurrentJobs,
			// Platform limits (cleaner cannot exceed these)
			platformMaxDailyJobs: platformDefaults.maxDailyJobs,
			platformMaxConcurrentJobs: platformDefaults.maxConcurrentJobs,
			// Options for form dropdowns (1 to platform max)
			dailyJobOptions: this.generateOptions(1, platformDefaults.maxDailyJobs),
			concurrentJobOptions: this.generateOptions(1, platformDefaults.maxConcurrentJobs),
		};
	}

	/**
	 * Generate options array for dropdown
	 * @param {number} min - Minimum value
	 * @param {number} max - Maximum value
	 * @returns {Array} Options array
	 */
	static generateOptions(min, max) {
		const options = [];
		for (let i = min; i <= max; i++) {
			options.push({ value: i, label: i.toString() });
		}
		return options;
	}

	/**
	 * Serialize blackout dates with human-readable formats
	 * @param {Array} dates - Array of date strings (YYYY-MM-DD)
	 * @returns {Array} Enhanced date array
	 */
	static serializeBlackoutDates(dates) {
		if (!dates || !Array.isArray(dates)) return [];

		return dates.map((dateStr) => {
			const date = new Date(dateStr + "T00:00:00");
			return {
				date: dateStr,
				displayDate: date.toLocaleDateString("en-US", {
					weekday: "short",
					month: "short",
					day: "numeric",
					year: "numeric",
				}),
				isPast: new Date(dateStr) < new Date(new Date().toDateString()),
			};
		}).sort((a, b) => new Date(a.date) - new Date(b.date));
	}

	/**
	 * Serialize availability summary for display
	 * @param {Object} config - CleanerAvailabilityConfig
	 * @param {Object} currentStats - Current job counts for the cleaner
	 * @param {Object} platformConfig - PreferredPerksConfig
	 * @returns {Object} Availability summary
	 */
	static serializeAvailabilitySummary(config, currentStats = {}, platformConfig = null) {
		const serialized = this.serializeOne(config, platformConfig);

		return {
			maxDailyJobs: serialized.effectiveMaxDailyJobs,
			maxConcurrentJobs: serialized.effectiveMaxConcurrentJobs,
			// Current usage
			currentDailyJobs: currentStats.dailyJobs || 0,
			currentConcurrentJobs: currentStats.concurrentJobs || 0,
			// Availability
			dailyJobsRemaining: Math.max(0, serialized.effectiveMaxDailyJobs - (currentStats.dailyJobs || 0)),
			concurrentJobsRemaining: Math.max(0, serialized.effectiveMaxConcurrentJobs - (currentStats.concurrentJobs || 0)),
			// Can accept more?
			canAcceptDailyJob: (currentStats.dailyJobs || 0) < serialized.effectiveMaxDailyJobs,
			canAcceptConcurrentJob: (currentStats.concurrentJobs || 0) < serialized.effectiveMaxConcurrentJobs,
			// Blackout info
			upcomingBlackouts: this.serializeBlackoutDates(serialized.blackoutDates).filter((d) => !d.isPast).slice(0, 5),
			totalBlackoutDates: (serialized.blackoutDates || []).length,
		};
	}
}

module.exports = CleanerAvailabilityConfigSerializer;
