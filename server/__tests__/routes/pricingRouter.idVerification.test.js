/**
 * Pricing Router ID Verification Toggle Tests
 *
 * Tests for the PATCH /id-verification endpoint
 */

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  PricingConfig: {
    getActive: jest.fn(),
  },
}));

const { User, PricingConfig } = require("../../models");
const pricingRouter = require("../../routes/api/v1/pricingRouter");

const app = express();
app.use(express.json());
app.use("/api/v1/pricing", pricingRouter);

describe("Pricing Router - ID Verification Toggle", () => {
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
    idVerificationEnabled: false,
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SESSION_SECRET = secretKey;
  });

  describe("PATCH /id-verification", () => {
    describe("Authentication", () => {
      it("should reject requests without authorization header", async () => {
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .send({ enabled: true });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("Unauthorized");
      });

      it("should reject requests with invalid token format", async () => {
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", "InvalidFormat")
          .send({ enabled: true });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("Unauthorized");
      });

      it("should reject requests with invalid token", async () => {
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", "Bearer invalid-token")
          .send({ enabled: true });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("Invalid token");
      });

      it("should reject non-owner users", async () => {
        const cleaner = createMockCleaner();
        User.findByPk.mockResolvedValue(cleaner);

        const token = createValidToken(cleaner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: true });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("Owner access required");
      });

      it("should reject when user not found", async () => {
        User.findByPk.mockResolvedValue(null);

        const token = createValidToken(999);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: true });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("Owner access required");
      });
    });

    describe("Validation", () => {
      it("should reject when enabled is not a boolean", async () => {
        const owner = createMockOwner();
        User.findByPk.mockResolvedValue(owner);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: "true" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("enabled must be a boolean");
      });

      it("should reject when enabled is missing", async () => {
        const owner = createMockOwner();
        User.findByPk.mockResolvedValue(owner);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("enabled must be a boolean");
      });

      it("should reject when enabled is a number", async () => {
        const owner = createMockOwner();
        User.findByPk.mockResolvedValue(owner);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("enabled must be a boolean");
      });

      it("should reject when enabled is null", async () => {
        const owner = createMockOwner();
        User.findByPk.mockResolvedValue(owner);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: null });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("enabled must be a boolean");
      });
    });

    describe("Enabling ID Verification", () => {
      it("should enable ID verification when enabled=true", async () => {
        const owner = createMockOwner();
        const mockConfig = createMockPricingConfig({ idVerificationEnabled: false });

        User.findByPk.mockResolvedValue(owner);
        PricingConfig.getActive.mockResolvedValue(mockConfig);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: true });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("ID verification enabled successfully");
        expect(response.body.idVerificationEnabled).toBe(true);
        expect(mockConfig.update).toHaveBeenCalledWith({
          idVerificationEnabled: true,
          updatedBy: owner.id,
        });
      });

      it("should disable ID verification when enabled=false", async () => {
        const owner = createMockOwner();
        const mockConfig = createMockPricingConfig({ idVerificationEnabled: true });

        User.findByPk.mockResolvedValue(owner);
        PricingConfig.getActive.mockResolvedValue(mockConfig);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: false });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("ID verification disabled successfully");
        expect(response.body.idVerificationEnabled).toBe(false);
        expect(mockConfig.update).toHaveBeenCalledWith({
          idVerificationEnabled: false,
          updatedBy: owner.id,
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 404 when no active pricing config exists", async () => {
        const owner = createMockOwner();

        User.findByPk.mockResolvedValue(owner);
        PricingConfig.getActive.mockResolvedValue(null);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: true });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("No active pricing configuration found");
      });

      it("should return 500 when database update fails", async () => {
        const owner = createMockOwner();
        const mockConfig = createMockPricingConfig();
        mockConfig.update.mockRejectedValue(new Error("Database error"));

        User.findByPk.mockResolvedValue(owner);
        PricingConfig.getActive.mockResolvedValue(mockConfig);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: true });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe("Failed to update ID verification setting");
      });

      it("should return 500 when getActive fails", async () => {
        const owner = createMockOwner();

        User.findByPk.mockResolvedValue(owner);
        PricingConfig.getActive.mockRejectedValue(new Error("Database connection error"));

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: true });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe("Failed to update ID verification setting");
      });
    });

    describe("Idempotency", () => {
      it("should handle enabling when already enabled", async () => {
        const owner = createMockOwner();
        const mockConfig = createMockPricingConfig({ idVerificationEnabled: true });

        User.findByPk.mockResolvedValue(owner);
        PricingConfig.getActive.mockResolvedValue(mockConfig);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: true });

        expect(response.status).toBe(200);
        expect(response.body.idVerificationEnabled).toBe(true);
        expect(mockConfig.update).toHaveBeenCalled();
      });

      it("should handle disabling when already disabled", async () => {
        const owner = createMockOwner();
        const mockConfig = createMockPricingConfig({ idVerificationEnabled: false });

        User.findByPk.mockResolvedValue(owner);
        PricingConfig.getActive.mockResolvedValue(mockConfig);

        const token = createValidToken(owner.id);
        const response = await request(app)
          .patch("/api/v1/pricing/id-verification")
          .set("Authorization", `Bearer ${token}`)
          .send({ enabled: false });

        expect(response.status).toBe(200);
        expect(response.body.idVerificationEnabled).toBe(false);
        expect(mockConfig.update).toHaveBeenCalled();
      });
    });
  });
});
