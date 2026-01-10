/**
 * Tests for Preferred Cleaner Perks API Endpoints
 * Tests /my-perk-status and /perk-tier-info endpoints
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock PreferredCleanerPerksService
jest.mock("../../services/PreferredCleanerPerksService", () => ({
  getCleanerPerkStatus: jest.fn(),
  getPerksConfig: jest.fn(),
  getTierBenefits: jest.fn(),
}));

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    return value.replace("encrypted_", "");
  }),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  HomePreferredCleaner: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  CleanerPreferredPerks: {
    findOne: jest.fn(),
  },
  PreferredPerksConfig: {
    findOne: jest.fn(),
  },
}));

const { User } = require("../../models");
const PreferredCleanerPerksService = require("../../services/PreferredCleanerPerksService");

describe("Preferred Cleaner Perks Endpoints", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const preferredCleanerRouter = require("../../routes/api/v1/preferredCleanerRouter");
    app.use("/api/v1/preferred-cleaner", preferredCleanerRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /my-perk-status", () => {
    const cleanerId = 100;

    it("should return cleaner perk status", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      PreferredCleanerPerksService.getCleanerPerkStatus.mockResolvedValue({
        cleanerId: cleanerId,
        tier: "silver",
        preferredHomeCount: 4,
        bonusPercent: 3,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        nextTier: "gold",
        homesNeededForNextTier: 2,
        tierBenefits: ["3% bonus on preferred jobs"],
      });

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-perk-status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tier).toBe("silver");
      expect(res.body.preferredHomeCount).toBe(4);
      expect(res.body.bonusPercent).toBe(3);
      expect(res.body.nextTier).toBe("gold");
      expect(res.body.homesNeededForNextTier).toBe(2);
      expect(res.body.tierBenefits).toContain("3% bonus on preferred jobs");
    });

    it("should return bronze tier for new cleaner with no preferred homes", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      PreferredCleanerPerksService.getCleanerPerkStatus.mockResolvedValue({
        cleanerId: cleanerId,
        tier: "bronze",
        preferredHomeCount: 0,
        bonusPercent: 0,
        fasterPayouts: false,
        payoutHours: 48,
        earlyAccess: false,
        nextTier: "silver",
        homesNeededForNextTier: 3,
        tierBenefits: ["Build your reputation", "Become preferred at more homes to unlock perks"],
      });

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-perk-status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tier).toBe("bronze");
      expect(res.body.preferredHomeCount).toBe(0);
      expect(res.body.bonusPercent).toBe(0);
    });

    it("should return platinum tier with no next tier", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      PreferredCleanerPerksService.getCleanerPerkStatus.mockResolvedValue({
        cleanerId: cleanerId,
        tier: "platinum",
        preferredHomeCount: 15,
        bonusPercent: 7,
        fasterPayouts: true,
        payoutHours: 24,
        earlyAccess: true,
        nextTier: null,
        homesNeededForNextTier: 0,
        tierBenefits: ["7% bonus on preferred jobs", "Faster payouts (24h)", "Early access to new homes"],
      });

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-perk-status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tier).toBe("platinum");
      expect(res.body.nextTier).toBeNull();
      expect(res.body.earlyAccess).toBe(true);
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-perk-status");

      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not a cleaner", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 200,
        type: "homeowner",
      });

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-perk-status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Cleaner access required");
    });

    it("should return 500 if service throws error", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      PreferredCleanerPerksService.getCleanerPerkStatus.mockRejectedValue(
        new Error("Database error")
      );

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-perk-status")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch perk status");
    });
  });

  describe("GET /perk-tier-info", () => {
    const cleanerId = 100;

    it("should return all tier information", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      PreferredCleanerPerksService.getPerksConfig.mockResolvedValue({
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
      });

      PreferredCleanerPerksService.getTierBenefits
        .mockReturnValueOnce(["Build your reputation"])
        .mockReturnValueOnce(["3% bonus on preferred jobs"])
        .mockReturnValueOnce(["5% bonus on preferred jobs", "Faster payouts (24h)"])
        .mockReturnValueOnce(["7% bonus on preferred jobs", "Faster payouts (24h)", "Early access to new homes"]);

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/perk-tier-info")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tiers).toHaveLength(4);

      // Check bronze tier (serializer returns capitalized names)
      expect(res.body.tiers[0].name).toBe("Bronze");
      expect(res.body.tiers[0].minHomes).toBe(1);
      expect(res.body.tiers[0].maxHomes).toBe(2);
      expect(res.body.tiers[0].bonusPercent).toBe(0);

      // Check silver tier
      expect(res.body.tiers[1].name).toBe("Silver");
      expect(res.body.tiers[1].minHomes).toBe(3);
      expect(res.body.tiers[1].maxHomes).toBe(5);
      expect(res.body.tiers[1].bonusPercent).toBe(3);

      // Check gold tier
      expect(res.body.tiers[2].name).toBe("Gold");
      expect(res.body.tiers[2].minHomes).toBe(6);
      expect(res.body.tiers[2].maxHomes).toBe(10);
      expect(res.body.tiers[2].bonusPercent).toBe(5);
      expect(res.body.tiers[2].fasterPayouts).toBe(true);

      // Check platinum tier
      expect(res.body.tiers[3].name).toBe("Platinum");
      expect(res.body.tiers[3].minHomes).toBe(11);
      expect(res.body.tiers[3].maxHomes).toBeNull();
      expect(res.body.tiers[3].bonusPercent).toBe(7);
      expect(res.body.tiers[3].earlyAccess).toBe(true);
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .get("/api/v1/preferred-cleaner/perk-tier-info");

      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not a cleaner", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 200,
        type: "homeowner",
      });

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/perk-tier-info")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return 500 if service throws error", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      PreferredCleanerPerksService.getPerksConfig.mockRejectedValue(
        new Error("Config error")
      );

      const res = await request(app)
        .get("/api/v1/preferred-cleaner/perk-tier-info")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch tier info");
    });
  });
});
