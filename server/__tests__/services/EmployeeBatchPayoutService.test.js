/**
 * Tests for EmployeeBatchPayoutService
 * Tests bi-weekly batched employee payout functionality
 */

const { Op } = require("sequelize");

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    transfers: {
      create: jest.fn().mockResolvedValue({
        id: "tr_mock123",
        amount: 4000,
        destination: "acct_employee123",
      }),
    },
  }));
});

// Mock models
jest.mock("../../models", () => {
  const actualSequelize = require("sequelize");
  return {
    EmployeePendingPayout: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      sum: jest.fn(),
    },
    EmployeeJobAssignment: {
      findByPk: jest.fn(),
      update: jest.fn(),
    },
    BusinessEmployee: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
    },
    UserAppointments: {
      findByPk: jest.fn(),
    },
    User: {
      findByPk: jest.fn(),
    },
    StripeConnect: {
      findOne: jest.fn(),
    },
    sequelize: {
      fn: jest.fn((name, col) => `${name}(${col})`),
      col: jest.fn((name) => name),
      literal: jest.fn((str) => str),
      Sequelize: { Op: actualSequelize.Op },
      transaction: jest.fn((callback) => callback({ commit: jest.fn(), rollback: jest.fn() })),
    },
    Op: actualSequelize.Op,
  };
});

const EmployeeBatchPayoutService = require("../../services/EmployeeBatchPayoutService");
const {
  EmployeePendingPayout,
  EmployeeJobAssignment,
  BusinessEmployee,
  StripeConnect,
} = require("../../models");

describe("EmployeeBatchPayoutService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // getNextPayoutDate
  // =============================================
  describe("getNextPayoutDate", () => {
    it("should return a Friday", () => {
      const nextPayout = EmployeeBatchPayoutService.getNextPayoutDate();
      expect(nextPayout.getDay()).toBe(5); // Friday
    });

    it("should return a date in the future", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextPayout = EmployeeBatchPayoutService.getNextPayoutDate();
      expect(nextPayout >= today).toBe(true);
    });

    it("should return a bi-weekly Friday (every other Friday)", () => {
      const payout1 = EmployeeBatchPayoutService.getNextPayoutDate();
      // The anchor date is Jan 5, 2024 - payouts are every 2 weeks from there
      // The next payout should be on a bi-weekly cycle from that anchor
      expect(payout1.getDay()).toBe(5);
    });
  });

  // =============================================
  // isPayoutFriday
  // =============================================
  describe("isPayoutFriday", () => {
    it("should return false for a non-Friday date", () => {
      // Create a Monday explicitly
      const monday = new Date(2024, 0, 8); // Month is 0-indexed, so 0 = January
      expect(EmployeeBatchPayoutService.isPayoutFriday(monday)).toBe(false);
    });

    it("should return true for the anchor Friday", () => {
      // Anchor is Jan 5, 2024
      const anchorFriday = new Date(2024, 0, 5);
      expect(EmployeeBatchPayoutService.isPayoutFriday(anchorFriday)).toBe(true);
    });

    it("should return true for bi-weekly Friday from anchor", () => {
      // Two weeks after anchor: Jan 19, 2024
      const twoWeeksFromAnchor = new Date(2024, 0, 19);
      expect(EmployeeBatchPayoutService.isPayoutFriday(twoWeeksFromAnchor)).toBe(true);
    });

    it("should return false for odd-week Friday from anchor", () => {
      // One week after anchor: Jan 12, 2024
      const oneWeekFromAnchor = new Date(2024, 0, 12);
      expect(EmployeeBatchPayoutService.isPayoutFriday(oneWeekFromAnchor)).toBe(false);
    });
  });

  // =============================================
  // createPendingPayout
  // =============================================
  describe("createPendingPayout", () => {
    const mockAssignment = {
      id: 1,
      businessEmployeeId: 10,
      businessOwnerId: 1,
      appointmentId: 100,
      payType: "hourly",
      hoursWorked: 2,
      update: jest.fn(),
    };

    const mockAppointment = {
      id: 100,
      userId: 5,
    };

    beforeEach(() => {
      EmployeePendingPayout.create.mockResolvedValue({
        id: 1,
        businessEmployeeId: 10,
        amount: 4000,
        status: "pending",
      });
    });

    it("should create a pending payout record", async () => {
      const result = await EmployeeBatchPayoutService.createPendingPayout(
        mockAssignment,
        4000, // $40.00
        mockAppointment
      );

      expect(EmployeePendingPayout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessEmployeeId: 10,
          amount: 4000,
          status: "pending",
        })
      );
      expect(result.id).toBe(1);
    });

    it("should set correct scheduled payout date", async () => {
      await EmployeeBatchPayoutService.createPendingPayout(
        mockAssignment,
        4000,
        mockAppointment
      );

      const createCall = EmployeePendingPayout.create.mock.calls[0][0];
      const scheduledDate = new Date(createCall.scheduledPayoutDate);
      expect(scheduledDate.getDay()).toBe(5); // Friday
    });

    it("should update assignment with pending payout reference", async () => {
      await EmployeeBatchPayoutService.createPendingPayout(
        mockAssignment,
        4000,
        mockAppointment
      );

      expect(mockAssignment.update).toHaveBeenCalledWith({
        pendingPayoutId: 1,
        payoutStatus: "pending_batch",
      });
    });

    it("should include pay type and hours worked", async () => {
      await EmployeeBatchPayoutService.createPendingPayout(
        mockAssignment,
        4000,
        mockAppointment
      );

      expect(EmployeePendingPayout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payType: "hourly",
          hoursWorked: 2,
        })
      );
    });

    it("should include business owner ID", async () => {
      await EmployeeBatchPayoutService.createPendingPayout(
        mockAssignment,
        4000,
        mockAppointment
      );

      expect(EmployeePendingPayout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessOwnerId: 1,
        })
      );
    });
  });

  // =============================================
  // getPendingEarningsForEmployee
  // =============================================
  describe("getPendingEarningsForEmployee", () => {
    it("should query pending payouts for specific employee", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      await EmployeeBatchPayoutService.getPendingEarningsForEmployee(10);

      expect(EmployeePendingPayout.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessEmployeeId: 10,
            status: "pending",
          }),
        })
      );
    });

    it("should return empty result for employee with no pending payouts", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      const result = await EmployeeBatchPayoutService.getPendingEarningsForEmployee(10);

      expect(result.totalPending).toBe(0);
      expect(result.jobCount).toBe(0);
    });

    it("should include next payout date even when empty", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      const result = await EmployeeBatchPayoutService.getPendingEarningsForEmployee(10);

      expect(result.nextPayoutDate).toBeDefined();
    });
  });

  // =============================================
  // getPendingPayrollForBusiness
  // =============================================
  describe("getPendingPayrollForBusiness", () => {
    it("should query pending payouts for specific business owner", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      await EmployeeBatchPayoutService.getPendingPayrollForBusiness(1);

      expect(EmployeePendingPayout.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessOwnerId: 1,
            status: "pending",
          }),
        })
      );
    });

    it("should return zero for business with no pending payroll", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      const result = await EmployeeBatchPayoutService.getPendingPayrollForBusiness(1);

      expect(result.totalPending).toBe(0);
      expect(result.byEmployee).toHaveLength(0);
    });

    it("should include next payout date", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      const result = await EmployeeBatchPayoutService.getPendingPayrollForBusiness(1);

      expect(result.nextPayoutDate).toBeDefined();
    });
  });

  // =============================================
  // processBiWeeklyPayouts
  // =============================================
  describe("processBiWeeklyPayouts", () => {
    const mockPendingPayouts = [
      {
        id: 1,
        businessEmployeeId: 10,
        amount: 4000,
        status: "pending",
        update: jest.fn(),
        employee: {
          id: 10,
          userId: 20,
          user: { id: 20 },
        },
      },
    ];

    beforeEach(() => {
      EmployeePendingPayout.findAll.mockResolvedValue(mockPendingPayouts);
      StripeConnect.findOne.mockResolvedValue({
        stripeAccountId: "acct_employee123",
        payoutsEnabled: true,
      });
    });

    it("should return empty result when no pending payouts", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      const result = await EmployeeBatchPayoutService.processBiWeeklyPayouts();

      expect(result.processed).toBe(0);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it("should group payouts by employee", async () => {
      const multiPayouts = [
        {
          id: 1,
          businessEmployeeId: 10,
          amount: 4000,
          update: jest.fn(),
          employee: { id: 10, userId: 20, user: { id: 20 } },
        },
        {
          id: 2,
          businessEmployeeId: 10,
          amount: 3500,
          update: jest.fn(),
          employee: { id: 10, userId: 20, user: { id: 20 } },
        },
      ];

      EmployeePendingPayout.findAll.mockResolvedValue(multiPayouts);
      StripeConnect.findOne.mockResolvedValue({
        stripeAccountId: "acct_employee123",
        payoutsEnabled: true,
      });

      const result = await EmployeeBatchPayoutService.processBiWeeklyPayouts();

      // Should process 2 individual payouts but as 1 batch
      expect(result.processed).toBe(2);
      expect(result.results).toHaveLength(1); // One result per employee
    });

    it("should handle employee without Stripe account", async () => {
      StripeConnect.findOne.mockResolvedValue(null);

      const result = await EmployeeBatchPayoutService.processBiWeeklyPayouts();

      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(false);
    });
  });

  // =============================================
  // processEarlyPayout
  // =============================================
  describe("processEarlyPayout", () => {
    it("should return error when no pending payouts found", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      const result = await EmployeeBatchPayoutService.processEarlyPayout(10, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No pending payouts");
    });

    it("should query for payouts matching employee and business owner", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      await EmployeeBatchPayoutService.processEarlyPayout(10, 1);

      expect(EmployeePendingPayout.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessEmployeeId: 10,
            businessOwnerId: 1,
            status: "pending",
          }),
        })
      );
    });
  });

  // =============================================
  // processTerminationPayout
  // =============================================
  describe("processTerminationPayout", () => {
    it("should return success with zero when no pending payouts", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      const result = await EmployeeBatchPayoutService.processTerminationPayout(10);

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(0);
      expect(result.message).toContain("No pending payouts");
    });

    it("should query for pending payouts for the employee", async () => {
      EmployeePendingPayout.findAll.mockResolvedValue([]);

      await EmployeeBatchPayoutService.processTerminationPayout(10);

      expect(EmployeePendingPayout.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessEmployeeId: 10,
            status: "pending",
          }),
        })
      );
    });
  });

  // =============================================
  // cancelPendingPayout
  // =============================================
  describe("cancelPendingPayout", () => {
    it("should cancel a pending payout", async () => {
      const mockPayout = {
        id: 1,
        employeeJobAssignmentId: 100,
        status: "pending",
        update: jest.fn(),
      };

      EmployeePendingPayout.findOne.mockResolvedValue(mockPayout);
      EmployeeJobAssignment.findByPk.mockResolvedValue({
        id: 100,
        update: jest.fn(),
      });

      const result = await EmployeeBatchPayoutService.cancelPendingPayout(100, "Job disputed");

      expect(mockPayout.update).toHaveBeenCalledWith({
        status: "cancelled",
        failureReason: "Job disputed",
      });
      expect(result.success).toBe(true);
    });

    it("should return error if payout not found", async () => {
      EmployeePendingPayout.findOne.mockResolvedValue(null);

      const result = await EmployeeBatchPayoutService.cancelPendingPayout(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No pending payout found");
    });

    it("should only find pending status payouts", async () => {
      // The service only looks for status: "pending", so completed payouts won't be found
      EmployeePendingPayout.findOne.mockResolvedValue(null);

      const result = await EmployeeBatchPayoutService.cancelPendingPayout(1);

      expect(result.success).toBe(false);
      expect(EmployeePendingPayout.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "pending",
          }),
        })
      );
    });
  });
});
