/**
 * Tests for HomeownerAdjustmentNotification
 * Tests the homeowner-facing notification for home size adjustment claims
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock FetchData
const mockRespondToAdjustment = jest.fn();
jest.mock("../../../services/fetchRequests/fetchData", () => ({
  respondToAdjustment: (...args) => mockRespondToAdjustment(...args),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => {
  const { Text } = require("react-native");
  return ({ name, testID, ...props }) => (
    <Text testID={testID || `icon-${name}`} {...props}>{name}</Text>
  );
});

// Mock theme
jest.mock("../../../services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1" },
    secondary: { 50: "#f8fafc", 700: "#334155", 800: "#1e293b" },
    error: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 600: "#dc2626", 700: "#b91c1c" },
    success: { 100: "#dcfce7", 600: "#16a34a" },
    warning: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e" },
    neutral: { 0: "#fff", 100: "#f5f5f5", 500: "#737373" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#a3a3a3" },
    border: { light: "#e5e5e5" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  shadows: { sm: {}, lg: {} },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
}));

// Import after mocks
import HomeownerAdjustmentNotification from "../HomeownerAdjustmentNotification";

describe("HomeownerAdjustmentNotification", () => {
  const mockAdjustment = {
    id: 1,
    originalNumBeds: "3",
    originalNumBaths: "2",
    reportedNumBeds: "4",
    reportedNumBaths: "3",
    priceDifference: 50.0,
    cleanerNote: "Home has an extra bedroom and bathroom",
    home: {
      address: "123 Main St",
      city: "Boston",
    },
    cleaner: {
      firstName: "John",
      lastName: "Doe",
    },
    appointment: {
      date: "2025-02-15",
    },
  };

  const mockToken = "test-token";
  const mockOnResponse = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Notification Card", () => {
    it("should render the notification card", () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText("Home Size Report")).toBeTruthy();
    });

    it("should display cleaner name", () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText(/John Doe reported/)).toBeTruthy();
    });

    it("should display price difference", () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText(/\$50\.00/)).toBeTruthy();
    });

    it("should show 'Tap to review' prompt", () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText("Tap to review")).toBeTruthy();
    });
  });

  describe("Modal Display", () => {
    it("should open modal when notification is tapped", async () => {
      const { getByText, queryByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      // Modal should not be visible initially
      expect(queryByText("Home Size Discrepancy")).toBeFalsy();

      // Tap the notification
      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      // Modal should now be visible
      expect(getByText("Home Size Discrepancy")).toBeTruthy();
    });

    it("should display home address in modal", async () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      expect(getByText("123 Main St, Boston")).toBeTruthy();
    });

    it("should display original and reported room counts", async () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      expect(getByText("3 bed / 2 bath")).toBeTruthy();
      expect(getByText("4 bed / 3 bath")).toBeTruthy();
    });

    it("should display price impact information", async () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      expect(getByText("Price Adjustment")).toBeTruthy();
      expect(getByText("+$50.00")).toBeTruthy();
    });

    it("should display cleaner note", async () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      expect(getByText("Home has an extra bedroom and bathroom")).toBeTruthy();
    });

    it("should show approve and dispute buttons", async () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      expect(getByText("Approve & Update Home")).toBeTruthy();
      expect(getByText("Dispute This Report")).toBeTruthy();
    });
  });

  describe("Approve Flow", () => {
    it("should call respondToAdjustment with approved=true when approve is pressed", async () => {
      mockRespondToAdjustment.mockResolvedValueOnce({ success: true });

      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      // Open modal
      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      // Press approve
      await act(async () => {
        fireEvent.press(getByText("Approve & Update Home"));
      });

      await waitFor(() => {
        expect(mockRespondToAdjustment).toHaveBeenCalledWith(
          mockToken,
          1, // adjustment.id
          true, // approved
          null // no response text
        );
      });
    });

    it("should call onResponse callback after successful approval", async () => {
      const mockResult = { success: true, request: { id: 1, status: "approved" } };
      mockRespondToAdjustment.mockResolvedValueOnce(mockResult);

      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Approve & Update Home"));
      });

      await waitFor(() => {
        expect(mockOnResponse).toHaveBeenCalledWith(1, "approved", mockResult);
      });
    });

    it("should display error when approval fails", async () => {
      mockRespondToAdjustment.mockResolvedValueOnce({ error: "Failed to process approval" });

      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Approve & Update Home"));
      });

      await waitFor(() => {
        expect(getByText("Failed to process approval")).toBeTruthy();
      });
    });
  });

  describe("Dispute Flow", () => {
    it("should show deny form when dispute button is pressed", async () => {
      const { getByText, getByPlaceholderText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Dispute This Report"));
      });

      expect(getByText("Please explain why you're disputing this report:")).toBeTruthy();
      expect(getByPlaceholderText("Enter your reason...")).toBeTruthy();
    });

    it("should require reason before submitting dispute", async () => {
      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Dispute This Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Submit Dispute"));
      });

      expect(getByText("Please provide a reason for denying.")).toBeTruthy();
      expect(mockRespondToAdjustment).not.toHaveBeenCalled();
    });

    it("should call respondToAdjustment with reason when dispute is submitted", async () => {
      mockRespondToAdjustment.mockResolvedValueOnce({ success: true });

      const { getByText, getByPlaceholderText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Dispute This Report"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Enter your reason..."), "The home only has 3 bedrooms");
      });

      await act(async () => {
        fireEvent.press(getByText("Submit Dispute"));
      });

      await waitFor(() => {
        expect(mockRespondToAdjustment).toHaveBeenCalledWith(
          mockToken,
          1,
          false,
          "The home only has 3 bedrooms"
        );
      });
    });

    it("should call onResponse callback after successful dispute", async () => {
      const mockResult = { success: true, request: { id: 1, status: "denied" } };
      mockRespondToAdjustment.mockResolvedValueOnce(mockResult);

      const { getByText, getByPlaceholderText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Dispute This Report"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Enter your reason..."), "The home only has 3 bedrooms");
      });

      await act(async () => {
        fireEvent.press(getByText("Submit Dispute"));
      });

      await waitFor(() => {
        expect(mockOnResponse).toHaveBeenCalledWith(1, "denied", mockResult);
      });
    });

    it("should allow going back from deny form", async () => {
      const { getByText, queryByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Dispute This Report"));
      });

      // Verify we're in the deny form
      expect(getByText("Submit Dispute")).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText("Back"));
      });

      // Should be back to the main buttons
      expect(queryByText("Submit Dispute")).toBeFalsy();
      expect(getByText("Approve & Update Home")).toBeTruthy();
    });
  });

  describe("Modal Close", () => {
    it("should close modal when close button is pressed", async () => {
      const { getByText, getAllByTestId, queryByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      // Open modal
      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      expect(getByText("Home Size Discrepancy")).toBeTruthy();

      // Close modal - get the first times icon (the close button)
      const timesIcons = getAllByTestId("icon-times");
      await act(async () => {
        fireEvent.press(timesIcons[0]);
      });

      expect(queryByText("Home Size Discrepancy")).toBeFalsy();
    });

    it("should reset state when modal is closed", async () => {
      const { getByText, getAllByTestId, getByPlaceholderText, queryByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      // Open modal and go to deny form
      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Dispute This Report"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Enter your reason..."), "Some reason");
      });

      // Close modal - get the first times icon (the close button)
      const timesIcons = getAllByTestId("icon-times");
      await act(async () => {
        fireEvent.press(timesIcons[0]);
      });

      // Reopen modal
      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      // Should be back to initial state (not in deny form)
      expect(queryByText("Submit Dispute")).toBeFalsy();
      expect(getByText("Approve & Update Home")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing home data gracefully", () => {
      const adjustmentNoHome = { ...mockAdjustment, home: null };

      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={adjustmentNoHome}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText("Home Size Report")).toBeTruthy();
    });

    it("should handle missing cleaner data gracefully", () => {
      const adjustmentNoCleaner = { ...mockAdjustment, cleaner: null };

      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={adjustmentNoCleaner}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText(/A cleaner reported/)).toBeTruthy();
    });

    it("should handle zero price difference", () => {
      const adjustmentNoDiff = { ...mockAdjustment, priceDifference: 0 };

      const { getByText, queryByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={adjustmentNoDiff}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      // Should not show additional charge in notification
      expect(queryByText(/Additional charge/)).toBeFalsy();
      expect(getByText("Home Size Report")).toBeTruthy();
    });

    it("should handle network error during approval", async () => {
      mockRespondToAdjustment.mockRejectedValueOnce(new Error("Network error"));

      const { getByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={mockAdjustment}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      await act(async () => {
        fireEvent.press(getByText("Approve & Update Home"));
      });

      await waitFor(() => {
        expect(getByText("Failed to submit response. Please try again.")).toBeTruthy();
      });
    });

    it("should handle missing cleanerNote", async () => {
      const adjustmentNoNote = { ...mockAdjustment, cleanerNote: null };

      const { getByText, queryByText } = render(
        <HomeownerAdjustmentNotification
          adjustment={adjustmentNoNote}
          token={mockToken}
          onResponse={mockOnResponse}
          onDismiss={mockOnDismiss}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Home Size Report"));
      });

      // Should not show the cleaner's note section
      expect(queryByText("Cleaner's Note:")).toBeFalsy();
    });
  });
});
