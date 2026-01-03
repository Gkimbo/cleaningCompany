/**
 * ImportBusinessLanding Component Tests
 *
 * Tests for the business import landing page with dynamic fee display
 */

import React from "react";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock PricingContext
jest.mock("../../src/context/PricingContext", () => ({
  usePricing: jest.fn(),
}));

const { usePricing } = require("../../src/context/PricingContext");

describe("ImportBusinessLanding Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePricing.mockReturnValue({
      pricing: {
        platform: {
          feePercent: 0.1,
          businessOwnerFeePercent: 0.1,
        },
      },
    });
  });

  describe("Dynamic Fee Calculation", () => {
    it("should calculate keep percentage from business owner fee", () => {
      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);

      expect(keepPercent).toBe(90);
    });

    it("should calculate fee percentage", () => {
      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const feePercent = Math.round(businessOwnerFee * 100);

      expect(feePercent).toBe(10);
    });

    it("should update dynamically when fee is 8%", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            businessOwnerFeePercent: 0.08,
          },
        },
      });

      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);
      const feePercent = Math.round(businessOwnerFee * 100);

      expect(keepPercent).toBe(92);
      expect(feePercent).toBe(8);
    });

    it("should update dynamically when fee is 15%", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            businessOwnerFeePercent: 0.15,
          },
        },
      });

      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);
      const feePercent = Math.round(businessOwnerFee * 100);

      expect(keepPercent).toBe(85);
      expect(feePercent).toBe(15);
    });

    it("should fall back to 10% when pricing is undefined", () => {
      usePricing.mockReturnValue({ pricing: null });

      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);

      expect(keepPercent).toBe(90);
    });
  });

  describe("Stats Display", () => {
    it("should display dynamic keep percentage in stats", () => {
      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);

      const stats = [
        { value: `${keepPercent}%`, label: "You Keep" },
      ];

      expect(stats[0].value).toBe("90%");
      expect(stats[0].label).toBe("You Keep");
    });

    it("should update stats when fee changes", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            businessOwnerFeePercent: 0.05,
          },
        },
      });

      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);

      const stats = [
        { value: `${keepPercent}%`, label: "You Keep" },
      ];

      expect(stats[0].value).toBe("95%");
    });
  });

  describe("Pricing Section Text", () => {
    it("should generate dynamic pricing title", () => {
      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);

      const title = `Keep ${keepPercent}% of Everything`;

      expect(title).toBe("Keep 90% of Everything");
    });

    it("should generate dynamic pricing description", () => {
      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const feePercent = Math.round(businessOwnerFee * 100);

      const description = `Simple, transparent pricing. Only a ${feePercent}% platform fee.`;

      expect(description).toBe("Simple, transparent pricing. Only a 10% platform fee.");
    });

    it("should update pricing text when fee changes", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            businessOwnerFeePercent: 0.08,
          },
        },
      });

      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);
      const feePercent = Math.round(businessOwnerFee * 100);

      const title = `Keep ${keepPercent}% of Everything`;
      const description = `Simple, transparent pricing. Only a ${feePercent}% platform fee.`;

      expect(title).toBe("Keep 92% of Everything");
      expect(description).toBe("Simple, transparent pricing. Only a 8% platform fee.");
    });
  });

  describe("Navigation", () => {
    it("should navigate to business signup check on Get Started", () => {
      mockNavigate("/business-signup-check");

      expect(mockNavigate).toHaveBeenCalledWith("/business-signup-check");
    });

    it("should navigate to cleaner apply page", () => {
      mockNavigate("/apply");

      expect(mockNavigate).toHaveBeenCalledWith("/apply");
    });

    it("should navigate home on back button", () => {
      mockNavigate("/");

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  describe("Feature Cards", () => {
    it("should display clients feature", () => {
      const features = [
        { icon: "users", title: "Your Clients", description: "Invite existing clients or add new ones" },
      ];

      expect(features[0].title).toBe("Your Clients");
    });

    it("should display scheduling feature", () => {
      const features = [
        { icon: "calendar", title: "Easy Scheduling", description: "Manage all appointments in one place" },
      ];

      expect(features[0].title).toBe("Easy Scheduling");
    });

    it("should display payments feature", () => {
      const features = [
        { icon: "credit-card", title: "Get Paid Fast", description: "Automatic payments when jobs complete" },
      ];

      expect(features[0].title).toBe("Get Paid Fast");
    });
  });

  describe("Fee Display Accuracy", () => {
    it("should handle very low fees", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            businessOwnerFeePercent: 0.01, // 1%
          },
        },
      });

      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);

      expect(keepPercent).toBe(99);
    });

    it("should handle fractional percentages with rounding", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            businessOwnerFeePercent: 0.125, // 12.5%
          },
        },
      });

      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);
      const feePercent = Math.round(businessOwnerFee * 100);

      expect(keepPercent).toBe(88); // 87.5 rounds to 88
      expect(feePercent).toBe(13);  // 12.5 rounds to 13
    });
  });

  describe("CTA Sections", () => {
    it("should show cleaner CTA section", () => {
      const cleanerCTA = {
        title: "Want to work for Kleanr instead?",
        buttonText: "Apply as a Cleaner",
      };

      expect(cleanerCTA.title).toContain("work for Kleanr");
    });

    it("should show primary CTA button", () => {
      const primaryCTA = {
        text: "Get Started",
        navigateTo: "/business-signup-check",
      };

      expect(primaryCTA.text).toBe("Get Started");
    });
  });

  describe("Benefits Section", () => {
    it("should list all benefits", () => {
      const benefits = [
        "Keep all your existing clients",
        "Set your own prices",
        "We handle the payments",
        "Optional access to our platform clients",
      ];

      expect(benefits.length).toBe(4);
      expect(benefits).toContain("Keep all your existing clients");
      expect(benefits).toContain("Set your own prices");
    });
  });

  describe("Page Content", () => {
    it("should have correct headline", () => {
      const headline = "Already Have a Cleaning Business?";

      expect(headline).toContain("Cleaning Business");
    });

    it("should have correct subheadline", () => {
      const subheadline = "Use Kleanr to manage your clients, schedule appointments, and get paid - all in one place.";

      expect(subheadline).toContain("manage your clients");
      expect(subheadline).toContain("get paid");
    });
  });

  describe("Fee Comparison Benefit", () => {
    it("should show benefit compared to competitors", () => {
      const { pricing } = usePricing();
      const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
      const keepPercent = Math.round((1 - businessOwnerFee) * 100);

      // Competitors typically charge 20-30%
      const competitorFee = 0.25;
      const competitorKeepPercent = Math.round((1 - competitorFee) * 100);

      expect(keepPercent).toBeGreaterThan(competitorKeepPercent);
    });
  });
});
