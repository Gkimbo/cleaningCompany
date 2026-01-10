/**
 * Comprehensive Tests for MultiCleanerService
 * Core service for multi-cleaner job management
 */

// Mock dependencies before requiring the service
jest.mock("../../config/businessConfig");
jest.mock("../../services/NotificationService");
jest.mock("../../services/MultiCleanerPricingService");

// Mock Sequelize Op
const mockOp = {
  in: Symbol("in"),
  notIn: Symbol("notIn"),
  ne: Symbol("ne"),
  gt: Symbol("gt"),
  lte: Symbol("lte"),
};

jest.mock("sequelize", () => ({
  Op: mockOp,
}));

// Mock models
const mockMultiCleanerJob = {
  create: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
};

const mockUserAppointments = {
  findByPk: jest.fn(),
  update: jest.fn(),
};

const mockUserHomes = {
  findByPk: jest.fn(),
};

const mockCleanerRoomAssignment = {
  findByPk: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

const mockCleanerJobOffer = {
  create: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
};

const mockCleanerJobCompletion = {
  create: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
};

jest.mock("../../models", () => ({
  MultiCleanerJob: mockMultiCleanerJob,
  UserAppointments: mockUserAppointments,
  UserHomes: mockUserHomes,
  CleanerRoomAssignment: mockCleanerRoomAssignment,
  CleanerJobOffer: mockCleanerJobOffer,
  CleanerJobCompletion: mockCleanerJobCompletion,
}));

const { getPricingConfig } = require("../../config/businessConfig");
const NotificationService = require("../../services/NotificationService");
const MultiCleanerPricingService = require("../../services/MultiCleanerPricingService");

// Default mock pricing config
const mockPricingConfig = {
  multiCleaner: {
    largeHomeBedsThreshold: 3,
    largeHomeBathsThreshold: 3,
    offerExpirationHours: 48,
    urgentFillDays: 7,
    finalWarningDays: 3,
    platformFeePercent: 0.13,
    soloLargeHomeBonus: 0,
  },
  platform: {
    feePercent: 0.1,
  },
};

getPricingConfig.mockResolvedValue(mockPricingConfig);
NotificationService.createNotification = jest.fn().mockResolvedValue({ id: 1 });
MultiCleanerPricingService.calculateSoloCompletionEarnings = jest.fn().mockResolvedValue(15000);

// Import the service after mocks
const MultiCleanerService = require("../../services/MultiCleanerService");

describe("MultiCleanerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPricingConfig.mockResolvedValue(mockPricingConfig);
  });

  // ============================================
  // isLargeHome Tests
  // ============================================
  describe("isLargeHome", () => {
    describe("standard threshold detection", () => {
      it("should return true for homes at exactly threshold (3 beds, 3 baths)", async () => {
        expect(await MultiCleanerService.isLargeHome(3, 3)).toBe(true);
      });

      it("should return true for homes above threshold", async () => {
        expect(await MultiCleanerService.isLargeHome(4, 4)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(5, 3)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(3, 5)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(10, 8)).toBe(true);
      });

      it("should return true when only beds at/above threshold (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(3, 2)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(4, 2)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(5, 1)).toBe(true);
      });

      it("should return true when only baths at/above threshold (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(2, 3)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(2, 4)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(1, 5)).toBe(true);
      });

      it("should return false when both below threshold", async () => {
        expect(await MultiCleanerService.isLargeHome(2, 2)).toBe(false);
        expect(await MultiCleanerService.isLargeHome(1, 1)).toBe(false);
        expect(await MultiCleanerService.isLargeHome(0, 0)).toBe(false);
      });
    });

    describe("decimal values", () => {
      it("should handle half bathrooms correctly (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(3, 2.5)).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome(3, 3.5)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(4, 3.5)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(2, 2.5)).toBe(false); // neither triggers
      });

      it("should handle decimal bedrooms (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(2.9, 3)).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome(3.0, 3)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(3.5, 3.5)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(2.9, 2.9)).toBe(false); // neither triggers
      });
    });

    describe("string inputs", () => {
      it("should parse string inputs correctly (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome("3", "3")).toBe(true);
        expect(await MultiCleanerService.isLargeHome("2", "3")).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome("3", "2")).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome("4", "4")).toBe(true);
        expect(await MultiCleanerService.isLargeHome("2", "2")).toBe(false);
      });

      it("should handle decimal strings (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome("2.5", "3")).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome("3", "2.5")).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome("3.5", "3.5")).toBe(true);
        expect(await MultiCleanerService.isLargeHome("2.5", "2.5")).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle null values (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(null, 3)).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome(3, null)).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome(null, null)).toBe(false);
        expect(await MultiCleanerService.isLargeHome(null, 2)).toBe(false);
      });

      it("should handle undefined values (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(undefined, 3)).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome(3, undefined)).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome(undefined, 2)).toBe(false);
      });

      it("should handle negative values (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(-1, 3)).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome(3, -1)).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome(-5, -5)).toBe(false);
      });

      it("should handle NaN (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome(NaN, 3)).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome(3, NaN)).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome(NaN, NaN)).toBe(false);
      });

      it("should handle empty string (OR logic)", async () => {
        expect(await MultiCleanerService.isLargeHome("", 3)).toBe(true); // 3 baths triggers
        expect(await MultiCleanerService.isLargeHome(3, "")).toBe(true); // 3 beds triggers
        expect(await MultiCleanerService.isLargeHome("", "")).toBe(false);
      });
    });

    describe("custom thresholds", () => {
      it("should use custom thresholds from config parameter (OR logic)", async () => {
        const customConfig = {
          multiCleaner: {
            largeHomeBedsThreshold: 4,
            largeHomeBathsThreshold: 4,
          },
        };

        expect(await MultiCleanerService.isLargeHome(3, 3, customConfig)).toBe(false);
        expect(await MultiCleanerService.isLargeHome(4, 3, customConfig)).toBe(true); // 4 beds triggers
        expect(await MultiCleanerService.isLargeHome(3, 4, customConfig)).toBe(true); // 4 baths triggers
        expect(await MultiCleanerService.isLargeHome(4, 4, customConfig)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(5, 5, customConfig)).toBe(true);
      });

      it("should use higher custom threshold (OR logic)", async () => {
        const customConfig = {
          multiCleaner: {
            largeHomeBedsThreshold: 5,
            largeHomeBathsThreshold: 4,
          },
        };

        expect(await MultiCleanerService.isLargeHome(4, 3, customConfig)).toBe(false);
        expect(await MultiCleanerService.isLargeHome(4, 4, customConfig)).toBe(true); // 4 baths triggers
        expect(await MultiCleanerService.isLargeHome(5, 3, customConfig)).toBe(true); // 5 beds triggers
        expect(await MultiCleanerService.isLargeHome(5, 4, customConfig)).toBe(true);
      });

      it("should use lower custom threshold (OR logic)", async () => {
        const customConfig = {
          multiCleaner: {
            largeHomeBedsThreshold: 2,
            largeHomeBathsThreshold: 2,
          },
        };

        expect(await MultiCleanerService.isLargeHome(2, 1, customConfig)).toBe(true); // 2 beds triggers
        expect(await MultiCleanerService.isLargeHome(1, 2, customConfig)).toBe(true); // 2 baths triggers
        expect(await MultiCleanerService.isLargeHome(2, 2, customConfig)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(3, 3, customConfig)).toBe(true);
        expect(await MultiCleanerService.isLargeHome(1, 1, customConfig)).toBe(false);
      });
    });
  });

  // ============================================
  // isEdgeLargeHome Tests
  // ============================================
  describe("isEdgeLargeHome", () => {
    describe("edge detection (OR logic)", () => {
      it("should return true for homes at threshold on one or both dimensions", async () => {
        // Both at threshold
        expect(await MultiCleanerService.isEdgeLargeHome(3, 3)).toBe(true);
        // Beds at threshold, baths below
        expect(await MultiCleanerService.isEdgeLargeHome(3, 2)).toBe(true);
        expect(await MultiCleanerService.isEdgeLargeHome(3, 1)).toBe(true);
        // Baths at threshold, beds below
        expect(await MultiCleanerService.isEdgeLargeHome(2, 3)).toBe(true);
        expect(await MultiCleanerService.isEdgeLargeHome(1, 3)).toBe(true);
      });

      it("should return false for homes significantly over threshold", async () => {
        // Beds over threshold
        expect(await MultiCleanerService.isEdgeLargeHome(4, 3)).toBe(false);
        expect(await MultiCleanerService.isEdgeLargeHome(4, 2)).toBe(false);
        expect(await MultiCleanerService.isEdgeLargeHome(5, 3)).toBe(false);
        // Baths over threshold
        expect(await MultiCleanerService.isEdgeLargeHome(3, 4)).toBe(false);
        expect(await MultiCleanerService.isEdgeLargeHome(2, 4)).toBe(false);
        expect(await MultiCleanerService.isEdgeLargeHome(3, 5)).toBe(false);
        // Both over threshold
        expect(await MultiCleanerService.isEdgeLargeHome(4, 4)).toBe(false);
        expect(await MultiCleanerService.isEdgeLargeHome(5, 5)).toBe(false);
      });

      it("should return false for homes below threshold (not large)", async () => {
        expect(await MultiCleanerService.isEdgeLargeHome(2, 2)).toBe(false);
        expect(await MultiCleanerService.isEdgeLargeHome(1, 1)).toBe(false);
        expect(await MultiCleanerService.isEdgeLargeHome(2, 1)).toBe(false);
      });
    });

    describe("custom thresholds", () => {
      it("should use custom thresholds from config", async () => {
        const customConfig = {
          multiCleaner: {
            largeHomeBedsThreshold: 4,
            largeHomeBathsThreshold: 4,
          },
        };

        expect(await MultiCleanerService.isEdgeLargeHome(3, 3, customConfig)).toBe(false); // Not large
        expect(await MultiCleanerService.isEdgeLargeHome(4, 3, customConfig)).toBe(true); // Edge
        expect(await MultiCleanerService.isEdgeLargeHome(3, 4, customConfig)).toBe(true); // Edge
        expect(await MultiCleanerService.isEdgeLargeHome(4, 4, customConfig)).toBe(true); // Edge
        expect(await MultiCleanerService.isEdgeLargeHome(5, 4, customConfig)).toBe(false); // Over
        expect(await MultiCleanerService.isEdgeLargeHome(5, 5, customConfig)).toBe(false); // Over
      });
    });
  });

  // ============================================
  // isSoloAllowed Tests
  // ============================================
  describe("isSoloAllowed", () => {
    describe("non-large homes", () => {
      it("should return true for small homes (solo is default)", async () => {
        expect(await MultiCleanerService.isSoloAllowed(2, 2)).toBe(true);
        expect(await MultiCleanerService.isSoloAllowed(1, 1)).toBe(true);
        expect(await MultiCleanerService.isSoloAllowed(2, 1)).toBe(true);
      });
    });

    describe("edge large homes (OR logic)", () => {
      it("should return true for edge large homes (at threshold, not over)", async () => {
        // Both at threshold
        expect(await MultiCleanerService.isSoloAllowed(3, 3)).toBe(true);
        // Beds at threshold, baths below
        expect(await MultiCleanerService.isSoloAllowed(3, 2)).toBe(true);
        expect(await MultiCleanerService.isSoloAllowed(3, 1)).toBe(true);
        // Baths at threshold, beds below
        expect(await MultiCleanerService.isSoloAllowed(2, 3)).toBe(true);
        expect(await MultiCleanerService.isSoloAllowed(1, 3)).toBe(true);
      });
    });

    describe("clearly large homes", () => {
      it("should return false for homes significantly over threshold", async () => {
        expect(await MultiCleanerService.isSoloAllowed(4, 3)).toBe(false);
        expect(await MultiCleanerService.isSoloAllowed(3, 4)).toBe(false);
        expect(await MultiCleanerService.isSoloAllowed(4, 4)).toBe(false);
        expect(await MultiCleanerService.isSoloAllowed(5, 5)).toBe(false);
        expect(await MultiCleanerService.isSoloAllowed(4, 2)).toBe(false);
        expect(await MultiCleanerService.isSoloAllowed(2, 4)).toBe(false);
      });
    });
  });

  // ============================================
  // isMultiCleanerRequired Tests
  // ============================================
  describe("isMultiCleanerRequired", () => {
    describe("non-large homes", () => {
      it("should return false for small homes", async () => {
        expect(await MultiCleanerService.isMultiCleanerRequired(2, 2)).toBe(false);
        expect(await MultiCleanerService.isMultiCleanerRequired(1, 1)).toBe(false);
        expect(await MultiCleanerService.isMultiCleanerRequired(2, 1)).toBe(false);
      });
    });

    describe("edge large homes (OR logic)", () => {
      it("should return false for edge large homes (solo option available)", async () => {
        // Both at threshold
        expect(await MultiCleanerService.isMultiCleanerRequired(3, 3)).toBe(false);
        // Beds at threshold, baths below
        expect(await MultiCleanerService.isMultiCleanerRequired(3, 2)).toBe(false);
        expect(await MultiCleanerService.isMultiCleanerRequired(3, 1)).toBe(false);
        // Baths at threshold, beds below
        expect(await MultiCleanerService.isMultiCleanerRequired(2, 3)).toBe(false);
        expect(await MultiCleanerService.isMultiCleanerRequired(1, 3)).toBe(false);
      });
    });

    describe("clearly large homes", () => {
      it("should return true for homes significantly over threshold", async () => {
        expect(await MultiCleanerService.isMultiCleanerRequired(4, 3)).toBe(true);
        expect(await MultiCleanerService.isMultiCleanerRequired(3, 4)).toBe(true);
        expect(await MultiCleanerService.isMultiCleanerRequired(4, 4)).toBe(true);
        expect(await MultiCleanerService.isMultiCleanerRequired(5, 5)).toBe(true);
        expect(await MultiCleanerService.isMultiCleanerRequired(4, 2)).toBe(true);
        expect(await MultiCleanerService.isMultiCleanerRequired(2, 4)).toBe(true);
        expect(await MultiCleanerService.isMultiCleanerRequired(10, 8)).toBe(true);
      });
    });
  });

  // ============================================
  // calculateRecommendedCleaners Tests
  // ============================================
  describe("calculateRecommendedCleaners", () => {
    describe("small homes (1 cleaner)", () => {
      it("should return 1 for homes with up to 4 rooms", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 2, numBaths: 1 })).toBe(1);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 2, numBaths: 2 })).toBe(1);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 3, numBaths: 1 })).toBe(1);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 1, numBaths: 1 })).toBe(1);
      });

      it("should return 1 for studio apartments", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 0, numBaths: 1 })).toBe(1);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 1, numBaths: 1 })).toBe(1);
      });
    });

    describe("medium homes (2 cleaners)", () => {
      it("should return 2 for homes with 5-7 rooms", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 3, numBaths: 2 })).toBe(2);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 4, numBaths: 2 })).toBe(2);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 4, numBaths: 3 })).toBe(2);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 3, numBaths: 3 })).toBe(2);
      });
    });

    describe("large homes (3 cleaners)", () => {
      it("should return 3 for homes with 8-10 rooms", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 5, numBaths: 4 })).toBe(3);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 6, numBaths: 3 })).toBe(3);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 5, numBaths: 5 })).toBe(3);
      });
    });

    describe("very large homes (4 cleaners cap)", () => {
      it("should cap at 4 cleaners for very large homes", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 8, numBaths: 5 })).toBe(4);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 10, numBaths: 6 })).toBe(4);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 20, numBaths: 15 })).toBe(4);
      });
    });

    describe("input handling", () => {
      it("should handle string inputs", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: "3", numBaths: "3" })).toBe(2);
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: "5", numBaths: "4" })).toBe(3);
      });

      it("should handle decimal inputs", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 3, numBaths: 2.5 })).toBe(2);
      });

      it("should handle missing numBaths", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: 3 })).toBe(1);
      });

      it("should handle missing numBeds", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBaths: 3 })).toBe(1);
      });

      it("should handle empty object", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({})).toBe(1);
      });

      it("should handle null/undefined values in object", async () => {
        expect(await MultiCleanerService.calculateRecommendedCleaners({ numBeds: null, numBaths: null })).toBe(1);
      });
    });
  });

  // ============================================
  // estimateJobDuration Tests
  // ============================================
  describe("estimateJobDuration", () => {
    describe("single cleaner calculations", () => {
      it("should calculate base duration correctly", async () => {
        // Formula: 30 base + beds*30 + baths*20
        const home = { numBeds: 3, numBaths: 2 };
        const duration = await MultiCleanerService.estimateJobDuration(home, 1);
        // 30 + 3*30 + 2*20 = 30 + 90 + 40 = 160
        expect(duration).toBe(160);
      });

      it("should calculate for small home", async () => {
        const home = { numBeds: 1, numBaths: 1 };
        const duration = await MultiCleanerService.estimateJobDuration(home, 1);
        // 30 + 1*30 + 1*20 = 80
        expect(duration).toBe(80);
      });

      it("should calculate for large home", async () => {
        const home = { numBeds: 5, numBaths: 4 };
        const duration = await MultiCleanerService.estimateJobDuration(home, 1);
        // 30 + 5*30 + 4*20 = 30 + 150 + 80 = 260
        expect(duration).toBe(260);
      });
    });

    describe("multi-cleaner efficiency", () => {
      it("should reduce duration for 2 cleaners with overhead", async () => {
        const home = { numBeds: 3, numBaths: 2 };
        const singleDuration = await MultiCleanerService.estimateJobDuration(home, 1);
        const dualDuration = await MultiCleanerService.estimateJobDuration(home, 2);

        // Dual should be less than single
        expect(dualDuration).toBeLessThan(singleDuration);
        // But more than half due to 15% overhead
        expect(dualDuration).toBeGreaterThan(singleDuration / 2);
        // Should be roughly singleDuration / 2 / 0.85
        expect(dualDuration).toBeCloseTo(Math.ceil((singleDuration / 2) / 0.85), 0);
      });

      it("should reduce further for 3 cleaners", async () => {
        const home = { numBeds: 4, numBaths: 4 };
        const duration1 = await MultiCleanerService.estimateJobDuration(home, 1);
        const duration2 = await MultiCleanerService.estimateJobDuration(home, 2);
        const duration3 = await MultiCleanerService.estimateJobDuration(home, 3);

        expect(duration2).toBeLessThan(duration1);
        expect(duration3).toBeLessThan(duration2);
      });

      it("should reduce for 4 cleaners", async () => {
        const home = { numBeds: 6, numBaths: 5 };
        const duration1 = await MultiCleanerService.estimateJobDuration(home, 1);
        const duration4 = await MultiCleanerService.estimateJobDuration(home, 4);

        expect(duration4).toBeLessThan(duration1);
        expect(duration4).toBeGreaterThan(duration1 / 4);
      });
    });

    describe("default values", () => {
      it("should use defaults for missing values", async () => {
        const duration = await MultiCleanerService.estimateJobDuration({}, 1);
        // 30 base + 1*30 default beds + 1*20 default baths = 80
        expect(duration).toBe(80);
      });

      it("should use default for missing numBeds", async () => {
        const duration = await MultiCleanerService.estimateJobDuration({ numBaths: 2 }, 1);
        // 30 base + 1*30 (default bed) + 2*20 (baths) = 30 + 30 + 40 = 100
        expect(duration).toBe(100);
      });

      it("should use default for missing numBaths", async () => {
        const duration = await MultiCleanerService.estimateJobDuration({ numBeds: 3 }, 1);
        // 30 + 3*30 + 1*20 = 140
        expect(duration).toBe(140);
      });
    });

    describe("edge cases", () => {
      it("should handle zero rooms", async () => {
        const duration = await MultiCleanerService.estimateJobDuration({ numBeds: 0, numBaths: 0 }, 1);
        // Should have at least base time (30 min) + defaults
        expect(duration).toBeGreaterThan(0);
      });

      it("should return positive duration always", async () => {
        const duration = await MultiCleanerService.estimateJobDuration({ numBeds: 1, numBaths: 1 }, 10);
        expect(duration).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // createMultiCleanerJob Tests
  // ============================================
  describe("createMultiCleanerJob", () => {
    const mockHome = {
      id: 1,
      numBeds: 4,
      numBaths: 3,
    };

    const mockAppointment = {
      id: 100,
      date: "2025-01-15",
      home: mockHome,
      homeId: 1,
      update: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
      mockUserAppointments.findByPk.mockResolvedValue(mockAppointment);
      mockMultiCleanerJob.create.mockImplementation((data) =>
        Promise.resolve({
          id: 1,
          ...data,
          isFilled: () => false,
          getRemainingSlots: () => data.totalCleanersRequired,
        })
      );
    });

    it("should create a multi-cleaner job with correct properties", async () => {
      const job = await MultiCleanerService.createMultiCleanerJob(100, 2, null, false);

      expect(job.appointmentId).toBe(100);
      expect(job.totalCleanersRequired).toBe(2);
      expect(job.cleanersConfirmed).toBe(0);
      expect(job.status).toBe("open");
      expect(job.isAutoGenerated).toBe(false);
    });

    it("should set primary cleaner when provided", async () => {
      const job = await MultiCleanerService.createMultiCleanerJob(100, 2, 50, false);

      expect(mockMultiCleanerJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryCleanerId: 50,
        })
      );
    });

    it("should mark as auto-generated when specified", async () => {
      const job = await MultiCleanerService.createMultiCleanerJob(100, 2, null, true);

      expect(mockMultiCleanerJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isAutoGenerated: true,
        })
      );
    });

    it("should calculate estimated duration", async () => {
      await MultiCleanerService.createMultiCleanerJob(100, 2, null, false);

      expect(mockMultiCleanerJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalEstimatedMinutes: expect.any(Number),
        })
      );
    });

    it("should update appointment with multi-cleaner info", async () => {
      await MultiCleanerService.createMultiCleanerJob(100, 2, null, false);

      expect(mockAppointment.update).toHaveBeenCalledWith({
        isMultiCleanerJob: true,
        multiCleanerJobId: 1,
        cleanerSlotsRemaining: 2,
      });
    });

    it("should throw error for non-existent appointment", async () => {
      mockUserAppointments.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerService.createMultiCleanerJob(999, 2, null, false)
      ).rejects.toThrow("Appointment not found");
    });
  });

  // ============================================
  // convertToMultiCleanerJob Tests
  // ============================================
  describe("convertToMultiCleanerJob", () => {
    it("should convert existing appointment to multi-cleaner", async () => {
      const mockHome = { numBeds: 4, numBaths: 3 };
      const mockAppointment = {
        id: 100,
        home: mockHome,
        update: jest.fn().mockResolvedValue(true),
      };

      mockUserAppointments.findByPk.mockResolvedValue(mockAppointment);
      mockMultiCleanerJob.create.mockResolvedValue({
        id: 1,
        appointmentId: 100,
        totalCleanersRequired: 2,
      });

      const job = await MultiCleanerService.convertToMultiCleanerJob(100);

      expect(job.appointmentId).toBe(100);
      expect(mockMultiCleanerJob.create).toHaveBeenCalled();
    });

    it("should use recommended cleaner count", async () => {
      const mockHome = { numBeds: 5, numBaths: 4 }; // 9 rooms = 3 cleaners
      const mockAppointment = {
        id: 100,
        home: mockHome,
        update: jest.fn().mockResolvedValue(true),
      };

      mockUserAppointments.findByPk.mockResolvedValue(mockAppointment);
      mockMultiCleanerJob.create.mockImplementation((data) =>
        Promise.resolve({ id: 1, ...data })
      );

      await MultiCleanerService.convertToMultiCleanerJob(100);

      expect(mockMultiCleanerJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCleanersRequired: 3,
          isAutoGenerated: true,
        })
      );
    });

    it("should throw error for non-existent appointment", async () => {
      mockUserAppointments.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerService.convertToMultiCleanerJob(999)
      ).rejects.toThrow("Appointment not found");
    });
  });

  // ============================================
  // fillSlot Tests
  // ============================================
  describe("fillSlot", () => {
    let mockJob;

    beforeEach(() => {
      // Reset mock job before each test
      mockJob = {
        id: 10,
        appointmentId: 100,
        totalCleanersRequired: 2,
        cleanersConfirmed: 0,
        isFilled: jest.fn().mockReturnValue(false),
        getRemainingSlots: jest.fn().mockReturnValue(1),
        updateStatus: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      mockCleanerRoomAssignment.update.mockResolvedValue([1]);
      mockCleanerJobCompletion.create.mockResolvedValue({ id: 1 });
      mockUserAppointments.update.mockResolvedValue([1]);
    });

    it("should fill a slot successfully", async () => {
      const result = await MultiCleanerService.fillSlot(10, 100, [1, 2]);

      expect(mockCleanerRoomAssignment.update).toHaveBeenCalledWith(
        { cleanerId: 100 },
        { where: { id: [1, 2] } }
      );
      expect(mockCleanerJobCompletion.create).toHaveBeenCalledWith({
        appointmentId: 100,
        cleanerId: 100,
        multiCleanerJobId: 10,
        status: "assigned",
      });
      expect(mockJob.updateStatus).toHaveBeenCalled();
    });

    it("should increment confirmed cleaners", async () => {
      await MultiCleanerService.fillSlot(10, 100, [1, 2]);
      expect(mockJob.cleanersConfirmed).toBe(1);
    });

    it("should update appointment slots remaining", async () => {
      await MultiCleanerService.fillSlot(10, 100, [1, 2]);

      expect(mockUserAppointments.update).toHaveBeenCalledWith(
        { cleanerSlotsRemaining: 1 },
        { where: { id: 100 } }
      );
    });

    it("should throw error if job not found", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerService.fillSlot(999, 100, [1, 2])
      ).rejects.toThrow("Multi-cleaner job not found");
    });

    it("should throw error if job is already filled", async () => {
      mockJob.isFilled.mockReturnValue(true);

      await expect(
        MultiCleanerService.fillSlot(10, 100, [1, 2])
      ).rejects.toThrow("All cleaner slots are already filled");
    });

    it("should handle empty room assignment array", async () => {
      await MultiCleanerService.fillSlot(10, 100, []);

      // Should not call update for room assignments
      expect(mockCleanerRoomAssignment.update).not.toHaveBeenCalled();
      // But should still create completion
      expect(mockCleanerJobCompletion.create).toHaveBeenCalled();
    });
  });

  // ============================================
  // releaseSlot Tests
  // ============================================
  describe("releaseSlot", () => {
    let mockJob;

    beforeEach(() => {
      // Reset mock job before each test
      mockJob = {
        id: 10,
        appointmentId: 100,
        cleanersConfirmed: 2,
        getRemainingSlots: jest.fn().mockReturnValue(2),
        updateStatus: jest.fn().mockResolvedValue(true),
      };
      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      mockCleanerRoomAssignment.update.mockResolvedValue([1]);
      mockCleanerJobCompletion.update.mockResolvedValue([1]);
      mockUserAppointments.update.mockResolvedValue([1]);
    });

    it("should release a slot successfully", async () => {
      await MultiCleanerService.releaseSlot(10, 100);

      expect(mockCleanerRoomAssignment.update).toHaveBeenCalledWith(
        { cleanerId: null, status: "pending" },
        { where: { multiCleanerJobId: 10, cleanerId: 100 } }
      );
    });

    it("should mark completion as dropped out", async () => {
      await MultiCleanerService.releaseSlot(10, 100);

      expect(mockCleanerJobCompletion.update).toHaveBeenCalledWith(
        { status: "dropped_out" },
        { where: { multiCleanerJobId: 10, cleanerId: 100 } }
      );
    });

    it("should decrement confirmed cleaners", async () => {
      await MultiCleanerService.releaseSlot(10, 100);
      expect(mockJob.cleanersConfirmed).toBe(1);
    });

    it("should not go below zero cleaners confirmed", async () => {
      mockJob.cleanersConfirmed = 0;
      await MultiCleanerService.releaseSlot(10, 100);
      expect(mockJob.cleanersConfirmed).toBe(0);
    });

    it("should throw error if job not found", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerService.releaseSlot(999, 100)
      ).rejects.toThrow("Multi-cleaner job not found");
    });
  });

  // ============================================
  // checkAllSlotsFilled Tests
  // ============================================
  describe("checkAllSlotsFilled", () => {
    it("should return true when all slots filled", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue({
        isFilled: jest.fn().mockReturnValue(true),
      });

      const result = await MultiCleanerService.checkAllSlotsFilled(10);
      expect(result).toBe(true);
    });

    it("should return false when slots available", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue({
        isFilled: jest.fn().mockReturnValue(false),
      });

      const result = await MultiCleanerService.checkAllSlotsFilled(10);
      expect(result).toBe(false);
    });

    it("should return false when job not found", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(null);

      const result = await MultiCleanerService.checkAllSlotsFilled(999);
      expect(result).toBe(false);
    });
  });

  // ============================================
  // createJobOffer Tests
  // ============================================
  describe("createJobOffer", () => {
    const mockJob = {
      id: 10,
      appointmentId: 100,
    };

    beforeEach(() => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      mockCleanerJobOffer.findOne.mockResolvedValue(null);
      mockCleanerJobOffer.create.mockImplementation((data) =>
        Promise.resolve({ id: 1, ...data })
      );
    });

    it("should create a job offer with correct properties", async () => {
      const offer = await MultiCleanerService.createJobOffer(
        10, 100, "market_open", 5000, [{ id: 1 }]
      );

      expect(offer.multiCleanerJobId).toBe(10);
      expect(offer.cleanerId).toBe(100);
      expect(offer.offerType).toBe("market_open");
      expect(offer.earningsOffered).toBe(5000);
      expect(offer.status).toBe("pending");
    });

    it("should set expiration based on config", async () => {
      await MultiCleanerService.createJobOffer(10, 100, "market_open", 5000);

      expect(mockCleanerJobOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        })
      );
    });

    it("should throw error if job not found", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerService.createJobOffer(999, 100, "market_open", 5000)
      ).rejects.toThrow("Multi-cleaner job not found");
    });

    it("should throw error if cleaner already has an offer", async () => {
      mockCleanerJobOffer.findOne.mockResolvedValue({ id: 1, status: "pending" });

      await expect(
        MultiCleanerService.createJobOffer(10, 100, "market_open", 5000)
      ).rejects.toThrow("Cleaner already has an active offer for this job");
    });

    it("should allow offer if previous offer was declined", async () => {
      mockCleanerJobOffer.findOne.mockResolvedValue(null);

      const offer = await MultiCleanerService.createJobOffer(10, 100, "market_open", 5000);
      expect(offer).toBeDefined();
    });
  });

  // ============================================
  // handleCleanerDropout Tests
  // ============================================
  describe("handleCleanerDropout", () => {
    const mockJob = {
      id: 10,
      appointmentId: 100,
      cleanersConfirmed: 2,
      getRemainingSlots: jest.fn().mockReturnValue(1),
      updateStatus: jest.fn().mockResolvedValue(true),
    };

    const mockAppointment = {
      id: 100,
      date: "2025-01-15",
      userId: 200,
      home: { id: 1 },
      user: { id: 200 },
    };

    beforeEach(() => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      mockCleanerRoomAssignment.update.mockResolvedValue([1]);
      mockCleanerJobCompletion.update.mockResolvedValue([1]);
      mockCleanerJobCompletion.findAll.mockResolvedValue([
        { cleanerId: 101, status: "assigned" },
      ]);
      mockUserAppointments.findByPk.mockResolvedValue(mockAppointment);
      mockUserAppointments.update.mockResolvedValue([1]);
      NotificationService.createNotification.mockResolvedValue({ id: 1 });
    });

    it("should release the slot", async () => {
      await MultiCleanerService.handleCleanerDropout(10, 100, "Emergency");

      expect(mockCleanerRoomAssignment.update).toHaveBeenCalledWith(
        { cleanerId: null, status: "pending" },
        { where: { multiCleanerJobId: 10, cleanerId: 100 } }
      );
    });

    it("should notify remaining cleaners", async () => {
      await MultiCleanerService.handleCleanerDropout(10, 100, "Emergency");

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 101,
          type: "cleaner_dropout",
        })
      );
    });

    it("should notify homeowner", async () => {
      await MultiCleanerService.handleCleanerDropout(10, 100, "Emergency");

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          type: "cleaner_dropout",
        })
      );
    });

    it("should return remaining cleaners count", async () => {
      const result = await MultiCleanerService.handleCleanerDropout(10, 100, "Emergency");

      expect(result.remainingCleaners).toBe(1);
      expect(result.canProceedSolo).toBe(true);
    });

    it("should handle no remaining cleaners", async () => {
      mockCleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await MultiCleanerService.handleCleanerDropout(10, 100, "Emergency");

      expect(result.remainingCleaners).toBe(0);
      expect(result.canProceedSolo).toBe(false);
    });
  });

  // ============================================
  // handleNoShow Tests
  // ============================================
  describe("handleNoShow", () => {
    beforeEach(() => {
      mockCleanerJobCompletion.update.mockResolvedValue([1]);
      mockMultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        appointmentId: 100,
        cleanersConfirmed: 2,
        getRemainingSlots: jest.fn().mockReturnValue(1),
        updateStatus: jest.fn().mockResolvedValue(true),
      });
      mockCleanerRoomAssignment.update.mockResolvedValue([1]);
      mockCleanerJobCompletion.findAll.mockResolvedValue([]);
      mockUserAppointments.findByPk.mockResolvedValue({
        id: 100,
        date: "2025-01-15",
        userId: 200,
      });
      mockUserAppointments.update.mockResolvedValue([1]);
    });

    it("should mark cleaner as no-show", async () => {
      await MultiCleanerService.handleNoShow(10, 100);

      expect(mockCleanerJobCompletion.update).toHaveBeenCalledWith(
        { status: "no_show" },
        { where: { multiCleanerJobId: 10, cleanerId: 100 } }
      );
    });

    it("should handle like a dropout", async () => {
      await MultiCleanerService.handleNoShow(10, 100);

      // Should call release slot logic
      expect(mockCleanerRoomAssignment.update).toHaveBeenCalled();
    });
  });

  // ============================================
  // offerSoloCompletion Tests
  // ============================================
  describe("offerSoloCompletion", () => {
    const mockJob = {
      id: 10,
      appointmentId: 100,
    };

    const mockAppointment = {
      id: 100,
      date: "2025-01-15",
    };

    beforeEach(() => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      mockUserAppointments.findByPk.mockResolvedValue(mockAppointment);
      MultiCleanerPricingService.calculateSoloCompletionEarnings.mockResolvedValue(15000);
    });

    it("should send solo completion notification", async () => {
      await MultiCleanerService.offerSoloCompletion(10, 100);

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 100,
          type: "solo_completion_offer",
        })
      );
    });

    it("should include earnings in notification", async () => {
      await MultiCleanerService.offerSoloCompletion(10, 100);

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("$150.00"),
        })
      );
    });

    it("should set 12-hour expiration", async () => {
      await MultiCleanerService.offerSoloCompletion(10, 100);

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
          actionRequired: true,
        })
      );
    });

    it("should return earnings and appointment", async () => {
      const result = await MultiCleanerService.offerSoloCompletion(10, 100);

      expect(result.fullEarnings).toBe(15000);
      expect(result.appointment).toBeDefined();
    });
  });

  // ============================================
  // markCleanerComplete Tests
  // ============================================
  describe("markCleanerComplete", () => {
    beforeEach(() => {
      mockCleanerRoomAssignment.update.mockResolvedValue([1]);
      mockCleanerJobCompletion.findOne.mockResolvedValue({
        markCompleted: jest.fn().mockResolvedValue(true),
      });
      mockMultiCleanerJob.findByPk.mockResolvedValue({ id: 10, save: jest.fn() });
      mockCleanerRoomAssignment.count.mockResolvedValue(0);
    });

    it("should mark all assigned rooms as complete", async () => {
      await MultiCleanerService.markCleanerComplete(10, 100);

      expect(mockCleanerRoomAssignment.update).toHaveBeenCalledWith(
        { status: "completed", completedAt: expect.any(Date) },
        { where: { multiCleanerJobId: 10, cleanerId: 100 } }
      );
    });

    it("should mark completion record", async () => {
      const mockCompletion = {
        markCompleted: jest.fn().mockResolvedValue(true),
      };
      mockCleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);

      await MultiCleanerService.markCleanerComplete(10, 100);

      expect(mockCompletion.markCompleted).toHaveBeenCalled();
    });

    it("should check if job is fully complete", async () => {
      mockCleanerRoomAssignment.count.mockResolvedValue(0);

      await MultiCleanerService.markCleanerComplete(10, 100);

      expect(mockCleanerRoomAssignment.count).toHaveBeenCalled();
    });
  });

  // ============================================
  // checkJobFullyComplete Tests
  // ============================================
  describe("checkJobFullyComplete", () => {
    it("should return true when all rooms complete", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        save: jest.fn().mockResolvedValue(true),
        status: "in_progress",
      });
      mockCleanerRoomAssignment.count.mockResolvedValue(0);

      const result = await MultiCleanerService.checkJobFullyComplete(10);

      expect(result).toBe(true);
    });

    it("should update job status to completed", async () => {
      const mockJob = {
        id: 10,
        status: "in_progress",
        save: jest.fn().mockResolvedValue(true),
      };
      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      mockCleanerRoomAssignment.count.mockResolvedValue(0);

      await MultiCleanerService.checkJobFullyComplete(10);

      expect(mockJob.status).toBe("completed");
      expect(mockJob.save).toHaveBeenCalled();
    });

    it("should return false when rooms incomplete", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue({ id: 10 });
      mockCleanerRoomAssignment.count.mockResolvedValue(2);

      const result = await MultiCleanerService.checkJobFullyComplete(10);

      expect(result).toBe(false);
    });

    it("should return false when job not found", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(null);

      const result = await MultiCleanerService.checkJobFullyComplete(999);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // getJobCheckInfo Tests
  // ============================================
  describe("getJobCheckInfo", () => {
    const mockHome = {
      id: 1,
      numBeds: 4,
      numBaths: 3,
      squareFootage: 2500,
    };

    const mockAppointment = {
      id: 100,
      home: mockHome,
    };

    beforeEach(() => {
      mockUserAppointments.findByPk.mockResolvedValue(mockAppointment);
    });

    it("should return complete check info", async () => {
      const info = await MultiCleanerService.getJobCheckInfo(100);

      expect(info).toMatchObject({
        isLargeHome: true,
        recommendedCleaners: expect.any(Number),
        estimatedMinutes: expect.any(Number),
        estimatedHours: expect.any(String),
        numBeds: 4,
        numBaths: 3,
        squareFootage: 2500,
      });
    });

    it("should throw error if appointment not found", async () => {
      mockUserAppointments.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerService.getJobCheckInfo(999)
      ).rejects.toThrow("Appointment or home not found");
    });

    it("should throw error if home not found", async () => {
      mockUserAppointments.findByPk.mockResolvedValue({ id: 100, home: null });

      await expect(
        MultiCleanerService.getJobCheckInfo(100)
      ).rejects.toThrow("Appointment or home not found");
    });
  });

  // ============================================
  // findJobsNeedingUrgentFill Tests
  // ============================================
  describe("findJobsNeedingUrgentFill", () => {
    it("should query for unfilled jobs within urgent window", async () => {
      mockMultiCleanerJob.findAll.mockResolvedValue([]);

      await MultiCleanerService.findJobsNeedingUrgentFill();

      expect(mockMultiCleanerJob.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            urgentNotificationSentAt: null,
          }),
        })
      );
    });

    it("should use urgentFillDays from config", async () => {
      mockMultiCleanerJob.findAll.mockResolvedValue([]);

      await MultiCleanerService.findJobsNeedingUrgentFill();

      // Config says 7 days
      expect(getPricingConfig).toHaveBeenCalled();
    });
  });

  // ============================================
  // findJobsNeedingFinalWarning Tests
  // ============================================
  describe("findJobsNeedingFinalWarning", () => {
    it("should query for unfilled jobs within final warning window", async () => {
      mockMultiCleanerJob.findAll.mockResolvedValue([]);

      await MultiCleanerService.findJobsNeedingFinalWarning();

      expect(mockMultiCleanerJob.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            finalWarningAt: null,
          }),
        })
      );
    });

    it("should use finalWarningDays from config", async () => {
      mockMultiCleanerJob.findAll.mockResolvedValue([]);

      await MultiCleanerService.findJobsNeedingFinalWarning();

      // Config says 3 days
      expect(getPricingConfig).toHaveBeenCalled();
    });
  });

  // ============================================
  // Business Logic Integration Tests
  // ============================================
  describe("Business Logic Integration", () => {
    it("should correctly flow from detection to recommendation", async () => {
      const home = { numBeds: 5, numBaths: 4 };

      const isLarge = await MultiCleanerService.isLargeHome(home.numBeds, home.numBaths);
      const recommended = await MultiCleanerService.calculateRecommendedCleaners(home);
      const duration = await MultiCleanerService.estimateJobDuration(home, recommended);

      expect(isLarge).toBe(true);
      expect(recommended).toBe(3);
      expect(duration).toBeLessThan(
        await MultiCleanerService.estimateJobDuration(home, 1)
      );
    });

    it("should not recommend multiple cleaners for small homes", async () => {
      const home = { numBeds: 2, numBaths: 1 };

      const isLarge = await MultiCleanerService.isLargeHome(home.numBeds, home.numBaths);
      const recommended = await MultiCleanerService.calculateRecommendedCleaners(home);

      expect(isLarge).toBe(false);
      expect(recommended).toBe(1);
    });

    it("should scale time inversely with cleaners but with overhead", async () => {
      const home = { numBeds: 4, numBaths: 3 };

      const time1 = await MultiCleanerService.estimateJobDuration(home, 1);
      const time2 = await MultiCleanerService.estimateJobDuration(home, 2);
      const time3 = await MultiCleanerService.estimateJobDuration(home, 3);
      const time4 = await MultiCleanerService.estimateJobDuration(home, 4);

      // Verify ordering
      expect(time1).toBeGreaterThan(time2);
      expect(time2).toBeGreaterThan(time3);
      expect(time3).toBeGreaterThan(time4);

      // Verify overhead prevents perfect division
      expect(time2).toBeGreaterThan(time1 / 2);
      expect(time3).toBeGreaterThan(time1 / 3);
      expect(time4).toBeGreaterThan(time1 / 4);
    });
  });
});
