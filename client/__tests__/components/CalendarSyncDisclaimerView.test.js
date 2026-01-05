import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Import component
import CalendarSyncDisclaimerView from "../../src/components/calendarSync/CalendarSyncDisclaimerView";

describe("CalendarSyncDisclaimerView", () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    acceptedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render when visible is true", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(getByText("Calendar Sync Disclaimer")).toBeTruthy();
    });

    it("should not render content when visible is false", () => {
      const { queryByText } = render(
        <CalendarSyncDisclaimerView {...defaultProps} visible={false} />
      );

      expect(queryByText("Calendar Sync Disclaimer")).toBeNull();
    });

    it("should render all disclaimer sections", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(getByText("Calendar Sync Notice")).toBeTruthy();
      expect(getByText("Auto-Sync Disclaimer")).toBeTruthy();
      expect(getByText("Third-Party Calendar Services")).toBeTruthy();
      expect(getByText("Conflict Resolution")).toBeTruthy();
      expect(getByText("Offline Availability")).toBeTruthy();
      expect(getByText("Availability Responsibility")).toBeTruthy();
      expect(getByText("Business Owner Assignments")).toBeTruthy();
      expect(getByText("No Guarantee")).toBeTruthy();
    });

    it("should render Close button", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(getByText("Close")).toBeTruthy();
    });

    it("should render close X button in header", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(getByText("X")).toBeTruthy();
    });
  });

  describe("accepted banner", () => {
    it("should not show accepted banner when acceptedAt is null", () => {
      const { queryByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(queryByText(/You accepted this disclaimer on/)).toBeNull();
    });

    it("should show accepted banner with date when acceptedAt is provided", () => {
      const acceptedDate = "2025-01-15T10:30:00Z";
      const { getByText } = render(
        <CalendarSyncDisclaimerView {...defaultProps} acceptedAt={acceptedDate} />
      );

      expect(getByText(/You accepted this disclaimer on/)).toBeTruthy();
      expect(getByText(/January 15, 2025/)).toBeTruthy();
    });

    it("should format the accepted date correctly", () => {
      const acceptedDate = "2024-06-20T14:45:00Z";
      const { getByText } = render(
        <CalendarSyncDisclaimerView {...defaultProps} acceptedAt={acceptedDate} />
      );

      // The date should be formatted in a human-readable way
      expect(getByText(/June 20, 2024/)).toBeTruthy();
    });
  });

  describe("close interactions", () => {
    it("should call onClose when Close button is pressed", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      fireEvent.press(getByText("Close"));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when X button is pressed", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      fireEvent.press(getByText("X"));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("disclaimer content", () => {
    it("should display Calendar Sync Notice content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/Calendar synchronization is provided as a convenience feature only/)
      ).toBeTruthy();
    });

    it("should display Auto-Sync Disclaimer content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/system checks your linked calendars approximately once per hour/)
      ).toBeTruthy();
    });

    it("should display Third-Party Calendar Services content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/We do not control or guarantee the accuracy/)
      ).toBeTruthy();
    });

    it("should display Conflict Resolution content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/overlapping bookings or conflicting dates may occur/)
      ).toBeTruthy();
    });

    it("should display Offline Availability content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/Calendar sync requires an internet connection/)
      ).toBeTruthy();
    });

    it("should display Availability Responsibility content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/Before accepting a job assignment, you must confirm/)
      ).toBeTruthy();
    });

    it("should display Business Owner Assignments content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/If you are a business owner assigning jobs to employees/)
      ).toBeTruthy();
    });

    it("should display No Guarantee content", () => {
      const { getByText } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      expect(
        getByText(/We make no guarantees regarding the accuracy/)
      ).toBeTruthy();
    });
  });

  describe("scrollability", () => {
    it("should be scrollable (content wrapped in ScrollView)", () => {
      const { UNSAFE_getByType } = render(<CalendarSyncDisclaimerView {...defaultProps} />);

      const { ScrollView } = require("react-native");
      const scrollView = UNSAFE_getByType(ScrollView);

      expect(scrollView).toBeTruthy();
    });
  });
});
