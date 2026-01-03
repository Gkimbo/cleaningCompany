/**
 * Tests for preferred-homes endpoint in usersRouter
 * GET /api/v1/users/preferred-homes - Returns homeIds where cleaner has preferred status
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  HomePreferredCleaner: {
    findAll: jest.fn(),
  },
}));

const { User, HomePreferredCleaner } = require("../../models");

describe("Preferred Homes Endpoint", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Add simplified version of preferred-homes endpoint for testing
    app.get("/api/v1/users/preferred-homes", async (req, res) => {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      try {
        const decoded = jwt.verify(token, secretKey);
        const cleanerId = decoded.userId;

        const user = await User.findByPk(cleanerId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (user.type !== "cleaner") {
          return res.status(403).json({ error: "Cleaner access required" });
        }

        const preferredRecords = await HomePreferredCleaner.findAll({
          where: { cleanerId },
          attributes: ["homeId"],
        });

        const preferredHomeIds = preferredRecords.map((r) => r.homeId);

        return res.status(200).json({ preferredHomeIds });
      } catch (error) {
        if (error.name === "JsonWebTokenError") {
          return res.status(401).json({ error: "Invalid token" });
        }
        return res.status(500).json({ error: "Internal server error" });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/users/preferred-homes", () => {
    it("should return array of preferred home IDs for cleaner", async () => {
      const cleanerId = 100;
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      HomePreferredCleaner.findAll.mockResolvedValue([
        { homeId: 10 },
        { homeId: 15 },
        { homeId: 22 },
      ]);

      const res = await request(app)
        .get("/api/v1/users/preferred-homes")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.preferredHomeIds).toEqual([10, 15, 22]);
      expect(HomePreferredCleaner.findAll).toHaveBeenCalledWith({
        where: { cleanerId },
        attributes: ["homeId"],
      });
    });

    it("should return empty array when cleaner has no preferred homes", async () => {
      const cleanerId = 100;
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      HomePreferredCleaner.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/users/preferred-homes")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.preferredHomeIds).toEqual([]);
    });

    it("should return 401 for missing authorization", async () => {
      const res = await request(app).get("/api/v1/users/preferred-homes");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/users/preferred-homes")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("should return 403 for non-cleaner users", async () => {
      const homeownerId = 200;
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      const res = await request(app)
        .get("/api/v1/users/preferred-homes")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Cleaner access required");
    });

    it("should return 404 for non-existent user", async () => {
      const token = jwt.sign({ userId: 999 }, secretKey);

      User.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/users/preferred-homes")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });

    it("should handle multiple preferred homes correctly", async () => {
      const cleanerId = 100;
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      // Simulate cleaner with many preferred homes
      const manyHomes = Array.from({ length: 20 }, (_, i) => ({ homeId: i + 1 }));
      HomePreferredCleaner.findAll.mockResolvedValue(manyHomes);

      const res = await request(app)
        .get("/api/v1/users/preferred-homes")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.preferredHomeIds).toHaveLength(20);
      expect(res.body.preferredHomeIds).toContain(1);
      expect(res.body.preferredHomeIds).toContain(20);
    });
  });
});

describe("Preferred Homes - Frontend Usage", () => {
  describe("Job Tile Marking", () => {
    it("should identify if job is from preferred home", () => {
      const preferredHomeIds = [10, 15, 22];
      const appointments = [
        { id: 1, homeId: 10, address: "123 Main St" },
        { id: 2, homeId: 11, address: "456 Oak Ave" },
        { id: 3, homeId: 15, address: "789 Pine Rd" },
      ];

      const markedAppointments = appointments.map((apt) => ({
        ...apt,
        isPreferred: preferredHomeIds.includes(apt.homeId),
      }));

      expect(markedAppointments[0].isPreferred).toBe(true);
      expect(markedAppointments[1].isPreferred).toBe(false);
      expect(markedAppointments[2].isPreferred).toBe(true);
    });
  });

  describe("Filter Logic", () => {
    it("should filter to show only preferred homes when preferredOnly is true", () => {
      const preferredHomeIds = [10, 15];
      const appointments = [
        { id: 1, homeId: 10 },
        { id: 2, homeId: 11 },
        { id: 3, homeId: 15 },
        { id: 4, homeId: 20 },
      ];

      const filters = { preferredOnly: true };

      const filtered = appointments.filter((apt) => {
        if (filters.preferredOnly) {
          return preferredHomeIds.includes(apt.homeId);
        }
        return true;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((a) => a.id)).toEqual([1, 3]);
    });

    it("should show all appointments when preferredOnly is false", () => {
      const preferredHomeIds = [10, 15];
      const appointments = [
        { id: 1, homeId: 10 },
        { id: 2, homeId: 11 },
        { id: 3, homeId: 15 },
        { id: 4, homeId: 20 },
      ];

      const filters = { preferredOnly: false };

      const filtered = appointments.filter((apt) => {
        if (filters.preferredOnly) {
          return preferredHomeIds.includes(apt.homeId);
        }
        return true;
      });

      expect(filtered).toHaveLength(4);
    });

    it("should handle empty preferred homes array", () => {
      const preferredHomeIds = [];
      const appointments = [
        { id: 1, homeId: 10 },
        { id: 2, homeId: 11 },
      ];

      const filters = { preferredOnly: true };

      const filtered = appointments.filter((apt) => {
        if (filters.preferredOnly) {
          return preferredHomeIds.includes(apt.homeId);
        }
        return true;
      });

      expect(filtered).toHaveLength(0);
    });
  });
});
