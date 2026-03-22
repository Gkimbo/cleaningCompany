/**
 * Cleaner Management Routes Tests
 * Tests for owner dashboard cleaner management endpoints
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
}));

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  notifyUser: jest.fn().mockResolvedValue({ id: 1 }),
}));

// Mock models
jest.mock("../../models", () => {
  const { Op } = require("sequelize");
  return {
    User: {
      findByPk: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    },
    UserAppointments: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
    },
    Payout: {
      findAll: jest.fn(),
      sum: jest.fn(),
    },
    UserReviews: {
      count: jest.fn(),
      findAll: jest.fn(),
    },
    CleanerClient: {
      count: jest.fn(),
    },
    sequelize: {
      fn: jest.fn((name, ...args) => ({ fn: name, args })),
      col: jest.fn((name) => ({ col: name })),
      literal: jest.fn((str) => ({ literal: str })),
      QueryTypes: { SELECT: "SELECT" },
      query: jest.fn(),
    },
    Sequelize: {
      Op,
    },
  };
});

// Import after mocks
const { User, UserAppointments, Payout, UserReviews, CleanerClient, sequelize } = require("../../models");
const NotificationService = require("../../services/NotificationService");
const ownerDashboardRouter = require("../../routes/api/v1/ownerDashboardRouter");

const app = express();
app.use(express.json());
app.use("/api/v1/owner", ownerDashboardRouter);

describe("Cleaner Management Routes", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const ownerToken = jwt.sign({ userId: 1 }, secretKey);
  const cleanerToken = jwt.sign({ userId: 3 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
    // Default owner user mock
    User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

    // Mock sequelize query for raw SQL
    sequelize.query.mockResolvedValue([]);
  });

  describe("GET /cleaners", () => {
    it("should require owner authentication", async () => {
      User.findByPk.mockResolvedValue({ id: 3, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/owner/cleaners")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Owner access required");
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app).get("/api/v1/owner/cleaners");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /cleaners/:cleanerId/details", () => {
    it("should return 404 for non-existent cleaner", async () => {
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/api/v1/owner/cleaners/999/details")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Cleaner not found");
    });

    it("should return 400 for non-cleaner user", async () => {
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce({ id: 2, type: "client" });

      const response = await request(app)
        .get("/api/v1/owner/cleaners/2/details")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User is not a cleaner");
    });
  });

  describe("GET /cleaners/:cleanerId/job-history", () => {
    it("should return 404 for non-existent cleaner", async () => {
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/api/v1/owner/cleaners/999/job-history")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /cleaners/:cleanerId/warning", () => {
    const mockCleaner = {
      id: 3,
      firstName: "encrypted_John",
      type: "cleaner",
      warningCount: 1,
      update: jest.fn().mockImplementation(function(data) {
        Object.assign(this, data);
        return Promise.resolve(this);
      }),
    };

    it("should issue warning to cleaner", async () => {
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(mockCleaner);

      const response = await request(app)
        .post("/api/v1/owner/cleaners/3/warning")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ reason: "Late to appointments repeatedly" }); // At least 10 chars

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.warningCount).toBe(2);
      expect(mockCleaner.update).toHaveBeenCalledWith({ warningCount: 2 });
      expect(NotificationService.notifyUser).toHaveBeenCalled();
    });

    it("should require reason for warning", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const response = await request(app)
        .post("/api/v1/owner/cleaners/3/warning")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("A reason is required (at least 10 characters)");
    });

    it("should return 404 for non-existent cleaner", async () => {
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/api/v1/owner/cleaners/999/warning")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ reason: "Test reason" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Cleaner not found");
    });

    it("should return 400 for non-cleaner user", async () => {
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce({ id: 2, type: "client" });

      const response = await request(app)
        .post("/api/v1/owner/cleaners/2/warning")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ reason: "Test reason" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User is not a cleaner");
    });

    it("should handle database errors gracefully", async () => {
      const errorCleaner = {
        id: 3,
        type: "cleaner",
        warningCount: 0,
        update: jest.fn().mockRejectedValue(new Error("Database error")),
      };

      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(errorCleaner);

      const response = await request(app)
        .post("/api/v1/owner/cleaners/3/warning")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ reason: "Test reason" });

      expect(response.status).toBe(500);
    });
  });
});
