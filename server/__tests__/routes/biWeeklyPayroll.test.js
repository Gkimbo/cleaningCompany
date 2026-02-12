/**
 * Tests for Bi-Weekly Payroll API Endpoints
 * Tests the pending earnings and payroll API endpoints
 */

const express = require("express");
const request = require("supertest");

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn((token, secret) => {
    if (token === "employee-token") {
      return { userId: 10 };
    }
    if (token === "owner-token") {
      return { userId: 1 };
    }
    throw new Error("Invalid token");
  }),
}));

// Mock EmployeeBatchPayoutService
jest.mock("../../services/EmployeeBatchPayoutService", () => ({
  getPendingEarningsForEmployee: jest.fn(),
  getPendingPayrollForBusiness: jest.fn(),
  processEarlyPayout: jest.fn(),
  getNextPayoutDate: jest.fn(() => new Date("2024-01-19")),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  EmployeePendingPayout: {
    findAll: jest.fn(),
  },
}));

const jwt = require("jsonwebtoken");
const EmployeeBatchPayoutService = require("../../services/EmployeeBatchPayoutService");
const { User, BusinessEmployee } = require("../../models");

// Create a test app
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

// Employee pending earnings endpoint
app.get("/business-employee/pending-earnings", authMiddleware, async (req, res) => {
  try {
    const employee = await BusinessEmployee.findOne({
      where: { userId: req.userId, status: "active" },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const result = await EmployeeBatchPayoutService.getPendingEarningsForEmployee(employee.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Business owner pending payroll endpoint
app.get("/business-owner/payroll/pending", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user || !user.isBusinessOwner) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await EmployeeBatchPayoutService.getPendingPayrollForBusiness(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Business owner early payout endpoint
app.post("/business-owner/payroll/early-payout/:employeeId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user || !user.isBusinessOwner) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const employeeId = parseInt(req.params.employeeId);
    const result = await EmployeeBatchPayoutService.processEarlyPayout(employeeId, req.userId);
    res.json(result);
  } catch (err) {
    if (err.message.includes("not found") || err.message.includes("Not authorized")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

describe("Bi-Weekly Payroll API Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // GET /business-employee/pending-earnings
  // =============================================
  describe("GET /business-employee/pending-earnings", () => {
    it("should return pending earnings for authenticated employee", async () => {
      BusinessEmployee.findOne.mockResolvedValue({ id: 5, userId: 10, status: "active" });
      EmployeeBatchPayoutService.getPendingEarningsForEmployee.mockResolvedValue({
        pendingAmount: 7500,
        nextPayoutDate: new Date("2024-01-19"),
        payouts: [
          { id: 1, amount: 4000 },
          { id: 2, amount: 3500 },
        ],
        formatted: { pendingAmount: "$75.00" },
      });

      const response = await request(app)
        .get("/business-employee/pending-earnings")
        .set("Authorization", "Bearer employee-token");

      expect(response.status).toBe(200);
      expect(response.body.pendingAmount).toBe(7500);
      expect(response.body.payouts).toHaveLength(2);
      expect(response.body.formatted.pendingAmount).toBe("$75.00");
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).get("/business-employee/pending-earnings");

      expect(response.status).toBe(401);
    });

    it("should return 404 if employee not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/business-employee/pending-earnings")
        .set("Authorization", "Bearer employee-token");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Employee not found");
    });

    it("should return empty data when no pending earnings", async () => {
      BusinessEmployee.findOne.mockResolvedValue({ id: 5, userId: 10, status: "active" });
      EmployeeBatchPayoutService.getPendingEarningsForEmployee.mockResolvedValue({
        pendingAmount: 0,
        nextPayoutDate: new Date("2024-01-19"),
        payouts: [],
        formatted: { pendingAmount: "$0.00" },
      });

      const response = await request(app)
        .get("/business-employee/pending-earnings")
        .set("Authorization", "Bearer employee-token");

      expect(response.status).toBe(200);
      expect(response.body.pendingAmount).toBe(0);
      expect(response.body.payouts).toHaveLength(0);
    });
  });

  // =============================================
  // GET /business-owner/payroll/pending
  // =============================================
  describe("GET /business-owner/payroll/pending", () => {
    it("should return pending payroll for business owner", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: true });
      EmployeeBatchPayoutService.getPendingPayrollForBusiness.mockResolvedValue({
        totalPending: 12500,
        nextPayoutDate: new Date("2024-01-19"),
        byEmployee: [
          { employeeId: 10, firstName: "John", lastName: "Doe", amount: 7500 },
          { employeeId: 11, firstName: "Jane", lastName: "Smith", amount: 5000 },
        ],
        formatted: { totalPending: "$125.00" },
      });

      const response = await request(app)
        .get("/business-owner/payroll/pending")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(response.body.totalPending).toBe(12500);
      expect(response.body.byEmployee).toHaveLength(2);
    });

    it("should return 403 for non-business owner", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: false });

      const response = await request(app)
        .get("/business-owner/payroll/pending")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(403);
    });

    it("should return empty payroll when no pending payments", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: true });
      EmployeeBatchPayoutService.getPendingPayrollForBusiness.mockResolvedValue({
        totalPending: 0,
        nextPayoutDate: new Date("2024-01-19"),
        byEmployee: [],
        formatted: { totalPending: "$0.00" },
      });

      const response = await request(app)
        .get("/business-owner/payroll/pending")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(response.body.totalPending).toBe(0);
      expect(response.body.byEmployee).toHaveLength(0);
    });
  });

  // =============================================
  // POST /business-owner/payroll/early-payout/:employeeId
  // =============================================
  describe("POST /business-owner/payroll/early-payout/:employeeId", () => {
    it("should trigger early payout for employee", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: true });
      EmployeeBatchPayoutService.processEarlyPayout.mockResolvedValue({
        success: true,
        totalAmount: 7500,
        payoutCount: 2,
        formattedAmount: "$75.00",
      });

      const response = await request(app)
        .post("/business-owner/payroll/early-payout/10")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalAmount).toBe(7500);
      expect(EmployeeBatchPayoutService.processEarlyPayout).toHaveBeenCalledWith(10, 1);
    });

    it("should return 403 for non-business owner", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: false });

      const response = await request(app)
        .post("/business-owner/payroll/early-payout/10")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(403);
    });

    it("should return 404 if employee not found", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: true });
      EmployeeBatchPayoutService.processEarlyPayout.mockRejectedValue(
        new Error("Employee not found")
      );

      const response = await request(app)
        .post("/business-owner/payroll/early-payout/999")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(404);
    });

    it("should return 404 if employee belongs to different business", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: true });
      EmployeeBatchPayoutService.processEarlyPayout.mockRejectedValue(
        new Error("Not authorized to pay this employee")
      );

      const response = await request(app)
        .post("/business-owner/payroll/early-payout/10")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(404);
    });

    it("should handle zero pending payouts gracefully", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: true });
      EmployeeBatchPayoutService.processEarlyPayout.mockResolvedValue({
        success: true,
        totalAmount: 0,
        payoutCount: 0,
        formattedAmount: "$0.00",
        message: "No pending payouts to process",
      });

      const response = await request(app)
        .post("/business-owner/payroll/early-payout/10")
        .set("Authorization", "Bearer owner-token");

      expect(response.status).toBe(200);
      expect(response.body.totalAmount).toBe(0);
    });
  });
});
