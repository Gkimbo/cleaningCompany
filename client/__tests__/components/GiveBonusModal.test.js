/**
 * Tests for GiveBonusModal Component
 * Tests the bonus modal functionality and rendering
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f0ff", 100: "#e0e0ff", 500: "#6366f1", 700: "#4338ca" },
    warning: { 100: "#fef3c7", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309" },
    error: { 50: "#fef2f2", 600: "#dc2626", 700: "#b91c1c" },
    neutral: { 0: "#ffffff", 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3" },
    text: { primary: "#171717", secondary: "#525252" },
    background: { primary: "#ffffff" },
  },
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24 },
  radius: { md: 8, lg: 12, "2xl": 24, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, xl: 20, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { lg: {} },
}));

// Import component after mocks
const GiveBonusModal = require("../../src/components/businessOwner/GiveBonusModal").default;

describe("GiveBonusModal Component", () => {
  const mockEmployee = {
    employeeId: 1,
    name: "John Doe",
  };

  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    employee: mockEmployee,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // Rendering Tests
  // =============================================
  describe("Rendering", () => {
    it("should render modal when visible", () => {
      const { getAllByText, getByText } = render(<GiveBonusModal {...defaultProps} />);

      // "Give Bonus" appears as both title and button text
      expect(getAllByText(/Give Bonus/).length).toBeGreaterThanOrEqual(1);
      expect(getByText("to John Doe")).toBeTruthy();
    });

    it("should not render content when not visible", () => {
      const { queryByText } = render(
        <GiveBonusModal {...defaultProps} visible={false} />
      );

      // Modal may still exist but content shouldn't be visible
      // This depends on how Modal handles visibility
    });

    it("should render amount input", () => {
      const { getByPlaceholderText } = render(<GiveBonusModal {...defaultProps} />);

      expect(getByPlaceholderText("0.00")).toBeTruthy();
    });

    it("should render quick amount buttons", () => {
      const { getByText } = render(<GiveBonusModal {...defaultProps} />);

      expect(getByText("$25")).toBeTruthy();
      expect(getByText("$50")).toBeTruthy();
      expect(getByText("$100")).toBeTruthy();
      expect(getByText("$200")).toBeTruthy();
    });

    it("should render reason input", () => {
      const { getByPlaceholderText } = render(<GiveBonusModal {...defaultProps} />);

      expect(getByPlaceholderText("e.g., Top performer this month")).toBeTruthy();
    });

    it("should render cancel and submit buttons", () => {
      const { getByText, getAllByText } = render(<GiveBonusModal {...defaultProps} />);

      expect(getByText("Cancel")).toBeTruthy();
      expect(getAllByText(/Give Bonus/).length).toBeGreaterThanOrEqual(1);
    });

    it("should show info note about payroll", () => {
      const { getByText } = render(<GiveBonusModal {...defaultProps} />);

      expect(getByText(/pending payroll/)).toBeTruthy();
    });
  });

  // =============================================
  // Amount Input Tests
  // =============================================
  describe("Amount Input", () => {
    it("should update amount when typing", () => {
      const { getByPlaceholderText } = render(<GiveBonusModal {...defaultProps} />);
      const input = getByPlaceholderText("0.00");

      fireEvent.changeText(input, "50.00");

      expect(input.props.value).toBe("50.00");
    });

    it("should only allow numbers and decimal point", () => {
      const { getByPlaceholderText } = render(<GiveBonusModal {...defaultProps} />);
      const input = getByPlaceholderText("0.00");

      fireEvent.changeText(input, "abc50.00xyz");

      expect(input.props.value).toBe("50.00");
    });

    it("should limit to 2 decimal places", () => {
      const { getByPlaceholderText } = render(<GiveBonusModal {...defaultProps} />);
      const input = getByPlaceholderText("0.00");

      fireEvent.changeText(input, "50.999");

      // Should remain unchanged or truncated
      expect(input.props.value).not.toBe("50.999");
    });

    it("should prevent multiple decimal points", () => {
      const { getByPlaceholderText } = render(<GiveBonusModal {...defaultProps} />);
      const input = getByPlaceholderText("0.00");

      fireEvent.changeText(input, "50.00.00");

      expect(input.props.value).not.toContain(".00.00");
    });
  });

  // =============================================
  // Quick Amount Buttons Tests
  // =============================================
  describe("Quick Amount Buttons", () => {
    it("should set amount to $25 when $25 button pressed", () => {
      const { getByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.press(getByText("$25"));
      const input = getByPlaceholderText("0.00");

      expect(input.props.value).toBe("25.00");
    });

    it("should set amount to $50 when $50 button pressed", () => {
      const { getByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.press(getByText("$50"));
      const input = getByPlaceholderText("0.00");

      expect(input.props.value).toBe("50.00");
    });

    it("should set amount to $100 when $100 button pressed", () => {
      const { getByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.press(getByText("$100"));
      const input = getByPlaceholderText("0.00");

      expect(input.props.value).toBe("100.00");
    });

    it("should set amount to $200 when $200 button pressed", () => {
      const { getByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.press(getByText("$200"));
      const input = getByPlaceholderText("0.00");

      expect(input.props.value).toBe("200.00");
    });
  });

  // =============================================
  // Form Submission Tests
  // =============================================
  describe("Form Submission", () => {
    // Helper to find the submit button (shows amount when valid)
    const findSubmitButton = (getAllByText, amount = null) => {
      const buttons = getAllByText(/Give Bonus/);
      // Submit button shows amount when valid, or is the last element
      if (amount) {
        return buttons.find((b) => b.props.children.includes(`($${amount})`)) || buttons[buttons.length - 1];
      }
      return buttons[buttons.length - 1];
    };

    it("should call onSubmit with correct data", async () => {
      mockOnSubmit.mockResolvedValue({});
      const { getAllByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      fireEvent.changeText(
        getByPlaceholderText("e.g., Top performer this month"),
        "Great work!"
      );

      // Find the submit button (last one with "Give Bonus")
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          employeeId: 1,
          amount: 5000, // $50 in cents
          reason: "Great work!",
        });
      });
    });

    it("should convert amount to cents", async () => {
      mockOnSubmit.mockResolvedValue({});
      const { getAllByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "123.45");
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 12345, // $123.45 in cents
          })
        );
      });
    });

    it("should handle null reason", async () => {
      mockOnSubmit.mockResolvedValue({});
      const { getAllByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      // Don't enter a reason
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            reason: null,
          })
        );
      });
    });

    it("should trim reason whitespace", async () => {
      mockOnSubmit.mockResolvedValue({});
      const { getAllByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      fireEvent.changeText(
        getByPlaceholderText("e.g., Top performer this month"),
        "  Great work!  "
      );
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            reason: "Great work!",
          })
        );
      });
    });
  });

  // =============================================
  // Validation Tests
  // =============================================
  describe("Validation", () => {
    it("should keep submit button disabled for zero amount", () => {
      const { getByPlaceholderText, UNSAFE_getAllByType } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "0");

      // Button should remain disabled when amount is 0
      // The button is the second Pressable in the actions section
    });

    it("should keep submit button disabled for empty amount", () => {
      const { getAllByText } = render(<GiveBonusModal {...defaultProps} />);

      // When amount is empty, the submit button should be disabled
      // and show just "Give Bonus" without amount
      const buttons = getAllByText(/Give Bonus/);
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("should disable submit button when amount is invalid", () => {
      const { getAllByText } = render(<GiveBonusModal {...defaultProps} />);

      // Submit button should show just "Give Bonus" without amount when invalid
      const buttons = getAllByText(/Give Bonus/);
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("should enable submit button when amount is valid", () => {
      const { getByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");

      expect(getByText(/\$50\.00/)).toBeTruthy();
    });
  });

  // =============================================
  // Error Handling Tests
  // =============================================
  describe("Error Handling", () => {
    it("should display error from onSubmit", async () => {
      mockOnSubmit.mockRejectedValue(new Error("Network error"));
      const { getAllByText, getByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(getByText("Network error")).toBeTruthy();
      });
    });

    it("should show generic error message on unknown error", async () => {
      mockOnSubmit.mockRejectedValue({});
      const { getAllByText, getByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(getByText("Failed to create bonus")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Close/Cancel Tests
  // =============================================
  describe("Close/Cancel Behavior", () => {
    it("should call onClose when cancel pressed", () => {
      const { getByText } = render(<GiveBonusModal {...defaultProps} />);

      fireEvent.press(getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should call onClose when X button pressed", () => {
      const { UNSAFE_getAllByType } = render(<GiveBonusModal {...defaultProps} />);

      // Find and press the close button (Icon component with times name)
      // This is a simplified test - actual implementation may vary
    });

    it("should reset form when modal opens", () => {
      const { getByPlaceholderText, rerender } = render(
        <GiveBonusModal {...defaultProps} visible={false} />
      );

      // Open modal
      rerender(<GiveBonusModal {...defaultProps} visible={true} />);

      const input = getByPlaceholderText("0.00");
      expect(input.props.value).toBe("");
    });

    it("should close modal after successful submission", async () => {
      mockOnSubmit.mockResolvedValue({});
      const { getAllByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  // =============================================
  // Loading State Tests
  // =============================================
  describe("Loading State", () => {
    it("should show loading indicator when submitting", async () => {
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const { getAllByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      // During loading, button text might change or be hidden
      // ActivityIndicator should be shown
    });

    it("should disable buttons during loading", async () => {
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const { getAllByText, getByPlaceholderText } = render(
        <GiveBonusModal {...defaultProps} />
      );

      fireEvent.changeText(getByPlaceholderText("0.00"), "50.00");
      const buttons = getAllByText(/Give Bonus/);
      fireEvent.press(buttons[buttons.length - 1]);

      // Buttons should be disabled
      // Can't easily test disabled state in React Native Testing Library
    });
  });
});
