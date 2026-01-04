const { Op } = require("sequelize");

// Mock models
const mockBusinessEmployeeUpdate = jest.fn();
const mockBusinessEmployeeFindOne = jest.fn();
const mockBusinessEmployeeFindAll = jest.fn();

jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  EmployeeJobAssignment: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  sequelize: {
    fn: jest.fn(),
    col: jest.fn(),
    Sequelize: {
      Op: {
        between: Symbol("between"),
        ne: Symbol("ne"),
        and: Symbol("and"),
        in: Symbol("in"),
      },
    },
    models: {
      UserAppointments: {},
    },
  },
}));

const { User, BusinessEmployee, EmployeeJobAssignment, sequelize } = require("../../models");
const BusinessEmployeeService = require("../../services/BusinessEmployeeService");

describe("BusinessEmployeeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("inviteEmployee", () => {
    it("should create a new employee invitation", async () => {
      const businessOwnerId = 1;
      const employeeData = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "555-1234",
        defaultHourlyRate: 2000, // $20.00 in cents
        paymentMethod: "direct_payment",
      };

      BusinessEmployee.findOne.mockResolvedValue(null); // No existing employee
      BusinessEmployee.create.mockResolvedValue({
        id: 10,
        ...employeeData,
        businessOwnerId,
        status: "pending_invite",
        inviteToken: "mock-token",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await BusinessEmployeeService.inviteEmployee(businessOwnerId, employeeData);

      expect(result).toBeDefined();
      expect(result.status).toBe("pending_invite");
      expect(BusinessEmployee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessOwnerId,
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
        })
      );
    });

    it("should throw error if email already exists for this business", async () => {
      const businessOwnerId = 1;

      BusinessEmployee.findOne.mockResolvedValue({
        id: 10,
        email: "existing@example.com",
      });

      await expect(
        BusinessEmployeeService.inviteEmployee(businessOwnerId, {
          firstName: "Jane",
          lastName: "Doe",
          email: "existing@example.com",
        })
      ).rejects.toThrow();
    });
  });

  describe("updateEmployee", () => {
    it("should update allowed employee fields", async () => {
      const mockEmployee = {
        id: 10,
        businessOwnerId: 1,
        firstName: "Jane",
        lastName: "Doe",
        update: jest.fn().mockResolvedValue(true),
        toJSON: function() { return { ...this, update: undefined, toJSON: undefined }; },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const updates = {
        firstName: "Janet",
        defaultHourlyRate: 2500,
        availableSchedule: { monday: { available: true } },
        defaultJobTypes: ["standard", "deep"],
        maxJobsPerDay: 4,
      };

      await BusinessEmployeeService.updateEmployee(10, 1, updates);

      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Janet",
          defaultHourlyRate: 2500,
          availableSchedule: { monday: { available: true } },
          defaultJobTypes: ["standard", "deep"],
          maxJobsPerDay: 4,
        })
      );
    });

    it("should not update disallowed fields", async () => {
      const mockEmployee = {
        id: 10,
        businessOwnerId: 1,
        update: jest.fn().mockResolvedValue(true),
        toJSON: function() { return { ...this, update: undefined, toJSON: undefined }; },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const updates = {
        firstName: "Janet",
        email: "hacker@evil.com", // Not allowed
        status: "terminated", // Not allowed through this method
      };

      await BusinessEmployeeService.updateEmployee(10, 1, updates);

      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Janet",
        })
      );
      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.not.objectContaining({
          email: "hacker@evil.com",
          status: "terminated",
        })
      );
    });

    it("should throw error if employee not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        BusinessEmployeeService.updateEmployee(999, 1, { firstName: "Test" })
      ).rejects.toThrow("Employee not found");
    });
  });

  describe("updateAvailability", () => {
    it("should update availability schedule with valid data", async () => {
      const mockEmployee = {
        id: 10,
        businessOwnerId: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const schedule = {
        monday: { available: true, start: "09:00", end: "17:00" },
        tuesday: { available: true, start: "09:00", end: "17:00" },
        wednesday: { available: false },
      };

      await BusinessEmployeeService.updateAvailability(10, 1, schedule);

      expect(mockEmployee.update).toHaveBeenCalledWith({
        availableSchedule: expect.objectContaining({
          monday: { available: true, start: "09:00", end: "17:00" },
          tuesday: { available: true, start: "09:00", end: "17:00" },
          wednesday: { available: false, start: null, end: null },
        }),
      });
    });

    it("should validate time format", async () => {
      const mockEmployee = {
        id: 10,
        businessOwnerId: 1,
        update: jest.fn(),
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const invalidSchedule = {
        monday: { available: true, start: "invalid-time", end: "17:00" },
      };

      await expect(
        BusinessEmployeeService.updateAvailability(10, 1, invalidSchedule)
      ).rejects.toThrow("Invalid start time format");
    });

    it("should validate day names", async () => {
      const mockEmployee = {
        id: 10,
        businessOwnerId: 1,
        update: jest.fn(),
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const invalidSchedule = {
        funday: { available: true }, // Invalid day name
      };

      await expect(
        BusinessEmployeeService.updateAvailability(10, 1, invalidSchedule)
      ).rejects.toThrow("Invalid day");
    });

    it("should handle case-insensitive day names", async () => {
      const mockEmployee = {
        id: 10,
        businessOwnerId: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const schedule = {
        MONDAY: { available: true, start: "09:00", end: "17:00" },
        Tuesday: { available: false },
      };

      await BusinessEmployeeService.updateAvailability(10, 1, schedule);

      expect(mockEmployee.update).toHaveBeenCalledWith({
        availableSchedule: expect.objectContaining({
          monday: expect.any(Object),
          tuesday: expect.any(Object),
        }),
      });
    });
  });

  describe("getAvailableEmployees", () => {
    const mockEmployee1 = {
      id: 10,
      firstName: "Jane",
      lastName: "Worker",
      availableSchedule: {
        monday: { available: true, start: "09:00", end: "17:00" },
        tuesday: { available: false },
      },
      defaultJobTypes: ["standard", "deep"],
      maxJobsPerDay: 3,
      isAvailableOn: jest.fn(),
      canHandleJobType: jest.fn(),
      toJSON: function() { return { ...this, toJSON: undefined, isAvailableOn: undefined, canHandleJobType: undefined }; },
    };

    const mockEmployee2 = {
      id: 11,
      firstName: "Bob",
      lastName: "Helper",
      availableSchedule: null, // No restrictions
      defaultJobTypes: null,
      maxJobsPerDay: null,
      isAvailableOn: jest.fn(),
      canHandleJobType: jest.fn(),
      toJSON: function() { return { ...this, toJSON: undefined, isAvailableOn: undefined, canHandleJobType: undefined }; },
    };

    it("should return employees with availability info", async () => {
      BusinessEmployee.findAll.mockResolvedValue([mockEmployee1, mockEmployee2]);
      EmployeeJobAssignment.findAll.mockResolvedValue([]); // No existing jobs

      mockEmployee1.isAvailableOn.mockReturnValue(true);
      mockEmployee1.canHandleJobType.mockReturnValue(true);
      mockEmployee2.isAvailableOn.mockReturnValue(true);
      mockEmployee2.canHandleJobType.mockReturnValue(true);

      const result = await BusinessEmployeeService.getAvailableEmployees(
        1, // businessOwnerId
        "2024-01-15", // Monday
        "10:00",
        "standard"
      );

      expect(result).toHaveLength(2);
      expect(result[0].availability).toBeDefined();
      expect(result[0].availability.isAvailable).toBeDefined();
    });

    it("should mark employees at max capacity", async () => {
      const employeeAtCapacity = {
        ...mockEmployee1,
        maxJobsPerDay: 2,
        isAvailableOn: jest.fn().mockReturnValue(true),
        canHandleJobType: jest.fn().mockReturnValue(true),
      };

      BusinessEmployee.findAll.mockResolvedValue([employeeAtCapacity]);
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { businessEmployeeId: 10, get: () => 2 }, // 2 jobs already
      ]);

      const result = await BusinessEmployeeService.getAvailableEmployees(
        1,
        "2024-01-15",
        null,
        null
      );

      expect(result[0].availability.maxReached).toBe(true);
      expect(result[0].availability.currentJobCount).toBe(2);
    });

    it("should sort available employees first", async () => {
      const unavailableEmployee = {
        ...mockEmployee1,
        firstName: "Unavailable",
        isAvailableOn: jest.fn().mockReturnValue(false),
        canHandleJobType: jest.fn().mockReturnValue(true),
      };

      const availableEmployee = {
        ...mockEmployee2,
        firstName: "Available",
        isAvailableOn: jest.fn().mockReturnValue(true),
        canHandleJobType: jest.fn().mockReturnValue(true),
      };

      BusinessEmployee.findAll.mockResolvedValue([unavailableEmployee, availableEmployee]);
      EmployeeJobAssignment.findAll.mockResolvedValue([]);

      const result = await BusinessEmployeeService.getAvailableEmployees(
        1,
        "2024-01-15",
        null,
        null
      );

      // Available employees should come first
      expect(result[0].availability.isAvailable).toBe(true);
    });
  });

  describe("terminateEmployee", () => {
    it("should terminate employee with reason", async () => {
      const mockEmployee = {
        id: 10,
        status: "active",
        update: jest.fn().mockResolvedValue(true),
        toJSON: function() { return { ...this, update: undefined, toJSON: undefined }; },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await BusinessEmployeeService.terminateEmployee(10, 1, "Performance issues");

      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "terminated",
          terminationReason: "Performance issues",
          terminatedAt: expect.any(Date),
        })
      );
    });

    it("should throw if employee not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        BusinessEmployeeService.terminateEmployee(999, 1, "Reason")
      ).rejects.toThrow();
    });
  });

  describe("reactivateEmployee", () => {
    it("should reactivate terminated employee", async () => {
      const mockEmployee = {
        id: 10,
        status: "terminated",
        update: jest.fn().mockResolvedValue(true),
        toJSON: function() { return { ...this, update: undefined, toJSON: undefined }; },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await BusinessEmployeeService.reactivateEmployee(10, 1);

      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          terminatedAt: null,
          terminationReason: null,
        })
      );
    });
  });
});

describe("BusinessEmployee Model Instance Methods", () => {
  describe("isAvailableOn", () => {
    // These are tested in employeeAvailability.test.js
    // This section is for documentation
    it("should be tested in employeeAvailability.test.js", () => {
      expect(true).toBe(true);
    });
  });

  describe("canHandleJobType", () => {
    // These are tested in employeeAvailability.test.js
    it("should be tested in employeeAvailability.test.js", () => {
      expect(true).toBe(true);
    });
  });
});
