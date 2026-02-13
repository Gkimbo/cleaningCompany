/**
 * Tests for Employee Info Bonus Routes
 * Tests the employee-facing bonus API endpoints
 */

const express = require("express");
const request = require("supertest");

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn((token, secret) => {
    if (token === "valid-token") {
      return { userId: 2 };
    }
    if (token === "invalid-token") {
      throw new Error("Invalid token");
    }
    return { userId: 2 };
  }),
}));

// Mock EmployeeBonusService
jest.mock("../../services/EmployeeBonusService", () => ({
  getBonusesForEmployee: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const EmployeeBonusService = require("../../services/EmployeeBonusService");

// Create test app
const app = express();
app.use(express.json());

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
  try {
    const decoded = jwt.verify(token, "test-secret");
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Setup routes (matching employeeInfoRouter pattern)
app.get("/bonuses", authMiddleware, async (req, res) => {
  try {
    const bonuses = await EmployeeBonusService.getBonusesForEmployee(req.userId, {
      limit: parseInt(req.query.limit) || 50,
      includePending: req.query.includePending === "true",
    });
    res.json({ bonuses });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

describe("Employee Info Bonus Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // GET /bonuses - Get Employee Bonuses
  // =============================================
  describe("GET /bonuses", () => {
    it("should return bonuses for authenticated employee", async () => {
      const mockBonuses = [
        {
          id: 1,
          amount: 5000,
          reason: "Great performance",
          status: "paid",
          paidAt: new Date("2024-01-15"),
          createdAt: new Date("2024-01-10"),
        },
        {
          id: 2,
          amount: 2500,
          reason: "Holiday bonus",
          status: "pending",
          paidAt: null,
          createdAt: new Date("2024-01-20"),
        },
      ];

      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue(mockBonuses);

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses).toHaveLength(2);
      expect(res.body.bonuses[0].amount).toBe(5000);
      expect(res.body.bonuses[1].amount).toBe(2500);
    });

    it("should return 401 without authorization token", async () => {
      const res = await request(app).get("/bonuses");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization token required");
    });

    it("should return 401 with invalid token", async () => {
      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
    });

    it("should pass limit parameter to service", async () => {
      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue([]);

      await request(app)
        .get("/bonuses?limit=10")
        .set("Authorization", "Bearer valid-token");

      expect(EmployeeBonusService.getBonusesForEmployee).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ limit: 10 })
      );
    });

    it("should pass includePending parameter to service", async () => {
      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue([]);

      await request(app)
        .get("/bonuses?includePending=true")
        .set("Authorization", "Bearer valid-token");

      expect(EmployeeBonusService.getBonusesForEmployee).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ includePending: true })
      );
    });

    it("should default includePending to false", async () => {
      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue([]);

      await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(EmployeeBonusService.getBonusesForEmployee).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ includePending: false })
      );
    });

    it("should return empty array when employee has no bonuses", async () => {
      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue([]);

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses).toHaveLength(0);
    });

    it("should return 500 on service error", async () => {
      EmployeeBonusService.getBonusesForEmployee.mockRejectedValue(
        new Error("Database error")
      );

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(500);
    });

    it("should include bonus details in response", async () => {
      const mockBonus = {
        id: 1,
        amount: 5000,
        reason: "Top performer this month",
        status: "paid",
        paidAt: "2024-01-15T00:00:00.000Z",
        paidNote: "Paid via direct deposit",
        createdAt: "2024-01-10T00:00:00.000Z",
        businessOwner: {
          id: 1,
          username: "owner@test.com",
        },
      };

      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue([mockBonus]);

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses[0]).toHaveProperty("reason");
      expect(res.body.bonuses[0].reason).toBe("Top performer this month");
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  describe("Edge Cases", () => {
    it("should handle large bonus amounts", async () => {
      const mockBonuses = [
        { id: 1, amount: 100000000, status: "paid" }, // $1,000,000
      ];

      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue(mockBonuses);

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses[0].amount).toBe(100000000);
    });

    it("should handle multiple bonuses from different employers", async () => {
      const mockBonuses = [
        { id: 1, amount: 5000, businessOwnerId: 1, status: "paid" },
        { id: 2, amount: 3000, businessOwnerId: 2, status: "paid" },
        { id: 3, amount: 2500, businessOwnerId: 1, status: "pending" },
      ];

      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue(mockBonuses);

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses).toHaveLength(3);
    });

    it("should handle bonuses with null reason", async () => {
      const mockBonuses = [
        { id: 1, amount: 5000, reason: null, status: "paid" },
      ];

      EmployeeBonusService.getBonusesForEmployee.mockResolvedValue(mockBonuses);

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses[0].reason).toBeNull();
    });
  });
});
