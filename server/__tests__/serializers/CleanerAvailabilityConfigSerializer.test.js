/**
 * Tests for CleanerAvailabilityConfigSerializer
 */

const CleanerAvailabilityConfigSerializer = require("../../serializers/CleanerAvailabilityConfigSerializer");

describe("CleanerAvailabilityConfigSerializer", () => {
	const mockPlatformConfig = {
		dataValues: {
			platformMaxDailyJobs: 5,
			platformMaxConcurrentJobs: 3,
		},
	};

	describe("serializeOne", () => {
		it("should serialize config with cleaner overrides", () => {
			const config = {
				dataValues: {
					id: 1,
					cleanerId: 100,
					maxDailyJobs: 3,
					maxConcurrentJobs: 2,
					blackoutDates: ["2026-01-10", "2026-01-15"],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			};

			const result = CleanerAvailabilityConfigSerializer.serializeOne(config, mockPlatformConfig);

			expect(result.id).toBe(1);
			expect(result.cleanerId).toBe(100);
			expect(result.maxDailyJobs).toBe(3);
			expect(result.maxConcurrentJobs).toBe(2);
			expect(result.blackoutDates).toHaveLength(2);
			expect(result.effectiveMaxDailyJobs).toBe(3);
			expect(result.effectiveMaxConcurrentJobs).toBe(2);
			expect(result.usingPlatformDefaultDaily).toBe(false);
			expect(result.usingPlatformDefaultConcurrent).toBe(false);
		});

		it("should use platform defaults when cleaner has no overrides", () => {
			const config = {
				dataValues: {
					id: 1,
					cleanerId: 100,
					maxDailyJobs: null,
					maxConcurrentJobs: null,
					blackoutDates: [],
				},
			};

			const result = CleanerAvailabilityConfigSerializer.serializeOne(config, mockPlatformConfig);

			expect(result.maxDailyJobs).toBeNull();
			expect(result.maxConcurrentJobs).toBeNull();
			expect(result.effectiveMaxDailyJobs).toBe(5);
			expect(result.effectiveMaxConcurrentJobs).toBe(3);
			expect(result.usingPlatformDefaultDaily).toBe(true);
			expect(result.usingPlatformDefaultConcurrent).toBe(true);
		});

		it("should return defaults for null config", () => {
			const result = CleanerAvailabilityConfigSerializer.serializeOne(null, mockPlatformConfig);

			expect(result.effectiveMaxDailyJobs).toBe(5);
			expect(result.effectiveMaxConcurrentJobs).toBe(3);
			expect(result.usingPlatformDefaultDaily).toBe(true);
		});
	});

	describe("getPlatformDefaults", () => {
		it("should extract platform defaults from config", () => {
			const result = CleanerAvailabilityConfigSerializer.getPlatformDefaults(mockPlatformConfig);

			expect(result.maxDailyJobs).toBe(5);
			expect(result.maxConcurrentJobs).toBe(3);
		});

		it("should return hardcoded defaults if no config", () => {
			const result = CleanerAvailabilityConfigSerializer.getPlatformDefaults(null);

			expect(result.maxDailyJobs).toBe(5);
			expect(result.maxConcurrentJobs).toBe(3);
		});
	});

	describe("getDefaults", () => {
		it("should return default config structure", () => {
			const result = CleanerAvailabilityConfigSerializer.getDefaults(mockPlatformConfig);

			expect(result.maxDailyJobs).toBeNull();
			expect(result.maxConcurrentJobs).toBeNull();
			expect(result.blackoutDates).toEqual([]);
			expect(result.effectiveMaxDailyJobs).toBe(5);
			expect(result.usingPlatformDefaultDaily).toBe(true);
		});
	});

	describe("serializeForForm", () => {
		it("should format config for cleaner settings form", () => {
			const config = {
				dataValues: {
					maxDailyJobs: 4,
					maxConcurrentJobs: null,
					blackoutDates: ["2026-01-10"],
				},
			};

			const result = CleanerAvailabilityConfigSerializer.serializeForForm(config, mockPlatformConfig);

			expect(result.maxDailyJobs).toBe(4);
			expect(result.maxConcurrentJobs).toBeNull();
			expect(result.displayMaxDailyJobs).toBe(4);
			expect(result.displayMaxConcurrentJobs).toBe(3); // platform default
			expect(result.platformMaxDailyJobs).toBe(5);
			expect(result.dailyJobOptions).toHaveLength(5);
			expect(result.concurrentJobOptions).toHaveLength(3);
		});
	});

	describe("generateOptions", () => {
		it("should generate options array for dropdown", () => {
			const result = CleanerAvailabilityConfigSerializer.generateOptions(1, 5);

			expect(result).toHaveLength(5);
			expect(result[0]).toEqual({ value: 1, label: "1" });
			expect(result[4]).toEqual({ value: 5, label: "5" });
		});
	});

	describe("serializeBlackoutDates", () => {
		it("should serialize blackout dates with display format", () => {
			const dates = ["2026-01-10", "2026-01-15", "2025-12-01"];

			const result = CleanerAvailabilityConfigSerializer.serializeBlackoutDates(dates);

			expect(result).toHaveLength(3);
			// Should be sorted by date
			expect(result[0].date).toBe("2025-12-01");
			expect(result[0].isPast).toBe(true);
			expect(result[1].date).toBe("2026-01-10");
			expect(result[2].date).toBe("2026-01-15");
			expect(result[1].displayDate).toBeDefined();
		});

		it("should return empty array for null/undefined", () => {
			expect(CleanerAvailabilityConfigSerializer.serializeBlackoutDates(null)).toEqual([]);
			expect(CleanerAvailabilityConfigSerializer.serializeBlackoutDates(undefined)).toEqual([]);
		});
	});

	describe("serializeAvailabilitySummary", () => {
		it("should serialize availability summary with current stats", () => {
			const config = {
				dataValues: {
					maxDailyJobs: 4,
					maxConcurrentJobs: 2,
					blackoutDates: ["2026-01-10", "2026-01-15"],
				},
			};

			const currentStats = {
				dailyJobs: 2,
				concurrentJobs: 1,
			};

			const result = CleanerAvailabilityConfigSerializer.serializeAvailabilitySummary(
				config,
				currentStats,
				mockPlatformConfig
			);

			expect(result.maxDailyJobs).toBe(4);
			expect(result.maxConcurrentJobs).toBe(2);
			expect(result.currentDailyJobs).toBe(2);
			expect(result.currentConcurrentJobs).toBe(1);
			expect(result.dailyJobsRemaining).toBe(2);
			expect(result.concurrentJobsRemaining).toBe(1);
			expect(result.canAcceptDailyJob).toBe(true);
			expect(result.canAcceptConcurrentJob).toBe(true);
			expect(result.totalBlackoutDates).toBe(2);
		});

		it("should indicate when cleaner is at capacity", () => {
			const config = {
				dataValues: {
					maxDailyJobs: 3,
					maxConcurrentJobs: 2,
					blackoutDates: [],
				},
			};

			const currentStats = {
				dailyJobs: 3,
				concurrentJobs: 2,
			};

			const result = CleanerAvailabilityConfigSerializer.serializeAvailabilitySummary(
				config,
				currentStats,
				mockPlatformConfig
			);

			expect(result.dailyJobsRemaining).toBe(0);
			expect(result.concurrentJobsRemaining).toBe(0);
			expect(result.canAcceptDailyJob).toBe(false);
			expect(result.canAcceptConcurrentJob).toBe(false);
		});
	});

	describe("serializeArray", () => {
		it("should serialize an array of configs", () => {
			const configs = [
				{ dataValues: { id: 1, cleanerId: 100, maxDailyJobs: 3 } },
				{ dataValues: { id: 2, cleanerId: 101, maxDailyJobs: null } },
			];

			const result = CleanerAvailabilityConfigSerializer.serializeArray(configs, mockPlatformConfig);

			expect(result).toHaveLength(2);
			expect(result[0].maxDailyJobs).toBe(3);
			expect(result[1].maxDailyJobs).toBeNull();
		});
	});
});
