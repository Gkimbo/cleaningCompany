/**
 * IncentiveService Tests
 */

// Mock sequelize Op
jest.mock("sequelize", () => ({
  Op: {
    gt: Symbol("gt"),
  },
}));

// Mock models
jest.mock("../../models", () => ({
  IncentiveConfig: {
    getActive: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    count: jest.fn(),
  },
  Payout: {
    count: jest.fn(),
  },
}));

const { IncentiveConfig, User, UserAppointments, Payout } = require("../../models");
const IncentiveService = require("../../services/IncentiveService");

describe("IncentiveService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isCleanerEligible", () => {
    const mockActiveConfig = {
      cleanerIncentiveEnabled: true,
      cleanerFeeReductionPercent: 1.0,
      cleanerEligibilityDays: 30,
      cleanerMaxCleanings: 5,
    };

    it("should return not eligible when no active config exists", async () => {
      IncentiveConfig.getActive.mockResolvedValue(null);

      const result = await IncentiveService.isCleanerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.remainingCleanings).toBe(0);
      expect(result.feeReductionPercent).toBe(0);
      expect(result.config).toBeNull();
    });

    it("should return not eligible when cleaner incentive is disabled", async () => {
      IncentiveConfig.getActive.mockResolvedValue({
        ...mockActiveConfig,
        cleanerIncentiveEnabled: false,
      });

      const result = await IncentiveService.isCleanerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.config).toBeNull();
    });

    it("should return not eligible when cleaner not found", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      User.findByPk.mockResolvedValue(null);

      const result = await IncentiveService.isCleanerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.config).toBeNull();
    });

    it("should return not eligible when account is too old", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);

      // Account created 60 days ago (beyond 30-day eligibility)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: sixtyDaysAgo,
      });

      const result = await IncentiveService.isCleanerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Account too old");
    });

    it("should return not eligible when cleaner has exceeded max cleanings", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);

      // Account created 10 days ago (within eligibility)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: tenDaysAgo,
      });

      // Cleaner has completed 5 cleanings (max)
      Payout.count.mockResolvedValue(5);

      const result = await IncentiveService.isCleanerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.remainingCleanings).toBe(0);
      expect(result.completedCleanings).toBe(5);
    });

    it("should return eligible for new cleaner with fewer than max cleanings", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);

      // Account created 10 days ago (within eligibility)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: tenDaysAgo,
      });

      // Cleaner has completed 2 cleanings
      Payout.count.mockResolvedValue(2);

      const result = await IncentiveService.isCleanerEligible(1);

      expect(result.eligible).toBe(true);
      expect(result.remainingCleanings).toBe(3);
      expect(result.completedCleanings).toBe(2);
      expect(result.feeReductionPercent).toBe(1.0);
      expect(result.config).toEqual({
        maxCleanings: 5,
        eligibilityDays: 30,
        feeReductionPercent: 1.0,
      });
    });

    it("should return eligible for brand new cleaner with zero cleanings", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);

      // Account created today
      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: new Date(),
      });

      Payout.count.mockResolvedValue(0);

      const result = await IncentiveService.isCleanerEligible(1);

      expect(result.eligible).toBe(true);
      expect(result.remainingCleanings).toBe(5);
      expect(result.completedCleanings).toBe(0);
    });

    it("should correctly count only completed payouts", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);

      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: new Date(),
      });

      Payout.count.mockResolvedValue(3);

      await IncentiveService.isCleanerEligible(1);

      expect(Payout.count).toHaveBeenCalledWith({
        where: {
          cleanerId: 1,
          status: "completed",
        },
      });
    });
  });

  describe("isHomeownerEligible", () => {
    const mockActiveConfig = {
      homeownerIncentiveEnabled: true,
      homeownerDiscountPercent: 0.1,
      homeownerMaxCleanings: 4,
    };

    it("should return not eligible when no active config exists", async () => {
      IncentiveConfig.getActive.mockResolvedValue(null);

      const result = await IncentiveService.isHomeownerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.remainingCleanings).toBe(0);
      expect(result.discountPercent).toBe(0);
      expect(result.config).toBeNull();
    });

    it("should return not eligible when homeowner incentive is disabled", async () => {
      IncentiveConfig.getActive.mockResolvedValue({
        ...mockActiveConfig,
        homeownerIncentiveEnabled: false,
      });

      const result = await IncentiveService.isHomeownerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.config).toBeNull();
    });

    it("should return not eligible when homeowner has exceeded max cleanings", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      UserAppointments.count.mockResolvedValue(4);

      const result = await IncentiveService.isHomeownerEligible(1);

      expect(result.eligible).toBe(false);
      expect(result.remainingCleanings).toBe(0);
      expect(result.completedAppointments).toBe(4);
    });

    it("should return eligible for homeowner with fewer than max cleanings", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      UserAppointments.count.mockResolvedValue(2);

      const result = await IncentiveService.isHomeownerEligible(1);

      expect(result.eligible).toBe(true);
      expect(result.remainingCleanings).toBe(2);
      expect(result.completedAppointments).toBe(2);
      expect(result.discountPercent).toBe(0.1);
      expect(result.config).toEqual({
        maxCleanings: 4,
        discountPercent: 0.1,
      });
    });

    it("should return eligible for brand new homeowner with zero cleanings", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      UserAppointments.count.mockResolvedValue(0);

      const result = await IncentiveService.isHomeownerEligible(1);

      expect(result.eligible).toBe(true);
      expect(result.remainingCleanings).toBe(4);
      expect(result.completedAppointments).toBe(0);
    });

    it("should correctly count only completed appointments", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      UserAppointments.count.mockResolvedValue(0);

      await IncentiveService.isHomeownerEligible(1);

      expect(UserAppointments.count).toHaveBeenCalledWith({
        where: {
          userId: 1,
          completed: true,
        },
      });
    });
  });

  describe("calculateCleanerFee", () => {
    const mockActiveConfig = {
      cleanerIncentiveEnabled: true,
      cleanerFeeReductionPercent: 1.0, // 100% fee reduction = 0% fees
      cleanerEligibilityDays: 30,
      cleanerMaxCleanings: 5,
    };

    it("should return standard fee when cleaner not eligible", async () => {
      IncentiveConfig.getActive.mockResolvedValue(null);

      const result = await IncentiveService.calculateCleanerFee(1, 10000, 0.1);

      expect(result.platformFee).toBe(1000); // 10% of $100
      expect(result.netAmount).toBe(9000);
      expect(result.incentiveApplied).toBe(false);
      expect(result.originalPlatformFee).toBeNull();
    });

    it("should return zero fee when 100% fee reduction applies", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);

      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: new Date(),
      });
      Payout.count.mockResolvedValue(0);

      const result = await IncentiveService.calculateCleanerFee(1, 10000, 0.1);

      expect(result.platformFee).toBe(0); // 0% fees
      expect(result.netAmount).toBe(10000);
      expect(result.incentiveApplied).toBe(true);
      expect(result.originalPlatformFee).toBe(1000);
    });

    it("should apply partial fee reduction", async () => {
      IncentiveConfig.getActive.mockResolvedValue({
        ...mockActiveConfig,
        cleanerFeeReductionPercent: 0.5, // 50% fee reduction
      });

      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: new Date(),
      });
      Payout.count.mockResolvedValue(0);

      const result = await IncentiveService.calculateCleanerFee(1, 10000, 0.1);

      expect(result.platformFee).toBe(500); // 5% fees (10% * 50%)
      expect(result.netAmount).toBe(9500);
      expect(result.incentiveApplied).toBe(true);
      expect(result.originalPlatformFee).toBe(1000);
    });

    it("should round fee calculations correctly", async () => {
      IncentiveConfig.getActive.mockResolvedValue({
        ...mockActiveConfig,
        cleanerFeeReductionPercent: 0.33, // 33% fee reduction
      });

      User.findByPk.mockResolvedValue({
        id: 1,
        createdAt: new Date(),
      });
      Payout.count.mockResolvedValue(0);

      const result = await IncentiveService.calculateCleanerFee(1, 10000, 0.1);

      // Standard fee: 10000 * 0.1 = 1000
      // Reduced: 10000 * 0.1 * (1 - 0.33) = 10000 * 0.067 = 670
      expect(result.platformFee).toBe(670);
      expect(result.netAmount).toBe(9330);
      expect(result.incentiveApplied).toBe(true);
    });
  });

  describe("calculateHomeownerPrice", () => {
    const mockActiveConfig = {
      homeownerIncentiveEnabled: true,
      homeownerDiscountPercent: 0.1, // 10% discount
      homeownerMaxCleanings: 4,
    };

    it("should return original price when homeowner not eligible", async () => {
      IncentiveConfig.getActive.mockResolvedValue(null);

      const result = await IncentiveService.calculateHomeownerPrice(1, 200);

      expect(result.finalPrice).toBe(200);
      expect(result.discountApplied).toBe(false);
      expect(result.discountPercent).toBeNull();
      expect(result.originalPrice).toBeNull();
    });

    it("should apply discount when homeowner is eligible", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      UserAppointments.count.mockResolvedValue(0);

      const result = await IncentiveService.calculateHomeownerPrice(1, 200);

      expect(result.finalPrice).toBe(180); // 200 - 10% = 180
      expect(result.discountApplied).toBe(true);
      expect(result.discountPercent).toBe(0.1);
      expect(result.originalPrice).toBe("200");
    });

    it("should apply 20% discount correctly", async () => {
      IncentiveConfig.getActive.mockResolvedValue({
        ...mockActiveConfig,
        homeownerDiscountPercent: 0.2, // 20% discount
      });
      UserAppointments.count.mockResolvedValue(0);

      const result = await IncentiveService.calculateHomeownerPrice(1, 150);

      expect(result.finalPrice).toBe(120); // 150 - 20% = 120
      expect(result.discountApplied).toBe(true);
      expect(result.discountPercent).toBe(0.2);
    });

    it("should round final price to 2 decimal places", async () => {
      IncentiveConfig.getActive.mockResolvedValue({
        ...mockActiveConfig,
        homeownerDiscountPercent: 0.15, // 15% discount
      });
      UserAppointments.count.mockResolvedValue(0);

      const result = await IncentiveService.calculateHomeownerPrice(1, 99.99);

      // 99.99 - 15% = 99.99 * 0.85 = 84.9915 -> rounds to 84.99
      expect(result.finalPrice).toBe(84.99);
      expect(result.discountApplied).toBe(true);
    });

    it("should not apply discount when homeowner has exceeded max cleanings", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      UserAppointments.count.mockResolvedValue(4); // At max

      const result = await IncentiveService.calculateHomeownerPrice(1, 200);

      expect(result.finalPrice).toBe(200);
      expect(result.discountApplied).toBe(false);
    });

    it("should convert original price to string", async () => {
      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      UserAppointments.count.mockResolvedValue(0);

      const result = await IncentiveService.calculateHomeownerPrice(1, 199.50);

      expect(result.originalPrice).toBe("199.5");
    });
  });
});
