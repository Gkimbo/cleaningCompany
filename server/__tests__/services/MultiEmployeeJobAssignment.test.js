/**
 * Multi-Employee Job Assignment Tests
 * Tests for assigning multiple employees to a single job
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

// Mock services
jest.mock("../../services/MarketplaceJobRequirementsService", () => ({
  isMarketplaceJob: jest.fn(),
  initializeChecklistProgress: jest.fn(),
  validateCompletionRequirements: jest.fn(),
}));

jest.mock("../../services/AppointmentJobFlowService", () => ({
  createJobFlowForAppointment: jest.fn(),
  getOrCreateJobFlow: jest.fn(),
}));

jest.mock("../../services/NotificationService", () => ({
  notifyEmployeeJobAssigned: jest.fn(),
  notifyEmployeeJobReassigned: jest.fn(),
}));

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
      findByPk: jest.fn(),
    },
    EmployeeJobAssignment: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
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
    MultiCleanerJob: {
      findByPk: jest.fn(),
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
  MultiCleanerJob,
} = require("../../models");

const MarketplaceJobRequirementsService = require("../../services/MarketplaceJobRequirementsService");
const AppointmentJobFlowService = require("../../services/AppointmentJobFlowService");
const CustomJobFlowService = require("../../services/CustomJobFlowService");
const EmployeeJobAssignmentService = require("../../services/EmployeeJobAssignmentService");

describe("Multi-Employee Job Assignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("assignEmployeeToJob - Multiple Employees", () => {
    const mockEmployee1 = {
      id: 1,
      businessOwnerId: 10,
      firstName: "John",
      lastName: "Doe",
      status: "active",
    };

    const mockEmployee2 = {
      id: 2,
      businessOwnerId: 10,
      firstName: "Jane",
      lastName: "Smith",
      status: "active",
    };

    const mockAppointment = {
      id: 100,
      userId: 50,
      bookedByCleanerId: null,
      isMultiCleanerJob: false,
      multiCleanerJobId: null,
      update: jest.fn(),
    };

    it("should allow assigning multiple different employees to the same job", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee2);
      UserAppointments.findOne.mockResolvedValue(mockAppointment);

      // First employee already assigned, but this is a different employee
      EmployeeJobAssignment.findOne.mockResolvedValue(null); // No duplicate for this specific employee

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
        id: 2,
        businessEmployeeId: 2,
        appointmentId: 100,
        status: "assigned",
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      const result = await EmployeeJobAssignmentService.assignEmployeeToJob(10, {
        employeeId: 2,
        appointmentId: 100,
        payAmount: 4000,
        payType: "flat_rate",
      });

      expect(result.businessEmployeeId).toBe(2);
      expect(EmployeeJobAssignment.create).toHaveBeenCalled();
    });

    it("should throw error when same employee is assigned twice to same job", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee1);
      UserAppointments.findOne.mockResolvedValue(mockAppointment);

      // Same employee already assigned
      EmployeeJobAssignment.findOne.mockResolvedValue({
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
      });

      await expect(
        EmployeeJobAssignmentService.assignEmployeeToJob(10, {
          employeeId: 1,
          appointmentId: 100,
          payAmount: 5000,
        })
      ).rejects.toThrow("This employee is already assigned to this job");
    });

    it("should enforce cleaner count limit for marketplace multi-cleaner jobs", async () => {
      const marketplaceAppointment = {
        ...mockAppointment,
        isMultiCleanerJob: true,
        multiCleanerJobId: 5,
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee1);
      UserAppointments.findOne.mockResolvedValue(marketplaceAppointment);
      EmployeeJobAssignment.findOne.mockResolvedValue(null); // No duplicate

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 5,
        totalCleanersRequired: 2,
      });

      // Already have 2 cleaners assigned (max reached)
      EmployeeJobAssignment.count.mockResolvedValue(2);

      await expect(
        EmployeeJobAssignmentService.assignEmployeeToJob(10, {
          employeeId: 1,
          appointmentId: 100,
          payAmount: 5000,
        })
      ).rejects.toThrow("This job requires exactly 2 cleaners");
    });

    it("should allow assigning when under cleaner limit for marketplace jobs", async () => {
      const marketplaceAppointment = {
        ...mockAppointment,
        isMultiCleanerJob: true,
        multiCleanerJobId: 5,
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee1);
      UserAppointments.findOne.mockResolvedValue(marketplaceAppointment);
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 5,
        totalCleanersRequired: 3,
      });

      // Only 1 cleaner assigned so far
      EmployeeJobAssignment.count.mockResolvedValue(1);

      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(true);
      MarketplaceJobRequirementsService.initializeChecklistProgress.mockResolvedValue({});
      CustomJobFlowService.resolveFlowForAppointment.mockResolvedValue({
        usesPlatformFlow: true,
        customFlowId: null,
      });
      AppointmentJobFlowService.createJobFlowForAppointment.mockResolvedValue({
        id: 1,
        checklistProgress: {},
      });

      const mockCreatedAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      const result = await EmployeeJobAssignmentService.assignEmployeeToJob(10, {
        employeeId: 1,
        appointmentId: 100,
        payAmount: 5000,
      });

      expect(EmployeeJobAssignment.create).toHaveBeenCalled();
    });
  });

  describe("checkAllEmployeesCompleted", () => {
    it("should return allCompleted: true when all employees have completed", async () => {
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, status: "completed" },
        { id: 2, status: "completed" },
        { id: 3, status: "completed" },
      ]);

      const result = await EmployeeJobAssignmentService.checkAllEmployeesCompleted(100);

      expect(result.allCompleted).toBe(true);
      expect(result.totalAssigned).toBe(3);
      expect(result.completedCount).toBe(3);
    });

    it("should return allCompleted: false when some employees have not completed", async () => {
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, status: "completed" },
        { id: 2, status: "in_progress" },
        { id: 3, status: "assigned" },
      ]);

      const result = await EmployeeJobAssignmentService.checkAllEmployeesCompleted(100);

      expect(result.allCompleted).toBe(false);
      expect(result.totalAssigned).toBe(3);
      expect(result.completedCount).toBe(1);
    });

    it("should return allCompleted: false when no employees are assigned", async () => {
      EmployeeJobAssignment.findAll.mockResolvedValue([]);

      const result = await EmployeeJobAssignmentService.checkAllEmployeesCompleted(100);

      expect(result.allCompleted).toBe(false);
      expect(result.totalAssigned).toBe(0);
      expect(result.completedCount).toBe(0);
    });

    it("should exclude cancelled and no_show assignments from count", async () => {
      // The mock should only return non-cancelled assignments based on the where clause
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, status: "completed" },
        { id: 2, status: "completed" },
      ]);

      const result = await EmployeeJobAssignmentService.checkAllEmployeesCompleted(100);

      expect(result.allCompleted).toBe(true);
      expect(result.totalAssigned).toBe(2);
    });
  });

  describe("completeJob - Multi-Employee Completion", () => {
    const mockEmployee = {
      id: 1,
      businessOwnerId: 10,
      userId: 20,
      status: "active",
    };

    const mockAssignment = {
      id: 1,
      appointmentId: 100,
      businessEmployeeId: 1,
      businessOwnerId: 10,
      status: "in_progress",
      payType: "flat_rate",
      payAmount: 5000,
      update: jest.fn().mockResolvedValue(true),
    };

    it("should mark job fully completed only when all employees are done", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      // All employees completed after this one
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, status: "completed" },
        { id: 2, status: "completed" },
      ]);

      UserAppointments.update.mockResolvedValue([1]);

      const result = await EmployeeJobAssignmentService.completeJob(1, 20);

      expect(result.jobFullyCompleted).toBe(true);
      expect(UserAppointments.update).toHaveBeenCalledWith(
        { completed: true },
        { where: { id: 100 } }
      );
    });

    it("should NOT mark job complete when other employees still working", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      // Other employees still working
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, status: "completed" },
        { id: 2, status: "in_progress" },
      ]);

      const result = await EmployeeJobAssignmentService.completeJob(1, 20);

      expect(result.jobFullyCompleted).toBe(false);
      expect(UserAppointments.update).not.toHaveBeenCalled();
    });

    it("should return completion status with counts", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, status: "completed" },
        { id: 2, status: "completed" },
        { id: 3, status: "in_progress" },
      ]);

      const result = await EmployeeJobAssignmentService.completeJob(1, 20);

      expect(result.completionStatus).toEqual({
        allCompleted: false,
        totalAssigned: 3,
        completedCount: 2,
      });
    });
  });
});
