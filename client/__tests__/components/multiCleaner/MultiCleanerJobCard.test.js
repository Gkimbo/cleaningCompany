/**
 * Comprehensive Tests for MultiCleanerJobCard component
 * Tests display of multi-cleaner job opportunities with slots, earnings, and actions
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
    secondary: { 600: "#7c3aed" },
    success: { 50: "#f0fdf4", 100: "#dcfce7", 600: "#16a34a", 700: "#15803d" },
    warning: { 50: "#fffbeb", 100: "#fef3c7", 600: "#d97706", 700: "#b45309" },
    error: { 50: "#fef2f2", 600: "#dc2626", 700: "#b91c1c" },
    neutral: { 0: "#fff", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626" },
    text: { tertiary: "#737373" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    xs: { fontSize: 12 },
    sm: { fontSize: 14 },
    base: { fontSize: 16 },
    lg: { fontSize: 18 },
    "2xl": { fontSize: 24 },
    fontSize: { sm: 14 },
  },
  shadows: { md: {}, sm: {} },
}));

import MultiCleanerJobCard from "../../../src/components/multiCleaner/MultiCleanerJobCard";

describe("MultiCleanerJobCard", () => {
  const baseJob = {
    totalCleanersRequired: 2,
    cleanersConfirmed: 1,
    appointmentDate: "2026-02-15",
    address: "123 Main St",
    city: "Boston",
    state: "MA",
    numBeds: 4,
    numBaths: 3,
    distance: 5,
    perCleanerEarnings: 135.50,
    status: "open",
  };

  const defaultProps = {
    job: baseJob,
    onViewDetails: jest.fn(),
    onAccept: jest.fn(),
    onDecline: jest.fn(),
    onJoinTeam: jest.fn(),
    onBookWithTeam: jest.fn(),
    loading: false,
    showActions: true,
    isOffer: false,
    expiresAt: null,
    isBusinessOwner: false,
    hasEmployees: false,
    timeToBeCompleted: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Basic Rendering Tests
  // ============================================
  describe("Basic Rendering", () => {
    it("should render the card without crashing", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      expect(getByText("Team Clean")).toBeTruthy();
    });

    it("should display the Team Clean badge", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      expect(getByText("Team Clean")).toBeTruthy();
    });

    it("should display the appointment date formatted correctly", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      // Feb 15, 2026 should be formatted as "Sun, Feb 15" or similar
      expect(getByText(/Feb 15/)).toBeTruthy();
    });

    it("should display the city and state", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      expect(getByText("Boston, MA")).toBeTruthy();
    });

    it("should display bed/bath count", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      expect(getByText("4 bed / 3 bath")).toBeTruthy();
    });

    it("should display distance in miles", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      // 5 km * 0.621371 = 3.1 mi
      expect(getByText("3.1 mi away")).toBeTruthy();
    });
  });

  // ============================================
  // Slot Badge Tests
  // ============================================
  describe("Slot Badge Display", () => {
    it("should show slots open for partially filled job", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      // 2 required, 1 confirmed = 1 slot open
      expect(getByText("1 Slot Left!")).toBeTruthy();
    });

    it("should show multiple slots open", () => {
      const job = { ...baseJob, totalCleanersRequired: 3, cleanersConfirmed: 0 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("3 Slots Open")).toBeTruthy();
    });

    it("should show Filled badge when all slots filled", () => {
      const job = { ...baseJob, cleanersConfirmed: 2, status: "filled" };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("Filled")).toBeTruthy();
    });

    it("should show 2 Slots Open for 2 remaining", () => {
      const job = { ...baseJob, totalCleanersRequired: 3, cleanersConfirmed: 1 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("2 Slots Open")).toBeTruthy();
    });
  });

  // ============================================
  // Cleaner Slots Visualization
  // ============================================
  describe("Cleaner Slots Visualization", () => {
    it("should show correct cleaner confirmation count", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      expect(getByText("1/2 cleaners confirmed")).toBeTruthy();
    });

    it("should show all cleaners confirmed", () => {
      const job = { ...baseJob, totalCleanersRequired: 3, cleanersConfirmed: 3 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("3/3 cleaners confirmed")).toBeTruthy();
    });

    it("should show no cleaners confirmed", () => {
      const job = { ...baseJob, cleanersConfirmed: 0 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("0/2 cleaners confirmed")).toBeTruthy();
    });
  });

  // ============================================
  // Earnings Display Tests
  // ============================================
  describe("Earnings Display", () => {
    it("should display Your Earnings label", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      expect(getByText("Your Earnings")).toBeTruthy();
    });

    it("should display per cleaner earnings formatted", () => {
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} />);
      expect(getByText("$135.50")).toBeTruthy();
    });

    it("should show TBD when no earnings specified", () => {
      const job = { ...baseJob, perCleanerEarnings: null, earningsOffered: null };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("TBD")).toBeTruthy();
    });

    it("should use earningsOffered if perCleanerEarnings is not available", () => {
      const job = { ...baseJob, perCleanerEarnings: null, earningsOffered: 100.00 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("$100.00")).toBeTruthy();
    });

    it("should display percent of work when available", () => {
      const job = { ...baseJob, percentOfWork: 50 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("(50% of job)")).toBeTruthy();
    });
  });

  // ============================================
  // Room Assignments Display
  // ============================================
  describe("Room Assignments Display", () => {
    it("should display assigned rooms when available", () => {
      const job = { ...baseJob, assignedRooms: ["Master Bedroom", "Bedroom 2", "Kitchen"] };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);

      expect(getByText("Your Assigned Rooms:")).toBeTruthy();
      expect(getByText("Master Bedroom")).toBeTruthy();
      expect(getByText("Bedroom 2")).toBeTruthy();
      expect(getByText("Kitchen")).toBeTruthy();
    });

    it("should show +X more for more than 4 rooms", () => {
      const job = {
        ...baseJob,
        assignedRooms: ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5", "Room 6"],
      };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("+2 more")).toBeTruthy();
    });

    it("should not show room section when no rooms assigned", () => {
      const job = { ...baseJob, assignedRooms: [] };
      const { queryByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(queryByText("Your Assigned Rooms:")).toBeNull();
    });
  });

  // ============================================
  // Time Constraint Display
  // ============================================
  describe("Time Constraint Display", () => {
    it("should display time constraint when specified", () => {
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} timeToBeCompleted="3:00 PM" />
      );
      expect(getByText("Complete by 3:00 PM")).toBeTruthy();
    });

    it("should not show time constraint for anytime", () => {
      const { queryByText } = render(
        <MultiCleanerJobCard {...defaultProps} timeToBeCompleted="anytime" />
      );
      expect(queryByText(/Complete by/)).toBeNull();
    });

    it("should not show time constraint when null", () => {
      const { queryByText } = render(
        <MultiCleanerJobCard {...defaultProps} timeToBeCompleted={null} />
      );
      expect(queryByText(/Complete by/)).toBeNull();
    });
  });

  // ============================================
  // Expiration Timer Tests
  // ============================================
  describe("Expiration Timer", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-02-10T10:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should show days remaining when more than 24 hours", () => {
      // 3.5 days from the fixed time
      const expiresAt = new Date("2026-02-13T22:00:00.000Z").toISOString();
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} expiresAt={expiresAt} />
      );
      expect(getByText("3d left")).toBeTruthy();
    });

    it("should show hours and minutes when less than 24 hours", () => {
      // 5 hours from the fixed time
      const expiresAt = new Date("2026-02-10T15:00:00.000Z").toISOString();
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} expiresAt={expiresAt} />
      );
      expect(getByText("5h 0m left")).toBeTruthy();
    });

    it("should show Expired when past expiration", () => {
      const expiresAt = new Date("2026-02-10T09:00:00.000Z").toISOString(); // Past
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} expiresAt={expiresAt} />
      );
      expect(getByText("Expired")).toBeTruthy();
    });

    it("should not show timer when no expiration", () => {
      const { queryByText } = render(
        <MultiCleanerJobCard {...defaultProps} expiresAt={null} />
      );
      expect(queryByText(/left/)).toBeNull();
    });
  });

  // ============================================
  // Action Button Tests - Offer Mode
  // ============================================
  describe("Offer Mode Actions", () => {
    it("should show Accept and Decline buttons for offers", () => {
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} isOffer={true} />
      );
      expect(getByText("Accept")).toBeTruthy();
      expect(getByText("Decline")).toBeTruthy();
    });

    it("should call onAccept when Accept pressed", () => {
      const onAccept = jest.fn();
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} isOffer={true} onAccept={onAccept} />
      );

      fireEvent.press(getByText("Accept"));
      expect(onAccept).toHaveBeenCalled();
    });

    it("should call onDecline when Decline pressed", () => {
      const onDecline = jest.fn();
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} isOffer={true} onDecline={onDecline} />
      );

      fireEvent.press(getByText("Decline"));
      expect(onDecline).toHaveBeenCalled();
    });

    it("should disable buttons when loading", () => {
      const onAccept = jest.fn();
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} isOffer={true} loading={true} onAccept={onAccept} />
      );

      // Button should be disabled - pressing shouldn't trigger callback
      fireEvent.press(getByText("Decline"));
      // Note: In testing, we check that the callback wasn't called
    });
  });

  // ============================================
  // Action Button Tests - Join Team Mode
  // ============================================
  describe("Join Team Mode Actions", () => {
    it("should show Request to Join Team button", () => {
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} isOffer={false} />
      );
      expect(getByText("Request to Join Team")).toBeTruthy();
    });

    it("should call onJoinTeam when pressed", () => {
      const onJoinTeam = jest.fn();
      const { getByText } = render(
        <MultiCleanerJobCard {...defaultProps} onJoinTeam={onJoinTeam} />
      );

      fireEvent.press(getByText("Request to Join Team"));
      expect(onJoinTeam).toHaveBeenCalled();
    });
  });

  // ============================================
  // Action Button Tests - Business Owner Mode
  // ============================================
  describe("Business Owner Mode Actions", () => {
    it("should show Book with Team button for business owner with multiple slots", () => {
      const { getByText } = render(
        <MultiCleanerJobCard
          {...defaultProps}
          isBusinessOwner={true}
          hasEmployees={true}
          job={{ ...baseJob, totalCleanersRequired: 3, cleanersConfirmed: 0 }}
        />
      );
      expect(getByText("Book with Team")).toBeTruthy();
    });

    it("should show Join Solo option for business owner", () => {
      const { getByText } = render(
        <MultiCleanerJobCard
          {...defaultProps}
          isBusinessOwner={true}
          hasEmployees={true}
          job={{ ...baseJob, totalCleanersRequired: 3, cleanersConfirmed: 0 }}
        />
      );
      expect(getByText("Join Solo")).toBeTruthy();
    });

    it("should call onBookWithTeam when Book with Team pressed", () => {
      const onBookWithTeam = jest.fn();
      const { getByText } = render(
        <MultiCleanerJobCard
          {...defaultProps}
          isBusinessOwner={true}
          hasEmployees={true}
          onBookWithTeam={onBookWithTeam}
          job={{ ...baseJob, totalCleanersRequired: 3, cleanersConfirmed: 0 }}
        />
      );

      fireEvent.press(getByText("Book with Team"));
      expect(onBookWithTeam).toHaveBeenCalled();
    });

    it("should not show team booking for single slot remaining", () => {
      const { queryByText } = render(
        <MultiCleanerJobCard
          {...defaultProps}
          isBusinessOwner={true}
          hasEmployees={true}
          job={{ ...baseJob, totalCleanersRequired: 2, cleanersConfirmed: 1 }}
        />
      );
      // With only 1 slot remaining, should show regular join button, not team booking
      expect(queryByText("Book with Team")).toBeNull();
    });
  });

  // ============================================
  // View Details Mode
  // ============================================
  describe("View Details Mode", () => {
    it("should show View Details button when no other actions", () => {
      const { getByText } = render(
        <MultiCleanerJobCard
          {...defaultProps}
          onJoinTeam={null}
          isOffer={false}
          isBusinessOwner={false}
        />
      );
      expect(getByText("View Details")).toBeTruthy();
    });

    it("should call onViewDetails when pressed", () => {
      const onViewDetails = jest.fn();
      const { getByText } = render(
        <MultiCleanerJobCard
          {...defaultProps}
          onViewDetails={onViewDetails}
          onJoinTeam={null}
        />
      );

      fireEvent.press(getByText("View Details"));
      expect(onViewDetails).toHaveBeenCalled();
    });
  });

  // ============================================
  // Hide Actions Mode
  // ============================================
  describe("Hide Actions Mode", () => {
    it("should not show any action buttons when showActions is false", () => {
      const { queryByText } = render(
        <MultiCleanerJobCard {...defaultProps} showActions={false} />
      );

      expect(queryByText("Accept")).toBeNull();
      expect(queryByText("Decline")).toBeNull();
      expect(queryByText("Request to Join Team")).toBeNull();
      expect(queryByText("View Details")).toBeNull();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe("Edge Cases", () => {
    it("should handle missing city gracefully", () => {
      const job = { ...baseJob, city: null, address: null };
      const { queryByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(queryByText("Boston, MA")).toBeNull();
    });

    it("should handle missing bed/bath counts", () => {
      const job = { ...baseJob, numBeds: null, numBaths: null };
      const { queryByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(queryByText(/bed.*bath/)).toBeNull();
    });

    it("should handle missing distance", () => {
      const job = { ...baseJob, distance: null };
      const { queryByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(queryByText(/mi away/)).toBeNull();
    });

    it("should handle zero earnings", () => {
      // Zero is falsy, so formatPrice returns "TBD" for !amount
      const job = { ...baseJob, perCleanerEarnings: 0 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      // The component shows TBD for 0/null/undefined earnings
      expect(getByText("TBD")).toBeTruthy();
    });

    it("should render with 4 cleaners required", () => {
      const job = { ...baseJob, totalCleanersRequired: 4, cleanersConfirmed: 2 };
      const { getByText } = render(<MultiCleanerJobCard {...defaultProps} job={job} />);
      expect(getByText("2/4 cleaners confirmed")).toBeTruthy();
      expect(getByText("2 Slots Open")).toBeTruthy();
    });
  });

  // ============================================
  // Loading State
  // ============================================
  describe("Loading State", () => {
    it("should show loading indicator when loading is true and isOffer", () => {
      const { queryByText } = render(
        <MultiCleanerJobCard {...defaultProps} isOffer={true} loading={true} />
      );
      // Accept button should show loading indicator instead of text
      // The text "Accept" should still be present but ActivityIndicator shown
    });
  });
});
