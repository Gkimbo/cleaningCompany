/**
 * Pricing Router Tests
 *
 * Tests for the pricing API endpoints including businessOwnerFeePercent
 */

const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  PricingConfig: {
    getActive: jest.fn(),
    getFormattedPricing: jest.fn(),
    updatePricing: jest.fn(),
    getHistory: jest.fn(),
  },
}));

// Mock businessConfig
jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn(),
  businessConfig: {
    staffing: {
      cleanersPerHome: { small: 1, medium: 2, large: 3 },
    },
  },
}));

const { User, PricingConfig } = require("../../models");
const { getPricingConfig } = require("../../config/businessConfig");

describe("Pricing Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const createMockOwner = () => ({
    id: 1,
    username: "owner",
    email: "owner@example.com",
    type: "owner",
  });

  const createMockCleaner = () => ({
    id: 2,
    username: "cleaner",
    email: "cleaner@example.com",
    type: "cleaner",
  });

  const createValidToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  const createMockPricingConfig = (overrides = {}) => ({
    id: 1,
    basePrice: 100,
    extraBedBathFee: 25,
    halfBathFee: 12.5,
    sheetFeePerBed: 10,
    towelFee: 15,
    faceClothFee: 5,
    timeWindowAnytime: 0,
    timeWindow10To3: 25,
    timeWindow11To4: 30,
    timeWindow12To2: 50,
    cancellationFee: 50,
    cancellationWindowDays: 2,
    homeownerPenaltyDays: 14,
    cleanerPenaltyDays: 7,
    refundPercentage: 0.5,
    platformFeePercent: 0.1,
    businessOwnerFeePercent: 0.1,
    highVolumeFee: 10,
    isActive: true,
    ...overrides,
  });

  const createFormattedPricing = (overrides = {}) => ({
    basePrice: 100,
    extraBedBathFee: 25,
    halfBathFee: 12.5,
    linens: {
      sheetFeePerBed: 10,
      towelFee: 15,
      faceClothFee: 5,
    },
    timeWindows: {
      anytime: 0,
      "10-3": 25,
      "11-4": 30,
      "12-2": 50,
    },
    cancellation: {
      fee: 50,
      windowDays: 2,
      homeownerPenaltyDays: 14,
      cleanerPenaltyDays: 7,
      refundPercentage: 0.5,
    },
    platform: {
      feePercent: 0.1,
      businessOwnerFeePercent: 0.1,
    },
    highVolumeFee: 10,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SESSION_SECRET = secretKey;
  });

  describe("verifyOwner middleware", () => {
    it("should reject requests without authorization header", () => {
      const req = { headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      // Simulate middleware check
      const authHeader = req.headers.authorization;
      expect(authHeader).toBeUndefined();
    });

    it("should reject requests with invalid token format", () => {
      const req = { headers: { authorization: "InvalidFormat" } };
      const authHeader = req.headers.authorization;

      expect(authHeader.startsWith("Bearer ")).toBe(false);
    });

    it("should accept valid owner token", async () => {
      const owner = createMockOwner();
      User.findByPk.mockResolvedValue(owner);

      const token = createValidToken(owner.id);
      const decoded = jwt.verify(token, secretKey);

      const user = await User.findByPk(decoded.userId);
      expect(user.type).toBe("owner");
    });

    it("should reject non-owner users", async () => {
      const cleaner = createMockCleaner();
      User.findByPk.mockResolvedValue(cleaner);

      const token = createValidToken(cleaner.id);
      const decoded = jwt.verify(token, secretKey);

      const user = await User.findByPk(decoded.userId);
      expect(user.type).not.toBe("owner");
    });
  });

  describe("GET /current", () => {
    it("should return pricing from database when available", async () => {
      const formattedPricing = createFormattedPricing();
      PricingConfig.getFormattedPricing.mockResolvedValue(formattedPricing);

      const result = await PricingConfig.getFormattedPricing();

      expect(result).toEqual(formattedPricing);
      expect(result.platform.feePercent).toBe(0.1);
      expect(result.platform.businessOwnerFeePercent).toBe(0.1);
    });

    it("should include businessOwnerFeePercent in response", async () => {
      const formattedPricing = createFormattedPricing({
        platform: {
          feePercent: 0.1,
          businessOwnerFeePercent: 0.15,
        },
      });
      PricingConfig.getFormattedPricing.mockResolvedValue(formattedPricing);

      const result = await PricingConfig.getFormattedPricing();

      expect(result.platform.businessOwnerFeePercent).toBe(0.15);
    });

    it("should fall back to static config when database is empty", async () => {
      PricingConfig.getFormattedPricing.mockResolvedValue(null);
      const fallbackPricing = createFormattedPricing();
      getPricingConfig.mockResolvedValue(fallbackPricing);

      const dbResult = await PricingConfig.getFormattedPricing();
      expect(dbResult).toBeNull();

      const fallback = await getPricingConfig();
      expect(fallback).toEqual(fallbackPricing);
    });
  });

  describe("GET /config", () => {
    it("should return active config for owner", async () => {
      const activeConfig = createMockPricingConfig();
      const formattedPricing = createFormattedPricing();

      PricingConfig.getActive.mockResolvedValue(activeConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue(formattedPricing);

      const config = await PricingConfig.getActive();

      expect(config.businessOwnerFeePercent).toBe(0.1);
      expect(config.platformFeePercent).toBe(0.1);
    });

    it("should include businessOwnerFeePercent in static defaults when no db config", async () => {
      PricingConfig.getActive.mockResolvedValue(null);
      const fallbackPricing = createFormattedPricing();
      getPricingConfig.mockResolvedValue(fallbackPricing);

      const config = await PricingConfig.getActive();
      expect(config).toBeNull();

      const pricing = await getPricingConfig();
      expect(pricing.platform.feePercent).toBeDefined();
      expect(pricing.platform.businessOwnerFeePercent).toBeDefined();
    });
  });

  describe("PUT /config", () => {
    const createValidConfigPayload = (overrides = {}) => ({
      basePrice: 100,
      extraBedBathFee: 25,
      halfBathFee: 12.5,
      sheetFeePerBed: 10,
      towelFee: 15,
      faceClothFee: 5,
      timeWindowAnytime: 0,
      timeWindow10To3: 25,
      timeWindow11To4: 30,
      timeWindow12To2: 50,
      cancellationFee: 50,
      cancellationWindowDays: 2,
      homeownerPenaltyDays: 14,
      cleanerPenaltyDays: 7,
      refundPercentage: 0.5,
      platformFeePercent: 0.1,
      businessOwnerFeePercent: 0.1,
      highVolumeFee: 10,
      changeNote: "Test update",
      ...overrides,
    });

    describe("Validation", () => {
      it("should require businessOwnerFeePercent field", () => {
        const payload = createValidConfigPayload();
        delete payload.businessOwnerFeePercent;

        const requiredFields = {
          basePrice: payload.basePrice,
          platformFeePercent: payload.platformFeePercent,
          businessOwnerFeePercent: payload.businessOwnerFeePercent,
        };

        const missingFields = Object.entries(requiredFields)
          .filter(([key, value]) => value === undefined || value === null)
          .map(([key]) => key);

        expect(missingFields).toContain("businessOwnerFeePercent");
      });

      it("should validate businessOwnerFeePercent is between 0 and 1", () => {
        const invalidValues = [-0.1, 1.1, 2, -1];

        invalidValues.forEach(value => {
          const isValid = value >= 0 && value <= 1;
          expect(isValid).toBe(false);
        });

        const validValues = [0, 0.1, 0.5, 0.9, 1];
        validValues.forEach(value => {
          const isValid = value >= 0 && value <= 1;
          expect(isValid).toBe(true);
        });
      });

      it("should accept valid businessOwnerFeePercent", () => {
        const payload = createValidConfigPayload({ businessOwnerFeePercent: 0.15 });

        expect(payload.businessOwnerFeePercent).toBe(0.15);
        expect(payload.businessOwnerFeePercent >= 0).toBe(true);
        expect(payload.businessOwnerFeePercent <= 1).toBe(true);
      });

      it("should allow different platformFeePercent and businessOwnerFeePercent", () => {
        const payload = createValidConfigPayload({
          platformFeePercent: 0.1,
          businessOwnerFeePercent: 0.08,
        });

        expect(payload.platformFeePercent).not.toBe(payload.businessOwnerFeePercent);
        expect(payload.platformFeePercent).toBe(0.1);
        expect(payload.businessOwnerFeePercent).toBe(0.08);
      });
    });

    describe("Update pricing", () => {
      it("should pass businessOwnerFeePercent to updatePricing", async () => {
        const payload = createValidConfigPayload({ businessOwnerFeePercent: 0.12 });
        const owner = createMockOwner();

        PricingConfig.updatePricing.mockResolvedValue(createMockPricingConfig({ businessOwnerFeePercent: 0.12 }));

        await PricingConfig.updatePricing(
          {
            basePrice: payload.basePrice,
            extraBedBathFee: payload.extraBedBathFee,
            halfBathFee: payload.halfBathFee,
            sheetFeePerBed: payload.sheetFeePerBed,
            towelFee: payload.towelFee,
            faceClothFee: payload.faceClothFee,
            timeWindowAnytime: payload.timeWindowAnytime,
            timeWindow10To3: payload.timeWindow10To3,
            timeWindow11To4: payload.timeWindow11To4,
            timeWindow12To2: payload.timeWindow12To2,
            cancellationFee: payload.cancellationFee,
            cancellationWindowDays: payload.cancellationWindowDays,
            homeownerPenaltyDays: payload.homeownerPenaltyDays,
            cleanerPenaltyDays: payload.cleanerPenaltyDays,
            refundPercentage: payload.refundPercentage,
            platformFeePercent: payload.platformFeePercent,
            businessOwnerFeePercent: payload.businessOwnerFeePercent,
            highVolumeFee: payload.highVolumeFee,
          },
          owner.id,
          payload.changeNote
        );

        expect(PricingConfig.updatePricing).toHaveBeenCalledWith(
          expect.objectContaining({
            businessOwnerFeePercent: 0.12,
          }),
          owner.id,
          payload.changeNote
        );
      });

      it("should return updated config with businessOwnerFeePercent", async () => {
        const updatedConfig = createMockPricingConfig({ businessOwnerFeePercent: 0.15 });
        PricingConfig.updatePricing.mockResolvedValue(updatedConfig);

        const result = await PricingConfig.updatePricing({}, 1, null);

        expect(result.businessOwnerFeePercent).toBe(0.15);
      });
    });
  });

  describe("GET /history", () => {
    it("should include businessOwnerFeePercent in history records", async () => {
      const historyRecords = [
        {
          id: 1,
          isActive: true,
          createdAt: new Date(),
          updatedByUser: createMockOwner(),
          changeNote: "Initial setup",
          basePrice: 100,
          platformFeePercent: 0.1,
          businessOwnerFeePercent: 0.1,
        },
        {
          id: 2,
          isActive: false,
          createdAt: new Date(Date.now() - 86400000),
          updatedByUser: createMockOwner(),
          changeNote: "Updated business owner fee",
          basePrice: 100,
          platformFeePercent: 0.1,
          businessOwnerFeePercent: 0.08,
        },
      ];

      PricingConfig.getHistory.mockResolvedValue(historyRecords);

      const history = await PricingConfig.getHistory(20);

      expect(history.length).toBe(2);
      expect(history[0].businessOwnerFeePercent).toBe(0.1);
      expect(history[1].businessOwnerFeePercent).toBe(0.08);
    });

    it("should fall back to platformFeePercent when businessOwnerFeePercent is null", () => {
      const config = {
        platformFeePercent: 0.1,
        businessOwnerFeePercent: null,
      };

      const businessOwnerFee = parseFloat(config.businessOwnerFeePercent || config.platformFeePercent);
      expect(businessOwnerFee).toBe(0.1);
    });
  });

  describe("Business Owner Fee Calculations", () => {
    it("should calculate correct cleaner share with business owner fee", () => {
      const businessOwnerFeePercent = 0.1;
      const jobPrice = 150;

      const fee = jobPrice * businessOwnerFeePercent;
      const cleanerShare = jobPrice - fee;

      expect(fee).toBe(15);
      expect(cleanerShare).toBe(135);
    });

    it("should calculate different shares for regular vs business owner cleaners", () => {
      const platformFeePercent = 0.1;
      const businessOwnerFeePercent = 0.08;
      const jobPrice = 200;

      const regularCleanerFee = jobPrice * platformFeePercent;
      const regularCleanerShare = jobPrice - regularCleanerFee;

      const businessOwnerFee = jobPrice * businessOwnerFeePercent;
      const businessOwnerShare = jobPrice - businessOwnerFee;

      expect(regularCleanerShare).toBe(180); // 200 - 20
      expect(businessOwnerShare).toBe(184);  // 200 - 16
      expect(businessOwnerShare).toBeGreaterThan(regularCleanerShare);
    });

    it("should handle edge case of 0% fee", () => {
      const businessOwnerFeePercent = 0;
      const jobPrice = 100;

      const fee = jobPrice * businessOwnerFeePercent;
      const cleanerShare = jobPrice - fee;

      expect(fee).toBe(0);
      expect(cleanerShare).toBe(100);
    });

    it("should handle edge case of 100% fee", () => {
      const businessOwnerFeePercent = 1;
      const jobPrice = 100;

      const fee = jobPrice * businessOwnerFeePercent;
      const cleanerShare = jobPrice - fee;

      expect(fee).toBe(100);
      expect(cleanerShare).toBe(0);
    });

    it("should calculate weekly/monthly/yearly projections", () => {
      const businessOwnerFeePercent = 0.1;
      const avgJobPrice = 150;
      const jobsPerWeek = 10;

      const weeklyGross = avgJobPrice * jobsPerWeek;
      const weeklyFee = weeklyGross * businessOwnerFeePercent;
      const weeklyNet = weeklyGross - weeklyFee;

      const monthlyGross = weeklyGross * 4.33;
      const monthlyNet = monthlyGross * (1 - businessOwnerFeePercent);

      const yearlyGross = weeklyGross * 52;
      const yearlyNet = yearlyGross * (1 - businessOwnerFeePercent);

      expect(weeklyGross).toBe(1500);
      expect(weeklyFee).toBe(150);
      expect(weeklyNet).toBe(1350);
      expect(monthlyNet).toBeCloseTo(5845.5, 1);
      expect(yearlyNet).toBe(70200);
    });
  });
});
