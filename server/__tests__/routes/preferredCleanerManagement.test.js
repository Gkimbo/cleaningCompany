const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    return value.replace("encrypted_", "");
  }),
}));

// Mock PreferredCleanerService
jest.mock("../../services/PreferredCleanerService", () => ({
  getClientAppointments: jest.fn(),
  acceptAppointment: jest.fn(),
  declineAppointment: jest.fn(),
  clientRespond: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserHomes: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
  },
  HomePreferredCleaner: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
}));

const { User, UserHomes, HomePreferredCleaner } = require("../../models");

describe("Preferred Cleaner Management Endpoints", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const preferredCleanerRouter = require("../../routes/api/v1/preferredCleanerRouter");
    app.use("/api/v1/preferred-cleaner", preferredCleanerRouter);
  });

  const homeownerId = 1;
  const homeId = 10;
  const cleanerId = 100;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: homeowner has homes, cleaner does not
    UserHomes.count.mockImplementation(({ where }) => {
      if (where?.userId === homeownerId) return Promise.resolve(1);
      return Promise.resolve(0);
    });
  });

  const createHomeownerToken = () => jwt.sign({ userId: homeownerId }, secretKey);
  const createCleanerToken = () => jwt.sign({ userId: cleanerId }, secretKey);

  describe("GET /homes/:homeId/preferred-cleaners", () => {
    it("should return list of preferred cleaners for a home", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue({
        id: homeId,
        userId: homeownerId,
        usePreferredCleaners: true,
      });

      HomePreferredCleaner.findAll.mockResolvedValue([
        {
          id: 1,
          cleanerId: 100,
          setAt: new Date("2025-01-01"),
          setBy: "review",
          cleaner: {
            id: 100,
            firstName: "John",
            lastName: "Cleaner",
            username: "johncleaner",
          },
        },
        {
          id: 2,
          cleanerId: 101,
          setAt: new Date("2025-01-02"),
          setBy: "settings",
          cleaner: {
            id: 101,
            firstName: "Jane",
            lastName: "Cleaner",
            username: "janecleaner",
          },
        },
      ]);

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.preferredCleaners).toHaveLength(2);
      // Serializer returns cleaner object with firstName/lastName, not cleanerName
      expect(res.body.preferredCleaners[0].cleaner.firstName).toBe("John");
      expect(res.body.preferredCleaners[0].cleaner.lastName).toBe("Cleaner");
      expect(res.body.preferredCleaners[1].cleaner.firstName).toBe("Jane");
      expect(res.body.preferredCleaners[1].cleaner.lastName).toBe("Cleaner");
      expect(res.body.usePreferredCleaners).toBe(true);
    });

    it("should return empty list when no preferred cleaners", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue({
        id: homeId,
        userId: homeownerId,
        usePreferredCleaners: true,
      });

      HomePreferredCleaner.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.preferredCleaners).toHaveLength(0);
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`);

      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not a homeowner", async () => {
      const token = createCleanerToken();

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Homeowner access required");
    });

    it("should return 404 if home not found", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Home not found");
    });

    it("should return 404 if home belongs to different user", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      // Home belongs to a different user (userId: 999)
      UserHomes.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Home not found");
    });

    it("should handle cleaner with only username (no name)", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue({
        id: homeId,
        userId: homeownerId,
        usePreferredCleaners: false,
      });

      HomePreferredCleaner.findAll.mockResolvedValue([
        {
          id: 1,
          cleanerId: 100,
          setAt: new Date("2025-01-01"),
          setBy: "invitation",
          cleaner: {
            id: 100,
            firstName: "",
            lastName: "",
            username: "cleaner123",
          },
        },
      ]);

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // When firstName/lastName are empty strings, decryptField returns null
      expect(res.body.preferredCleaners[0].cleaner.firstName).toBeNull();
      expect(res.body.preferredCleaners[0].cleaner.lastName).toBeNull();
      expect(res.body.usePreferredCleaners).toBe(false);
    });
  });

  describe("DELETE /homes/:homeId/cleaners/:cleanerId", () => {
    it("should remove a cleaner from preferred list", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue({
        id: homeId,
        userId: homeownerId,
      });

      HomePreferredCleaner.destroy.mockResolvedValue(1);

      const res = await request(app)
        .delete(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Cleaner removed from preferred list");
      expect(HomePreferredCleaner.destroy).toHaveBeenCalledWith({
        where: { homeId: `${homeId}`, cleanerId: `${cleanerId}` },
      });
    });

    it("should return 404 if cleaner not in preferred list", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue({
        id: homeId,
        userId: homeownerId,
      });

      HomePreferredCleaner.destroy.mockResolvedValue(0);

      const res = await request(app)
        .delete(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Cleaner not found in preferred list");
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .delete(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`);

      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not a homeowner", async () => {
      const token = createCleanerToken();

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .delete(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return 404 if home not found", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Home not found");
    });
  });

  describe("PATCH /homes/:homeId/preferred-settings", () => {
    it("should toggle usePreferredCleaners to false", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      const mockHome = {
        id: homeId,
        userId: homeownerId,
        usePreferredCleaners: true,
        update: jest.fn().mockImplementation(function(data) {
          this.usePreferredCleaners = data.usePreferredCleaners;
          return Promise.resolve(this);
        }),
      };

      UserHomes.findOne.mockResolvedValue(mockHome);

      const res = await request(app)
        .patch(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ usePreferredCleaners: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.usePreferredCleaners).toBe(false);
      expect(res.body.message).toBe("All cleaners can now request jobs for this home");
      expect(mockHome.update).toHaveBeenCalledWith({ usePreferredCleaners: false });
    });

    it("should toggle usePreferredCleaners to true", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      const mockHome = {
        id: homeId,
        userId: homeownerId,
        usePreferredCleaners: false,
        update: jest.fn().mockImplementation(function(data) {
          this.usePreferredCleaners = data.usePreferredCleaners;
          return Promise.resolve(this);
        }),
      };

      UserHomes.findOne.mockResolvedValue(mockHome);
      // Require at least 5 preferred cleaners to enable feature
      HomePreferredCleaner.count.mockResolvedValue(5);

      const res = await request(app)
        .patch(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ usePreferredCleaners: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.usePreferredCleaners).toBe(true);
      expect(res.body.message).toBe("Only preferred cleaners can now request jobs for this home");
    });

    it("should return 400 if usePreferredCleaners is not a boolean", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      const res = await request(app)
        .patch(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ usePreferredCleaners: "yes" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("usePreferredCleaners must be a boolean");
    });

    it("should return 400 if usePreferredCleaners is missing", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      const res = await request(app)
        .patch(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("usePreferredCleaners must be a boolean");
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .patch(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-settings`)
        .send({ usePreferredCleaners: true });

      expect(res.status).toBe(401);
    });

    it("should return 404 if home not found", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ usePreferredCleaners: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Home not found");
    });
  });

  describe("GET /homes/:homeId/cleaners/:cleanerId/is-preferred", () => {
    it("should return true when cleaner is preferred", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue({
        id: homeId,
        userId: homeownerId,
      });

      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId,
        cleanerId,
      });

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isPreferred).toBe(true);
    });

    it("should return false when cleaner is not preferred", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue({
        id: homeId,
        userId: homeownerId,
      });

      HomePreferredCleaner.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isPreferred).toBe(false);
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`);

      expect(res.status).toBe(401);
    });

    it("should return 404 if home not found", async () => {
      const token = createHomeownerToken();

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      UserHomes.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Home not found");
    });
  });
});
