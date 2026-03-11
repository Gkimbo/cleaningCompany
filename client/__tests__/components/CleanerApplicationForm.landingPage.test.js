/**
 * CleanerApplicationForm Landing Page Pricing Tests
 *
 * These tests verify that the cleaner-facing landing page displays
 * correct earning information from the database (or defaults when unavailable).
 *
 * IMPORTANT: Cleaner earnings show price MINUS platform fee.
 * Example: $150 base price - 10% platform fee = $135 cleaner earnings
 */

import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// Mock expo-image-picker
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

// Mock PricingService
jest.mock("../../src/services/fetchRequests/PricingService", () => ({
  getCurrentPricing: jest.fn(),
}));

// Mock ApplicationClass
jest.mock("../../src/services/fetchRequests/ApplicationClass", () => ({
  addApplicationToDb: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock TermsModal
jest.mock("../../src/components/terms", () => ({
  TermsModal: () => null,
}));

// Mock IncentivesService
jest.mock("../../src/services/fetchRequests/IncentivesService", () => ({
  getCurrentIncentives: jest.fn(),
}));

// Mock IncentiveBanner component for testing
jest.mock("../../src/components/incentives/IncentiveBanner", () => {
  const { Text, View } = require("react-native");
  return ({ message }) => (
    <View testID="incentive-banner">
      <Text>{message}</Text>
    </View>
  );
});

import PricingService from "../../src/services/fetchRequests/PricingService";
import IncentivesService from "../../src/services/fetchRequests/IncentivesService";
import { PricingProvider, defaultPricing } from "../../src/context/PricingContext";
import CleanerApplicationForm from "../../src/components/admin/CleanerApplications/ApplicationForm";

// Helper to calculate expected cleaner earnings (returns dollars, not cents)
const calculateCleanerEarnings = (pricing) => {
  const platformFeePercent = pricing.platform?.feePercent ?? defaultPricing.platform.feePercent;
  // Calculate in cents first
  const minPayCents = Math.round((pricing.basePrice ?? defaultPricing.basePrice) * (1 - platformFeePercent));
  // Max pay uses 1 extra (matching the component - a 2bed/1bath scenario)
  const maxPayCents = Math.round(
    ((pricing.basePrice ?? defaultPricing.basePrice) + (pricing.extraBedBathFee ?? defaultPricing.extraBedBathFee)) *
      (1 - platformFeePercent)
  );
  // Convert to dollars for comparison with displayed values
  return { minPay: Math.round(minPayCents / 100), maxPay: Math.round(maxPayCents / 100) };
};

// Test wrapper with required providers
const renderCleanerApplicationForm = () => {
  return render(
    <PricingProvider>
      <CleanerApplicationForm />
    </PricingProvider>
  );
};

describe("CleanerApplicationForm Landing Page - Earnings Display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: incentives disabled so existing tests work as before
    IncentivesService.getCurrentIncentives.mockResolvedValue({
      cleaner: { enabled: false },
      homeowner: { enabled: false },
    });
  });

  describe("Database Pricing (Server Available)", () => {
    it("should display earnings with platform fee deducted", async () => {
      const dbPricing = {
        basePrice: 15000,
        extraBedBathFee: 5000,
        linens: { sheetFeePerBed: 3000, towelFee: 500, faceClothFee: 200 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 2500, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 2500, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 3000, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 2500, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 }, // 10% platform fee
        highVolumeFee: 5000,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { minPay, maxPay } = calculateCleanerEarnings(dbPricing);
      // With 10% fee: min = 15000 * 0.9 = 13500, max = (15000 + 5000) * 0.9 = 18000

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        // Check hero headline shows earnings range with platform fee deducted
        // Text appears in multiple places (hero, benefits, disclaimer)
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });

    it("should correctly calculate earnings with 15% platform fee", async () => {
      const dbPricing = {
        basePrice: 20000,
        extraBedBathFee: 6000,
        linens: { sheetFeePerBed: 3500, towelFee: 700, faceClothFee: 300 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 3000, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 3000, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 4000, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 3000, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.15 }, // 15% platform fee
        highVolumeFee: 6000,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      // With 15% fee: min = 20000 * 0.85 = 17000, max = (20000 + 6000) * 0.85 = 22100
      const { minPay, maxPay } = calculateCleanerEarnings(dbPricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });

    it("should display earnings in benefit description", async () => {
      const dbPricing = {
        basePrice: 15000,
        extraBedBathFee: 5000,
        linens: { sheetFeePerBed: 3000, towelFee: 500, faceClothFee: 200 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 2500, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 2500, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 3000, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 2500, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 5000,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { minPay, maxPay } = calculateCleanerEarnings(dbPricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        // Check "Earn Great Money" benefit text includes earnings
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay} per house`)).length).toBeGreaterThan(0);
      });
    });

    it("should display earnings disclaimer with correct range", async () => {
      const dbPricing = {
        basePrice: 15000,
        extraBedBathFee: 5000,
        linens: { sheetFeePerBed: 3000, towelFee: 500, faceClothFee: 200 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 2500, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 2500, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 3000, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 2500, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 5000,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { minPay, maxPay } = calculateCleanerEarnings(dbPricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay} per house`)).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Default Pricing (Server Unavailable)", () => {
    it("should display default earnings when API fails", async () => {
      PricingService.getCurrentPricing.mockRejectedValue(new Error("Network error"));

      const { minPay, maxPay } = calculateCleanerEarnings(defaultPricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });

    it("should display default earnings when API returns null", async () => {
      PricingService.getCurrentPricing.mockResolvedValue(null);

      const { minPay, maxPay } = calculateCleanerEarnings(defaultPricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });

    it("should use default platform fee when pricing.platform is missing", async () => {
      // Simulate partial pricing data without platform info
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: {
          basePrice: 17500,
          extraBedBathFee: 5000,
        },
      });

      // Should fall back to default platform fee (0.1)
      // Calculate in cents first, then convert to dollars for display comparison
      const minPayCents = Math.round(17500 * (1 - defaultPricing.platform.feePercent));
      const maxPayCents = Math.round((17500 + 5000) * (1 - defaultPricing.platform.feePercent));
      const minPay = Math.round(minPayCents / 100);
      const maxPay = Math.round(maxPayCents / 100);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Earnings Calculations", () => {
    it("should calculate weekly earnings correctly for full-time (3 houses/day)", async () => {
      const dbPricing = {
        basePrice: 15000,
        extraBedBathFee: 5000,
        linens: { sheetFeePerBed: 3000, towelFee: 500, faceClothFee: 200 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 2500, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 2500, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 3000, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 2500, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 5000,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { minPay, maxPay } = calculateCleanerEarnings(dbPricing);
      const avgPay = Math.round((minPay + maxPay) / 2);
      // Full-time: 3 houses/day * 5 days * avgPay
      const weeklyEarnings = 3 * 5 * avgPay;

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        // Check weekly earnings in income highlight section (may appear multiple times)
        expect(getAllByText(`$${weeklyEarnings.toLocaleString()}+`).length).toBeGreaterThan(0);
      });
    });

    it("should show earnings tier labels", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: defaultPricing,
      });

      const { getByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getByText("Part-Time")).toBeTruthy();
        expect(getByText("Full-Time")).toBeTruthy();
        expect(getByText("Hustle Mode")).toBeTruthy();
      });
    });

    it("should show hours per day for each tier", async () => {
      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: defaultPricing,
      });

      const { getByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getByText("1-2 houses/day")).toBeTruthy();
        expect(getByText("3 houses/day")).toBeTruthy();
        expect(getByText("4+ houses/day")).toBeTruthy();
      });
    });
  });

  describe("Platform Fee Impact", () => {
    it("should show lower earnings with higher platform fee", async () => {
      // Test with 20% platform fee
      const highFeePricing = {
        ...defaultPricing,
        platform: { feePercent: 0.2 },
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: highFeePricing,
      });

      // With 20% fee: min = 15000 * 0.8 = 12000, max = (15000 + 5000) * 0.8 = 16000
      const { minPay, maxPay } = calculateCleanerEarnings(highFeePricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });

    it("should show higher earnings with lower platform fee", async () => {
      // Test with 5% platform fee
      const lowFeePricing = {
        ...defaultPricing,
        platform: { feePercent: 0.05 },
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: lowFeePricing,
      });

      // With 5% fee: min = 15000 * 0.95 = 14250, max = (15000 + 5000) * 0.95 = 19000
      const { minPay, maxPay } = calculateCleanerEarnings(lowFeePricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Dynamic Price Updates", () => {
    it("should reflect owner-updated pricing immediately", async () => {
      // Simulate owner updating prices
      const updatedPricing = {
        basePrice: 20000,
        extraBedBathFee: 7500,
        linens: { sheetFeePerBed: 4000, towelFee: 800, faceClothFee: 400 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 3000, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 3000, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 4000, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 3000, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 6000,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: updatedPricing,
      });

      const { minPay, maxPay } = calculateCleanerEarnings(updatedPricing);
      // With 10% fee: min = 20000 * 0.9 = 18000, max = (20000 + 7500) * 0.9 = 24750

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });
  });
});

describe("CleanerApplicationForm Landing Page - Content Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PricingService.getCurrentPricing.mockResolvedValue({
      source: "database",
      pricing: defaultPricing,
    });
    // Default: incentives disabled
    IncentivesService.getCurrentIncentives.mockResolvedValue({
      cleaner: { enabled: false },
      homeowner: { enabled: false },
    });
  });

  it("should display hero section with earnings headline", async () => {
    const { getAllByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      // The hero displays "Earn $XXX - $XXX Per House Cleaned" - may appear multiple places
      expect(getAllByText(/Earn/).length).toBeGreaterThan(0);
    });
  });

  it("should display 'Per House Cleaned' label", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      // Text appears on its own line after a newline character
      expect(getByText(/Per House Cleaned/)).toBeTruthy();
    });
  });

  it("should display 'Apply Now - Takes 5 Minutes' button", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Apply Now - Takes 5 Minutes")).toBeTruthy();
    });
  });

  it("should display 'Average Weekly Earnings' section", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Average Weekly Earnings")).toBeTruthy();
    });
  });

  it("should display 'Why Join Kleanr?' section", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Why Join Kleanr?")).toBeTruthy();
    });
  });

  it("should display 'How Much Can You Earn?' section", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("How Much Can You Earn?")).toBeTruthy();
    });
  });

  it("should display benefit cards", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Be Your Own Boss")).toBeTruthy();
      expect(getByText("Get Paid Fast")).toBeTruthy();
      expect(getByText("Unlimited Earning Potential")).toBeTruthy();
    });
  });

  it("should display perks list", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Get paid within 1-2 business days of each cleaning")).toBeTruthy();
      expect(getByText("Flexible scheduling - accept only jobs you want")).toBeTruthy();
      expect(getByText("No experience necessary")).toBeTruthy();
    });
  });
});

describe("Customer vs Cleaner Pricing Comparison", () => {
  it("should show DIFFERENT prices between customer and cleaner landing pages", async () => {
    // This test documents that customer sees full price, cleaner sees earnings after platform fee
    const pricing = {
      basePrice: 15000,
      extraBedBathFee: 5000,
      linens: { sheetFeePerBed: 3000, towelFee: 500, faceClothFee: 200 },
      timeWindows: {
        anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
        "10-3": { surcharge: 2500, label: "10am - 3pm", description: "+$25" },
        "11-4": { surcharge: 2500, label: "11am - 4pm", description: "+$25" },
        "12-2": { surcharge: 3000, label: "12pm - 2pm", description: "+$30" },
      },
      cancellation: { fee: 2500, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
      platform: { feePercent: 0.1 }, // 10% platform fee
      highVolumeFee: 5000,
    };

    // Customer sees: $150 (full price in cents = 15000)
    const customerPrice = pricing.basePrice;

    // Cleaner sees: $135 (price minus 10% platform fee, in cents = 13500)
    const cleanerMinPay = Math.round(pricing.basePrice * (1 - pricing.platform.feePercent));

    // Verify they are DIFFERENT
    expect(customerPrice).not.toEqual(cleanerMinPay);
    expect(customerPrice).toBe(15000);
    expect(cleanerMinPay).toBe(13500);

    // The difference is the platform fee
    expect(customerPrice - cleanerMinPay).toBe(1500); // 10% of 15000 cents
  });

  it("should calculate platform fee correctly for various base prices", () => {
    const testCases = [
      { basePrice: 10000, feePercent: 0.1, expectedCleanerPay: 9000 },
      { basePrice: 15000, feePercent: 0.1, expectedCleanerPay: 13500 },
      { basePrice: 20000, feePercent: 0.1, expectedCleanerPay: 18000 },
      { basePrice: 15000, feePercent: 0.15, expectedCleanerPay: 12750 },
      { basePrice: 15000, feePercent: 0.05, expectedCleanerPay: 14250 },
    ];

    testCases.forEach(({ basePrice, feePercent, expectedCleanerPay }) => {
      const cleanerPay = Math.round(basePrice * (1 - feePercent));
      expect(cleanerPay).toBe(expectedCleanerPay);
    });
  });
});

describe("Cleaner Incentive Banner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to enabled incentive config
    IncentivesService.getCurrentIncentives.mockResolvedValue({
      cleaner: {
        enabled: true,
        feeReductionPercent: 1.0, // 100% reduction = 0% fees
        eligibilityDays: 30,
        maxCleanings: 5,
      },
      homeowner: {
        enabled: false,
        discountPercent: 0.1,
        maxCleanings: 4,
      },
    });
  });

  it("should display incentive banner when cleaner incentive is enabled", async () => {
    PricingService.getCurrentPricing.mockResolvedValue({
      source: "database",
      pricing: defaultPricing,
    });

    const { getByTestId } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByTestId("incentive-banner")).toBeTruthy();
    });
  });

  it("should NOT display incentive banner when cleaner incentive is disabled", async () => {
    IncentivesService.getCurrentIncentives.mockResolvedValue({
      cleaner: {
        enabled: false,
        feeReductionPercent: 1.0,
        eligibilityDays: 30,
        maxCleanings: 5,
      },
      homeowner: {
        enabled: false,
        discountPercent: 0.1,
        maxCleanings: 4,
      },
    });

    PricingService.getCurrentPricing.mockResolvedValue({
      source: "database",
      pricing: defaultPricing,
    });

    const { queryByTestId } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(queryByTestId("incentive-banner")).toBeNull();
    });
  });

  it("should display extra percentage in banner with 100% fee reduction", async () => {
    const pricing = {
      ...defaultPricing,
      platform: { feePercent: 0.1 }, // 10% platform fee
    };

    PricingService.getCurrentPricing.mockResolvedValue({
      source: "database",
      pricing,
    });

    // With 100% fee reduction: extra = 10% * 100% = 10%
    // minCleanerPay = 135, maxCleanerPay = 180, avgPay = 158
    // extraPerCleaning = 158 * 0.1 * 1.0 = 16, totalExtra = 16 * 5 = 80
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText(/extra 10% on each of your first 5 cleanings - that's up to \$80 extra/)).toBeTruthy();
    });
  });

  it("should show correct percentage for partial fee reduction", async () => {
    IncentivesService.getCurrentIncentives.mockResolvedValue({
      cleaner: {
        enabled: true,
        feeReductionPercent: 0.5, // 50% reduction
        eligibilityDays: 30,
        maxCleanings: 5,
      },
      homeowner: { enabled: false },
    });

    PricingService.getCurrentPricing.mockResolvedValue({
      source: "database",
      pricing: {
        ...defaultPricing,
        platform: { feePercent: 0.1 }, // 10% platform fee
      },
    });

    // Extra = 10% * 50% = 5%
    // minCleanerPay = 135, maxCleanerPay = 180, avgPay = 158
    // extraPerCleaning = 158 * 0.1 * 0.5 = 8, totalExtra = 8 * 5 = 40
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText(/extra 5% on each of your first 5 cleanings - that's up to \$40 extra/)).toBeTruthy();
    });
  });

  it("should calculate percentage correctly with different settings", async () => {
    IncentivesService.getCurrentIncentives.mockResolvedValue({
      cleaner: {
        enabled: true,
        feeReductionPercent: 0.75, // 75% reduction
        eligibilityDays: 60,
        maxCleanings: 10,
      },
      homeowner: { enabled: false },
    });

    PricingService.getCurrentPricing.mockResolvedValue({
      source: "database",
      pricing: {
        ...defaultPricing,
        platform: { feePercent: 0.12 }, // 12% platform fee
      },
    });

    // Extra = 12% * 75% = 9%
    // minCleanerPay = 150 * 0.88 = 132, maxCleanerPay = 200 * 0.88 = 176, avgPay = 154
    // extraPerCleaning = 154 * 0.12 * 0.75 = 14, totalExtra = 14 * 10 = 140
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText(/extra 9% on each of your first 10 cleanings - that's up to \$140 extra/)).toBeTruthy();
    });
  });
});
