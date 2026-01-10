const { Op } = require("sequelize");

// Mock models
const mockBusinessEmployeeUpdate = jest.fn();
const mockBusinessEmployeeFindOne = jest.fn();
const mockBusinessEmployeeFindAll = jest.fn();

jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
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
    transaction: jest.fn((callback) => callback({ commit: jest.fn(), rollback: jest.fn() })),
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

      // Mock business owner
      User.findByPk.mockResolvedValue({
        id: 1,
        isBusinessOwner: true,
      });
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

      // Mock business owner
      User.findByPk.mockResolvedValue({
        id: 1,
        isBusinessOwner: true,
      });
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
        reload: jest.fn().mockResolvedValue(true),
        toJSON: function() { return { ...this, update: undefined, toJSON: undefined }; },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await BusinessEmployeeService.terminateEmployee(10, 1, "Performance issues");

      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "terminated",
          terminationReason: "Performance issues",
          terminatedAt: expect.any(Date),
        }),
        expect.objectContaining({ transaction: expect.anything() })
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
        reload: jest.fn().mockResolvedValue(true),
        toJSON: function() { return { ...this, update: undefined, toJSON: undefined }; },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await BusinessEmployeeService.reactivateEmployee(10, 1);

      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          terminatedAt: null,
          terminationReason: null,
        }),
        expect.objectContaining({ transaction: expect.anything() })
      );
    });
  });

  // =============================================
  // validateInviteToken
  // =============================================
  describe("validateInviteToken", () => {
    it("should return employee for valid token", async () => {
      const mockEmployee = {
        id: 1,
        inviteToken: "abc123def456abc123def456abc12345",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "pending_invite",
        businessOwner: {
          id: 100,
          firstName: "Jane",
          lastName: "Owner",
          businessName: "CleanCo",
        },
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const result = await BusinessEmployeeService.validateInviteToken(
        "abc123def456abc123def456abc12345"
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(BusinessEmployee.findOne).toHaveBeenCalledWith({
        where: { inviteToken: "abc123def456abc123def456abc12345" },
        include: expect.any(Array),
      });
    });

    it("should return null for invalid token format (too short)", async () => {
      const result = await BusinessEmployeeService.validateInviteToken("short");

      expect(result).toBeNull();
      expect(BusinessEmployee.findOne).not.toHaveBeenCalled();
    });

    it("should return null for null token", async () => {
      const result = await BusinessEmployeeService.validateInviteToken(null);

      expect(result).toBeNull();
    });

    it("should return null for non-existent token", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await BusinessEmployeeService.validateInviteToken(
        "abc123def456abc123def456abc12345"
      );

      expect(result).toBeNull();
    });

    it("should return isExpired flag for expired invitation", async () => {
      const mockEmployee = {
        id: 1,
        inviteExpiresAt: new Date(Date.now() - 1000), // Expired
        status: "pending_invite",
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const result = await BusinessEmployeeService.validateInviteToken(
        "abc123def456abc123def456abc12345"
      );

      expect(result.isExpired).toBe(true);
    });

    it("should return isAlreadyAccepted flag for active employee", async () => {
      const mockEmployee = {
        id: 1,
        status: "active",
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const result = await BusinessEmployeeService.validateInviteToken(
        "abc123def456abc123def456abc12345"
      );

      expect(result.isAlreadyAccepted).toBe(true);
    });

    it("should return isTerminated flag for terminated employee", async () => {
      const mockEmployee = {
        id: 1,
        status: "terminated",
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const result = await BusinessEmployeeService.validateInviteToken(
        "abc123def456abc123def456abc12345"
      );

      expect(result.isTerminated).toBe(true);
    });
  });

  // =============================================
  // acceptInvite (for existing users)
  // =============================================
  describe("acceptInvite", () => {
    it("should accept invitation and link user to employee", async () => {
      const mockEmployee = {
        id: 1,
        businessOwnerId: 100,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        update: jest.fn().mockResolvedValue(true),
        reload: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      const mockUser = {
        id: 200,
        employeeOfBusinessId: null,
        update: jest.fn().mockResolvedValue(true),
      };

      // First call is for validateInviteToken, second for finding the user
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      User.findByPk.mockResolvedValue(mockUser);

      const result = await BusinessEmployeeService.acceptInvite(
        "abc123def456abc123def456abc12345",
        200
      );

      expect(result).toBeDefined();
      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          status: "active",
          inviteToken: null,
        }),
        expect.any(Object)
      );
      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "employee",
          employeeOfBusinessId: 100,
          isMarketplaceCleaner: false,
        }),
        expect.any(Object)
      );
    });

    it("should throw error for invalid token", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        BusinessEmployeeService.acceptInvite("invalidtoken12345678901234567890", 200)
      ).rejects.toThrow("Invalid invitation token");
    });

    it("should throw error for expired invitation", async () => {
      const mockEmployee = {
        id: 1,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() - 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined, isExpired: true };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await expect(
        BusinessEmployeeService.acceptInvite("abc123def456abc123def456abc12345", 200)
      ).rejects.toThrow("Invitation has expired");
    });

    it("should throw error if user not found", async () => {
      const mockEmployee = {
        id: 1,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      User.findByPk.mockResolvedValue(null);

      await expect(
        BusinessEmployeeService.acceptInvite("abc123def456abc123def456abc12345", 999)
      ).rejects.toThrow("User not found");
    });

    it("should throw error if user already employee of another business", async () => {
      const mockEmployee = {
        id: 1,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      const mockUser = {
        id: 200,
        employeeOfBusinessId: 999, // Already employed
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      User.findByPk.mockResolvedValue(mockUser);

      await expect(
        BusinessEmployeeService.acceptInvite("abc123def456abc123def456abc12345", 200)
      ).rejects.toThrow("User is already an employee of another business");
    });
  });

  // =============================================
  // acceptInviteWithSignup (create new user)
  // =============================================
  describe("acceptInviteWithSignup", () => {
    const validUserData = {
      firstName: "John",
      lastName: "Employee",
      username: "johnemp",
      password: "AAbb@@33cc",
      phone: "5551234567",
      termsId: 1,
      privacyPolicyId: 1,
    };

    it("should create user and accept invitation", async () => {
      const mockEmployee = {
        id: 1,
        businessOwnerId: 100,
        email: "employee@example.com",
        phone: null,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        update: jest.fn().mockResolvedValue(true),
        reload: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      const mockNewUser = {
        id: 200,
        firstName: "John",
        lastName: "Employee",
        type: "employee",
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      User.findOne.mockResolvedValue(null); // No existing username or email
      User.create.mockResolvedValue(mockNewUser);

      const result = await BusinessEmployeeService.acceptInviteWithSignup(
        "abc123def456abc123def456abc12345",
        validUserData
      );

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.employee).toBeDefined();
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "John",
          lastName: "Employee",
          username: "johnemp",
          email: "employee@example.com",
          type: "employee",
          employeeOfBusinessId: 100,
        }),
        expect.any(Object)
      );
    });

    it("should throw error if required fields missing", async () => {
      const mockEmployee = {
        id: 1,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await expect(
        BusinessEmployeeService.acceptInviteWithSignup("abc123def456abc123def456abc12345", {
          firstName: "John",
        })
      ).rejects.toThrow("First name, last name, username, and password are required");
    });

    it("should throw error if username too short", async () => {
      const mockEmployee = {
        id: 1,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await expect(
        BusinessEmployeeService.acceptInviteWithSignup("abc123def456abc123def456abc12345", {
          ...validUserData,
          username: "abc",
        })
      ).rejects.toThrow("Username must be between 4 and 12 characters");
    });

    it("should throw error if username too long", async () => {
      const mockEmployee = {
        id: 1,
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await expect(
        BusinessEmployeeService.acceptInviteWithSignup("abc123def456abc123def456abc12345", {
          ...validUserData,
          username: "waytoolongusername",
        })
      ).rejects.toThrow("Username must be between 4 and 12 characters");
    });

    it("should throw error if username already exists", async () => {
      const mockEmployee = {
        id: 1,
        email: "employee@example.com",
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      User.findOne.mockResolvedValue({ id: 999 }); // Username exists

      await expect(
        BusinessEmployeeService.acceptInviteWithSignup("abc123def456abc123def456abc12345", validUserData)
      ).rejects.toThrow("Username already exists");
    });

    it("should throw error if email already has account", async () => {
      const mockEmployee = {
        id: 1,
        email: "employee@example.com",
        status: "pending_invite",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      User.findOne
        .mockResolvedValueOnce(null) // Username check passes
        .mockResolvedValueOnce({ id: 999 }); // Email exists

      await expect(
        BusinessEmployeeService.acceptInviteWithSignup("abc123def456abc123def456abc12345", validUserData)
      ).rejects.toThrow("An account with this email already exists");
    });
  });

  // =============================================
  // declineInvite
  // =============================================
  describe("declineInvite", () => {
    it("should decline invitation successfully", async () => {
      const mockEmployee = {
        id: 1,
        status: "pending_invite",
        update: jest.fn().mockResolvedValue(true),
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await BusinessEmployeeService.declineInvite("abc123def456abc123def456abc12345");

      expect(mockEmployee.update).toHaveBeenCalledWith({
        inviteToken: null,
        inviteExpiresAt: null,
        status: "declined",
      });
    });

    it("should throw error for invalid token", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        BusinessEmployeeService.declineInvite("invalidtoken12345678901234567890")
      ).rejects.toThrow("Invalid invitation token");
    });

    it("should throw error if invitation already accepted", async () => {
      const mockEmployee = {
        id: 1,
        status: "active",
        isAlreadyAccepted: true,
        toJSON: function () {
          return { ...this, toJSON: undefined, isAlreadyAccepted: true };
        },
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      await expect(
        BusinessEmployeeService.declineInvite("abc123def456abc123def456abc12345")
      ).rejects.toThrow("Invitation has already been accepted");
    });
  });

  // =============================================
  // resendInvite
  // =============================================
  describe("resendInvite", () => {
    it("should generate new token and update expiration", async () => {
      const mockEmployee = {
        id: 1,
        businessOwnerId: 100,
        status: "pending_invite",
        update: jest.fn().mockResolvedValue(true),
      };

      // First call for finding the employee, subsequent calls for token uniqueness check
      BusinessEmployee.findOne
        .mockResolvedValueOnce(mockEmployee) // Find employee
        .mockResolvedValue(null); // Token uniqueness checks

      const result = await BusinessEmployeeService.resendInvite(1, 100);

      expect(result).toBeDefined();
      expect(mockEmployee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteToken: expect.any(String),
          inviteExpiresAt: expect.any(Date),
          invitedAt: expect.any(Date),
        })
      );
    });

    it("should throw error if employee not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(BusinessEmployeeService.resendInvite(999, 100)).rejects.toThrow(
        "Employee not found or invite already accepted"
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
