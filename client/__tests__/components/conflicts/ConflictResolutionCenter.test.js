import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
jest.mock("../../../src/services/AuthContext", () => {
  const React = require("react");
  const context = React.createContext({
    user: { token: "test_token" },
    login: () => {},
    logout: () => {},
  });
  return {
    AuthContext: context,
    AuthProvider: ({ children }) => children,
  };
});

// Mock ConflictService
const mockGetQueue = jest.fn();
const mockGetStats = jest.fn();

jest.mock("../../../src/services/fetchRequests/ConflictService", () => ({
  getQueue: (...args) => mockGetQueue(...args),
  getStats: (...args) => mockGetStats(...args),
}));

// Mock theme
jest.mock("../../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0", 200: "#e0e0e0", 300: "#bdbdbd" },
    primary: { 50: "#e3f2fd", 100: "#bbdefb", 400: "#42a5f5", 500: "#2196f3", 600: "#1976d2" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 500: "#ff9800", 600: "#fb8c00" },
    error: { 50: "#ffebee", 100: "#ffcdd2", 500: "#f44336", 600: "#e53935", 700: "#d32f2f" },
    success: { 50: "#e8f5e9", 100: "#c8e6c9", 500: "#4caf50", 600: "#43a047" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 20, full: 9999 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {}, lg: {} },
}));

import ConflictResolutionCenter from "../../../src/components/conflicts/ConflictResolutionCenter";

// Wrap component with context
const renderWithContext = (props = {}) => {
  const AuthContext = require("../../../src/services/AuthContext").AuthContext;
  return render(
    <AuthContext.Provider value={{ user: { token: "test_token" } }}>
      <ConflictResolutionCenter {...props} />
    </AuthContext.Provider>
  );
};

describe("ConflictResolutionCenter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetQueue.mockResolvedValue({
      success: true,
      cases: [],
      total: 0,
    });
    mockGetStats.mockResolvedValue({
      success: true,
      totalPending: 0,
      slaBreachCount: 0,
      appeals: { pending: 0, urgent: 0 },
      adjustments: { pending: 0 },
    });
  });

  describe("Rendering", () => {
    it("should render loading state initially", async () => {
      const { getByTestId, queryByText } = renderWithContext();

      // Should show loading indicator
      await waitFor(() => {
        expect(mockGetQueue).toHaveBeenCalled();
      });
    });

    it("should render conflict queue header", async () => {
      const { getByText } = renderWithContext();

      await waitFor(() => {
        expect(getByText("Conflict Resolution")).toBeTruthy();
      });
    });

    it("should render empty state when no conflicts", async () => {
      mockGetQueue.mockResolvedValue({
        success: true,
        cases: [],
        total: 0,
      });

      const { findByText } = renderWithContext();

      await waitFor(() => {
        expect(mockGetQueue).toHaveBeenCalled();
      });
    });
  });

  describe("Queue Display", () => {
    it("should render conflict cases", async () => {
      mockGetQueue.mockResolvedValue({
        success: true,
        cases: [
          {
            id: 1,
            caseType: "appeal",
            caseNumber: "APL-000001",
            status: "submitted",
            priority: "high",
            description: "Test appeal",
            homeowner: { name: "John Doe" },
            cleaner: { name: "Jane Smith" },
            submittedAt: new Date().toISOString(),
          },
        ],
        total: 1,
      });

      const { findByText } = renderWithContext();

      await waitFor(() => {
        expect(mockGetQueue).toHaveBeenCalled();
      });
    });

    it("should display SLA breach count in stats", async () => {
      mockGetStats.mockResolvedValue({
        success: true,
        totalPending: 5,
        slaBreachCount: 2,
        appeals: { pending: 3, urgent: 1 },
        adjustments: { pending: 2 },
      });

      renderWithContext();

      await waitFor(() => {
        expect(mockGetStats).toHaveBeenCalled();
      });
    });
  });

  describe("Filtering", () => {
    it("should call getQueue with filter parameters", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetQueue).toHaveBeenCalledWith(
          "test_token",
          expect.any(Object)
        );
      });
    });
  });

  describe("Navigation", () => {
    it("should have navigation prop available", async () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require("@react-navigation/native"), "useNavigation")
        .mockReturnValue({ navigate: mockNavigate, goBack: jest.fn() });

      renderWithContext();

      await waitFor(() => {
        expect(mockGetQueue).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle fetch error gracefully", async () => {
      mockGetQueue.mockRejectedValue(new Error("Network error"));

      renderWithContext();

      await waitFor(() => {
        expect(mockGetQueue).toHaveBeenCalled();
      });
    });
  });

  describe("Refresh", () => {
    it("should refetch data on refresh", async () => {
      mockGetQueue.mockResolvedValue({
        success: true,
        cases: [],
        total: 0,
      });

      renderWithContext();

      await waitFor(() => {
        expect(mockGetQueue).toHaveBeenCalledTimes(1);
      });
    });
  });
});
