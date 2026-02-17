/**
 * Tests for Client Insights Components
 * Tests the enhanced client insights section in BusinessAnalyticsDashboard
 */

import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/fetchRequests/BusinessOwnerService", () => ({
  getAllAnalytics: jest.fn(),
  createBonus: jest.fn(),
}));

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f0ff", 100: "#e0e0ff", 300: "#a0a0ff", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
    secondary: { 50: "#e0f0f0", 500: "#0d9488", 600: "#0d9488" },
    success: { 100: "#dcfce7", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
    error: { 50: "#fef2f2", 100: "#fee2e2", 600: "#dc2626", 700: "#b91c1c" },
    warning: { 50: "#fffbeb", 100: "#fef3c7", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309" },
    neutral: { 0: "#fff", 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373", 600: "#525252" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#a3a3a3" },
    background: { primary: "#ffffff", secondary: "#f5f5f5" },
    border: { light: "#e5e5e5", DEFAULT: "#d4d4d4" },
  },
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "4xl": 64 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 24, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {} },
}));

import BusinessOwnerService from "../../src/services/fetchRequests/BusinessOwnerService";

// Import component after mocks
const BusinessAnalyticsDashboard = require("../../src/components/businessOwner/BusinessAnalyticsDashboard").default;

describe("Client Insights Components", () => {
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
      ],
    },
    clients: {
      totalClients: 25,
      newClientsThisMonth: 5,
      metrics: { retentionRate: 85 },
      atRiskClients: [
        {
          clientId: 1,
          name: "At Risk Client",
          daysSinceLastBooking: 45,
          bookingCount: 3,
          totalRevenueFormatted: "$300",
        },
      ],
      atRiskCount: 1,
      topClients: [
        { clientId: 2, name: "Top Client One", bookingCount: 25, totalRevenueFormatted: "$2,500" },
        { clientId: 3, name: "Top Client Two", bookingCount: 15, totalRevenueFormatted: "$1,500" },
        { clientId: 4, name: "Top Client Three", bookingCount: 10, totalRevenueFormatted: "$1,000" },
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
        thisWeek: { grossRevenue: 150000, grossRevenueFormatted: "$1,500.00" },
        lastMonth: { grossRevenue: 480000, grossRevenueFormatted: "$4,800.00" },
        allTime: { grossRevenue: 2500000, grossRevenueFormatted: "$25,000.00" },
      },
      pending: {},
      payrollStatus: {},
      clientPayments: {},
      feeTier: { current: "large_business", feePercent: 7 },
    },
    trends: { data: [] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    BusinessOwnerService.getAllAnalytics.mockResolvedValue(mockPremiumAnalytics);
  });

  // =============================================
  // ClientStatsSummary Component
  // =============================================
  describe("ClientStatsSummary Component", () => {
    it("should display total clients count", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("25")).toBeTruthy();
        expect(getByText("Clients")).toBeTruthy();
      });
    });

    it("should display new clients label", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("New")).toBeTruthy();
      });
    });

    it("should display retention label", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Retention")).toBeTruthy();
      });
    });
  });

  // =============================================
  // At-Risk Clients Section
  // =============================================
  describe("At-Risk Clients Section", () => {
    it("should display at-risk client name", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("At Risk Client")).toBeTruthy();
      });
    });

    it("should display days since last booking", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("45d ago")).toBeTruthy();
      });
    });

    it("should show AT RISK badge", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("AT RISK")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Top Clients Section
  // =============================================
  describe("Top Clients Section", () => {
    it("should display 'Top Clients' section header", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Top Clients")).toBeTruthy();
      });
    });

    it("should display top client names", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Top Client One")).toBeTruthy();
        expect(getByText("Top Client Two")).toBeTruthy();
        expect(getByText("Top Client Three")).toBeTruthy();
      });
    });

    it("should display TOP CLIENT badge for first client", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("TOP CLIENT")).toBeTruthy();
      });
    });

    it("should display client revenue", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("$2,500")).toBeTruthy();
        expect(getByText("$1,500")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Loyalty Tier Badges
  // =============================================
  describe("Loyalty Tier Badges", () => {
    it("should display VIP badge for clients with 20+ bookings", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        // Top Client One has 25 bookings
        expect(getByText("VIP")).toBeTruthy();
      });
    });

    it("should display Loyal badge for clients with 10-19 bookings", async () => {
      const { getAllByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        // Top Client Two has 15 bookings (may have multiple Loyal badges)
        expect(getAllByText("Loyal").length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // =============================================
  // Section Icon
  // =============================================
  describe("Section Icon", () => {
    it("should display Client Insights section", async () => {
      const { getByText } = render(
        <BusinessAnalyticsDashboard state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Client Insights")).toBeTruthy();
      });
    });
  });

  // =============================================
  // API Integration
  // =============================================
  describe("API Integration", () => {
    it("should fetch analytics data on mount", async () => {
      render(<BusinessAnalyticsDashboard state={mockState} />);

      await waitFor(() => {
        expect(BusinessOwnerService.getAllAnalytics).toHaveBeenCalledWith(
          "test-token",
          expect.anything()
        );
      });
    });
  });
});
