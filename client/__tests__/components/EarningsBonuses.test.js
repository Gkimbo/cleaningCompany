/**
 * Tests for Earnings Page Bonus Display
 * Tests the employee-facing bonus display in the Earnings component
 */

import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({
    pricing: {
      platform: {
        feePercent: 0.1,
        multiCleanerPlatformFeePercent: 0.13,
      },
    },
  }),
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  get: jest.fn(),
  getHome: jest.fn(),
  getMyConfirmedMultiCleanerJobs: jest.fn(),
}));

jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

jest.mock("../../src/components/payments/StripeConnectOnboarding", () => "StripeConnectOnboarding");
jest.mock("../../src/components/payments/PayoutHistory", () => "PayoutHistory");
jest.mock("../../src/components/payments/EarningsChart", () => "EarningsChart");
jest.mock("../../src/components/employeeAssignments/jobPhotos/JobCompletionFlow", () => "JobCompletionFlow");
jest.mock("../../src/components/employeeAssignments/HomeSizeConfirmationModal", () => "HomeSizeConfirmationModal");

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f0ff", 100: "#e0e0ff", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
    secondary: { 600: "#0d9488" },
    success: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
    error: { 600: "#dc2626" },
    warning: { 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e" },
    neutral: { 0: "#fff", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#a3a3a3" },
  },
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "3xl": 48 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "3xl": 30 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {} },
}));

import FetchData from "../../src/services/fetchRequests/fetchData";

// Mock global fetch
global.fetch = jest.fn();

// Import component after mocks
const Earnings = require("../../src/components/payments/Earnings").default;

describe("Earnings Bonus Display", () => {
  const mockState = {
    currentUser: {
      id: 2,
      token: "test-token",
    },
    appointments: [],
  };

  const mockDispatch = jest.fn();

  const mockEarnings = {
    totalEarnings: "500.00",
    pendingEarnings: "100.00",
    completedJobs: 10,
    platformFeePercent: 10,
    cleanerPercent: 90,
  };

  const mockAccountStatus = {
    hasAccount: true,
    onboardingComplete: true,
  };

  const mockBonuses = [
    {
      id: 1,
      amount: 5000,
      reason: "Great performance this month",
      status: "paid",
      paidAt: "2024-01-15T00:00:00.000Z",
      createdAt: "2024-01-10T00:00:00.000Z",
    },
    {
      id: 2,
      amount: 2500,
      reason: "Holiday bonus",
      status: "pending",
      paidAt: null,
      createdAt: "2024-01-20T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch responses
    global.fetch.mockImplementation((url) => {
      if (url.includes("/payments/earnings/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEarnings),
        });
      }
      if (url.includes("/stripe-connect/account-status/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAccountStatus),
        });
      }
      if (url.includes("/stripe-connect/payouts/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payouts: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    FetchData.get.mockImplementation((url) => {
      if (url.includes("/employee-info/bonuses")) {
        return Promise.resolve({ bonuses: mockBonuses });
      }
      if (url.includes("/employee-info")) {
        return Promise.resolve({
          employee: { cleanerAppointments: [] },
        });
      }
      return Promise.resolve({});
    });

    FetchData.getMyConfirmedMultiCleanerJobs.mockResolvedValue({ jobs: [] });
  });

  // =============================================
  // Bonus Section Visibility
  // =============================================
  describe("Bonus Section Visibility", () => {
    it("should show bonus section when employee has bonuses", async () => {
      const { getByText } = render(
        <Earnings state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Bonuses from Your Employer")).toBeTruthy();
      });
    });

    it("should not show bonus section when employee has no bonuses", async () => {
      FetchData.get.mockImplementation((url) => {
        if (url.includes("/employee-info/bonuses")) {
          return Promise.resolve({ bonuses: [] });
        }
        if (url.includes("/employee-info")) {
          return Promise.resolve({
            employee: { cleanerAppointments: [] },
          });
        }
        return Promise.resolve({});
      });

      const { queryByText } = render(
        <Earnings state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(queryByText("Bonuses from Your Employer")).toBeNull();
      });
    });
  });

  // =============================================
  // Bonus Amounts
  // =============================================
  describe("Bonus Amounts", () => {
    it("should display bonus amounts", async () => {
      const { getAllByText } = render(
        <Earnings state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        // Should show bonus amounts (may appear multiple times)
        expect(getAllByText(/\$50\.00|\$25\.00/).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // =============================================
  // Bonus Reason
  // =============================================
  describe("Bonus Reason", () => {
    it("should display bonus reason", async () => {
      const { getByText } = render(
        <Earnings state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Great performance this month")).toBeTruthy();
      });
    });
  });

  // =============================================
  // API Call
  // =============================================
  describe("API Call", () => {
    it("should fetch bonuses from API", async () => {
      render(<Earnings state={mockState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(FetchData.get).toHaveBeenCalledWith(
          "/api/v1/employee-info/bonuses",
          "test-token"
        );
      });
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  describe("Error Handling", () => {
    it("should handle fetch error gracefully", async () => {
      FetchData.get.mockImplementation((url) => {
        if (url.includes("/employee-info/bonuses")) {
          return Promise.reject(new Error("Network error"));
        }
        if (url.includes("/employee-info")) {
          return Promise.resolve({
            employee: { cleanerAppointments: [] },
          });
        }
        return Promise.resolve({});
      });

      const { queryByText } = render(
        <Earnings state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        // Should not show bonus section on error
        expect(queryByText("Bonuses from Your Employer")).toBeNull();
      });
    });

    it("should handle empty response", async () => {
      FetchData.get.mockImplementation((url) => {
        if (url.includes("/employee-info/bonuses")) {
          return Promise.resolve({});
        }
        if (url.includes("/employee-info")) {
          return Promise.resolve({
            employee: { cleanerAppointments: [] },
          });
        }
        return Promise.resolve({});
      });

      const { queryByText } = render(
        <Earnings state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(queryByText("Bonuses from Your Employer")).toBeNull();
      });
    });
  });
});
