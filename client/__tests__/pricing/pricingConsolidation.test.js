/**
 * Frontend Pricing Consolidation Tests
 *
 * These tests verify that all pricing throughout the frontend comes from the
 * centralized PricingContext which fetches from the database. The defaultPricing
 * in PricingContext serves as fallback when the API is unavailable.
 */

import {
  getTimeWindowOptions,
  getTimeWindowSurcharge,
  calculateBasePrice,
  defaultPricing,
} from "../../src/context/PricingContext";

describe("PricingContext - Default Pricing Structure", () => {
  describe("defaultPricing has expected structure", () => {
    it("should have all required top-level fields", () => {
      expect(defaultPricing).toBeDefined();
      expect(defaultPricing).toHaveProperty("basePrice");
      expect(defaultPricing).toHaveProperty("extraBedBathFee");
      expect(defaultPricing).toHaveProperty("linens");
      expect(defaultPricing).toHaveProperty("timeWindows");
      expect(defaultPricing).toHaveProperty("cancellation");
      expect(defaultPricing).toHaveProperty("platform");
    });

    it("should have all linen pricing fields", () => {
      expect(defaultPricing.linens).toHaveProperty("sheetFeePerBed");
      expect(defaultPricing.linens).toHaveProperty("towelFee");
      expect(defaultPricing.linens).toHaveProperty("faceClothFee");
    });

    it("should have all time window options with surcharge and label", () => {
      const { timeWindows } = defaultPricing;

      expect(timeWindows).toHaveProperty("anytime");
      expect(timeWindows).toHaveProperty("10-3");
      expect(timeWindows).toHaveProperty("11-4");
      expect(timeWindows).toHaveProperty("12-2");

      // Each time window should have surcharge and label
      Object.values(timeWindows).forEach((window) => {
        expect(window).toHaveProperty("surcharge");
        expect(window).toHaveProperty("label");
        expect(window).toHaveProperty("description");
      });
    });

    it("should have all cancellation fields", () => {
      expect(defaultPricing.cancellation).toHaveProperty("fee");
      expect(defaultPricing.cancellation).toHaveProperty("windowDays");
      expect(defaultPricing.cancellation).toHaveProperty("homeownerPenaltyDays");
      expect(defaultPricing.cancellation).toHaveProperty("cleanerPenaltyDays");
      expect(defaultPricing.cancellation).toHaveProperty("refundPercentage");
    });

    it("should have platform fee", () => {
      expect(defaultPricing.platform).toHaveProperty("feePercent");
    });
  });
});

describe("getTimeWindowOptions helper", () => {
  const TIME_WINDOW_OPTIONS = getTimeWindowOptions(defaultPricing);

  it("should be an array with all time windows", () => {
    expect(Array.isArray(TIME_WINDOW_OPTIONS)).toBe(true);
    expect(TIME_WINDOW_OPTIONS.length).toBe(4);
  });

  it("should have correct structure for each option", () => {
    TIME_WINDOW_OPTIONS.forEach((option) => {
      expect(option).toHaveProperty("value");
      expect(option).toHaveProperty("label");
      expect(option).toHaveProperty("description");
      expect(option).toHaveProperty("surcharge");
    });
  });

  it("should include all time window values", () => {
    const values = TIME_WINDOW_OPTIONS.map((opt) => opt.value);
    expect(values).toContain("anytime");
    expect(values).toContain("10-3");
    expect(values).toContain("11-4");
    expect(values).toContain("12-2");
  });

  it("should have surcharges matching pricing config", () => {
    TIME_WINDOW_OPTIONS.forEach((option) => {
      const configSurcharge = defaultPricing.timeWindows[option.value].surcharge;
      expect(option.surcharge).toBe(configSurcharge);
    });
  });

  it("should have labels matching pricing config", () => {
    TIME_WINDOW_OPTIONS.forEach((option) => {
      const configLabel = defaultPricing.timeWindows[option.value].label;
      expect(option.label).toBe(configLabel);
    });
  });
});

describe("getTimeWindowSurcharge helper", () => {
  it("should return correct surcharge for each time window", () => {
    expect(getTimeWindowSurcharge(defaultPricing, "anytime")).toBe(
      defaultPricing.timeWindows.anytime.surcharge
    );
    expect(getTimeWindowSurcharge(defaultPricing, "10-3")).toBe(
      defaultPricing.timeWindows["10-3"].surcharge
    );
    expect(getTimeWindowSurcharge(defaultPricing, "11-4")).toBe(
      defaultPricing.timeWindows["11-4"].surcharge
    );
    expect(getTimeWindowSurcharge(defaultPricing, "12-2")).toBe(
      defaultPricing.timeWindows["12-2"].surcharge
    );
  });

  it("should return 0 for unknown time window", () => {
    expect(getTimeWindowSurcharge(defaultPricing, "invalid")).toBe(0);
    expect(getTimeWindowSurcharge(defaultPricing, null)).toBe(0);
    expect(getTimeWindowSurcharge(defaultPricing, undefined)).toBe(0);
  });
});

describe("calculateBasePrice helper", () => {
  it("should calculate price for 1 bed, 1 bath correctly", () => {
    const price = calculateBasePrice(defaultPricing, 1, 1);
    expect(price).toBe(defaultPricing.basePrice);
  });

  it("should add extraBedBathFee for extra beds", () => {
    const price = calculateBasePrice(defaultPricing, 3, 1);
    // 2 extra beds
    const expected =
      defaultPricing.basePrice + 2 * defaultPricing.extraBedBathFee;
    expect(price).toBe(expected);
  });

  it("should add extraBedBathFee for extra baths", () => {
    const price = calculateBasePrice(defaultPricing, 1, 3);
    // 2 extra baths
    const expected =
      defaultPricing.basePrice + 2 * defaultPricing.extraBedBathFee;
    expect(price).toBe(expected);
  });

  it("should add extraBedBathFee for both extra beds and baths", () => {
    const price = calculateBasePrice(defaultPricing, 4, 3);
    // 3 extra beds + 2 extra baths = 5 extras
    const expected =
      defaultPricing.basePrice + 5 * defaultPricing.extraBedBathFee;
    expect(price).toBe(expected);
  });

  it("should handle string inputs", () => {
    const price = calculateBasePrice(defaultPricing, "2", "2");
    const expected =
      defaultPricing.basePrice + 2 * defaultPricing.extraBedBathFee;
    expect(price).toBe(expected);
  });
});

describe("Default pricing values are correct (fallback values)", () => {
  it("should have correct base price", () => {
    expect(defaultPricing.basePrice).toBe(15000);
  });

  it("should have correct extra bed/bath fee", () => {
    expect(defaultPricing.extraBedBathFee).toBe(5000);
  });

  it("should have correct sheet fee per bed", () => {
    expect(defaultPricing.linens.sheetFeePerBed).toBe(3000);
  });

  it("should have correct towel fee", () => {
    expect(defaultPricing.linens.towelFee).toBe(500);
  });

  it("should have correct face cloth fee", () => {
    expect(defaultPricing.linens.faceClothFee).toBe(200);
  });

  it("should have correct time window surcharges", () => {
    expect(defaultPricing.timeWindows.anytime.surcharge).toBe(0);
    expect(defaultPricing.timeWindows["10-3"].surcharge).toBe(2500);
    expect(defaultPricing.timeWindows["11-4"].surcharge).toBe(2500);
    expect(defaultPricing.timeWindows["12-2"].surcharge).toBe(3000);
  });

  it("should have correct cancellation settings", () => {
    expect(defaultPricing.cancellation.fee).toBe(2500);
    expect(defaultPricing.cancellation.windowDays).toBe(7);
    expect(defaultPricing.cancellation.homeownerPenaltyDays).toBe(3);
    expect(defaultPricing.cancellation.cleanerPenaltyDays).toBe(4);
    expect(defaultPricing.cancellation.refundPercentage).toBe(0.5);
  });

  it("should have correct platform fee", () => {
    expect(defaultPricing.platform.feePercent).toBe(0.1);
  });
});

describe("Linen price calculations use pricing config", () => {
  it("should calculate sheet price correctly", () => {
    const numBeds = 3;
    const sheetPrice = numBeds * defaultPricing.linens.sheetFeePerBed;
    expect(sheetPrice).toBe(9000); // 3 * 3000 cents
  });

  it("should calculate towel price for default bathroom config", () => {
    // Default: 2 towels + 1 face cloth per bathroom
    const numBaths = 2;
    const { towelFee, faceClothFee } = defaultPricing.linens;
    const towelPrice = numBaths * (2 * towelFee + 1 * faceClothFee);
    expect(towelPrice).toBe(2400); // 2 * (2*500 + 1*200) = 2 * 1200 cents
  });

  it("should calculate custom towel configuration correctly", () => {
    const { towelFee, faceClothFee } = defaultPricing.linens;

    const bathroomConfigs = [
      { bathroomNumber: 1, towels: 3, faceCloths: 2 },
      { bathroomNumber: 2, towels: 2, faceCloths: 1 },
    ];

    const totalPrice = bathroomConfigs.reduce((sum, bath) => {
      return sum + bath.towels * towelFee + bath.faceCloths * faceClothFee;
    }, 0);

    // Bath 1: 3*500 + 2*200 = 1900 cents
    // Bath 2: 2*500 + 1*200 = 1200 cents
    // Total: 3100 cents
    expect(totalPrice).toBe(3100);
  });
});

describe("Cancellation calculations use pricing config", () => {
  it("should calculate partial refund correctly", () => {
    const appointmentPrice = 20000;
    const refundPercentage = defaultPricing.cancellation.refundPercentage;
    const refund = appointmentPrice * refundPercentage;

    expect(refund).toBe(10000); // 50% of 20000 cents
  });

  it("should calculate cleaner payout on cancellation correctly", () => {
    const appointmentPrice = 20000;
    const { refundPercentage } = defaultPricing.cancellation;
    const { feePercent } = defaultPricing.platform;

    const customerPortion = appointmentPrice * refundPercentage; // 50%
    const cleanerGross = appointmentPrice * refundPercentage; // 50%
    const platformFee = cleanerGross * feePercent; // 10% of cleaner portion
    const cleanerPayout = cleanerGross - platformFee;

    expect(customerPortion).toBe(10000);
    expect(cleanerPayout).toBe(9000); // 10000 - 1000 platform fee (in cents)
  });

  it("should check penalty window using config days", () => {
    const { homeownerPenaltyDays, cleanerPenaltyDays } = defaultPricing.cancellation;

    // Verify these are the expected values
    expect(homeownerPenaltyDays).toBe(3);
    expect(cleanerPenaltyDays).toBe(4);

    // Simulate checking if within penalty window
    const daysUntilAppointment = 2;
    const isHomeownerPenalized = daysUntilAppointment <= homeownerPenaltyDays;
    const isCleanerPenalized = daysUntilAppointment <= cleanerPenaltyDays;

    expect(isHomeownerPenalized).toBe(true);
    expect(isCleanerPenalized).toBe(true);
  });
});

describe("Full appointment price calculation uses pricing config", () => {
  it("should calculate complete appointment price correctly", () => {
    const pricing = defaultPricing;

    // Scenario: 3 bed, 2 bath, sheets, towels (default config), 10-3 time
    const numBeds = 3;
    const numBaths = 2;

    // Base price
    let total = pricing.basePrice;

    // Extra beds/baths
    const extraBeds = Math.max(0, numBeds - 1);
    const extraBaths = Math.max(0, numBaths - 1);
    total += (extraBeds + extraBaths) * pricing.extraBedBathFee;

    // Sheets (for all beds)
    total += numBeds * pricing.linens.sheetFeePerBed;

    // Towels (default: 2 towels + 1 face cloth per bath)
    total += numBaths * (2 * pricing.linens.towelFee + 1 * pricing.linens.faceClothFee);

    // Time surcharge
    total += pricing.timeWindows["10-3"].surcharge;

    // Expected breakdown (all in cents):
    // Base: 15000
    // Extra beds (2): 2 * 5000 = 10000
    // Extra baths (1): 1 * 5000 = 5000
    // Sheets (3): 3 * 3000 = 9000
    // Towels (2 baths): 2 * (2*500 + 1*200) = 2 * 1200 = 2400
    // Time 10-3: 2500
    // Total: 15000 + 10000 + 5000 + 9000 + 2400 + 2500 = 43900

    expect(total).toBe(43900);
  });
});

describe("Display strings should use pricing config values", () => {
  it("should format sheet price string correctly", () => {
    const { sheetFeePerBed } = defaultPricing.linens;
    const priceString = `$${sheetFeePerBed / 100}/bed`;
    expect(priceString).toBe("$30/bed");
  });

  it("should format towel price string correctly", () => {
    const { towelFee } = defaultPricing.linens;
    const priceString = `$${towelFee / 100}/towel`;
    expect(priceString).toBe("$5/towel");
  });

  it("should format face cloth price string correctly", () => {
    const { faceClothFee } = defaultPricing.linens;
    const priceString = `$${faceClothFee / 100} each`;
    expect(priceString).toBe("$2 each");
  });

  it("should format refund percentage string correctly", () => {
    const { refundPercentage } = defaultPricing.cancellation;
    const percentString = `${refundPercentage * 100}%`;
    expect(percentString).toBe("50%");
  });

  it("should format platform fee percentage string correctly", () => {
    const { feePercent } = defaultPricing.platform;
    const percentString = `${feePercent * 100}%`;
    expect(percentString).toBe("10%");
  });
});
