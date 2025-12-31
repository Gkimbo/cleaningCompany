import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock fetch
global.fetch = jest.fn();

// Mock Alert
jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

// Mock the theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
    success: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#22c55e", 600: "#16a34a" },
    warning: { 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 600: "#d97706" },
    error: { 50: "#fef2f2", 500: "#ef4444", 600: "#dc2626" },
    neutral: { 0: "#ffffff", 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb" },
    text: { primary: "#111827", secondary: "#6b7280", tertiary: "#9ca3af" },
    border: { light: "#e5e7eb" },
    background: { primary: "#ffffff", secondary: "#f9fafb" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 40 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  shadows: { sm: {}, md: {}, lg: {} },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 16, xl: 18, "2xl": 20 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
}));

// Mock MultiAspectReviewForm
jest.mock("../../src/components/reviews/MultiAspectReviewForm", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return function MockMultiAspectReviewForm({ onComplete, reviewType, userId }) {
    return (
      <View testID="review-form">
        <Text>Review Form for {reviewType}</Text>
        <Text>User ID: {userId}</Text>
        <TouchableOpacity
          testID="mock-submit-button"
          onPress={() => {
            onComplete({
              review: { id: 1 },
              status: { bothReviewed: false },
            });
          }}
        >
          <Text>Submit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="mock-submit-both-reviewed"
          onPress={() => {
            onComplete({
              review: { id: 1 },
              status: { bothReviewed: true },
            });
          }}
        >
          <Text>Submit Both Reviewed</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

import TodaysCleaningCard from "../../src/components/client/TodaysCleaningCard";

describe("TodaysCleaningCard Review Flow", () => {
  const mockState = {
    currentUser: {
      id: 1,
      token: "test-token",
      type: "client",
    },
  };

  const mockAppointment = {
    id: 100,
    date: "2025-12-30",
    price: 455,
    completed: true,
    hasClientReview: false,
    employeesAssigned: ["2"],
    homeId: 10,
  };

  const mockHome = {
    id: 10,
    nickName: "Beach House",
    address: "123 Ocean Dr",
    city: "Boston",
  };

  const mockOnReviewSubmitted = jest.fn();

  const defaultProps = {
    appointment: mockAppointment,
    home: mockHome,
    state: mockState,
    onReviewSubmitted: mockOnReviewSubmitted,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    Alert.alert.mockClear();

    // Mock successful cleaner fetch
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cleaners: [{ id: 2, username: "karin" }] }),
    });
  });

  describe("Review Button Display", () => {
    it("should show 'Leave a Review' button when appointment is completed and not reviewed", async () => {
      const { findByText } = render(<TodaysCleaningCard {...defaultProps} />);

      const reviewButton = await findByText("Leave a Review");
      expect(reviewButton).toBeTruthy();
    });

    it("should show 'Review Submitted' when hasClientReview is true", async () => {
      const props = {
        ...defaultProps,
        appointment: { ...mockAppointment, hasClientReview: true },
      };

      const { findByText, queryByText } = render(<TodaysCleaningCard {...props} />);

      // Wait for initial render
      await waitFor(() => {
        expect(queryByText("Leave a Review")).toBeNull();
      });

      const submittedBadge = await findByText("Review Submitted");
      expect(submittedBadge).toBeTruthy();
    });

    it("should not show review button when appointment is not completed", async () => {
      const props = {
        ...defaultProps,
        appointment: { ...mockAppointment, completed: false },
      };

      const { queryByText } = render(<TodaysCleaningCard {...props} />);

      await waitFor(() => {
        expect(queryByText("Leave a Review")).toBeNull();
      });
    });
  });

  describe("Review Modal", () => {
    it("should open review modal when Leave a Review button is pressed", async () => {
      const { findByText, findByTestId } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      const reviewForm = await findByTestId("review-form");
      expect(reviewForm).toBeTruthy();
    });

    it("should pass correct props to MultiAspectReviewForm", async () => {
      const { findByText, findByTestId } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      // Check the review form shows the correct review type
      const reviewTypeText = await findByText(/homeowner_to_cleaner/);
      expect(reviewTypeText).toBeTruthy();

      // Check it shows the cleaner's user ID
      const userIdText = await findByText(/User ID: 2/);
      expect(userIdText).toBeTruthy();
    });
  });

  describe("Review Completion", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("should call onReviewSubmitted when review is submitted", async () => {
      const { findByText, findByTestId } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      const submitButton = await findByTestId("mock-submit-button");

      await act(async () => {
        fireEvent.press(submitButton);
      });

      // onReviewSubmitted should be called immediately
      expect(mockOnReviewSubmitted).toHaveBeenCalledWith(100);
    });

    it("should show alert after timeout", async () => {
      const { findByText, findByTestId } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      const submitButton = await findByTestId("mock-submit-button");

      await act(async () => {
        fireEvent.press(submitButton);
        jest.advanceTimersByTime(300);
      });

      // Alert should be shown after timeout
      expect(Alert.alert).toHaveBeenCalledWith(
        "Thank you!",
        "Your review has been submitted. It will become visible once your cleaner submits their review."
      );
    });

    it("should show different message when both reviews are complete", async () => {
      const { findByText, findByTestId } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      const submitBothButton = await findByTestId("mock-submit-both-reviewed");

      await act(async () => {
        fireEvent.press(submitBothButton);
        jest.advanceTimersByTime(300);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Thank you!",
        "Both reviews are now visible to each other."
      );
    });

    it("should close modal after review submission", async () => {
      const { findByText, findByTestId, queryByTestId } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      // Modal should be open
      const reviewForm = await findByTestId("review-form");
      expect(reviewForm).toBeTruthy();

      const submitButton = await findByTestId("mock-submit-button");

      await act(async () => {
        fireEvent.press(submitButton);
      });

      // Modal should be closed
      await waitFor(() => {
        expect(queryByTestId("review-form")).toBeNull();
      });
    });
  });

  describe("User ID Fallback", () => {
    it("should fall back to employeesAssigned when cleaners array is empty", async () => {
      // Mock fetch to return empty cleaners
      fetch.mockReset();
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cleaners: [] }),
      });

      const { findByText } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      // Should fall back to employeesAssigned[0] which is "2"
      const userIdText = await findByText(/User ID: 2/);
      expect(userIdText).toBeTruthy();
    });
  });

  describe("Dashboard Refresh After Review", () => {
    it("should update parent state immediately on review submission", async () => {
      const { findByText, findByTestId } = render(
        <TodaysCleaningCard {...defaultProps} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      const submitButton = await findByTestId("mock-submit-button");

      await act(async () => {
        fireEvent.press(submitButton);
      });

      // onReviewSubmitted should be called with the appointment ID
      expect(mockOnReviewSubmitted).toHaveBeenCalledWith(mockAppointment.id);
    });

    it("should call onReviewSubmitted before showing alert", async () => {
      jest.useFakeTimers();
      const callOrder = [];

      const mockOnReviewSubmittedTracked = jest.fn(() => {
        callOrder.push("onReviewSubmitted");
      });

      Alert.alert.mockImplementation(() => {
        callOrder.push("alert");
      });

      const props = {
        ...defaultProps,
        onReviewSubmitted: mockOnReviewSubmittedTracked,
      };

      const { findByText, findByTestId } = render(
        <TodaysCleaningCard {...props} />
      );

      const reviewButton = await findByText("Leave a Review");
      fireEvent.press(reviewButton);

      const submitButton = await findByTestId("mock-submit-button");

      await act(async () => {
        fireEvent.press(submitButton);
      });

      // onReviewSubmitted should be called immediately
      expect(callOrder).toContain("onReviewSubmitted");

      // Alert is called after timeout
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(callOrder.indexOf("onReviewSubmitted")).toBeLessThan(
        callOrder.indexOf("alert")
      );

      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });
  });
});
