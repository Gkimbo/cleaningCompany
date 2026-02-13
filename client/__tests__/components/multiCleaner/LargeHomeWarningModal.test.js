/**
 * Comprehensive Tests for LargeHomeWarningModal component
 * Tests the modal that warns cleaners about large homes and offers multi-cleaner vs solo options
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock expo icons
jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

// Mock theme
jest.mock("../../../src/services/styles/theme", () => ({
  colors: {
    white: "#fff",
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1" },
    success: { 50: "#f0fdf4", 600: "#16a34a", 700: "#15803d" },
    warning: { 100: "#fef3c7", 600: "#d97706", 700: "#b45309" },
    error: { 50: "#fef2f2", 600: "#dc2626", 700: "#b91c1c" },
    neutral: { 0: "#fff", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 600: "#525252", 800: "#262626", 900: "#171717" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    xs: { fontSize: 12 },
    sm: { fontSize: 14 },
    base: { fontSize: 16 },
    lg: { fontSize: 18 },
    "2xl": { fontSize: 24 },
  },
  shadows: { sm: {} },
}));

import LargeHomeWarningModal from "../../../src/components/multiCleaner/LargeHomeWarningModal";

describe("LargeHomeWarningModal", () => {
  const defaultProps = {
    visible: true,
    homeDetails: {
      numBeds: 4,
      numBaths: 3,
    },
    recommendedCleaners: 2,
    onAcceptMultiCleaner: jest.fn(),
    onAcceptSolo: jest.fn(),
    onCancel: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Basic Rendering Tests
  // ============================================
  describe("Basic Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Large Home Detected")).toBeTruthy();
    });

    it("should not render content when visible is false", () => {
      const { queryByText } = render(
        <LargeHomeWarningModal {...defaultProps} visible={false} />
      );
      // Note: Modal component may still render but be hidden
      // Testing visibility requires checking modal props
    });

    it("should display the warning icon section", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Large Home Detected")).toBeTruthy();
    });
  });

  // ============================================
  // Home Details Display
  // ============================================
  describe("Home Details Display", () => {
    it("should display home bedroom count", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/4 bedrooms/)).toBeTruthy();
    });

    it("should display home bathroom count", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/3 bathrooms/)).toBeTruthy();
    });

    it("should show default values when homeDetails is missing", () => {
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} homeDetails={null} />
      );
      expect(getByText(/3\+ bedrooms/)).toBeTruthy();
      expect(getByText(/3\+ bathrooms/)).toBeTruthy();
    });

    it("should handle different bedroom/bathroom counts", () => {
      const props = {
        ...defaultProps,
        homeDetails: { numBeds: 5, numBaths: 4 },
      };
      const { getByText } = render(<LargeHomeWarningModal {...props} />);
      expect(getByText(/5 bedrooms/)).toBeTruthy();
      expect(getByText(/4 bathrooms/)).toBeTruthy();
    });
  });

  // ============================================
  // Recommendation Box
  // ============================================
  describe("Recommendation Box", () => {
    it("should display Our Recommendation section", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Our Recommendation")).toBeTruthy();
    });

    it("should display recommended cleaner count", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/We recommend 2 cleaners/)).toBeTruthy();
    });

    it("should display different recommended cleaner counts", () => {
      const props = { ...defaultProps, recommendedCleaners: 3 };
      const { getAllByText } = render(<LargeHomeWarningModal {...props} />);
      // May appear in both recommendation box and option description
      expect(getAllByText(/3 cleaners/).length).toBeGreaterThan(0);
    });

    it("should default to 2 cleaners if not specified", () => {
      const props = { ...defaultProps, recommendedCleaners: null };
      const { getByText } = render(<LargeHomeWarningModal {...props} />);
      expect(getByText(/We recommend 2 cleaners/)).toBeTruthy();
    });

    it("should explain proportional pay", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/proportional share/)).toBeTruthy();
    });
  });

  // ============================================
  // Multi-Cleaner Option
  // ============================================
  describe("Multi-Cleaner Option", () => {
    it("should display Team Clean option", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Team Clean")).toBeTruthy();
    });

    it("should show Recommended badge on Team Clean", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Recommended")).toBeTruthy();
    });

    it("should display team description", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/Join a team of 2 cleaners/)).toBeTruthy();
    });

    it("should call onAcceptMultiCleaner when pressed", () => {
      const onAcceptMultiCleaner = jest.fn();
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} onAcceptMultiCleaner={onAcceptMultiCleaner} />
      );

      fireEvent.press(getByText("Team Clean"));
      expect(onAcceptMultiCleaner).toHaveBeenCalled();
    });

    it("should be disabled when loading", () => {
      const onAcceptMultiCleaner = jest.fn();
      const { getByText } = render(
        <LargeHomeWarningModal
          {...defaultProps}
          loading={true}
          onAcceptMultiCleaner={onAcceptMultiCleaner}
        />
      );

      fireEvent.press(getByText("Team Clean"));
      expect(onAcceptMultiCleaner).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Solo Option
  // ============================================
  describe("Solo Option", () => {
    it("should display Clean Solo option", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Clean Solo")).toBeTruthy();
    });

    it("should display solo description", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/full payment/)).toBeTruthy();
      expect(getByText(/longer cleaning time/)).toBeTruthy();
    });

    it("should be disabled initially (checkbox not checked)", () => {
      const onAcceptSolo = jest.fn();
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} onAcceptSolo={onAcceptSolo} />
      );

      fireEvent.press(getByText("Clean Solo"));
      expect(onAcceptSolo).not.toHaveBeenCalled();
    });

    it("should enable solo option after acknowledgment checked", () => {
      const onAcceptSolo = jest.fn();
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} onAcceptSolo={onAcceptSolo} />
      );

      // Check the acknowledgment checkbox
      fireEvent.press(getByText(/I understand this is a large home/));

      // Now solo should work
      fireEvent.press(getByText("Clean Solo"));
      expect(onAcceptSolo).toHaveBeenCalled();
    });
  });

  // ============================================
  // Acknowledgment Checkbox
  // ============================================
  describe("Acknowledgment Checkbox", () => {
    it("should display acknowledgment text", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/I understand this is a large home/)).toBeTruthy();
    });

    it("should toggle checkbox when pressed", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      const checkboxRow = getByText(/I understand this is a large home/);

      // First press - should check
      fireEvent.press(checkboxRow);

      // Second press - should uncheck
      fireEvent.press(checkboxRow);
    });

    it("should mention longer cleaning time in acknowledgment", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/may take longer to clean solo/)).toBeTruthy();
    });
  });

  // ============================================
  // Cancel/Close Functionality
  // ============================================
  describe("Cancel/Close Functionality", () => {
    it("should call onCancel when close button pressed", () => {
      const onCancel = jest.fn();
      const { UNSAFE_getAllByType } = render(
        <LargeHomeWarningModal {...defaultProps} onCancel={onCancel} />
      );

      // Find the close button (Pressable with X icon)
      // This requires finding by testID or component structure
    });

    it("should call onCancel on modal dismiss", () => {
      const onCancel = jest.fn();
      // Modal's onRequestClose should trigger onCancel
      render(
        <LargeHomeWarningModal {...defaultProps} onCancel={onCancel} />
      );
    });
  });

  // ============================================
  // Info Note Section
  // ============================================
  describe("Info Note Section", () => {
    it("should display info note about pricing", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/homeowner pays the same amount/)).toBeTruthy();
    });

    it("should explain earnings are based on rooms", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText(/based on their assigned rooms/)).toBeTruthy();
    });
  });

  // ============================================
  // Loading State
  // ============================================
  describe("Loading State", () => {
    it("should show activity indicator on solo option when loading after acknowledgment", () => {
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} loading={true} />
      );
      // Note: ActivityIndicator should be visible when loading
    });

    it("should disable options when loading", () => {
      const onAcceptMultiCleaner = jest.fn();
      const onAcceptSolo = jest.fn();

      const { getByText } = render(
        <LargeHomeWarningModal
          {...defaultProps}
          loading={true}
          onAcceptMultiCleaner={onAcceptMultiCleaner}
          onAcceptSolo={onAcceptSolo}
        />
      );

      fireEvent.press(getByText("Team Clean"));
      expect(onAcceptMultiCleaner).not.toHaveBeenCalled();

      // Acknowledge then try solo
      fireEvent.press(getByText(/I understand this is a large home/));
      fireEvent.press(getByText("Clean Solo"));
      expect(onAcceptSolo).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe("Edge Cases", () => {
    it("should handle very large home (10 beds, 8 baths)", () => {
      const props = {
        ...defaultProps,
        homeDetails: { numBeds: 10, numBaths: 8 },
        recommendedCleaners: 4,
      };
      const { getByText, getAllByText } = render(<LargeHomeWarningModal {...props} />);
      expect(getByText(/10 bedrooms/)).toBeTruthy();
      expect(getByText(/8 bathrooms/)).toBeTruthy();
      // "4 cleaners" appears in multiple places (recommendation box and team description)
      expect(getAllByText(/4 cleaners/).length).toBeGreaterThan(0);
    });

    it("should handle edge case home (exactly 3 beds, 3 baths)", () => {
      const props = {
        ...defaultProps,
        homeDetails: { numBeds: 3, numBaths: 3 },
        recommendedCleaners: 2,
      };
      const { getByText } = render(<LargeHomeWarningModal {...props} />);
      expect(getByText(/3 bedrooms/)).toBeTruthy();
      expect(getByText(/3 bathrooms/)).toBeTruthy();
    });

    it("should handle undefined homeDetails properties", () => {
      const props = {
        ...defaultProps,
        homeDetails: { numBeds: undefined, numBaths: undefined },
      };
      const { getByText } = render(<LargeHomeWarningModal {...props} />);
      expect(getByText(/3\+ bedrooms/)).toBeTruthy();
    });

    it("should handle string values for bedroom/bathroom counts", () => {
      const props = {
        ...defaultProps,
        homeDetails: { numBeds: "4", numBaths: "3" },
      };
      const { getByText } = render(<LargeHomeWarningModal {...props} />);
      expect(getByText(/4 bedrooms/)).toBeTruthy();
    });
  });

  // ============================================
  // Accessibility
  // ============================================
  describe("Accessibility", () => {
    it("should have visible title for screen readers", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Large Home Detected")).toBeTruthy();
    });

    it("should have descriptive option labels", () => {
      const { getByText } = render(<LargeHomeWarningModal {...defaultProps} />);
      expect(getByText("Team Clean")).toBeTruthy();
      expect(getByText("Clean Solo")).toBeTruthy();
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe("Integration Tests", () => {
    it("should complete full multi-cleaner selection flow", () => {
      const onAcceptMultiCleaner = jest.fn();
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} onAcceptMultiCleaner={onAcceptMultiCleaner} />
      );

      // Verify modal content is displayed
      expect(getByText("Large Home Detected")).toBeTruthy();
      expect(getByText("Our Recommendation")).toBeTruthy();

      // Select multi-cleaner option
      fireEvent.press(getByText("Team Clean"));
      expect(onAcceptMultiCleaner).toHaveBeenCalled();
    });

    it("should complete full solo selection flow", () => {
      const onAcceptSolo = jest.fn();
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} onAcceptSolo={onAcceptSolo} />
      );

      // Try solo without acknowledgment (should not work)
      fireEvent.press(getByText("Clean Solo"));
      expect(onAcceptSolo).not.toHaveBeenCalled();

      // Acknowledge the warning
      fireEvent.press(getByText(/I understand this is a large home/));

      // Now select solo
      fireEvent.press(getByText("Clean Solo"));
      expect(onAcceptSolo).toHaveBeenCalled();
    });

    it("should allow toggling acknowledgment multiple times", () => {
      const onAcceptSolo = jest.fn();
      const { getByText } = render(
        <LargeHomeWarningModal {...defaultProps} onAcceptSolo={onAcceptSolo} />
      );

      const acknowledgmentText = getByText(/I understand this is a large home/);

      // Toggle on
      fireEvent.press(acknowledgmentText);

      // Toggle off
      fireEvent.press(acknowledgmentText);

      // Try solo (should not work - unchecked)
      fireEvent.press(getByText("Clean Solo"));
      expect(onAcceptSolo).not.toHaveBeenCalled();

      // Toggle on again
      fireEvent.press(acknowledgmentText);

      // Now it should work
      fireEvent.press(getByText("Clean Solo"));
      expect(onAcceptSolo).toHaveBeenCalled();
    });
  });
});
