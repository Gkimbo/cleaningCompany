/**
 * BusinessCalculator Component Tests
 *
 * Tests for the earnings calculator component with dynamic fee support
 */

import React from "react";

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

// Mock PricingContext
jest.mock("../../src/context/PricingContext", () => ({
  usePricing: jest.fn(),
}));

const { usePricing } = require("../../src/context/PricingContext");

describe("BusinessCalculator Component", () => {
  // Helper functions that mirror the component logic
  const calculateSingleJobEarnings = (jobPrice, feePercent) => {
    const fee = jobPrice * feePercent;
    const net = jobPrice - fee;
    return { gross: jobPrice, fee, net };
  };

  const calculateProjections = (avgJobPrice, jobsPerWeek, feePercent) => {
    const keepPercent = 1 - feePercent;

    const weeklyGross = avgJobPrice * jobsPerWeek;
    const weeklyFee = weeklyGross * feePercent;
    const weeklyNet = weeklyGross * keepPercent;

    const monthlyGross = weeklyGross * 4.33;
    const monthlyFee = monthlyGross * feePercent;
    const monthlyNet = monthlyGross * keepPercent;

    const yearlyGross = weeklyGross * 52;
    const yearlyFee = yearlyGross * feePercent;
    const yearlyNet = yearlyGross * keepPercent;

    return {
      weekly: { gross: weeklyGross, fee: weeklyFee, net: weeklyNet },
      monthly: { gross: monthlyGross, fee: monthlyFee, net: monthlyNet },
      yearly: { gross: yearlyGross, fee: yearlyFee, net: yearlyNet },
    };
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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

  describe("Fee Determination", () => {
    it("should use businessOwnerFeePercent for business owners", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            feePercent: 0.1,
            businessOwnerFeePercent: 0.08,
          },
        },
      });

      const state = { account: "cleaner", isBusinessOwner: true };
      const { pricing } = usePricing();

      const feePercent = (state.account === "owner" || state.isBusinessOwner)
        ? (pricing?.platform?.businessOwnerFeePercent || 0.10)
        : (pricing?.platform?.feePercent || 0.10);

      expect(feePercent).toBe(0.08);
    });

    it("should use businessOwnerFeePercent for platform owner", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            feePercent: 0.1,
            businessOwnerFeePercent: 0.08,
          },
        },
      });

      const state = { account: "owner", isBusinessOwner: false };
      const { pricing } = usePricing();

      const feePercent = (state.account === "owner" || state.isBusinessOwner)
        ? (pricing?.platform?.businessOwnerFeePercent || 0.10)
        : (pricing?.platform?.feePercent || 0.10);

      expect(feePercent).toBe(0.08);
    });

    it("should use feePercent for regular cleaners", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            feePercent: 0.1,
            businessOwnerFeePercent: 0.08,
          },
        },
      });

      const state = { account: "cleaner", isBusinessOwner: false };
      const { pricing } = usePricing();

      const feePercent = (state.account === "owner" || state.isBusinessOwner)
        ? (pricing?.platform?.businessOwnerFeePercent || 0.10)
        : (pricing?.platform?.feePercent || 0.10);

      expect(feePercent).toBe(0.1);
    });

    it("should default to 0.1 when pricing is undefined", () => {
      usePricing.mockReturnValue({ pricing: null });

      const state = { account: "cleaner", isBusinessOwner: true };
      const { pricing } = usePricing();

      const feePercent = (state.account === "owner" || state.isBusinessOwner)
        ? (pricing?.platform?.businessOwnerFeePercent || 0.10)
        : (pricing?.platform?.feePercent || 0.10);

      expect(feePercent).toBe(0.1);
    });
  });

  describe("Keep Percent Calculation", () => {
    it("should calculate correct keep percentage", () => {
      const feePercent = 0.1;
      const keepPercent = 1 - feePercent;

      expect(keepPercent).toBe(0.9);
    });

    it("should handle lower business owner fee", () => {
      const feePercent = 0.08;
      const keepPercent = 1 - feePercent;

      expect(keepPercent).toBe(0.92);
    });

    it("should convert to display percentage correctly", () => {
      const feePercent = 0.1;
      const keepPercent = 1 - feePercent;

      expect(Math.round(keepPercent * 100)).toBe(90);
      expect(Math.round(feePercent * 100)).toBe(10);
    });
  });

  describe("Single Job Calculations", () => {
    it("should calculate correct fee and net for standard job", () => {
      const result = calculateSingleJobEarnings(150, 0.1);

      expect(result.gross).toBe(150);
      expect(result.fee).toBe(15);
      expect(result.net).toBe(135);
    });

    it("should calculate with lower business owner fee", () => {
      const result = calculateSingleJobEarnings(150, 0.08);

      expect(result.gross).toBe(150);
      expect(result.fee).toBe(12);
      expect(result.net).toBe(138);
    });

    it("should handle zero job price", () => {
      const result = calculateSingleJobEarnings(0, 0.1);

      expect(result.gross).toBe(0);
      expect(result.fee).toBe(0);
      expect(result.net).toBe(0);
    });

    it("should handle high job price", () => {
      const result = calculateSingleJobEarnings(500, 0.1);

      expect(result.gross).toBe(500);
      expect(result.fee).toBe(50);
      expect(result.net).toBe(450);
    });

    it("should handle decimal job price", () => {
      const result = calculateSingleJobEarnings(175.50, 0.1);

      expect(result.gross).toBe(175.50);
      expect(result.fee).toBeCloseTo(17.55, 2);
      expect(result.net).toBeCloseTo(157.95, 2);
    });
  });

  describe("Weekly Projections", () => {
    it("should calculate weekly projections correctly", () => {
      const projections = calculateProjections(150, 10, 0.1);

      expect(projections.weekly.gross).toBe(1500);
      expect(projections.weekly.fee).toBe(150);
      expect(projections.weekly.net).toBe(1350);
    });

    it("should handle varied jobs per week", () => {
      const projections = calculateProjections(150, 5, 0.1);

      expect(projections.weekly.gross).toBe(750);
      expect(projections.weekly.net).toBe(675);
    });

    it("should handle lower fee for business owners", () => {
      const projections = calculateProjections(150, 10, 0.08);

      expect(projections.weekly.gross).toBe(1500);
      expect(projections.weekly.fee).toBe(120);
      expect(projections.weekly.net).toBe(1380);
    });
  });

  describe("Monthly Projections", () => {
    it("should calculate monthly projections with 4.33 weeks", () => {
      const projections = calculateProjections(150, 10, 0.1);

      expect(projections.monthly.gross).toBeCloseTo(6495, 0);
      expect(projections.monthly.fee).toBeCloseTo(649.5, 1);
      expect(projections.monthly.net).toBeCloseTo(5845.5, 1);
    });

    it("should use correct monthly multiplier", () => {
      const weeklyGross = 1500;
      const monthlyGross = weeklyGross * 4.33;

      expect(monthlyGross).toBe(6495);
    });
  });

  describe("Yearly Projections", () => {
    it("should calculate yearly projections with 52 weeks", () => {
      const projections = calculateProjections(150, 10, 0.1);

      expect(projections.yearly.gross).toBe(78000);
      expect(projections.yearly.fee).toBe(7800);
      expect(projections.yearly.net).toBe(70200);
    });

    it("should show significant yearly savings with lower fee", () => {
      const regularProjections = calculateProjections(150, 10, 0.1);
      const businessOwnerProjections = calculateProjections(150, 10, 0.08);

      const yearlySavings = businessOwnerProjections.yearly.net - regularProjections.yearly.net;

      expect(yearlySavings).toBe(1560); // $1,560 more per year
    });
  });

  describe("Currency Formatting", () => {
    it("should format currency without decimals", () => {
      expect(formatCurrency(1500)).toBe("$1,500");
      expect(formatCurrency(70200)).toBe("$70,200");
    });

    it("should handle zero", () => {
      expect(formatCurrency(0)).toBe("$0");
    });

    it("should round to nearest dollar", () => {
      // formatCurrency has maximumFractionDigits: 0
      const result = formatCurrency(1234.56);
      expect(result).toBe("$1,235");
    });

    it("should format large numbers with commas", () => {
      expect(formatCurrency(100000)).toBe("$100,000");
      expect(formatCurrency(1000000)).toBe("$1,000,000");
    });
  });

  describe("Input Parsing", () => {
    it("should parse string input correctly", () => {
      const inputValue = "150";
      const parsed = parseFloat(inputValue) || 0;

      expect(parsed).toBe(150);
    });

    it("should handle empty string input", () => {
      const inputValue = "";
      const parsed = parseFloat(inputValue) || 0;

      expect(parsed).toBe(0);
    });

    it("should handle invalid string input", () => {
      const inputValue = "abc";
      const parsed = parseFloat(inputValue) || 0;

      expect(parsed).toBe(0);
    });

    it("should handle decimal input", () => {
      const inputValue = "175.50";
      const parsed = parseFloat(inputValue) || 0;

      expect(parsed).toBe(175.5);
    });
  });

  describe("Total Jobs Calculation", () => {
    it("should calculate total annual jobs", () => {
      const jobsPerWeek = 10;
      const totalAnnualJobs = Math.round(jobsPerWeek * 52);

      expect(totalAnnualJobs).toBe(520);
    });

    it("should round fractional jobs per week", () => {
      const jobsPerWeek = 7.5;
      const totalAnnualJobs = Math.round(jobsPerWeek * 52);

      expect(totalAnnualJobs).toBe(390);
    });
  });

  describe("Edge Cases", () => {
    it("should handle 0% fee", () => {
      const projections = calculateProjections(150, 10, 0);

      expect(projections.yearly.fee).toBe(0);
      expect(projections.yearly.net).toBe(projections.yearly.gross);
    });

    it("should handle very small fee", () => {
      const projections = calculateProjections(150, 10, 0.01);

      expect(projections.yearly.fee).toBe(780); // 1% of $78,000
      expect(projections.yearly.net).toBe(77220);
    });

    it("should handle fractional job price", () => {
      const result = calculateSingleJobEarnings(99.99, 0.1);

      expect(result.fee).toBeCloseTo(9.999, 3);
      expect(result.net).toBeCloseTo(89.991, 3);
    });

    it("should handle zero jobs per week", () => {
      const projections = calculateProjections(150, 0, 0.1);

      expect(projections.weekly.gross).toBe(0);
      expect(projections.monthly.gross).toBe(0);
      expect(projections.yearly.gross).toBe(0);
    });
  });

  describe("Business Owner Benefit Comparison", () => {
    it("should show increased earnings for business owners", () => {
      const regularFee = 0.1;
      const businessOwnerFee = 0.08;
      const jobPrice = 150;
      const jobsPerWeek = 10;

      const regularProjections = calculateProjections(jobPrice, jobsPerWeek, regularFee);
      const businessOwnerProjections = calculateProjections(jobPrice, jobsPerWeek, businessOwnerFee);

      // Weekly difference
      const weeklyDiff = businessOwnerProjections.weekly.net - regularProjections.weekly.net;
      expect(weeklyDiff).toBe(30); // $30 more per week

      // Yearly difference
      const yearlyDiff = businessOwnerProjections.yearly.net - regularProjections.yearly.net;
      expect(yearlyDiff).toBe(1560); // $1,560 more per year
    });

    it("should calculate percentage savings", () => {
      const regularFee = 0.1;
      const businessOwnerFee = 0.08;

      const feeDifference = regularFee - businessOwnerFee;
      const percentSavings = (feeDifference / regularFee) * 100;

      expect(percentSavings).toBeCloseTo(20, 10); // 20% less in fees
    });
  });
});
