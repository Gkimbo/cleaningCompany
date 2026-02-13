/**
 * Tests for EmployeeBonusService
 * Tests the employee bonus service functionality
 */

// Mock models
jest.mock("../../models", () => {
  const { Op } = require("sequelize");
  return {
    EmployeeBonus: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      sum: jest.fn(),
    },
    BusinessEmployee: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
    },
    User: {
      findByPk: jest.fn(),
    },
    sequelize: {
      fn: jest.fn((name, col) => `${name}(${col})`),
      col: jest.fn((name) => name),
      literal: jest.fn(),
      Sequelize: { Op },
    },
  };
});

const EmployeeBonusService = require("../../services/EmployeeBonusService");
const { EmployeeBonus, BusinessEmployee, User } = require("../../models");

describe("EmployeeBonusService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // createBonus
  // =============================================
  describe("createBonus", () => {
    const mockBusinessOwner = {
      id: 1,
      isBusinessOwner: true,
    };

    const mockBusinessEmployee = {
      id: 3,
      businessOwnerId: 1,
      employeeId: 2,
      status: "active",
    };

    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      BusinessEmployee.findOne.mockResolvedValue(mockBusinessEmployee);
    });

    it("should create a bonus successfully", async () => {
      const mockCreatedBonus = {
        id: 1,
        businessOwnerId: 1,
        employeeId: 2,
        businessEmployeeId: 3,
        amount: 5000,
        reason: "Great work",
        status: "pending",
        createdAt: new Date(),
        employee: { id: 2, firstName: "John", lastName: "Doe", email: "john@test.com" },
      };

      EmployeeBonus.create.mockResolvedValue({ id: 1 });
      EmployeeBonus.findByPk.mockResolvedValue(mockCreatedBonus);

      const result = await EmployeeBonusService.createBonus(1, 2, 5000, "Great work");

      expect(result.id).toBe(1);
      expect(result.amount).toBe(5000);
      expect(result.status).toBe("pending");
      expect(EmployeeBonus.create).toHaveBeenCalled();
    });

    it("should throw error for invalid employee", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        EmployeeBonusService.createBonus(1, 999, 5000)
      ).rejects.toThrow("Employee not found or not active");
    });

    it("should throw error for zero amount", async () => {
      await expect(
        EmployeeBonusService.createBonus(1, 2, 0)
      ).rejects.toThrow("Bonus amount must be greater than 0");
    });

    it("should throw error for negative amount", async () => {
      await expect(
        EmployeeBonusService.createBonus(1, 2, -100)
      ).rejects.toThrow("Bonus amount must be greater than 0");
    });

    it("should throw error for invalid business owner", async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        EmployeeBonusService.createBonus(999, 2, 5000)
      ).rejects.toThrow("Invalid business owner");
    });

    it("should throw error for non-business owner user", async () => {
      User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: false });

      await expect(
        EmployeeBonusService.createBonus(1, 2, 5000)
      ).rejects.toThrow("Invalid business owner");
    });

    it("should create bonus without reason", async () => {
      const mockCreatedBonus = {
        id: 1,
        businessOwnerId: 1,
        employeeId: 2,
        amount: 5000,
        reason: null,
        status: "pending",
        employee: { id: 2, firstName: "John", lastName: "Doe", email: "john@test.com" },
      };

      EmployeeBonus.create.mockResolvedValue({ id: 1 });
      EmployeeBonus.findByPk.mockResolvedValue(mockCreatedBonus);

      const result = await EmployeeBonusService.createBonus(1, 2, 5000);

      expect(result.reason).toBeNull();
    });
  });

  // =============================================
  // markBonusPaid
  // =============================================
  describe("markBonusPaid", () => {
    it("should mark bonus as paid", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        status: "pending",
        paidAt: null,
        paidNote: null,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUpdatedBonus = {
        ...mockBonus,
        status: "paid",
        paidAt: new Date(),
        paidNote: "Paid via Venmo",
        employee: { id: 2, firstName: "John", lastName: "Doe", email: "john@test.com" },
      };

      EmployeeBonus.findOne.mockResolvedValue(mockBonus);
      EmployeeBonus.findByPk.mockResolvedValue(mockUpdatedBonus);

      const result = await EmployeeBonusService.markBonusPaid(1, 1, "Paid via Venmo");

      expect(mockBonus.update).toHaveBeenCalledWith({
        status: "paid",
        paidAt: expect.any(Date),
        paidNote: "Paid via Venmo",
      });
      expect(result.status).toBe("paid");
    });

    it("should throw error for non-existent bonus", async () => {
      EmployeeBonus.findOne.mockResolvedValue(null);

      await expect(
        EmployeeBonusService.markBonusPaid(999, 1)
      ).rejects.toThrow("Bonus not found");
    });

    it("should throw error for wrong business owner (bonus not found)", async () => {
      // Service uses findOne with both id and businessOwnerId, so wrong owner = not found
      EmployeeBonus.findOne.mockResolvedValue(null);

      await expect(
        EmployeeBonusService.markBonusPaid(1, 999)
      ).rejects.toThrow("Bonus not found");
    });

    it("should throw error for already paid bonus", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        status: "paid",
      };

      EmployeeBonus.findOne.mockResolvedValue(mockBonus);

      await expect(
        EmployeeBonusService.markBonusPaid(1, 1)
      ).rejects.toThrow("Cannot mark bonus as paid - current status is paid");
    });

    it("should throw error for cancelled bonus", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        status: "cancelled",
      };

      EmployeeBonus.findOne.mockResolvedValue(mockBonus);

      await expect(
        EmployeeBonusService.markBonusPaid(1, 1)
      ).rejects.toThrow("Cannot mark bonus as paid - current status is cancelled");
    });
  });

  // =============================================
  // cancelBonus
  // =============================================
  describe("cancelBonus", () => {
    it("should cancel a pending bonus", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        status: "pending",
        update: jest.fn().mockResolvedValue(true),
      };

      EmployeeBonus.findOne.mockResolvedValue(mockBonus);

      const result = await EmployeeBonusService.cancelBonus(1, 1);

      expect(mockBonus.update).toHaveBeenCalledWith({ status: "cancelled" });
      expect(result.success).toBe(true);
    });

    it("should throw error for non-existent bonus", async () => {
      EmployeeBonus.findOne.mockResolvedValue(null);

      await expect(
        EmployeeBonusService.cancelBonus(999, 1)
      ).rejects.toThrow("Bonus not found");
    });

    it("should throw error for wrong business owner (bonus not found)", async () => {
      EmployeeBonus.findOne.mockResolvedValue(null);

      await expect(
        EmployeeBonusService.cancelBonus(1, 999)
      ).rejects.toThrow("Bonus not found");
    });

    it("should throw error for already paid bonus", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        status: "paid",
      };

      EmployeeBonus.findOne.mockResolvedValue(mockBonus);

      await expect(
        EmployeeBonusService.cancelBonus(1, 1)
      ).rejects.toThrow("Cannot cancel bonus - current status is paid");
    });
  });

  // =============================================
  // getPendingBonuses
  // =============================================
  describe("getPendingBonuses", () => {
    it("should return pending bonuses for business owner", async () => {
      const mockBonuses = [
        {
          id: 1,
          businessOwnerId: 1,
          employeeId: 2,
          amount: 5000,
          reason: "Great work",
          status: "pending",
          createdAt: new Date(),
          employee: { id: 2, firstName: "John", lastName: "Doe", email: "john@test.com" },
        },
        {
          id: 2,
          businessOwnerId: 1,
          employeeId: 3,
          amount: 2500,
          reason: "Holiday bonus",
          status: "pending",
          createdAt: new Date(),
          employee: { id: 3, firstName: "Jane", lastName: "Smith", email: "jane@test.com" },
        },
      ];

      EmployeeBonus.findAll.mockResolvedValue(mockBonuses);

      const result = await EmployeeBonusService.getPendingBonuses(1);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("pending");
      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessOwnerId: 1,
            status: "pending",
          }),
        })
      );
    });

    it("should return empty array when no pending bonuses", async () => {
      EmployeeBonus.findAll.mockResolvedValue([]);

      const result = await EmployeeBonusService.getPendingBonuses(1);

      expect(result).toHaveLength(0);
    });
  });

  // =============================================
  // getBonusesForEmployee
  // =============================================
  describe("getBonusesForEmployee", () => {
    it("should return bonuses for employee", async () => {
      const mockBonuses = [
        {
          id: 1,
          employeeId: 2,
          amount: 5000,
          status: "paid",
          createdAt: new Date(),
          businessOwner: { id: 1, firstName: "Owner", lastName: "Test" },
        },
      ];

      EmployeeBonus.findAll.mockResolvedValue(mockBonuses);

      const result = await EmployeeBonusService.getBonusesForEmployee(2);

      expect(result).toHaveLength(1);
      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 2,
          }),
        })
      );
    });

    it("should respect limit option", async () => {
      EmployeeBonus.findAll.mockResolvedValue([]);

      await EmployeeBonusService.getBonusesForEmployee(2, { limit: 10 });

      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    it("should include pending when includePending is true", async () => {
      EmployeeBonus.findAll.mockResolvedValue([]);

      await EmployeeBonusService.getBonusesForEmployee(2, { includePending: true });

      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ["pending", "paid"],
          }),
        })
      );
    });

    it("should only include paid when includePending is false", async () => {
      EmployeeBonus.findAll.mockResolvedValue([]);

      await EmployeeBonusService.getBonusesForEmployee(2, { includePending: false });

      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ["paid"],
          }),
        })
      );
    });
  });

  // =============================================
  // getBonusSummary
  // =============================================
  describe("getBonusSummary", () => {
    it("should return bonus summary for business owner", async () => {
      EmployeeBonus.findOne
        .mockResolvedValueOnce({ total: 7500, count: 2 }) // pending
        .mockResolvedValueOnce({ total: 15000, count: 3 }); // paid

      const result = await EmployeeBonusService.getBonusSummary(1);

      expect(result.pending.total).toBe(7500);
      expect(result.pending.count).toBe(2);
      expect(result.paid.total).toBe(15000);
      expect(result.paid.count).toBe(3);
    });

    it("should return zeros when no bonuses", async () => {
      EmployeeBonus.findOne.mockResolvedValue({ total: null, count: 0 });

      const result = await EmployeeBonusService.getBonusSummary(1);

      expect(result.pending.total).toBe(0);
      expect(result.pending.count).toBe(0);
      expect(result.paid.total).toBe(0);
      expect(result.paid.count).toBe(0);
    });
  });

  // =============================================
  // getBonusesForBusinessOwner
  // =============================================
  describe("getBonusesForBusinessOwner", () => {
    it("should return all bonuses for business owner", async () => {
      const mockBonuses = [
        {
          id: 1,
          businessOwnerId: 1,
          status: "paid",
          amount: 5000,
          employee: { id: 2, firstName: "John", lastName: "Doe", email: "john@test.com" },
        },
        {
          id: 2,
          businessOwnerId: 1,
          status: "pending",
          amount: 2500,
          employee: { id: 3, firstName: "Jane", lastName: "Smith", email: "jane@test.com" },
        },
      ];

      EmployeeBonus.findAll.mockResolvedValue(mockBonuses);

      const result = await EmployeeBonusService.getBonusesForBusinessOwner(1);

      expect(result).toHaveLength(2);
    });

    it("should filter by status", async () => {
      EmployeeBonus.findAll.mockResolvedValue([]);

      await EmployeeBonusService.getBonusesForBusinessOwner(1, { status: "paid" });

      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "paid",
          }),
        })
      );
    });

    it("should filter by employeeId", async () => {
      EmployeeBonus.findAll.mockResolvedValue([]);

      await EmployeeBonusService.getBonusesForBusinessOwner(1, { employeeId: 2 });

      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 2,
          }),
        })
      );
    });

    it("should respect limit option", async () => {
      EmployeeBonus.findAll.mockResolvedValue([]);

      await EmployeeBonusService.getBonusesForBusinessOwner(1, { limit: 25 });

      expect(EmployeeBonus.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
        })
      );
    });
  });
});
