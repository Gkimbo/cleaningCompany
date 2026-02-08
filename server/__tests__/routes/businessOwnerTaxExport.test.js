// Set environment variables before imports
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

const request = require("supertest");
const express = require("express");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  Employer: {
    findOne: jest.fn(),
  },
  Employee: {
    findAll: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserHomes: {
    findAll: jest.fn(),
  },
  Appointment: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  Home: {
    findByPk: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  EmployeeJobAssignment: {
    findAll: jest.fn(),
  },
  BusinessEmployee: {
    findAll: jest.fn(),
  },
  RecurringSchedule: {
    findAll: jest.fn(),
  },
  Payout: {
    findAll: jest.fn(),
  },
  PricingConfig: {
    findOne: jest.fn().mockResolvedValue({
      cleanerSharePercent: 0.9,
      businessOwnerFeePercent: 0.1,
    }),
  },
  sequelize: {
    query: jest.fn().mockResolvedValue([[]]),
    QueryTypes: { SELECT: "SELECT" },
  },
  Op: {
    between: Symbol("between"),
    gte: Symbol("gte"),
    lte: Symbol("lte"),
    or: Symbol("or"),
    and: Symbol("and"),
    in: Symbol("in"),
    ne: Symbol("ne"),
  },
}));

// Mock PayCalculatorService
jest.mock("../../services/PayCalculatorService", () => ({
  getFinancialSummary: jest.fn(),
}));

// Mock verifyBusinessOwner middleware
jest.mock("../../middleware/verifyBusinessOwner", () => (req, res, next) => {
  req.businessOwnerId = 1;
  req.user = { id: 1 };
  next();
});

// Mock other services used by the router
jest.mock("../../services/BusinessEmployeeService", () => ({}));
jest.mock("../../services/EmployeeJobAssignmentService", () => ({}));
jest.mock("../../services/BusinessAnalyticsService", () => ({}));
jest.mock("../../services/BusinessVerificationService", () => ({}));
jest.mock("../../services/CustomJobFlowService", () => ({}));
jest.mock("../../services/EncryptionService", () => ({
  encryptForStorage: jest.fn(x => x),
  decryptFromStorage: jest.fn(x => x),
}));

// Mock serializers
jest.mock("../../serializers/BusinessEmployeeSerializer", () => ({}));
jest.mock("../../serializers/EmployeeJobAssignmentSerializer", () => ({}));
jest.mock("../../serializers/AppointmentSerializer", () => ({}));
jest.mock("../../serializers/CustomJobFlowSerializer", () => ({}));
jest.mock("../../serializers/ClientJobFlowAssignmentSerializer", () => ({}));
jest.mock("../../serializers/CustomJobFlowChecklistSerializer", () => ({}));
jest.mock("../../serializers/TimesheetSerializer", () => ({}));

const PayCalculatorService = require("../../services/PayCalculatorService");

describe("Business Owner Tax Export Routes", () => {
  let app;
  const currentYear = new Date().getFullYear();

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const businessOwnerRouter = require("../../routes/api/v1/businessOwnerRouter");
    app.use("/api/v1/business-owner", businessOwnerRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /tax-export/:year", () => {
    const mockFinancialData = {
      financials: {
        totalRevenue: 1000000,    // $10,000
        platformFees: 100000,     // $1,000
        totalPayroll: 600000,     // $6,000
        stripeFees: 30000,        // $300
        netProfit: 270000,        // $2,700
        completedJobs: 50,
      },
      employeeBreakdown: [
        {
          employee: { id: 1, firstName: "John", lastName: "Doe" },
          jobCount: 30,
          totalPaid: 350000,  // $3,500 - over $600 threshold
          pending: 0,
        },
        {
          employee: { id: 2, firstName: "Jane", lastName: "Smith" },
          jobCount: 20,
          totalPaid: 250000,  // $2,500 - over $600 threshold
          pending: 50000,
        },
        {
          employee: { id: 3, firstName: "Bob", lastName: "Wilson" },
          jobCount: 3,
          totalPaid: 45000,   // $450 - under $600 threshold
          pending: 0,
        },
      ],
    };

    it("should return tax export data for current year", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(currentYear);
      expect(res.body.financials).toBeDefined();
      expect(res.body.employeeBreakdown).toBeDefined();
      expect(res.body.summary).toBeDefined();
    });

    it("should return tax export data for previous year", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear - 1}`);

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(currentYear - 1);
    });

    it("should return tax export data for 2 years ago", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear - 2}`);

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(currentYear - 2);
    });

    it("should return 400 for year older than 2 years", async () => {
      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear - 3}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid year");
    });

    it("should return 400 for future year", async () => {
      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear + 1}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid year");
    });

    it("should return 400 for invalid year format", async () => {
      const res = await request(app).get("/api/v1/business-owner/tax-export/invalid");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid year");
    });

    it("should call PayCalculatorService with correct date range", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(PayCalculatorService.getFinancialSummary).toHaveBeenCalledWith(
        1, // businessOwnerId from mock
        `${currentYear}-01-01`,
        `${currentYear}-12-31`
      );
    });

    it("should include financial summary in response", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.body.financials.totalRevenue).toBe(1000000);
      expect(res.body.financials.totalPayroll).toBe(600000);
      expect(res.body.financials.netProfit).toBe(270000);
      expect(res.body.financials.completedJobs).toBe(50);
    });

    it("should include employee breakdown in response", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.body.employeeBreakdown).toHaveLength(3);
      expect(res.body.employeeBreakdown[0].employee.firstName).toBe("John");
      expect(res.body.employeeBreakdown[0].totalPaid).toBe(350000);
    });

    it("should calculate correct summary totals", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.body.summary.totalEmployees).toBe(3);
      expect(res.body.summary.totalPayroll).toBe(600000);
      expect(res.body.summary.totalRevenue).toBe(1000000);
      expect(res.body.summary.netProfit).toBe(270000);
      expect(res.body.summary.completedJobs).toBe(50);
    });

    it("should correctly count employees requiring 1099 (>= $600)", async () => {
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancialData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      // John ($3,500) and Jane ($2,500) are over $600, Bob ($450) is under
      expect(res.body.summary.employeesRequiring1099).toBe(2);
    });

    it("should handle edge case of exactly $600 threshold", async () => {
      const dataWithThreshold = {
        financials: mockFinancialData.financials,
        employeeBreakdown: [
          {
            employee: { id: 1, firstName: "Exact", lastName: "Threshold" },
            jobCount: 10,
            totalPaid: 60000, // Exactly $600
            pending: 0,
          },
          {
            employee: { id: 2, firstName: "Just", lastName: "Under" },
            jobCount: 9,
            totalPaid: 59999, // $599.99
            pending: 0,
          },
        ],
      };

      PayCalculatorService.getFinancialSummary.mockResolvedValue(dataWithThreshold);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      // Only "Exact Threshold" should count (>= 60000 cents)
      expect(res.body.summary.employeesRequiring1099).toBe(1);
    });

    it("should handle empty employee breakdown", async () => {
      const emptyData = {
        financials: mockFinancialData.financials,
        employeeBreakdown: [],
      };

      PayCalculatorService.getFinancialSummary.mockResolvedValue(emptyData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.body.employeeBreakdown).toHaveLength(0);
      expect(res.body.summary.totalEmployees).toBe(0);
      expect(res.body.summary.employeesRequiring1099).toBe(0);
    });

    it("should handle missing financials data gracefully", async () => {
      const incompleteData = {
        financials: null,
        employeeBreakdown: [],
      };

      PayCalculatorService.getFinancialSummary.mockResolvedValue(incompleteData);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.body.financials).toEqual({});
      expect(res.body.summary.totalPayroll).toBe(0);
      expect(res.body.summary.totalRevenue).toBe(0);
    });

    it("should handle service errors", async () => {
      PayCalculatorService.getFinancialSummary.mockRejectedValue(new Error("Database error"));

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Database error");
    });

    it("should handle employees with null totalPaid", async () => {
      const dataWithNulls = {
        financials: mockFinancialData.financials,
        employeeBreakdown: [
          {
            employee: { id: 1, firstName: "No", lastName: "Pay" },
            jobCount: 0,
            totalPaid: null,
            pending: 0,
          },
        ],
      };

      PayCalculatorService.getFinancialSummary.mockResolvedValue(dataWithNulls);

      const res = await request(app).get(`/api/v1/business-owner/tax-export/${currentYear}`);

      expect(res.body.summary.employeesRequiring1099).toBe(0);
    });
  });
});

describe("Tax Export Year Validation", () => {
  const currentYear = new Date().getFullYear();

  const isValidYear = (year) => {
    const yearNum = parseInt(year);
    if (isNaN(yearNum)) return false;
    return yearNum >= currentYear - 2 && yearNum <= currentYear;
  };

  it("should accept current year", () => {
    expect(isValidYear(currentYear)).toBe(true);
  });

  it("should accept last year", () => {
    expect(isValidYear(currentYear - 1)).toBe(true);
  });

  it("should accept 2 years ago", () => {
    expect(isValidYear(currentYear - 2)).toBe(true);
  });

  it("should reject 3 years ago", () => {
    expect(isValidYear(currentYear - 3)).toBe(false);
  });

  it("should reject future year", () => {
    expect(isValidYear(currentYear + 1)).toBe(false);
  });

  it("should reject non-numeric strings", () => {
    expect(isValidYear("invalid")).toBe(false);
    expect(isValidYear("abc")).toBe(false);
    expect(isValidYear("")).toBe(false);
  });

  it("should handle numeric strings", () => {
    expect(isValidYear(String(currentYear))).toBe(true);
    expect(isValidYear(String(currentYear - 1))).toBe(true);
  });
});

describe("1099 Threshold Calculations", () => {
  const threshold1099 = 60000; // $600 in cents

  const calculateEmployeesRequiring1099 = (employees) => {
    return employees.filter((e) => (e.totalPaid || 0) >= threshold1099).length;
  };

  it("should count employees over $600", () => {
    const employees = [
      { totalPaid: 100000 }, // $1000
      { totalPaid: 60000 },  // $600
      { totalPaid: 50000 },  // $500
    ];

    expect(calculateEmployeesRequiring1099(employees)).toBe(2);
  });

  it("should handle all employees under threshold", () => {
    const employees = [
      { totalPaid: 50000 },
      { totalPaid: 30000 },
      { totalPaid: 10000 },
    ];

    expect(calculateEmployeesRequiring1099(employees)).toBe(0);
  });

  it("should handle all employees over threshold", () => {
    const employees = [
      { totalPaid: 100000 },
      { totalPaid: 200000 },
      { totalPaid: 150000 },
    ];

    expect(calculateEmployeesRequiring1099(employees)).toBe(3);
  });

  it("should handle empty array", () => {
    expect(calculateEmployeesRequiring1099([])).toBe(0);
  });

  it("should handle null totalPaid values", () => {
    const employees = [
      { totalPaid: null },
      { totalPaid: 70000 },
    ];

    expect(calculateEmployeesRequiring1099(employees)).toBe(1);
  });

  it("should handle undefined totalPaid values", () => {
    const employees = [
      { totalPaid: undefined },
      { totalPaid: 80000 },
    ];

    expect(calculateEmployeesRequiring1099(employees)).toBe(1);
  });
});

describe("Date Range Generation", () => {
  const generateDateRange = (year) => {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  };

  it("should generate correct start date", () => {
    const { startDate } = generateDateRange(2024);
    expect(startDate).toBe("2024-01-01");
  });

  it("should generate correct end date", () => {
    const { endDate } = generateDateRange(2024);
    expect(endDate).toBe("2024-12-31");
  });

  it("should handle different years", () => {
    const { startDate, endDate } = generateDateRange(2023);
    expect(startDate).toBe("2023-01-01");
    expect(endDate).toBe("2023-12-31");
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
