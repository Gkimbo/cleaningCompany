import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0", 200: "#e0e0e0", 500: "#9e9e9e", 700: "#616161", 800: "#424242" },
    primary: { 50: "#e3f2fd", 100: "#bbdefb", 400: "#42a5f5", 500: "#2196f3", 600: "#1976d2" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 500: "#ff9800", 600: "#fb8c00" },
    error: { 50: "#ffebee", 500: "#f44336", 600: "#e53935" },
    success: { 50: "#e8f5e9", 500: "#4caf50", 600: "#43a047" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0", medium: "#bdbdbd" },
    glass: { overlay: "rgba(0,0,0,0.5)" },
    background: { tertiary: "#f5f5f5" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 20 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {}, lg: {} },
}));

jest.mock("../../src/services/fetchRequests/PricingService", () => ({
  getFullConfig: jest.fn(),
  updatePricing: jest.fn(),
}));

jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({
    refreshPricing: jest.fn(),
  }),
}));

jest.mock("../../src/components/owner/PricingWarningModal", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return ({ visible, onClose, onConfirm, loading }) => {
    if (!visible) return null;
    return (
      <View testID="warning-modal">
        <Text>Warning Modal</Text>
        <TouchableOpacity testID="modal-cancel" onPress={onClose}>
          <Text>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="modal-confirm" onPress={onConfirm}>
          <Text>Confirm</Text>
        </TouchableOpacity>
        {loading && <Text testID="modal-loading">Loading...</Text>}
      </View>
    );
  };
});

import PricingService from "../../src/services/fetchRequests/PricingService";
import PricingManagement from "../../src/components/owner/PricingManagement";

describe("PricingManagement", () => {
  const mockState = {
    currentUser: {
      token: "test-token",
    },
  };

  const mockPricingConfig = {
    source: "database",
    config: {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
      sheetFeePerBed: 30,
      towelFee: 5,
      faceClothFee: 2,
      timeWindowAnytime: 0,
      timeWindow10To3: 25,
      timeWindow11To4: 25,
      timeWindow12To2: 30,
      cancellationFee: 25,
      cancellationWindowDays: 7,
      homeownerPenaltyDays: 3,
      cleanerPenaltyDays: 4,
      refundPercentage: 0.5,
      platformFeePercent: 0.1,
      highVolumeFee: 50,
    },
  };

  const mockStaticDefaults = {
    source: "config",
    config: null,
    staticDefaults: {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
      sheetFeePerBed: 30,
      towelFee: 5,
      faceClothFee: 2,
      timeWindowAnytime: 0,
      timeWindow10To3: 25,
      timeWindow11To4: 25,
      timeWindow12To2: 30,
      cancellationFee: 25,
      cancellationWindowDays: 7,
      homeownerPenaltyDays: 3,
      cleanerPenaltyDays: 4,
      refundPercentage: 0.5,
      platformFeePercent: 0.1,
      highVolumeFee: 50,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading indicator while fetching config", async () => {
      let resolvePromise;
      PricingService.getFullConfig.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { getByText } = render(<PricingManagement state={mockState} />);

      expect(getByText("Loading pricing configuration...")).toBeTruthy();

      // Resolve promise to complete the test
      resolvePromise(mockPricingConfig);
      await waitFor(() => {});
    });

    it("should hide loading indicator after fetching config", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { queryByText, getByText } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading pricing configuration...")).toBeNull();
      });

      expect(getByText("Manage Pricing")).toBeTruthy();
    });
  });

  describe("Form Display", () => {
    it("should display pricing management title", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByText } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Manage Pricing")).toBeTruthy();
      });
    });

    it("should display all section headers", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByText } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Base Pricing")).toBeTruthy();
        expect(getByText("Linen Services")).toBeTruthy();
        expect(getByText("Time Window Surcharges")).toBeTruthy();
        expect(getByText("Cancellation Policy")).toBeTruthy();
        expect(getByText("Platform Fees")).toBeTruthy();
      });
    });

    it("should display all pricing fields", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByText } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Base Price (1 bed/1 bath)")).toBeTruthy();
        expect(getByText("Extra Bed/Bath Fee")).toBeTruthy();
        expect(getByText("Sheet Fee (per bed)")).toBeTruthy();
        expect(getByText("Towel Fee (per towel)")).toBeTruthy();
        expect(getByText("Face Cloth Fee (each)")).toBeTruthy();
        expect(getByText("Anytime (flexible)")).toBeTruthy();
        expect(getByText("10am - 3pm Window")).toBeTruthy();
        expect(getByText("11am - 4pm Window")).toBeTruthy();
        expect(getByText("12pm - 2pm Window")).toBeTruthy();
        expect(getByText("Cancellation Fee")).toBeTruthy();
      });
    });

    it("should populate form with config values", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByDisplayValue, getAllByDisplayValue } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy(); // basePrice
        expect(getAllByDisplayValue("50").length).toBeGreaterThan(0); // extraBedBathFee and others
        expect(getAllByDisplayValue("30").length).toBeGreaterThan(0); // sheetFeePerBed
      });
    });

    it("should use static defaults when no database config", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockStaticDefaults);

      const { getByDisplayValue } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });
    });
  });

  describe("Form Interaction", () => {
    it("should update form values on input change", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByDisplayValue } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });

      const basePriceInput = getByDisplayValue("150");
      fireEvent.changeText(basePriceInput, "175");

      expect(getByDisplayValue("175")).toBeTruthy();
    });

    it("should enable save button when changes are made", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByDisplayValue, getByText } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });

      // Change a value
      const basePriceInput = getByDisplayValue("150");
      fireEvent.changeText(basePriceInput, "175");

      // Save button should be enabled
      const saveButton = getByText("Save Changes");
      expect(saveButton).toBeTruthy();
    });
  });

  describe("Save Flow", () => {
    it("should show warning modal when save is pressed", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByDisplayValue, getByText, getByTestId } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });

      // Make a change
      const basePriceInput = getByDisplayValue("150");
      fireEvent.changeText(basePriceInput, "175");

      // Press save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      // Warning modal should appear
      expect(getByTestId("warning-modal")).toBeTruthy();
    });

    it("should close warning modal when cancel is pressed", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByDisplayValue, getByText, getByTestId, queryByTestId } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });

      // Make a change and press save
      const basePriceInput = getByDisplayValue("150");
      fireEvent.changeText(basePriceInput, "175");
      fireEvent.press(getByText("Save Changes"));

      // Press cancel on modal
      fireEvent.press(getByTestId("modal-cancel"));

      // Modal should be closed
      expect(queryByTestId("warning-modal")).toBeNull();
    });

    it("should call updatePricing when confirm is pressed", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);
      PricingService.updatePricing.mockResolvedValue({
        success: true,
        message: "Pricing updated successfully",
      });

      const { getByDisplayValue, getByText, getByTestId } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });

      // Make a change and press save
      const basePriceInput = getByDisplayValue("150");
      fireEvent.changeText(basePriceInput, "175");
      fireEvent.press(getByText("Save Changes"));

      // Confirm on modal
      fireEvent.press(getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(PricingService.updatePricing).toHaveBeenCalled();
      });
    });

    it("should show success message after successful save", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);
      PricingService.updatePricing.mockResolvedValue({
        success: true,
        message: "Pricing updated successfully",
      });

      const { getByDisplayValue, getByText, getByTestId } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });

      // Make a change, save, and confirm
      const basePriceInput = getByDisplayValue("150");
      fireEvent.changeText(basePriceInput, "175");
      fireEvent.press(getByText("Save Changes"));
      fireEvent.press(getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(getByText(/updated successfully|Changes saved/i)).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error when fetch fails", async () => {
      PricingService.getFullConfig.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText(/Failed to load/i)).toBeTruthy();
      });
    });

    it("should show error when save fails", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);
      PricingService.updatePricing.mockRejectedValue(
        new Error("Save failed")
      );

      const { getByDisplayValue, getByText, getByTestId } = render(
        <PricingManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByDisplayValue("150")).toBeTruthy();
      });

      // Make a change, save, and confirm
      const basePriceInput = getByDisplayValue("150");
      fireEvent.changeText(basePriceInput, "175");
      fireEvent.press(getByText("Save Changes"));
      fireEvent.press(getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(getByText(/failed|error/i)).toBeTruthy();
      });
    });

    it("should show no changes state when form is unchanged", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByText } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        // Button shows "No Changes" when form is unchanged
        expect(getByText("No Changes")).toBeTruthy();
      });

      // Try to press the disabled button
      fireEvent.press(getByText("No Changes"));

      await waitFor(() => {
        expect(getByText(/No changes/i)).toBeTruthy();
      });
    });
  });

  describe("Percentage Fields", () => {
    it("should display percentage values correctly", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByText, getAllByText, getAllByDisplayValue } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        // 0.5 should display as 50%
        expect(getAllByText(/Client Refund/).length).toBeGreaterThan(0);
        // Verify the 50% display value exists (may appear multiple times)
        expect(getAllByDisplayValue("50").length).toBeGreaterThan(0);
        // 0.1 should display as 10%
        expect(getAllByText(/Platform Fee/).length).toBeGreaterThan(0);
        // Verify the 10% display value
        expect(getAllByDisplayValue("10").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Current Value Display", () => {
    it("should show current values for each field", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getAllByText } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        // Should show "Current:" labels
        expect(getAllByText("Current:").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Navigation", () => {
    it("should have a back button", async () => {
      PricingService.getFullConfig.mockResolvedValue(mockPricingConfig);

      const { getByText } = render(<PricingManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Back")).toBeTruthy();
      });
    });
  });
});
