/**
 * Tests for Employee Bonus Routes (Business Owner)
 * Tests the business owner bonus API endpoints
 */

const express = require("express");
const request = require("supertest");

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn((token, secret) => {
    if (token === "valid-token") {
      return { userId: 1 };
    }
    throw new Error("Invalid token");
  }),
}));

// Mock EmployeeBonusService
jest.mock("../../services/EmployeeBonusService", () => ({
  createBonus: jest.fn(),
  markBonusPaid: jest.fn(),
  cancelBonus: jest.fn(),
  getPendingBonuses: jest.fn(),
  getAllBonuses: jest.fn(),
  getBonusSummary: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
  },
  EmployeeBonus: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
}));

const jwt = require("jsonwebtoken");
const EmployeeBonusService = require("../../services/EmployeeBonusService");
const { User } = require("../../models");

// Create a test app with the bonus routes
const app = express();
app.use(express.json());

// Simple auth middleware for testing
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

// Setup routes
app.post("/bonuses", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user || user.type !== "business_owner") {
      return res.status(403).json({ error: "Only business owners can give bonuses" });
    }
    const bonus = await EmployeeBonusService.createBonus({
      businessOwnerId: req.userId,
      employeeId: req.body.employeeId,
      amount: req.body.amount,
      reason: req.body.reason,
    });
    res.status(201).json({ success: true, bonus });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/bonuses", authMiddleware, async (req, res) => {
  try {
    const bonuses = await EmployeeBonusService.getAllBonuses(req.userId, {
      status: req.query.status,
      limit: parseInt(req.query.limit) || 100,
    });
    res.json({ bonuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/bonuses/pending", authMiddleware, async (req, res) => {
  try {
    const bonuses = await EmployeeBonusService.getPendingBonuses(req.userId);
    res.json({ bonuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/bonuses/summary", authMiddleware, async (req, res) => {
  try {
    const summary = await EmployeeBonusService.getBonusSummary(req.userId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/bonuses/:id/paid", authMiddleware, async (req, res) => {
  try {
    const bonus = await EmployeeBonusService.markBonusPaid(
      parseInt(req.params.id),
      req.userId,
      req.body.note
    );
    res.json({ success: true, bonus });
  } catch (err) {
    if (err.message === "Bonus not found") {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === "Unauthorized") {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

app.delete("/bonuses/:id", authMiddleware, async (req, res) => {
  try {
    const bonus = await EmployeeBonusService.cancelBonus(
      parseInt(req.params.id),
      req.userId
    );
    res.json({ success: true, bonus });
  } catch (err) {
    if (err.message === "Bonus not found") {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === "Unauthorized") {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

describe("Employee Bonus Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "business_owner" });
  });

  // =============================================
  // POST /bonuses - Create Bonus
  // =============================================
  describe("POST /bonuses", () => {
    it("should create a bonus successfully", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        employeeId: 2,
        amount: 5000,
        reason: "Great work",
        status: "pending",
      };

      EmployeeBonusService.createBonus.mockResolvedValue(mockBonus);

      const res = await request(app)
        .post("/bonuses")
        .set("Authorization", "Bearer valid-token")
        .send({
          employeeId: 2,
          amount: 5000,
          reason: "Great work",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.bonus.amount).toBe(5000);
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .post("/bonuses")
        .send({
          employeeId: 2,
          amount: 5000,
        });

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-business owner", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "cleaner" });

      const res = await request(app)
        .post("/bonuses")
        .set("Authorization", "Bearer valid-token")
        .send({
          employeeId: 2,
          amount: 5000,
        });

      expect(res.status).toBe(403);
    });

    it("should return 400 for invalid amount", async () => {
      EmployeeBonusService.createBonus.mockRejectedValue(
        new Error("Amount must be greater than zero")
      );

      const res = await request(app)
        .post("/bonuses")
        .set("Authorization", "Bearer valid-token")
        .send({
          employeeId: 2,
          amount: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Amount must be greater than zero");
    });

    it("should return 400 for invalid employee", async () => {
      EmployeeBonusService.createBonus.mockRejectedValue(
        new Error("Employee not found")
      );

      const res = await request(app)
        .post("/bonuses")
        .set("Authorization", "Bearer valid-token")
        .send({
          employeeId: 999,
          amount: 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Employee not found");
    });
  });

  // =============================================
  // GET /bonuses - Get All Bonuses
  // =============================================
  describe("GET /bonuses", () => {
    it("should return all bonuses", async () => {
      const mockBonuses = [
        { id: 1, amount: 5000, status: "paid" },
        { id: 2, amount: 2500, status: "pending" },
      ];

      EmployeeBonusService.getAllBonuses.mockResolvedValue(mockBonuses);

      const res = await request(app)
        .get("/bonuses")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses).toHaveLength(2);
    });

    it("should filter by status", async () => {
      EmployeeBonusService.getAllBonuses.mockResolvedValue([]);

      await request(app)
        .get("/bonuses?status=pending")
        .set("Authorization", "Bearer valid-token");

      expect(EmployeeBonusService.getAllBonuses).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "pending" })
      );
    });
  });

  // =============================================
  // GET /bonuses/pending - Get Pending Bonuses
  // =============================================
  describe("GET /bonuses/pending", () => {
    it("should return pending bonuses", async () => {
      const mockBonuses = [
        { id: 1, amount: 5000, status: "pending" },
        { id: 2, amount: 2500, status: "pending" },
      ];

      EmployeeBonusService.getPendingBonuses.mockResolvedValue(mockBonuses);

      const res = await request(app)
        .get("/bonuses/pending")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.bonuses).toHaveLength(2);
      expect(res.body.bonuses[0].status).toBe("pending");
    });
  });

  // =============================================
  // GET /bonuses/summary - Get Bonus Summary
  // =============================================
  describe("GET /bonuses/summary", () => {
    it("should return bonus summary", async () => {
      const mockSummary = {
        totalBonuses: 10,
        pendingCount: 3,
        paidCount: 7,
        pendingAmount: 7500,
        paidAmount: 17500,
      };

      EmployeeBonusService.getBonusSummary.mockResolvedValue(mockSummary);

      const res = await request(app)
        .get("/bonuses/summary")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.totalBonuses).toBe(10);
      expect(res.body.pendingAmount).toBe(7500);
    });
  });

  // =============================================
  // PUT /bonuses/:id/paid - Mark Bonus Paid
  // =============================================
  describe("PUT /bonuses/:id/paid", () => {
    it("should mark bonus as paid", async () => {
      const mockBonus = {
        id: 1,
        status: "paid",
        paidAt: new Date(),
        paidNote: "Paid via check",
      };

      EmployeeBonusService.markBonusPaid.mockResolvedValue(mockBonus);

      const res = await request(app)
        .put("/bonuses/1/paid")
        .set("Authorization", "Bearer valid-token")
        .send({ note: "Paid via check" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bonus.status).toBe("paid");
    });

    it("should return 404 for non-existent bonus", async () => {
      EmployeeBonusService.markBonusPaid.mockRejectedValue(
        new Error("Bonus not found")
      );

      const res = await request(app)
        .put("/bonuses/999/paid")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });

    it("should return 403 for unauthorized access", async () => {
      EmployeeBonusService.markBonusPaid.mockRejectedValue(
        new Error("Unauthorized")
      );

      const res = await request(app)
        .put("/bonuses/1/paid")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(403);
    });
  });

  // =============================================
  // DELETE /bonuses/:id - Cancel Bonus
  // =============================================
  describe("DELETE /bonuses/:id", () => {
    it("should cancel a bonus", async () => {
      const mockBonus = {
        id: 1,
        status: "cancelled",
      };

      EmployeeBonusService.cancelBonus.mockResolvedValue(mockBonus);

      const res = await request(app)
        .delete("/bonuses/1")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bonus.status).toBe("cancelled");
    });

    it("should return 404 for non-existent bonus", async () => {
      EmployeeBonusService.cancelBonus.mockRejectedValue(
        new Error("Bonus not found")
      );

      const res = await request(app)
        .delete("/bonuses/999")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });

    it("should return 400 for already paid bonus", async () => {
      EmployeeBonusService.cancelBonus.mockRejectedValue(
        new Error("Cannot cancel a bonus that is already paid")
      );

      const res = await request(app)
        .delete("/bonuses/1")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
    });
  });
});
