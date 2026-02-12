/**
 * Comprehensive Tests for TeamBookingModal component
 * Tests the modal for business owners to book multi-cleaner jobs with their team
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock expo icons
jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

// Mock theme
jest.mock("../../../src/services/styles/theme", () => ({
  colors: {
    white: "#fff",
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1" },
    secondary: { 600: "#7c3aed" },
    success: { 50: "#f0fdf4", 600: "#16a34a", 700: "#15803d" },
    warning: { 600: "#d97706", 700: "#b45309" },
    error: { 50: "#fef2f2", 600: "#dc2626", 700: "#b91c1c" },
    neutral: { 0: "#fff", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 600: "#525252" },
    background: { primary: "#fff" },
    border: { light: "#e5e5e5" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#737373" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    xs: { fontSize: 12 },
    sm: { fontSize: 14 },
    base: { fontSize: 16 },
    lg: { fontSize: 18 },
    xl: { fontSize: 20 },
    "2xl": { fontSize: 24 },
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { lg: {} },
}));

// Mock FetchData
jest.mock("../../../src/services/fetchRequests/fetchData", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Mock PricingContext
jest.mock("../../../src/context/PricingContext", () => ({
  usePricing: () => ({
    pricing: {
      platform: {
        feePercent: 0.1,
      },
    },
    loading: false,
  }),
}));

import TeamBookingModal from "../../../src/components/multiCleaner/TeamBookingModal";
import FetchData from "../../../src/services/fetchRequests/fetchData";

describe("TeamBookingModal", () => {
  const baseJob = {
    id: 10,
    multiCleanerJobId: 10,
    appointmentDate: "2026-02-15",
    location: "123 Main St, Boston",
    totalCleanersRequired: 2,
    remainingSlots: 2,
    perCleanerEarnings: 135.50,
    totalJobPrice: 300,
    estimatedMinutes: 180,
  };

  const mockState = {
    currentUser: {
      token: "test-token",
    },
  };

  const mockTeamData = {
    selfHasStripeConnect: true,
    employees: [
      {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        userId: 101,
        isAvailable: true,
        hourlyRate: 25,
      },
      {
        id: 2,
        firstName: "Jane",
        lastName: "Smith",
        userId: 102,
        isAvailable: true,
        hourlyRate: 30,
      },
      {
        id: 3,
        firstName: "Bob",
        lastName: "Wilson",
        userId: null, // Not yet registered
        isAvailable: false,
        unavailableReason: "Not registered",
      },
    ],
  };

  const defaultProps = {
    visible: true,
    job: baseJob,
    onBook: jest.fn(),
    onClose: jest.fn(),
    state: mockState,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    FetchData.get.mockResolvedValue(mockTeamData);
    FetchData.post.mockResolvedValue({ success: true });
    jest.spyOn(Alert, "alert");
  });

  // Helper to render and wait for team data to load
  const renderAndWait = async (props = defaultProps) => {
    const result = render(<TeamBookingModal {...props} />);
    await waitFor(() => {
      expect(FetchData.get).toHaveBeenCalled();
    });
    return result;
  };

  // ============================================
  // Basic Rendering Tests
  // ============================================
  describe("Basic Rendering", () => {
    it("should render the modal when visible is true", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Book with Your Team")).toBeTruthy();
      });
    });

    it("should show loading state while fetching team", () => {
      // Don't wait for the fetch to complete
      FetchData.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      const { getByText } = render(<TeamBookingModal {...defaultProps} />);
      expect(getByText("Loading team...")).toBeTruthy();
    });

    it("should call API to fetch team data on mount", async () => {
      await renderAndWait();
      expect(FetchData.get).toHaveBeenCalledWith(
        "/api/v1/business-owner/team-for-job?jobDate=2026-02-15",
        "test-token"
      );
    });
  });

  // ============================================
  // Job Summary Display
  // ============================================
  describe("Job Summary Display", () => {
    it("should display Team Clean badge", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Team Clean")).toBeTruthy();
      });
    });

    it("should display job location", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("123 Main St, Boston")).toBeTruthy();
      });
    });

    it("should display appointment price in profit breakdown", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Appointment Price")).toBeTruthy();
      });
    });

    it("should display your profit in the breakdown", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Your Profit")).toBeTruthy();
      });
    });
  });

  // ============================================
  // Slots Selection
  // ============================================
  describe("Slots Selection", () => {
    it("should display slots requirement", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Select 2 Team Members")).toBeTruthy();
      });
    });

    it("should display current selection count", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        // Initially with self included: 1 of 2
        expect(getByText("1 of 2")).toBeTruthy();
        expect(getByText("selected")).toBeTruthy();
      });
    });

    it("should update count when employees selected", async () => {
      const { getAllByText, getByText } = await renderAndWait();

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      // Find the employee row and press it
      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      await waitFor(() => {
        expect(getByText("2 of 2")).toBeTruthy();
      });
    });
  });

  // ============================================
  // Include Self Toggle
  // ============================================
  describe("Include Self Toggle", () => {
    it("should display Include Myself option", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Include Myself")).toBeTruthy();
      });
    });

    it("should show Stripe status for self", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText(/receive your share of the payout/)).toBeTruthy();
      });
    });

    it("should show warning if Stripe not set up", async () => {
      FetchData.get.mockResolvedValue({
        ...mockTeamData,
        selfHasStripeConnect: false,
      });

      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText(/Set up Stripe/)).toBeTruthy();
      });
    });
  });

  // ============================================
  // Employee List
  // ============================================
  describe("Employee List", () => {
    it("should display Your Team section", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Your Team")).toBeTruthy();
      });
    });

    it("should display employee names", async () => {
      const { getAllByText } = await renderAndWait();
      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
        expect(getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
        expect(getAllByText(/Bob Wilson/).length).toBeGreaterThan(0);
      });
    });

    it("should display Available badge for available employees", async () => {
      const { getAllByText } = await renderAndWait();
      await waitFor(() => {
        expect(getAllByText("Available").length).toBeGreaterThan(0);
      });
    });

    it("should display unavailable reason for unavailable employees", async () => {
      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Not registered")).toBeTruthy();
      });
    });

    it("should display pay rate badges", async () => {
      const { getAllByText } = await renderAndWait();
      await waitFor(() => {
        // Pay rates shown as "$25/hr" format
        expect(getAllByText(/\$25\/hr/).length).toBeGreaterThan(0);
        expect(getAllByText(/\$30\/hr/).length).toBeGreaterThan(0);
      });
    });

    it("should show no employees message when empty", async () => {
      FetchData.get.mockResolvedValue({
        selfHasStripeConnect: true,
        employees: [],
      });

      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("No employees added yet")).toBeTruthy();
      });
    });
  });

  // ============================================
  // Profit Breakdown
  // ============================================
  describe("Profit Breakdown", () => {
    it("should display profit breakdown in job summary", async () => {
      const { getByText } = await renderAndWait();

      // Profit breakdown shows immediately in the job summary area
      await waitFor(() => {
        expect(getByText("Appointment Price")).toBeTruthy();
        expect(getByText("Your Profit")).toBeTruthy();
      });
    });

    it("should show net earnings after platform fee", async () => {
      const { getByText } = await renderAndWait();

      await waitFor(() => {
        // Net earnings is shown after platform fee deduction
        expect(getByText("Net Earnings")).toBeTruthy();
      });
    });

    it("should show employee pay when employee selected", async () => {
      const { getAllByText, getByText } = await renderAndWait();

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      await waitFor(() => {
        expect(getByText("Employee Pay")).toBeTruthy();
      });
    });
  });

  // ============================================
  // Book Button
  // ============================================
  describe("Book Button", () => {
    it("should show Select more when not enough selected", async () => {
      FetchData.get.mockResolvedValue({
        selfHasStripeConnect: false,
        employees: mockTeamData.employees,
      });

      const { getByText } = await renderAndWait();
      await waitFor(() => {
        // With self not included and no employees selected
        expect(getByText(/Select 2 more/)).toBeTruthy();
      });
    });

    it("should enable Book Team button when correct count selected", async () => {
      const { getAllByText, getByText } = await renderAndWait();

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      await waitFor(() => {
        expect(getByText(/Book Team \(2 members\)/)).toBeTruthy();
      });
    });

    it("should call API when Book Team pressed", async () => {
      const onBook = jest.fn();
      const { getAllByText, getByText } = render(
        <TeamBookingModal {...defaultProps} onBook={onBook} />
      );

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      await waitFor(() => {
        expect(getByText(/Book Team/)).toBeTruthy();
      });

      fireEvent.press(getByText(/Book Team/));

      await waitFor(() => {
        expect(FetchData.post).toHaveBeenCalledWith(
          "/api/v1/multi-cleaner/book-as-team",
          expect.objectContaining({
            multiCleanerJobId: 10,
            teamMembers: expect.any(Array),
          }),
          "test-token"
        );
      });
    });

    it("should show success alert on successful booking", async () => {
      const { getAllByText, getByText } = render(<TeamBookingModal {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      fireEvent.press(getByText(/Book Team/));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Team Booked!",
          expect.stringContaining("Successfully booked"),
          expect.any(Array)
        );
      });
    });

    it("should show error alert on failed booking", async () => {
      FetchData.post.mockResolvedValue({ error: "Booking failed" });

      const { getAllByText, getByText } = render(<TeamBookingModal {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      fireEvent.press(getByText(/Book Team/));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Booking Failed",
          "Booking failed"
        );
      });
    });
  });

  // ============================================
  // Error Handling
  // ============================================
  describe("Error Handling", () => {
    it("should display error message on fetch failure", async () => {
      FetchData.get.mockResolvedValue({ error: "Failed to load team" });

      const { getByText } = await renderAndWait();
      await waitFor(() => {
        expect(getByText("Failed to load team")).toBeTruthy();
      });
    });

    it("should display error on network failure", async () => {
      FetchData.get.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<TeamBookingModal {...defaultProps} />);
      await waitFor(() => {
        expect(getByText("Failed to load team members")).toBeTruthy();
      });
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe("Edge Cases", () => {
    it("should handle 3-slot job", async () => {
      const job = { ...baseJob, remainingSlots: 3, totalCleanersRequired: 3 };
      const { getByText } = render(
        <TeamBookingModal {...defaultProps} job={job} />
      );

      await waitFor(() => {
        expect(getByText("Select 3 Team Members")).toBeTruthy();
      });
    });

    it("should handle 4-slot job", async () => {
      const job = { ...baseJob, remainingSlots: 4, totalCleanersRequired: 4 };
      const { getByText } = render(
        <TeamBookingModal {...defaultProps} job={job} />
      );

      await waitFor(() => {
        expect(getByText("Select 4 Team Members")).toBeTruthy();
      });
    });

    it("should handle employees without hourly rates", async () => {
      FetchData.get.mockResolvedValue({
        selfHasStripeConnect: true,
        employees: [
          {
            id: 1,
            firstName: "John",
            lastName: "Doe",
            userId: 101,
            isAvailable: true,
            hourlyRate: null,
          },
        ],
      });

      const { getAllByText, queryByText } = await renderAndWait();
      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
        expect(queryByText("$25/hr")).toBeNull();
      });
    });
  });

  // ============================================
  // Team Member Structure
  // ============================================
  describe("Team Member API Structure", () => {
    it("should include self as type self in team members", async () => {
      const { getAllByText, getByText } = render(<TeamBookingModal {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      fireEvent.press(getByText(/Book Team/));

      await waitFor(() => {
        expect(FetchData.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            teamMembers: expect.arrayContaining([
              { type: "self" },
            ]),
          }),
          expect.any(String)
        );
      });
    });

    it("should include employees with businessEmployeeId", async () => {
      const { getAllByText, getByText } = render(<TeamBookingModal {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const johnDoeElements = getAllByText(/John Doe/);
      fireEvent.press(johnDoeElements[0]);

      fireEvent.press(getByText(/Book Team/));

      await waitFor(() => {
        expect(FetchData.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            teamMembers: expect.arrayContaining([
              { type: "employee", businessEmployeeId: 1 },
            ]),
          }),
          expect.any(String)
        );
      });
    });
  });
});
