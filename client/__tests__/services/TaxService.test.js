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
      expect(result.totalEarningsCents).toBe(150000);
    });

    it("should handle error response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ code: "NOT_FOUND", message: "User not found" }),
      });

      const result = await TaxService.getCleanerTaxSummary(mockToken, 2024);

      expect(result.error).toBe(true);
      expect(result.message).toBe("User not found");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await TaxService.getCleanerTaxSummary(mockToken, 2024);

      expect(result.error).toBe(true);
      expect(result.message).toBe("Network error");
    });
  });

  describe("getTaxInfo", () => {
    it("should fetch tax info (W-9 data) successfully", async () => {
      const mockTaxInfo = {
        legalName: "John Doe",
        businessName: "John's Cleaning",
        taxClassification: "individual",
        address: "123 Main St",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaxInfo),
      });

      const result = await TaxService.getTaxInfo(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/info`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.legalName).toBe("John Doe");
    });

    it("should handle missing tax info", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ code: "NOT_FOUND", message: "Tax info not found" }),
      });

      const result = await TaxService.getTaxInfo(mockToken);

      expect(result.error).toBe(true);
    });
  });

  describe("saveTaxInfo", () => {
    it("should save tax info successfully", async () => {
      const taxInfo = {
        legalName: "John Doe",
        taxId: "123-45-6789",
        address: "123 Main St",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: "Tax info saved" }),
      });

      const result = await TaxService.saveTaxInfo(mockToken, taxInfo);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/info`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify(taxInfo),
        }
      );
      expect(result.success).toBe(true);
    });

    it("should handle validation error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ code: "VALIDATION_ERROR", message: "Invalid tax ID format" }),
      });

      const result = await TaxService.saveTaxInfo(mockToken, {});

      expect(result.error).toBe(true);
      expect(result.message).toBe("Invalid tax ID format");
    });
  });

  describe("get1099Documents", () => {
    it("should fetch 1099 documents successfully", async () => {
      const mockDocs = {
        taxYear: 2024,
        documents: [
          { id: 1, formType: "1099-NEC", status: "generated" },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDocs),
      });

      const result = await TaxService.get1099Documents(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/contractor/1099-nec/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.documents).toHaveLength(1);
    });
  });

  describe("getPaymentHistory", () => {
    it("should fetch payment history for homeowner", async () => {
      const mockHistory = {
        taxYear: 2024,
        totalPaidCents: 500000,
        paymentCount: 10,
        payments: [],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHistory),
      });

      const result = await TaxService.getPaymentHistory(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/payment-history/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.totalPaidCents).toBe(500000);
      expect(result.paymentCount).toBe(10);
    });
  });

  describe("getPlatformIncomeSummary", () => {
    it("should fetch platform income summary for manager", async () => {
      const mockSummary = {
        taxYear: 2024,
        annual: {
          totalPlatformFeesCents: 1000000,
          totalNetEarningsCents: 950000,
          transactionCount: 100,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
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
      expect(result.annual.totalPlatformFeesCents).toBe(1000000);
    });
  });

  describe("getPlatformTaxReport", () => {
    it("should fetch comprehensive platform tax report", async () => {
      const mockReport = {
        taxYear: 2024,
        company: { name: "Cleaning Co" },
        incomeSummary: { annual: { totalPlatformFeesCents: 1000000 } },
        quarterlyTaxes: {
          q1: { totalEstimatedTax: "500.00" },
          q2: { totalEstimatedTax: "600.00" },
          q3: { totalEstimatedTax: "550.00" },
          q4: { totalEstimatedTax: "650.00" },
          totalEstimatedTaxPaid: "2300.00",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockReport),
      });

      const result = await TaxService.getPlatformTaxReport(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/platform/comprehensive-report/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.quarterlyTaxes.totalEstimatedTaxPaid).toBe("2300.00");
    });
  });

  describe("getScheduleCData", () => {
    it("should fetch Schedule C data", async () => {
      const mockScheduleC = {
        taxYear: 2024,
        formType: "Schedule C (Form 1040)",
        partI: {
          line1: { description: "Gross receipts", amountDollars: "10000.00" },
        },
        line31: { description: "Net profit", amountDollars: "9500.00" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockScheduleC),
      });

      const result = await TaxService.getScheduleCData(mockToken, 2024);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/tax/platform/schedule-c/2024`,
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.formType).toBe("Schedule C (Form 1040)");
    });
  });

  describe("getTaxDeadlines", () => {
    it("should fetch tax deadlines", async () => {
      const mockDeadlines = {
        taxYear: 2024,
        deadlines: {
          q1Estimated: { description: "Q1 Estimated Tax", dueDate: "2024-04-15" },
          form1099NEC: { description: "File 1099-NEC", dueDate: "2025-01-31" },
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeadlines),
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
      expect(result.deadlines.q1Estimated).toBeDefined();
    });
  });

  describe("getQuarterlyTax", () => {
    it("should fetch quarterly tax info", async () => {
      const mockQuarterlyTax = {
        taxYear: 2024,
        quarter: 1,
        grossIncome: { cents: 250000, dollars: "2500.00" },
        totalEstimatedTax: "607.20",
        dueDate: "2024-04-15",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuarterlyTax),
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
      expect(result.totalEstimatedTax).toBe("607.20");
    });

    it("should handle invalid quarter", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ code: "INVALID_QUARTER", message: "Quarter must be 1-4" }),
      });

      const result = await TaxService.getQuarterlyTax(mockToken, 2024, 5);

      expect(result.error).toBe(true);
      expect(result.code).toBe("INVALID_QUARTER");
    });
  });
});
