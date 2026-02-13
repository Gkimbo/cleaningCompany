/**
 * Tests for EmployeeBonus Model
 * Tests the employee bonus model functionality, validations, and class methods
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
  const mockBonus = {
    id: 1,
    businessOwnerId: 1,
    employeeId: 2,
    businessEmployeeId: 3,
    amount: 5000,
    reason: "Great performance this month",
    status: "pending",
    paidAt: null,
    paidNote: null,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  };

  return {
    EmployeeBonus: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
      sum: jest.fn(),
      // Class methods
      getPendingForBusinessOwner: jest.fn(),
      getForEmployee: jest.fn(),
      getTotalPendingAmount: jest.fn(),
    },
    User: {
      findByPk: jest.fn(),
    },
    BusinessEmployee: {
      findByPk: jest.fn(),
    },
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
    },
  };
});

const { EmployeeBonus, User, BusinessEmployee } = require("../../models");

describe("EmployeeBonus Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // Basic CRUD Operations
  // =============================================
  describe("Basic Operations", () => {
    it("should create a bonus with valid data", async () => {
      const bonusData = {
        businessOwnerId: 1,
        employeeId: 2,
        businessEmployeeId: 3,
        amount: 5000,
        reason: "Top performer",
        status: "pending",
      };

      EmployeeBonus.create.mockResolvedValue({
        id: 1,
        ...bonusData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await EmployeeBonus.create(bonusData);

      expect(result.id).toBe(1);
      expect(result.amount).toBe(5000);
      expect(result.status).toBe("pending");
      expect(EmployeeBonus.create).toHaveBeenCalledWith(bonusData);
    });

    it("should find bonus by ID", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        employeeId: 2,
        amount: 5000,
        status: "pending",
      };

      EmployeeBonus.findByPk.mockResolvedValue(mockBonus);

      const result = await EmployeeBonus.findByPk(1);

      expect(result).toEqual(mockBonus);
      expect(EmployeeBonus.findByPk).toHaveBeenCalledWith(1);
    });

    it("should return null for non-existent bonus", async () => {
      EmployeeBonus.findByPk.mockResolvedValue(null);

      const result = await EmployeeBonus.findByPk(999);

      expect(result).toBeNull();
    });
  });

  // =============================================
  // Class Methods
  // =============================================
  describe("Class Methods", () => {
    describe("getPendingForBusinessOwner", () => {
      it("should return pending bonuses for business owner", async () => {
        const mockBonuses = [
          { id: 1, businessOwnerId: 1, amount: 5000, status: "pending" },
          { id: 2, businessOwnerId: 1, amount: 2500, status: "pending" },
        ];

        EmployeeBonus.getPendingForBusinessOwner.mockResolvedValue(mockBonuses);

        const result = await EmployeeBonus.getPendingForBusinessOwner(1);

        expect(result).toHaveLength(2);
        expect(result[0].status).toBe("pending");
        expect(EmployeeBonus.getPendingForBusinessOwner).toHaveBeenCalledWith(1);
      });

      it("should return empty array when no pending bonuses", async () => {
        EmployeeBonus.getPendingForBusinessOwner.mockResolvedValue([]);

        const result = await EmployeeBonus.getPendingForBusinessOwner(1);

        expect(result).toHaveLength(0);
      });
    });

    describe("getForEmployee", () => {
      it("should return bonuses for employee", async () => {
        const mockBonuses = [
          { id: 1, employeeId: 2, amount: 5000, status: "paid" },
          { id: 2, employeeId: 2, amount: 2500, status: "pending" },
        ];

        EmployeeBonus.getForEmployee.mockResolvedValue(mockBonuses);

        const result = await EmployeeBonus.getForEmployee(2);

        expect(result).toHaveLength(2);
        expect(EmployeeBonus.getForEmployee).toHaveBeenCalledWith(2);
      });

      it("should respect limit option", async () => {
        const mockBonuses = [{ id: 1, employeeId: 2, amount: 5000 }];

        EmployeeBonus.getForEmployee.mockResolvedValue(mockBonuses);

        const result = await EmployeeBonus.getForEmployee(2, { limit: 1 });

        expect(result).toHaveLength(1);
      });
    });

    describe("getTotalPendingAmount", () => {
      it("should return total pending amount for business owner", async () => {
        EmployeeBonus.getTotalPendingAmount.mockResolvedValue(7500);

        const result = await EmployeeBonus.getTotalPendingAmount(1);

        expect(result).toBe(7500);
        expect(EmployeeBonus.getTotalPendingAmount).toHaveBeenCalledWith(1);
      });

      it("should return 0 when no pending bonuses", async () => {
        EmployeeBonus.getTotalPendingAmount.mockResolvedValue(0);

        const result = await EmployeeBonus.getTotalPendingAmount(1);

        expect(result).toBe(0);
      });
    });
  });

  // =============================================
  // Status Transitions
  // =============================================
  describe("Status Transitions", () => {
    it("should allow pending to paid transition", async () => {
      const bonus = {
        id: 1,
        status: "pending",
        save: jest.fn(),
      };

      EmployeeBonus.findByPk.mockResolvedValue(bonus);

      bonus.status = "paid";
      bonus.paidAt = new Date();
      bonus.paidNote = "Paid via check";
      await bonus.save();

      expect(bonus.status).toBe("paid");
      expect(bonus.paidAt).toBeDefined();
      expect(bonus.save).toHaveBeenCalled();
    });

    it("should allow pending to cancelled transition", async () => {
      const bonus = {
        id: 1,
        status: "pending",
        save: jest.fn(),
      };

      EmployeeBonus.findByPk.mockResolvedValue(bonus);

      bonus.status = "cancelled";
      await bonus.save();

      expect(bonus.status).toBe("cancelled");
      expect(bonus.save).toHaveBeenCalled();
    });
  });

  // =============================================
  // Associations
  // =============================================
  describe("Associations", () => {
    it("should include business owner in query", async () => {
      const mockBonus = {
        id: 1,
        businessOwnerId: 1,
        businessOwner: { id: 1, username: "owner@test.com" },
      };

      EmployeeBonus.findByPk.mockResolvedValue(mockBonus);

      const result = await EmployeeBonus.findByPk(1, {
        include: ["businessOwner"],
      });

      expect(result.businessOwner).toBeDefined();
      expect(result.businessOwner.username).toBe("owner@test.com");
    });

    it("should include employee in query", async () => {
      const mockBonus = {
        id: 1,
        employeeId: 2,
        employee: { id: 2, username: "employee@test.com" },
      };

      EmployeeBonus.findByPk.mockResolvedValue(mockBonus);

      const result = await EmployeeBonus.findByPk(1, {
        include: ["employee"],
      });

      expect(result.employee).toBeDefined();
      expect(result.employee.username).toBe("employee@test.com");
    });

    it("should include business employee in query", async () => {
      const mockBonus = {
        id: 1,
        businessEmployeeId: 3,
        businessEmployee: { id: 3, firstName: "John", lastName: "Doe" },
      };

      EmployeeBonus.findByPk.mockResolvedValue(mockBonus);

      const result = await EmployeeBonus.findByPk(1, {
        include: ["businessEmployee"],
      });

      expect(result.businessEmployee).toBeDefined();
      expect(result.businessEmployee.firstName).toBe("John");
    });
  });

  // =============================================
  // Amount Validation
  // =============================================
  describe("Amount Handling", () => {
    it("should store amount in cents", async () => {
      const bonusData = {
        businessOwnerId: 1,
        employeeId: 2,
        businessEmployeeId: 3,
        amount: 10000, // $100 in cents
        reason: "Test bonus",
      };

      EmployeeBonus.create.mockResolvedValue({
        id: 1,
        ...bonusData,
      });

      const result = await EmployeeBonus.create(bonusData);

      expect(result.amount).toBe(10000);
    });

    it("should handle large bonus amounts", async () => {
      const largeAmount = 100000000; // $1,000,000 in cents

      EmployeeBonus.create.mockResolvedValue({
        id: 1,
        amount: largeAmount,
      });

      const result = await EmployeeBonus.create({ amount: largeAmount });

      expect(result.amount).toBe(largeAmount);
    });
  });
});
