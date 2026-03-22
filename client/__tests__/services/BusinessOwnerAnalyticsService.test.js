/**
 * Tests for BusinessOwnerService - Analytics & Verification Methods
 * Tests all analytics and verification API calls
 */

// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import HttpClient from "../../src/services/HttpClient";
import BusinessOwnerService from "../../src/services/fetchRequests/BusinessOwnerService";

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
      HttpClient.get.mockResolvedValueOnce(mockPremiumAccess);

      const result = await BusinessOwnerService.getAnalyticsAccess(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics/access", { token: mockToken });
      expect(result.tier).toBe("premium");
      expect(result.features.employeeAnalytics).toBe(true);
    });

    it("should return fallback on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockAllAnalytics);

      const result = await BusinessOwnerService.getAllAnalytics(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics", { token: mockToken });
      expect(result.access.tier).toBe("premium");
      expect(result.overview.bookings.thisMonth).toBe(50);
    });

    it("should pass options as query params", async () => {
      HttpClient.get.mockResolvedValueOnce(mockAllAnalytics);

      await BusinessOwnerService.getAllAnalytics(mockToken, {
        months: 6,
        topClientsLimit: 10,
        churnDays: 30,
      });

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/business-owner/analytics?months=6&topClientsLimit=10&churnDays=30",
        { token: mockToken }
      );
    });

    it("should handle empty options", async () => {
      HttpClient.get.mockResolvedValueOnce(mockAllAnalytics);

      await BusinessOwnerService.getAllAnalytics(mockToken, {});

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics", { token: mockToken });
    });

    it("should return fallback on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockOverview);

      const result = await BusinessOwnerService.getOverviewAnalytics(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics/overview", { token: mockToken });
      expect(result.bookings.thisMonth).toBe(45);
    });

    it("should return empty object on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockEmployeeAnalytics);

      const result = await BusinessOwnerService.getEmployeeAnalytics(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics/employees", { token: mockToken });
      expect(result.employees[0].name).toBe("John Doe");
    });

    it("should pass options as query params", async () => {
      HttpClient.get.mockResolvedValueOnce(mockEmployeeAnalytics);

      await BusinessOwnerService.getEmployeeAnalytics(mockToken, {
        months: 3,
        limit: 10,
      });

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/business-owner/analytics/employees?months=3&limit=10",
        { token: mockToken }
      );
    });

    it("should return fallback on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await BusinessOwnerService.getEmployeeAnalytics(mockToken);

      expect(result).toEqual({ employees: [] });
    });

    it("should handle 403 premium required response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 403,
        error: "Employee analytics requires premium tier",
        requiredTier: "premium",
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
      HttpClient.get.mockResolvedValueOnce(mockClientAnalytics);

      const result = await BusinessOwnerService.getClientAnalytics(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics/clients", { token: mockToken });
      expect(result.totalClients).toBe(25);
    });

    it("should pass options as query params", async () => {
      HttpClient.get.mockResolvedValueOnce(mockClientAnalytics);

      await BusinessOwnerService.getClientAnalytics(mockToken, {
        topClientsLimit: 5,
        churnDays: 60,
      });

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/business-owner/analytics/clients?topClientsLimit=5&churnDays=60",
        { token: mockToken }
      );
    });

    it("should return empty object on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockFinancials);

      const result = await BusinessOwnerService.getFinancialAnalytics(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics/financials", { token: mockToken });
      expect(result.summary.profitMargin).toBe(40.0);
    });

    it("should return empty object on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockTrends);

      const result = await BusinessOwnerService.getTrends(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/analytics/trends", { token: mockToken });
      expect(result.data.length).toBe(2);
    });

    it("should pass period and months options", async () => {
      HttpClient.get.mockResolvedValueOnce(mockTrends);

      await BusinessOwnerService.getTrends(mockToken, {
        period: "weekly",
        months: 12,
      });

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/business-owner/analytics/trends?period=weekly&months=12",
        { token: mockToken }
      );
    });

    it("should return fallback on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockVerifiedStatus);

      const result = await BusinessOwnerService.getVerificationStatus(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/verification/status", { token: mockToken });
      expect(result.isVerified).toBe(true);
      expect(result.businessName).toBe("CleanPro Services");
    });

    it("should return not found on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockEligible);

      const result = await BusinessOwnerService.checkVerificationEligibility(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/verification/eligibility", { token: mockToken });
      expect(result.eligible).toBe(true);
      expect(result.criteria.activeClients.met).toBe(true);
    });

    it("should return ineligible on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await BusinessOwnerService.checkVerificationEligibility(mockToken);

      expect(result).toEqual({ eligible: false });
    });
  });

  // =============================================
  // requestVerification
  // =============================================
  describe("requestVerification", () => {
    it("should request verification successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: true,
        status: "pending",
        message: "Verification request submitted",
      });

      const result = await BusinessOwnerService.requestVerification(mockToken);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/business-owner/verification/request",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe("pending");
    });

    it("should handle already verified error", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Business is already verified",
      });

      const result = await BusinessOwnerService.requestVerification(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Business is already verified");
    });

    it("should return error on network failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await BusinessOwnerService.requestVerification(mockToken);

      expect(result.success).toBe(false);
    });
  });

  // =============================================
  // updateBusinessProfile
  // =============================================
  describe("updateBusinessProfile", () => {
    it("should update profile successfully", async () => {
      HttpClient.put.mockResolvedValueOnce({
        success: true,
        updated: {
          businessDescription: "Professional cleaning",
          businessHighlightOptIn: true,
        },
      });

      const result = await BusinessOwnerService.updateBusinessProfile(mockToken, {
        businessDescription: "Professional cleaning",
        businessHighlightOptIn: true,
      });

      expect(HttpClient.put).toHaveBeenCalledWith(
        "/business-owner/verification/profile",
        {
          businessDescription: "Professional cleaning",
          businessHighlightOptIn: true,
        },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.put.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockConfig);

      const result = await BusinessOwnerService.getVerificationConfig(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/business-owner/verification/config", { token: mockToken });
      expect(result.minActiveClients).toBe(10);
      expect(result.minAverageRating).toBe(4.0);
    });

    it("should return empty object on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await BusinessOwnerService.getVerificationConfig(mockToken);

      expect(result).toEqual({});
    });
  });
});
