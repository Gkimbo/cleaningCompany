/**
 * Tests for HomeSizeAdjustmentReview
 * Tests the owner/admin component for reviewing home size adjustment claims
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock FetchData
const mockGetPendingAdjustments = jest.fn();
const mockOwnerResolveAdjustment = jest.fn();
jest.mock("../../../services/fetchRequests/fetchData", () => ({
  getPendingAdjustments: (...args) => mockGetPendingAdjustments(...args),
  ownerResolveAdjustment: (...args) => mockOwnerResolveAdjustment(...args),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => {
  const { Text } = require("react-native");
  return ({ name, testID, ...props }) => (
    <Text testID={testID || `icon-${name}`} {...props}>{name}</Text>
  );
});

// Mock Picker
jest.mock("@react-native-picker/picker", () => {
  const { View, Text } = require("react-native");
  const MockPicker = ({ children, selectedValue, onValueChange, ...props }) => (
    <View testID="picker" {...props}>
      <Text>{selectedValue}</Text>
      {children}
    </View>
  );
  MockPicker.Item = ({ label, value }) => {
    const { Text } = require("react-native");
    return <Text>{label}</Text>;
  };
  return {
    Picker: MockPicker,
  };
});

// Mock theme
jest.mock("../../../services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985" },
    secondary: { 50: "#f8fafc" },
    error: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c" },
    success: { 50: "#f0fdf4", 100: "#dcfce7", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
    warning: { 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 500: "#f59e0b", 600: "#d97706", 700: "#b45309" },
    neutral: { 0: "#fff", 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 500: "#737373" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#a3a3a3" },
    border: { light: "#e5e5e5" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 32 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  shadows: { sm: {}, lg: {} },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
}));

// Import after mocks
import HomeSizeAdjustmentReview from "../HomeSizeAdjustmentReview";

describe("HomeSizeAdjustmentReview", () => {
  const mockState = {
    currentUser: {
      token: "test-token",
      id: 1,
      type: "owner",
    },
  };

  const mockAdjustments = [
    {
      id: 1,
      status: "pending_owner",
      originalNumBeds: "3",
      originalNumBaths: "2",
      reportedNumBeds: "4",
      reportedNumBaths: "3",
      originalPrice: 150.0,
      calculatedNewPrice: 200.0,
      priceDifference: 50.0,
      cleanerNote: "Home has extra rooms",
      homeownerResponse: "I disagree with this claim",
      home: { address: "123 Main St", city: "Boston" },
      cleaner: { firstName: "John", lastName: "Doe", falseClaimCount: 0 },
      homeowner: { firstName: "Jane", lastName: "Smith", falseHomeSizeCount: 1 },
      appointment: { date: "2025-02-15" },
    },
    {
      id: 2,
      status: "expired",
      originalNumBeds: "2",
      originalNumBaths: "1",
      reportedNumBeds: "3",
      reportedNumBaths: "2",
      originalPrice: 100.0,
      calculatedNewPrice: 150.0,
      priceDifference: 50.0,
      home: { address: "456 Oak Ave", city: "Cambridge" },
      cleaner: { firstName: "Bob", lastName: "Builder", falseClaimCount: 2 },
      homeowner: { firstName: "Alice", lastName: "Wonder", falseHomeSizeCount: 0 },
      appointment: { date: "2025-02-14" },
    },
    {
      id: 3,
      status: "owner_approved",
      originalNumBeds: "3",
      originalNumBaths: "2",
      reportedNumBeds: "4",
      reportedNumBaths: "2",
      priceDifference: 25.0,
      ownerNote: "Approved after reviewing photos",
      home: { address: "789 Pine St", city: "Somerville" },
      cleaner: { firstName: "Charlie", lastName: "Clean" },
      homeowner: { firstName: "David", lastName: "Home" },
      appointment: { date: "2025-02-13" },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPendingAdjustments.mockResolvedValue({ adjustments: mockAdjustments });
  });

  describe("Loading State", () => {
    it("should show loading indicator while fetching adjustments", () => {
      mockGetPendingAdjustments.mockImplementation(() => new Promise(() => {}));

      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      expect(getByText("Loading adjustments...")).toBeTruthy();
    });
  });

  describe("Initial Render", () => {
    it("should display header with title", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("Home Size Adjustments")).toBeTruthy();
      });
    });

    it("should show badge with count of items needing review", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        // 2 items need review (pending_owner and expired)
        expect(getByText("2 need review")).toBeTruthy();
      });
    });

    it("should display filter tabs", async () => {
      const { getAllByText, getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        // "Needs Review" appears in both tab and status badge
        expect(getAllByText("Needs Review").length).toBeGreaterThan(0);
        expect(getByText("All")).toBeTruthy();
        expect(getByText("Resolved")).toBeTruthy();
      });
    });

    it("should default to 'Needs Review' filter", async () => {
      const { getByText, queryByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        // Should show items needing review
        expect(getByText("123 Main St, Boston")).toBeTruthy();
        expect(getByText("456 Oak Ave, Cambridge")).toBeTruthy();
        // Should NOT show resolved item
        expect(queryByText("789 Pine St, Somerville")).toBeFalsy();
      });
    });
  });

  describe("Filter Tabs", () => {
    it("should show all adjustments when 'All' filter is selected", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("All"));
      });

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
        expect(getByText("456 Oak Ave, Cambridge")).toBeTruthy();
        expect(getByText("789 Pine St, Somerville")).toBeTruthy();
      });
    });

    it("should show only resolved adjustments when 'Resolved' filter is selected", async () => {
      const { getByText, queryByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Resolved"));
      });

      await waitFor(() => {
        expect(getByText("789 Pine St, Somerville")).toBeTruthy();
        expect(queryByText("123 Main St, Boston")).toBeFalsy();
        expect(queryByText("456 Oak Ave, Cambridge")).toBeFalsy();
      });
    });
  });

  describe("Adjustment Cards", () => {
    it("should display status badge on each card", async () => {
      const { getAllByText, getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        // "Needs Review" appears in filter tab and status badge
        expect(getAllByText("Needs Review").length).toBeGreaterThan(0);
        expect(getByText("Expired")).toBeTruthy();
      });
    });

    it("should display cleaner and homeowner names", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("John Doe")).toBeTruthy();
        expect(getByText("Jane Smith")).toBeTruthy();
      });
    });

    it("should display room comparison", async () => {
      const { getAllByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        // Multiple cards may have the same values
        expect(getAllByText("3b/2ba").length).toBeGreaterThan(0);
        expect(getAllByText("4b/3ba").length).toBeGreaterThan(0);
      });
    });

    it("should display price difference", async () => {
      const { getAllByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        // Both cards have +$50.00
        expect(getAllByText("+$50.00").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Detail Modal", () => {
    it("should open modal when card is pressed", async () => {
      const { getByText, queryByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      // Modal should not be visible
      expect(queryByText("Review Adjustment #1")).toBeFalsy();

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      expect(getByText("Review Adjustment #1")).toBeTruthy();
    });

    it("should display cleaner and homeowner in modal", async () => {
      const { getByText, getAllByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      // In the modal parties section
      expect(getAllByText("John Doe").length).toBeGreaterThan(0);
      expect(getAllByText("Jane Smith").length).toBeGreaterThan(0);
    });

    it("should show false claim warning for cleaner with history", async () => {
      const { getByText, findByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("All")).toBeTruthy();
      });

      // Switch to All to see Bob Builder who has false claims
      await act(async () => {
        fireEvent.press(getByText("All"));
      });

      await waitFor(() => {
        expect(getByText("456 Oak Ave, Cambridge")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("456 Oak Ave, Cambridge"));
      });

      expect(await findByText("2 false claims")).toBeTruthy();
    });

    it("should show false home size warning for homeowner with history", async () => {
      const { getByText, findByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      expect(await findByText("1 false size")).toBeTruthy();
    });

    it("should display cleaner note in modal", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      expect(getByText("Home has extra rooms")).toBeTruthy();
    });

    it("should display homeowner response in modal", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      expect(getByText("I disagree with this claim")).toBeTruthy();
    });

    it("should show resolution form for items needing review", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      expect(getByText("Owner Resolution")).toBeTruthy();
      expect(getByText("Final Bedrooms")).toBeTruthy();
      expect(getByText("Final Bathrooms")).toBeTruthy();
      expect(getByText("Owner Note *")).toBeTruthy();
    });

    it("should close modal when close button is pressed", async () => {
      const { getByText, getAllByTestId, queryByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      expect(getByText("Review Adjustment #1")).toBeTruthy();

      // Get the first times icon (the close button)
      const timesIcons = getAllByTestId("icon-times");
      await act(async () => {
        fireEvent.press(timesIcons[0]);
      });

      expect(queryByText("Review Adjustment #1")).toBeFalsy();
    });
  });

  describe("Resolution Flow", () => {
    it("should require owner note before resolving", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      // Try to approve without note
      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      expect(getByText("Please provide a note explaining your decision.")).toBeTruthy();
      expect(mockOwnerResolveAdjustment).not.toHaveBeenCalled();
    });

    it("should call ownerResolveAdjustment with correct params when approving", async () => {
      mockOwnerResolveAdjustment.mockResolvedValueOnce({ success: true });

      const { getByText, getByPlaceholderText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Explain your decision..."), "Photos verified the claim");
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(mockOwnerResolveAdjustment).toHaveBeenCalledWith(
          "test-token",
          1,
          {
            approved: true,
            finalNumBeds: "4", // defaults to reported
            finalNumBaths: "3",
            ownerNote: "Photos verified the claim",
          }
        );
      });
    });

    it("should call ownerResolveAdjustment with correct params when denying", async () => {
      mockOwnerResolveAdjustment.mockResolvedValueOnce({ success: true });

      const { getByText, getByPlaceholderText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Explain your decision..."), "Photos don't support the claim");
      });

      await act(async () => {
        fireEvent.press(getByText("Deny"));
      });

      await waitFor(() => {
        expect(mockOwnerResolveAdjustment).toHaveBeenCalledWith(
          "test-token",
          1,
          {
            approved: false,
            finalNumBeds: "4",
            finalNumBaths: "3",
            ownerNote: "Photos don't support the claim",
          }
        );
      });
    });

    it("should update local state after successful resolution", async () => {
      mockOwnerResolveAdjustment.mockResolvedValueOnce({ success: true });

      const { getByText, getByPlaceholderText, queryByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Explain your decision..."), "Approved");
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      // Modal should close
      await waitFor(() => {
        expect(queryByText("Review Adjustment #1")).toBeFalsy();
      });
    });

    it("should display error when resolution fails", async () => {
      mockOwnerResolveAdjustment.mockResolvedValueOnce({ error: "Failed to resolve" });

      const { getByText, getByPlaceholderText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Explain your decision..."), "Approved");
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(getByText("Failed to resolve")).toBeTruthy();
      });
    });
  });

  describe("Already Resolved Items", () => {
    it("should show resolved status for already resolved items", async () => {
      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("All")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Resolved"));
      });

      await waitFor(() => {
        expect(getByText("789 Pine St, Somerville")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("789 Pine St, Somerville"));
      });

      expect(getByText("Approved by owner")).toBeTruthy();
      expect(getByText("Approved after reviewing photos")).toBeTruthy();
    });

    it("should not show resolution form for already resolved items", async () => {
      const { getByText, queryByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("All")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Resolved"));
      });

      await waitFor(() => {
        expect(getByText("789 Pine St, Somerville")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("789 Pine St, Somerville"));
      });

      expect(queryByText("Owner Resolution")).toBeFalsy();
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no adjustments need review", async () => {
      mockGetPendingAdjustments.mockResolvedValueOnce({
        adjustments: [mockAdjustments[2]], // Only the resolved one
      });

      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("No adjustments need review")).toBeTruthy();
      });
    });

    it("should show empty state when no adjustments at all", async () => {
      mockGetPendingAdjustments.mockResolvedValueOnce({ adjustments: [] });

      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("No adjustments need review")).toBeTruthy();
      });
    });
  });

  describe("Pull to Refresh", () => {
    it("should fetch adjustments on mount", async () => {
      render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(mockGetPendingAdjustments).toHaveBeenCalledWith("test-token");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing home data gracefully", async () => {
      const adjustmentNoHome = { ...mockAdjustments[0], home: null };
      mockGetPendingAdjustments.mockResolvedValueOnce({ adjustments: [adjustmentNoHome] });

      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("Unknown address")).toBeTruthy();
      });
    });

    it("should handle missing cleaner data gracefully", async () => {
      const adjustmentNoCleaner = { ...mockAdjustments[0], cleaner: null };
      mockGetPendingAdjustments.mockResolvedValueOnce({ adjustments: [adjustmentNoCleaner] });

      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("Unknown cleaner")).toBeTruthy();
      });
    });

    it("should handle missing homeowner data gracefully", async () => {
      const adjustmentNoHomeowner = { ...mockAdjustments[0], homeowner: null };
      mockGetPendingAdjustments.mockResolvedValueOnce({ adjustments: [adjustmentNoHomeowner] });

      const { getByText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("Unknown homeowner")).toBeTruthy();
      });
    });

    it("should handle network error during resolution", async () => {
      mockOwnerResolveAdjustment.mockRejectedValueOnce(new Error("Network error"));

      const { getByText, getByPlaceholderText } = render(<HomeSizeAdjustmentReview state={mockState} />);

      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("123 Main St, Boston"));
      });

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText("Explain your decision..."), "Approved");
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(getByText("Failed to submit resolution. Please try again.")).toBeTruthy();
      });
    });
  });
});
