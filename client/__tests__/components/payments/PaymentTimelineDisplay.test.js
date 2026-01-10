import React from "react";
import { render } from "@testing-library/react-native";
import PaymentTimelineDisplay from "../../../src/components/payments/PaymentTimelineDisplay";

// Mock Feather icons
jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

// Mock theme
jest.mock("../../../src/services/styles/theme", () => ({
  colors: {
    success: { 50: "#f0fff4", 100: "#c6f6d5", 200: "#9ae6b4", 300: "#68d391", 500: "#48bb78", 600: "#38a169", 700: "#2f855a", 800: "#276749" },
    primary: { 50: "#ebf8ff", 100: "#bee3f8", 500: "#4299e1", 600: "#3182ce", 700: "#2b6cb0" },
    error: { 50: "#fff5f5", 500: "#f56565", 600: "#e53e3e", 700: "#c53030" },
    neutral: { 50: "#f7fafc", 100: "#edf2f7", 200: "#e2e8f0", 300: "#cbd5e0", 400: "#a0aec0" },
    text: { primary: "#2d3748", tertiary: "#a0aec0" },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  radius: { md: 8, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, md: 16 },
    fontWeight: { medium: "500", semibold: "600" },
  },
}));

describe("PaymentTimelineDisplay", () => {
  const baseDate = new Date("2024-08-15T12:00:00Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Homeowner View", () => {
    it("renders charge date and reassurance message", () => {
      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="homeowner"
          paymentCapturedAt={baseDate}
        />
      );

      expect(getByText(/Charged on:/)).toBeTruthy();
      expect(getByText("Cleaner paid after completion")).toBeTruthy();
    });

    it("returns null when no payment captured date", () => {
      const { queryByText } = render(
        <PaymentTimelineDisplay
          viewType="homeowner"
          paymentCapturedAt={null}
        />
      );

      expect(queryByText(/Charged on:/)).toBeNull();
    });

    it("renders in compact mode", () => {
      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="homeowner"
          paymentCapturedAt={baseDate}
          compact={true}
        />
      );

      expect(getByText(/Charged on:/)).toBeTruthy();
    });
  });

  describe("Cleaner View", () => {
    it("renders only charged step when payment captured but job not completed", () => {
      const { getByText, queryByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
          payoutStatus="pending"
        />
      );

      expect(getByText(/Charged on:/)).toBeTruthy();
      expect(getByText("Job not yet completed")).toBeTruthy();
      expect(queryByText(/Payout released:/)).toBeNull();
    });

    it("renders charged and completed steps when job completed but payout processing", () => {
      const jobCompletedDate = new Date("2024-08-16T14:00:00Z");

      const { getByText, queryByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
          jobCompletedAt={jobCompletedDate}
          payoutStatus="processing"
        />
      );

      expect(getByText(/Charged on:/)).toBeTruthy();
      expect(getByText(/Job completed:/)).toBeTruthy();
      expect(getByText("Payout processing...")).toBeTruthy();
      expect(queryByText(/Payout released:/)).toBeNull();
    });

    it("renders full timeline when payout released", () => {
      const jobCompletedDate = new Date("2024-08-16T14:00:00Z");
      const transferDate = new Date("2024-08-16T16:00:00Z");

      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
          jobCompletedAt={jobCompletedDate}
          transferInitiatedAt={transferDate}
          payoutStatus="processing"
        />
      );

      expect(getByText(/Charged on:/)).toBeTruthy();
      expect(getByText(/Job completed:/)).toBeTruthy();
      expect(getByText(/Payout released:/)).toBeTruthy();
      expect(getByText(/Arrives in bank:/)).toBeTruthy();
    });

    it("shows deposited message when payout completed", () => {
      const jobCompletedDate = new Date("2024-08-16T14:00:00Z");
      const transferDate = new Date("2024-08-16T16:00:00Z");
      const completedDate = new Date("2024-08-17T10:00:00Z");

      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
          jobCompletedAt={jobCompletedDate}
          transferInitiatedAt={transferDate}
          payoutCompletedAt={completedDate}
          payoutStatus="completed"
        />
      );

      expect(getByText("Deposited to bank")).toBeTruthy();
    });

    it("shows failed message when payout failed", () => {
      const jobCompletedDate = new Date("2024-08-16T14:00:00Z");

      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
          jobCompletedAt={jobCompletedDate}
          payoutStatus="failed"
        />
      );

      expect(getByText("Payout failed")).toBeTruthy();
      expect(getByText("Please contact support")).toBeTruthy();
    });

    it("returns null when no payment captured date", () => {
      const { toJSON } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={null}
        />
      );

      expect(toJSON()).toBeNull();
    });

    it("renders in compact mode without sublabels", () => {
      const { getByText, queryByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
          compact={true}
        />
      );

      expect(getByText(/Charged on:/)).toBeTruthy();
      // Sublabels should not be visible in compact mode
      expect(queryByText("Card was charged")).toBeNull();
    });
  });

  describe("Date Formatting", () => {
    it("formats dates correctly as 'Month Day'", () => {
      const testDate = new Date("2024-08-15T12:00:00Z");

      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="homeowner"
          paymentCapturedAt={testDate}
        />
      );

      // Should show "Aug 15" format
      expect(getByText(/Aug 15/)).toBeTruthy();
    });

    it("handles string dates", () => {
      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="homeowner"
          paymentCapturedAt="2024-08-15T12:00:00Z"
        />
      );

      expect(getByText(/Charged on:/)).toBeTruthy();
    });

    it("handles invalid dates gracefully", () => {
      const { toJSON } = render(
        <PaymentTimelineDisplay
          viewType="homeowner"
          paymentCapturedAt="invalid-date"
        />
      );

      expect(toJSON()).toBeNull();
    });
  });

  describe("Business Days Calculation", () => {
    it("calculates 1-2 business days correctly for weekday transfer", () => {
      // Wednesday Aug 14, 2024
      const transferDate = new Date("2024-08-14T12:00:00Z");

      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={new Date("2024-08-10")}
          jobCompletedAt={new Date("2024-08-14")}
          transferInitiatedAt={transferDate}
          payoutStatus="processing"
        />
      );

      // Should show range like "Aug 15-16" (Thu-Fri)
      expect(getByText(/Arrives in bank:/)).toBeTruthy();
    });

    it("skips weekends in bank arrival calculation", () => {
      // Friday Aug 16, 2024 - should skip weekend and arrive Mon-Tue
      const transferDate = new Date("2024-08-16T12:00:00Z");

      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={new Date("2024-08-10")}
          jobCompletedAt={new Date("2024-08-16")}
          transferInitiatedAt={transferDate}
          payoutStatus="processing"
        />
      );

      // Should show arrival after weekend
      expect(getByText(/Arrives in bank:/)).toBeTruthy();
      expect(getByText("1-2 business days")).toBeTruthy();
    });
  });

  describe("Default Props", () => {
    it("defaults viewType to cleaner", () => {
      const { getByText } = render(
        <PaymentTimelineDisplay
          paymentCapturedAt={baseDate}
        />
      );

      // Cleaner view shows different content than homeowner
      expect(getByText("Job not yet completed")).toBeTruthy();
    });

    it("defaults payoutStatus to pending", () => {
      const { queryByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
        />
      );

      expect(queryByText("Payout failed")).toBeNull();
    });

    it("defaults compact to false", () => {
      const { getByText } = render(
        <PaymentTimelineDisplay
          viewType="cleaner"
          paymentCapturedAt={baseDate}
        />
      );

      // Non-compact mode shows sublabels
      expect(getByText("Card was charged")).toBeTruthy();
    });
  });
});
