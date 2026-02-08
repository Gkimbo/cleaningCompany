/**
 * Tests for Export Service
 * Tests CSV/PDF generation and data preparation for financial reports
 */

// Mock expo modules
jest.mock("expo-file-system", () => ({
  cacheDirectory: "/mock/cache/",
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    UTF8: "utf8",
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-print", () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: "/mock/temp.pdf" }),
}));

jest.mock("papaparse", () => ({
  unparse: jest.fn((data) => {
    // Simple CSV mock
    if (!data || data.length === 0) return "";
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(",")).join("\n");
    return `${headers}\n${rows}`;
  }),
}));

const {
  generateCSV,
  generatePDF,
  generateFinancialSummaryHTML,
  generatePayrollByEmployeeHTML,
  generateEmployeeEarningsHTML,
  generatePayrollSummaryHTML,
  prepareFinancialSummaryCSV,
  preparePayrollByEmployeeCSV,
  prepareEmployeeEarningsCSV,
} = require("../../src/services/exportService");

const FileSystem = require("expo-file-system");
const Sharing = require("expo-sharing");
const Print = require("expo-print");

describe("Export Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Currency Formatting", () => {
    // Helper to test the internal formatCurrency function through prepareFinancialSummaryCSV
    it("should format cents to currency string correctly", () => {
      const data = {
        totalRevenue: 15000, // $150.00
        platformFees: 1500,  // $15.00
        totalPayroll: 10000, // $100.00
        netProfit: 3500,     // $35.00
        completedJobs: 5,
      };

      const result = prepareFinancialSummaryCSV(data);

      expect(result[0].Amount).toBe("$150.00");
      expect(result[1].Amount).toBe("-$15.00");
      expect(result[2].Amount).toBe("-$100.00");
    });

    it("should handle zero amounts", () => {
      const data = {
        totalRevenue: 0,
        platformFees: 0,
        totalPayroll: 0,
        netProfit: 0,
        completedJobs: 0,
      };

      const result = prepareFinancialSummaryCSV(data);

      expect(result[0].Amount).toBe("$0.00");
    });

    it("should handle undefined amounts as zero", () => {
      const data = {};

      const result = prepareFinancialSummaryCSV(data);

      expect(result[0].Amount).toBe("$0.00");
    });

    it("should handle large amounts", () => {
      const data = {
        totalRevenue: 10000000, // $100,000.00
        completedJobs: 100,
      };

      const result = prepareFinancialSummaryCSV(data);

      expect(result[0].Amount).toBe("$100000.00");
    });

    it("should handle decimal cents correctly", () => {
      const data = {
        totalRevenue: 12345, // $123.45
        completedJobs: 1,
      };

      const result = prepareFinancialSummaryCSV(data);

      expect(result[0].Amount).toBe("$123.45");
    });
  });

  describe("generateCSV", () => {
    it("should generate and share CSV file successfully", async () => {
      const data = [
        { Name: "John", Amount: "$100.00" },
        { Name: "Jane", Amount: "$200.00" },
      ];

      const result = await generateCSV(data, "test_export");

      expect(result.success).toBe(true);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining("test_export"),
        expect.objectContaining({
          mimeType: "text/csv",
        })
      );
    });

    it("should return error when sharing is not available", async () => {
      Sharing.isAvailableAsync.mockResolvedValueOnce(false);

      const result = await generateCSV([{ test: "data" }], "test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sharing is not available on this device");
    });

    it("should handle file write errors", async () => {
      FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error("Write failed"));

      const result = await generateCSV([{ test: "data" }], "test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Write failed");
    });

    it("should include date stamp in filename", async () => {
      await generateCSV([{ test: "data" }], "report");

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringMatching(/report_\d{4}-\d{2}-\d{2}\.csv$/),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe("generatePDF", () => {
    it("should generate and share PDF file successfully", async () => {
      const htmlContent = "<html><body>Test</body></html>";

      const result = await generatePDF(htmlContent, "test_report");

      expect(result.success).toBe(true);
      expect(Print.printToFileAsync).toHaveBeenCalledWith({
        html: htmlContent,
        base64: false,
      });
      expect(FileSystem.moveAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining("test_report"),
        expect.objectContaining({
          mimeType: "application/pdf",
        })
      );
    });

    it("should return error when sharing is not available", async () => {
      Sharing.isAvailableAsync.mockResolvedValueOnce(false);

      const result = await generatePDF("<html></html>", "test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sharing is not available on this device");
    });

    it("should handle print errors", async () => {
      Print.printToFileAsync.mockRejectedValueOnce(new Error("Print failed"));

      const result = await generatePDF("<html></html>", "test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Print failed");
    });
  });

  describe("generateFinancialSummaryHTML", () => {
    const mockData = {
      totalRevenue: 50000,     // $500.00
      platformFees: 5000,      // $50.00
      totalPayroll: 30000,     // $300.00
      stripeFees: 1500,        // $15.00
      netProfit: 13500,        // $135.00
      completedJobs: 10,
    };

    it("should generate valid HTML structure", () => {
      const html = generateFinancialSummaryHTML(mockData, "January 2025");

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("</html>");
    });

    it("should include business name in header", () => {
      const html = generateFinancialSummaryHTML(mockData, "January 2025", "Test Cleaning Co");

      expect(html).toContain("Test Cleaning Co");
    });

    it("should include period label", () => {
      const html = generateFinancialSummaryHTML(mockData, "January 2025");

      expect(html).toContain("January 2025");
    });

    it("should include formatted currency values", () => {
      const html = generateFinancialSummaryHTML(mockData, "January 2025");

      expect(html).toContain("$500.00"); // totalRevenue
      expect(html).toContain("$50.00");  // platformFees
      expect(html).toContain("$300.00"); // totalPayroll
      expect(html).toContain("$135.00"); // netProfit
    });

    it("should include completed jobs count", () => {
      const html = generateFinancialSummaryHTML(mockData, "January 2025");

      expect(html).toContain("10 completed jobs");
    });

    it("should include Stripe fees when present", () => {
      const html = generateFinancialSummaryHTML(mockData, "January 2025");

      expect(html).toContain("Stripe Processing Fees");
      expect(html).toContain("$15.00");
    });

    it("should exclude Stripe fees row when zero", () => {
      const dataNoStripe = { ...mockData, stripeFees: 0 };
      const html = generateFinancialSummaryHTML(dataNoStripe, "January 2025");

      expect(html).not.toContain("Stripe Processing Fees");
    });

    it("should handle default values for missing data", () => {
      const html = generateFinancialSummaryHTML({}, "January 2025");

      expect(html).toContain("$0.00");
      expect(html).toContain("0 completed jobs");
    });

    it("should apply positive class to positive net profit", () => {
      const html = generateFinancialSummaryHTML(mockData, "January 2025");

      expect(html).toContain("class=\"amount positive\"");
    });

    it("should apply negative class to negative net profit", () => {
      const negativeData = { ...mockData, netProfit: -5000 };
      const html = generateFinancialSummaryHTML(negativeData, "January 2025");

      expect(html).toContain("class=\"amount negative\"");
    });
  });

  describe("generatePayrollByEmployeeHTML", () => {
    const mockEmployees = [
      {
        employee: { firstName: "John", lastName: "Doe" },
        jobCount: 15,
        totalPaid: 125000,  // $1,250.00
        pending: 15000,     // $150.00
      },
      {
        employee: { firstName: "Jane", lastName: "Smith" },
        jobCount: 12,
        totalPaid: 98000,   // $980.00
        pending: 0,
      },
    ];

    it("should generate valid HTML structure", () => {
      const html = generatePayrollByEmployeeHTML(mockEmployees, "January 2025");

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<table>");
    });

    it("should include employee names", () => {
      const html = generatePayrollByEmployeeHTML(mockEmployees, "January 2025");

      expect(html).toContain("John Doe");
      expect(html).toContain("Jane Smith");
    });

    it("should include job counts", () => {
      const html = generatePayrollByEmployeeHTML(mockEmployees, "January 2025");

      expect(html).toContain(">15<");
      expect(html).toContain(">12<");
    });

    it("should include formatted payment amounts", () => {
      const html = generatePayrollByEmployeeHTML(mockEmployees, "January 2025");

      expect(html).toContain("$1250.00");
      expect(html).toContain("$980.00");
    });

    it("should calculate and display totals", () => {
      const html = generatePayrollByEmployeeHTML(mockEmployees, "January 2025");

      // Total jobs: 15 + 12 = 27
      expect(html).toContain(">27<");
      // Total paid: $1250 + $980 = $2230.00
      expect(html).toContain("$2230.00");
    });

    it("should display employee count in stats", () => {
      const html = generatePayrollByEmployeeHTML(mockEmployees, "January 2025");

      expect(html).toContain(">2<"); // 2 employees
    });

    it("should handle empty employee list", () => {
      const html = generatePayrollByEmployeeHTML([], "January 2025");

      expect(html).toContain(">0<"); // 0 employees
      expect(html).toContain("$0.00"); // Total paid
    });

    it("should handle missing employee data gracefully", () => {
      const incompleteData = [
        { employee: {}, jobCount: 5, totalPaid: 50000 },
        { employee: null, jobCount: 3, totalPaid: 30000 },
      ];

      const html = generatePayrollByEmployeeHTML(incompleteData, "January 2025");

      // Should not throw and should still generate HTML
      expect(html).toContain("<table>");
    });
  });

  describe("generateEmployeeEarningsHTML", () => {
    const mockEmployees = [
      {
        employee: { firstName: "John", lastName: "Doe" },
        jobCount: 50,
        totalPaid: 75000,  // $750.00 - under $600 threshold
      },
      {
        employee: { firstName: "Jane", lastName: "Smith" },
        jobCount: 100,
        totalPaid: 250000,  // $2,500.00 - over $600 threshold
      },
    ];

    it("should generate valid HTML structure", () => {
      const html = generateEmployeeEarningsHTML(mockEmployees, 2025);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Tax Year 2025");
    });

    it("should include 1099 required column", () => {
      const html = generateEmployeeEarningsHTML(mockEmployees, 2025);

      expect(html).toContain("1099 Required");
    });

    it("should mark Yes for earnings >= $600 (60000 cents)", () => {
      const html = generateEmployeeEarningsHTML(mockEmployees, 2025);

      // Jane has $2,500 = 250000 cents > 60000 cents threshold
      expect(html).toContain("Yes");
    });

    it("should mark No for earnings < $600 (60000 cents)", () => {
      // John has $750 = 75000 cents > 60000 cents - wait, that's over the threshold
      // Let me re-check the threshold: The code checks (emp.totalPaid || 0) >= 60000
      // 60000 cents = $600, so $750 (75000 cents) > $600, so it would be Yes

      const employeesWithLowEarnings = [
        {
          employee: { firstName: "Low", lastName: "Earner" },
          jobCount: 5,
          totalPaid: 30000,  // $300.00 - under $600 threshold
        },
      ];

      const html = generateEmployeeEarningsHTML(employeesWithLowEarnings, 2025);

      expect(html).toContain("No");
    });

    it("should include tax information notice", () => {
      const html = generateEmployeeEarningsHTML(mockEmployees, 2025);

      expect(html).toContain("1099-NEC");
      expect(html).toContain("$600");
    });

    it("should include year in footer", () => {
      const html = generateEmployeeEarningsHTML(mockEmployees, 2025);

      expect(html).toContain("tax year 2025");
    });
  });

  describe("generatePayrollSummaryHTML", () => {
    const mockData = {
      totalRevenue: 100000,
      platformFees: 10000,
      totalPayroll: 60000,
      stripeFees: 3000,
      netProfit: 27000,
      completedJobs: 50,
      employeeCount: 5,
    };

    it("should generate valid HTML structure", () => {
      const html = generatePayrollSummaryHTML(mockData, 2025);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Annual Payroll Summary");
    });

    it("should include tax year", () => {
      const html = generatePayrollSummaryHTML(mockData, 2025);

      expect(html).toContain("Tax Year 2025");
    });

    it("should include summary cards with key metrics", () => {
      const html = generatePayrollSummaryHTML(mockData, 2025);

      expect(html).toContain("Gross Revenue");
      expect(html).toContain("Net Profit");
      expect(html).toContain("Total Payroll");
      expect(html).toContain("Jobs Completed");
    });

    it("should include financial breakdown table", () => {
      const html = generatePayrollSummaryHTML(mockData, 2025);

      expect(html).toContain("$1000.00"); // totalRevenue
      expect(html).toContain("$600.00");  // totalPayroll
      expect(html).toContain("$270.00");  // netProfit
    });

    it("should include tax note about 1099-K", () => {
      const html = generatePayrollSummaryHTML(mockData, 2025);

      expect(html).toContain("1099-K");
      expect(html).toContain("Stripe");
    });

    it("should handle zero values", () => {
      const html = generatePayrollSummaryHTML({}, 2025);

      expect(html).toContain("$0.00");
    });
  });

  describe("prepareFinancialSummaryCSV", () => {
    it("should return array of category/amount objects", () => {
      const data = {
        totalRevenue: 10000,
        platformFees: 1000,
        totalPayroll: 5000,
        netProfit: 4000,
        completedJobs: 5,
      };

      const result = prepareFinancialSummaryCSV(data);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("Category");
      expect(result[0]).toHaveProperty("Amount");
    });

    it("should include all required categories", () => {
      const data = {
        totalRevenue: 10000,
        platformFees: 1000,
        totalPayroll: 5000,
        stripeFees: 500,
        netProfit: 3500,
        completedJobs: 5,
      };

      const result = prepareFinancialSummaryCSV(data);
      const categories = result.map(r => r.Category);

      expect(categories).toContain("Gross Revenue");
      expect(categories).toContain("Platform Fees");
      expect(categories).toContain("Employee Payroll");
      expect(categories).toContain("Net Profit");
      expect(categories).toContain("Jobs Completed");
    });

    it("should include Stripe fees when present", () => {
      const data = {
        stripeFees: 500,
        completedJobs: 1,
      };

      const result = prepareFinancialSummaryCSV(data);
      const categories = result.map(r => r.Category);

      expect(categories).toContain("Stripe Fees");
    });

    it("should exclude Stripe fees when zero", () => {
      const data = {
        stripeFees: 0,
        completedJobs: 1,
      };

      const result = prepareFinancialSummaryCSV(data);
      const categories = result.map(r => r.Category);

      expect(categories).not.toContain("Stripe Fees");
    });

    it("should format negative amounts with minus sign", () => {
      const data = {
        platformFees: 1000,
        completedJobs: 1,
      };

      const result = prepareFinancialSummaryCSV(data);
      const platformFeeRow = result.find(r => r.Category === "Platform Fees");

      expect(platformFeeRow.Amount).toBe("-$10.00");
    });

    it("should include completed jobs count as string", () => {
      const data = {
        completedJobs: 42,
      };

      const result = prepareFinancialSummaryCSV(data);
      const jobsRow = result.find(r => r.Category === "Jobs Completed");

      expect(jobsRow.Amount).toBe("42");
    });
  });

  describe("preparePayrollByEmployeeCSV", () => {
    it("should return array of employee data objects", () => {
      const employees = [
        {
          employee: { firstName: "John", lastName: "Doe" },
          jobCount: 10,
          totalPaid: 50000,
          pending: 5000,
        },
      ];

      const result = preparePayrollByEmployeeCSV(employees);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it("should include all required fields", () => {
      const employees = [
        {
          employee: { firstName: "John", lastName: "Doe" },
          jobCount: 10,
          totalPaid: 50000,
          pending: 5000,
        },
      ];

      const result = preparePayrollByEmployeeCSV(employees);

      expect(result[0]).toHaveProperty("Employee Name");
      expect(result[0]).toHaveProperty("Jobs Completed");
      expect(result[0]).toHaveProperty("Total Paid");
      expect(result[0]).toHaveProperty("Pending");
    });

    it("should combine first and last name", () => {
      const employees = [
        {
          employee: { firstName: "John", lastName: "Doe" },
          jobCount: 10,
          totalPaid: 50000,
          pending: 0,
        },
      ];

      const result = preparePayrollByEmployeeCSV(employees);

      expect(result[0]["Employee Name"]).toBe("John Doe");
    });

    it("should format currency values", () => {
      const employees = [
        {
          employee: { firstName: "Test", lastName: "User" },
          jobCount: 5,
          totalPaid: 12345,
          pending: 6789,
        },
      ];

      const result = preparePayrollByEmployeeCSV(employees);

      expect(result[0]["Total Paid"]).toBe("$123.45");
      expect(result[0]["Pending"]).toBe("$67.89");
    });

    it("should handle missing employee data", () => {
      const employees = [
        {
          employee: {},
          jobCount: 5,
          totalPaid: 10000,
          pending: 0,
        },
      ];

      const result = preparePayrollByEmployeeCSV(employees);

      expect(result[0]["Employee Name"]).toBe("");
    });

    it("should handle null values", () => {
      const employees = [
        {
          employee: { firstName: "John" },
          jobCount: null,
          totalPaid: null,
          pending: null,
        },
      ];

      const result = preparePayrollByEmployeeCSV(employees);

      expect(result[0]["Jobs Completed"]).toBe(0);
      expect(result[0]["Total Paid"]).toBe("$0.00");
      expect(result[0]["Pending"]).toBe("$0.00");
    });
  });

  describe("prepareEmployeeEarningsCSV", () => {
    it("should return array of employee earnings data", () => {
      const employees = [
        {
          employee: { firstName: "John", lastName: "Doe" },
          jobCount: 50,
          totalPaid: 100000,
        },
      ];

      const result = prepareEmployeeEarningsCSV(employees, 2025);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it("should include tax year", () => {
      const employees = [
        {
          employee: { firstName: "John", lastName: "Doe" },
          jobCount: 50,
          totalPaid: 100000,
        },
      ];

      const result = prepareEmployeeEarningsCSV(employees, 2025);

      expect(result[0]["Tax Year"]).toBe(2025);
    });

    it("should include 1099 Required field", () => {
      const employees = [
        {
          employee: { firstName: "John", lastName: "Doe" },
          jobCount: 50,
          totalPaid: 100000, // $1000 > $600
        },
      ];

      const result = prepareEmployeeEarningsCSV(employees, 2025);

      expect(result[0]["1099 Required"]).toBe("Yes");
    });

    it("should mark No for earnings under $600", () => {
      const employees = [
        {
          employee: { firstName: "Low", lastName: "Earner" },
          jobCount: 3,
          totalPaid: 30000, // $300 < $600
        },
      ];

      const result = prepareEmployeeEarningsCSV(employees, 2025);

      expect(result[0]["1099 Required"]).toBe("No");
    });

    it("should mark Yes for earnings at exactly $600", () => {
      const employees = [
        {
          employee: { firstName: "Threshold", lastName: "Earner" },
          jobCount: 10,
          totalPaid: 60000, // $600 exactly
        },
      ];

      const result = prepareEmployeeEarningsCSV(employees, 2025);

      expect(result[0]["1099 Required"]).toBe("Yes");
    });

    it("should handle multiple employees with mixed thresholds", () => {
      const employees = [
        {
          employee: { firstName: "Under", lastName: "Threshold" },
          jobCount: 2,
          totalPaid: 40000, // $400
        },
        {
          employee: { firstName: "Over", lastName: "Threshold" },
          jobCount: 20,
          totalPaid: 150000, // $1500
        },
      ];

      const result = prepareEmployeeEarningsCSV(employees, 2025);

      expect(result[0]["1099 Required"]).toBe("No");
      expect(result[1]["1099 Required"]).toBe("Yes");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large numbers without overflow", () => {
      const data = {
        totalRevenue: 999999999, // ~$10 million
        completedJobs: 10000,
      };

      const result = prepareFinancialSummaryCSV(data);

      expect(result[0].Amount).toBe("$9999999.99");
    });

    it("should handle empty arrays", () => {
      const result = preparePayrollByEmployeeCSV([]);

      expect(result).toHaveLength(0);
    });

    it("should handle special characters in names", () => {
      const employees = [
        {
          employee: { firstName: "O'Brien", lastName: "McDonald-Smith" },
          jobCount: 5,
          totalPaid: 50000,
          pending: 0,
        },
      ];

      const result = preparePayrollByEmployeeCSV(employees);

      expect(result[0]["Employee Name"]).toBe("O'Brien McDonald-Smith");
    });
  });
});
