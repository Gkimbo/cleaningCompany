/**
 * HomePage Landing Page Pricing Tests
 *
 * These tests verify that the customer-facing landing page displays
 * correct pricing information from the database (or defaults when unavailable).
 *
 * IMPORTANT: Customer pricing shows FULL price (no platform fee deduction).
 * Platform fee is only deducted from what cleaners earn, not what customers pay.
 */

import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

// Mock PricingService
jest.mock("../../src/services/fetchRequests/PricingService", () => ({
  getCurrentPricing: jest.fn(),
}));

// Mock FetchData
jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  get: jest.fn().mockResolvedValue({ user: { homes: [], appointments: [], bill: 0 } }),
}));

// Mock companyInfo
jest.mock("../../src/services/data/companyInfo", () => ({
  cleaningCompany: {
    location: "Barnstable, MA",
    maxDistance: 10,
    maxBookingDays: 14,
    cleaningHours: { start: 10, end: 16 },
  },
}));

// Mock images
jest.mock("../../src/services/photos/Best-Cleaning-Service.jpeg", () => "mock-image-1");
jest.mock("../../src/services/photos/clean-laptop.jpg", () => "mock-image-2");
jest.mock("../../src/services/photos/cleaning-tech.png", () => "mock-image-3");
jest.mock("../../src/services/photos/cleaning_supplies_on_floor.jpg", () => "mock-image-4");

import PricingService from "../../src/services/fetchRequests/PricingService";
import { PricingProvider, defaultPricing } from "../../src/context/PricingContext";
import HomePage from "../../src/components/HomePage";

// Test wrapper with required providers
const renderHomePage = (state = {}) => {
  const defaultState = {
    currentUser: { token: null },
    account: null,
    appointments: [],
    cleaningRequests: [],
  };

  return render(
    <PricingProvider>
      <HomePage state={{ ...defaultState, ...state }} dispatch={jest.fn()} />
    </PricingProvider>
  );
};

describe("HomePage Landing Page - Pricing Display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Database Pricing (Server Available)", () => {
    it("should display base price from database", async () => {
      const dbPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        linens: { sheetFeePerBed: 35, towelFee: 7, faceClothFee: 3 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 30, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 30, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 40, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 30, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.15 },
        highVolumeFee: 60,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { getByText } = renderHomePage();

      // Wait for pricing to load and verify base price is displayed (full price, no platform fee deduction)
      await waitFor(() => {
        expect(getByText("175")).toBeTruthy();
      });
    });

    it("should display extra bed/bath fee from database", async () => {
      const dbPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        linens: { sheetFeePerBed: 35, towelFee: 7, faceClothFee: 3 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 30, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 30, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 40, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 30, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.15 },
        highVolumeFee: 60,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("+$60 per additional bed or bath")).toBeTruthy();
      });
    });

    it("should display linen pricing from database", async () => {
      const dbPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        linens: { sheetFeePerBed: 35, towelFee: 7, faceClothFee: 3 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 30, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 30, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 40, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 30, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.15 },
        highVolumeFee: 60,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("Fresh sheets (+$35/bed)")).toBeTruthy();
        expect(getByText("Fresh towels (+$7/towel)")).toBeTruthy();
      });
    });

    it("should NOT deduct platform fee from customer pricing", async () => {
      // Platform fee is 15%, but customer sees full $175, not $148.75
      const dbPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        linens: { sheetFeePerBed: 35, towelFee: 7, faceClothFee: 3 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 30, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 30, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 40, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 30, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.15 },
        highVolumeFee: 60,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { getByText, queryByText } = renderHomePage();

      await waitFor(() => {
        // Should show full price
        expect(getByText("175")).toBeTruthy();
      });

      // Should NOT show platform-fee-deducted price
      // 175 * 0.85 = 148.75, rounded = 149
      expect(queryByText("149")).toBeNull();
      expect(queryByText("148")).toBeNull();
    });
  });

  describe("Default Pricing (Server Unavailable)", () => {
    it("should display default base price when API fails", async () => {
      PricingService.getCurrentPricing.mockRejectedValue(new Error("Network error"));

      const { getByText } = renderHomePage();

      await waitFor(() => {
        // Default base price is 150
        expect(getByText(`${defaultPricing.basePrice}`)).toBeTruthy();
      });
    });

    it("should display default extra bed/bath fee when API fails", async () => {
      PricingService.getCurrentPricing.mockRejectedValue(new Error("Network error"));

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText(`+$${defaultPricing.extraBedBathFee} per additional bed or bath`)).toBeTruthy();
      });
    });

    it("should display default linen pricing when API fails", async () => {
      PricingService.getCurrentPricing.mockRejectedValue(new Error("Network error"));

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText(`Fresh sheets (+$${defaultPricing.linens.sheetFeePerBed}/bed)`)).toBeTruthy();
        expect(getByText(`Fresh towels (+$${defaultPricing.linens.towelFee}/towel)`)).toBeTruthy();
      });
    });

    it("should display default pricing when API returns null", async () => {
      PricingService.getCurrentPricing.mockResolvedValue(null);

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText(`${defaultPricing.basePrice}`)).toBeTruthy();
      });
    });
  });

  describe("Pricing Transparency", () => {
    it("should display 'Simple, Transparent Pricing' section header", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { ...defaultPricing, basePrice: 150 },
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("Simple, Transparent Pricing")).toBeTruthy();
      });
    });

    it("should display 'No hidden fees, no surprises' message", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { ...defaultPricing, basePrice: 150 },
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("No hidden fees, no surprises")).toBeTruthy();
      });
    });

    it("should display 'Starting at' label above price", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { ...defaultPricing, basePrice: 150 },
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("Starting at")).toBeTruthy();
      });
    });

    it("should display 'per cleaning' label below price", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { ...defaultPricing, basePrice: 150 },
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("per cleaning")).toBeTruthy();
      });
    });

    it("should display '1 bed / 1 bath base rate' item", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { ...defaultPricing, basePrice: 150 },
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("1 bed / 1 bath base rate")).toBeTruthy();
      });
    });

    it("should display scheduling info", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: { ...defaultPricing, basePrice: 150 },
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("Flexible 10am-4pm scheduling")).toBeTruthy();
      });
    });
  });

  describe("Dynamic Price Updates", () => {
    it("should reflect owner-updated pricing immediately", async () => {
      // Simulate owner updating price from 150 to 200
      const updatedPricing = {
        ...defaultPricing,
        basePrice: 200,
        extraBedBathFee: 75,
        linens: { sheetFeePerBed: 40, towelFee: 8, faceClothFee: 4 },
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: updatedPricing,
      });

      const { getByText } = renderHomePage();

      await waitFor(() => {
        expect(getByText("200")).toBeTruthy();
        expect(getByText("+$75 per additional bed or bath")).toBeTruthy();
        expect(getByText("Fresh sheets (+$40/bed)")).toBeTruthy();
        expect(getByText("Fresh towels (+$8/towel)")).toBeTruthy();
      });
    });
  });
});

describe("HomePage Landing Page - Content Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PricingService.getCurrentPricing.mockResolvedValue({
      source: "database",
      pricing: defaultPricing,
    });
  });

  it("should display hero section with main headline", async () => {
    const { getByText } = renderHomePage();

    await waitFor(() => {
      expect(getByText(/5-Star Cleanings/)).toBeTruthy();
    });
  });

  it("should display 'Why Choose Us' section", async () => {
    const { getByText } = renderHomePage();

    await waitFor(() => {
      expect(getByText("Why Choose Us")).toBeTruthy();
    });
  });

  it("should display 'How It Works' section", async () => {
    const { getByText } = renderHomePage();

    await waitFor(() => {
      expect(getByText("How It Works")).toBeTruthy();
    });
  });

  it("should display company location", async () => {
    const { getAllByText } = renderHomePage();

    await waitFor(() => {
      // Location appears in multiple places (hero and footer)
      expect(getAllByText(/Barnstable, MA/).length).toBeGreaterThan(0);
    });
  });
});
