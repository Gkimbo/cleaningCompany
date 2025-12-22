/**
 * Frontend Pricing Consolidation Tests
 *
 * These tests verify that all pricing throughout the frontend comes from the
 * centralized config in companyInfo.js. If you change pricing values in
 * the config, all dependent code should automatically use the new values.
 */

import {
  cleaningCompany,
  TIME_WINDOW_OPTIONS,
  getTimeWindowSurcharge,
  calculateBasePrice,
} from "../../src/services/data/companyInfo";

describe("Frontend Pricing Consolidation - Config Source of Truth", () => {
  describe("companyInfo.js has expected structure", () => {
    it("should have pricing object with all required fields", () => {
      expect(cleaningCompany.pricing).toBeDefined();
      expect(cleaningCompany.pricing).toHaveProperty("basePrice");
      expect(cleaningCompany.pricing).toHaveProperty("extraBedBathFee");
      expect(cleaningCompany.pricing).toHaveProperty("linens");
      expect(cleaningCompany.pricing).toHaveProperty("timeWindows");
      expect(cleaningCompany.pricing).toHaveProperty("cancellation");
      expect(cleaningCompany.pricing).toHaveProperty("platform");
    });

    it("should have all linen pricing fields", () => {
      expect(cleaningCompany.pricing.linens).toHaveProperty("sheetFeePerBed");
      expect(cleaningCompany.pricing.linens).toHaveProperty("towelFee");
      expect(cleaningCompany.pricing.linens).toHaveProperty("faceClothFee");
    });

    it("should have all time window options with surcharge and label", () => {
      const { timeWindows } = cleaningCompany.pricing;

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
      expect(cleaningCompany.pricing.cancellation).toHaveProperty("fee");
      expect(cleaningCompany.pricing.cancellation).toHaveProperty("windowDays");
      expect(cleaningCompany.pricing.cancellation).toHaveProperty("homeownerPenaltyDays");
      expect(cleaningCompany.pricing.cancellation).toHaveProperty("cleanerPenaltyDays");
      expect(cleaningCompany.pricing.cancellation).toHaveProperty("refundPercentage");
    });

    it("should have platform fee", () => {
      expect(cleaningCompany.pricing.platform).toHaveProperty("feePercent");
    });
  });

  describe("Backward-compatible getters work correctly", () => {
    it("basePrice getter returns pricing.basePrice", () => {
      expect(cleaningCompany.basePrice).toBe(cleaningCompany.pricing.basePrice);
    });

    it("extraBedBathFee getter returns pricing.extraBedBathFee", () => {
      expect(cleaningCompany.extraBedBathFee).toBe(cleaningCompany.pricing.extraBedBathFee);
    });

    it("sheetFeePerBed getter returns pricing.linens.sheetFeePerBed", () => {
      expect(cleaningCompany.sheetFeePerBed).toBe(cleaningCompany.pricing.linens.sheetFeePerBed);
    });

    it("towelFee getter returns pricing.linens.towelFee", () => {
      expect(cleaningCompany.towelFee).toBe(cleaningCompany.pricing.linens.towelFee);
    });

    it("faceClothFee getter returns pricing.linens.faceClothFee", () => {
      expect(cleaningCompany.faceClothFee).toBe(cleaningCompany.pricing.linens.faceClothFee);
    });

    it("cancellationFee getter returns pricing.cancellation.fee", () => {
      expect(cleaningCompany.cancellationFee).toBe(cleaningCompany.pricing.cancellation.fee);
    });
  });
});

describe("TIME_WINDOW_OPTIONS helper", () => {
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

  it("should have surcharges matching config", () => {
    TIME_WINDOW_OPTIONS.forEach((option) => {
      const configSurcharge = cleaningCompany.pricing.timeWindows[option.value].surcharge;
      expect(option.surcharge).toBe(configSurcharge);
    });
  });

  it("should have labels matching config", () => {
    TIME_WINDOW_OPTIONS.forEach((option) => {
      const configLabel = cleaningCompany.pricing.timeWindows[option.value].label;
      expect(option.label).toBe(configLabel);
    });
  });
});

describe("getTimeWindowSurcharge helper", () => {
  it("should return correct surcharge for each time window", () => {
    expect(getTimeWindowSurcharge("anytime")).toBe(
      cleaningCompany.pricing.timeWindows.anytime.surcharge
    );
    expect(getTimeWindowSurcharge("10-3")).toBe(
      cleaningCompany.pricing.timeWindows["10-3"].surcharge
    );
    expect(getTimeWindowSurcharge("11-4")).toBe(
      cleaningCompany.pricing.timeWindows["11-4"].surcharge
    );
    expect(getTimeWindowSurcharge("12-2")).toBe(
      cleaningCompany.pricing.timeWindows["12-2"].surcharge
    );
  });

  it("should return 0 for unknown time window", () => {
    expect(getTimeWindowSurcharge("invalid")).toBe(0);
    expect(getTimeWindowSurcharge(null)).toBe(0);
    expect(getTimeWindowSurcharge(undefined)).toBe(0);
  });
});

describe("calculateBasePrice helper", () => {
  it("should calculate price for 1 bed, 1 bath correctly", () => {
    const price = calculateBasePrice(1, 1);
    expect(price).toBe(cleaningCompany.pricing.basePrice);
  });

  it("should add extraBedBathFee for extra beds", () => {
    const price = calculateBasePrice(3, 1);
    // 2 extra beds
    const expected =
      cleaningCompany.pricing.basePrice + 2 * cleaningCompany.pricing.extraBedBathFee;
    expect(price).toBe(expected);
  });

  it("should add extraBedBathFee for extra baths", () => {
    const price = calculateBasePrice(1, 3);
    // 2 extra baths
    const expected =
      cleaningCompany.pricing.basePrice + 2 * cleaningCompany.pricing.extraBedBathFee;
    expect(price).toBe(expected);
  });

  it("should add extraBedBathFee for both extra beds and baths", () => {
    const price = calculateBasePrice(4, 3);
    // 3 extra beds + 2 extra baths = 5 extras
    const expected =
      cleaningCompany.pricing.basePrice + 5 * cleaningCompany.pricing.extraBedBathFee;
    expect(price).toBe(expected);
  });

  it("should handle string inputs", () => {
    const price = calculateBasePrice("2", "2");
    const expected =
      cleaningCompany.pricing.basePrice + 2 * cleaningCompany.pricing.extraBedBathFee;
    expect(price).toBe(expected);
  });
});

describe("Default pricing values are correct", () => {
  it("should have correct base price", () => {
    expect(cleaningCompany.pricing.basePrice).toBe(150);
  });

  it("should have correct extra bed/bath fee", () => {
    expect(cleaningCompany.pricing.extraBedBathFee).toBe(50);
  });

  it("should have correct sheet fee per bed", () => {
    expect(cleaningCompany.pricing.linens.sheetFeePerBed).toBe(30);
  });

  it("should have correct towel fee", () => {
    expect(cleaningCompany.pricing.linens.towelFee).toBe(5);
  });

  it("should have correct face cloth fee", () => {
    expect(cleaningCompany.pricing.linens.faceClothFee).toBe(2);
  });

  it("should have correct time window surcharges", () => {
    expect(cleaningCompany.pricing.timeWindows.anytime.surcharge).toBe(0);
    expect(cleaningCompany.pricing.timeWindows["10-3"].surcharge).toBe(25);
    expect(cleaningCompany.pricing.timeWindows["11-4"].surcharge).toBe(25);
    expect(cleaningCompany.pricing.timeWindows["12-2"].surcharge).toBe(30);
  });

  it("should have correct cancellation settings", () => {
    expect(cleaningCompany.pricing.cancellation.fee).toBe(25);
    expect(cleaningCompany.pricing.cancellation.windowDays).toBe(7);
    expect(cleaningCompany.pricing.cancellation.homeownerPenaltyDays).toBe(3);
    expect(cleaningCompany.pricing.cancellation.cleanerPenaltyDays).toBe(4);
    expect(cleaningCompany.pricing.cancellation.refundPercentage).toBe(0.5);
  });

  it("should have correct platform fee", () => {
    expect(cleaningCompany.pricing.platform.feePercent).toBe(0.1);
  });
});

describe("Linen price calculations use config", () => {
  it("should calculate sheet price correctly", () => {
    const numBeds = 3;
    const sheetPrice = numBeds * cleaningCompany.pricing.linens.sheetFeePerBed;
    expect(sheetPrice).toBe(90); // 3 * $30
  });

  it("should calculate towel price for default bathroom config", () => {
    // Default: 2 towels + 1 face cloth per bathroom
    const numBaths = 2;
    const { towelFee, faceClothFee } = cleaningCompany.pricing.linens;
    const towelPrice = numBaths * (2 * towelFee + 1 * faceClothFee);
    expect(towelPrice).toBe(24); // 2 * (2*$5 + 1*$2) = 2 * $12
  });

  it("should calculate custom towel configuration correctly", () => {
    const { towelFee, faceClothFee } = cleaningCompany.pricing.linens;

    const bathroomConfigs = [
      { bathroomNumber: 1, towels: 3, faceCloths: 2 },
      { bathroomNumber: 2, towels: 2, faceCloths: 1 },
    ];

    const totalPrice = bathroomConfigs.reduce((sum, bath) => {
      return sum + bath.towels * towelFee + bath.faceCloths * faceClothFee;
    }, 0);

    // Bath 1: 3*$5 + 2*$2 = $19
    // Bath 2: 2*$5 + 1*$2 = $12
    // Total: $31
    expect(totalPrice).toBe(31);
  });
});

describe("Cancellation calculations use config", () => {
  it("should calculate partial refund correctly", () => {
    const appointmentPrice = 200;
    const refundPercentage = cleaningCompany.pricing.cancellation.refundPercentage;
    const refund = appointmentPrice * refundPercentage;

    expect(refund).toBe(100); // 50% of $200
  });

  it("should calculate cleaner payout on cancellation correctly", () => {
    const appointmentPrice = 200;
    const { refundPercentage } = cleaningCompany.pricing.cancellation;
    const { feePercent } = cleaningCompany.pricing.platform;

    const customerPortion = appointmentPrice * refundPercentage; // 50%
    const cleanerGross = appointmentPrice * refundPercentage; // 50%
    const platformFee = cleanerGross * feePercent; // 10% of cleaner portion
    const cleanerPayout = cleanerGross - platformFee;

    expect(customerPortion).toBe(100);
    expect(cleanerPayout).toBe(90); // $100 - $10 platform fee
  });

  it("should check penalty window using config days", () => {
    const { homeownerPenaltyDays, cleanerPenaltyDays } = cleaningCompany.pricing.cancellation;

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

describe("Full appointment price calculation uses config", () => {
  it("should calculate complete appointment price correctly", () => {
    const { pricing } = cleaningCompany;

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

    // Expected breakdown:
    // Base: $150
    // Extra beds (2): 2 * $50 = $100
    // Extra baths (1): 1 * $50 = $50
    // Sheets (3): 3 * $30 = $90
    // Towels (2 baths): 2 * (2*$5 + 1*$2) = 2 * $12 = $24
    // Time 10-3: $25
    // Total: $150 + $100 + $50 + $90 + $24 + $25 = $439

    expect(total).toBe(439);
  });
});

describe("Display strings should use config values", () => {
  it("should format sheet price string correctly", () => {
    const { sheetFeePerBed } = cleaningCompany.pricing.linens;
    const priceString = `$${sheetFeePerBed}/bed`;
    expect(priceString).toBe("$30/bed");
  });

  it("should format towel price string correctly", () => {
    const { towelFee } = cleaningCompany.pricing.linens;
    const priceString = `$${towelFee}/towel`;
    expect(priceString).toBe("$5/towel");
  });

  it("should format face cloth price string correctly", () => {
    const { faceClothFee } = cleaningCompany.pricing.linens;
    const priceString = `$${faceClothFee} each`;
    expect(priceString).toBe("$2 each");
  });

  it("should format refund percentage string correctly", () => {
    const { refundPercentage } = cleaningCompany.pricing.cancellation;
    const percentString = `${refundPercentage * 100}%`;
    expect(percentString).toBe("50%");
  });

  it("should format platform fee percentage string correctly", () => {
    const { feePercent } = cleaningCompany.pricing.platform;
    const percentString = `${feePercent * 100}%`;
    expect(percentString).toBe("10%");
  });
});
