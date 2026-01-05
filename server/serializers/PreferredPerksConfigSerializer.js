/**
 * PreferredPerksConfigSerializer
 * Serializes owner-configurable preferred cleaner perk settings
 */

class PreferredPerksConfigSerializer {
	/**
	 * Serialize a single config record
	 * @param {Object} config - PreferredPerksConfig model instance
	 * @returns {Object} Serialized config data
	 */
	static serializeOne(config) {
		if (!config) return this.getDefaults();

		const data = config.dataValues || config;

		return {
			id: data.id,
			// Bronze tier
			bronzeMinHomes: data.bronzeMinHomes,
			bronzeMaxHomes: data.bronzeMaxHomes,
			bronzeBonusPercent: parseFloat(data.bronzeBonusPercent || 0),
			// Silver tier
			silverMinHomes: data.silverMinHomes,
			silverMaxHomes: data.silverMaxHomes,
			silverBonusPercent: parseFloat(data.silverBonusPercent),
			// Gold tier
			goldMinHomes: data.goldMinHomes,
			goldMaxHomes: data.goldMaxHomes,
			goldBonusPercent: parseFloat(data.goldBonusPercent),
			goldFasterPayouts: data.goldFasterPayouts,
			goldPayoutHours: data.goldPayoutHours,
			// Platinum tier
			platinumMinHomes: data.platinumMinHomes,
			platinumBonusPercent: parseFloat(data.platinumBonusPercent),
			platinumFasterPayouts: data.platinumFasterPayouts,
			platinumPayoutHours: data.platinumPayoutHours,
			platinumEarlyAccess: data.platinumEarlyAccess,
			// Backup cleaner settings
			backupCleanerTimeoutHours: data.backupCleanerTimeoutHours,
			// Platform limits
			platformMaxDailyJobs: data.platformMaxDailyJobs,
			platformMaxConcurrentJobs: data.platformMaxConcurrentJobs,
			// Audit
			updatedBy: data.updatedBy,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
		};
	}

	/**
	 * Get default configuration values
	 * @returns {Object} Default config
	 */
	static getDefaults() {
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
			backupCleanerTimeoutHours: 24,
			platformMaxDailyJobs: 5,
			platformMaxConcurrentJobs: 3,
		};
	}

	/**
	 * Serialize config organized by tier for display
	 * @param {Object} config - PreferredPerksConfig model instance
	 * @returns {Object} Config organized by tier
	 */
	static serializeByTier(config) {
		const data = config ? (config.dataValues || config) : this.getDefaults();

		return {
			tiers: {
				bronze: {
					name: "Bronze",
					minHomes: data.bronzeMinHomes,
					maxHomes: data.bronzeMaxHomes,
					bonusPercent: parseFloat(data.bronzeBonusPercent || 0),
					perks: [],
				},
				silver: {
					name: "Silver",
					minHomes: data.silverMinHomes,
					maxHomes: data.silverMaxHomes,
					bonusPercent: parseFloat(data.silverBonusPercent),
					perks: [`${data.silverBonusPercent}% bonus on preferred jobs`],
				},
				gold: {
					name: "Gold",
					minHomes: data.goldMinHomes,
					maxHomes: data.goldMaxHomes,
					bonusPercent: parseFloat(data.goldBonusPercent),
					fasterPayouts: data.goldFasterPayouts,
					payoutHours: data.goldPayoutHours,
					perks: [
						`${data.goldBonusPercent}% bonus on preferred jobs`,
						data.goldFasterPayouts ? `Faster payouts (${data.goldPayoutHours}h)` : null,
					].filter(Boolean),
				},
				platinum: {
					name: "Platinum",
					minHomes: data.platinumMinHomes,
					maxHomes: null, // No upper limit
					bonusPercent: parseFloat(data.platinumBonusPercent),
					fasterPayouts: data.platinumFasterPayouts,
					payoutHours: data.platinumPayoutHours,
					earlyAccess: data.platinumEarlyAccess,
					perks: [
						`${data.platinumBonusPercent}% bonus on preferred jobs`,
						data.platinumFasterPayouts ? `Faster payouts (${data.platinumPayoutHours}h)` : null,
						data.platinumEarlyAccess ? "Early access to new homes" : null,
					].filter(Boolean),
				},
			},
			settings: {
				backupCleanerTimeoutHours: data.backupCleanerTimeoutHours,
				platformMaxDailyJobs: data.platformMaxDailyJobs,
				platformMaxConcurrentJobs: data.platformMaxConcurrentJobs,
			},
			updatedAt: data.updatedAt,
		};
	}

	/**
	 * Serialize for owner dashboard form
	 * @param {Object} config - PreferredPerksConfig model instance
	 * @returns {Object} Form-friendly format
	 */
	static serializeForForm(config) {
		const data = config ? (config.dataValues || config) : this.getDefaults();

		return {
			tierThresholds: {
				bronze: { min: data.bronzeMinHomes, max: data.bronzeMaxHomes },
				silver: { min: data.silverMinHomes, max: data.silverMaxHomes },
				gold: { min: data.goldMinHomes, max: data.goldMaxHomes },
				platinum: { min: data.platinumMinHomes, max: null },
			},
			bonusPercentages: {
				bronze: parseFloat(data.bronzeBonusPercent || 0),
				silver: parseFloat(data.silverBonusPercent),
				gold: parseFloat(data.goldBonusPercent),
				platinum: parseFloat(data.platinumBonusPercent),
			},
			payoutSettings: {
				goldFasterPayouts: data.goldFasterPayouts,
				goldPayoutHours: data.goldPayoutHours,
				platinumFasterPayouts: data.platinumFasterPayouts,
				platinumPayoutHours: data.platinumPayoutHours,
			},
			additionalPerks: {
				platinumEarlyAccess: data.platinumEarlyAccess,
			},
			backupSettings: {
				timeoutHours: data.backupCleanerTimeoutHours,
			},
			platformLimits: {
				maxDailyJobs: data.platformMaxDailyJobs,
				maxConcurrentJobs: data.platformMaxConcurrentJobs,
			},
		};
	}

	/**
	 * Serialize config history for audit view
	 * @param {Array} configs - Array of PreferredPerksConfig instances
	 * @returns {Array} Serialized history
	 */
	static serializeHistory(configs) {
		return configs.map((config) => {
			const serialized = this.serializeOne(config);

			// Include updater info if available
			if (config.updater) {
				const updaterData = config.updater.dataValues || config.updater;
				serialized.updatedByUser = {
					id: updaterData.id,
					username: updaterData.username,
					email: updaterData.email,
				};
			}

			return serialized;
		});
	}

	/**
	 * Serialize a summary of changes for notification/audit
	 * @param {Object} oldConfig - Previous config
	 * @param {Object} newConfig - New config
	 * @returns {Object} Summary of changes
	 */
	static serializeChangeSummary(oldConfig, newConfig) {
		const oldData = oldConfig ? (oldConfig.dataValues || oldConfig) : this.getDefaults();
		const newData = newConfig.dataValues || newConfig;

		const changes = [];

		// Check tier threshold changes
		const thresholdFields = [
			{ field: "bronzeMinHomes", label: "Bronze min homes" },
			{ field: "bronzeMaxHomes", label: "Bronze max homes" },
			{ field: "silverMinHomes", label: "Silver min homes" },
			{ field: "silverMaxHomes", label: "Silver max homes" },
			{ field: "goldMinHomes", label: "Gold min homes" },
			{ field: "goldMaxHomes", label: "Gold max homes" },
			{ field: "platinumMinHomes", label: "Platinum min homes" },
		];

		// Check bonus changes
		const bonusFields = [
			{ field: "silverBonusPercent", label: "Silver bonus" },
			{ field: "goldBonusPercent", label: "Gold bonus" },
			{ field: "platinumBonusPercent", label: "Platinum bonus" },
		];

		// Check payout settings
		const payoutFields = [
			{ field: "goldFasterPayouts", label: "Gold faster payouts" },
			{ field: "goldPayoutHours", label: "Gold payout hours" },
			{ field: "platinumFasterPayouts", label: "Platinum faster payouts" },
			{ field: "platinumPayoutHours", label: "Platinum payout hours" },
		];

		// Check other settings
		const otherFields = [
			{ field: "platinumEarlyAccess", label: "Platinum early access" },
			{ field: "backupCleanerTimeoutHours", label: "Backup timeout hours" },
			{ field: "platformMaxDailyJobs", label: "Max daily jobs" },
			{ field: "platformMaxConcurrentJobs", label: "Max concurrent jobs" },
		];

		const allFields = [...thresholdFields, ...bonusFields, ...payoutFields, ...otherFields];

		for (const { field, label } of allFields) {
			if (oldData[field] !== newData[field]) {
				changes.push({
					field,
					label,
					oldValue: oldData[field],
					newValue: newData[field],
				});
			}
		}

		return {
			hasChanges: changes.length > 0,
			changeCount: changes.length,
			changes,
		};
	}
}

module.exports = PreferredPerksConfigSerializer;
