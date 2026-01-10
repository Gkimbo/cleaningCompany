/**
 * AnalyticsService Unit Tests
 *
 * Tests for internal analytics tracking and aggregation.
 */

// Mock models
jest.mock("../../models", () => {
	const { Op } = require("sequelize");
	return {
		AnalyticsEvent: {
			create: jest.fn(),
			findAll: jest.fn(),
			count: jest.fn(),
		},
		UserAppointments: {
			count: jest.fn(),
		},
		sequelize: {
			fn: jest.fn((name, col) => `${name}(${col})`),
			col: jest.fn((name) => name),
			Sequelize: { Op },
		},
	};
});

const AnalyticsService = require("../../services/AnalyticsService");
const { AnalyticsEvent, UserAppointments } = require("../../models");

describe("AnalyticsService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	// ============================================================================
	// EVENT TRACKING METHODS
	// ============================================================================

	describe("trackEvent", () => {
		it("should create an analytics event with all fields", async () => {
			const mockEvent = { id: 1, eventType: "test_event" };
			AnalyticsEvent.create.mockResolvedValue(mockEvent);

			const result = await AnalyticsService.trackEvent(
				"test_event",
				"test_category",
				123,
				{ foo: "bar" },
				"session-123"
			);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "test_event",
					eventCategory: "test_category",
					userId: 123,
					sessionId: "session-123",
					metadata: { foo: "bar" },
				})
			);
			expect(result).toEqual(mockEvent);
		});

		it("should not throw on database error", async () => {
			AnalyticsEvent.create.mockRejectedValue(new Error("DB error"));

			const result = await AnalyticsService.trackEvent("test_event", "test_category");

			expect(result).toBeNull();
		});

		it("should handle null userId", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackEvent("test_event", "test_category", null, {});

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: null,
				})
			);
		});
	});

	describe("trackFlowStart", () => {
		it("should track flow start event", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackFlowStart("user_signup", 123, "session-abc");

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "flow_started",
					eventCategory: "flow_abandonment",
					userId: 123,
					sessionId: "session-abc",
					metadata: expect.objectContaining({
						flowName: "user_signup",
						stepNumber: 0,
						stepName: "start",
					}),
				})
			);
		});
	});

	describe("trackFlowStep", () => {
		it("should track flow step completion", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackFlowStep("home_setup", "basics", 1, 4, 123, "session-abc");

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "flow_step_completed",
					eventCategory: "flow_abandonment",
					metadata: expect.objectContaining({
						flowName: "home_setup",
						stepName: "basics",
						stepNumber: 1,
						totalSteps: 4,
					}),
				})
			);
		});
	});

	describe("trackFlowAbandon", () => {
		it("should track flow abandonment with step info", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackFlowAbandon("business_signup", "verification", 2, 3, 123, "session-abc");

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "flow_abandoned",
					eventCategory: "flow_abandonment",
					metadata: expect.objectContaining({
						flowName: "business_signup",
						lastStepName: "verification",
						lastStepNumber: 2,
						totalSteps: 3,
					}),
				})
			);
		});
	});

	describe("trackFlowComplete", () => {
		it("should track flow completion", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackFlowComplete("add_home", 123, "session-abc");

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "flow_completed",
					eventCategory: "flow_abandonment",
					metadata: expect.objectContaining({
						flowName: "add_home",
					}),
				})
			);
		});
	});

	describe("trackJobStarted", () => {
		it("should track job start event", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackJobStarted(456, 123);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "job_started",
					eventCategory: "job_duration",
					userId: 123,
					metadata: expect.objectContaining({
						appointmentId: 456,
					}),
				})
			);
		});
	});

	describe("trackJobCompleted", () => {
		it("should track job completion with duration", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackJobCompleted(456, 123, 90, "standard_clean");

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "job_completed",
					eventCategory: "job_duration",
					userId: 123,
					metadata: expect.objectContaining({
						appointmentId: 456,
						durationMinutes: 90,
						jobType: "standard_clean",
					}),
				})
			);
		});
	});

	describe("trackOfflineSessionStarted", () => {
		it("should track offline session start", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackOfflineSessionStarted(123);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "offline_session_started",
					eventCategory: "offline_usage",
					userId: 123,
				})
			);
		});
	});

	describe("trackOfflineSessionSynced", () => {
		it("should track offline sync with metrics", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackOfflineSessionSynced(123, 5000, 10);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "offline_session_synced",
					eventCategory: "offline_usage",
					userId: 123,
					metadata: expect.objectContaining({
						syncDurationMs: 5000,
						pendingItemCount: 10,
					}),
				})
			);
		});
	});

	describe("trackDisputeCreated", () => {
		it("should track dispute creation", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackDisputeCreated("cancellation_appeal", 456, 123);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "dispute_created",
					eventCategory: "disputes",
					userId: 123,
					metadata: expect.objectContaining({
						disputeType: "cancellation_appeal",
						appointmentId: 456,
					}),
				})
			);
		});
	});

	describe("trackDisputeResolved", () => {
		it("should track dispute resolution", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackDisputeResolved("cancellation_appeal", 456, "approved", 123);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "dispute_resolved",
					eventCategory: "disputes",
					userId: 123,
					metadata: expect.objectContaining({
						disputeType: "cancellation_appeal",
						appointmentId: 456,
						resolution: "approved",
					}),
				})
			);
		});
	});

	describe("trackPayOverride", () => {
		it("should track pay override with adjustment details", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackPayOverride(456, 789, 5000, 6000, "extra_work", 123);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: "pay_override_applied",
					eventCategory: "pay_override",
					userId: 123,
					metadata: expect.objectContaining({
						appointmentId: 456,
						cleanerId: 789,
						originalAmountCents: 5000,
						newAmountCents: 6000,
						adjustmentCents: 1000,
						reason: "extra_work",
					}),
				})
			);
		});

		it("should calculate negative adjustment correctly", async () => {
			AnalyticsEvent.create.mockResolvedValue({ id: 1 });

			await AnalyticsService.trackPayOverride(456, 789, 6000, 5000, "early_completion", 123);

			expect(AnalyticsEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						adjustmentCents: -1000,
					}),
				})
			);
		});
	});

	// ============================================================================
	// AGGREGATION METHODS
	// ============================================================================

	describe("getFlowAbandonmentStats", () => {
		it("should return flow statistics grouped by flow name", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([
				{ eventType: "flow_started", metadata: { flowName: "user_signup" }, sessionId: "s1" },
				{ eventType: "flow_completed", metadata: { flowName: "user_signup" }, sessionId: "s1" },
				{ eventType: "flow_started", metadata: { flowName: "user_signup" }, sessionId: "s2" },
				{ eventType: "flow_abandoned", metadata: { flowName: "user_signup", lastStepName: "password" }, sessionId: "s2" },
				{ eventType: "flow_started", metadata: { flowName: "home_setup" }, sessionId: "s3" },
				{ eventType: "flow_completed", metadata: { flowName: "home_setup" }, sessionId: "s3" },
			]);

			const result = await AnalyticsService.getFlowAbandonmentStats(null, "2024-01-01", "2024-01-31");

			expect(result.user_signup).toEqual(
				expect.objectContaining({
					started: 2,
					completed: 1,
					abandoned: 1,
					stepDropoffs: { password: 1 },
					completionRate: "50.0",
					abandonmentRate: "50.0",
				})
			);
			expect(result.home_setup).toEqual(
				expect.objectContaining({
					started: 1,
					completed: 1,
					abandoned: 0,
					completionRate: "100.0",
					abandonmentRate: "0.0",
				})
			);
		});

		it("should filter by flow name when provided", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([]);

			await AnalyticsService.getFlowAbandonmentStats("user_signup", "2024-01-01", "2024-01-31");

			expect(AnalyticsEvent.findAll).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						metadata: { flowName: "user_signup" },
					}),
				})
			);
		});

		it("should return empty object when no events", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([]);

			const result = await AnalyticsService.getFlowAbandonmentStats(null, "2024-01-01", "2024-01-31");

			expect(result).toEqual({});
		});
	});

	describe("getJobDurationStats", () => {
		it("should calculate duration statistics", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([
				{ metadata: { durationMinutes: 60 } },
				{ metadata: { durationMinutes: 90 } },
				{ metadata: { durationMinutes: 120 } },
				{ metadata: { durationMinutes: 75 } },
				{ metadata: { durationMinutes: 85 } },
			]);

			const result = await AnalyticsService.getJobDurationStats("2024-01-01", "2024-01-31");

			expect(result.count).toBe(5);
			expect(result.minMinutes).toBe(60);
			expect(result.maxMinutes).toBe(120);
			expect(result.avgMinutes).toBe(86); // (60+90+120+75+85)/5 = 86
			expect(result.medianMinutes).toBe(85); // Middle value after sorting
		});

		it("should return zeros when no events", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([]);

			const result = await AnalyticsService.getJobDurationStats("2024-01-01", "2024-01-31");

			expect(result).toEqual({
				count: 0,
				avgMinutes: 0,
				minMinutes: 0,
				maxMinutes: 0,
				medianMinutes: 0,
				percentile90: 0,
			});
		});

		it("should filter out invalid duration values", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([
				{ metadata: { durationMinutes: 60 } },
				{ metadata: { durationMinutes: null } },
				{ metadata: { durationMinutes: undefined } },
				{ metadata: {} },
				{ metadata: { durationMinutes: 90 } },
			]);

			const result = await AnalyticsService.getJobDurationStats("2024-01-01", "2024-01-31");

			expect(result.count).toBe(2);
		});
	});

	describe("getOfflineUsageStats", () => {
		it("should calculate offline usage statistics", async () => {
			AnalyticsEvent.count.mockResolvedValue(10); // started
			AnalyticsEvent.findAll.mockResolvedValue([
				{ metadata: { syncDurationMs: 2000, pendingItemCount: 5 } },
				{ metadata: { syncDurationMs: 3000, pendingItemCount: 8 } },
				{ metadata: { syncDurationMs: 4000, pendingItemCount: 3 } },
			]);

			const result = await AnalyticsService.getOfflineUsageStats("2024-01-01", "2024-01-31");

			expect(result.offlineSessionsStarted).toBe(10);
			expect(result.offlineSessionsSynced).toBe(3);
			expect(result.avgSyncDurationMs).toBe(3000);
			expect(result.avgPendingItemCount).toBe(5);
			expect(result.syncSuccessRate).toBe("30.0");
		});

		it("should handle zero started sessions", async () => {
			AnalyticsEvent.count.mockResolvedValue(0);
			AnalyticsEvent.findAll.mockResolvedValue([]);

			const result = await AnalyticsService.getOfflineUsageStats("2024-01-01", "2024-01-31");

			expect(result.syncSuccessRate).toBe(0);
		});
	});

	describe("getDisputeStats", () => {
		it("should calculate dispute statistics", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([
				{ eventType: "dispute_created", metadata: { disputeType: "cancellation_appeal" } },
				{ eventType: "dispute_created", metadata: { disputeType: "cancellation_appeal" } },
				{ eventType: "dispute_created", metadata: { disputeType: "home_size_adjustment" } },
				{ eventType: "dispute_resolved", metadata: { resolution: "approved" } },
				{ eventType: "dispute_resolved", metadata: { resolution: "denied" } },
			]);
			UserAppointments.count.mockResolvedValue(100);

			const result = await AnalyticsService.getDisputeStats("2024-01-01", "2024-01-31");

			expect(result.totalCreated).toBe(3);
			expect(result.totalResolved).toBe(2);
			expect(result.byType).toEqual({
				cancellation_appeal: 2,
				home_size_adjustment: 1,
			});
			expect(result.resolutions).toEqual({
				approved: 1,
				denied: 1,
			});
			expect(result.disputesPer100Jobs).toBe("3.00");
			expect(result.resolutionRate).toBe("66.7");
		});

		it("should handle no disputes", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([]);
			UserAppointments.count.mockResolvedValue(50);

			const result = await AnalyticsService.getDisputeStats("2024-01-01", "2024-01-31");

			expect(result.totalCreated).toBe(0);
			expect(result.totalResolved).toBe(0);
			expect(result.resolutionRate).toBe(0);
		});
	});

	describe("getPayOverrideStats", () => {
		it("should calculate pay override statistics", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([
				{ metadata: { adjustmentCents: 1000, reason: "extra_work" } },
				{ metadata: { adjustmentCents: 500, reason: "extra_work" } },
				{ metadata: { adjustmentCents: -200, reason: "early_completion" } },
			]);
			UserAppointments.count.mockResolvedValue(200);

			const result = await AnalyticsService.getPayOverrideStats("2024-01-01", "2024-01-31");

			expect(result.totalOverrides).toBe(3);
			expect(result.totalAdjustmentCents).toBe(1300);
			expect(result.totalAdjustmentDollars).toBe("13.00");
			expect(result.avgAdjustmentCents).toBe(433);
			expect(result.byReason).toEqual({
				extra_work: 2,
				early_completion: 1,
			});
			expect(result.overridesPer100Jobs).toBe("1.50");
		});

		it("should handle no overrides", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([]);
			UserAppointments.count.mockResolvedValue(100);

			const result = await AnalyticsService.getPayOverrideStats("2024-01-01", "2024-01-31");

			expect(result.totalOverrides).toBe(0);
			expect(result.totalAdjustmentDollars).toBe("0.00");
		});
	});

	describe("getDashboardStats", () => {
		it("should return combined dashboard data", async () => {
			// Mock all the underlying calls
			AnalyticsEvent.findAll.mockResolvedValue([]);
			AnalyticsEvent.count.mockResolvedValue(0);
			UserAppointments.count.mockResolvedValue(0);

			const result = await AnalyticsService.getDashboardStats("2024-01-01", "2024-01-31");

			expect(result).toEqual(
				expect.objectContaining({
					period: { startDate: "2024-01-01", endDate: "2024-01-31" },
					flowAbandonment: expect.any(Object),
					jobDuration: expect.any(Object),
					offlineUsage: expect.any(Object),
					disputes: expect.any(Object),
					payOverrides: expect.any(Object),
				})
			);
		});
	});

	describe("getDailyTrend", () => {
		it("should return daily trend data", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([
				{ dateOnly: "2024-01-01", count: "5" },
				{ dateOnly: "2024-01-02", count: "8" },
				{ dateOnly: "2024-01-03", count: "3" },
			]);

			const result = await AnalyticsService.getDailyTrend("disputes", "2024-01-01", "2024-01-03");

			expect(result).toEqual([
				{ date: "2024-01-01", count: 5 },
				{ date: "2024-01-02", count: 8 },
				{ date: "2024-01-03", count: 3 },
			]);
		});

		it("should return empty array when no data", async () => {
			AnalyticsEvent.findAll.mockResolvedValue([]);

			const result = await AnalyticsService.getDailyTrend("disputes", "2024-01-01", "2024-01-03");

			expect(result).toEqual([]);
		});
	});
});
