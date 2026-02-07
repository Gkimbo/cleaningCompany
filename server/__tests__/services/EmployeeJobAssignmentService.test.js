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

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  notifyEmployeeJobAssigned: jest.fn(),
  notifyEmployeeJobReassigned: jest.fn(),
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
      findByPk: jest.fn(),
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
const NotificationService = require("../../services/NotificationService");
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

    it("should send notification to employee when job is assigned", async () => {
      const employeeWithUser = {
        ...mockEmployee,
        userId: 5,
      };
      BusinessEmployee.findOne.mockResolvedValue(employeeWithUser);
      UserAppointments.findOne.mockResolvedValue({
        ...mockAppointment,
        date: "2026-02-15",
        homeId: 1,
        home: { address: "123 Main St" },
      });
      EmployeeJobAssignment.findOne.mockResolvedValue(null);
      CustomJobFlowService.resolveFlowForAppointment.mockResolvedValue({
        usesPlatformFlow: false,
        customFlowId: null,
      });
      AppointmentJobFlowService.createJobFlowForAppointment.mockResolvedValue({
        id: 1,
        checklistProgress: null,
      });

      // Mock User.findByPk for employee, client, and business owner
      User.findByPk
        .mockResolvedValueOnce({ id: 5, email: "employee@test.com", expoPushToken: "token123" }) // employee
        .mockResolvedValueOnce({ id: 50, firstName: "Client", lastName: "Name" }) // client
        .mockResolvedValueOnce({ id: 10, businessName: "Test Business" }); // business owner

      const mockCreatedAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        isMarketplacePickup: false,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      await EmployeeJobAssignmentService.assignEmployeeToJob(10, {
        employeeId: 1,
        appointmentId: 100,
        payAmount: 5000,
      });

      expect(NotificationService.notifyEmployeeJobAssigned).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeUserId: 5,
          employeeName: "John",
          appointmentId: 100,
          payAmount: 5000,
        })
      );
    });

    it("should not send notification if employee has no email or push token", async () => {
      const employeeWithUser = {
        ...mockEmployee,
        userId: 5,
      };
      BusinessEmployee.findOne.mockResolvedValue(employeeWithUser);
      UserAppointments.findOne.mockResolvedValue({
        ...mockAppointment,
        date: "2026-02-15",
      });
      EmployeeJobAssignment.findOne.mockResolvedValue(null);
      CustomJobFlowService.resolveFlowForAppointment.mockResolvedValue({
        usesPlatformFlow: false,
        customFlowId: null,
      });
      AppointmentJobFlowService.createJobFlowForAppointment.mockResolvedValue({
        id: 1,
        checklistProgress: null,
      });

      // Mock User.findByPk - employee has no email or push token
      User.findByPk.mockResolvedValueOnce({ id: 5, email: null, expoPushToken: null });

      const mockCreatedAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        isMarketplacePickup: false,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      await EmployeeJobAssignmentService.assignEmployeeToJob(10, {
        employeeId: 1,
        appointmentId: 100,
        payAmount: 5000,
      });

      expect(NotificationService.notifyEmployeeJobAssigned).not.toHaveBeenCalled();
    });

    it("should not fail assignment if notification fails", async () => {
      const employeeWithUser = {
        ...mockEmployee,
        userId: 5,
      };
      BusinessEmployee.findOne.mockResolvedValue(employeeWithUser);
      UserAppointments.findOne.mockResolvedValue({
        ...mockAppointment,
        date: "2026-02-15",
        home: { address: "123 Main St" },
      });
      EmployeeJobAssignment.findOne.mockResolvedValue(null);
      CustomJobFlowService.resolveFlowForAppointment.mockResolvedValue({
        usesPlatformFlow: false,
        customFlowId: null,
      });
      AppointmentJobFlowService.createJobFlowForAppointment.mockResolvedValue({
        id: 1,
        checklistProgress: null,
      });

      User.findByPk
        .mockResolvedValueOnce({ id: 5, email: "employee@test.com", expoPushToken: "token123" })
        .mockResolvedValueOnce({ id: 50, firstName: "Client", lastName: "Name" })
        .mockResolvedValueOnce({ id: 10, businessName: "Test Business" });

      // Make notification fail
      NotificationService.notifyEmployeeJobAssigned.mockRejectedValue(new Error("Notification failed"));

      const mockCreatedAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        isMarketplacePickup: false,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockCreatedAssignment);

      // Should not throw even though notification failed
      const result = await EmployeeJobAssignmentService.assignEmployeeToJob(10, {
        employeeId: 1,
        appointmentId: 100,
        payAmount: 5000,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
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

    it("should calculate hourly pay correctly", async () => {
      const mockEmployee = {
        id: 1,
        defaultHourlyRate: 2000, // $20.00/hour in cents
      };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      // Set startedAt to exactly 2 hours and 1 minute ago to ensure consistent rounding to 2.5 hours
      const startedAt = new Date();
      startedAt.setHours(startedAt.getHours() - 2);
      startedAt.setMinutes(startedAt.getMinutes() - 1);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: false,
        status: "started",
        payType: "hourly",
        appointmentId: 100,
        startedAt,
        appointment: { id: 100, price: 15000 },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      // 2 hours 1 minute rounds UP to 2.5 hours (nearest 0.5)
      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          hoursWorked: 2.5, // 2 hours 1 minute rounds up to 2.5
          payAmount: 5000, // $50.00 (2.5 hours × $20/hour)
        })
      );
    });

    it("should calculate per_job pay correctly using defaultJobRate", async () => {
      const mockEmployee = {
        id: 1,
        defaultJobRate: 7500, // $75.00 per job in cents
        defaultHourlyRate: 2000,
      };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const startedAt = new Date();
      startedAt.setHours(startedAt.getHours() - 1.5);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: false,
        status: "started",
        payType: "per_job",
        appointmentId: 100,
        startedAt,
        appointment: { id: 100, price: 15000 },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          payAmount: 7500, // Uses defaultJobRate, not hourly calculation
        })
      );
    });

    it("should calculate flat_rate pay correctly using defaultJobRate", async () => {
      const mockEmployee = {
        id: 1,
        defaultJobRate: 6000, // $60.00 per job in cents
      };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: false,
        status: "started",
        payType: "flat_rate",
        appointmentId: 100,
        startedAt: new Date(),
        appointment: { id: 100, price: 15000 },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          payAmount: 6000, // Uses defaultJobRate
        })
      );
    });

    it("should calculate percentage pay correctly based on job price", async () => {
      const mockEmployee = {
        id: 1,
        payRate: 40, // 40% of job price
        defaultHourlyRate: 2000,
        defaultJobRate: 5000,
      };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: false,
        status: "started",
        payType: "percentage",
        appointmentId: 100,
        startedAt: new Date(),
        appointment: { id: 100, price: 15000 }, // $150.00 job
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          payAmount: 6000, // 40% of $150 = $60.00 (6000 cents)
        })
      );
    });

    it("should calculate percentage pay with decimal percentage", async () => {
      const mockEmployee = {
        id: 1,
        payRate: 33.5, // 33.5% of job price
      };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: false,
        status: "started",
        payType: "percentage",
        appointmentId: 100,
        startedAt: new Date(),
        appointment: { id: 100, price: 20000 }, // $200.00 job
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          payAmount: 6700, // 33.5% of $200 = $67.00 (6700 cents)
        })
      );
    });

    it("should track hours worked for per_job pay type", async () => {
      const mockEmployee = {
        id: 1,
        defaultJobRate: 5000,
      };
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);

      const startedAt = new Date();
      startedAt.setHours(startedAt.getHours() - 3); // 3 hours ago

      const mockAssignment = {
        id: 1,
        isMarketplacePickup: false,
        status: "started",
        payType: "per_job",
        appointmentId: 100,
        startedAt,
        appointment: { id: 100, price: 15000 },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      UserAppointments.update.mockResolvedValue([1]);

      await EmployeeJobAssignmentService.completeJob(1, 5);

      // Should still track hours even though pay is flat rate
      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          hoursWorked: expect.any(Number),
          payAmount: 5000, // Flat job rate, not hourly
        })
      );
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

  describe("reassignJob", () => {
    const mockCurrentAssignment = {
      id: 1,
      businessEmployeeId: 2,
      appointmentId: 100,
      businessOwnerId: 10,
      status: "assigned",
      payAmount: 5000,
      payType: "flat_rate",
      update: jest.fn(),
    };

    const mockNewEmployee = {
      id: 3,
      userId: 15,
      firstName: "Jane",
      lastName: "Smith",
      status: "active",
    };

    beforeEach(() => {
      // Reset all mocks before each reassignJob test
      jest.clearAllMocks();
      NotificationService.notifyEmployeeJobAssigned.mockResolvedValue({});
      NotificationService.notifyEmployeeJobReassigned.mockResolvedValue({});
    });

    it("should notify new employee when job is reassigned", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(mockCurrentAssignment);
      BusinessEmployee.findOne.mockResolvedValueOnce(mockNewEmployee);
      BusinessEmployee.findByPk.mockResolvedValueOnce({ id: 2, userId: 8 }); // Old employee

      const mockNewAssignment = {
        id: 2,
        businessEmployeeId: 3,
        appointmentId: 100,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockNewAssignment);
      UserAppointments.update.mockResolvedValue([1]);
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        userId: 50,
        date: "2026-02-20",
        home: { address: "456 Oak Ave" },
      });

      User.findByPk
        .mockResolvedValueOnce({ id: 50, firstName: "Client", lastName: "Test" }) // client
        .mockResolvedValueOnce({ id: 10, businessName: "Test Business" }) // business owner
        .mockResolvedValueOnce({ id: 15, email: "jane@test.com", expoPushToken: "token456" }); // new employee

      await EmployeeJobAssignmentService.reassignJob(1, 3, 10);

      expect(NotificationService.notifyEmployeeJobAssigned).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeUserId: 15,
          employeeName: "Jane",
          appointmentId: 100,
        })
      );
    });

    it("should notify old employee when job is reassigned away from them", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(mockCurrentAssignment);
      // First call for new employee verification
      BusinessEmployee.findOne.mockResolvedValueOnce(mockNewEmployee);
      // findByPk is used to get old employee for notification
      BusinessEmployee.findByPk.mockResolvedValueOnce({ id: 2, userId: 8 });

      const mockNewAssignment = {
        id: 2,
        businessEmployeeId: 3,
        appointmentId: 100,
      };
      EmployeeJobAssignment.create.mockResolvedValue(mockNewAssignment);
      UserAppointments.update.mockResolvedValue([1]);
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        userId: 50,
        date: "2026-02-20",
        home: { address: "456 Oak Ave" },
      });

      // User lookups: client, businessOwner, newEmployee user
      User.findByPk
        .mockResolvedValueOnce({ id: 50, firstName: "Client", lastName: "Test" }) // client
        .mockResolvedValueOnce({ id: 10, businessName: "Test Business" }) // business owner
        .mockResolvedValueOnce({ id: 15, email: "jane@test.com", expoPushToken: "token456" }); // new employee user

      await EmployeeJobAssignmentService.reassignJob(1, 3, 10);

      expect(NotificationService.notifyEmployeeJobReassigned).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeUserId: 8,
          appointmentId: 100,
        })
      );
    });

    it("should throw error when current assignment not found", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      await expect(
        EmployeeJobAssignmentService.reassignJob(999, 3, 10)
      ).rejects.toThrow("Assignment not found or cannot be reassigned");
    });

    it("should throw error when new employee not found", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(mockCurrentAssignment);
      // First call for new employee verification returns null
      BusinessEmployee.findOne.mockResolvedValueOnce(null);

      await expect(
        EmployeeJobAssignmentService.reassignJob(1, 999, 10)
      ).rejects.toThrow("New employee not found or not active");
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
