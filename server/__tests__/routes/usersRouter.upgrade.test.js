const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Set SESSION_SECRET before any router imports
process.env.SESSION_SECRET = "test_secret";

// Mock models
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  UserReviews: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  HomePreferredCleaner: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  CleanerTierStatus: {
    findOne: jest.fn(),
  },
  UserBills: {
    create: jest.fn(),
  },
}));

// Mock other services
jest.mock("../../services/ReferralService", () => ({
  generateReferralCode: jest.fn().mockResolvedValue("ABC123"),
  validateReferralCode: jest.fn(),
  createReferral: jest.fn(),
}));

jest.mock("../../services/EncryptionService", () => ({
  encrypt: jest.fn((val) => val),
  decrypt: jest.fn((val) => val),
}));

const usersRouter = require("../../routes/api/v1/usersRouter");

const app = express();
app.use(express.json());
app.use("/api/v1/users", usersRouter);

const secretKey = process.env.SESSION_SECRET;

describe("PATCH /api/v1/users/upgrade-to-business", () => {
  const mockCleanerUser = {
    id: 1,
    firstName: "Test",
    lastName: "Cleaner",
    username: "test_cleaner",
    email: "cleaner@test.com",
    type: "cleaner",
    isBusinessOwner: false,
    isMarketplaceCleaner: true,
    dataValues: {
      id: 1,
      firstName: "Test",
      lastName: "Cleaner",
      username: "test_cleaner",
      email: "cleaner@test.com",
      type: "cleaner",
      isBusinessOwner: true,
      isMarketplaceCleaner: true,
      businessName: "Test Cleaning Co",
      yearsInBusiness: 5,
    },
    update: jest.fn().mockResolvedValue(true),
  };

  const mockHomeownerUser = {
    id: 2,
    firstName: "Test",
    lastName: "Homeowner",
    username: "test_homeowner",
    email: "homeowner@test.com",
    type: null,
    isBusinessOwner: false,
  };

  let cleanerToken;
  let homeownerToken;

  beforeEach(() => {
    jest.clearAllMocks();
    cleanerToken = jwt.sign({ userId: 1 }, secretKey, { expiresIn: "24h" });
    homeownerToken = jwt.sign({ userId: 2 }, secretKey, { expiresIn: "24h" });
  });

  describe("Successful upgrade", () => {
    it("should upgrade cleaner to business owner successfully", async () => {
      const { User } = require("../../models");
      User.findByPk.mockResolvedValue(mockCleanerUser);

      const response = await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          businessName: "Test Cleaning Co",
          yearsInBusiness: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Account upgraded to business owner");
      expect(mockCleanerUser.update).toHaveBeenCalledWith({
        isBusinessOwner: true,
        businessName: "Test Cleaning Co",
        yearsInBusiness: 5,
      });
    });

    it("should only update isBusinessOwner flag without affecting other user data", async () => {
      const { User } = require("../../models");
      User.findByPk.mockResolvedValue(mockCleanerUser);

      await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          businessName: "Test Cleaning Co",
          yearsInBusiness: 5,
        });

      // Verify only these fields are updated (user ID is preserved)
      expect(mockCleanerUser.update).toHaveBeenCalledTimes(1);
      const updateCall = mockCleanerUser.update.mock.calls[0][0];
      expect(updateCall).toEqual({
        isBusinessOwner: true,
        businessName: "Test Cleaning Co",
        yearsInBusiness: 5,
      });
      // These fields should NOT be in the update call (they remain unchanged)
      expect(updateCall.id).toBeUndefined();
      expect(updateCall.firstName).toBeUndefined();
      expect(updateCall.lastName).toBeUndefined();
      expect(updateCall.email).toBeUndefined();
      expect(updateCall.type).toBeUndefined();
    });

    it("should preserve user ID which maintains all foreign key relationships", async () => {
      const { User } = require("../../models");
      User.findByPk.mockResolvedValue(mockCleanerUser);

      const response = await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ businessName: "Test Cleaning Co" });

      // The response should contain the same user ID
      expect(response.body.user.id).toBe(1);
      // Since user ID doesn't change, all foreign key relationships are preserved:
      // - Reviews (UserReviews.userId = 1)
      // - Appointments (UserAppointments.cleanerId = 1)
      // - Preferred cleaner status (HomePreferredCleaner.cleanerId = 1)
      // - Tier status (CleanerTierStatus.cleanerId = 1)
    });
  });

  describe("Data preservation verification", () => {
    it("upgrade does not modify reviews - they remain linked by cleanerId", async () => {
      const { User, UserReviews } = require("../../models");
      User.findByPk.mockResolvedValue(mockCleanerUser);

      await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ businessName: "Test Cleaning Co" });

      // Reviews are NOT touched by the upgrade
      expect(UserReviews.findAll).not.toHaveBeenCalled();
      expect(UserReviews.findOne).not.toHaveBeenCalled();
    });

    it("upgrade does not modify appointments - they remain linked by cleanerId", async () => {
      const { User, UserAppointments } = require("../../models");
      User.findByPk.mockResolvedValue(mockCleanerUser);

      await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ businessName: "Test Cleaning Co" });

      // Appointments are NOT touched by the upgrade
      expect(UserAppointments.findAll).not.toHaveBeenCalled();
      expect(UserAppointments.findOne).not.toHaveBeenCalled();
    });

    it("upgrade does not modify preferred cleaner status - it remains linked by cleanerId", async () => {
      const { User, HomePreferredCleaner } = require("../../models");
      User.findByPk.mockResolvedValue(mockCleanerUser);

      await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ businessName: "Test Cleaning Co" });

      // Preferred cleaner records are NOT touched by the upgrade
      expect(HomePreferredCleaner.findAll).not.toHaveBeenCalled();
      expect(HomePreferredCleaner.findOne).not.toHaveBeenCalled();
    });

    it("upgrade does not modify tier status - it remains linked by cleanerId", async () => {
      const { User, CleanerTierStatus } = require("../../models");
      User.findByPk.mockResolvedValue(mockCleanerUser);

      await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ businessName: "Test Cleaning Co" });

      // Tier status is NOT touched by the upgrade
      expect(CleanerTierStatus.findOne).not.toHaveBeenCalled();
    });
  });

  describe("Validation", () => {
    it("should reject upgrade without authorization", async () => {
      const response = await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .send({ businessName: "Test" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authorization token required");
    });

    it("should reject upgrade with invalid token", async () => {
      const response = await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", "Bearer invalid_token")
        .send({ businessName: "Test" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject upgrade for non-existent user", async () => {
      const { User } = require("../../models");
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ businessName: "Test" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should reject upgrade for non-cleaner accounts", async () => {
      const { User } = require("../../models");
      User.findByPk.mockResolvedValue(mockHomeownerUser);

      const response = await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${homeownerToken}`)
        .send({ businessName: "Test" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Only cleaner accounts can be upgraded to business owner");
    });

    it("should reject upgrade for already-upgraded accounts", async () => {
      const { User } = require("../../models");
      const alreadyUpgradedUser = { ...mockCleanerUser, isBusinessOwner: true };
      User.findByPk.mockResolvedValue(alreadyUpgradedUser);

      const response = await request(app)
        .patch("/api/v1/users/upgrade-to-business")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ businessName: "Another Name" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Account is already a business owner");
    });
  });
});
