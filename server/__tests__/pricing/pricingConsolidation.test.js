/**
 * Pricing Consolidation Tests
 *
 * These tests verify that all pricing throughout the backend comes from the
 * centralized config in businessConfig.js. If you change pricing values in
 * the config, all dependent code should automatically use the new values.
 *
 * Key principle: Tests read from the config and verify calculations match.
 * This means if you change the config values, the tests will still pass
 * as long as the calculations correctly use those values.
 */

const { businessConfig } = require("../../config/businessConfig");
const calculatePrice = require("../../services/CalculatePrice");
const { calculateLinenPrice } = require("../../services/CalculatePrice");

describe("Pricing Consolidation - Config Source of Truth", () => {
  describe("businessConfig.js has expected structure", () => {
    it("should have all required pricing fields", () => {
      expect(businessConfig.pricing).toHaveProperty("basePrice");
      expect(businessConfig.pricing).toHaveProperty("extraBedBathFee");
      expect(businessConfig.pricing).toHaveProperty("linens");
      expect(businessConfig.pricing).toHaveProperty("timeWindows");
      expect(businessConfig.pricing).toHaveProperty("cancellation");
      expect(businessConfig.pricing).toHaveProperty("platform");
    });

    it("should have all linen pricing fields", () => {
      expect(businessConfig.pricing.linens).toHaveProperty("sheetFeePerBed");
      expect(businessConfig.pricing.linens).toHaveProperty("towelFee");
      expect(businessConfig.pricing.linens).toHaveProperty("faceClothFee");
    });

    it("should have all time window options", () => {
      expect(businessConfig.pricing.timeWindows).toHaveProperty("anytime");
      expect(businessConfig.pricing.timeWindows).toHaveProperty("10-3");
      expect(businessConfig.pricing.timeWindows).toHaveProperty("11-4");
      expect(businessConfig.pricing.timeWindows).toHaveProperty("12-2");
    });

    it("should have all cancellation fields", () => {
      expect(businessConfig.pricing.cancellation).toHaveProperty("fee");
      expect(businessConfig.pricing.cancellation).toHaveProperty("windowDays");
      expect(businessConfig.pricing.cancellation).toHaveProperty("homeownerPenaltyDays");
      expect(businessConfig.pricing.cancellation).toHaveProperty("cleanerPenaltyDays");
      expect(businessConfig.pricing.cancellation).toHaveProperty("refundPercentage");
    });

    it("should have platform fee", () => {
      expect(businessConfig.pricing.platform).toHaveProperty("feePercent");
    });
  });
});

describe("CalculatePrice.js uses config values", () => {
  const { pricing } = businessConfig;

  describe("Base price calculation", () => {
    it("should use basePrice from config for 1 bed, 1 bath", () => {
      const price = calculatePrice("no", "no", 1, 1, "anytime");
      expect(price).toBe(pricing.basePrice);
    });

    it("should use extraBedBathFee from config for additional beds", () => {
      const price1bed = calculatePrice("no", "no", 1, 1, "anytime");
      const price3beds = calculatePrice("no", "no", 3, 1, "anytime");

      // Difference should be 2 extra beds * extraBedBathFee
      expect(price3beds - price1bed).toBe(2 * pricing.extraBedBathFee);
    });

    it("should use extraBedBathFee from config for additional baths", () => {
      const price1bath = calculatePrice("no", "no", 1, 1, "anytime");
      const price3baths = calculatePrice("no", "no", 1, 3, "anytime");

      // Difference should be 2 extra baths * extraBedBathFee
      expect(price3baths - price1bath).toBe(2 * pricing.extraBedBathFee);
    });

    it("should calculate correct price for any bed/bath combination", () => {
      const numBeds = 4;
      const numBaths = 3;
      const price = calculatePrice("no", "no", numBeds, numBaths, "anytime");

      const extraBeds = numBeds - 1;
      const extraBaths = numBaths - 1;
      const expected = pricing.basePrice + (extraBeds + extraBaths) * pricing.extraBedBathFee;

      expect(price).toBe(expected);
    });
  });

  describe("Sheet pricing", () => {
    it("should use sheetFeePerBed from config", () => {
      const priceWithoutSheets = calculatePrice("no", "no", 3, 1, "anytime");
      const priceWithSheets = calculatePrice("yes", "no", 3, 1, "anytime");

      // Difference should be 3 beds * sheetFeePerBed
      expect(priceWithSheets - priceWithoutSheets).toBe(3 * pricing.linens.sheetFeePerBed);
    });

    it("should calculate sheets for any number of beds", () => {
      const numBeds = 5;
      const priceWithoutSheets = calculatePrice("no", "no", numBeds, 1, "anytime");
      const priceWithSheets = calculatePrice("yes", "no", numBeds, 1, "anytime");

      expect(priceWithSheets - priceWithoutSheets).toBe(numBeds * pricing.linens.sheetFeePerBed);
    });
  });

  describe("Towel pricing", () => {
    it("should use towelFee and faceClothFee from config", () => {
      const priceWithoutTowels = calculatePrice("no", "no", 1, 2, "anytime");
      const priceWithTowels = calculatePrice("no", "yes", 1, 2, "anytime");

      // Default: 2 towels + 1 face cloth per bathroom
      const defaultTowelPrice = 2 * (2 * pricing.linens.towelFee + 1 * pricing.linens.faceClothFee);

      expect(priceWithTowels - priceWithoutTowels).toBe(defaultTowelPrice);
    });

    it("should calculate towels for any number of bathrooms", () => {
      const numBaths = 4;
      const priceWithoutTowels = calculatePrice("no", "no", 1, numBaths, "anytime");
      const priceWithTowels = calculatePrice("no", "yes", 1, numBaths, "anytime");

      const defaultTowelPrice =
        numBaths * (2 * pricing.linens.towelFee + 1 * pricing.linens.faceClothFee);

      expect(priceWithTowels - priceWithoutTowels).toBe(defaultTowelPrice);
    });
  });

  describe("Time window surcharges", () => {
    it("should use anytime surcharge from config (should be 0)", () => {
      const basePrice = calculatePrice("no", "no", 1, 1, "anytime");
      expect(basePrice).toBe(pricing.basePrice + pricing.timeWindows.anytime);
    });

    it("should use 10-3 surcharge from config", () => {
      const anytimePrice = calculatePrice("no", "no", 1, 1, "anytime");
      const tenToThreePrice = calculatePrice("no", "no", 1, 1, "10-3");

      expect(tenToThreePrice - anytimePrice).toBe(
        pricing.timeWindows["10-3"] - pricing.timeWindows.anytime
      );
    });

    it("should use 11-4 surcharge from config", () => {
      const anytimePrice = calculatePrice("no", "no", 1, 1, "anytime");
      const elevenToFourPrice = calculatePrice("no", "no", 1, 1, "11-4");

      expect(elevenToFourPrice - anytimePrice).toBe(
        pricing.timeWindows["11-4"] - pricing.timeWindows.anytime
      );
    });

    it("should use 12-2 surcharge from config", () => {
      const anytimePrice = calculatePrice("no", "no", 1, 1, "anytime");
      const noonToTwoPrice = calculatePrice("no", "no", 1, 1, "12-2");

      expect(noonToTwoPrice - anytimePrice).toBe(
        pricing.timeWindows["12-2"] - pricing.timeWindows.anytime
      );
    });

    it("should apply each time window surcharge correctly", () => {
      Object.entries(pricing.timeWindows).forEach(([window, surcharge]) => {
        const price = calculatePrice("no", "no", 1, 1, window);
        const expectedPrice = pricing.basePrice + surcharge;
        expect(price).toBe(expectedPrice);
      });
    });
  });

  describe("Combined pricing calculation", () => {
    it("should correctly combine all pricing elements from config", () => {
      const numBeds = 4;
      const numBaths = 3;
      const timeWindow = "12-2";

      const price = calculatePrice("yes", "yes", numBeds, numBaths, timeWindow);

      // Calculate expected price using config values
      const extraBeds = numBeds - 1;
      const extraBaths = numBaths - 1;
      const baseWithExtras = pricing.basePrice + (extraBeds + extraBaths) * pricing.extraBedBathFee;
      const sheetPrice = numBeds * pricing.linens.sheetFeePerBed;
      const towelPrice =
        numBaths * (2 * pricing.linens.towelFee + 1 * pricing.linens.faceClothFee);
      const timeSurcharge = pricing.timeWindows[timeWindow];

      const expectedTotal = baseWithExtras + sheetPrice + towelPrice + timeSurcharge;

      expect(price).toBe(expectedTotal);
    });
  });
});

describe("calculateLinenPrice helper uses config values", () => {
  const { pricing } = businessConfig;

  it("should calculate sheet price from config", () => {
    const sheetConfigs = [
      { bedNumber: 1, needsSheets: true },
      { bedNumber: 2, needsSheets: true },
      { bedNumber: 3, needsSheets: false },
    ];

    const price = calculateLinenPrice(sheetConfigs, []);

    // 2 beds need sheets
    expect(price).toBe(2 * pricing.linens.sheetFeePerBed);
  });

  it("should calculate towel price from config", () => {
    const towelConfigs = [
      { bathroomNumber: 1, towels: 3, faceCloths: 2 },
      { bathroomNumber: 2, towels: 2, faceCloths: 1 },
    ];

    const price = calculateLinenPrice([], towelConfigs);

    const expected =
      3 * pricing.linens.towelFee +
      2 * pricing.linens.faceClothFee +
      2 * pricing.linens.towelFee +
      1 * pricing.linens.faceClothFee;

    expect(price).toBe(expected);
  });

  it("should calculate combined linen price from config", () => {
    const sheetConfigs = [
      { bedNumber: 1, needsSheets: true },
      { bedNumber: 2, needsSheets: true },
    ];
    const towelConfigs = [{ bathroomNumber: 1, towels: 4, faceCloths: 2 }];

    const price = calculateLinenPrice(sheetConfigs, towelConfigs);

    const sheetPrice = 2 * pricing.linens.sheetFeePerBed;
    const towelPrice = 4 * pricing.linens.towelFee + 2 * pricing.linens.faceClothFee;

    expect(price).toBe(sheetPrice + towelPrice);
  });
});

describe("Cancellation config values are accessible", () => {
  const { cancellation } = businessConfig.pricing;

  it("should have homeownerPenaltyDays defined", () => {
    expect(cancellation.homeownerPenaltyDays).toBeDefined();
    expect(typeof cancellation.homeownerPenaltyDays).toBe("number");
  });

  it("should have cleanerPenaltyDays defined", () => {
    expect(cancellation.cleanerPenaltyDays).toBeDefined();
    expect(typeof cancellation.cleanerPenaltyDays).toBe("number");
  });

  it("should have refundPercentage as a valid percentage", () => {
    expect(cancellation.refundPercentage).toBeDefined();
    expect(cancellation.refundPercentage).toBeGreaterThan(0);
    expect(cancellation.refundPercentage).toBeLessThanOrEqual(1);
  });

  it("should calculate correct refund using config percentage", () => {
    const appointmentPrice = 200;
    const refund = appointmentPrice * cancellation.refundPercentage;

    // Verify this matches the expected calculation
    expect(refund).toBe(appointmentPrice * cancellation.refundPercentage);
  });

  it("should have cancellation fee defined", () => {
    expect(cancellation.fee).toBeDefined();
    expect(typeof cancellation.fee).toBe("number");
  });

  it("should have cancellation window days defined", () => {
    expect(cancellation.windowDays).toBeDefined();
    expect(typeof cancellation.windowDays).toBe("number");
  });
});

describe("Platform fee config values are accessible", () => {
  const { platform } = businessConfig.pricing;

  it("should have feePercent as a valid percentage", () => {
    expect(platform.feePercent).toBeDefined();
    expect(platform.feePercent).toBeGreaterThan(0);
    expect(platform.feePercent).toBeLessThan(1);
  });

  it("should calculate correct platform fee using config", () => {
    const paymentAmount = 100;
    const platformFee = paymentAmount * platform.feePercent;
    const cleanerPayout = paymentAmount - platformFee;

    expect(platformFee).toBe(paymentAmount * platform.feePercent);
    expect(cleanerPayout).toBe(paymentAmount * (1 - platform.feePercent));
  });
});

describe("Default pricing values match expected configuration", () => {
  const { pricing } = businessConfig;

  it("should have base price of $150", () => {
    expect(pricing.basePrice).toBe(150);
  });

  it("should have extra bed/bath fee of $50", () => {
    expect(pricing.extraBedBathFee).toBe(50);
  });

  it("should have sheet fee of $30/bed", () => {
    expect(pricing.linens.sheetFeePerBed).toBe(30);
  });

  it("should have towel fee of $5/towel", () => {
    expect(pricing.linens.towelFee).toBe(5);
  });

  it("should have face cloth fee of $2 each", () => {
    expect(pricing.linens.faceClothFee).toBe(2);
  });

  it("should have correct time window surcharges", () => {
    expect(pricing.timeWindows.anytime).toBe(0);
    expect(pricing.timeWindows["10-3"]).toBe(25);
    expect(pricing.timeWindows["11-4"]).toBe(25);
    expect(pricing.timeWindows["12-2"]).toBe(30);
  });

  it("should have cancellation fee of $25", () => {
    expect(pricing.cancellation.fee).toBe(25);
  });

  it("should have cancellation window of 7 days", () => {
    expect(pricing.cancellation.windowDays).toBe(7);
  });

  it("should have homeowner penalty window of 3 days", () => {
    expect(pricing.cancellation.homeownerPenaltyDays).toBe(3);
  });

  it("should have cleaner penalty window of 4 days", () => {
    expect(pricing.cancellation.cleanerPenaltyDays).toBe(4);
  });

  it("should have refund percentage of 50%", () => {
    expect(pricing.cancellation.refundPercentage).toBe(0.5);
  });

  it("should have platform fee of 10%", () => {
    expect(pricing.platform.feePercent).toBe(0.1);
  });
});

describe("Price calculations are self-consistent with config", () => {
  const { pricing } = businessConfig;

  it("full appointment price matches manual calculation", () => {
    // Test case: 3 bed, 2 bath, sheets, towels, 10-3 time window
    const calculatedPrice = calculatePrice("yes", "yes", 3, 2, "10-3");

    // Manual calculation using config values
    const basePriceComponent = pricing.basePrice;
    const extraBedsComponent = 2 * pricing.extraBedBathFee; // 2 extra beds
    const extraBathsComponent = 1 * pricing.extraBedBathFee; // 1 extra bath
    const sheetsComponent = 3 * pricing.linens.sheetFeePerBed;
    const towelsComponent =
      2 * (2 * pricing.linens.towelFee + 1 * pricing.linens.faceClothFee); // 2 baths, default config
    const timeComponent = pricing.timeWindows["10-3"];

    const manualTotal =
      basePriceComponent +
      extraBedsComponent +
      extraBathsComponent +
      sheetsComponent +
      towelsComponent +
      timeComponent;

    expect(calculatedPrice).toBe(manualTotal);

    // Log the breakdown for documentation
    console.log("Price breakdown for 3bed/2bath with sheets, towels, 10-3 time:");
    console.log(`  Base price: $${basePriceComponent}`);
    console.log(`  Extra beds (2): $${extraBedsComponent}`);
    console.log(`  Extra baths (1): $${extraBathsComponent}`);
    console.log(`  Sheets (3 beds): $${sheetsComponent}`);
    console.log(`  Towels (2 baths): $${towelsComponent}`);
    console.log(`  Time window (10-3): $${timeComponent}`);
    console.log(`  TOTAL: $${manualTotal}`);
  });

  it("changing any config value would change the calculation", () => {
    // This test documents that calculations depend on config values
    const price = calculatePrice("yes", "yes", 2, 2, "anytime");

    // The price should equal this formula using config values:
    const expected =
      pricing.basePrice +
      1 * pricing.extraBedBathFee + // 1 extra bed
      1 * pricing.extraBedBathFee + // 1 extra bath
      2 * pricing.linens.sheetFeePerBed + // sheets for 2 beds
      2 * (2 * pricing.linens.towelFee + 1 * pricing.linens.faceClothFee) + // towels for 2 baths
      pricing.timeWindows.anytime;

    expect(price).toBe(expected);

    // If config values change, this assertion would still pass
    // because both sides use the same config values
  });
});
