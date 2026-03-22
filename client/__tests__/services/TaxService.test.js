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

// Import after mocking
const TaxService = require("../../src/services/fetchRequests/TaxService").default;

describe("TaxService", () => {
  const mockToken = "test_token_123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getEarnings", () => {
    it("should fetch earnings summary successfully", async () => {
      const mockResponse = {
        taxYear: 2024,
        totalEarningsCents: 150000,
        transactionCount: 25,
        requires1099: true,
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await TaxService.getEarnings(mockToken, 2024);

      expect(HttpClient.get).toHaveBeenCalledWith("/tax/earnings/2024", { token: mockToken });
      expect(result.taxYear).toBe(2024);
      expect(result.totalEarningsCents).toBe(150000);
    });

    it("should handle error response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        code: "NOT_FOUND",
        message: "User not found",
      });

      const result = await TaxService.getEarnings(mockToken, 2024);

      expect(result.error).toBe(true);
      expect(result.message).toBe("User not found");
    });

    it("should handle network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false });

      const result = await TaxService.getEarnings(mockToken, 2024);

      expect(result.error).toBe(true);
    });
  });

  describe("getCleanerTaxSummary", () => {
    it("should fetch cleaner tax summary successfully", async () => {
      const mockResponse = {
        taxYear: 2024,
        totalEarningsCents: 150000,
        jobCount: 25,
        will1099BeIssued: true,
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await TaxService.getCleanerTaxSummary(mockToken, 2024);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/tax/contractor/tax-summary/2024",
        { token: mockToken }
      );
      expect(result.taxYear).toBe(2024);
    });
  });

  describe("getDashboardLink", () => {
    it("should fetch Stripe Dashboard link successfully", async () => {
      const mockResponse = {
        url: "https://connect.stripe.com/express/...",
        expiresAt: "2025-01-15T12:00:00Z",
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await TaxService.getDashboardLink(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/tax/dashboard-link", { token: mockToken });
      expect(result.url).toContain("stripe.com");
    });
  });

  describe("getTaxStatus", () => {
    it("should fetch tax status successfully", async () => {
      const mockResponse = {
        stripeConnected: true,
        onboardingComplete: true,
        taxInfoProvided: true,
        canReceive1099: true,
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await TaxService.getTaxStatus(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/tax/status", { token: mockToken });
      expect(result.stripeConnected).toBe(true);
    });
  });

  describe("getPlatformIncomeSummary", () => {
    it("should fetch platform income summary successfully", async () => {
      const mockResponse = {
        taxYear: 2024,
        grossIncomeCents: 500000,
        platformFeeCents: 50000,
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await TaxService.getPlatformIncomeSummary(mockToken, 2024);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/tax/platform/income-summary/2024",
        { token: mockToken }
      );
      expect(result.taxYear).toBe(2024);
    });
  });

  describe("getQuarterlyTax", () => {
    it("should fetch quarterly tax info successfully", async () => {
      const mockResponse = {
        quarter: 1,
        taxYear: 2024,
        estimatedTax: 2500,
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await TaxService.getQuarterlyTax(mockToken, 2024, 1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/tax/platform/quarterly-tax/2024/1",
        { token: mockToken }
      );
      expect(result.quarter).toBe(1);
    });

    it("should handle invalid quarter", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        code: "INVALID_QUARTER",
        message: "Invalid quarter",
      });

      const result = await TaxService.getQuarterlyTax(mockToken, 2024, 5);

      expect(result.error).toBe(true);
      expect(result.code).toBe("INVALID_QUARTER");
    });
  });

  describe("getTaxDeadlines", () => {
    it("should fetch tax deadlines successfully", async () => {
      const mockResponse = {
        taxYear: 2024,
        deadlines: [
          { quarter: 1, date: "2024-04-15" },
          { quarter: 2, date: "2024-06-17" },
        ],
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await TaxService.getTaxDeadlines(mockToken, 2024);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/tax/platform/deadlines/2024",
        { token: mockToken }
      );
      expect(result.deadlines).toHaveLength(2);
    });
  });
});
