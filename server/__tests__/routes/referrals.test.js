const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  ReferralConfig: {
    getActive: jest.fn(),
    getFormattedConfig: jest.fn(),
    updateConfig: jest.fn(),
    getHistory: jest.fn(),
  },
  Referral: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    countMonthlyReferrals: jest.fn(),
    getStats: jest.fn(),
  },
  sequelize: {},
  Sequelize: {
    Op: {
      gte: Symbol("gte"),
      lte: Symbol("lte"),
    },
  },
}));

// Mock ReferralService
jest.mock("../../services/ReferralService", () => ({
  validateReferralCode: jest.fn(),
  generateReferralCode: jest.fn(),
  getUserReferralStats: jest.fn(),
  getAvailableCredits: jest.fn(),
  applyCreditsToAppointment: jest.fn(),
  getCurrentPrograms: jest.fn(),
  getAllReferrals: jest.fn(),
  updateReferralStatus: jest.fn(),
}));

const models = require("../../models");
const { User, ReferralConfig, Referral } = models;
const ReferralService = require("../../services/ReferralService");

const referralRouter = require("../../routes/api/v1/referralRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/referrals", referralRouter);

describe("Referral Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const ownerToken = jwt.sign({ userId: 1 }, secretKey);
  const cleanerToken = jwt.sign({ userId: 2 }, secretKey);
  const homeownerToken = jwt.sign({ userId: 3 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================
  // PUBLIC ENDPOINTS
  // =====================

  describe("GET /validate/:code (Public)", () => {
    it("should validate a valid referral code", async () => {
      ReferralService.validateReferralCode.mockResolvedValue({
        valid: true,
        referrer: { id: 1, firstName: "John" },
        programType: "client_to_client",
        rewards: {
          referrerReward: 2500,
          referredReward: 2500,
          cleaningsRequired: 1,
        },
      });

      const response = await request(app)
        .get("/api/v1/referrals/validate/JOHN1234")
        .query({ userType: "homeowner" });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.referrer.firstName).toBe("John");
      expect(response.body.programType).toBe("client_to_client");
      expect(response.body.rewards.referrerReward).toBe(2500);
    });

    it("should return 400 for invalid code", async () => {
      ReferralService.validateReferralCode.mockResolvedValue({
        valid: false,
        error: "This referral code doesn't exist.",
        errorCode: "CODE_NOT_FOUND",
      });

      const response = await request(app)
        .get("/api/v1/referrals/validate/INVALID")
        .query({ userType: "homeowner" });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.errorCode).toBe("CODE_NOT_FOUND");
    });

    it("should return 400 for frozen account", async () => {
      ReferralService.validateReferralCode.mockResolvedValue({
        valid: false,
        error: "This referral code is no longer active.",
        errorCode: "ACCOUNT_FROZEN",
      });

      const response = await request(app)
        .get("/api/v1/referrals/validate/FROZEN123");

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe("ACCOUNT_FROZEN");
    });

    it("should return 500 on server error", async () => {
      ReferralService.validateReferralCode.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/v1/referrals/validate/JOHN1234");

      expect(response.status).toBe(500);
      expect(response.body.valid).toBe(false);
      expect(response.body.errorCode).toBe("SERVER_ERROR");
    });

    it("should default to homeowner userType", async () => {
      ReferralService.validateReferralCode.mockResolvedValue({
        valid: true,
        referrer: { firstName: "John" },
        programType: "client_to_client",
        rewards: {},
      });

      await request(app).get("/api/v1/referrals/validate/JOHN1234");

      expect(ReferralService.validateReferralCode).toHaveBeenCalledWith(
        "JOHN1234",
        "homeowner",
        expect.anything()
      );
    });
  });

  describe("GET /current (Public)", () => {
    it("should return active referral programs", async () => {
      ReferralService.getCurrentPrograms.mockResolvedValue({
        active: true,
        programs: [
          {
            type: "client_to_client",
            name: "Refer a Friend",
            description: "Give $25, Get $25",
            referrerReward: 2500,
            referredReward: 2500,
          },
        ],
      });

      const response = await request(app).get("/api/v1/referrals/current");

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(true);
      expect(response.body.programs).toHaveLength(1);
    });

    it("should return inactive when no programs", async () => {
      ReferralService.getCurrentPrograms.mockResolvedValue({
        active: false,
        programs: [],
      });

      const response = await request(app).get("/api/v1/referrals/current");

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
    });
  });

  // =====================
  // OWNER ENDPOINTS
  // =====================

  describe("GET /config (Owner)", () => {
    it("should return config for owner", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ReferralConfig.getActive.mockResolvedValue({ id: 1, isActive: true });
      ReferralConfig.getFormattedConfig.mockResolvedValue({
        clientToClient: { enabled: true, referrerReward: 2500 },
        clientToCleaner: { enabled: false },
        cleanerToCleaner: { enabled: false },
        cleanerToClient: { enabled: false },
      });

      const response = await request(app)
        .get("/api/v1/referrals/config")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.formattedConfig.clientToClient.enabled).toBe(true);
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/referrals/config")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
    });

    it("should return 401 without token", async () => {
      const response = await request(app).get("/api/v1/referrals/config");

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /config (Owner)", () => {
    const configUpdate = {
      clientToClient: {
        enabled: true,
        referrerReward: 3000,
        referredReward: 3000,
      },
      changeNote: "Updated rewards",
    };

    it("should update config for owner", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ReferralConfig.updateConfig.mockResolvedValue({
        id: 1,
        clientToClientEnabled: true,
        clientToClientReferrerReward: 3000,
      });
      ReferralConfig.getFormattedConfig.mockResolvedValue({
        clientToClient: { enabled: true, referrerReward: 3000 },
      });

      const response = await request(app)
        .put("/api/v1/referrals/config")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(configUpdate);

      expect(response.status).toBe(200);
      expect(ReferralConfig.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ clientToClient: configUpdate.clientToClient }),
        1,
        configUpdate.changeNote
      );
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 3, type: null }); // homeowner

      const response = await request(app)
        .put("/api/v1/referrals/config")
        .set("Authorization", `Bearer ${homeownerToken}`)
        .send(configUpdate);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /history (Owner)", () => {
    it("should return config history", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ReferralConfig.getHistory.mockResolvedValue([
        { id: 1, changeNote: "Initial setup", createdAt: new Date() },
        { id: 2, changeNote: "Updated rewards", createdAt: new Date() },
      ]);

      const response = await request(app)
        .get("/api/v1/referrals/history")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });
  });

  describe("GET /all (Owner)", () => {
    it("should return all referrals", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ReferralService.getAllReferrals.mockResolvedValue([
        {
          id: 1,
          referrer: { firstName: "John" },
          referred: { firstName: "Jane" },
          status: "pending",
        },
      ]);

      const response = await request(app)
        .get("/api/v1/referrals/all")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.referrals).toHaveLength(1);
      expect(response.body.count).toBe(1);
    });

    it("should pass filters to service", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ReferralService.getAllReferrals.mockResolvedValue([]);

      await request(app)
        .get("/api/v1/referrals/all")
        .query({ status: "pending", programType: "client_to_client" })
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(ReferralService.getAllReferrals).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", programType: "client_to_client" }),
        expect.anything()
      );
    });
  });

  describe("PATCH /:id/status (Owner)", () => {
    it("should update referral status", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ReferralService.updateReferralStatus.mockResolvedValue({
        id: 1,
        status: "cancelled",
        qualifiedAt: null,
        referrerRewardApplied: false,
        referredRewardApplied: false,
      });

      const response = await request(app)
        .patch("/api/v1/referrals/1/status")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "cancelled" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.referral.status).toBe("cancelled");
    });

    it("should return 400 for missing status", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const response = await request(app)
        .patch("/api/v1/referrals/1/status")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // =====================
  // AUTHENTICATED USER ENDPOINTS
  // =====================

  describe("GET /my-code (Authenticated)", () => {
    it("should return existing referral code", async () => {
      User.findByPk.mockResolvedValue({
        id: 3,
        firstName: "Jane",
        referralCode: "JANE1234",
      });

      const response = await request(app)
        .get("/api/v1/referrals/my-code")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.referralCode).toBe("JANE1234");
    });

    it("should generate new code if none exists", async () => {
      User.findByPk.mockResolvedValue({
        id: 3,
        firstName: "Jane",
        referralCode: null,
      });
      ReferralService.generateReferralCode.mockResolvedValue("JANE5678");

      const response = await request(app)
        .get("/api/v1/referrals/my-code")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.referralCode).toBe("JANE5678");
      expect(ReferralService.generateReferralCode).toHaveBeenCalled();
    });

    it("should return 401 without token", async () => {
      const response = await request(app).get("/api/v1/referrals/my-code");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /my-referrals (Authenticated)", () => {
    it("should return user referral stats", async () => {
      User.findByPk.mockResolvedValue({ id: 3 });
      ReferralService.getUserReferralStats.mockResolvedValue({
        referralCode: "JANE1234",
        availableCredits: 5000,
        totalReferrals: 3,
        pending: 1,
        qualified: 1,
        rewarded: 1,
        totalEarned: 5000,
      });
      Referral.findByReferrer = jest.fn().mockResolvedValue([
        {
          id: 1,
          referredId: 5,
          status: "rewarded",
          programType: "client_to_client",
          cleaningsCompleted: 1,
          cleaningsRequired: 1,
          createdAt: new Date(),
          referred: { firstName: "Bob", type: null }
        },
      ]);

      const response = await request(app)
        .get("/api/v1/referrals/my-referrals")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stats.totalReferrals).toBe(3);
      expect(response.body.referrals).toHaveLength(1);
    });
  });

  describe("GET /my-credits (Authenticated)", () => {
    it("should return available credits", async () => {
      User.findByPk.mockResolvedValue({ id: 3 });
      ReferralService.getAvailableCredits.mockResolvedValue(7500);

      const response = await request(app)
        .get("/api/v1/referrals/my-credits")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.availableCredits).toBe(7500);
      expect(response.body.availableDollars).toBe("75.00");
    });
  });

  describe("POST /apply-credits (Authenticated)", () => {
    it("should apply credits to appointment", async () => {
      User.findByPk.mockResolvedValue({ id: 3 });
      ReferralService.applyCreditsToAppointment.mockResolvedValue({
        success: true,
        amountApplied: 2500,
        remainingCredits: 5000,
        newPrice: 125,
      });

      const response = await request(app)
        .post("/api/v1/referrals/apply-credits")
        .set("Authorization", `Bearer ${homeownerToken}`)
        .send({ appointmentId: 1, amount: 2500 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.amountApplied).toBe(2500);
    });

    it("should return 400 for missing appointmentId", async () => {
      User.findByPk.mockResolvedValue({ id: 3 });

      const response = await request(app)
        .post("/api/v1/referrals/apply-credits")
        .set("Authorization", `Bearer ${homeownerToken}`)
        .send({ amount: 2500 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("appointmentId is required");
    });

    it("should return error when application fails", async () => {
      User.findByPk.mockResolvedValue({ id: 3 });
      ReferralService.applyCreditsToAppointment.mockResolvedValue({
        success: false,
        error: "No credits available",
      });

      const response = await request(app)
        .post("/api/v1/referrals/apply-credits")
        .set("Authorization", `Bearer ${homeownerToken}`)
        .send({ appointmentId: 1, amount: 2500 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("No credits available");
    });
  });

  describe("POST /share (Authenticated)", () => {
    it("should log share action and return success", async () => {
      User.findByPk.mockResolvedValue({
        id: 3,
        referralCode: "JANE1234",
      });

      const response = await request(app)
        .post("/api/v1/referrals/share")
        .set("Authorization", `Bearer ${homeownerToken}`)
        .send({ method: "sms" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
