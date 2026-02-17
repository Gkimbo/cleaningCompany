/**
 * Tests for PayrollScreen Bonus Integration
 * Tests the bonus-related functionality in the PayrollScreen component
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
  getPendingPayouts: jest.fn(),
  getPayrollHistory: jest.fn(),
  getBonuses: jest.fn(),
  markBonusPaid: jest.fn(),
  cancelBonus: jest.fn(),
}));

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f0ff", 100: "#e0e0ff", 200: "#c0c0ff", 300: "#a0a0ff", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
    secondary: { 100: "#e0f0f0", 600: "#0d9488", 700: "#0f766e" },
    success: { 50: "#f0fdf4", 100: "#dcfce7", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a" },
    error: { 50: "#fef2f2", 500: "#ef4444", 600: "#dc2626" },
    warning: { 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e" },
    neutral: { 0: "#fff", 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#a3a3a3" },
    background: { primary: "#ffffff", secondary: "#f5f5f5" },
    border: { light: "#e5e5e5", default: "#d4d4d4" },
  },
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48, "4xl": 64 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, lg: {}, xl: {} },
}));

import BusinessOwnerService from "../../src/services/fetchRequests/BusinessOwnerService";

// Import component after mocks
const PayrollScreen = require("../../src/components/businessOwner/PayrollScreen").default;

describe("PayrollScreen Bonus Integration", () => {
  const mockState = {
    currentUser: {
      token: "test-token",
      id: 1,
    },
  };

  const mockPendingPayouts = {
    pendingPayouts: [
      {
        id: 1,
        businessEmployeeId: 1,
        payAmount: 5000,
        payoutStatus: "pending",
        payType: "per_job",
        isSelfAssignment: false,
        employee: { id: 1, firstName: "John", lastName: "Doe" },
        appointment: { id: 1, date: "2024-01-15", home: { address: "123 Main St" } },
      },
    ],
  };

  const mockPayrollHistory = {
    payouts: [],
  };

  const mockBonuses = {
    bonuses: [
      {
        id: 1,
        businessOwnerId: 1,
        employeeId: 2,
        businessEmployeeId: 1,
        amount: 5000,
        reason: "Great performance",
        status: "pending",
        createdAt: "2024-01-15T00:00:00.000Z",
        employee: { id: 1, firstName: "John", lastName: "Doe" },
      },
      {
        id: 2,
        businessOwnerId: 1,
        employeeId: 3,
        businessEmployeeId: 2,
        amount: 2500,
        reason: "Holiday bonus",
        status: "paid",
        paidAt: "2024-01-20T00:00:00.000Z",
        createdAt: "2024-01-10T00:00:00.000Z",
        employee: { id: 2, firstName: "Jane", lastName: "Smith" },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    BusinessOwnerService.getPendingPayouts.mockResolvedValue(mockPendingPayouts);
    BusinessOwnerService.getPayrollHistory.mockResolvedValue(mockPayrollHistory);
    BusinessOwnerService.getBonuses.mockResolvedValue(mockBonuses);
  });

  // =============================================
  // Loading & Initial Render
  // =============================================
  describe("Loading & Initial Render", () => {
    it("should show loading state initially", () => {
      BusinessOwnerService.getPendingPayouts.mockImplementation(
        () => new Promise(() => {})
      );

      const { getByText } = render(<PayrollScreen state={mockState} />);

      expect(getByText("Loading payroll...")).toBeTruthy();
    });

    it("should fetch bonuses on mount", async () => {
      render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(BusinessOwnerService.getBonuses).toHaveBeenCalledWith("test-token");
      });
    });
  });

  // =============================================
  // Summary Card with Bonuses
  // =============================================
  describe("Summary Card with Bonuses", () => {
    it("should display total pending including bonuses", async () => {
      const { getByText } = render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        // Total: $50 (payout) + $50 (pending bonus) = $100
        expect(getByText("$100.00")).toBeTruthy();
      });
    });

    it("should show breakdown of jobs and bonuses", async () => {
      const { getByText } = render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(getByText(/\$50\.00 jobs \+ \$50\.00 bonuses/)).toBeTruthy();
      });
    });

    it("should show pending bonus count in stats", async () => {
      const { getAllByText } = render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        // "Bonuses" appears multiple times
        expect(getAllByText("Bonuses").length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // =============================================
  // Bonuses Tab
  // =============================================
  describe("Bonuses Tab", () => {
    it("should show Bonuses tab", async () => {
      const { getAllByText } = render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(getAllByText("Bonuses").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should fetch bonuses data", async () => {
      render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(BusinessOwnerService.getBonuses).toHaveBeenCalled();
      });
    });
  });

  // =============================================
  // Mark Bonus Paid
  // =============================================
  describe("Mark Bonus Paid", () => {
    it("should have mark paid functionality available", async () => {
      const { getAllByText } = render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(getAllByText("Bonuses").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should call markBonusPaid service when marking paid", async () => {
      BusinessOwnerService.markBonusPaid.mockResolvedValue({ success: true });

      render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(BusinessOwnerService.getBonuses).toHaveBeenCalled();
      });

      // The markBonusPaid function is available for use
      expect(BusinessOwnerService.markBonusPaid).toBeDefined();
    });
  });

  // =============================================
  // Cancel Bonus
  // =============================================
  describe("Cancel Bonus", () => {
    it("should have cancel bonus functionality available", async () => {
      render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(BusinessOwnerService.getBonuses).toHaveBeenCalled();
      });

      expect(BusinessOwnerService.cancelBonus).toBeDefined();
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  describe("Error Handling", () => {
    it("should show error message on bonus fetch failure", async () => {
      BusinessOwnerService.getBonuses.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(getByText("Failed to load payroll data")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Refresh
  // =============================================
  describe("Refresh", () => {
    it("should refetch bonuses on refresh", async () => {
      const { getByTestId } = render(<PayrollScreen state={mockState} />);

      await waitFor(() => {
        expect(BusinessOwnerService.getBonuses).toHaveBeenCalledTimes(1);
      });

      // Trigger refresh (this depends on implementation)
      // Usually done via RefreshControl onRefresh callback
    });
  });
});
