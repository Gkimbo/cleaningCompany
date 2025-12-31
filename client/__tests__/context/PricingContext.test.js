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
import { getTimeWindowSurcharge, getTimeWindowLabel, getTimeWindowOptions } from "../../src/context/PricingContext";

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
