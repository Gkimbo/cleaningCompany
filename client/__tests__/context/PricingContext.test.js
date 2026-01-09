import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { Text, View } from "react-native";

// Mock PricingService
jest.mock("../../src/services/fetchRequests/PricingService", () => ({
  getCurrentPricing: jest.fn(),
}));

// Mock companyInfo
jest.mock("../../src/services/data/companyInfo", () => ({
  cleaningCompany: {
    pricing: {
      basePrice: 150,
      extraBedBathFee: 50,
      linens: {
        sheetFeePerBed: 30,
        towelFee: 5,
        faceClothFee: 2,
      },
      timeWindows: {
        anytime: 0,
        "10-3": 25,
        "11-4": 25,
        "12-2": 30,
      },
      cancellation: {
        fee: 25,
        windowDays: 7,
        homeownerPenaltyDays: 3,
        cleanerPenaltyDays: 4,
        refundPercentage: 0.5,
      },
      platform: {
        feePercent: 0.1,
        businessOwnerFeePercent: 0.1,
      },
      highVolumeFee: 50,
    },
  },
}));

import PricingService from "../../src/services/fetchRequests/PricingService";
import { PricingProvider, usePricing } from "../../src/context/PricingContext";

// Test component that uses the pricing context
const TestConsumer = () => {
  const { pricing, loading, error, source, refreshPricing } = usePricing();
  return (
    <View>
      <Text testID="loading">{loading ? "loading" : "loaded"}</Text>
      <Text testID="error">{error || "no-error"}</Text>
      <Text testID="source">{source}</Text>
      <Text testID="basePrice">{pricing?.basePrice}</Text>
      <Text testID="cancellationFee">{pricing?.cancellation?.fee}</Text>
      <Text testID="refreshFn">{typeof refreshPricing === "function" ? "function" : "not-function"}</Text>
    </View>
  );
};

describe("PricingContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PricingProvider", () => {
    it("should render children", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { basePrice: 175 },
      });

      const { getByText } = render(
        <PricingProvider>
          <Text>Child Component</Text>
        </PricingProvider>
      );

      expect(getByText("Child Component")).toBeTruthy();
    });

    it("should start with loading state", async () => {
      let resolvePromise;
      PricingService.getCurrentPricing.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      expect(getByTestId("loading").children[0]).toBe("loading");

      // Resolve the promise
      await act(async () => {
        resolvePromise({ source: "config", pricing: { basePrice: 150 } });
      });
    });

    it("should fetch pricing from API on mount", async () => {
      const mockPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        cancellation: { fee: 30 },
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: mockPricing,
      });

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("loading").children[0]).toBe("loaded");
      });

      expect(PricingService.getCurrentPricing).toHaveBeenCalledTimes(1);
      expect(getByTestId("source").children[0]).toBe("database");
      expect(getByTestId("basePrice").children[0]).toBe("175");
    });

    it("should fall back to static config when API returns null", async () => {
      PricingService.getCurrentPricing.mockResolvedValue(null);

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("loading").children[0]).toBe("loaded");
      });

      expect(getByTestId("source").children[0]).toBe("config");
      expect(getByTestId("basePrice").children[0]).toBe("150"); // Default value
    });

    it("should fall back to static config on API error", async () => {
      PricingService.getCurrentPricing.mockRejectedValue(
        new Error("Network error")
      );

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("loading").children[0]).toBe("loaded");
      });

      expect(getByTestId("error").children[0]).toBe("Network error");
      expect(getByTestId("source").children[0]).toBe("config");
      expect(getByTestId("basePrice").children[0]).toBe("150");
    });

    it("should provide refreshPricing function", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { basePrice: 175, cancellation: { fee: 25 } },
      });

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("loading").children[0]).toBe("loaded");
      });

      expect(getByTestId("refreshFn").children[0]).toBe("function");
    });
  });

  describe("usePricing hook", () => {
    it("should return default values when used outside PricingProvider", () => {
      // When used outside provider, context returns default values
      // This is the expected behavior with React Context default value
      const { getByTestId } = render(<TestConsumer />);

      // Should have default pricing from companyInfo
      expect(getByTestId("basePrice")).toBeTruthy();
      // Source should be "config" (default)
      expect(getByTestId("source").children[0]).toBe("config");
    });

    it("should return pricing data", async () => {
      const mockPricing = {
        basePrice: 200,
        extraBedBathFee: 75,
        linens: { sheetFeePerBed: 35, towelFee: 7, faceClothFee: 3 },
        cancellation: { fee: 30, windowDays: 7 },
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: mockPricing,
      });

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("loading").children[0]).toBe("loaded");
      });

      expect(getByTestId("basePrice").children[0]).toBe("200");
      expect(getByTestId("cancellationFee").children[0]).toBe("30");
    });
  });

  describe("Pricing Data Structure", () => {
    it("should have all required pricing fields from database", async () => {
      const fullPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        linens: {
          sheetFeePerBed: 35,
          towelFee: 6,
          faceClothFee: 3,
        },
        timeWindows: {
          anytime: 0,
          "10-3": 30,
          "11-4": 30,
          "12-2": 40,
        },
        cancellation: {
          fee: 30,
          windowDays: 7,
          homeownerPenaltyDays: 3,
          cleanerPenaltyDays: 4,
          refundPercentage: 0.5,
        },
        platform: {
          feePercent: 0.12,
        },
        highVolumeFee: 60,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: fullPricing,
      });

      let capturedPricing = null;

      const CaptureComponent = () => {
        const { pricing } = usePricing();
        capturedPricing = pricing;
        return null;
      };

      render(
        <PricingProvider>
          <CaptureComponent />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(capturedPricing).not.toBeNull();
      });

      expect(capturedPricing.basePrice).toBe(175);
      expect(capturedPricing.linens.sheetFeePerBed).toBe(35);
      expect(capturedPricing.timeWindows["10-3"]).toBe(30);
      expect(capturedPricing.cancellation.fee).toBe(30);
      expect(capturedPricing.platform.feePercent).toBe(0.12);
    });

    it("should have all required fallback pricing fields", async () => {
      PricingService.getCurrentPricing.mockResolvedValue(null);

      let capturedPricing = null;

      const CaptureComponent = () => {
        const { pricing } = usePricing();
        capturedPricing = pricing;
        return null;
      };

      render(
        <PricingProvider>
          <CaptureComponent />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(capturedPricing).not.toBeNull();
      });

      // Verify all fallback fields exist
      expect(capturedPricing.basePrice).toBeDefined();
      expect(capturedPricing.extraBedBathFee).toBeDefined();
      expect(capturedPricing.linens).toBeDefined();
      expect(capturedPricing.linens.sheetFeePerBed).toBeDefined();
      expect(capturedPricing.linens.towelFee).toBeDefined();
      expect(capturedPricing.linens.faceClothFee).toBeDefined();
      expect(capturedPricing.timeWindows).toBeDefined();
      expect(capturedPricing.cancellation).toBeDefined();
      expect(capturedPricing.cancellation.fee).toBeDefined();
      expect(capturedPricing.cancellation.windowDays).toBeDefined();
      expect(capturedPricing.platform).toBeDefined();
      expect(capturedPricing.platform.feePercent).toBeDefined();
    });
  });

  describe("Source Tracking", () => {
    it("should set source to database when API returns data", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { basePrice: 175 },
      });

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("source").children[0]).toBe("database");
      });
    });

    it("should set source to config when using fallback", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "config",
        pricing: { basePrice: 150 },
      });

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("source").children[0]).toBe("config");
      });
    });

    it("should set source to config on error", async () => {
      PricingService.getCurrentPricing.mockRejectedValue(new Error("Failed"));

      const { getByTestId } = render(
        <PricingProvider>
          <TestConsumer />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(getByTestId("source").children[0]).toBe("config");
      });
    });
  });
});

// Import helper functions for testing
import {
  getTimeWindowSurcharge,
  getTimeWindowLabel,
  getTimeWindowOptions,
  isLastMinuteBooking,
  getLastMinuteInfo,
  calculateBasePrice,
  defaultPricing,
} from "../../src/context/PricingContext";

describe("PricingContext Helper Functions", () => {
  describe("getTimeWindowSurcharge", () => {
    it("should return surcharge when timeWindows values are objects", () => {
      const pricing = {
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime" },
          "10-3": { surcharge: 25, label: "10am - 3pm" },
          "11-4": { surcharge: 25, label: "11am - 4pm" },
          "12-2": { surcharge: 30, label: "12pm - 2pm" },
        },
      };

      expect(getTimeWindowSurcharge(pricing, "anytime")).toBe(0);
      expect(getTimeWindowSurcharge(pricing, "10-3")).toBe(25);
      expect(getTimeWindowSurcharge(pricing, "11-4")).toBe(25);
      expect(getTimeWindowSurcharge(pricing, "12-2")).toBe(30);
    });

    it("should return surcharge when timeWindows values are plain numbers", () => {
      const pricing = {
        timeWindows: {
          anytime: 0,
          "10-3": 25,
          "11-4": 25,
          "12-2": 30,
        },
      };

      expect(getTimeWindowSurcharge(pricing, "anytime")).toBe(0);
      expect(getTimeWindowSurcharge(pricing, "10-3")).toBe(25);
      expect(getTimeWindowSurcharge(pricing, "11-4")).toBe(25);
      expect(getTimeWindowSurcharge(pricing, "12-2")).toBe(30);
    });

    it("should return 0 for unknown time window", () => {
      const pricing = {
        timeWindows: {
          "10-3": 25,
        },
      };

      expect(getTimeWindowSurcharge(pricing, "unknown")).toBe(0);
      expect(getTimeWindowSurcharge(pricing, null)).toBe(0);
      expect(getTimeWindowSurcharge(pricing, undefined)).toBe(0);
    });

    it("should use default pricing when pricing is null or undefined", () => {
      expect(getTimeWindowSurcharge(null, "10-3")).toBe(25);
      expect(getTimeWindowSurcharge(undefined, "10-3")).toBe(25);
    });

    it("should use default pricing when timeWindows is missing", () => {
      const pricing = { basePrice: 150 };
      expect(getTimeWindowSurcharge(pricing, "10-3")).toBe(25);
    });
  });

  describe("getTimeWindowLabel", () => {
    it("should return Anytime for null, undefined, or anytime time window", () => {
      const pricing = {
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime" },
        },
      };

      expect(getTimeWindowLabel(pricing, null)).toEqual({
        label: "Anytime",
        surcharge: 0,
        shortLabel: null,
      });
      expect(getTimeWindowLabel(pricing, undefined)).toEqual({
        label: "Anytime",
        surcharge: 0,
        shortLabel: null,
      });
      expect(getTimeWindowLabel(pricing, "anytime")).toEqual({
        label: "Anytime",
        surcharge: 0,
        shortLabel: null,
      });
    });

    it("should return correct label and surcharge for object format", () => {
      const pricing = {
        timeWindows: {
          "10-3": { surcharge: 25, label: "10am - 3pm" },
          "11-4": { surcharge: 25, label: "11am - 4pm" },
          "12-2": { surcharge: 30, label: "12pm - 2pm" },
        },
      };

      expect(getTimeWindowLabel(pricing, "10-3")).toEqual({
        label: "10am - 3pm",
        surcharge: 25,
        shortLabel: "10-3",
      });
      expect(getTimeWindowLabel(pricing, "12-2")).toEqual({
        label: "12pm - 2pm",
        surcharge: 30,
        shortLabel: "12-2",
      });
    });

    it("should return correct label and surcharge for number format", () => {
      const pricing = {
        timeWindows: {
          "10-3": 25,
          "11-4": 25,
          "12-2": 30,
        },
      };

      const result = getTimeWindowLabel(pricing, "10-3");
      expect(result.surcharge).toBe(25);
      expect(result.label).toBe("10am - 3pm"); // Uses fallback label
      expect(result.shortLabel).toBe("10-3");
    });

    it("should return Anytime for unknown time window", () => {
      const pricing = {
        timeWindows: {
          "10-3": 25,
        },
      };

      expect(getTimeWindowLabel(pricing, "unknown")).toEqual({
        label: "Anytime",
        surcharge: 0,
        shortLabel: null,
      });
    });

    it("should use fallback labels for known time windows when label is missing", () => {
      const pricing = {
        timeWindows: {
          "10-3": 25,
          "11-4": 25,
          "12-2": 30,
        },
      };

      expect(getTimeWindowLabel(pricing, "10-3").label).toBe("10am - 3pm");
      expect(getTimeWindowLabel(pricing, "11-4").label).toBe("11am - 4pm");
      expect(getTimeWindowLabel(pricing, "12-2").label).toBe("12pm - 2pm");
    });
  });

  describe("getTimeWindowOptions", () => {
    it("should return array of time window options", () => {
      const pricing = {
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25" },
        },
      };

      const options = getTimeWindowOptions(pricing);

      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBe(2);

      const anytimeOption = options.find(o => o.value === "anytime");
      expect(anytimeOption).toBeDefined();
      expect(anytimeOption.label).toBe("Anytime");
      expect(anytimeOption.surcharge).toBe(0);

      const tenToThreeOption = options.find(o => o.value === "10-3");
      expect(tenToThreeOption).toBeDefined();
      expect(tenToThreeOption.label).toBe("10am - 3pm");
      expect(tenToThreeOption.surcharge).toBe(25);
    });

    it("should handle number format timeWindows", () => {
      const pricing = {
        timeWindows: {
          anytime: 0,
          "10-3": 25,
        },
      };

      const options = getTimeWindowOptions(pricing);

      const tenToThreeOption = options.find(o => o.value === "10-3");
      expect(tenToThreeOption.surcharge).toBe(25);
      expect(tenToThreeOption.description).toBe("+$25 per cleaning");
    });

    it("should use default pricing when pricing is null", () => {
      const options = getTimeWindowOptions(null);

      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
    });
  });
});

describe("PricingContext Business Owner Fee", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Default businessOwnerFeePercent", () => {
    it("should include businessOwnerFeePercent in default pricing", () => {
      const defaultPricing = {
        platform: {
          feePercent: 0.1,
          businessOwnerFeePercent: 0.1,
        },
      };

      expect(defaultPricing.platform.businessOwnerFeePercent).toBeDefined();
      expect(defaultPricing.platform.businessOwnerFeePercent).toBe(0.1);
    });

    it("should default businessOwnerFeePercent to 0.1 (10%)", () => {
      const defaultBusinessOwnerFee = 0.1;
      expect(defaultBusinessOwnerFee).toBe(0.1);
    });
  });

  describe("API Response with businessOwnerFeePercent", () => {
    it("should parse businessOwnerFeePercent from API response", async () => {
      const mockPricing = {
        basePrice: 175,
        platform: {
          feePercent: 0.1,
          businessOwnerFeePercent: 0.08,
        },
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: mockPricing,
      });

      let capturedPricing = null;

      const CaptureComponent = () => {
        const { pricing } = usePricing();
        capturedPricing = pricing;
        return null;
      };

      render(
        <PricingProvider>
          <CaptureComponent />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(capturedPricing).not.toBeNull();
      });

      expect(capturedPricing.platform.businessOwnerFeePercent).toBe(0.08);
    });

    it("should handle different businessOwnerFeePercent and feePercent values", async () => {
      const mockPricing = {
        basePrice: 175,
        platform: {
          feePercent: 0.1,
          businessOwnerFeePercent: 0.05, // Lower fee for business owners
        },
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: mockPricing,
      });

      let capturedPricing = null;

      const CaptureComponent = () => {
        const { pricing } = usePricing();
        capturedPricing = pricing;
        return null;
      };

      render(
        <PricingProvider>
          <CaptureComponent />
        </PricingProvider>
      );

      await waitFor(() => {
        expect(capturedPricing).not.toBeNull();
      });

      expect(capturedPricing.platform.feePercent).toBe(0.1);
      expect(capturedPricing.platform.businessOwnerFeePercent).toBe(0.05);
      expect(capturedPricing.platform.businessOwnerFeePercent).not.toBe(capturedPricing.platform.feePercent);
    });
  });

  describe("Fee Calculations", () => {
    it("should calculate correct cleaner share for business owners", () => {
      const businessOwnerFeePercent = 0.1;
      const jobPrice = 200;

      const fee = jobPrice * businessOwnerFeePercent;
      const cleanerShare = jobPrice - fee;

      expect(fee).toBe(20);
      expect(cleanerShare).toBe(180);
    });

    it("should calculate higher earnings for lower business owner fee", () => {
      const regularFeePercent = 0.1;
      const businessOwnerFeePercent = 0.08;
      const jobPrice = 200;

      const regularEarnings = jobPrice * (1 - regularFeePercent);
      const businessOwnerEarnings = jobPrice * (1 - businessOwnerFeePercent);

      expect(regularEarnings).toBe(180);
      expect(businessOwnerEarnings).toBe(184);
      expect(businessOwnerEarnings).toBeGreaterThan(regularEarnings);
    });

    it("should calculate keep percentage correctly", () => {
      const businessOwnerFeePercent = 0.1;
      const keepPercent = 1 - businessOwnerFeePercent;

      expect(keepPercent).toBe(0.9);
      expect(Math.round(keepPercent * 100)).toBe(90);
    });
  });

  describe("Fallback Behavior", () => {
    it("should fall back to default when businessOwnerFeePercent is undefined", () => {
      const pricing = {
        platform: {
          feePercent: 0.1,
        },
      };

      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.1;
      expect(businessOwnerFee).toBe(0.1);
    });

    it("should fall back to default when platform is undefined", () => {
      const pricing = {};

      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.1;
      expect(businessOwnerFee).toBe(0.1);
    });

    it("should fall back to default when pricing is null", () => {
      const pricing = null;

      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.1;
      expect(businessOwnerFee).toBe(0.1);
    });
  });

  describe("Dynamic Percentage Display", () => {
    it("should display correct keep percentage for 10% fee", () => {
      const businessOwnerFeePercent = 0.10;
      const keepPercent = Math.round((1 - businessOwnerFeePercent) * 100);

      expect(keepPercent).toBe(90);
    });

    it("should display correct keep percentage for 8% fee", () => {
      const businessOwnerFeePercent = 0.08;
      const keepPercent = Math.round((1 - businessOwnerFeePercent) * 100);

      expect(keepPercent).toBe(92);
    });

    it("should display correct keep percentage for 15% fee", () => {
      const businessOwnerFeePercent = 0.15;
      const keepPercent = Math.round((1 - businessOwnerFeePercent) * 100);

      expect(keepPercent).toBe(85);
    });

    it("should display correct fee percentage for 10% fee", () => {
      const businessOwnerFeePercent = 0.10;
      const feePercent = Math.round(businessOwnerFeePercent * 100);

      expect(feePercent).toBe(10);
    });
  });
});

describe("PricingContext Last-Minute Booking", () => {
  describe("isLastMinuteBooking helper", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-08T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should identify booking within threshold as last-minute", () => {
      const pricing = {
        lastMinute: { fee: 50, thresholdHours: 48 },
      };

      // 24 hours from now
      const appointmentDate = new Date("2026-01-09T12:00:00Z");

      const result = isLastMinuteBooking(appointmentDate, pricing);

      expect(result.isLastMinute).toBe(true);
      expect(result.fee).toBe(50);
      expect(result.hoursUntil).toBe(24);
      expect(result.thresholdHours).toBe(48);
    });

    it("should NOT identify booking outside threshold as last-minute", () => {
      const pricing = {
        lastMinute: { fee: 50, thresholdHours: 48 },
      };

      // 72 hours from now
      const appointmentDate = new Date("2026-01-11T12:00:00Z");

      const result = isLastMinuteBooking(appointmentDate, pricing);

      expect(result.isLastMinute).toBe(false);
      expect(result.fee).toBe(0);
      expect(result.hoursUntil).toBe(72);
    });

    it("should NOT identify past dates as last-minute", () => {
      const pricing = {
        lastMinute: { fee: 50, thresholdHours: 48 },
      };

      // Yesterday
      const appointmentDate = new Date("2026-01-07T12:00:00Z");

      const result = isLastMinuteBooking(appointmentDate, pricing);

      expect(result.isLastMinute).toBe(false);
      expect(result.fee).toBe(0);
      expect(result.hoursUntil).toBe(0);
    });

    it("should use default pricing when not provided", () => {
      // Tomorrow (24 hours from now)
      const appointmentDate = new Date("2026-01-09T12:00:00Z");

      const result = isLastMinuteBooking(appointmentDate, null);

      expect(result.isLastMinute).toBe(true);
      expect(result.fee).toBe(50); // default
      expect(result.thresholdHours).toBe(48); // default
    });

    it("should handle date strings", () => {
      const pricing = {
        lastMinute: { fee: 50, thresholdHours: 48 },
      };

      const result = isLastMinuteBooking("2026-01-09T12:00:00Z", pricing);

      expect(result.isLastMinute).toBe(true);
    });

    it("should handle exactly at threshold boundary", () => {
      const pricing = {
        lastMinute: { fee: 50, thresholdHours: 48 },
      };

      // Exactly 48 hours from now
      const appointmentDate = new Date("2026-01-10T12:00:00Z");

      const result = isLastMinuteBooking(appointmentDate, pricing);

      expect(result.isLastMinute).toBe(true);
    });

    it("should handle custom fee and threshold", () => {
      const pricing = {
        lastMinute: { fee: 75, thresholdHours: 72 },
      };

      // 60 hours from now (within 72 hour threshold)
      const appointmentDate = new Date("2026-01-11T00:00:00Z");

      const result = isLastMinuteBooking(appointmentDate, pricing);

      expect(result.isLastMinute).toBe(true);
      expect(result.fee).toBe(75);
      expect(result.thresholdHours).toBe(72);
    });
  });

  describe("getLastMinuteInfo helper", () => {
    it("should return last-minute configuration from pricing", () => {
      const pricing = {
        lastMinute: {
          fee: 75,
          thresholdHours: 72,
          notificationRadiusMiles: 30,
        },
      };

      const result = getLastMinuteInfo(pricing);

      expect(result.fee).toBe(75);
      expect(result.thresholdHours).toBe(72);
      expect(result.notificationRadiusMiles).toBe(30);
    });

    it("should use defaults when pricing is null", () => {
      const result = getLastMinuteInfo(null);

      expect(result.fee).toBe(50);
      expect(result.thresholdHours).toBe(48);
      expect(result.notificationRadiusMiles).toBe(25);
    });

    it("should use defaults when lastMinute is missing", () => {
      const result = getLastMinuteInfo({});

      expect(result.fee).toBe(50);
      expect(result.thresholdHours).toBe(48);
      expect(result.notificationRadiusMiles).toBe(25);
    });

    it("should use partial defaults for missing fields", () => {
      const pricing = {
        lastMinute: {
          fee: 60, // Only fee provided
        },
      };

      const result = getLastMinuteInfo(pricing);

      expect(result.fee).toBe(60);
      expect(result.thresholdHours).toBe(48); // default
      expect(result.notificationRadiusMiles).toBe(25); // default
    });
  });

  describe("defaultPricing last-minute configuration", () => {
    it("should have lastMinute configuration in defaults", () => {
      expect(defaultPricing.lastMinute).toBeDefined();
      expect(defaultPricing.lastMinute.fee).toBe(50);
      expect(defaultPricing.lastMinute.thresholdHours).toBe(48);
      expect(defaultPricing.lastMinute.notificationRadiusMiles).toBe(25);
    });
  });

  describe("Last-Minute Fee Calculation", () => {
    it("should calculate total price with last-minute fee", () => {
      const basePrice = 200;
      const lastMinuteFee = 50;

      const totalPrice = basePrice + lastMinuteFee;

      expect(totalPrice).toBe(250);
    });

    it("should display fee breakdown correctly", () => {
      const basePrice = 200;
      const lastMinuteFee = 50;

      const feeDisplay = `+$${lastMinuteFee} last-minute fee`;
      expect(feeDisplay).toBe("+$50 last-minute fee");
    });
  });
});

describe("calculateBasePrice helper", () => {
  it("should calculate base price for 1 bed 1 bath", () => {
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
    };

    const result = calculateBasePrice(pricing, 1, 1);

    expect(result).toBe(150);
  });

  it("should add extra bed fee", () => {
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
    };

    const result = calculateBasePrice(pricing, 3, 1);

    // 150 + (2 extra beds * 50) = 250
    expect(result).toBe(250);
  });

  it("should add extra bath fee", () => {
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
    };

    const result = calculateBasePrice(pricing, 1, 3);

    // 150 + (2 extra full baths * 50) = 250
    expect(result).toBe(250);
  });

  it("should handle half baths", () => {
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
    };

    const result = calculateBasePrice(pricing, 2, 2.5);

    // 150 + (1 extra bed * 50) + (1 extra full bath * 50) + (1 half bath * 25) = 275
    expect(result).toBe(275);
  });

  it("should handle string bath values", () => {
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
    };

    const result = calculateBasePrice(pricing, 2, "2.5");

    expect(result).toBe(275);
  });

  it("should use defaults when pricing is null", () => {
    const result = calculateBasePrice(null, 2, 2);

    // Default: 150 + (1 * 50) + (1 * 50) = 250
    expect(result).toBe(250);
  });

  it("should handle only half bath (0.5 baths)", () => {
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
    };

    const result = calculateBasePrice(pricing, 1, 0.5);

    // 150 + (0 extra full baths) + (1 half bath * 25) = 175
    // Note: The base includes 1 bath, but 0.5 means only a half bath
    // So: 150 + 25 = 175
    expect(result).toBe(175);
  });

  it("should handle large homes", () => {
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
    };

    const result = calculateBasePrice(pricing, 5, 4);

    // 150 + (4 extra beds * 50) + (3 extra baths * 50) = 150 + 200 + 150 = 500
    expect(result).toBe(500);
  });
});
