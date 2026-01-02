import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0", 200: "#e0e0e0", 300: "#bdbdbd", 500: "#9e9e9e", 700: "#616161", 800: "#424242" },
    primary: { 50: "#e3f2fd", 100: "#bbdefb", 400: "#42a5f5", 500: "#2196f3", 600: "#1976d2" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 500: "#ff9800", 600: "#fb8c00" },
    error: { 50: "#ffebee", 200: "#ffcdd2", 500: "#f44336", 600: "#e53935", 700: "#d32f2f" },
    success: { 50: "#e8f5e9", 100: "#c8e6c9", 200: "#a5d6a7", 400: "#66bb6a", 500: "#4caf50", 600: "#43a047", 700: "#388e3c", 800: "#2e7d32" },
    secondary: { 50: "#e3f2fd", 600: "#1e88e5" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0", medium: "#bdbdbd" },
    background: { secondary: "#f5f5f5", tertiary: "#fafafa" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 20 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {}, lg: {} },
}));

jest.mock("../../src/services/fetchRequests/IncentivesService", () => ({
  getFullConfig: jest.fn(),
  updateIncentives: jest.fn(),
}));

import IncentivesService from "../../src/services/fetchRequests/IncentivesService";
import IncentivesManagement from "../../src/components/owner/IncentivesManagement";

describe("IncentivesManagement", () => {
  const mockState = {
    currentUser: {
      token: "test-token",
    },
  };

  const mockIncentiveConfig = {
    source: "database",
    config: {
      id: 1,
      cleanerIncentiveEnabled: true,
      cleanerFeeReductionPercent: 1.0,
      cleanerEligibilityDays: 30,
      cleanerMaxCleanings: 5,
      homeownerIncentiveEnabled: true,
      homeownerDiscountPercent: 0.1,
      homeownerMaxCleanings: 4,
      isActive: true,
    },
    formattedConfig: {
      cleaner: {
        enabled: true,
        feeReductionPercent: 1.0,
        eligibilityDays: 30,
        maxCleanings: 5,
      },
      homeowner: {
        enabled: true,
        discountPercent: 0.1,
        maxCleanings: 4,
      },
    },
  };

  const mockDefaultConfig = {
    source: "defaults",
    config: null,
    formattedConfig: {
      cleaner: {
        enabled: false,
        feeReductionPercent: 1.0,
        eligibilityDays: 30,
        maxCleanings: 5,
      },
      homeowner: {
        enabled: false,
        discountPercent: 0.1,
        maxCleanings: 4,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading indicator while fetching config", async () => {
      let resolvePromise;
      IncentivesService.getFullConfig.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      expect(getByText("Loading incentive settings...")).toBeTruthy();

      // Resolve promise to complete the test
      resolvePromise(mockIncentiveConfig);
      await waitFor(() => {});
    });

    it("should hide loading indicator after fetching config", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { queryByText, getByText } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading incentive settings...")).toBeNull();
        expect(getByText("Manage Incentives")).toBeTruthy();
      });
    });
  });

  describe("Initial Form Values", () => {
    it("should populate form with database config values", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Check that values are populated (converted from decimal to percentage)
      await waitFor(() => {
        expect(getByDisplayValue("100")).toBeTruthy(); // 1.0 * 100 = 100%
        expect(getByDisplayValue("30")).toBeTruthy(); // eligibility days
        expect(getByDisplayValue("5")).toBeTruthy(); // cleaner max cleanings
        expect(getByDisplayValue("10")).toBeTruthy(); // 0.1 * 100 = 10%
        expect(getByDisplayValue("4")).toBeTruthy(); // homeowner max cleanings
      });
    });

    it("should populate form with default values when no database config", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockDefaultConfig);

      const { getByText, UNSAFE_getAllByType } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // When using defaults, both incentives should be disabled (toggle off)
      // The input fields are hidden when disabled, so we check the switches
      await waitFor(() => {
        const switches = UNSAFE_getAllByType("RCTSwitch");
        expect(switches.length).toBe(2);
        // Both should be off (value: false) for default config
        expect(switches[0].props.value).toBe(false);
        expect(switches[1].props.value).toBe(false);
      });
    });
  });

  describe("Section Rendering", () => {
    it("should display cleaner incentive section", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("New Cleaner Incentive")).toBeTruthy();
      });
    });

    it("should display homeowner incentive section", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("New Homeowner Incentive")).toBeTruthy();
      });
    });

    it("should display info banner", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(
          getByText(/Incentives help attract new cleaners and homeowners/)
        ).toBeTruthy();
      });
    });

    it("should display change note section", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Change Note (Optional)")).toBeTruthy();
      });
    });
  });

  describe("Toggle Interactions", () => {
    it("should show cleaner incentive details when enabled", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText, getAllByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Fee Reduction")).toBeTruthy();
        expect(getByText("Eligibility Window")).toBeTruthy();
        // "Max Qualifying Cleanings" appears twice (cleaner and homeowner)
        expect(getAllByText("Max Qualifying Cleanings").length).toBe(2);
      });
    });

    it("should show homeowner incentive details when enabled", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Discount Percentage")).toBeTruthy();
      });
    });
  });

  describe("Save Button State", () => {
    it("should show 'No Changes' when no changes made", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("No Changes")).toBeTruthy();
      });
    });

    it("should show 'Save Changes' after making changes", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Change a value
      const eligibilityDaysInput = getByDisplayValue("30");
      fireEvent.changeText(eligibilityDaysInput, "45");

      await waitFor(() => {
        expect(getByText("Save Changes")).toBeTruthy();
      });
    });
  });

  describe("Saving Configuration", () => {
    it("should call updateIncentives on save", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);
      IncentivesService.updateIncentives.mockResolvedValue({
        success: true,
        message: "Incentive configuration updated successfully",
      });

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Make a change
      const eligibilityDaysInput = getByDisplayValue("30");
      fireEvent.changeText(eligibilityDaysInput, "45");

      await waitFor(() => {
        expect(getByText("Save Changes")).toBeTruthy();
      });

      // Click save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(IncentivesService.updateIncentives).toHaveBeenCalledWith(
          "test-token",
          expect.objectContaining({
            cleanerEligibilityDays: 45,
          })
        );
      });
    });

    it("should show success message after successful save", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);
      IncentivesService.updateIncentives.mockResolvedValue({
        success: true,
        message: "Incentive configuration updated successfully",
      });

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Make a change
      const eligibilityDaysInput = getByDisplayValue("30");
      fireEvent.changeText(eligibilityDaysInput, "45");

      // Click save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(getByText("Incentives updated successfully!")).toBeTruthy();
      });
    });

    it("should show error message on save failure", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);
      IncentivesService.updateIncentives.mockResolvedValue({
        success: false,
        error: "Failed to update incentives",
      });

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Make a change
      const eligibilityDaysInput = getByDisplayValue("30");
      fireEvent.changeText(eligibilityDaysInput, "45");

      // Click save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(getByText("Failed to update incentives")).toBeTruthy();
      });
    });
  });

  describe("Validation", () => {
    it("should show error for invalid fee reduction", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Enter invalid value
      const feeReductionInput = getByDisplayValue("100");
      fireEvent.changeText(feeReductionInput, "150");

      // Click save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(getByText("Fee reduction must be between 0 and 100%")).toBeTruthy();
      });
    });

    it("should show error for invalid eligibility days", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Enter invalid value
      const eligibilityInput = getByDisplayValue("30");
      fireEvent.changeText(eligibilityInput, "0");

      // Click save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(getByText("Eligibility days must be between 1 and 365")).toBeTruthy();
      });
    });

    it("should show error for invalid max cleanings", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Enter invalid value for cleaner max cleanings
      const maxCleaningsInput = getByDisplayValue("5");
      fireEvent.changeText(maxCleaningsInput, "0");

      // Click save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(getByText("Max cleanings must be between 1 and 100")).toBeTruthy();
      });
    });

    it("should show error for invalid discount percentage", async () => {
      // Use enabled config so inputs are visible
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText, getByDisplayValue } = render(
        <IncentivesManagement state={mockState} />
      );

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Enter invalid value
      const discountInput = getByDisplayValue("10");
      fireEvent.changeText(discountInput, "-5");

      // Click save
      const saveButton = getByText("Save Changes");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(getByText("Discount must be between 0 and 100%")).toBeTruthy();
      });
    });

    it("should show error when trying to save with no changes", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Manage Incentives")).toBeTruthy();
      });

      // Try to save without changes (button should be disabled, but test the check)
      const saveButton = getByText("No Changes");
      fireEvent.press(saveButton);

      // The save should not be called since button is disabled
      expect(IncentivesService.updateIncentives).not.toHaveBeenCalled();
    });
  });

  describe("Preview Banners", () => {
    it("should show cleaner preview banner when enabled", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(
          getByText(/New cleaners get 100% reduced platform fees for first 5 cleanings!/)
        ).toBeTruthy();
      });
    });

    it("should show homeowner preview banner when enabled", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText(/First 4 cleanings get 10% off!/)).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle fetch error gracefully", async () => {
      IncentivesService.getFullConfig.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Failed to load incentive configuration")).toBeTruthy();
      });
    });
  });

  describe("Back Button", () => {
    it("should render back button", async () => {
      IncentivesService.getFullConfig.mockResolvedValue(mockIncentiveConfig);

      const { getByText } = render(<IncentivesManagement state={mockState} />);

      await waitFor(() => {
        expect(getByText("Back")).toBeTruthy();
      });
    });
  });
});
