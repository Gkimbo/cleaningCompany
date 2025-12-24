import OwnerDashboardService from "../../src/services/fetchRequests/OwnerDashboardService";

// Mock global fetch
global.fetch = jest.fn();

describe("OwnerDashboardService", () => {
  const mockToken = "test-owner-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBusinessMetrics", () => {
    const mockBusinessMetrics = {
      costPerBooking: {
        avgFeeCents: 1500,
        totalFeeCents: 150000,
        bookingCount: 100,
      },
      repeatBookingRate: {
        rate: 45,
        repeatBookers: 45,
        singleBookers: 55,
        totalHomeowners: 100,
      },
      subscriptionRate: {
        rate: 20,
        frequentBookers: 20,
        regularBookers: 30,
        occasionalBookers: 50,
        totalHomeowners: 100,
      },
      churn: {
        homeownerCancellations: {
          usersWithCancellations: 10,
          totalFeeCents: 25000,
        },
        cleanerCancellations: {
          total: 15,
          last30Days: 3,
          last90Days: 8,
        },
      },
      cleanerReliability: {
        overallCompletionRate: 95,
        avgRating: 4.7,
        totalCompleted: 950,
        totalAssigned: 1000,
        cleanerStats: [
          { id: 1, username: "cleaner1", rating: 4.9, completed: 100, assigned: 100, completionRate: 100 },
          { id: 2, username: "cleaner2", rating: 4.5, completed: 95, assigned: 100, completionRate: 95 },
        ],
      },
    };

    it("should fetch business metrics successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBusinessMetrics,
      });

      const result = await OwnerDashboardService.getBusinessMetrics(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/owner-dashboard/business-metrics"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result).toEqual(mockBusinessMetrics);
    });

    it("should return fallback on API error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await OwnerDashboardService.getBusinessMetrics(mockToken);

      expect(result.costPerBooking.avgFeeCents).toBe(0);
      expect(result.repeatBookingRate.rate).toBe(0);
      expect(result.subscriptionRate.rate).toBe(0);
      expect(result.churn.homeownerCancellations.usersWithCancellations).toBe(0);
      expect(result.cleanerReliability.overallCompletionRate).toBe(0);
    });

    it("should return fallback on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await OwnerDashboardService.getBusinessMetrics(mockToken);

      expect(result.costPerBooking).toBeDefined();
      expect(result.repeatBookingRate).toBeDefined();
      expect(result.subscriptionRate).toBeDefined();
      expect(result.churn).toBeDefined();
      expect(result.cleanerReliability).toBeDefined();
    });

    it("should include all expected metric categories", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBusinessMetrics,
      });

      const result = await OwnerDashboardService.getBusinessMetrics(mockToken);

      expect(result.costPerBooking).toBeDefined();
      expect(result.costPerBooking.avgFeeCents).toBeDefined();
      expect(result.costPerBooking.totalFeeCents).toBeDefined();
      expect(result.costPerBooking.bookingCount).toBeDefined();

      expect(result.repeatBookingRate).toBeDefined();
      expect(result.repeatBookingRate.rate).toBeDefined();
      expect(result.repeatBookingRate.repeatBookers).toBeDefined();
      expect(result.repeatBookingRate.singleBookers).toBeDefined();

      expect(result.subscriptionRate).toBeDefined();
      expect(result.subscriptionRate.frequentBookers).toBeDefined();
      expect(result.subscriptionRate.regularBookers).toBeDefined();
      expect(result.subscriptionRate.occasionalBookers).toBeDefined();

      expect(result.churn).toBeDefined();
      expect(result.churn.homeownerCancellations).toBeDefined();
      expect(result.churn.cleanerCancellations).toBeDefined();

      expect(result.cleanerReliability).toBeDefined();
      expect(result.cleanerReliability.overallCompletionRate).toBeDefined();
      expect(result.cleanerReliability.avgRating).toBeDefined();
      expect(result.cleanerReliability.cleanerStats).toBeDefined();
    });
  });

  describe("getFinancialSummary", () => {
    it("should fetch financial summary successfully", async () => {
      const mockData = {
        current: {
          todayCents: 1000,
          weekCents: 5000,
          monthCents: 20000,
          yearCents: 200000,
        },
        monthly: [],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await OwnerDashboardService.getFinancialSummary(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/owner-dashboard/financial-summary"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.current).toBeDefined();
    });

    it("should return fallback on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await OwnerDashboardService.getFinancialSummary(mockToken);

      expect(result.current.todayCents).toBe(0);
      expect(result.monthly).toEqual([]);
    });
  });

  describe("getUserAnalytics", () => {
    it("should fetch user analytics successfully", async () => {
      const mockData = {
        totals: { cleaners: 50, homeowners: 100, total: 150 },
        active: {
          cleaners: { day: 10, week: 30, month: 45 },
          homeowners: { day: 20, week: 60, month: 90 },
        },
        growth: [],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await OwnerDashboardService.getUserAnalytics(mockToken);

      expect(result.totals).toBeDefined();
      expect(result.active).toBeDefined();
    });
  });

  describe("getQuickStats", () => {
    it("should fetch quick stats successfully", async () => {
      const mockData = {
        todaysAppointments: 5,
        pendingPayments: 2,
        newUsersThisWeek: 10,
        completedThisWeek: 25,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await OwnerDashboardService.getQuickStats(mockToken);

      expect(result.todaysAppointments).toBe(5);
      expect(result.completedThisWeek).toBe(25);
    });
  });

  describe("getAppUsageAnalytics", () => {
    it("should fetch app usage analytics successfully", async () => {
      const mockData = {
        signups: { today: 2, thisWeek: 10, thisMonth: 30, allTime: 500 },
        sessions: { today: 50, thisWeek: 300, thisMonth: 1000 },
        engagement: { returningUserRate: 45, engagementRate: 60 },
        retention: { day1: 80, day7: 50, day30: 30 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await OwnerDashboardService.getAppUsageAnalytics(mockToken);

      expect(result.signups).toBeDefined();
      expect(result.sessions).toBeDefined();
      expect(result.engagement).toBeDefined();
      expect(result.retention).toBeDefined();
    });
  });

  describe("recheckServiceAreas", () => {
    it("should trigger service area recheck successfully", async () => {
      const mockResult = {
        success: true,
        message: "5 homes updated",
        updated: 5,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await OwnerDashboardService.recheckServiceAreas(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/owner-dashboard/recheck-service-areas"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it("should handle recheck errors", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed to recheck" }),
      });

      const result = await OwnerDashboardService.recheckServiceAreas(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
