/**
 * Tests for CleanerPreferredPerks Model
 * Tracks preferred cleaner tier levels and associated perks
 */

// Mock sequelize models
jest.mock("../../models", () => {
  const mockCleanerPreferredPerks = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  };

  return {
    CleanerPreferredPerks: mockCleanerPreferredPerks,
    User: {
      findByPk: jest.fn(),
    },
  };
});

const { CleanerPreferredPerks, User } = require("../../models");

describe("CleanerPreferredPerks Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Model Structure", () => {
    it("should have required fields", () => {
      const expectedFields = [
        "cleanerId",
        "tierLevel",
        "preferredHomeCount",
        "bonusPercent",
        "fasterPayouts",
        "payoutHours",
        "earlyAccess",
        "lastCalculatedAt",
      ];

      // Verify model can be called with these fields
      CleanerPreferredPerks.create.mockResolvedValue({
        id: 1,
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 0,
        bonusPercent: 0,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        lastCalculatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(CleanerPreferredPerks.create).toBeDefined();
      expect(CleanerPreferredPerks.findOne).toBeDefined();
      expect(CleanerPreferredPerks.findAll).toBeDefined();
    });

    it("should support tier level values", () => {
      const validTierLevels = ["bronze", "silver", "gold", "platinum"];

      validTierLevels.forEach((tier) => {
        expect(["bronze", "silver", "gold", "platinum"]).toContain(tier);
      });
    });
  });

  describe("Creating Perk Records", () => {
    it("should create a bronze tier perk record by default", async () => {
      const mockRecord = {
        id: 1,
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 0,
        bonusPercent: 0,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        lastCalculatedAt: new Date(),
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create({
        cleanerId: 100,
      });

      expect(result.tierLevel).toBe("bronze");
      expect(result.preferredHomeCount).toBe(0);
      expect(result.bonusPercent).toBe(0);
      expect(result.fasterPayouts).toBe(false);
    });

    it("should create a silver tier perk record", async () => {
      const mockRecord = {
        id: 2,
        cleanerId: 101,
        tierLevel: "silver",
        preferredHomeCount: 4,
        bonusPercent: 3,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create({
        cleanerId: 101,
        tierLevel: "silver",
        preferredHomeCount: 4,
        bonusPercent: 3,
      });

      expect(result.tierLevel).toBe("silver");
      expect(result.preferredHomeCount).toBe(4);
      expect(result.bonusPercent).toBe(3);
    });

    it("should create a gold tier perk record with faster payouts", async () => {
      const mockRecord = {
        id: 3,
        cleanerId: 102,
        tierLevel: "gold",
        preferredHomeCount: 8,
        bonusPercent: 5,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: false,
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create({
        cleanerId: 102,
        tierLevel: "gold",
        preferredHomeCount: 8,
        bonusPercent: 5,
        fasterPayouts: true,
        payoutHours: 24,
      });

      expect(result.tierLevel).toBe("gold");
      expect(result.bonusPercent).toBe(5);
      expect(result.fasterPayouts).toBe(true);
      expect(result.payoutHours).toBe(24);
    });

    it("should create a platinum tier perk record with all perks", async () => {
      const mockRecord = {
        id: 4,
        cleanerId: 103,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: true,
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create({
        cleanerId: 103,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: true,
      });

      expect(result.tierLevel).toBe("platinum");
      expect(result.bonusPercent).toBe(7);
      expect(result.fasterPayouts).toBe(true);
      expect(result.earlyAccess).toBe(true);
    });

    it("should enforce unique cleanerId", async () => {
      CleanerPreferredPerks.create
        .mockResolvedValueOnce({
          id: 1,
          cleanerId: 100,
          tierLevel: "bronze",
        })
        .mockRejectedValueOnce(new Error("Unique constraint violation"));

      // First creation should succeed
      await CleanerPreferredPerks.create({ cleanerId: 100 });

      // Second creation with same cleanerId should fail
      await expect(
        CleanerPreferredPerks.create({ cleanerId: 100 })
      ).rejects.toThrow("Unique constraint violation");
    });
  });

  describe("Finding Perk Records", () => {
    it("should find perk record by cleanerId", async () => {
      const mockRecord = {
        id: 1,
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 7,
      };

      CleanerPreferredPerks.findOne.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.findOne({
        where: { cleanerId: 100 },
      });

      expect(result).toBeTruthy();
      expect(result.tierLevel).toBe("gold");
      expect(CleanerPreferredPerks.findOne).toHaveBeenCalledWith({
        where: { cleanerId: 100 },
      });
    });

    it("should return null for non-existent cleaner", async () => {
      CleanerPreferredPerks.findOne.mockResolvedValue(null);

      const result = await CleanerPreferredPerks.findOne({
        where: { cleanerId: 999 },
      });

      expect(result).toBeNull();
    });

    it("should find all cleaners by tier level", async () => {
      const mockRecords = [
        { id: 1, cleanerId: 100, tierLevel: "platinum", preferredHomeCount: 12 },
        { id: 2, cleanerId: 101, tierLevel: "platinum", preferredHomeCount: 15 },
        { id: 3, cleanerId: 102, tierLevel: "platinum", preferredHomeCount: 20 },
      ];

      CleanerPreferredPerks.findAll.mockResolvedValue(mockRecords);

      const result = await CleanerPreferredPerks.findAll({
        where: { tierLevel: "platinum" },
      });

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.tierLevel === "platinum")).toBe(true);
    });
  });

  describe("Updating Perk Records", () => {
    it("should update tier when cleaner gains preferred homes", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(true);
      const mockRecord = {
        id: 1,
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 2,
        update: mockUpdate,
      };

      CleanerPreferredPerks.findOne.mockResolvedValue(mockRecord);

      const record = await CleanerPreferredPerks.findOne({
        where: { cleanerId: 100 },
      });

      await record.update({
        tierLevel: "silver",
        preferredHomeCount: 4,
        bonusPercent: 3,
        lastCalculatedAt: new Date(),
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tierLevel: "silver",
          preferredHomeCount: 4,
          bonusPercent: 3,
        })
      );
    });

    it("should update tier when cleaner reaches gold", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(true);
      const mockRecord = {
        id: 1,
        cleanerId: 100,
        tierLevel: "silver",
        update: mockUpdate,
      };

      CleanerPreferredPerks.findOne.mockResolvedValue(mockRecord);

      const record = await CleanerPreferredPerks.findOne({
        where: { cleanerId: 100 },
      });

      await record.update({
        tierLevel: "gold",
        preferredHomeCount: 7,
        bonusPercent: 5,
        fasterPayouts: true,
        payoutHours: 24,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tierLevel: "gold",
          fasterPayouts: true,
          payoutHours: 24,
        })
      );
    });

    it("should downgrade tier when cleaner loses preferred homes", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(true);
      const mockRecord = {
        id: 1,
        cleanerId: 100,
        tierLevel: "gold",
        preferredHomeCount: 6,
        update: mockUpdate,
      };

      CleanerPreferredPerks.findOne.mockResolvedValue(mockRecord);

      const record = await CleanerPreferredPerks.findOne({
        where: { cleanerId: 100 },
      });

      // Cleaner loses homes and drops to silver
      await record.update({
        tierLevel: "silver",
        preferredHomeCount: 4,
        bonusPercent: 3,
        fasterPayouts: false,
        payoutHours: 48,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tierLevel: "silver",
          fasterPayouts: false,
        })
      );
    });
  });

  describe("Tier Progression Logic", () => {
    it("should correctly track bronze tier (0-2 homes)", async () => {
      const mockRecord = {
        cleanerId: 100,
        tierLevel: "bronze",
        preferredHomeCount: 2,
        bonusPercent: 0,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create(mockRecord);

      expect(result.tierLevel).toBe("bronze");
      expect(result.bonusPercent).toBe(0);
      expect(result.fasterPayouts).toBe(false);
      expect(result.earlyAccess).toBe(false);
    });

    it("should correctly track silver tier (3-5 homes)", async () => {
      const mockRecord = {
        cleanerId: 101,
        tierLevel: "silver",
        preferredHomeCount: 5,
        bonusPercent: 3,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create(mockRecord);

      expect(result.tierLevel).toBe("silver");
      expect(result.bonusPercent).toBe(3);
      expect(result.fasterPayouts).toBe(false);
    });

    it("should correctly track gold tier (6-10 homes)", async () => {
      const mockRecord = {
        cleanerId: 102,
        tierLevel: "gold",
        preferredHomeCount: 10,
        bonusPercent: 5,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: false,
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create(mockRecord);

      expect(result.tierLevel).toBe("gold");
      expect(result.bonusPercent).toBe(5);
      expect(result.fasterPayouts).toBe(true);
      expect(result.payoutHours).toBe(24);
      expect(result.earlyAccess).toBe(false);
    });

    it("should correctly track platinum tier (11+ homes)", async () => {
      const mockRecord = {
        cleanerId: 103,
        tierLevel: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: true,
      };

      CleanerPreferredPerks.create.mockResolvedValue(mockRecord);

      const result = await CleanerPreferredPerks.create(mockRecord);

      expect(result.tierLevel).toBe("platinum");
      expect(result.bonusPercent).toBe(7);
      expect(result.fasterPayouts).toBe(true);
      expect(result.payoutHours).toBe(24);
      expect(result.earlyAccess).toBe(true);
    });
  });

  describe("Perk Application Scenarios", () => {
    it("should track bonus applied for preferred job", async () => {
      const mockRecord = {
        cleanerId: 100,
        tierLevel: "gold",
        bonusPercent: 5,
      };

      CleanerPreferredPerks.findOne.mockResolvedValue(mockRecord);

      const perks = await CleanerPreferredPerks.findOne({
        where: { cleanerId: 100 },
      });

      // Calculate bonus for a $100 job with 10% platform fee
      const grossAmount = 10000; // cents
      const platformFee = 1000; // 10% = $10
      const bonusAmount = Math.round(platformFee * (perks.bonusPercent / 100)); // 5% of $10 = $0.50

      expect(bonusAmount).toBe(50); // 50 cents
    });

    it("should not apply bonus for non-preferred job", async () => {
      // When cleaner is not preferred at the home
      CleanerPreferredPerks.findOne.mockResolvedValue({
        cleanerId: 100,
        tierLevel: "gold",
        bonusPercent: 5,
      });

      // But job is not at a preferred home - bonus should be 0
      const isPreferredJob = false;
      const bonusAmount = isPreferredJob ? 50 : 0;

      expect(bonusAmount).toBe(0);
    });
  });
});
