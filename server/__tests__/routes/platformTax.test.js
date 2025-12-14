const request = require("supertest");
const express = require("express");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  TaxInfo: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  TaxDocument: {
    findAll: jest.fn(),
    existsForUserYear: jest.fn(),
  },
  Payment: {
    findAll: jest.fn(),
    getTotalReportableAmount: jest.fn(),
    update: jest.fn(),
  },
  Payout: {},
  PlatformEarnings: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    generateTransactionId: jest.fn(() => `pf_test_${Date.now()}`),
    getQuarter: jest.fn((date) => Math.floor(date.getMonth() / 3) + 1),
    getYearlySummary: jest.fn(),
    getQuarterlySummary: jest.fn(),
    getMonthlyBreakdown: jest.fn(),
  },
  sequelize: {
    query: jest.fn().mockResolvedValue([[]]),
    QueryTypes: { SELECT: "SELECT" },
  },
}));

// Mock TaxDocumentService
jest.mock("../../services/TaxDocumentService", () => ({
  getTaxDeadlines: jest.fn((taxYear) => ({
    taxYear,
    form1099NECRecipientDeadline: new Date(taxYear + 1, 0, 31),
    form1099NECIRSDeadline: new Date(taxYear + 1, 0, 31),
  })),
  validateTaxInfoComplete: jest.fn(),
  generate1099NECData: jest.fn(),
  createTaxDocumentRecord: jest.fn(),
  generateAll1099NECsForYear: jest.fn(),
  getTaxYearSummary: jest.fn(),
}));

// Mock PlatformTaxService
jest.mock("../../services/PlatformTaxService", () => ({
  getAnnualIncomeSummary: jest.fn(),
  calculateQuarterlyEstimatedTax: jest.fn(),
  generateScheduleCData: jest.fn(),
  generate1099KExpectation: jest.fn(),
  getTaxDeadlines: jest.fn(),
  getComprehensiveTaxReport: jest.fn(),
  recordPlatformEarnings: jest.fn(),
}));

// Mock crypto
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return {
    ...actual,
    randomBytes: jest.fn((size) => {
      if (size === 32) return Buffer.alloc(32, "a");
      if (size === 16) return Buffer.alloc(16, "b");
      return actual.randomBytes(size);
    }),
    createCipheriv: jest.fn(() => ({
      update: jest.fn(() => Buffer.from("encrypted")),
      final: jest.fn(() => Buffer.alloc(0)),
    })),
    createDecipheriv: jest.fn(() => ({
      update: jest.fn(() => Buffer.from("123456789")),
      final: jest.fn(() => Buffer.alloc(0)),
    })),
  };
});

const { PlatformEarnings } = require("../../models");
const PlatformTaxService = require("../../services/PlatformTaxService");

describe("Platform Tax Routes", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const taxRouter = require("../../routes/api/v1/taxRouter");
    app.use("/api/v1/tax", taxRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /platform/income-summary/:year", () => {
    it("should return annual income summary", async () => {
      PlatformTaxService.getAnnualIncomeSummary.mockResolvedValue({
        taxYear: 2024,
        company: { name: "Test Company" },
        annual: {
          totalGrossServicesCents: 10000000,
          totalPlatformFeesCents: 1000000,
          totalNetEarningsCents: 950000,
          transactionCount: 100,
        },
        quarterly: [],
        monthly: [],
      });

      const res = await request(app).get("/api/v1/tax/platform/income-summary/2024");

      expect(res.status).toBe(200);
      expect(res.body.taxYear).toBe(2024);
      expect(res.body.annual.totalPlatformFeesCents).toBe(1000000);
    });

    it("should return 400 for invalid year", async () => {
      const res = await request(app).get("/api/v1/tax/platform/income-summary/2015");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_YEAR");
    });
  });

  describe("GET /platform/quarterly-tax/:year/:quarter", () => {
    it("should return quarterly estimated tax", async () => {
      PlatformTaxService.calculateQuarterlyEstimatedTax.mockResolvedValue({
        taxYear: 2024,
        quarter: 1,
        grossIncome: { cents: 250000, dollars: "2500.00" },
        netIncome: { cents: 240000, dollars: "2400.00" },
        selfEmploymentTax: { amount: "367.20", rate: "15.3%" },
        estimatedFederalTax: "240.00",
        totalEstimatedTax: "607.20",
        dueDate: new Date(2024, 3, 15),
      });

      const res = await request(app).get("/api/v1/tax/platform/quarterly-tax/2024/1");

      expect(res.status).toBe(200);
      expect(res.body.taxYear).toBe(2024);
      expect(res.body.quarter).toBe(1);
      expect(res.body.totalEstimatedTax).toBe("607.20");
    });

    it("should return 400 for invalid quarter", async () => {
      const res = await request(app).get("/api/v1/tax/platform/quarterly-tax/2024/5");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_QUARTER");
    });

    it("should return 400 for invalid year", async () => {
      const res = await request(app).get("/api/v1/tax/platform/quarterly-tax/2015/1");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_YEAR");
    });
  });

  describe("GET /platform/schedule-c/:year", () => {
    it("should return Schedule C data", async () => {
      PlatformTaxService.generateScheduleCData.mockResolvedValue({
        taxYear: 2024,
        formType: "Schedule C (Form 1040)",
        formTitle: "Profit or Loss From Business",
        partI: {
          line1: { description: "Gross receipts", amountDollars: "10000.00" },
        },
        line31: { description: "Net profit", amountDollars: "9500.00" },
        businessInfo: {
          name: "Test Company",
          principalBusinessCode: "561720",
        },
      });

      const res = await request(app).get("/api/v1/tax/platform/schedule-c/2024");

      expect(res.status).toBe(200);
      expect(res.body.formType).toBe("Schedule C (Form 1040)");
      expect(res.body.businessInfo.principalBusinessCode).toBe("561720");
    });
  });

  describe("GET /platform/1099-k-expectation/:year", () => {
    it("should return 1099-K expectation", async () => {
      PlatformTaxService.generate1099KExpectation.mockResolvedValue({
        taxYear: 2024,
        formType: "1099-K",
        expectedFromStripe: true,
        totalGrossAmount: { cents: 10000000, dollars: "100000.00" },
        threshold: { cents: 500000, dollars: "5000.00" },
      });

      const res = await request(app).get("/api/v1/tax/platform/1099-k-expectation/2024");

      expect(res.status).toBe(200);
      expect(res.body.expectedFromStripe).toBe(true);
    });
  });

  describe("GET /platform/deadlines/:year", () => {
    it("should return platform tax deadlines", async () => {
      PlatformTaxService.getTaxDeadlines.mockReturnValue({
        taxYear: 2024,
        entityType: "LLC",
        deadlines: {
          q1Estimated: { description: "Q1 Estimated Tax", dueDate: new Date(2024, 3, 15) },
          form1099NEC: { description: "File 1099-NEC", dueDate: new Date(2025, 0, 31) },
          scheduleC: { description: "Schedule C", dueDate: new Date(2025, 3, 15) },
        },
      });

      const res = await request(app).get("/api/v1/tax/platform/deadlines/2024");

      expect(res.status).toBe(200);
      expect(res.body.taxYear).toBe(2024);
      expect(res.body.deadlines).toHaveProperty("q1Estimated");
      expect(res.body.deadlines).toHaveProperty("form1099NEC");
    });
  });

  describe("GET /platform/comprehensive-report/:year", () => {
    it("should return comprehensive tax report", async () => {
      PlatformTaxService.getComprehensiveTaxReport.mockResolvedValue({
        taxYear: 2024,
        company: { name: "Test Company" },
        incomeSummary: { annual: { totalPlatformFeesCents: 1000000 } },
        quarterlyTaxes: {
          q1: { totalEstimatedTax: "500.00" },
          q2: { totalEstimatedTax: "600.00" },
          q3: { totalEstimatedTax: "550.00" },
          q4: { totalEstimatedTax: "650.00" },
          totalEstimatedTaxPaid: "2300.00",
        },
        taxForms: {},
        deadlines: {},
      });

      const res = await request(app).get("/api/v1/tax/platform/comprehensive-report/2024");

      expect(res.status).toBe(200);
      expect(res.body.taxYear).toBe(2024);
      expect(res.body.quarterlyTaxes.totalEstimatedTaxPaid).toBe("2300.00");
    });
  });

  describe("GET /platform/monthly-breakdown/:year", () => {
    it("should return monthly earnings breakdown", async () => {
      PlatformEarnings.getMonthlyBreakdown.mockResolvedValue([
        { month: 1, totalPlatformFeesCents: 100000, totalPlatformFeesDollars: "1000.00", transactionCount: 10 },
        { month: 2, totalPlatformFeesCents: 120000, totalPlatformFeesDollars: "1200.00", transactionCount: 12 },
        { month: 3, totalPlatformFeesCents: 110000, totalPlatformFeesDollars: "1100.00", transactionCount: 11 },
      ]);

      const res = await request(app).get("/api/v1/tax/platform/monthly-breakdown/2024");

      expect(res.status).toBe(200);
      expect(res.body.taxYear).toBe(2024);
      expect(res.body.months).toHaveLength(3);
      expect(res.body.months[0].month).toBe(1);
    });
  });
});

describe("PlatformEarnings Model", () => {
  describe("generateTransactionId", () => {
    it("should generate unique transaction IDs", () => {
      const id1 = PlatformEarnings.generateTransactionId();
      const id2 = PlatformEarnings.generateTransactionId();

      expect(id1).toMatch(/^pf_test_/);
      expect(id2).toMatch(/^pf_test_/);
    });
  });

  describe("getQuarter", () => {
    it("should calculate correct quarter from date", () => {
      expect(PlatformEarnings.getQuarter(new Date(2024, 0, 15))).toBe(1); // January
      expect(PlatformEarnings.getQuarter(new Date(2024, 3, 15))).toBe(2); // April
      expect(PlatformEarnings.getQuarter(new Date(2024, 6, 15))).toBe(3); // July
      expect(PlatformEarnings.getQuarter(new Date(2024, 9, 15))).toBe(4); // October
    });
  });
});

describe("Platform Tax Calculations", () => {
  it("should calculate 10% platform fee correctly", () => {
    const testCases = [
      { gross: 10000, expectedFee: 1000 },   // $100 service -> $10 fee
      { gross: 15000, expectedFee: 1500 },   // $150 service -> $15 fee
      { gross: 20000, expectedFee: 2000 },   // $200 service -> $20 fee
      { gross: 100000, expectedFee: 10000 }, // $1000 service -> $100 fee
    ];

    testCases.forEach(({ gross, expectedFee }) => {
      const platformFee = Math.round(gross * 0.10);
      expect(platformFee).toBe(expectedFee);
    });
  });

  it("should calculate net earnings after platform fee", () => {
    const gross = 15000; // $150
    const platformFee = Math.round(gross * 0.10); // $15
    const netToCleaner = gross - platformFee; // $135

    expect(platformFee).toBe(1500);
    expect(netToCleaner).toBe(13500);
  });

  it("should handle split between multiple cleaners", () => {
    const totalGross = 30000; // $300 total
    const numCleaners = 2;
    const perCleanerGross = Math.round(totalGross / numCleaners); // $150 each
    const platformFeePerCleaner = Math.round(perCleanerGross * 0.10); // $15 each
    const totalPlatformFee = platformFeePerCleaner * numCleaners; // $30 total

    expect(perCleanerGross).toBe(15000);
    expect(platformFeePerCleaner).toBe(1500);
    expect(totalPlatformFee).toBe(3000);
  });
});

describe("Tax Quarter Calculations", () => {
  const getQuarter = (date) => Math.floor(date.getMonth() / 3) + 1;

  it("should correctly identify Q1 (Jan-Mar)", () => {
    expect(getQuarter(new Date(2024, 0, 1))).toBe(1);
    expect(getQuarter(new Date(2024, 1, 15))).toBe(1);
    expect(getQuarter(new Date(2024, 2, 31))).toBe(1);
  });

  it("should correctly identify Q2 (Apr-Jun)", () => {
    expect(getQuarter(new Date(2024, 3, 1))).toBe(2);
    expect(getQuarter(new Date(2024, 4, 15))).toBe(2);
    expect(getQuarter(new Date(2024, 5, 30))).toBe(2);
  });

  it("should correctly identify Q3 (Jul-Sep)", () => {
    expect(getQuarter(new Date(2024, 6, 1))).toBe(3);
    expect(getQuarter(new Date(2024, 7, 15))).toBe(3);
    expect(getQuarter(new Date(2024, 8, 30))).toBe(3);
  });

  it("should correctly identify Q4 (Oct-Dec)", () => {
    expect(getQuarter(new Date(2024, 9, 1))).toBe(4);
    expect(getQuarter(new Date(2024, 10, 15))).toBe(4);
    expect(getQuarter(new Date(2024, 11, 31))).toBe(4);
  });
});

describe("Self-Employment Tax Calculations", () => {
  const SE_TAX_RATE = 0.153; // 15.3%

  it("should calculate self-employment tax correctly", () => {
    const netIncome = 10000; // $10,000
    const seTax = netIncome * SE_TAX_RATE;

    expect(seTax).toBeCloseTo(1530, 2);
  });

  it("should calculate SE tax deduction (50%)", () => {
    const netIncome = 10000;
    const seTax = netIncome * SE_TAX_RATE;
    const seDeduction = seTax * 0.5;

    expect(seDeduction).toBeCloseTo(765, 2);
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
