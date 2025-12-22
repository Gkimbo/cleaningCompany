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
