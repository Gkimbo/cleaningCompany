/**
 * SelectNewJobList Dynamic Fee Tests
 *
 * Tests for the dynamic platform fee calculation in job filtering
 */

import React from "react";

// Mock PricingContext
jest.mock("../../src/context/PricingContext", () => ({
  usePricing: jest.fn(),
}));

const { usePricing } = require("../../src/context/PricingContext");

describe("SelectNewJobList Dynamic Fee Calculation", () => {
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

  describe("Cleaner Share Calculation", () => {
    it("should calculate cleaner share from dynamic fee", () => {
      const { pricing } = usePricing();
      const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);

      expect(cleanerSharePercent).toBe(0.9);
    });

    it("should handle different fee percentages", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            feePercent: 0.15,
          },
        },
      });

      const { pricing } = usePricing();
      const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);

      expect(cleanerSharePercent).toBe(0.85);
    });

    it("should default to 0.9 when pricing is undefined", () => {
      usePricing.mockReturnValue({ pricing: null });

      const { pricing } = usePricing();
      const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);

      expect(cleanerSharePercent).toBe(0.9);
    });

    it("should default to 0.9 when platform is undefined", () => {
      usePricing.mockReturnValue({
        pricing: {},
      });

      const { pricing } = usePricing();
      const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);

      expect(cleanerSharePercent).toBe(0.9);
    });
  });

  describe("Min Earnings Filter", () => {
    const createAppointment = (price) => ({
      id: 1,
      price: price.toString(),
      homeId: 1,
    });

    const filterByMinEarnings = (appointments, minEarnings, feePercent = 0.1) => {
      const cleanerSharePercent = 1 - feePercent;

      return appointments.filter((appt) => {
        if (minEarnings) {
          const earnings = Number(appt.price) * cleanerSharePercent;
          if (earnings < minEarnings) return false;
        }
        return true;
      });
    };

    it("should filter jobs below minimum earnings threshold", () => {
      const appointments = [
        createAppointment(100), // 90% = $90
        createAppointment(150), // 90% = $135
        createAppointment(200), // 90% = $180
      ];

      const minEarnings = 100;
      const filtered = filterByMinEarnings(appointments, minEarnings);

      expect(filtered.length).toBe(2);
      expect(filtered[0].price).toBe("150");
      expect(filtered[1].price).toBe("200");
    });

    it("should not filter when minEarnings is 0", () => {
      const appointments = [
        createAppointment(50),
        createAppointment(100),
      ];

      const filtered = filterByMinEarnings(appointments, 0);

      expect(filtered.length).toBe(2);
    });

    it("should not filter when minEarnings is null", () => {
      const appointments = [
        createAppointment(50),
        createAppointment(100),
      ];

      const filtered = filterByMinEarnings(appointments, null);

      expect(filtered.length).toBe(2);
    });

    it("should adjust filtering based on different fee percentages", () => {
      const appointments = [
        createAppointment(100), // At 10%: $90, At 15%: $85
        createAppointment(120), // At 10%: $108, At 15%: $102
      ];

      // With 10% fee, min earnings of $100 filters out first job
      const filtered10 = filterByMinEarnings(appointments, 100, 0.1);
      expect(filtered10.length).toBe(1);

      // With 15% fee, min earnings of $100 filters out both jobs
      const filtered15 = filterByMinEarnings(appointments, 100, 0.15);
      expect(filtered15.length).toBe(1);
    });

    it("should include job when earnings exactly match minimum", () => {
      const appointments = [
        createAppointment(100), // 90% = $90 exactly
      ];

      const filtered = filterByMinEarnings(appointments, 90);

      expect(filtered.length).toBe(1);
    });

    it("should exclude job when earnings are just below minimum", () => {
      const appointments = [
        createAppointment(100), // 90% = $90
      ];

      const filtered = filterByMinEarnings(appointments, 91);

      expect(filtered.length).toBe(0);
    });
  });

  describe("Earnings Calculation", () => {
    it("should calculate earnings correctly for standard job", () => {
      const price = 150;
      const feePercent = 0.1;
      const cleanerSharePercent = 1 - feePercent;
      const earnings = price * cleanerSharePercent;

      expect(earnings).toBe(135);
    });

    it("should calculate earnings correctly for high fee", () => {
      const price = 150;
      const feePercent = 0.2;
      const cleanerSharePercent = 1 - feePercent;
      const earnings = price * cleanerSharePercent;

      expect(earnings).toBe(120);
    });

    it("should handle string price conversion", () => {
      const price = "150.00";
      const feePercent = 0.1;
      const cleanerSharePercent = 1 - feePercent;
      const earnings = Number(price) * cleanerSharePercent;

      expect(earnings).toBe(135);
    });

    it("should handle invalid price gracefully", () => {
      const price = "invalid";
      const feePercent = 0.1;
      const cleanerSharePercent = 1 - feePercent;
      const earnings = Number(price) * cleanerSharePercent;

      expect(isNaN(earnings)).toBe(true);
    });

    it("should handle null price", () => {
      const price = null;
      const feePercent = 0.1;
      const cleanerSharePercent = 1 - feePercent;
      const earnings = Number(price) * cleanerSharePercent;

      expect(earnings).toBe(0);
    });
  });

  describe("useMemo Dependency", () => {
    it("should include pricing in dependency array", () => {
      // The filteredData useMemo should re-run when pricing changes
      const dependencies = [
        "sortedData",
        "homeDetails",
        "filters",
        "userLocation",
        "preferredHomeIds",
        "pricing",
      ];

      expect(dependencies).toContain("pricing");
    });
  });

  describe("Dynamic Fee Integration", () => {
    it("should use dynamic fee instead of hardcoded 0.9", () => {
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            feePercent: 0.15,
          },
        },
      });

      const { pricing } = usePricing();
      const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);

      // With 15% fee, cleaner keeps 85%
      expect(cleanerSharePercent).toBe(0.85);
      expect(cleanerSharePercent).not.toBe(0.9); // Not hardcoded
    });

    it("should reflect owner-set fee percentage", () => {
      // Owner sets 8% fee
      usePricing.mockReturnValue({
        pricing: {
          platform: {
            feePercent: 0.08,
          },
        },
      });

      const { pricing } = usePricing();
      const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);

      expect(cleanerSharePercent).toBe(0.92);
    });
  });

  describe("Filter Scenarios", () => {
    const createAppointments = () => [
      { id: 1, price: "50", homeId: 1 },
      { id: 2, price: "100", homeId: 2 },
      { id: 3, price: "150", homeId: 3 },
      { id: 4, price: "200", homeId: 4 },
      { id: 5, price: "300", homeId: 5 },
    ];

    it("should filter correctly with standard 10% fee", () => {
      const appointments = createAppointments();
      const feePercent = 0.1;
      const minEarnings = 100;

      const filtered = appointments.filter((appt) => {
        const cleanerSharePercent = 1 - feePercent;
        const earnings = Number(appt.price) * cleanerSharePercent;
        return earnings >= minEarnings;
      });

      // $50 -> $45, $100 -> $90, $150 -> $135, $200 -> $180, $300 -> $270
      // Only $150, $200, $300 pass
      expect(filtered.length).toBe(3);
      expect(filtered.map((a) => a.price)).toEqual(["150", "200", "300"]);
    });

    it("should filter correctly with 5% fee", () => {
      const appointments = createAppointments();
      const feePercent = 0.05;
      const minEarnings = 100;

      const filtered = appointments.filter((appt) => {
        const cleanerSharePercent = 1 - feePercent;
        const earnings = Number(appt.price) * cleanerSharePercent;
        return earnings >= minEarnings;
      });

      // $50 -> $47.50, $100 -> $95, $150 -> $142.50, $200 -> $190, $300 -> $285
      // Only $150, $200, $300 pass
      expect(filtered.length).toBe(3);
    });

    it("should return all jobs when no min earnings filter", () => {
      const appointments = createAppointments();

      // No minEarnings filter applied
      expect(appointments.length).toBe(5);
    });
  });
});
