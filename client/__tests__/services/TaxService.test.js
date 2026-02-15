// TaxService API tests

// Mock fetch globally
global.fetch = jest.fn();

// Import after mocking
const TaxService = require("../../src/services/fetchRequests/TaxService").default;

describe("TaxService", () => {
  const mockToken = "test_token_123";
  const baseURL = "http://localhost:3000";

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await TaxService.getEarnings(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/earnings/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.taxYear).toBe(2024);
      expect(result.totalEarningsCents).toBe(150000);
    });

    it("should handle error response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ code: "NOT_FOUND", message: "User not found" }),
      });

      const result = await TaxService.getEarnings(mockToken, 2024);

      expect(result.error).toBe(true);
      expect(result.message).toBe("User not found");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await TaxService.getEarnings(mockToken, 2024);

      expect(result.error).toBe(true);
      expect(result.message).toBe("Network error");
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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await TaxService.getCleanerTaxSummary(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/contractor/tax-summary/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await TaxService.getDashboardLink(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/dashboard-link`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await TaxService.getTaxStatus(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/status`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await TaxService.getPlatformIncomeSummary(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/platform/income-summary/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await TaxService.getQuarterlyTax(mockToken, 2024, 1);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/platform/quarterly-tax/2024/1`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.quarter).toBe(1);
    });

    it("should handle invalid quarter", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: true, code: "INVALID_QUARTER", message: "Invalid quarter" }),
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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await TaxService.getTaxDeadlines(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/platform/deadlines/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.deadlines).toHaveLength(2);
    });
  });
});
