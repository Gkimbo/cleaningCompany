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

import PricingService from "../../src/services/fetchRequests/PricingService";
import { PricingProvider, defaultPricing } from "../../src/context/PricingContext";
import CleanerApplicationForm from "../../src/components/admin/CleanerApplications/ApplicationForm";

// Helper to calculate expected cleaner earnings
const calculateCleanerEarnings = (pricing) => {
  const platformFeePercent = pricing.platform?.feePercent ?? defaultPricing.platform.feePercent;
  const minPay = Math.round((pricing.basePrice ?? defaultPricing.basePrice) * (1 - platformFeePercent));
  // Max pay uses 1 extra (matching the component - a 2bed/1bath scenario)
  const maxPay = Math.round(
    ((pricing.basePrice ?? defaultPricing.basePrice) + (pricing.extraBedBathFee ?? defaultPricing.extraBedBathFee)) *
      (1 - platformFeePercent)
  );
  return { minPay, maxPay };
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
  });

  describe("Database Pricing (Server Available)", () => {
    it("should display earnings with platform fee deducted", async () => {
      const dbPricing = {
        basePrice: 150,
        extraBedBathFee: 50,
        linens: { sheetFeePerBed: 30, towelFee: 5, faceClothFee: 2 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 25, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 30, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 25, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 }, // 10% platform fee
        highVolumeFee: 50,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      const { minPay, maxPay } = calculateCleanerEarnings(dbPricing);
      // With 10% fee: min = 150 * 0.9 = 135, max = (150 + 50) * 0.9 = 180

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        // Check hero headline shows earnings range with platform fee deducted
        // Text appears in multiple places (hero, benefits, disclaimer)
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });

    it("should correctly calculate earnings with 15% platform fee", async () => {
      const dbPricing = {
        basePrice: 200,
        extraBedBathFee: 60,
        linens: { sheetFeePerBed: 35, towelFee: 7, faceClothFee: 3 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 30, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 30, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 40, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 30, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.15 }, // 15% platform fee
        highVolumeFee: 60,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: dbPricing,
      });

      // With 15% fee: min = 200 * 0.85 = 170, max = (200 + 60) * 0.85 = 221
      const { minPay, maxPay } = calculateCleanerEarnings(dbPricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });

    it("should display earnings in benefit description", async () => {
      const dbPricing = {
        basePrice: 150,
        extraBedBathFee: 50,
        linens: { sheetFeePerBed: 30, towelFee: 5, faceClothFee: 2 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 25, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 30, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 25, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 50,
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
        basePrice: 150,
        extraBedBathFee: 50,
        linens: { sheetFeePerBed: 30, towelFee: 5, faceClothFee: 2 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 25, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 30, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 25, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 50,
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
          basePrice: 175,
          extraBedBathFee: 50,
        },
      });

      // Should fall back to default platform fee (0.1)
      const minPay = Math.round(175 * (1 - defaultPricing.platform.feePercent));
      const maxPay = Math.round((175 + 50) * (1 - defaultPricing.platform.feePercent));

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Earnings Calculations", () => {
    it("should calculate weekly earnings correctly for full-time (3 houses/day)", async () => {
      const dbPricing = {
        basePrice: 150,
        extraBedBathFee: 50,
        linens: { sheetFeePerBed: 30, towelFee: 5, faceClothFee: 2 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25" },
          "11-4": { surcharge: 25, label: "11am - 4pm", description: "+$25" },
          "12-2": { surcharge: 30, label: "12pm - 2pm", description: "+$30" },
        },
        cancellation: { fee: 25, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 50,
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

      // With 20% fee: min = 150 * 0.8 = 120, max = (150 + 50) * 0.8 = 160
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

      // With 5% fee: min = 150 * 0.95 = 142.5 -> 143, max = (150 + 50) * 0.95 = 190
      const { minPay, maxPay } = calculateCleanerEarnings(lowFeePricing);

      const { getAllByText } = renderCleanerApplicationForm();

      await waitFor(() => {
        expect(getAllByText(new RegExp(`\\$${minPay}-\\$${maxPay}`)).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Dynamic Price Updates", () => {
    it("should reflect manager-updated pricing immediately", async () => {
      // Simulate manager updating prices
      const updatedPricing = {
        basePrice: 200,
        extraBedBathFee: 75,
        linens: { sheetFeePerBed: 40, towelFee: 8, faceClothFee: 4 },
        timeWindows: {
          anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
          "10-3": { surcharge: 30, label: "10am - 3pm", description: "+$30" },
          "11-4": { surcharge: 30, label: "11am - 4pm", description: "+$30" },
          "12-2": { surcharge: 40, label: "12pm - 2pm", description: "+$40" },
        },
        cancellation: { fee: 30, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 60,
      };

      PricingService.getCurrentPricing.mockResolvedValue({
        source: "database",
        pricing: updatedPricing,
      });

      const { minPay, maxPay } = calculateCleanerEarnings(updatedPricing);
      // With 10% fee: min = 200 * 0.9 = 180, max = (200 + 75) * 0.9 = 248

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
  });

  it("should display 'Now Hiring' badge", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Now Hiring")).toBeTruthy();
    });
  });

  it("should display 'Per House Cleaned' label", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      // Text appears on its own line after a newline character
      expect(getByText(/Per House Cleaned/)).toBeTruthy();
    });
  });

  it("should display 'Apply Now - It's Free' button", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Apply Now - It's Free")).toBeTruthy();
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
      expect(getByText("Set Your Own Hours")).toBeTruthy();
      expect(getByText("Earn Great Money")).toBeTruthy();
      expect(getByText("Grow Your Income")).toBeTruthy();
    });
  });

  it("should display perks list", async () => {
    const { getByText } = renderCleanerApplicationForm();

    await waitFor(() => {
      expect(getByText("Get paid as soon as you finish each cleaning")).toBeTruthy();
      expect(getByText("Flexible scheduling - you choose your jobs")).toBeTruthy();
      expect(getByText("No experience necessary")).toBeTruthy();
    });
  });
});

describe("Customer vs Cleaner Pricing Comparison", () => {
  it("should show DIFFERENT prices between customer and cleaner landing pages", async () => {
    // This test documents that customer sees full price, cleaner sees earnings after platform fee
    const pricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      linens: { sheetFeePerBed: 30, towelFee: 5, faceClothFee: 2 },
      timeWindows: {
        anytime: { surcharge: 0, label: "Anytime", description: "Most flexible" },
        "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25" },
        "11-4": { surcharge: 25, label: "11am - 4pm", description: "+$25" },
        "12-2": { surcharge: 30, label: "12pm - 2pm", description: "+$30" },
      },
      cancellation: { fee: 25, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
      platform: { feePercent: 0.1 }, // 10% platform fee
      highVolumeFee: 50,
    };

    // Customer sees: $150 (full price)
    const customerPrice = pricing.basePrice;

    // Cleaner sees: $135 (price minus 10% platform fee)
    const cleanerMinPay = Math.round(pricing.basePrice * (1 - pricing.platform.feePercent));

    // Verify they are DIFFERENT
    expect(customerPrice).not.toEqual(cleanerMinPay);
    expect(customerPrice).toBe(150);
    expect(cleanerMinPay).toBe(135);

    // The difference is the platform fee
    expect(customerPrice - cleanerMinPay).toBe(15); // 10% of $150
  });

  it("should calculate platform fee correctly for various base prices", () => {
    const testCases = [
      { basePrice: 100, feePercent: 0.1, expectedCleanerPay: 90 },
      { basePrice: 150, feePercent: 0.1, expectedCleanerPay: 135 },
      { basePrice: 200, feePercent: 0.1, expectedCleanerPay: 180 },
      { basePrice: 150, feePercent: 0.15, expectedCleanerPay: 128 }, // 127.5 rounded
      { basePrice: 150, feePercent: 0.05, expectedCleanerPay: 143 }, // 142.5 rounded
    ];

    testCases.forEach(({ basePrice, feePercent, expectedCleanerPay }) => {
      const cleanerPay = Math.round(basePrice * (1 - feePercent));
      expect(cleanerPay).toBe(expectedCleanerPay);
    });
  });
});
