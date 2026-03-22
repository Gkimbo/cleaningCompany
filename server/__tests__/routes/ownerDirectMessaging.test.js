/**
 * Owner Direct Messaging Tests
 * Tests for owner-to-anyone direct messaging endpoint
 */

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
  safeDecrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Conversation: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  ConversationParticipant: {
    findOne: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
  },
  Message: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn((callback) => callback({ commit: jest.fn(), rollback: jest.fn() })),
  },
  Sequelize: {
    Op: require("sequelize").Op,
  },
}));

const { User, Conversation, ConversationParticipant, Message } = require("../../models");
const messageRouter = require("../../routes/api/v1/messageRouter");

const app = express();
app.use(express.json());
app.use("/api/v1/messages", messageRouter);

describe("Owner Direct Messaging", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const ownerToken = jwt.sign({ userId: 1 }, secretKey);
  const cleanerToken = jwt.sign({ userId: 3 }, secretKey);
  const clientToken = jwt.sign({ userId: 5 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /conversation/owner-direct", () => {
    const mockOwner = {
      id: 1,
      type: "owner",
      firstName: "encrypted_Platform",
      lastName: "encrypted_Owner",
    };

    const mockCleaner = {
      id: 3,
      type: "cleaner",
      firstName: "encrypted_John",
      lastName: "encrypted_Doe",
    };

    it("should reject non-owner users", async () => {
      User.findByPk
        .mockResolvedValueOnce(mockCleaner)  // authenticateToken returns cleaner
        .mockResolvedValueOnce(mockCleaner); // owner verification fails

      const response = await request(app)
        .post("/api/v1/messages/conversation/owner-direct")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ targetUserId: 5 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Only owner can use this endpoint");
    });

    it("should require targetUserId", async () => {
      User.findByPk
        .mockResolvedValueOnce(mockOwner)
        .mockResolvedValueOnce(mockOwner);

      const response = await request(app)
        .post("/api/v1/messages/conversation/owner-direct")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Valid targetUserId is required");
    });

    it("should validate owner type before proceeding", async () => {
      // Just verify the owner type check works
      User.findByPk.mockResolvedValue({ id: 1, type: "owner", accountFrozen: false });

      const response = await request(app)
        .post("/api/v1/messages/conversation/owner-direct")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ targetUserId: 3 });

      // Will return some response (200 or error) but not 403 since user is owner
      expect(response.status).not.toBe(403);
    });

    it("should not allow owner to message themselves", async () => {
      User.findByPk
        .mockResolvedValueOnce(mockOwner)
        .mockResolvedValueOnce(mockOwner)
        .mockResolvedValueOnce(mockOwner);

      const response = await request(app)
        .post("/api/v1/messages/conversation/owner-direct")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ targetUserId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Cannot message yourself");
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .post("/api/v1/messages/conversation/owner-direct")
        .send({ targetUserId: 3 });

      expect(response.status).toBe(401);
    });
  });
});
