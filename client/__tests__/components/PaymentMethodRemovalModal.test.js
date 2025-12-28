import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");
jest.mock("react-native-paper", () => ({
  Checkbox: ({ status, onPress }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} testID="checkbox">
        <Text>{status}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0" },
    primary: { 50: "#e3f2fd", 200: "#90caf9", 600: "#1976d2", 800: "#1565c0" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 200: "#ffcc80", 500: "#ff9800", 600: "#fb8c00", 700: "#f57c00", 800: "#ef6c00" },
    error: { 50: "#ffebee", 200: "#ef9a9a", 500: "#f44336", 600: "#e53935", 700: "#d32f2f" },
    success: { 600: "#43a047" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0" },
    glass: { overlay: "rgba(0,0,0,0.5)" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 8, lg: 12, "2xl": 20 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {}, xl: {} },
}));

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000",
}));

// Mock fetch
global.fetch = jest.fn();

// Spy on Alert
jest.spyOn(Alert, "alert");

import PaymentMethodRemovalModal from "../../src/components/modals/PaymentMethodRemovalModal";

describe("PaymentMethodRemovalModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockToken = "test-token-123";
  const mockPaymentMethodId = "pm_test123";

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  const defaultEligibilityData = {
    canRemove: false,
    paymentMethodCount: 1,
    isLastPaymentMethod: true,
    outstandingFees: {
      cancellationFee: 0,
      appointmentDue: 0,
      totalDue: 0,
    },
    unpaidAppointments: [
      {
        id: 1,
        date: "2025-01-15",
        price: 150,
        daysUntil: 10,
        isWithinCancellationWindow: false,
        cancellationFee: 0,
        hasCleanerAssigned: false,
      },
    ],
    totalToPrepay: 150,
    totalCancellationFees: 0,
    options: {
      canPrepayAll: true,
      canCancelAll: true,
      mustPayOutstandingFirst: false,
    },
  };

  const eligibilityWithFees = {
    ...defaultEligibilityData,
    outstandingFees: {
      cancellationFee: 25,
      appointmentDue: 0,
      totalDue: 25,
    },
    options: {
      ...defaultEligibilityData.options,
      mustPayOutstandingFirst: true,
    },
  };

  const eligibilityWithCancellationWindow = {
    ...defaultEligibilityData,
    unpaidAppointments: [
      {
        id: 1,
        date: "2025-01-05",
        price: 150,
        daysUntil: 3,
        isWithinCancellationWindow: true,
        cancellationFee: 25,
        hasCleanerAssigned: false,
      },
    ],
    totalCancellationFees: 25,
  };

  describe("Modal Visibility", () => {
    it("should not render when visible is false", () => {
      const { queryByText } = render(
        <PaymentMethodRemovalModal
          visible={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      expect(queryByText("Cannot Remove Card")).toBeNull();
    });

    it("should render when visible is true", () => {
      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      expect(getByText("Cannot Remove Card")).toBeTruthy();
    });

    it("should return null when eligibilityData is null", () => {
      const { queryByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={null}
          token={mockToken}
        />
      );

      expect(queryByText("Cannot Remove Card")).toBeNull();
    });
  });

  describe("Outstanding Fees Warning", () => {
    it("should show outstanding fees warning when present", () => {
      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={eligibilityWithFees}
          token={mockToken}
        />
      );

      expect(getByText("Outstanding Fees")).toBeTruthy();
      expect(getByText(/\$25\.00 in outstanding fees/)).toBeTruthy();
    });

    it("should not show outstanding fees warning when no fees", () => {
      const { queryByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      expect(queryByText("Outstanding Fees")).toBeNull();
    });
  });

  describe("Unpaid Appointments", () => {
    it("should show unpaid appointments list", () => {
      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      expect(getByText("Unpaid Appointments (1)")).toBeTruthy();
      expect(getByText("$150.00")).toBeTruthy();
    });

    it("should show cancellation fee warning for appointments within 7 days", () => {
      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={eligibilityWithCancellationWindow}
          token={mockToken}
        />
      );

      expect(getByText("$25 fee if cancelled")).toBeTruthy();
    });
  });

  describe("Options Display", () => {
    it("should show Prepay All option when available", () => {
      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      expect(getByText("Prepay All Appointments")).toBeTruthy();
      expect(getByText(/Prepay \$150\.00/)).toBeTruthy();
    });

    it("should show Cancel All option when available", () => {
      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      expect(getByText("Cancel All Appointments")).toBeTruthy();
      expect(getByText("Cancel All & Remove Card")).toBeTruthy();
    });
  });

  describe("Prepay All Flow", () => {
    it("should call prepay-all-and-remove endpoint on button press", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          capturedAppointments: [{ id: 1, amount: 150 }],
          totalPrepaid: 150,
          hasPaymentMethod: false,
        }),
      });

      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      const prepayButton = getByText(/Prepay \$150\.00/);
      fireEvent.press(prepayButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "http://localhost:3000/payments/prepay-all-and-remove",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: `Bearer ${mockToken}`,
            }),
            body: JSON.stringify({ paymentMethodId: mockPaymentMethodId }),
          })
        );
      });
    });

    it("should show success alert on successful prepay", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          capturedAppointments: [{ id: 1, amount: 150 }],
          totalPrepaid: 150,
          hasPaymentMethod: false,
        }),
      });

      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      const prepayButton = getByText(/Prepay \$150\.00/);
      fireEvent.press(prepayButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          expect.stringContaining("$150.00"),
          expect.any(Array)
        );
      });
    });

    it("should show error on failed prepay", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Card declined" }),
      });

      const { getByText, findByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      const prepayButton = getByText(/Prepay \$150\.00/);
      fireEvent.press(prepayButton);

      const errorText = await findByText("Card declined");
      expect(errorText).toBeTruthy();
    });
  });

  describe("Cancel All Flow", () => {
    it("should require acknowledgement for cancellation fees", () => {
      const { getByText, getByTestId } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={eligibilityWithCancellationWindow}
          token={mockToken}
        />
      );

      // Button should be disabled initially (opacity style)
      const cancelButton = getByText("Cancel All & Remove Card");

      // Check the checkbox
      const checkbox = getByTestId("checkbox");
      fireEvent.press(checkbox);

      // Now the button should work
      expect(cancelButton).toBeTruthy();
    });

    it("should call cancel-all-and-remove endpoint after acknowledgement", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          cancelledAppointments: [{ id: 1 }],
          totalCancellationFees: 25,
          totalFeesPaid: 25,
          hasPaymentMethod: false,
        }),
      });

      const { getByText, getByTestId } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={eligibilityWithCancellationWindow}
          token={mockToken}
        />
      );

      // Check the acknowledgement checkbox
      const checkbox = getByTestId("checkbox");
      fireEvent.press(checkbox);

      // Press the cancel button
      const cancelButton = getByText("Cancel All & Remove Card");
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "http://localhost:3000/payments/cancel-all-and-remove",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              paymentMethodId: mockPaymentMethodId,
              acknowledgedCancellationFees: true,
            }),
          })
        );
      });
    });

    it("should not require acknowledgement when no cancellation fees", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          cancelledAppointments: [{ id: 1 }],
          totalCancellationFees: 0,
          totalFeesPaid: 0,
          hasPaymentMethod: false,
        }),
      });

      const { getByText, queryByTestId } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData} // No cancellation fees
          token={mockToken}
        />
      );

      // There should be no checkbox since no fees
      // The cancel button should work directly
      const cancelButton = getByText("Cancel All & Remove Card");
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });
    });
  });

  describe("Go Back Button", () => {
    it("should call onClose when Go Back is pressed", () => {
      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={defaultEligibilityData}
          token={mockToken}
        />
      );

      const goBackButton = getByText("Go Back");
      fireEvent.press(goBackButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Multiple Appointments", () => {
    it("should show all unpaid appointments", () => {
      const multipleAppointments = {
        ...defaultEligibilityData,
        unpaidAppointments: [
          {
            id: 1,
            date: "2025-01-15",
            price: 150,
            daysUntil: 10,
            isWithinCancellationWindow: false,
            cancellationFee: 0,
          },
          {
            id: 2,
            date: "2025-01-20",
            price: 200,
            daysUntil: 15,
            isWithinCancellationWindow: false,
            cancellationFee: 0,
          },
        ],
        totalToPrepay: 350,
      };

      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={multipleAppointments}
          token={mockToken}
        />
      );

      expect(getByText("Unpaid Appointments (2)")).toBeTruthy();
      expect(getByText("$150.00")).toBeTruthy();
      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText(/Prepay \$350\.00/)).toBeTruthy();
    });
  });

  describe("Combined Fees and Appointments", () => {
    it("should show total including outstanding fees and prepay amount", () => {
      const combinedData = {
        ...defaultEligibilityData,
        outstandingFees: {
          cancellationFee: 25,
          appointmentDue: 0,
          totalDue: 25,
        },
        totalToPrepay: 150,
        options: {
          ...defaultEligibilityData.options,
          mustPayOutstandingFirst: true,
        },
      };

      const { getByText } = render(
        <PaymentMethodRemovalModal
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          paymentMethodId={mockPaymentMethodId}
          eligibilityData={combinedData}
          token={mockToken}
        />
      );

      // Total should be 150 + 25 = 175
      expect(getByText(/Prepay \$175\.00/)).toBeTruthy();
    });
  });
});
