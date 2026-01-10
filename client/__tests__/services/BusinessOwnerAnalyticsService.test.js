/**
 * Tests for BusinessOwnerService - Analytics & Verification Methods
 * Tests all analytics and verification API calls
 */

import BusinessOwnerService from "../../src/services/fetchRequests/BusinessOwnerService";

// Mock global fetch
global.fetch = jest.fn();

describe("BusinessOwnerService - Analytics", () => {
  const mockToken = "test-business-owner-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // getAnalyticsAccess
  // =============================================
  describe("getAnalyticsAccess", () => {
    const mockPremiumAccess = {
      tier: "premium",
      features: {
        basicMetrics: true,
        employeeAnalytics: true,
        clientInsights: true,
        advancedFinancials: true,
        exportReports: true,
      },
      qualification: {
        qualifies: true,
        totalCleanings: 55,
        threshold: 50,
        cleaningsNeeded: 0,
      },
    };

    const mockStandardAccess = {
      tier: "standard",
      features: {
        basicMetrics: true,
        employeeAnalytics: false,
        clientInsights: false,
        advancedFinancials: false,
        exportReports: false,
      },
      qualification: {
        qualifies: false,
        totalCleanings: 25,
        threshold: 50,
        cleaningsNeeded: 25,
      },
    };

    it("should fetch analytics access successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPremiumAccess,
      });

      const result = await BusinessOwnerService.getAnalyticsAccess(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics/access"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.tier).toBe("premium");
      expect(result.features.employeeAnalytics).toBe(true);
    });

    it("should return fallback on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getAnalyticsAccess(mockToken);

      expect(result.tier).toBe("standard");
      expect(result.features.basicMetrics).toBe(true);
    });
  });

  // =============================================
  // getAllAnalytics
  // =============================================
  describe("getAllAnalytics", () => {
    const mockAllAnalytics = {
      access: { tier: "premium" },
      overview: {
        bookings: { thisMonth: 50 },
        revenue: { thisMonthFormatted: "$5,000" },
      },
      employees: {
        employees: [{ employeeId: 1, name: "John Doe" }],
      },
      clients: {
        totalClients: 25,
      },
      financials: {
        summary: { netProfitFormatted: "$2,000" },
      },
      trends: {
        data: [{ period: "Jan 2024", revenue: 4500 }],
      },
    };

    it("should fetch all analytics successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAllAnalytics,
      });

      const result = await BusinessOwnerService.getAllAnalytics(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.access.tier).toBe("premium");
      expect(result.overview.bookings.thisMonth).toBe(50);
    });

    it("should pass options as query params", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAllAnalytics,
      });

      await BusinessOwnerService.getAllAnalytics(mockToken, {
        months: 6,
        topClientsLimit: 10,
        churnDays: 30,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/months=6.*topClientsLimit=10.*churnDays=30/),
        expect.any(Object)
      );
    });

    it("should handle empty options", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAllAnalytics,
      });

      await BusinessOwnerService.getAllAnalytics(mockToken, {});

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics"),
        expect.any(Object)
      );
      // Should not have query params
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("?"),
        expect.any(Object)
      );
    });

    it("should return fallback on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getAllAnalytics(mockToken);

      expect(result).toEqual({
        access: { tier: "standard" },
        overview: {},
      });
    });
  });

  // =============================================
  // getOverviewAnalytics
  // =============================================
  describe("getOverviewAnalytics", () => {
    const mockOverview = {
      bookings: { thisMonth: 45, changePercent: 12.5 },
      revenue: { thisMonthFormatted: "$4,500", changePercent: 15.0 },
      averageJobValueFormatted: "$100",
      activeEmployees: 5,
      activeClients: 20,
    };

    it("should fetch overview analytics successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOverview,
      });

      const result = await BusinessOwnerService.getOverviewAnalytics(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics/overview"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.bookings.thisMonth).toBe(45);
    });

    it("should return empty object on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getOverviewAnalytics(mockToken);

      expect(result).toEqual({});
    });
  });

  // =============================================
  // getEmployeeAnalytics
  // =============================================
  describe("getEmployeeAnalytics", () => {
    const mockEmployeeAnalytics = {
      employees: [
        {
          employeeId: 1,
          name: "John Doe",
          jobsCompleted: 50,
          totalRevenueFormatted: "$5,000",
          avgRating: 4.8,
          completionRate: 98.5,
        },
      ],
      summary: {
        totalEmployees: 5,
        avgJobsPerEmployee: 30,
      },
    };

    it("should fetch employee analytics successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmployeeAnalytics,
      });

      const result = await BusinessOwnerService.getEmployeeAnalytics(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics/employees"),
        expect.any(Object)
      );
      expect(result.employees[0].name).toBe("John Doe");
    });

    it("should pass options as query params", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmployeeAnalytics,
      });

      await BusinessOwnerService.getEmployeeAnalytics(mockToken, {
        months: 3,
        limit: 10,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/months=3.*limit=10/),
        expect.any(Object)
      );
    });

    it("should return fallback on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getEmployeeAnalytics(mockToken);

      expect(result).toEqual({ employees: [] });
    });

    it("should handle 403 premium required response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: "Employee analytics requires premium tier",
          requiredTier: "premium",
        }),
      });

      const result = await BusinessOwnerService.getEmployeeAnalytics(mockToken);

      // Service spreads response after setting error: "premium_required", so response error overwrites
      expect(result.error).toBe("Employee analytics requires premium tier");
      expect(result.requiredTier).toBe("premium");
    });
  });

  // =============================================
  // getClientAnalytics
  // =============================================
  describe("getClientAnalytics", () => {
    const mockClientAnalytics = {
      totalClients: 25,
      newClientsThisMonth: 5,
      metrics: { retentionRate: 85.0 },
      topClients: [
        { clientId: 1, name: "Top Client", bookingCount: 15 },
      ],
      atRiskClients: [
        { clientId: 2, name: "At Risk", daysSinceLastBooking: 45 },
      ],
      atRiskCount: 3,
    };

    it("should fetch client analytics successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClientAnalytics,
      });

      const result = await BusinessOwnerService.getClientAnalytics(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics/clients"),
        expect.any(Object)
      );
      expect(result.totalClients).toBe(25);
    });

    it("should pass options as query params", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClientAnalytics,
      });

      await BusinessOwnerService.getClientAnalytics(mockToken, {
        topClientsLimit: 5,
        churnDays: 60,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/topClientsLimit=5.*churnDays=60/),
        expect.any(Object)
      );
    });

    it("should return empty object on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getClientAnalytics(mockToken);

      expect(result).toEqual({});
    });
  });

  // =============================================
  // getFinancialAnalytics
  // =============================================
  describe("getFinancialAnalytics", () => {
    const mockFinancials = {
      summary: {
        grossRevenueFormatted: "$10,000",
        platformFeesFormatted: "$1,000",
        totalPayrollFormatted: "$5,000",
        netProfitFormatted: "$4,000",
        profitMargin: 40.0,
      },
      byMonth: [
        { month: "Jan 2024", revenue: 8000, expenses: 4800 },
      ],
    };

    it("should fetch financial analytics successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFinancials,
      });

      const result = await BusinessOwnerService.getFinancialAnalytics(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics/financials"),
        expect.any(Object)
      );
      expect(result.summary.profitMargin).toBe(40.0);
    });

    it("should return empty object on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getFinancialAnalytics(mockToken);

      expect(result).toEqual({});
    });
  });

  // =============================================
  // getTrends
  // =============================================
  describe("getTrends", () => {
    const mockTrends = {
      period: "monthly",
      months: 6,
      data: [
        { period: "Jan 2024", revenue: 4500, bookings: 45 },
        { period: "Feb 2024", revenue: 5000, bookings: 50 },
      ],
      access: { tier: "premium", maxMonthsAllowed: 24 },
    };

    it("should fetch trends successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrends,
      });

      const result = await BusinessOwnerService.getTrends(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/analytics/trends"),
        expect.any(Object)
      );
      expect(result.data.length).toBe(2);
    });

    it("should pass period and months options", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrends,
      });

      await BusinessOwnerService.getTrends(mockToken, {
        period: "weekly",
        months: 12,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/period=weekly.*months=12/),
        expect.any(Object)
      );
    });

    it("should return fallback on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getTrends(mockToken);

      expect(result).toEqual({ data: [] });
    });
  });
});

describe("BusinessOwnerService - Verification", () => {
  const mockToken = "test-business-owner-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // getVerificationStatus
  // =============================================
  describe("getVerificationStatus", () => {
    const mockVerifiedStatus = {
      found: true,
      isVerified: true,
      verificationStatus: "verified",
      businessName: "CleanPro Services",
      yearsInBusiness: 5,
      activeClientCount: 15,
      verifiedAt: "2024-01-15T10:00:00.000Z",
      highlightOptIn: true,
    };

    it("should fetch verification status successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVerifiedStatus,
      });

      const result = await BusinessOwnerService.getVerificationStatus(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/verification/status"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.isVerified).toBe(true);
      expect(result.businessName).toBe("CleanPro Services");
    });

    it("should return not found on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getVerificationStatus(mockToken);

      expect(result).toEqual({ found: false });
    });
  });

  // =============================================
  // checkVerificationEligibility
  // =============================================
  describe("checkVerificationEligibility", () => {
    const mockEligible = {
      eligible: true,
      criteria: {
        activeClients: { met: true, current: 15, required: 10 },
        averageRating: { met: true, current: 4.7, required: 4.0 },
        completedJobs: { met: true, current: 50, required: 20 },
        accountStanding: { met: true },
      },
      businessName: "CleanPro Services",
    };

    it("should check eligibility successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEligible,
      });

      const result = await BusinessOwnerService.checkVerificationEligibility(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/verification/eligibility"),
        expect.any(Object)
      );
      expect(result.eligible).toBe(true);
      expect(result.criteria.activeClients.met).toBe(true);
    });

    it("should return ineligible on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.checkVerificationEligibility(mockToken);

      expect(result).toEqual({ eligible: false });
    });
  });

  // =============================================
  // requestVerification
  // =============================================
  describe("requestVerification", () => {
    it("should request verification successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: "pending",
          message: "Verification request submitted",
        }),
      });

      const result = await BusinessOwnerService.requestVerification(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/verification/request"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe("pending");
    });

    it("should handle already verified error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: "Business is already verified",
        }),
      });

      const result = await BusinessOwnerService.requestVerification(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Business is already verified");
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.requestVerification(mockToken);

      expect(result.success).toBe(false);
    });
  });

  // =============================================
  // updateBusinessProfile
  // =============================================
  describe("updateBusinessProfile", () => {
    it("should update profile successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          updated: {
            businessDescription: "Professional cleaning",
            businessHighlightOptIn: true,
          },
        }),
      });

      const result = await BusinessOwnerService.updateBusinessProfile(mockToken, {
        businessDescription: "Professional cleaning",
        businessHighlightOptIn: true,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/verification/profile"),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          }),
          body: JSON.stringify({
            businessDescription: "Professional cleaning",
            businessHighlightOptIn: true,
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.updateBusinessProfile(mockToken, {});

      expect(result.success).toBe(false);
    });
  });

  // =============================================
  // getVerificationConfig
  // =============================================
  describe("getVerificationConfig", () => {
    const mockConfig = {
      minActiveClients: 10,
      minAverageRating: 4.0,
      minCompletedJobs: 20,
      ratingLookbackMonths: 6,
    };

    it("should fetch verification config successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      });

      const result = await BusinessOwnerService.getVerificationConfig(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/business-owner/verification/config"),
        expect.any(Object)
      );
      expect(result.minActiveClients).toBe(10);
      expect(result.minAverageRating).toBe(4.0);
    });

    it("should return empty object on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getVerificationConfig(mockToken);

      expect(result).toEqual({});
    });
  });
});
