/**
 * Payout Model Tests
 *
 * Tests the Payout model's calculateSplit helper function
 * which calculates platform fee and cleaner payout amounts.
 */

const { businessConfig } = require("../../config/businessConfig");

// Mock Sequelize
const mockDefine = jest.fn((name, schema) => {
  const Model = {
    name,
    schema,
    associate: null,
    calculateSplit: null,
  };
  return Model;
});

const mockSequelize = {
  define: mockDefine,
};

const DataTypes = {
  INTEGER: "INTEGER",
  STRING: "STRING",
  DATE: "DATE",
  TEXT: "TEXT",
};

// Import the model factory
const PayoutFactory = require("../../models/Payout");

describe("Payout Model", () => {
  let Payout;

  beforeEach(() => {
    jest.clearAllMocks();
    Payout = PayoutFactory(mockSequelize, DataTypes);
  });

  describe("calculateSplit helper function", () => {
    it("should be defined on the model", () => {
      expect(Payout.calculateSplit).toBeDefined();
      expect(typeof Payout.calculateSplit).toBe("function");
    });

    it("should calculate correct split with default fee (10%)", () => {
      const grossAmount = 10000; // $100.00 in cents
      const result = Payout.calculateSplit(grossAmount);

      expect(result.platformFee).toBe(1000); // $10.00
      expect(result.netAmount).toBe(9000); // $90.00
    });

    it("should calculate correct split with custom fee percentage", () => {
      const grossAmount = 10000; // $100.00 in cents
      const feePercent = 0.15; // 15%
      const result = Payout.calculateSplit(grossAmount, feePercent);

      expect(result.platformFee).toBe(1500); // $15.00
      expect(result.netAmount).toBe(8500); // $85.00
    });

    it("should use businessConfig feePercent when passed", () => {
      const grossAmount = 20000; // $200.00 in cents
      const feePercent = businessConfig.pricing.platform.feePercent;
      const result = Payout.calculateSplit(grossAmount, feePercent);

      const expectedFee = Math.round(grossAmount * feePercent);
      const expectedNet = grossAmount - expectedFee;

      expect(result.platformFee).toBe(expectedFee);
      expect(result.netAmount).toBe(expectedNet);
    });

    it("should handle zero amount", () => {
      const result = Payout.calculateSplit(0);

      expect(result.platformFee).toBe(0);
      expect(result.netAmount).toBe(0);
    });

    it("should handle small amounts correctly with rounding", () => {
      const grossAmount = 99; // $0.99 in cents
      const result = Payout.calculateSplit(grossAmount);

      // 99 * 0.10 = 9.9, rounded to 10
      expect(result.platformFee).toBe(10);
      expect(result.netAmount).toBe(89);
    });

    it("should handle large amounts", () => {
      const grossAmount = 50000000; // $500,000.00 in cents
      const result = Payout.calculateSplit(grossAmount);

      expect(result.platformFee).toBe(5000000); // $50,000.00
      expect(result.netAmount).toBe(45000000); // $450,000.00
    });

    it("should maintain platformFee + netAmount = grossAmount", () => {
      const testAmounts = [100, 999, 1000, 5555, 10000, 15000, 25000];

      testAmounts.forEach(grossAmount => {
        const result = Payout.calculateSplit(grossAmount);
        expect(result.platformFee + result.netAmount).toBe(grossAmount);
      });
    });

    it("should maintain platformFee + netAmount = grossAmount with custom fee", () => {
      const testAmounts = [100, 999, 1000, 5555, 10000, 15000, 25000];
      const feePercent = 0.12; // 12%

      testAmounts.forEach(grossAmount => {
        const result = Payout.calculateSplit(grossAmount, feePercent);
        expect(result.platformFee + result.netAmount).toBe(grossAmount);
      });
    });

    it("should calculate split for multiple cleaners scenario", () => {
      const totalJobPrice = 30000; // $300.00 total
      const numCleaners = 3;
      const perCleanerGross = Math.round(totalJobPrice / numCleaners);

      const result = Payout.calculateSplit(perCleanerGross);

      // $100 per cleaner, 10% fee = $10 fee, $90 payout
      expect(result.platformFee).toBe(1000);
      expect(result.netAmount).toBe(9000);
    });

    it("should handle fee percentages from 0 to 1", () => {
      const grossAmount = 10000;

      // 0% fee
      const result0 = Payout.calculateSplit(grossAmount, 0);
      expect(result0.platformFee).toBe(0);
      expect(result0.netAmount).toBe(10000);

      // 5% fee
      const result5 = Payout.calculateSplit(grossAmount, 0.05);
      expect(result5.platformFee).toBe(500);
      expect(result5.netAmount).toBe(9500);

      // 20% fee
      const result20 = Payout.calculateSplit(grossAmount, 0.20);
      expect(result20.platformFee).toBe(2000);
      expect(result20.netAmount).toBe(8000);

      // 50% fee
      const result50 = Payout.calculateSplit(grossAmount, 0.50);
      expect(result50.platformFee).toBe(5000);
      expect(result50.netAmount).toBe(5000);
    });
  });

  describe("Model schema", () => {
    it("should define the model with correct name", () => {
      expect(mockDefine).toHaveBeenCalledWith("Payout", expect.any(Object));
    });

    it("should have required fields", () => {
      const schema = mockDefine.mock.calls[0][1];

      expect(schema.id).toBeDefined();
      expect(schema.appointmentId).toBeDefined();
      expect(schema.cleanerId).toBeDefined();
      expect(schema.grossAmount).toBeDefined();
      expect(schema.platformFee).toBeDefined();
      expect(schema.netAmount).toBeDefined();
      expect(schema.status).toBeDefined();
    });

    it("should have grossAmount as INTEGER (cents)", () => {
      const schema = mockDefine.mock.calls[0][1];
      expect(schema.grossAmount.type).toBe("INTEGER");
    });

    it("should have platformFee as INTEGER (cents)", () => {
      const schema = mockDefine.mock.calls[0][1];
      expect(schema.platformFee.type).toBe("INTEGER");
    });

    it("should have netAmount as INTEGER (cents)", () => {
      const schema = mockDefine.mock.calls[0][1];
      expect(schema.netAmount.type).toBe("INTEGER");
    });
  });
});

describe("Payout calculations match business config", () => {
  let Payout;
  const { platform } = businessConfig.pricing;

  beforeEach(() => {
    jest.clearAllMocks();
    Payout = PayoutFactory(mockSequelize, DataTypes);
  });

  it("should calculate split consistent with businessConfig platform fee", () => {
    const grossAmount = 15000; // $150.00
    const result = Payout.calculateSplit(grossAmount, platform.feePercent);

    const expectedFee = Math.round(grossAmount * platform.feePercent);
    const expectedNet = grossAmount - expectedFee;

    expect(result.platformFee).toBe(expectedFee);
    expect(result.netAmount).toBe(expectedNet);
  });

  it("default fee should match businessConfig when not specified", () => {
    // The default is 0.10, which should match businessConfig
    expect(platform.feePercent).toBe(0.1);

    const grossAmount = 20000;
    const resultDefault = Payout.calculateSplit(grossAmount);
    const resultConfig = Payout.calculateSplit(grossAmount, platform.feePercent);

    expect(resultDefault.platformFee).toBe(resultConfig.platformFee);
    expect(resultDefault.netAmount).toBe(resultConfig.netAmount);
  });

  it("cleaner receives (1 - feePercent) of gross amount", () => {
    const grossAmount = 25000;
    const result = Payout.calculateSplit(grossAmount, platform.feePercent);

    const cleanerPercent = 1 - platform.feePercent;
    const expectedNet = Math.round(grossAmount * cleanerPercent);

    // Account for rounding - the fee is rounded, so net = gross - roundedFee
    const roundedFee = Math.round(grossAmount * platform.feePercent);
    expect(result.netAmount).toBe(grossAmount - roundedFee);
  });
});
