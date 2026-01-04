const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  IncentiveConfig: {
    getActive: jest.fn(),
    getFormattedConfig: jest.fn(),
    updateIncentives: jest.fn(),
    getHistory: jest.fn(),
  },
}));

// Mock IncentiveService
jest.mock("../../services/IncentiveService", () => ({
  isCleanerEligible: jest.fn(),
  isHomeownerEligible: jest.fn(),
}));

const { User, IncentiveConfig } = require("../../models");
const IncentiveService = require("../../services/IncentiveService");

const incentivesRouter = require("../../routes/api/v1/incentivesRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/incentives", incentivesRouter);

describe("Incentives Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const ownerToken = jwt.sign({ userId: 1 }, secretKey);
  const cleanerToken = jwt.sign({ userId: 2 }, secretKey);
  const homeownerToken = jwt.sign({ userId: 3 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /current (Public)", () => {
    it("should return incentive config when available", async () => {
      const mockConfig = {
        cleaner: {
          enabled: true,
          feeReductionPercent: 1.0,
          eligibilityDays: 30,
          maxCleanings: 5,
        },
        homeowner: {
          enabled: true,
          discountPercent: 0.1,
          maxCleanings: 4,
        },
      };

      IncentiveConfig.getFormattedConfig.mockResolvedValue(mockConfig);

      const res = await request(app).get("/api/v1/incentives/current");

      expect(res.status).toBe(200);
      expect(res.body.cleaner.enabled).toBe(true);
      expect(res.body.cleaner.feeReductionPercent).toBe(1.0);
      expect(res.body.cleaner.eligibilityDays).toBe(30);
      expect(res.body.cleaner.maxCleanings).toBe(5);
      expect(res.body.homeowner.enabled).toBe(true);
      expect(res.body.homeowner.discountPercent).toBe(0.1);
      expect(res.body.homeowner.maxCleanings).toBe(4);
    });

    it("should return defaults when no config exists", async () => {
      const mockConfig = {
        cleaner: {
          enabled: false,
          feeReductionPercent: 1.0,
          eligibilityDays: 30,
          maxCleanings: 5,
        },
        homeowner: {
          enabled: false,
          discountPercent: 0.1,
          maxCleanings: 4,
        },
      };

      IncentiveConfig.getFormattedConfig.mockResolvedValue(mockConfig);

      const res = await request(app).get("/api/v1/incentives/current");

      expect(res.status).toBe(200);
      expect(res.body.cleaner.enabled).toBe(false);
      expect(res.body.homeowner.enabled).toBe(false);
    });

    it("should return disabled incentives on error", async () => {
      IncentiveConfig.getFormattedConfig.mockRejectedValue(
        new Error("DB Error")
      );

      const res = await request(app).get("/api/v1/incentives/current");

      expect(res.status).toBe(200);
      expect(res.body.cleaner.enabled).toBe(false);
      expect(res.body.homeowner.enabled).toBe(false);
    });

    it("should not require authentication", async () => {
      IncentiveConfig.getFormattedConfig.mockResolvedValue({
        cleaner: { enabled: false, feeReductionPercent: 0, eligibilityDays: 0, maxCleanings: 0 },
        homeowner: { enabled: false, discountPercent: 0, maxCleanings: 0 },
      });

      const res = await request(app).get("/api/v1/incentives/current");

      expect(res.status).toBe(200);
    });
  });

  describe("GET /config (Owner Only)", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app).get("/api/v1/incentives/config");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 403 for non-owner user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const res = await request(app)
        .get("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Owner access required");
    });

    it("should return 403 for homeowner user", async () => {
      User.findByPk.mockResolvedValue({ id: 3, type: "homeowner" });

      const res = await request(app)
        .get("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Owner access required");
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/incentives/config")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("should return full config for owner when database config exists", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const mockActiveConfig = {
        id: 1,
        cleanerIncentiveEnabled: true,
        cleanerFeeReductionPercent: 1.0,
        cleanerEligibilityDays: 30,
        cleanerMaxCleanings: 5,
        homeownerIncentiveEnabled: true,
        homeownerDiscountPercent: 0.1,
        homeownerMaxCleanings: 4,
        isActive: true,
        updatedBy: 1,
        changeNote: "Initial config",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockFormattedConfig = {
        cleaner: {
          enabled: true,
          feeReductionPercent: 1.0,
          eligibilityDays: 30,
          maxCleanings: 5,
        },
        homeowner: {
          enabled: true,
          discountPercent: 0.1,
          maxCleanings: 4,
        },
      };

      IncentiveConfig.getActive.mockResolvedValue(mockActiveConfig);
      IncentiveConfig.getFormattedConfig.mockResolvedValue(mockFormattedConfig);

      const res = await request(app)
        .get("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("database");
      expect(res.body.config.id).toBe(mockActiveConfig.id);
      expect(res.body.config.cleanerIncentiveEnabled).toBe(true);
      expect(res.body.config.homeownerIncentiveEnabled).toBe(true);
      expect(res.body.formattedConfig).toEqual(mockFormattedConfig);
    });

    it("should return defaults when no database config exists", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      IncentiveConfig.getActive.mockResolvedValue(null);
      IncentiveConfig.getFormattedConfig.mockResolvedValue({
        cleaner: { enabled: false, feeReductionPercent: 1.0, eligibilityDays: 30, maxCleanings: 5 },
        homeowner: { enabled: false, discountPercent: 0.1, maxCleanings: 4 },
      });

      const res = await request(app)
        .get("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("defaults");
      expect(res.body.config).toBeNull();
      expect(res.body.formattedConfig).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      IncentiveConfig.getActive.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch incentive configuration");
    });
  });

  describe("PUT /config (Owner Only)", () => {
    const validIncentiveData = {
      cleanerIncentiveEnabled: true,
      cleanerFeeReductionPercent: 1.0,
      cleanerEligibilityDays: 30,
      cleanerMaxCleanings: 5,
      homeownerIncentiveEnabled: true,
      homeownerDiscountPercent: 0.1,
      homeownerMaxCleanings: 4,
      changeNote: "Enable all incentives",
    };

    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .put("/api/v1/incentives/config")
        .send(validIncentiveData);

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send(validIncentiveData);

      expect(res.status).toBe(403);
    });

    it("should return 400 when cleanerIncentiveEnabled is not boolean", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...validIncentiveData, cleanerIncentiveEnabled: "yes" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("cleanerIncentiveEnabled must be a boolean");
    });

    it("should return 400 when homeownerIncentiveEnabled is not boolean", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...validIncentiveData, homeownerIncentiveEnabled: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("homeownerIncentiveEnabled must be a boolean");
    });

    it("should return 400 when cleanerFeeReductionPercent is out of range", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...validIncentiveData, cleanerFeeReductionPercent: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "cleanerFeeReductionPercent must be a number between 0 and 1"
      );
    });

    it("should return 400 when cleanerEligibilityDays is out of range", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...validIncentiveData, cleanerEligibilityDays: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "cleanerEligibilityDays must be a number between 1 and 365"
      );
    });

    it("should return 400 when cleanerMaxCleanings is out of range", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...validIncentiveData, cleanerMaxCleanings: 101 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "cleanerMaxCleanings must be a number between 1 and 100"
      );
    });

    it("should return 400 when homeownerDiscountPercent is out of range", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...validIncentiveData, homeownerDiscountPercent: -0.1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "homeownerDiscountPercent must be a number between 0 and 1"
      );
    });

    it("should return 400 when homeownerMaxCleanings is out of range", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...validIncentiveData, homeownerMaxCleanings: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "homeownerMaxCleanings must be a number between 1 and 100"
      );
    });

    it("should successfully update incentives with valid data", async () => {
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "owner",
        username: "owner1",
      });

      const mockNewConfig = {
        id: 2,
        ...validIncentiveData,
        isActive: true,
        updatedBy: 1,
        createdAt: new Date(),
      };

      IncentiveConfig.updateIncentives.mockResolvedValue(mockNewConfig);
      IncentiveConfig.getFormattedConfig.mockResolvedValue({
        cleaner: { enabled: true, feeReductionPercent: 1.0, eligibilityDays: 30, maxCleanings: 5 },
        homeowner: { enabled: true, discountPercent: 0.1, maxCleanings: 4 },
      });

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(validIncentiveData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Incentive configuration updated successfully");
      expect(res.body.config.cleanerIncentiveEnabled).toBe(true);
      expect(res.body.config.homeownerIncentiveEnabled).toBe(true);
      expect(IncentiveConfig.updateIncentives).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanerIncentiveEnabled: true,
          homeownerIncentiveEnabled: true,
        }),
        1,
        "Enable all incentives"
      );
    });

    it("should handle update without changeNote", async () => {
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "owner",
        username: "owner1",
      });
      IncentiveConfig.updateIncentives.mockResolvedValue({ id: 2 });
      IncentiveConfig.getFormattedConfig.mockResolvedValue({
        cleaner: { enabled: true },
        homeowner: { enabled: true },
      });

      const { changeNote, ...dataWithoutNote } = validIncentiveData;

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(dataWithoutNote);

      expect(res.status).toBe(200);
      expect(IncentiveConfig.updateIncentives).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        null
      );
    });

    it("should handle database errors gracefully", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      IncentiveConfig.updateIncentives.mockRejectedValue(
        new Error("Transaction failed")
      );

      const res = await request(app)
        .put("/api/v1/incentives/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(validIncentiveData);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update incentive configuration");
    });
  });

  describe("GET /history (Owner Only)", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app).get("/api/v1/incentives/history");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const res = await request(app)
        .get("/api/v1/incentives/history")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(res.status).toBe(403);
    });

    it("should return incentive history for owner", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const mockHistory = [
        {
          id: 2,
          isActive: true,
          createdAt: new Date("2024-01-15"),
          cleanerIncentiveEnabled: true,
          cleanerFeeReductionPercent: 1.0,
          cleanerEligibilityDays: 30,
          cleanerMaxCleanings: 5,
          homeownerIncentiveEnabled: true,
          homeownerDiscountPercent: 0.1,
          homeownerMaxCleanings: 4,
          changeNote: "Enable incentives",
          updatedByUser: { id: 1, username: "owner1", email: "owner@test.com" },
        },
        {
          id: 1,
          isActive: false,
          createdAt: new Date("2024-01-01"),
          cleanerIncentiveEnabled: false,
          cleanerFeeReductionPercent: 1.0,
          cleanerEligibilityDays: 30,
          cleanerMaxCleanings: 5,
          homeownerIncentiveEnabled: false,
          homeownerDiscountPercent: 0.1,
          homeownerMaxCleanings: 4,
          changeNote: null,
          updatedByUser: null,
        },
      ];

      IncentiveConfig.getHistory.mockResolvedValue(mockHistory);

      const res = await request(app)
        .get("/api/v1/incentives/history")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.history).toHaveLength(2);
      expect(res.body.history[0].isActive).toBe(true);
      expect(res.body.history[0].updatedBy.username).toBe("owner1");
      expect(res.body.history[0].cleaner.enabled).toBe(true);
      expect(res.body.history[0].homeowner.enabled).toBe(true);
      expect(res.body.history[1].updatedBy).toBeNull();
    });

    it("should accept limit parameter", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      IncentiveConfig.getHistory.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/incentives/history?limit=5")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(IncentiveConfig.getHistory).toHaveBeenCalledWith(5);
    });

    it("should use default limit of 20", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      IncentiveConfig.getHistory.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/incentives/history")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(IncentiveConfig.getHistory).toHaveBeenCalledWith(20);
    });

    it("should handle database errors gracefully", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      IncentiveConfig.getHistory.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/api/v1/incentives/history")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch incentive history");
    });
  });

  describe("GET /cleaner-eligibility (Authenticated)", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app).get(
        "/api/v1/incentives/cleaner-eligibility"
      );

      expect(res.status).toBe(401);
    });

    it("should return 401 when user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/incentives/cleaner-eligibility")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("User not found");
    });

    it("should return eligibility status for cleaner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });
      IncentiveService.isCleanerEligible.mockResolvedValue({
        eligible: true,
        remainingCleanings: 3,
        completedCleanings: 2,
        feeReductionPercent: 1.0,
        config: {
          maxCleanings: 5,
          eligibilityDays: 30,
          feeReductionPercent: 1.0,
        },
      });

      const res = await request(app)
        .get("/api/v1/incentives/cleaner-eligibility")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.eligible).toBe(true);
      expect(res.body.remainingCleanings).toBe(3);
      expect(IncentiveService.isCleanerEligible).toHaveBeenCalledWith(2);
    });

    it("should handle errors gracefully", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });
      IncentiveService.isCleanerEligible.mockRejectedValue(
        new Error("Service error")
      );

      const res = await request(app)
        .get("/api/v1/incentives/cleaner-eligibility")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to check eligibility");
    });
  });

  describe("GET /homeowner-eligibility (Authenticated)", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app).get(
        "/api/v1/incentives/homeowner-eligibility"
      );

      expect(res.status).toBe(401);
    });

    it("should return eligibility status for homeowner", async () => {
      User.findByPk.mockResolvedValue({ id: 3, type: "homeowner" });
      IncentiveService.isHomeownerEligible.mockResolvedValue({
        eligible: true,
        remainingCleanings: 2,
        completedAppointments: 2,
        discountPercent: 0.1,
        config: {
          maxCleanings: 4,
          discountPercent: 0.1,
        },
      });

      const res = await request(app)
        .get("/api/v1/incentives/homeowner-eligibility")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.eligible).toBe(true);
      expect(res.body.remainingCleanings).toBe(2);
      expect(res.body.discountPercent).toBe(0.1);
      expect(IncentiveService.isHomeownerEligible).toHaveBeenCalledWith(3);
    });

    it("should handle errors gracefully", async () => {
      User.findByPk.mockResolvedValue({ id: 3, type: "homeowner" });
      IncentiveService.isHomeownerEligible.mockRejectedValue(
        new Error("Service error")
      );

      const res = await request(app)
        .get("/api/v1/incentives/homeowner-eligibility")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to check eligibility");
    });
  });
});
