import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    primary: { 100: "#e0f2fe", 500: "#0ea5e9", 700: "#0369a1" },
    secondary: { 500: "#8b5cf6" },
    success: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 600: "#16a34a", 700: "#15803d" },
    warning: { 50: "#fffbeb", 200: "#fef08a", 500: "#f59e0b", 700: "#b45309" },
    error: { 500: "#ef4444" },
    neutral: { 0: "#fff", 50: "#fafafa", 100: "#f5f5f5" },
    border: { default: "#e5e5e5", light: "#f5f5f5" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {}, none: {} },
}));

jest.mock("../../src/services/styles/HomePageStyles", () => ({}));

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

import HomeTile from "../../src/components/tiles/HomeTile";

describe("HomeTile - Cleaner Rate Display", () => {
  const defaultProps = {
    id: 1,
    nickName: "Beach House",
    state: "CA",
    address: "123 Ocean Ave",
    city: "Malibu",
    zipcode: "90265",
    numBeds: 3,
    numBaths: 2,
    sheetsProvided: "yes",
    towelsProvided: "no",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Cleaner Rate Display", () => {
    it("should display cleaner rate when provided", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate={175} />
      );

      expect(getByText("$175/cleaning")).toBeTruthy();
      expect(getByText("Your cleaner's rate")).toBeTruthy();
    });

    it("should display cleaner name in rate label when provided", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate={175} cleanerName="Jane" />
      );

      expect(getByText("Jane's rate")).toBeTruthy();
      expect(getByText("$175/cleaning")).toBeTruthy();
    });

    it("should not display cleaner rate section when rate is null", () => {
      const { queryByText } = render(
        <HomeTile {...defaultProps} cleanerRate={null} />
      );

      expect(queryByText("Your cleaner's rate")).toBeNull();
      expect(queryByText("Jane's rate")).toBeNull();
    });

    it("should not display cleaner rate section when rate is undefined", () => {
      const { queryByText } = render(
        <HomeTile {...defaultProps} />
      );

      expect(queryByText("Your cleaner's rate")).toBeNull();
    });

    it("should format decimal prices correctly", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate={175.50} />
      );

      // parseFloat(175.50).toFixed(0) = "176" (rounded)
      expect(getByText("$176/cleaning")).toBeTruthy();
    });

    it("should format string prices correctly", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate="200" />
      );

      expect(getByText("$200/cleaning")).toBeTruthy();
    });

    it("should display dollar sign icon in rate section", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate={175} />
      );

      // The $ icon is in cleanerRateIconText
      expect(getByText("$", { exact: true })).toBeTruthy();
    });
  });

  describe("Basic Home Info", () => {
    it("should display home nickname", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} />
      );

      expect(getByText("Beach House")).toBeTruthy();
    });

    it("should display bed and bath count", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} />
      );

      expect(getByText("3 bed, 2 bath")).toBeTruthy();
    });

    it("should display address", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} />
      );

      expect(getByText("123 Ocean Ave")).toBeTruthy();
      expect(getByText("Malibu, CA 90265")).toBeTruthy();
    });

    it("should display sheets status", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} sheetsProvided="yes" />
      );

      expect(getByText("Sheets")).toBeTruthy();
      expect(getByText("Included")).toBeTruthy();
    });

    it("should display towels status", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} towelsProvided="no" />
      );

      expect(getByText("Towels")).toBeTruthy();
      expect(getByText("Not included")).toBeTruthy();
    });
  });

  describe("Booking Actions", () => {
    it("should navigate to quick book when Book Cleaning pressed", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} />
      );

      // Use fireEvent with a mock event object
      fireEvent(getByText("Book Cleaning"), "press", { stopPropagation: jest.fn() });
      expect(mockNavigate).toHaveBeenCalledWith("/quick-book/1");
    });

    it("should navigate to details when View Details pressed", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} />
      );

      fireEvent.press(getByText("View Details"));
      expect(mockNavigate).toHaveBeenCalledWith("/details/1");
    });

    it("should show Unavailable button when outside service area", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} outsideServiceArea={true} />
      );

      expect(getByText("Unavailable")).toBeTruthy();
    });

    it("should not allow booking when outside service area", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} outsideServiceArea={true} />
      );

      fireEvent(getByText("Unavailable"), "press", { stopPropagation: jest.fn() });
      expect(mockNavigate).not.toHaveBeenCalledWith("/quick-book/1");
    });

    it("should show service area warning when outside", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} outsideServiceArea={true} />
      );

      expect(getByText("Outside Service Area - Booking unavailable")).toBeTruthy();
    });
  });

  describe("Incomplete Setup", () => {
    it("should show setup required warning when incomplete", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} isSetupComplete={false} />
      );

      expect(getByText("Setup Required - Tap to complete setup")).toBeTruthy();
    });

    it("should show Complete Setup button when incomplete", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} isSetupComplete={false} />
      );

      expect(getByText("Complete Setup")).toBeTruthy();
    });

    it("should navigate to complete setup when button pressed", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} isSetupComplete={false} />
      );

      fireEvent(getByText("Complete Setup"), "press", { stopPropagation: jest.fn() });
      expect(mockNavigate).toHaveBeenCalledWith("/complete-home-setup/1");
    });

    it("should not show Book Cleaning button when incomplete", () => {
      const { queryByText } = render(
        <HomeTile {...defaultProps} isSetupComplete={false} />
      );

      expect(queryByText("Book Cleaning")).toBeNull();
    });
  });

  describe("Pending Requests", () => {
    it("should show notification bubble when pending requests exist", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} pendingRequestCount={5} />
      );

      expect(getByText("5")).toBeTruthy();
    });

    it("should show 99+ for large request counts", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} pendingRequestCount={150} />
      );

      expect(getByText("99+")).toBeTruthy();
    });

    it("should not show notification bubble when no pending requests", () => {
      const { queryByText } = render(
        <HomeTile {...defaultProps} pendingRequestCount={0} />
      );

      // The number 0 should not appear as a notification
      // We check that there's no bubble by verifying no standalone "0" text
      expect(queryByText("0", { exact: true })).toBeNull();
    });

    it("should call onRequestsPress when bubble is pressed", () => {
      const mockOnRequestsPress = jest.fn();
      const { getByText } = render(
        <HomeTile
          {...defaultProps}
          pendingRequestCount={3}
          onRequestsPress={mockOnRequestsPress}
        />
      );

      fireEvent(getByText("3"), "press", { stopPropagation: jest.fn() });
      expect(mockOnRequestsPress).toHaveBeenCalledWith(1);
    });
  });

  describe("Access Info", () => {
    it("should display keypad code when provided", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} keyPadCode="1234" />
      );

      expect(getByText("Door Code")).toBeTruthy();
      expect(getByText("1234")).toBeTruthy();
    });

    it("should display key location when provided", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} keyLocation="Under the mat" />
      );

      expect(getByText("Key Location")).toBeTruthy();
      expect(getByText("Under the mat")).toBeTruthy();
    });

    it("should prefer keypad code over key location", () => {
      const { getByText, queryByText } = render(
        <HomeTile
          {...defaultProps}
          keyPadCode="1234"
          keyLocation="Under the mat"
        />
      );

      expect(getByText("Door Code")).toBeTruthy();
      expect(getByText("1234")).toBeTruthy();
      expect(queryByText("Under the mat")).toBeNull();
    });

    it("should not show access info when neither provided", () => {
      const { queryByText } = render(
        <HomeTile {...defaultProps} />
      );

      expect(queryByText("Door Code")).toBeNull();
      expect(queryByText("Key Location")).toBeNull();
    });
  });

  describe("Cleaner Rate with Different States", () => {
    it("should show cleaner rate even when outside service area", () => {
      const { getByText } = render(
        <HomeTile
          {...defaultProps}
          cleanerRate={175}
          cleanerName="Jane"
          outsideServiceArea={true}
        />
      );

      expect(getByText("Jane's rate")).toBeTruthy();
      expect(getByText("$175/cleaning")).toBeTruthy();
    });

    it("should show cleaner rate when setup is incomplete", () => {
      const { getByText } = render(
        <HomeTile
          {...defaultProps}
          cleanerRate={150}
          isSetupComplete={false}
        />
      );

      expect(getByText("Your cleaner's rate")).toBeTruthy();
      expect(getByText("$150/cleaning")).toBeTruthy();
    });

    it("should show cleaner rate with pending requests", () => {
      const { getByText } = render(
        <HomeTile
          {...defaultProps}
          cleanerRate={200}
          pendingRequestCount={3}
        />
      );

      expect(getByText("Your cleaner's rate")).toBeTruthy();
      expect(getByText("$200/cleaning")).toBeTruthy();
      expect(getByText("3")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero cleaner rate", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate={0} />
      );

      // 0 is falsy, so the rate section should not show
      // This is intentional - a rate of 0 means no rate set
      const { queryByText } = render(
        <HomeTile {...defaultProps} cleanerRate={0} />
      );
      expect(queryByText("Your cleaner's rate")).toBeNull();
    });

    it("should handle very large cleaner rate", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate={9999} />
      );

      expect(getByText("$9999/cleaning")).toBeTruthy();
    });

    it("should handle cleaner name with special characters", () => {
      const { getByText } = render(
        <HomeTile {...defaultProps} cleanerRate={175} cleanerName="Jane's" />
      );

      expect(getByText("Jane's's rate")).toBeTruthy();
    });
  });
});
