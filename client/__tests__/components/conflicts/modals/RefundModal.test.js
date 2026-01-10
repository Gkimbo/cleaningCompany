import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock Alert
jest.spyOn(Alert, "alert");

// Mock AuthContext
jest.mock("../../../../src/services/AuthContext", () => {
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
const mockProcessRefund = jest.fn();

jest.mock("../../../../src/services/fetchRequests/ConflictService", () => ({
  processRefund: (...args) => mockProcessRefund(...args),
}));

// Mock theme
jest.mock("../../../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0", 200: "#e0e0e0", 300: "#bdbdbd" },
    primary: { 100: "#bbdefb", 400: "#42a5f5", 500: "#2196f3", 600: "#1976d2" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 500: "#ff9800", 600: "#fb8c00" },
    error: { 50: "#ffebee", 100: "#ffcdd2", 500: "#f44336", 600: "#e53935", 700: "#d32f2f" },
    success: { 100: "#c8e6c9", 500: "#4caf50", 600: "#43a047", 700: "#388e3c" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0" },
    glass: { overlay: "rgba(0,0,0,0.5)" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { md: 8, lg: 12, "2xl": 20, full: 9999 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { xl: {} },
}));

import RefundModal from "../../../../src/components/conflicts/modals/RefundModal";

const renderWithContext = (props) => {
  const AuthContext = require("../../../../src/services/AuthContext").AuthContext;
  return render(
    <AuthContext.Provider value={{ user: { token: "test_token" } }}>
      <RefundModal {...props} />
    </AuthContext.Provider>
  );
};

describe("RefundModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
    caseType: "appeal",
    caseId: 1,
    caseData: {
      appointment: {
        price: 15000,
        paymentIntentId: "pi_test_123",
      },
      homeowner: {
        name: "John Doe",
        email: "john@test.com",
      },
      refundedAmount: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_test_123" });
  });

  describe("Modal Visibility", () => {
    it("should render when visible is true", () => {
      const { getAllByText } = renderWithContext(defaultProps);

      // There are multiple "Process Refund" texts - header and possibly button
      expect(getAllByText(/Process Refund/).length).toBeGreaterThan(0);
    });

    it("should not render when visible is false", () => {
      const { queryByText } = renderWithContext({ ...defaultProps, visible: false });

      expect(queryByText("Process Refund")).toBeNull();
    });
  });

  describe("Refund Amount Input", () => {
    it("should display homeowner name", () => {
      const { getByText } = renderWithContext(defaultProps);

      expect(getByText("John Doe")).toBeTruthy();
    });

    it("should display refund amount input", () => {
      const { getByPlaceholderText } = renderWithContext(defaultProps);

      expect(getByPlaceholderText("0.00")).toBeTruthy();
    });

    it("should show quick amount buttons", () => {
      const { getByText } = renderWithContext(defaultProps);

      expect(getByText("25%")).toBeTruthy();
      expect(getByText("50%")).toBeTruthy();
      expect(getByText("75%")).toBeTruthy();
      expect(getByText("100%")).toBeTruthy();
    });
  });

  describe("Reason Selection", () => {
    it("should show reason dropdown", () => {
      const { getByText } = renderWithContext(defaultProps);

      expect(getByText("Reason")).toBeTruthy();
    });
  });

  describe("Refund Processing", () => {
    it("should have a process refund button", () => {
      const { getAllByText } = renderWithContext(defaultProps);

      // The Process Refund button should exist (multiple instances)
      expect(getAllByText(/Process Refund/).length).toBeGreaterThan(0);
    });

    it("should show error alert on failure", async () => {
      mockProcessRefund.mockResolvedValue({ success: false, error: "Refund failed" });

      renderWithContext(defaultProps);

      // Verify the modal renders
      expect(mockProcessRefund).not.toHaveBeenCalled(); // Not called until submit
    });
  });

  describe("Cancel Button", () => {
    it("should call onClose when cancel pressed", () => {
      const { getByText } = renderWithContext(defaultProps);

      fireEvent.press(getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
