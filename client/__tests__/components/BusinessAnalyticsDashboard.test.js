/**
 * Tests for BusinessAnalyticsDashboard Component
 * Tests the business analytics dashboard functionality and rendering
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/fetchRequests/BusinessOwnerService", () => ({
  getAllAnalytics: jest.fn(),
}));

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 100: "#e0e0ff", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
    secondary: { 600: "#0d9488" },
    success: { 100: "#dcfce7", 600: "#16a34a", 700: "#15803d" },
    error: { 50: "#fef2f2", 100: "#fee2e2", 600: "#dc2626", 700: "#b91c1c" },
    warning: { 100: "#fef3c7", 500: "#f59e0b", 600: "#d97706", 700: "#b45309" },
    neutral: { 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 400: "#a3a3a3", 500: "#737373", 600: "#525252" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#a3a3a3" },
    background: { primary: "#ffffff", secondary: "#f5f5f5" },
    border: { light: "#e5e5e5", DEFAULT: "#d4d4d4" },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "4xl": 64 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {} },
}));

import BusinessOwnerService from "../../src/services/fetchRequests/BusinessOwnerService";

// Import component after mocks
const BusinessAnalyticsDashboard = require("../../src/components/businessOwner/BusinessAnalyticsDashboard").default;

describe("BusinessAnalyticsDashboard Component", () => {
  const mockState = {
    currentUser: {
      token: "test-token",
      id: 1,
    },
  };

  const mockPremiumAnalytics = {
    access: {
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
        currentCleanings: 55,
        threshold: 50,
        cleaningsNeeded: 0,
      },
    },
    overview: {
      bookings: { thisMonth: 55, changePercent: 10.5 },
      revenue: { thisMonthFormatted: "$5,500", changePercent: 15.2 },
      averageJobValueFormatted: "$100",
      activeEmployees: 5,
      activeClients: 25,
    },
    employees: {
      employees: [
        {
          employeeId: 1,
          name: "John Doe",
          jobsCompleted: 20,
          totalRevenueFormatted: "$2,000",
          avgRating: 4.8,
          completionRate: 98,
        },
        {
          employeeId: 2,
          name: "Jane Smith",
          jobsCompleted: 15,
          totalRevenueFormatted: "$1,500",
          avgRating: 4.9,
          completionRate: 100,
        },
      ],
    },
    clients: {
      totalClients: 25,
      newClientsThisMonth: 5,
      metrics: { retentionRate: 85 },
      atRiskClients: [
        { clientId: 1, name: "At Risk Client", daysSinceLastBooking: 45, bookingCount: 3, totalRevenueFormatted: "$300" },
      ],
      atRiskCount: 1,
      topClients: [
        { clientId: 2, name: "Top Client", bookingCount: 10, totalRevenueFormatted: "$1,000" },
      ],
    },
    financials: {
      summary: {
        grossRevenueFormatted: "$5,500",
        platformFeesFormatted: "$550",
        platformFeePercent: 10,
        totalPayrollFormatted: "$2,500",
        netProfitFormatted: "$2,450",
        netProfit: 245000,
        profitMargin: 44.5,
      },
      periods: {
        thisWeek: {
          grossRevenue: 150000,
          grossRevenueFormatted: "$1,500.00",
          platformFees: 15000,
          platformFeesFormatted: "$150.00",
          totalPayroll: 70000,
          totalPayrollFormatted: "$700.00",
          netProfit: 65000,
          netProfitFormatted: "$650.00",
          profitMargin: 43.3,
          jobCount: 10,
        },
        thisMonth: {
          grossRevenue: 550000,
          grossRevenueFormatted: "$5,500.00",
          platformFees: 55000,
          platformFeesFormatted: "$550.00",
          totalPayroll: 250000,
          totalPayrollFormatted: "$2,500.00",
          netProfit: 245000,
          netProfitFormatted: "$2,450.00",
          profitMargin: 44.5,
          jobCount: 55,
        },
        lastMonth: {
          grossRevenue: 480000,
          grossRevenueFormatted: "$4,800.00",
          platformFees: 48000,
          platformFeesFormatted: "$480.00",
          totalPayroll: 220000,
          totalPayrollFormatted: "$2,200.00",
          netProfit: 212000,
          netProfitFormatted: "$2,120.00",
          profitMargin: 44.2,
          jobCount: 48,
        },
        allTime: {
          grossRevenue: 2500000,
          grossRevenueFormatted: "$25,000.00",
          platformFees: 250000,
          platformFeesFormatted: "$2,500.00",
          totalPayroll: 1100000,
          totalPayrollFormatted: "$11,000.00",
          netProfit: 1150000,
          netProfitFormatted: "$11,500.00",
          profitMargin: 46.0,
          jobCount: 250,
        },
      },
      pending: {
        grossRevenue: 80000,
        grossRevenueFormatted: "$800.00",
        platformFees: 8000,
        platformFeesFormatted: "$80.00",
        totalPayroll: 35000,
        totalPayrollFormatted: "$350.00",
        netProfit: 37000,
        netProfitFormatted: "$370.00",
        profitMargin: 46.3,
        jobCount: 8,
      },
      payrollStatus: {
        paid: 200000,
        paidFormatted: "$2,000.00",
        pending: 50000,
        pendingFormatted: "$500.00",
      },
      clientPayments: {
        collected: 500000,
        collectedFormatted: "$5,000.00",
        outstanding: 50000,
        outstandingFormatted: "$500.00",
      },
      feeTier: {
        current: "large_business",
        feePercent: 7,
        qualifiesForDiscount: true,
        cleaningsToQualify: 0,
      },
    },
    trends: {
      data: [
        { period: "Jan 2024", revenue: 450000, bookings: 45 },
        { period: "Feb 2024", revenue: 480000, bookings: 48 },
        { period: "Mar 2024", revenue: 520000, bookings: 52 },
        { period: "Apr 2024", revenue: 500000, bookings: 50 },
        { period: "May 2024", revenue: 530000, bookings: 53 },
        { period: "Jun 2024", revenue: 550000, bookings: 55 },
      ],
    },
  };

  const mockStandardAnalytics = {
    access: {
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
        currentCleanings: 25,
        threshold: 50,
        cleaningsNeeded: 25,
      },
    },
    overview: {
      bookings: { thisMonth: 25, changePercent: 5.0 },
      revenue: { thisMonthFormatted: "$2,500", changePercent: 8.0 },
      averageJobValueFormatted: "$100",
      activeEmployees: 2,
      activeClients: 10,
    },
    employees: null,
    clients: null,
    financials: {
      periods: {
        thisWeek: {
          grossRevenue: 50000,
          grossRevenueFormatted: "$500.00",
          platformFees: 5000,
          platformFeesFormatted: "$50.00",
          totalPayroll: 22000,
          totalPayrollFormatted: "$220.00",
          netProfit: 23000,
          netProfitFormatted: "$230.00",
          profitMargin: 46.0,
          jobCount: 5,
        },
        thisMonth: {
          grossRevenue: 250000,
          grossRevenueFormatted: "$2,500.00",
          platformFees: 25000,
          platformFeesFormatted: "$250.00",
          totalPayroll: 110000,
          totalPayrollFormatted: "$1,100.00",
          netProfit: 115000,
          netProfitFormatted: "$1,150.00",
          profitMargin: 46.0,
          jobCount: 25,
        },
        lastMonth: {
          grossRevenue: 200000,
          grossRevenueFormatted: "$2,000.00",
          platformFees: 20000,
          platformFeesFormatted: "$200.00",
          totalPayroll: 90000,
          totalPayrollFormatted: "$900.00",
          netProfit: 90000,
          netProfitFormatted: "$900.00",
          profitMargin: 45.0,
          jobCount: 20,
        },
        allTime: {
          grossRevenue: 500000,
          grossRevenueFormatted: "$5,000.00",
          platformFees: 50000,
          platformFeesFormatted: "$500.00",
          totalPayroll: 220000,
          totalPayrollFormatted: "$2,200.00",
          netProfit: 230000,
          netProfitFormatted: "$2,300.00",
          profitMargin: 46.0,
          jobCount: 50,
        },
      },
      pending: {
        grossRevenue: 30000,
        grossRevenueFormatted: "$300.00",
        platformFees: 3000,
        platformFeesFormatted: "$30.00",
        totalPayroll: 13000,
        totalPayrollFormatted: "$130.00",
        netProfit: 14000,
        netProfitFormatted: "$140.00",
        profitMargin: 46.7,
        jobCount: 3,
      },
      payrollStatus: {
        paid: 100000,
        paidFormatted: "$1,000.00",
        pending: 10000,
        pendingFormatted: "$100.00",
      },
      clientPayments: {
        collected: 230000,
        collectedFormatted: "$2,300.00",
        outstanding: 20000,
        outstandingFormatted: "$200.00",
      },
      feeTier: {
        current: "business_owner",
        feePercent: 10,
        qualifiesForDiscount: false,
        cleaningsToQualify: 25,
      },
    },
    trends: {
      data: [
        { period: "Jun 2024", revenue: 2500 },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading indicator initially", () => {
      BusinessOwnerService.getAllAnalytics.mockImplementation(
        () => new Promise(() => {})
      );

      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      expect(getByText("Loading analytics...")).toBeTruthy();
    });
  });

  describe("Premium Tier Display", () => {
    it("should display premium badge for premium tier", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockPremiumAnalytics);

      const { getAllByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        // Premium may appear in multiple places (badge, tier info, etc.)
        expect(getAllByText("Premium").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should display overview metrics", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockPremiumAnalytics);

      const { getAllByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        // "Analytics" may appear multiple times (header, premium analytics text)
        expect(getAllByText(/Analytics/).length).toBeGreaterThanOrEqual(1);
        // 55 appears in both overview (bookings) and financials (job count)
        expect(getAllByText("55").length).toBeGreaterThanOrEqual(1);
        // $5,500 may appear in chart summary as well as overview
        expect(getAllByText("$5,500").length).toBeGreaterThanOrEqual(1);
        expect(getAllByText("$100").length).toBeGreaterThanOrEqual(1); // Avg job value
      });
    });

    it("should display employee performance data for premium tier", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockPremiumAnalytics);

      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Top Performers")).toBeTruthy();
        expect(getByText("John Doe")).toBeTruthy();
        expect(getByText("Jane Smith")).toBeTruthy();
      });
    });

    it("should display client insights for premium tier", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockPremiumAnalytics);

      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Client Insights")).toBeTruthy();
        expect(getByText("25")).toBeTruthy(); // Total clients
        expect(getByText("Top Client")).toBeTruthy();
      });
    });

    it("should display financial summary for premium tier", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockPremiumAnalytics);

      const { getByText, getAllByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Financial Summary")).toBeTruthy();
        expect(getByText("Gross Revenue")).toBeTruthy();
        expect(getByText("Net Profit")).toBeTruthy();
        // Net profit appears in quick stat and profit result
        expect(getAllByText("$2,450.00").length).toBeGreaterThanOrEqual(1);
        expect(getByText("44.5% margin")).toBeTruthy();
      });
    });
  });

  describe("Standard Tier Display", () => {
    it("should display standard badge for standard tier", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockStandardAnalytics);

      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Standard")).toBeTruthy();
      });
    });

    it("should display tier progress bar for standard tier", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockStandardAnalytics);

      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("25 / 50 cleanings this month")).toBeTruthy();
        expect(getByText("Complete 25 more to unlock:")).toBeTruthy();
      });
    });

    it("should show premium lock for employee analytics on standard tier", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockStandardAnalytics);

      const { getAllByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getAllByText("Premium Feature")).toBeTruthy();
      });
    });

    it("should show cleanings needed message in premium lock", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockStandardAnalytics);

      const { getAllByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        const messages = getAllByText(/Complete 25 more.*to unlock/);
        expect(messages.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Error Handling", () => {
    it("should display error message on fetch failure", async () => {
      BusinessOwnerService.getAllAnalytics.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Failed to load analytics")).toBeTruthy();
        expect(getByText("Retry")).toBeTruthy();
      });
    });

    it("should retry fetch on retry button press", async () => {
      BusinessOwnerService.getAllAnalytics.mockRejectedValueOnce(new Error("Network error"));
      BusinessOwnerService.getAllAnalytics.mockResolvedValueOnce(mockPremiumAnalytics);

      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });

      fireEvent.press(getByText("Retry"));

      await waitFor(() => {
        expect(BusinessOwnerService.getAllAnalytics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("API Calls", () => {
    it("should fetch analytics with correct parameters", async () => {
      BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockPremiumAnalytics);

      render(<BusinessAnalyticsDashboard state={mockState} />);

      await waitFor(() => {
        expect(BusinessOwnerService.getAllAnalytics).toHaveBeenCalledWith(
          "test-token",
          { months: 6 }
        );
      });
    });
  });
});

describe("BusinessAnalyticsDashboard Helper Components Logic", () => {
  describe("MetricCard Change Display", () => {
    const getChangeStyle = (change) => {
      return {
        isPositive: change >= 0,
        icon: change >= 0 ? "arrow-up" : "arrow-down",
        displayValue: Math.abs(change),
      };
    };

    it("should show positive change correctly", () => {
      const result = getChangeStyle(10.5);
      expect(result.isPositive).toBe(true);
      expect(result.icon).toBe("arrow-up");
      expect(result.displayValue).toBe(10.5);
    });

    it("should show negative change correctly", () => {
      const result = getChangeStyle(-5.3);
      expect(result.isPositive).toBe(false);
      expect(result.icon).toBe("arrow-down");
      expect(result.displayValue).toBe(5.3);
    });

    it("should handle zero change as positive", () => {
      const result = getChangeStyle(0);
      expect(result.isPositive).toBe(true);
    });
  });

  describe("SimpleBarChart Logic", () => {
    const calculateBarHeight = (value, maxValue) => {
      return maxValue > 0 ? (value / maxValue) * 100 : 0;
    };

    it("should calculate bar heights correctly", () => {
      const data = [
        { revenue: 4500 },
        { revenue: 5500 }, // max
        { revenue: 5000 },
      ];
      const maxValue = Math.max(...data.map((d) => d.revenue));

      expect(calculateBarHeight(4500, maxValue)).toBeCloseTo(81.82, 1);
      expect(calculateBarHeight(5500, maxValue)).toBe(100);
      expect(calculateBarHeight(5000, maxValue)).toBeCloseTo(90.91, 1);
    });

    it("should handle empty data", () => {
      expect(calculateBarHeight(0, 0)).toBe(0);
    });
  });

  describe("Tier Progress Bar Logic", () => {
    const calculateProgressWidth = (current, threshold) => {
      return Math.min((current / threshold) * 100, 100);
    };

    it("should calculate progress percentage correctly", () => {
      expect(calculateProgressWidth(25, 50)).toBe(50);
      expect(calculateProgressWidth(50, 50)).toBe(100);
      expect(calculateProgressWidth(75, 50)).toBe(100); // Capped at 100
    });

    it("should handle zero threshold", () => {
      // Math.min(Infinity, 100) returns 100
      expect(calculateProgressWidth(25, 0)).toBe(100);
    });
  });

  describe("Premium Feature Gating", () => {
    const isPremiumFeatureAvailable = (access, feature) => {
      return access?.tier === "premium" && access?.features?.[feature];
    };

    it("should return true for premium tier with feature enabled", () => {
      const access = {
        tier: "premium",
        features: { employeeAnalytics: true },
      };
      expect(isPremiumFeatureAvailable(access, "employeeAnalytics")).toBe(true);
    });

    it("should return false for standard tier", () => {
      const access = {
        tier: "standard",
        features: { employeeAnalytics: false },
      };
      expect(isPremiumFeatureAvailable(access, "employeeAnalytics")).toBe(false);
    });

    it("should return false for null access", () => {
      expect(isPremiumFeatureAvailable(null, "employeeAnalytics")).toBe(false);
    });
  });
});
