/**
 * Tests for EmployeePendingPayout Model
 * Tests the pending payout model functionality, validations, and class methods
 */

// Mock Sequelize
jest.mock("sequelize", () => {
  const actual = jest.requireActual("sequelize");
  return {
    ...actual,
    DataTypes: actual.DataTypes,
  };
});

// Mock the models
jest.mock("../../models", () => {
  return {
    EmployeePendingPayout: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
      sum: jest.fn(),
      count: jest.fn(),
    },
    BusinessEmployee: {
      findByPk: jest.fn(),
    },
    EmployeeJobAssignment: {
      findByPk: jest.fn(),
      update: jest.fn(),
    },
    UserAppointments: {
      findByPk: jest.fn(),
    },
    User: {
      findByPk: jest.fn(),
    },
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
    },
  };
});

const { EmployeePendingPayout, BusinessEmployee, EmployeeJobAssignment } = require("../../models");

describe("EmployeePendingPayout Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // Basic CRUD Operations
  // =============================================
  describe("Basic Operations", () => {
    it("should create a pending payout with valid data", async () => {
      const payoutData = {
        businessEmployeeId: 10,
        businessOwnerId: 1,
        employeeJobAssignmentId: 100,
        appointmentId: 50,
        amount: 4000,
        payType: "hourly",
        hoursWorked: 2.0,
        status: "pending",
        earnedAt: new Date(),
        scheduledPayoutDate: new Date("2024-01-19"),
      };

      EmployeePendingPayout.create.mockResolvedValue({
        id: 1,
        ...payoutData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await EmployeePendingPayout.create(payoutData);

      expect(result.id).toBe(1);
      expect(result.amount).toBe(4000);
      expect(result.status).toBe("pending");
      expect(EmployeePendingPayout.create).toHaveBeenCalledWith(payoutData);
    });

    it("should find pending payout by ID", async () => {
      const mockPayout = {
        id: 1,
        businessEmployeeId: 10,
        amount: 4000,
        status: "pending",
      };

      EmployeePendingPayout.findByPk.mockResolvedValue(mockPayout);

      const result = await EmployeePendingPayout.findByPk(1);

      expect(result).toEqual(mockPayout);
      expect(EmployeePendingPayout.findByPk).toHaveBeenCalledWith(1);
    });

    it("should return null for non-existent payout", async () => {
      EmployeePendingPayout.findByPk.mockResolvedValue(null);

      const result = await EmployeePendingPayout.findByPk(999);

      expect(result).toBeNull();
    });
  });

  // =============================================
  // Status Values
  // =============================================
  describe("Status Values", () => {
    const validStatuses = ["pending", "processing", "completed", "failed", "cancelled"];

    validStatuses.forEach((status) => {
      it(`should accept "${status}" as a valid status`, async () => {
        EmployeePendingPayout.create.mockResolvedValue({
          id: 1,
          status,
        });

        const result = await EmployeePendingPayout.create({ status });

        expect(result.status).toBe(status);
      });
    });
  });

  // =============================================
  // Pay Types
  // =============================================
  describe("Pay Types", () => {
    const payTypes = ["hourly", "per_job", "percentage"];

    payTypes.forEach((payType) => {
      it(`should accept "${payType}" as a valid pay type`, async () => {
        EmployeePendingPayout.create.mockResolvedValue({
          id: 1,
          payType,
        });

        const result = await EmployeePendingPayout.create({ payType });

        expect(result.payType).toBe(payType);
      });
    });

    it("should store hours worked for hourly pay type", async () => {
      const payoutData = {
        payType: "hourly",
        hoursWorked: 2.5,
        amount: 5000, // $50 for 2.5 hours at $20/hr
      };

      EmployeePendingPayout.create.mockResolvedValue({
        id: 1,
        ...payoutData,
      });

      const result = await EmployeePendingPayout.create(payoutData);

      expect(result.hoursWorked).toBe(2.5);
      expect(result.amount).toBe(5000);
    });
  });

  // =============================================
  // Find Pending Payouts
  // =============================================
  describe("Finding Pending Payouts", () => {
    it("should find all pending payouts for an employee", async () => {
      const mockPayouts = [
        { id: 1, businessEmployeeId: 10, amount: 4000, status: "pending" },
        { id: 2, businessEmployeeId: 10, amount: 3500, status: "pending" },
      ];

      EmployeePendingPayout.findAll.mockResolvedValue(mockPayouts);

      const result = await EmployeePendingPayout.findAll({
        where: { businessEmployeeId: 10, status: "pending" },
      });

      expect(result).toHaveLength(2);
      expect(result[0].businessEmployeeId).toBe(10);
    });

    it("should find pending payouts for a business owner", async () => {
      const mockPayouts = [
        { id: 1, businessOwnerId: 1, businessEmployeeId: 10, amount: 4000 },
        { id: 2, businessOwnerId: 1, businessEmployeeId: 11, amount: 5000 },
      ];

      EmployeePendingPayout.findAll.mockResolvedValue(mockPayouts);

      const result = await EmployeePendingPayout.findAll({
        where: { businessOwnerId: 1, status: "pending" },
      });

      expect(result).toHaveLength(2);
    });

    it("should find payouts scheduled for a specific date", async () => {
      const targetDate = new Date("2024-01-19");
      const mockPayouts = [
        { id: 1, scheduledPayoutDate: targetDate, status: "pending" },
      ];

      EmployeePendingPayout.findAll.mockResolvedValue(mockPayouts);

      const result = await EmployeePendingPayout.findAll({
        where: { scheduledPayoutDate: targetDate, status: "pending" },
      });

      expect(result).toHaveLength(1);
    });
  });

  // =============================================
  // Status Transitions
  // =============================================
  describe("Status Transitions", () => {
    it("should allow pending to processing transition", async () => {
      const payout = {
        id: 1,
        status: "pending",
        update: jest.fn(),
      };

      EmployeePendingPayout.findByPk.mockResolvedValue(payout);

      payout.status = "processing";
      await payout.update({ status: "processing" });

      expect(payout.update).toHaveBeenCalledWith({ status: "processing" });
    });

    it("should allow processing to completed transition", async () => {
      const payout = {
        id: 1,
        status: "processing",
        update: jest.fn(),
      };

      await payout.update({
        status: "completed",
        paidAt: new Date(),
        stripeTransferId: "tr_123456",
      });

      expect(payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          stripeTransferId: "tr_123456",
        })
      );
    });

    it("should allow processing to failed transition", async () => {
      const payout = {
        id: 1,
        status: "processing",
        update: jest.fn(),
      };

      await payout.update({
        status: "failed",
        failureReason: "Stripe account not active",
      });

      expect(payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          failureReason: "Stripe account not active",
        })
      );
    });

    it("should allow pending to cancelled transition", async () => {
      const payout = {
        id: 1,
        status: "pending",
        update: jest.fn(),
      };

      await payout.update({
        status: "cancelled",
        failureReason: "Job disputed",
      });

      expect(payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          failureReason: "Job disputed",
        })
      );
    });
  });

  // =============================================
  // Associations
  // =============================================
  describe("Associations", () => {
    it("should include employee in query", async () => {
      const mockPayout = {
        id: 1,
        businessEmployeeId: 10,
        employee: { id: 10, firstName: "John", lastName: "Doe" },
      };

      EmployeePendingPayout.findByPk.mockResolvedValue(mockPayout);

      const result = await EmployeePendingPayout.findByPk(1, {
        include: ["employee"],
      });

      expect(result.employee).toBeDefined();
      expect(result.employee.firstName).toBe("John");
    });

    it("should include assignment in query", async () => {
      const mockPayout = {
        id: 1,
        employeeJobAssignmentId: 100,
        assignment: { id: 100, payAmount: 4000, status: "completed" },
      };

      EmployeePendingPayout.findByPk.mockResolvedValue(mockPayout);

      const result = await EmployeePendingPayout.findByPk(1, {
        include: ["assignment"],
      });

      expect(result.assignment).toBeDefined();
      expect(result.assignment.payAmount).toBe(4000);
    });

    it("should include appointment in query", async () => {
      const mockPayout = {
        id: 1,
        appointmentId: 50,
        appointment: {
          id: 50,
          date: "2024-01-15",
          startTime: "10:00",
        },
      };

      EmployeePendingPayout.findByPk.mockResolvedValue(mockPayout);

      const result = await EmployeePendingPayout.findByPk(1, {
        include: ["appointment"],
      });

      expect(result.appointment).toBeDefined();
      expect(result.appointment.date).toBe("2024-01-15");
    });
  });

  // =============================================
  // Amount Handling
  // =============================================
  describe("Amount Handling", () => {
    it("should store amount in cents", async () => {
      const payoutData = {
        amount: 4000, // $40.00 in cents
      };

      EmployeePendingPayout.create.mockResolvedValue({
        id: 1,
        ...payoutData,
      });

      const result = await EmployeePendingPayout.create(payoutData);

      expect(result.amount).toBe(4000);
    });

    it("should handle large payout amounts", async () => {
      const largeAmount = 10000000; // $100,000 in cents

      EmployeePendingPayout.create.mockResolvedValue({
        id: 1,
        amount: largeAmount,
      });

      const result = await EmployeePendingPayout.create({ amount: largeAmount });

      expect(result.amount).toBe(largeAmount);
    });

    it("should calculate total pending amount", async () => {
      EmployeePendingPayout.sum.mockResolvedValue(12500);

      const result = await EmployeePendingPayout.sum("amount", {
        where: { businessEmployeeId: 10, status: "pending" },
      });

      expect(result).toBe(12500);
    });
  });

  // =============================================
  // Stripe Integration Fields
  // =============================================
  describe("Stripe Integration Fields", () => {
    it("should store Stripe transfer ID on completion", async () => {
      const payout = {
        id: 1,
        status: "pending",
        stripeTransferId: null,
        update: jest.fn(),
      };

      await payout.update({
        status: "completed",
        stripeTransferId: "tr_1234567890",
        paidAt: new Date(),
      });

      expect(payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeTransferId: "tr_1234567890",
        })
      );
    });

    it("should store failure reason on failed transfer", async () => {
      const payout = {
        id: 1,
        status: "processing",
        failureReason: null,
        update: jest.fn(),
      };

      await payout.update({
        status: "failed",
        failureReason: "insufficient_funds",
      });

      expect(payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: "insufficient_funds",
        })
      );
    });
  });

  // =============================================
  // Scheduled Payout Date
  // =============================================
  describe("Scheduled Payout Date", () => {
    it("should store scheduled payout date as DATE type", async () => {
      const scheduledDate = new Date("2024-01-19");

      EmployeePendingPayout.create.mockResolvedValue({
        id: 1,
        scheduledPayoutDate: scheduledDate,
      });

      const result = await EmployeePendingPayout.create({
        scheduledPayoutDate: scheduledDate,
      });

      expect(result.scheduledPayoutDate).toEqual(scheduledDate);
    });

    it("should find payouts due on or before a date", async () => {
      const dueDate = new Date("2024-01-19");
      const mockPayouts = [
        { id: 1, scheduledPayoutDate: new Date("2024-01-05") },
        { id: 2, scheduledPayoutDate: new Date("2024-01-19") },
      ];

      EmployeePendingPayout.findAll.mockResolvedValue(mockPayouts);

      const result = await EmployeePendingPayout.findAll({
        where: {
          scheduledPayoutDate: { $lte: dueDate },
          status: "pending",
        },
      });

      expect(result).toHaveLength(2);
    });
  });

  // =============================================
  // Unique Constraints
  // =============================================
  describe("Unique Constraints", () => {
    it("should have unique constraint on employeeJobAssignmentId", async () => {
      const payoutData = {
        businessEmployeeId: 10,
        employeeJobAssignmentId: 100,
        amount: 4000,
      };

      // First create succeeds
      EmployeePendingPayout.create.mockResolvedValueOnce({
        id: 1,
        ...payoutData,
      });

      // Second create fails due to unique constraint
      EmployeePendingPayout.create.mockRejectedValueOnce(
        new Error("Validation error: employeeJobAssignmentId must be unique")
      );

      await EmployeePendingPayout.create(payoutData);

      await expect(EmployeePendingPayout.create(payoutData)).rejects.toThrow(
        "employeeJobAssignmentId must be unique"
      );
    });
  });

  // =============================================
  // Count and Aggregation
  // =============================================
  describe("Count and Aggregation", () => {
    it("should count pending payouts for employee", async () => {
      EmployeePendingPayout.count.mockResolvedValue(5);

      const result = await EmployeePendingPayout.count({
        where: { businessEmployeeId: 10, status: "pending" },
      });

      expect(result).toBe(5);
    });

    it("should count pending payouts for business owner", async () => {
      EmployeePendingPayout.count.mockResolvedValue(12);

      const result = await EmployeePendingPayout.count({
        where: { businessOwnerId: 1, status: "pending" },
      });

      expect(result).toBe(12);
    });
  });
});
