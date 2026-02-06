import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => {
  const { Text } = require("react-native");
  return (props) => <Text testID={`icon-${props.name}`}>{props.name}</Text>;
});

// Mock PricingContext
jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({
    pricing: {
      cancellation: {
        fee: 25,
        windowDays: 7,
        homeownerPenaltyDays: 3,
        refundPercentage: 0.5,
      },
      platform: {
        feePercent: 0.1,
      },
    },
  }),
}));

// Mock theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0" },
    primary: { 50: "#e3f2fd", 100: "#bbdefb", 200: "#90caf9", 400: "#42a5f5", 600: "#1976d2", 700: "#1565c0", 800: "#0d47a1" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 200: "#ffcc80", 500: "#ff9800", 600: "#fb8c00", 700: "#f57c00", 800: "#ef6c00" },
    error: { 50: "#ffebee", 200: "#ef9a9a", 300: "#e57373", 500: "#f44336", 600: "#e53935", 700: "#d32f2f" },
    success: { 600: "#43a047" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0" },
    glass: { overlay: "rgba(0,0,0,0.5)" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { md: 8, lg: 12, xl: 16, "2xl": 20 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, xl: 20 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { md: {}, xl: {} },
}));

import CancellationWarningModal from "../../src/components/modals/CancellationWarningModal";

describe("CancellationWarningModal", () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultCancellationInfo = {
    isWithinPenaltyWindow: false,
    price: 200,
    estimatedRefund: "200.00",
    cleanerPayout: "0.00",
    warningMessage: "You can cancel this appointment for a full refund.",
    daysUntilAppointment: 5,
    hasCleanerAssigned: false,
  };

  const penaltyWindowCancellationInfo = {
    isWithinPenaltyWindow: true,
    price: 200,
    estimatedRefund: "100.00",
    cleanerPayout: "90.00",
    warningMessage:
      "Cancelling within 3 days of the cleaning means the assigned cleaner will receive $90.00 (50% of the price minus 10% platform fee). You will be refunded $100.00.",
    daysUntilAppointment: 2,
    hasCleanerAssigned: true,
    refundPercent: 50,
  };

  describe("Modal Visibility", () => {
    it("should not render when visible is false", () => {
      const { queryByText } = render(
        <CancellationWarningModal
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      expect(queryByText("Cancel Appointment")).toBeNull();
    });

    it("should render when visible is true", () => {
      const { getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      // Modal title and button both say "Cancel Appointment"
      expect(getAllByText("Cancel Appointment").length).toBeGreaterThan(0);
    });

    it("should return null when cancellationInfo is null", () => {
      const { queryByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={null}
        />
      );

      expect(queryByText("Cancel Appointment")).toBeNull();
    });
  });

  describe("Outside Penalty Window", () => {
    it("should show normal title when outside penalty window", () => {
      const { getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      // Title says "Cancel Appointment" (not "Cancellation Warning")
      expect(getAllByText("Cancel Appointment").length).toBeGreaterThan(0);
    });

    it("should show days until appointment", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      expect(getByText("5 days until appointment")).toBeTruthy();
    });

    it("should show full refund message", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      expect(getByText("You can cancel this appointment for a full refund.")).toBeTruthy();
    });

    it("should not show financial breakdown when outside penalty window", () => {
      const { queryByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      expect(queryByText("Financial Breakdown")).toBeNull();
    });
  });

  describe("Within Penalty Window", () => {
    it("should show warning title when within penalty window", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={penaltyWindowCancellationInfo}
        />
      );

      expect(getByText("Cancellation Warning")).toBeTruthy();
    });

    it("should show financial breakdown when within penalty window", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={penaltyWindowCancellationInfo}
        />
      );

      expect(getByText("Financial Breakdown")).toBeTruthy();
      expect(getByText("Amount Paid")).toBeTruthy();
      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText("Your Refund (50%)")).toBeTruthy();
      expect(getByText("$100.00")).toBeTruthy();
      expect(getByText("Cleaner Receives")).toBeTruthy();
      expect(getByText("$90.00")).toBeTruthy();
    });

    it("should show penalty warning message", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={penaltyWindowCancellationInfo}
        />
      );

      expect(
        getByText(/Cancelling within 3 days of the cleaning means the assigned cleaner/)
      ).toBeTruthy();
    });

    it("should show platform fee note", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={penaltyWindowCancellationInfo}
        />
      );

      expect(getByText("Cleaner receives 50% minus 10% platform fee")).toBeTruthy();
    });
  });

  describe("Agreement Checkbox and Consent Header", () => {
    it("should show correct checkbox label outside penalty window", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      expect(getByText("I want to cancel this appointment")).toBeTruthy();
    });

    it("should show correct checkbox label within penalty window", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={penaltyWindowCancellationInfo}
        />
      );

      expect(getByText("I understand and agree to the cancellation terms")).toBeTruthy();
    });

    it("should show consent header when checkbox is not checked", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      expect(getByText("Tap below to confirm cancellation")).toBeTruthy();
    });

    it("should toggle checkbox when checkbox container is pressed", () => {
      const { getByText, queryByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      // Initially consent header is visible
      expect(getByText("Tap below to confirm cancellation")).toBeTruthy();

      // Press the checkbox label to toggle
      fireEvent.press(getByText("I want to cancel this appointment"));

      // After pressing, consent header should be hidden (checkbox is now checked)
      expect(queryByText("Tap below to confirm cancellation")).toBeNull();
    });

    it("should hide consent header when checkbox is checked", () => {
      const { getByText, queryByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      // Check the checkbox
      fireEvent.press(getByText("I want to cancel this appointment"));

      // Consent header should be hidden
      expect(queryByText("Tap below to confirm cancellation")).toBeNull();
    });

    it("should show check icon when checkbox is checked", () => {
      const { getByText, getByTestId } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      // Check the checkbox
      fireEvent.press(getByText("I want to cancel this appointment"));

      // Check icon should be visible
      expect(getByTestId("icon-check")).toBeTruthy();
    });

    it("should show pointing hand icon in consent header", () => {
      const { getByTestId } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      expect(getByTestId("icon-hand-pointer-o")).toBeTruthy();
    });
  });

  describe("Button Actions", () => {
    it("should call onClose when Go Back button is pressed", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      fireEvent.press(getByText("Go Back"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should not call onConfirm when checkbox is not checked", () => {
      const { getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      // Get all elements with "Cancel Appointment" text, the second one should be the button
      const elements = getAllByText("Cancel Appointment");
      const confirmButton = elements[elements.length - 1]; // Button is typically the last one
      fireEvent.press(confirmButton);

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("should call onConfirm when checkbox is checked and confirm button is pressed", () => {
      const { getByText, getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
        />
      );

      // Check the checkbox first by pressing the checkbox label
      fireEvent.press(getByText("I want to cancel this appointment"));

      // Get all elements with "Cancel Appointment" text, the last one should be the button
      const elements = getAllByText("Cancel Appointment");
      fireEvent.press(elements[elements.length - 1]);

      expect(mockOnConfirm).toHaveBeenCalled();
    });
  });

  describe("Special Date Displays", () => {
    it("should show 'This appointment is today' for day 0", () => {
      const todayInfo = {
        ...defaultCancellationInfo,
        daysUntilAppointment: 0,
      };

      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={todayInfo}
        />
      );

      expect(getByText("This appointment is today")).toBeTruthy();
    });

    it("should show 'This appointment is tomorrow' for day 1", () => {
      const tomorrowInfo = {
        ...defaultCancellationInfo,
        daysUntilAppointment: 1,
      };

      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={tomorrowInfo}
        />
      );

      expect(getByText("This appointment is tomorrow")).toBeTruthy();
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator when loading is true", () => {
      const { getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={defaultCancellationInfo}
          loading={true}
        />
      );

      // When loading, only the title should say "Cancel Appointment"
      // (the button shows ActivityIndicator instead)
      const elements = getAllByText("Cancel Appointment");
      // Should have only 1 (the title), not 2 (title + button)
      expect(elements.length).toBe(1);
    });
  });

  describe("Cancellation Fee Warning", () => {
    const cancellationFeeInfo = {
      isWithinPenaltyWindow: false,
      price: 200,
      estimatedRefund: "200.00",
      cleanerPayout: "0.00",
      warningMessage: "A $25 cancellation fee will be charged to your card on file for cancelling within 7 days of the appointment.",
      daysUntilAppointment: 5,
      hasCleanerAssigned: false,
      willChargeCancellationFee: true,
      cancellationFee: 25,
      hasPaymentMethod: true,
    };

    const cancellationFeeWithPenaltyInfo = {
      isWithinPenaltyWindow: true,
      price: 200,
      estimatedRefund: "100.00",
      cleanerPayout: "90.00",
      warningMessage: "Cancelling within 3 days of the cleaning means the assigned cleaner will receive $90.00. Additionally, a $25 cancellation fee will be charged to your card on file.",
      daysUntilAppointment: 2,
      hasCleanerAssigned: true,
      willChargeCancellationFee: true,
      cancellationFee: 25,
      hasPaymentMethod: true,
      refundPercent: 50,
    };

    const noCancellationFeeInfo = {
      isWithinPenaltyWindow: false,
      price: 200,
      estimatedRefund: "200.00",
      cleanerPayout: "0.00",
      warningMessage: "You can cancel this appointment for a full refund.",
      daysUntilAppointment: 10,
      hasCleanerAssigned: false,
      willChargeCancellationFee: false,
      cancellationFee: 25,
      hasPaymentMethod: true,
    };

    const noPaymentMethodInfo = {
      isWithinPenaltyWindow: false,
      price: 200,
      estimatedRefund: "200.00",
      cleanerPayout: "0.00",
      warningMessage: "You can cancel this appointment.",
      daysUntilAppointment: 5,
      hasCleanerAssigned: false,
      willChargeCancellationFee: true,
      cancellationFee: 25,
      hasPaymentMethod: false,
    };

    it("should show Cancellation Fee Required title when fee will be charged", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cancellationFeeInfo}
        />
      );

      expect(getByText("Cancellation Fee Required")).toBeTruthy();
    });

    it("should show Card Will Be Charged section when fee applies", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cancellationFeeInfo}
        />
      );

      expect(getByText("Card Will Be Charged")).toBeTruthy();
      expect(getByText("Cancellation Fee")).toBeTruthy();
      expect(getByText("$25")).toBeTruthy();
    });

    it("should show fee note about immediate charge", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cancellationFeeInfo}
        />
      );

      expect(
        getByText("This fee will be charged to your card on file immediately upon cancellation.")
      ).toBeTruthy();
    });

    it("should show correct checkbox label for fee agreement", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cancellationFeeInfo}
        />
      );

      expect(getByText("I agree to pay the $25 cancellation fee")).toBeTruthy();
    });

    it("should not show fee section when outside 7-day window", () => {
      const { queryByText, getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={noCancellationFeeInfo}
        />
      );

      expect(queryByText("Card Will Be Charged")).toBeNull();
      expect(queryByText("Cancellation Fee Required")).toBeNull();
      // Should show normal title (may appear in title and button)
      expect(getAllByText("Cancel Appointment").length).toBeGreaterThan(0);
    });

    it("should not show fee section when user has no payment method", () => {
      const { queryByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={noPaymentMethodInfo}
        />
      );

      expect(queryByText("Card Will Be Charged")).toBeNull();
    });

    it("should show both fee warning and penalty window info together", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cancellationFeeWithPenaltyInfo}
        />
      );

      // Fee warning should be shown
      expect(getByText("Card Will Be Charged")).toBeTruthy();
      expect(getByText("$25")).toBeTruthy();

      // Financial breakdown should also be shown
      expect(getByText("Financial Breakdown")).toBeTruthy();
      expect(getByText("Your Refund (50%)")).toBeTruthy();
      expect(getByText("$100.00")).toBeTruthy();
    });

    it("should use warning styling when fee will be charged", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cancellationFeeInfo}
        />
      );

      // Header should say "Cancellation Fee Required" not "Cancel Appointment"
      expect(getByText("Cancellation Fee Required")).toBeTruthy();
    });

    it("should display cancellation fee amount correctly", () => {
      const customFeeInfo = {
        ...cancellationFeeInfo,
        cancellationFee: 35,
      };

      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={customFeeInfo}
        />
      );

      expect(getByText("$35")).toBeTruthy();
      expect(getByText("I agree to pay the $35 cancellation fee")).toBeTruthy();
    });
  });

  describe("No Cancellation Fee When No Cleaner Assigned", () => {
    const noCleanerAssignedInfo = {
      isWithinPenaltyWindow: false,
      price: 200,
      estimatedRefund: "200.00",
      cleanerPayout: "0.00",
      warningMessage: "You can cancel this appointment for a full refund. No cancellation fee applies since no cleaner has been assigned.",
      daysUntilAppointment: 3, // Within 7-day window
      hasCleanerAssigned: false,
      willChargeCancellationFee: false, // Key: no fee because no cleaner
      cancellationFee: 25,
      hasPaymentMethod: true,
    };

    const cleanerAssignedWithinWindowInfo = {
      isWithinPenaltyWindow: false,
      price: 200,
      estimatedRefund: "200.00",
      cleanerPayout: "0.00",
      warningMessage: "A $25 cancellation fee will be charged.",
      daysUntilAppointment: 3, // Within 7-day window
      hasCleanerAssigned: true,
      willChargeCancellationFee: true, // Fee charged because cleaner assigned
      cancellationFee: 25,
      hasPaymentMethod: true,
    };

    it("should NOT show cancellation fee warning when no cleaner assigned (even within window)", () => {
      const { queryByText, getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={noCleanerAssignedInfo}
        />
      );

      // Should not show fee-related UI
      expect(queryByText("Card Will Be Charged")).toBeNull();
      expect(queryByText("Cancellation Fee Required")).toBeNull();
      expect(queryByText("$25")).toBeNull();

      // Should show normal cancel title
      expect(getAllByText("Cancel Appointment").length).toBeGreaterThan(0);
    });

    it("should show cancellation fee warning when cleaner IS assigned (within window)", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cleanerAssignedWithinWindowInfo}
        />
      );

      // Should show fee-related UI
      expect(getByText("Card Will Be Charged")).toBeTruthy();
      expect(getByText("Cancellation Fee Required")).toBeTruthy();
      expect(getByText("$25")).toBeTruthy();
    });

    it("should show simple checkbox label when no cleaner assigned", () => {
      const { getByText, queryByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={noCleanerAssignedInfo}
        />
      );

      // Should show simple cancellation checkbox, not fee agreement
      expect(getByText("I want to cancel this appointment")).toBeTruthy();
      expect(queryByText(/I agree to pay/)).toBeNull();
    });

    it("should show fee agreement checkbox when cleaner IS assigned", () => {
      const { getByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={cleanerAssignedWithinWindowInfo}
        />
      );

      // Should show fee agreement checkbox
      expect(getByText("I agree to pay the $25 cancellation fee")).toBeTruthy();
    });

    it("should indicate no payment method required when no cleaner assigned", () => {
      const noPaymentMethodNoCleanerInfo = {
        ...noCleanerAssignedInfo,
        hasPaymentMethod: false,
      };

      const { queryByText, getAllByText } = render(
        <CancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={noPaymentMethodNoCleanerInfo}
        />
      );

      // Should still be able to cancel without showing card warning
      expect(queryByText("Card Will Be Charged")).toBeNull();
      expect(getAllByText("Cancel Appointment").length).toBeGreaterThan(0);
    });
  });
});
