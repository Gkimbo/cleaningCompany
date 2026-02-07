/**
 * Tests for PreferredCleanerPerksService
 * Handles gamification and loyalty perks for preferred cleaners
 */

const PreferredCleanerPerksService = require("../../services/PreferredCleanerPerksService");

describe("PreferredCleanerPerksService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateTierFromConfig", () => {
    const defaultConfig = {
      bronzeMinHomes: 1,
      bronzeMaxHomes: 2,
      bronzeBonusPercent: 0,
      silverMinHomes: 3,
      silverMaxHomes: 5,
      silverBonusPercent: 3,
      goldMinHomes: 6,
      goldMaxHomes: 10,
      goldBonusPercent: 5,
      goldFasterPayouts: true,
      goldPayoutHours: 24,
      platinumMinHomes: 11,
      platinumBonusPercent: 7,
      platinumFasterPayouts: true,
      platinumPayoutHours: 24,
      platinumEarlyAccess: true,
    };

    it("should return bronze tier for 0-2 homes", () => {
      expect(PreferredCleanerPerksService.calculateTierFromConfig(0, defaultConfig).tier).toBe("bronze");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(1, defaultConfig).tier).toBe("bronze");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(2, defaultConfig).tier).toBe("bronze");
    });

    it("should return silver tier for 3-5 homes", () => {
      expect(PreferredCleanerPerksService.calculateTierFromConfig(3, defaultConfig).tier).toBe("silver");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(4, defaultConfig).tier).toBe("silver");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(5, defaultConfig).tier).toBe("silver");
    });

    it("should return gold tier for 6-10 homes", () => {
      expect(PreferredCleanerPerksService.calculateTierFromConfig(6, defaultConfig).tier).toBe("gold");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(8, defaultConfig).tier).toBe("gold");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(10, defaultConfig).tier).toBe("gold");
    });

    it("should return platinum tier for 11+ homes", () => {
      expect(PreferredCleanerPerksService.calculateTierFromConfig(11, defaultConfig).tier).toBe("platinum");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(20, defaultConfig).tier).toBe("platinum");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(100, defaultConfig).tier).toBe("platinum");
    });

    it("should return correct bonus percentages", () => {
      expect(PreferredCleanerPerksService.calculateTierFromConfig(1, defaultConfig).bonusPercent).toBe(0);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(3, defaultConfig).bonusPercent).toBe(3);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(6, defaultConfig).bonusPercent).toBe(5);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(11, defaultConfig).bonusPercent).toBe(7);
    });

    it("should return faster payouts only for gold and platinum", () => {
      expect(PreferredCleanerPerksService.calculateTierFromConfig(1, defaultConfig).fasterPayouts).toBe(false);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(3, defaultConfig).fasterPayouts).toBe(false);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(6, defaultConfig).fasterPayouts).toBe(true);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(11, defaultConfig).fasterPayouts).toBe(true);
    });

    it("should return early access only for platinum", () => {
      expect(PreferredCleanerPerksService.calculateTierFromConfig(1, defaultConfig).earlyAccess).toBe(false);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(6, defaultConfig).earlyAccess).toBe(false);
      expect(PreferredCleanerPerksService.calculateTierFromConfig(11, defaultConfig).earlyAccess).toBe(true);
    });

    it("should handle custom config thresholds", () => {
      const customConfig = {
        ...defaultConfig,
        silverMinHomes: 5,
        silverMaxHomes: 10,
        goldMinHomes: 11,
        goldMaxHomes: 20,
        platinumMinHomes: 21,
      };

      expect(PreferredCleanerPerksService.calculateTierFromConfig(4, customConfig).tier).toBe("bronze");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(5, customConfig).tier).toBe("silver");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(11, customConfig).tier).toBe("gold");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(21, customConfig).tier).toBe("platinum");
    });
  });

  describe("getOrCreatePerks", () => {
    it("should return existing perks if found", async () => {
      const existingPerks = {
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 7,
        bonusPercent: 5,
      };

      const models = {
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(existingPerks),
          create: jest.fn(),
        },
      };

      const result = await PreferredCleanerPerksService.getOrCreatePerks(100, models);

      expect(result).toEqual(existingPerks);
      expect(models.CleanerPreferredPerks.findOne).toHaveBeenCalledWith({
        where: { cleanerId: 100 },
      });
      expect(models.CleanerPreferredPerks.create).not.toHaveBeenCalled();
    });

    it("should create new perks with bronze tier if not found", async () => {
      const newPerks = {
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 0,
        bonusPercent: 0,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
      };

      const models = {
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(newPerks),
        },
      };

      const result = await PreferredCleanerPerksService.getOrCreatePerks(100, models);

      expect(result).toEqual(newPerks);
      expect(models.CleanerPreferredPerks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanerId: 100,
          tierLevel: "bronze",
          preferredHomeCount: 0,
        })
      );
    });
  });

  describe("getPerksConfig", () => {
    it("should return config from database if exists", async () => {
      const dbConfig = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 3,
        silverMinHomes: 4,
        silverMaxHomes: 8,
        silverBonusPercent: 4,
        goldMinHomes: 9,
        goldMaxHomes: 15,
        goldBonusPercent: 6,
        platinumMinHomes: 16,
        platinumBonusPercent: 8,
      };

      const models = {
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(dbConfig),
        },
      };

      const result = await PreferredCleanerPerksService.getPerksConfig(models);

      expect(result).toEqual(dbConfig);
    });

    it("should return default config if none in database", async () => {
      const models = {
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.getPerksConfig(models);

      expect(result.bronzeMinHomes).toBe(1);
      expect(result.silverMinHomes).toBe(3);
      expect(result.silverBonusPercent).toBe(3);
      expect(result.goldMinHomes).toBe(6);
      expect(result.goldBonusPercent).toBe(5);
      expect(result.platinumMinHomes).toBe(11);
      expect(result.platinumBonusPercent).toBe(7);
    });
  });

  describe("isPreferredAtHome", () => {
    it("should return true if cleaner is preferred at home", async () => {
      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
        },
      };

      const result = await PreferredCleanerPerksService.isPreferredAtHome(100, 1, models);

      expect(result).toBe(true);
      expect(models.HomePreferredCleaner.findOne).toHaveBeenCalledWith({
        where: { cleanerId: 100, homeId: 1 },
      });
    });

    it("should return false if cleaner is not preferred at home", async () => {
      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.isPreferredAtHome(100, 1, models);

      expect(result).toBe(false);
    });
  });

  describe("recalculateTier", () => {
    it("should recalculate tier based on preferred home count", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 0,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(6), // 6 homes = gold
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null), // Use defaults
        },
      };

      await PreferredCleanerPerksService.recalculateTier(100, models);

      expect(mockPerks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tierLevel: "gold",
          preferredHomeCount: 6,
          bonusPercent: 5,
          fasterPayouts: true,
          payoutHours: 24,
        })
      );
    });

    it("should create perks record if not exists", async () => {
      const newPerks = {
        cleanerId: 100,
        tierLevel: "bronze",
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(3), // 3 homes = silver
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(newPerks),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      await PreferredCleanerPerksService.recalculateTier(100, models);

      expect(models.CleanerPreferredPerks.create).toHaveBeenCalled();
      expect(newPerks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tierLevel: "silver",
          preferredHomeCount: 3,
          bonusPercent: 3,
        })
      );
    });
  });

  describe("calculatePayoutBonus", () => {
    const createMockModels = (isPreferred, homeCount, config = null) => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 0,
        bonusPercent: 0,
        update: jest.fn().mockResolvedValue(true),
      };

      return {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue(isPreferred ? { cleanerId: 100, homeId: 1 } : null),
          count: jest.fn().mockResolvedValue(homeCount),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn().mockResolvedValue(mockPerks),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(config),
        },
        mockPerks,
      };
    };

    it("should return no bonus for non-preferred job", async () => {
      const models = createMockModels(false, 0);
      const grossAmount = 10000; // $100 in cents
      const platformFeePercent = 10;

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, grossAmount, platformFeePercent, models
      );

      expect(result.isPreferredJob).toBe(false);
      expect(result.bonusApplied).toBe(false);
      expect(result.bonusAmountCents).toBe(0);
      expect(result.adjustedPlatformFee).toBe(1000); // 10% of $100
      expect(result.adjustedNetAmount).toBe(9000); // $90
    });

    it("should return no bonus for bronze tier preferred job", async () => {
      const models = createMockModels(true, 1); // 1 home = bronze, 0% bonus

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, 10000, 10, models
      );

      expect(result.isPreferredJob).toBe(true);
      expect(result.bonusApplied).toBe(false);
      expect(result.bonusPercent).toBe(0);
      expect(result.tierLevel).toBe("bronze");
    });

    it("should calculate silver tier bonus correctly", async () => {
      // Update mock to return silver tier
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "silver",
        preferredHomeCount: 3,
        bonusPercent: 3,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
          count: jest.fn().mockResolvedValue(3),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const grossAmount = 10000; // $100 in cents
      const platformFeePercent = 10;

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, grossAmount, platformFeePercent, models
      );

      expect(result.isPreferredJob).toBe(true);
      expect(result.bonusApplied).toBe(true);
      expect(result.bonusPercent).toBe(3);
      expect(result.tierLevel).toBe("silver");

      // Platform fee is $10 (10% of $100)
      // Bonus is 3% of platform fee = $0.30
      expect(result.originalPlatformFee).toBe(1000);
      expect(result.bonusAmountCents).toBe(30); // 3% of $10
      expect(result.adjustedPlatformFee).toBe(970); // $10 - $0.30
      expect(result.adjustedNetAmount).toBe(9030); // $100 - $9.70
    });

    it("should calculate gold tier bonus correctly", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 7,
        bonusPercent: 5,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
          count: jest.fn().mockResolvedValue(7),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, 10000, 10, models
      );

      expect(result.bonusPercent).toBe(5);
      expect(result.tierLevel).toBe("gold");
      expect(result.bonusAmountCents).toBe(50); // 5% of $10
      expect(result.adjustedPlatformFee).toBe(950); // $10 - $0.50
      expect(result.adjustedNetAmount).toBe(9050); // $100 - $9.50
    });

    it("should calculate platinum tier bonus correctly", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
          count: jest.fn().mockResolvedValue(15),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, 10000, 10, models
      );

      expect(result.bonusPercent).toBe(7);
      expect(result.tierLevel).toBe("platinum");
      expect(result.bonusAmountCents).toBe(70); // 7% of $10
      expect(result.adjustedPlatformFee).toBe(930); // $10 - $0.70
      expect(result.adjustedNetAmount).toBe(9070); // $100 - $9.30
    });

    it("should handle larger job amounts correctly", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 8,
        bonusPercent: 5,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
          count: jest.fn().mockResolvedValue(8),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const grossAmount = 50000; // $500 in cents
      const platformFeePercent = 10;

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, grossAmount, platformFeePercent, models
      );

      // Platform fee is $50 (10% of $500)
      // Bonus is 5% of platform fee = $2.50
      expect(result.originalPlatformFee).toBe(5000);
      expect(result.bonusAmountCents).toBe(250); // 5% of $50
      expect(result.adjustedPlatformFee).toBe(4750); // $50 - $2.50
      expect(result.adjustedNetAmount).toBe(45250); // $500 - $47.50
    });
  });

  describe("getCleanerPerkStatus", () => {
    it("should return perk status with next tier info", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "silver",
        preferredHomeCount: 4,
        bonusPercent: 3,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        lastCalculatedAt: new Date(),
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(4),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.getCleanerPerkStatus(100, models);

      expect(result.cleanerId).toBe(100);
      expect(result.tier).toBe("silver");
      expect(result.preferredHomeCount).toBe(4);
      expect(result.bonusPercent).toBe(3);
      expect(result.nextTier).toBe("gold");
      expect(result.homesNeededForNextTier).toBe(2); // Need 6 for gold, have 4
      expect(result.tierBenefits).toContain("3% bonus on preferred jobs");
    });

    it("should return null for next tier when at platinum", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: true,
        lastCalculatedAt: new Date(),
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(15),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.getCleanerPerkStatus(100, models);

      expect(result.tier).toBe("platinum");
      expect(result.nextTier).toBeNull();
      expect(result.homesNeededForNextTier).toBe(0);
      expect(result.tierBenefits).toContain("7% bonus on preferred jobs");
      expect(result.tierBenefits).toContain("Faster payouts (24h)");
      expect(result.tierBenefits).toContain("Early access to new homes");
    });
  });

  describe("getTierBenefits", () => {
    const config = {
      bronzeBonusPercent: 0,
      silverBonusPercent: 3,
      goldBonusPercent: 5,
      goldFasterPayouts: true,
      goldPayoutHours: 24,
      platinumBonusPercent: 7,
      platinumFasterPayouts: true,
      platinumPayoutHours: 24,
      platinumEarlyAccess: true,
    };

    it("should return bronze tier benefits", () => {
      const benefits = PreferredCleanerPerksService.getTierBenefits("bronze", config);

      expect(benefits).toContain("Build your reputation");
      expect(benefits).toContain("Become preferred at more homes to unlock perks");
    });

    it("should return silver tier benefits", () => {
      const benefits = PreferredCleanerPerksService.getTierBenefits("silver", config);

      expect(benefits).toContain("3% bonus on preferred jobs");
      expect(benefits).toHaveLength(1);
    });

    it("should return gold tier benefits", () => {
      const benefits = PreferredCleanerPerksService.getTierBenefits("gold", config);

      expect(benefits).toContain("5% bonus on preferred jobs");
      expect(benefits).toContain("Faster payouts (24h)");
      expect(benefits).toHaveLength(2);
    });

    it("should return platinum tier benefits", () => {
      const benefits = PreferredCleanerPerksService.getTierBenefits("platinum", config);

      expect(benefits).toContain("7% bonus on preferred jobs");
      expect(benefits).toContain("Faster payouts (24h)");
      expect(benefits).toContain("Early access to new homes");
      expect(benefits).toHaveLength(3);
    });
  });

  describe("getCleanersByTier", () => {
    it("should return cleaners at specified tier", async () => {
      const mockRecords = [
        { cleanerId: 100, preferredHomeCount: 7, lastCalculatedAt: new Date() },
        { cleanerId: 101, preferredHomeCount: 8, lastCalculatedAt: new Date() },
      ];

      const models = {
        CleanerPreferredPerks: {
          findAll: jest.fn().mockResolvedValue(mockRecords),
        },
      };

      const result = await PreferredCleanerPerksService.getCleanersByTier("gold", models);

      expect(result).toEqual(mockRecords);
      expect(models.CleanerPreferredPerks.findAll).toHaveBeenCalledWith({
        where: { tierLevel: "gold" },
        attributes: ["cleanerId", "preferredHomeCount", "lastCalculatedAt"],
      });
    });
  });

  describe("getCleanerPerks", () => {
    it("should return current perks for a cleaner", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 8,
        bonusPercent: 5,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(8),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.getCleanerPerks(100, models);

      expect(result.tierLevel).toBe("gold");
      expect(result.fasterPayouts).toBe(true);
      expect(result.payoutHours).toBe(24);
      expect(result.earlyAccess).toBe(false);
      expect(result.bonusPercent).toBe(5);
    });

    it("should return platinum perks with early access", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: true,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(15),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.getCleanerPerks(100, models);

      expect(result.tierLevel).toBe("platinum");
      expect(result.fasterPayouts).toBe(true);
      expect(result.earlyAccess).toBe(true);
    });

    it("should respect owner disabling faster payouts in config", async () => {
      const configWithDisabledFasterPayouts = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: false, // Owner disabled
        goldPayoutHours: 48,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const mockPerks = {
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 8,
        bonusPercent: 5,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(8),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(configWithDisabledFasterPayouts),
        },
      };

      const result = await PreferredCleanerPerksService.getCleanerPerks(100, models);

      expect(result.tierLevel).toBe("gold");
      expect(result.fasterPayouts).toBe(false);
      expect(result.payoutHours).toBe(48);
    });

    it("should respect owner disabling early access in config", async () => {
      const configWithDisabledEarlyAccess = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: false, // Owner disabled
      };

      const mockPerks = {
        cleanerId: 100,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          count: jest.fn().mockResolvedValue(15),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(configWithDisabledEarlyAccess),
        },
      };

      const result = await PreferredCleanerPerksService.getCleanerPerks(100, models);

      expect(result.tierLevel).toBe("platinum");
      expect(result.earlyAccess).toBe(false);
    });
  });

  describe("calculatePayoutBonus - fasterPayouts and payoutHours", () => {
    it("should return fasterPayouts and payoutHours for non-preferred job", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 8,
        bonusPercent: 5,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue(null), // Not preferred at home
          count: jest.fn().mockResolvedValue(8),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, 10000, 10, models
      );

      expect(result.isPreferredJob).toBe(false);
      expect(result.fasterPayouts).toBe(true);
      expect(result.payoutHours).toBe(24);
      expect(result.tierLevel).toBe("gold");
    });

    it("should return fasterPayouts and payoutHours for preferred job with bonus", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: true,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
          count: jest.fn().mockResolvedValue(15),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, 10000, 10, models
      );

      expect(result.isPreferredJob).toBe(true);
      expect(result.bonusApplied).toBe(true);
      expect(result.fasterPayouts).toBe(true);
      expect(result.payoutHours).toBe(24);
    });

    it("should return fasterPayouts=false when owner disables it", async () => {
      const configWithDisabledFasterPayouts = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: false, // Owner disabled
        goldPayoutHours: 48,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const mockPerks = {
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 8,
        bonusPercent: 5,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
          count: jest.fn().mockResolvedValue(8),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(configWithDisabledFasterPayouts),
        },
      };

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, 10000, 10, models
      );

      expect(result.fasterPayouts).toBe(false);
      expect(result.payoutHours).toBe(48);
    });

    it("should return bronze tier perks for new cleaner", async () => {
      const mockPerks = {
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 1,
        bonusPercent: 0,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const models = {
        HomePreferredCleaner: {
          findOne: jest.fn().mockResolvedValue({ cleanerId: 100, homeId: 1 }),
          count: jest.fn().mockResolvedValue(1),
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockResolvedValue(mockPerks),
          create: jest.fn(),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };

      const result = await PreferredCleanerPerksService.calculatePayoutBonus(
        100, 1, 10000, 10, models
      );

      expect(result.tierLevel).toBe("bronze");
      expect(result.bonusApplied).toBe(false);
      expect(result.fasterPayouts).toBe(false);
      expect(result.payoutHours).toBe(48);
    });
  });

  describe("recalculateAllTiers", () => {
    it("should recalculate tiers for all cleaners with preferred status", async () => {
      const mockPerks1 = { update: jest.fn().mockResolvedValue(true) };
      const mockPerks2 = { update: jest.fn().mockResolvedValue(true) };

      let findOneCallCount = 0;
      const models = {
        HomePreferredCleaner: {
          findAll: jest.fn().mockResolvedValue([
            { cleanerId: 100 },
            { cleanerId: 101 },
          ]),
          count: jest.fn()
            .mockResolvedValueOnce(3) // Cleaner 100 has 3 homes
            .mockResolvedValueOnce(7), // Cleaner 101 has 7 homes
        },
        CleanerPreferredPerks: {
          findOne: jest.fn().mockImplementation(() => {
            findOneCallCount++;
            return Promise.resolve(findOneCallCount <= 2 ? mockPerks1 : mockPerks2);
          }),
          create: jest.fn(),
          update: jest.fn().mockResolvedValue([0]),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue(null),
        },
        sequelize: {
          fn: jest.fn().mockReturnValue("DISTINCT"),
          col: jest.fn().mockReturnValue("cleanerId"),
        },
      };

      const result = await PreferredCleanerPerksService.recalculateAllTiers(models);

      expect(result.totalCleanersUpdated).toBe(2);
    });
  });
});
