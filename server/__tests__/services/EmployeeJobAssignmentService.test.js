/**
 * EmployeeJobAssignmentService Tests
 * Focus on marketplace job functionality and visibility restrictions
 */

// Mock sequelize Op
jest.mock("sequelize", () => ({
  Op: {
    notIn: Symbol("notIn"),
    in: Symbol("in"),
    gte: Symbol("gte"),
    lte: Symbol("lte"),
    ne: Symbol("ne"),
    gt: Symbol("gt"),
    or: Symbol("or"),
  },
}));

// Mock MarketplaceJobRequirementsService
jest.mock("../../services/MarketplaceJobRequirementsService", () => ({
  isMarketplaceJob: jest.fn(),
  initializeChecklistProgress: jest.fn(),
  validateCompletionRequirements: jest.fn(),
}));

// Mock AppointmentJobFlowService
jest.mock("../../services/AppointmentJobFlowService", () => ({
  createJobFlowForAppointment: jest.fn(),
  getOrCreateJobFlow: jest.fn(),
}));

// Mock CustomJobFlowService
jest.mock("../../services/CustomJobFlowService", () => ({
  resolveFlowForAppointment: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => {
  const mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

  return {
    BusinessEmployee: {
      findOne: jest.fn(),
    },
    EmployeeJobAssignment: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
    },
    EmployeePayChangeLog: {
      create: jest.fn(),
      findAll: jest.fn(),
    },
    UserAppointments: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    },
    UserHomes: {},
    User: {
      findByPk: jest.fn(),
    },
    CleanerClient: {
      findOne: jest.fn(),
    },
    AppointmentJobFlow: {
      findOne: jest.fn(),
      create: jest.fn(),
    },
    ChecklistVersion: {
      findOne: jest.fn(),
    },
    CustomJobFlow: {
      findOne: jest.fn(),
    },
    CustomJobFlowChecklist: {
      findAll: jest.fn(),
    },
    sequelize: {
      transaction: jest.fn((callback) => callback(mockTransaction)),
    },
  };
});

const {
  BusinessEmployee,
  EmployeeJobAssignment,
  UserAppointments,
  User,
  CleanerClient,
  AppointmentJobFlow,
  sequelize,
} = require("../../models");

const MarketplaceJobRequirementsService = require("../../services/MarketplaceJobRequirementsService");
const AppointmentJobFlowService = require("../../services/AppointmentJobFlowService");
const CustomJobFlowService = require("../../services/CustomJobFlowService");
const EmployeeJobAssignmentService = require("../../services/EmployeeJobAssignmentService");

describe("EmployeeJobAssignmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("assignEmployeeToJob", () => {
    const mockEmployee = {
      id: 1,
      businessOwnerId: 10,
      firstName: "John",
      lastName: "Doe",
      status: "active",
    };

    const mockAppointment = {
      id: 100,
      userId: 50,
      bookedByCleanerId: null,
      update: jest.fn(),
    };

    it("should assign employee to a marketplace job with checklist initialization", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      EmployeeJobAssignment.findOne.mockResolvedValue(null); // No existing assignment
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(true);
      MarketplaceJobRequirementsService.initializeChecklistProgress.mockResolvedValue({
        kitchen: { total: ["k1"], completed: [] },
      });
      CustomJobFlowService.resolveFlowForAppointment.mockResolvedValue({
        usesPlatformFlow: true,
        customFlowId: null,
      });
      AppointmentJobFlowService.createJobFlowForAppointment.mockResolvedValue({
        id: 1,
        checklistProgress: { kitchen: { total: ["k1"], completed: [] } },
      });

      const mockCreatedAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        isMarketplacePickup: true,
        checklistProgress: { kitchen: { total: ["k1"], completed: [] } },
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      const result = await EmployeeJobAssignmentService.assignEmployeeToJob(10, {
        employeeId: 1,
        appointmentId: 100,
        payAmount: 5000,
        payType: "flat_rate",
      });

      expect(result.isMarketplacePickup).toBe(true);
      // Job flow creation is now handled by AppointmentJobFlowService
      expect(AppointmentJobFlowService.createJobFlowForAppointment).toHaveBeenCalled();
      expect(EmployeeJobAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isMarketplacePickup: true,
        }),
        expect.any(Object)
      );
    });

    it("should assign employee to a non-marketplace job without checklist", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      EmployeeJobAssignment.findOne.mockResolvedValue(null);
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(false);
      CustomJobFlowService.resolveFlowForAppointment.mockResolvedValue({
        usesPlatformFlow: false,
        customFlowId: null,
      });
      AppointmentJobFlowService.createJobFlowForAppointment.mockResolvedValue({
        id: 2,
        checklistProgress: null,
      });

      const mockCreatedAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        isMarketplacePickup: false,
        checklistProgress: null,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      const result = await EmployeeJobAssignmentService.assignEmployeeToJob(10, {
        employeeId: 1,
        appointmentId: 100,
        payAmount: 5000,
      });

      expect(result.isMarketplacePickup).toBe(false);
      expect(MarketplaceJobRequirementsService.initializeChecklistProgress).not.toHaveBeenCalled();
    });

    it("should throw error when employee not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        EmployeeJobAssignmentService.assignEmployeeToJob(10, {
          employeeId: 999,
          appointmentId: 100,
          payAmount: 5000,
        })
      ).rejects.toThrow("Employee not found or not active");
    });

    it("should throw error when appointment not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      UserAppointments.findOne.mockResolvedValue(null);

      await expect(
        EmployeeJobAssignmentService.assignEmployeeToJob(10, {
          employeeId: 1,
          appointmentId: 999,
          payAmount: 5000,
        })
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw error when appointment already assigned", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      EmployeeJobAssignment.findOne.mockResolvedValue({ id: 1 }); // Existing assignment

      await expect(
        EmployeeJobAssignmentService.assignEmployeeToJob(10, {
          employeeId: 1,
          appointmentId: 100,
          payAmount: 5000,
        })
      ).rejects.toThrow("already assigned");
    });
  });

  describe("assignSelfToJob", () => {
    it("should create self-assignment for marketplace job with $0 pay", async () => {
      User.findByPk.mockResolvedValue({ id: 10, isBusinessOwner: true });
      UserAppointments.findByPk.mockResolvedValue({ id: 100, userId: 50, update: jest.fn() });
      EmployeeJobAssignment.findOne.mockResolvedValue(null);
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(true);
      MarketplaceJobRequirementsService.initializeChecklistProgress.mockResolvedValue({
        kitchen: { total: ["k1"], completed: [] },
      });
      CustomJobFlowService.resolveFlowForAppointment.mockResolvedValue({
        usesPlatformFlow: true,
        customFlowId: null,
      });
      AppointmentJobFlowService.createJobFlowForAppointment.mockResolvedValue({
        id: 1,
        checklistProgress: { kitchen: { total: ["k1"], completed: [] } },
      });
      AppointmentJobFlow.findOne.mockResolvedValue(null);

      const mockCreatedAssignment = {
        id: 1,
        businessEmployeeId: null,
        businessOwnerId: 10,
        isSelfAssignment: true,
        isMarketplacePickup: true,
        payAmount: 0,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      const result = await EmployeeJobAssignmentService.assignSelfToJob(10, 100);

      expect(result.isSelfAssignment).toBe(true);
      expect(result.payAmount).toBe(0);
      expect(result.isMarketplacePickup).toBe(true);
      expect(EmployeeJobAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessEmployeeId: null,
          isSelfAssignment: true,
          payAmount: 0,
        }),
        expect.any(Object)
      );
    });

    it("should throw error for invalid business owner", async () => {
      User.findByPk.mockResolvedValue({ id: 10, isBusinessOwner: false });

      await expect(
        EmployeeJobAssignmentService.assignSelfToJob(10, 100)
      ).rejects.toThrow("Invalid business owner");
    });
  });

  describe("completeJob", () => {
    it("should validate marketplace requirements before completing", async () => {
      const mockEmployee = { id: 1, defaultHourlyRate: 1500 };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: true,
        status: "started",
        payType: "flat_rate",
        appointmentId: 100,
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      MarketplaceJobRequirementsService.validateCompletionRequirements.mockResolvedValue(true);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      expect(MarketplaceJobRequirementsService.validateCompletionRequirements).toHaveBeenCalledWith(1);
      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        })
      );
    });

    it("should throw error when marketplace requirements not met", async () => {
      const mockEmployee = { id: 1 };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: true,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      MarketplaceJobRequirementsService.validateCompletionRequirements.mockRejectedValue(
        new Error("Cannot complete job. You must: complete the cleaning checklist")
      );

      await expect(
        EmployeeJobAssignmentService.completeJob(1, 5)
      ).rejects.toThrow("complete the cleaning checklist");
    });

    it("should skip marketplace validation for non-marketplace jobs", async () => {
      const mockEmployee = { id: 1 };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: false,
        status: "started",
        payType: "flat_rate",
        appointmentId: 100,
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      expect(MarketplaceJobRequirementsService.validateCompletionRequirements).not.toHaveBeenCalled();
    });

    it("should throw error when assignment not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue({ id: 1 });
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      await expect(
        EmployeeJobAssignmentService.completeJob(999, 5)
      ).rejects.toThrow("Assignment not found or cannot be completed");
    });
  });

  describe("getMyJobs", () => {
    const mockEmployee = {
      id: 1,
      userId: 5,
      status: "active",
      canViewClientDetails: true,
    };

    it("should return only non-cancelled assignments", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const mockAssignments = [
        {
          id: 1,
          status: "assigned",
          isMarketplacePickup: false,
          appointment: {
            date: new Date().toISOString().split("T")[0],
            home: { id: 1, address: "123 Main St, City, State 12345" },
            user: { id: 1, firstName: "Jane" },
          },
          get: jest.fn().mockReturnValue({
            id: 1,
            status: "assigned",
            isMarketplacePickup: false,
            appointment: {
              date: new Date().toISOString().split("T")[0],
              home: { id: 1, address: "123 Main St, City, State 12345", numBeds: 3, numBaths: 2 },
              user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
            },
          }),
        },
      ];
      EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);

      const result = await EmployeeJobAssignmentService.getMyJobs(5);

      expect(result).toHaveLength(1);
      expect(EmployeeJobAssignment.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessEmployeeId: 1,
          }),
        })
      );
    });

    it("should restrict address for marketplace jobs more than 24 hours away", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      // Create a date 48 hours from now
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const mockAssignments = [
        {
          id: 1,
          status: "assigned",
          isMarketplacePickup: true,
          appointment: {
            date: futureDateStr,
            home: { id: 1, address: "123 Main St, Springfield, IL 62701" },
            user: { id: 1, firstName: "Jane" },
          },
          get: jest.fn().mockReturnValue({
            id: 1,
            status: "assigned",
            isMarketplacePickup: true,
            appointment: {
              date: futureDateStr,
              home: { id: 1, address: "123 Main St, Springfield, IL 62701", numBeds: 3, numBaths: 2 },
              user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
            },
          }),
        },
      ];
      EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);

      const result = await EmployeeJobAssignmentService.getMyJobs(5);

      expect(result).toHaveLength(1);
      // Address should be restricted for marketplace jobs more than 24 hours away
      expect(result[0].appointment.home.addressRestricted).toBe(true);
      expect(result[0].appointment.home.generalArea).toContain("area");
      expect(result[0].appointment.home.address).toBeUndefined();
    });

    it("should show full address for marketplace jobs within 24 hours", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      // Create a date 12 hours from now
      const soonDate = new Date();
      soonDate.setHours(soonDate.getHours() + 12);
      const soonDateStr = soonDate.toISOString().split("T")[0];

      const mockAssignments = [
        {
          id: 1,
          status: "assigned",
          isMarketplacePickup: true,
          appointment: {
            date: soonDateStr,
            home: { id: 1, address: "123 Main St, Springfield, IL 62701", numBeds: 3, numBaths: 2, keyPadCode: "1234", keyLocation: "Under mat" },
            user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
          },
          get: jest.fn().mockReturnValue({
            id: 1,
            status: "assigned",
            isMarketplacePickup: true,
            appointment: {
              date: soonDateStr,
              home: { id: 1, address: "123 Main St, Springfield, IL 62701", numBeds: 3, numBaths: 2, keyPadCode: "1234", keyLocation: "Under mat" },
              user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
            },
          }),
        },
      ];
      EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);

      const result = await EmployeeJobAssignmentService.getMyJobs(5);

      expect(result).toHaveLength(1);
      // Full address should be visible within 24 hours
      expect(result[0].appointment.home.address).toBe("123 Main St, Springfield, IL 62701");
      expect(result[0].appointment.home.addressRestricted).toBeUndefined();
    });

    it("should show full address for started marketplace jobs", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      // Create a date 48 hours from now but job is started
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const mockAssignments = [
        {
          id: 1,
          status: "started", // Job has started
          isMarketplacePickup: true,
          appointment: {
            date: futureDateStr,
            home: { id: 1, address: "123 Main St, Springfield, IL 62701", numBeds: 3, numBaths: 2 },
            user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
          },
          get: jest.fn().mockReturnValue({
            id: 1,
            status: "started",
            isMarketplacePickup: true,
            appointment: {
              date: futureDateStr,
              home: { id: 1, address: "123 Main St, Springfield, IL 62701", numBeds: 3, numBaths: 2 },
              user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
            },
          }),
        },
      ];
      EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);

      const result = await EmployeeJobAssignmentService.getMyJobs(5);

      expect(result).toHaveLength(1);
      // Full address should be visible when job is started
      expect(result[0].appointment.home.address).toBe("123 Main St, Springfield, IL 62701");
    });

    it("should restrict client details when employee lacks permission", async () => {
      const employeeNoPermission = { ...mockEmployee, canViewClientDetails: false };
      BusinessEmployee.findOne.mockResolvedValue(employeeNoPermission);

      const mockAssignments = [
        {
          id: 1,
          status: "assigned",
          isMarketplacePickup: false,
          appointment: {
            date: new Date().toISOString().split("T")[0],
            home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
            user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
          },
          get: jest.fn().mockReturnValue({
            id: 1,
            status: "assigned",
            isMarketplacePickup: false,
            appointment: {
              date: new Date().toISOString().split("T")[0],
              home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2, keyPadCode: "1234" },
              user: { id: 1, firstName: "Jane", lastName: "Doe", phone: "555-1234" },
            },
          }),
        },
      ];
      EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);

      const result = await EmployeeJobAssignmentService.getMyJobs(5);

      // Should only have basic home info
      expect(result[0].appointment.home.address).toBeUndefined();
      expect(result[0].appointment.home.numBeds).toBe(3);
      expect(result[0].appointment.home.numBaths).toBe(2);
      // Should only have first name
      expect(result[0].appointment.user.firstName).toBe("Jane");
      expect(result[0].appointment.user.lastName).toBeUndefined();
    });

    it("should throw error when employee not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        EmployeeJobAssignmentService.getMyJobs(999)
      ).rejects.toThrow("Employee record not found");
    });
  });

  describe("extractGeneralArea", () => {
    it("should extract city from standard address format", () => {
      const result = EmployeeJobAssignmentService.extractGeneralArea(
        "123 Main St, Springfield, IL 62701"
      );
      expect(result).toBe("Springfield area");
    });

    it("should extract city from multi-part address", () => {
      const result = EmployeeJobAssignmentService.extractGeneralArea(
        "Apt 4B, 456 Oak Ave, Chicago, IL 60601"
      );
      expect(result).toBe("Chicago area");
    });

    it("should return 'Location pending' for null address", () => {
      const result = EmployeeJobAssignmentService.extractGeneralArea(null);
      expect(result).toBe("Location pending");
    });

    it("should return 'Location confirmed' for address without comma", () => {
      const result = EmployeeJobAssignmentService.extractGeneralArea("123 Main St");
      expect(result).toBe("Location confirmed");
    });
  });
});
