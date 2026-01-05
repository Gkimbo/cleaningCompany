/**
 * Tests for PreferredPerksConfigSerializer
 */

const PreferredPerksConfigSerializer = require("../../serializers/PreferredPerksConfigSerializer");

describe("PreferredPerksConfigSerializer", () => {
	const mockConfig = {
		dataValues: {
			id: 1,
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
			updatedBy: 1,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	};

	describe("serializeOne", () => {
		it("should serialize config correctly", () => {
			const result = PreferredPerksConfigSerializer.serializeOne(mockConfig);

			expect(result.bronzeMinHomes).toBe(1);
			expect(result.silverBonusPercent).toBe(3);
			expect(result.goldBonusPercent).toBe(5);
			expect(result.goldFasterPayouts).toBe(true);
			expect(result.platinumBonusPercent).toBe(7);
			expect(result.platinumEarlyAccess).toBe(true);
			expect(result.backupCleanerTimeoutHours).toBe(24);
			expect(result.platformMaxDailyJobs).toBe(5);
		});

		it("should return defaults for null input", () => {
			const result = PreferredPerksConfigSerializer.serializeOne(null);

			expect(result.bronzeMinHomes).toBe(1);
			expect(result.silverBonusPercent).toBe(3);
			expect(result.goldBonusPercent).toBe(5);
			expect(result.platinumBonusPercent).toBe(7);
		});
	});

	describe("getDefaults", () => {
		it("should return default configuration", () => {
			const defaults = PreferredPerksConfigSerializer.getDefaults();

			expect(defaults.bronzeMinHomes).toBe(1);
			expect(defaults.silverMinHomes).toBe(3);
			expect(defaults.goldMinHomes).toBe(6);
			expect(defaults.platinumMinHomes).toBe(11);
			expect(defaults.backupCleanerTimeoutHours).toBe(24);
		});
	});

	describe("serializeByTier", () => {
		it("should organize config by tier", () => {
			const result = PreferredPerksConfigSerializer.serializeByTier(mockConfig);

			expect(result.tiers.bronze.name).toBe("Bronze");
			expect(result.tiers.bronze.minHomes).toBe(1);
			expect(result.tiers.bronze.perks).toHaveLength(0);

			expect(result.tiers.silver.name).toBe("Silver");
			expect(result.tiers.silver.bonusPercent).toBe(3);
			expect(result.tiers.silver.perks).toContain("3% bonus on preferred jobs");

			expect(result.tiers.gold.name).toBe("Gold");
			expect(result.tiers.gold.fasterPayouts).toBe(true);
			expect(result.tiers.gold.perks).toContain("5% bonus on preferred jobs");
			expect(result.tiers.gold.perks).toContain("Faster payouts (24h)");

			expect(result.tiers.platinum.name).toBe("Platinum");
			expect(result.tiers.platinum.maxHomes).toBeNull();
			expect(result.tiers.platinum.perks).toContain("Early access to new homes");

			expect(result.settings.backupCleanerTimeoutHours).toBe(24);
		});
	});

	describe("serializeForForm", () => {
		it("should format config for form editing", () => {
			const result = PreferredPerksConfigSerializer.serializeForForm(mockConfig);

			expect(result.tierThresholds.bronze.min).toBe(1);
			expect(result.tierThresholds.silver.min).toBe(3);
			expect(result.tierThresholds.gold.min).toBe(6);
			expect(result.tierThresholds.platinum.min).toBe(11);

			expect(result.bonusPercentages.silver).toBe(3);
			expect(result.bonusPercentages.gold).toBe(5);
			expect(result.bonusPercentages.platinum).toBe(7);

			expect(result.payoutSettings.goldFasterPayouts).toBe(true);
			expect(result.payoutSettings.goldPayoutHours).toBe(24);

			expect(result.additionalPerks.platinumEarlyAccess).toBe(true);
			expect(result.backupSettings.timeoutHours).toBe(24);
			expect(result.platformLimits.maxDailyJobs).toBe(5);
		});
	});

	describe("serializeChangeSummary", () => {
		it("should detect changes between configs", () => {
			const oldConfig = {
				dataValues: {
					silverBonusPercent: 3,
					goldBonusPercent: 5,
					platinumBonusPercent: 7,
				},
			};

			const newConfig = {
				dataValues: {
					silverBonusPercent: 4,
					goldBonusPercent: 5,
					platinumBonusPercent: 8,
				},
			};

			const result = PreferredPerksConfigSerializer.serializeChangeSummary(oldConfig, newConfig);

			expect(result.hasChanges).toBe(true);
			expect(result.changeCount).toBe(2);
			expect(result.changes).toContainEqual(
				expect.objectContaining({
					field: "silverBonusPercent",
					oldValue: 3,
					newValue: 4,
				})
			);
		});

		it("should return no changes for identical configs", () => {
			const config = {
				dataValues: {
					silverBonusPercent: 3,
					goldBonusPercent: 5,
				},
			};

			const result = PreferredPerksConfigSerializer.serializeChangeSummary(config, config);

			expect(result.hasChanges).toBe(false);
			expect(result.changeCount).toBe(0);
		});
	});
});
