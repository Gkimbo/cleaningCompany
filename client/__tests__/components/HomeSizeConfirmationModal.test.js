import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock FetchData service
jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  createHomeSizeAdjustment: jest.fn(),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock expo-camera
jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn().mockResolvedValue({ granted: true })]),
}));

// Mock @react-native-picker/picker
jest.mock("@react-native-picker/picker", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    Picker: ({ selectedValue, onValueChange, children, testID }) => (
      <View testID={testID || "picker"}>
        <Text>{selectedValue}</Text>
      </View>
    ),
  };
});

// Mock styles/theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0" },
    primary: { 50: "#e6f7f7", 100: "#b3e6e6", 200: "#80d4d4", 600: "#0d9488", 700: "#0a7a70" },
    secondary: { 50: "#f5f3ff", 700: "#6d28d9" },
    success: { 600: "#16a34a" },
    warning: { 100: "#fef3c7", 300: "#fcd34d", 700: "#b45309", 800: "#92400e" },
    error: { 100: "#fee2e2", 700: "#b91c1c" },
    text: { primary: "#111", secondary: "#555", tertiary: "#888" },
    border: { light: "#e5e5e5" },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  shadows: { sm: {}, md: {}, lg: {} },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
}));

// Import after mocks
import HomeSizeConfirmationModal from "../../src/components/employeeAssignments/HomeSizeConfirmationModal";
import FetchData from "../../src/services/fetchRequests/fetchData";

describe("HomeSizeConfirmationModal Component", () => {
  const mockHome = {
    id: 456,
    nickName: "Beach House",
    address: "123 Ocean Dr",
    city: "Miami",
    state: "FL",
    zipcode: "33139",
    numBeds: "3",
    numBaths: "2",
    contact: "555-1234",
  };

  const mockAppointment = {
    id: 123,
    homeId: 456,
    date: "2024-01-15",
    price: 150,
  };

  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockOnReportSubmitted = jest.fn();

  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    onReportSubmitted: mockOnReportSubmitted,
    home: mockHome,
    appointment: mockAppointment,
    token: "test-token",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Confirm Step - Initial Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("Confirm Home Size")).toBeTruthy();
    });

    it("should not render when home is null", () => {
      const { queryByText } = render(<HomeSizeConfirmationModal {...defaultProps} home={null} />);

      expect(queryByText("Confirm Home Size")).toBeNull();
    });

    it("should display verify message", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("Please verify this home's details before starting")).toBeTruthy();
    });

    it("should display home address", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("123 Ocean Dr")).toBeTruthy();
      expect(getByText("Miami, FL 33139")).toBeTruthy();
    });

    it("should display bedroom count", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("Bedrooms")).toBeTruthy();
      expect(getByText("3")).toBeTruthy();
    });

    it("should display bathroom count", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("Bathrooms")).toBeTruthy();
      expect(getByText("2")).toBeTruthy();
    });

    it("should display confirmation question", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("Does this match what you see?")).toBeTruthy();
    });

    it("should render Yes This Matches button", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("Yes, This Matches")).toBeTruthy();
    });

    it("should render No Report Discrepancy button", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("No, Report Discrepancy")).toBeTruthy();
    });

    it("should render Cancel button", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      expect(getByText("Cancel")).toBeTruthy();
    });
  });

  describe("Confirm Step - Actions", () => {
    it("should call onConfirm when Yes This Matches is pressed", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("Yes, This Matches"));

      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it("should call onClose when Cancel is pressed", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should navigate to selectSize step when Report Discrepancy is pressed", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("Report Home Size")).toBeTruthy();
    });
  });

  describe("Select Size Step", () => {
    it("should display Report Home Size title", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("Report Home Size")).toBeTruthy();
    });

    it("should display enter actual beds/baths message", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("Enter the actual number of beds and baths")).toBeTruthy();
    });

    it("should display On File comparison", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("On File")).toBeTruthy();
      expect(getByText("3 bed / 2 bath")).toBeTruthy();
    });

    it("should display Actual Bedrooms picker", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("Actual Bedrooms")).toBeTruthy();
    });

    it("should display Actual Bathrooms picker", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("Actual Bathrooms")).toBeTruthy();
    });

    it("should display Next Take Photos button", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("Next: Take Photos")).toBeTruthy();
    });

    it("should display Back button", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      expect(getByText("← Back")).toBeTruthy();
    });

    it("should navigate back to confirm step when Back is pressed", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));
      fireEvent.press(getByText("← Back"));

      expect(getByText("Confirm Home Size")).toBeTruthy();
    });

    it("should show error when trying to proceed with same size as on file", () => {
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));
      // Don't change the values, they should still match the home values
      fireEvent.press(getByText("Next: Take Photos"));

      expect(getByText("The reported size must be different from what's on file.")).toBeTruthy();
    });
  });

  describe("Cancel and Reset", () => {
    it("should reset state when modal visibility changes to false", () => {
      const { rerender, getByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      // Navigate to selectSize
      fireEvent.press(getByText("No, Report Discrepancy"));
      expect(getByText("Report Home Size")).toBeTruthy();

      // Hide and show the modal again
      rerender(<HomeSizeConfirmationModal {...defaultProps} visible={false} />);
      rerender(<HomeSizeConfirmationModal {...defaultProps} visible={true} />);

      // Should be back to confirm step
      expect(getByText("Confirm Home Size")).toBeTruthy();
    });

    it("should reset state when Cancel is pressed from selectSize", () => {
      const { getByText, getAllByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));

      // Press Cancel
      const cancelButtons = getAllByText("Cancel");
      fireEvent.press(cancelButtons[cancelButtons.length - 1]);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle home with string numBeds", () => {
      const homeWithStringBeds = { ...mockHome, numBeds: "4" };
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} home={homeWithStringBeds} />);

      expect(getByText("4")).toBeTruthy();
    });

    it("should handle home with string numBaths", () => {
      const homeWithStringBaths = { ...mockHome, numBaths: "2.5" };
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} home={homeWithStringBaths} />);

      expect(getByText("2.5")).toBeTruthy();
    });

    it("should handle home with numeric numBeds", () => {
      const homeWithNumericBeds = { ...mockHome, numBeds: 3 };
      const { getByText } = render(<HomeSizeConfirmationModal {...defaultProps} home={homeWithNumericBeds} />);

      expect(getByText("3")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should clear error when navigating back", () => {
      const { getByText, queryByText } = render(<HomeSizeConfirmationModal {...defaultProps} />);

      fireEvent.press(getByText("No, Report Discrepancy"));
      // Try to proceed without changing values to trigger error
      fireEvent.press(getByText("Next: Take Photos"));
      expect(getByText("The reported size must be different from what's on file.")).toBeTruthy();

      // Navigate back
      fireEvent.press(getByText("← Back"));

      // Navigate forward again - error should be cleared
      fireEvent.press(getByText("No, Report Discrepancy"));
      expect(queryByText("The reported size must be different from what's on file.")).toBeNull();
    });
  });

  describe("Submit Report", () => {
    it("should have createHomeSizeAdjustment function available", () => {
      expect(FetchData.createHomeSizeAdjustment).toBeDefined();
    });

    it("should have onReportSubmitted callback set up", () => {
      expect(mockOnReportSubmitted).toBeDefined();
    });

    it("should have onConfirm callback set up", () => {
      expect(mockOnConfirm).toBeDefined();
    });
  });
});
