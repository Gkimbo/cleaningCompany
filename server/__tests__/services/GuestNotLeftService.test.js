// Mock models
jest.mock("../../models", () => ({
  GuestNotLeftReport: {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  },
  EmployeeJobAssignment: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {},
  UserHomes: {},
  User: {
    findByPk: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
  },
}));

// Mock services
jest.mock("../../services/NotificationService", () => ({
  notifyUser: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val),
}));

const {
  GuestNotLeftReport,
  EmployeeJobAssignment,
  User,
  BusinessEmployee,
} = require("../../models");
const NotificationService = require("../../services/NotificationService");
const GuestNotLeftService = require("../../services/GuestNotLeftService");

describe("GuestNotLeftService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("reportGuestNotLeft", () => {
    const mockEmployee = {
      id: 10,
      userId: 2,
      firstName: "Jane",
      lastName: "Cleaner",
      status: "active",
    };

    const mockHomeowner = {
      id: 1,
      firstName: "John",
      lastName: "Owner",
      expoPushToken: "ExponentPushToken[xxx]",
    };

    const mockAssignment = {
      id: 100,
      appointmentId: 200,
      businessEmployeeId: 10,
      businessOwnerId: 1,
      status: "assigned",
      guestNotLeftReported: false,
      guestNotLeftReportCount: 0,
      isSelfAssignment: false,
      update: jest.fn().mockResolvedValue(true),
      appointment: {
        id: 200,
        home: {
          id: 300,
          nickname: "Beach House",
          latitude: "40.7128",
          longitude: "-74.006",
        },
        user: mockHomeowner,
      },
    };

    it("should create a guest not left report", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      GuestNotLeftReport.create.mockResolvedValue({
        id: 1,
        employeeJobAssignmentId: 100,
        appointmentId: 200,
        reportedBy: 2,
      });

      const result = await GuestNotLeftService.reportGuestNotLeft(
        100,
        2,
        { latitude: 40.7128, longitude: -74.006 },
        "Guest said 30 more minutes"
      );

      expect(result.success).toBeUndefined(); // Doesn't have success field
      expect(result.reportCount).toBe(1);
      expect(result.homeownerNotified).toBe(true);
      expect(result.message).toContain("Job remains in your queue");

      expect(GuestNotLeftReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeJobAssignmentId: 100,
          appointmentId: 200,
          reportedBy: 2,
          notes: "Guest said 30 more minutes",
        })
      );

      expect(mockAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          guestNotLeftReported: true,
          guestNotLeftReportCount: 1,
        })
      );
    });

    it("should notify homeowner", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      GuestNotLeftReport.create.mockResolvedValue({ id: 1 });

      await GuestNotLeftService.reportGuestNotLeft(100, 2, {}, null);

      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: "guest_not_left",
          title: "Guest Still Present",
        })
      );
    });

    it("should throw error if employee not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(null);

      await expect(
        GuestNotLeftService.reportGuestNotLeft(100, 2, {}, null)
      ).rejects.toThrow("Employee record not found");
    });

    it("should throw error if assignment not found", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      await expect(
        GuestNotLeftService.reportGuestNotLeft(100, 2, {}, null)
      ).rejects.toThrow("Assignment not found or job already started");
    });

    it("should throw error if not assigned to job", async () => {
      const differentEmployee = { ...mockEmployee, id: 99 };
      BusinessEmployee.findOne.mockResolvedValue(differentEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      await expect(
        GuestNotLeftService.reportGuestNotLeft(100, 2, {}, null)
      ).rejects.toThrow("You are not assigned to this job");
    });

    it("should escalate after 3 reports", async () => {
      const assignmentWith2Reports = {
        ...mockAssignment,
        guestNotLeftReportCount: 2,
      };

      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(assignmentWith2Reports);
      GuestNotLeftReport.create.mockResolvedValue({ id: 1 });
      User.findByPk.mockResolvedValue(mockHomeowner);

      const result = await GuestNotLeftService.reportGuestNotLeft(100, 2, {}, null);

      expect(result.reportCount).toBe(3);

      // Should have called notifyUser twice (homeowner + escalation)
      expect(NotificationService.notifyUser).toHaveBeenCalledTimes(2);
      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "guest_not_left_escalation",
        })
      );
    });

    it("should calculate distance from home when GPS provided", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      GuestNotLeftReport.create.mockResolvedValue({ id: 1 });

      await GuestNotLeftService.reportGuestNotLeft(
        100,
        2,
        { latitude: 40.7128, longitude: -74.006 },
        null
      );

      expect(GuestNotLeftReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanerLatitude: 40.7128,
          cleanerLongitude: -74.006,
          distanceFromHome: expect.any(Number),
        })
      );
    });

    it("should handle missing GPS data gracefully", async () => {
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee);
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      GuestNotLeftReport.create.mockResolvedValue({ id: 1 });

      await GuestNotLeftService.reportGuestNotLeft(100, 2, {}, null);

      expect(GuestNotLeftReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanerLatitude: null,
          cleanerLongitude: null,
        })
      );
    });
  });

  describe("clearGuestNotLeftFlag", () => {
    it("should clear the flag and resolve reports", async () => {
      const mockAssignment = {
        id: 100,
        guestNotLeftReported: true,
        update: jest.fn().mockResolvedValue(true),
      };

      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);
      GuestNotLeftReport.update.mockResolvedValue([1]);

      await GuestNotLeftService.clearGuestNotLeftFlag(100);

      expect(mockAssignment.update).toHaveBeenCalledWith({
        guestNotLeftReported: false,
      });

      expect(GuestNotLeftReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          resolved: true,
          resolution: "job_completed",
        }),
        expect.objectContaining({
          where: {
            employeeJobAssignmentId: 100,
            resolved: false,
          },
        })
      );
    });

    it("should not update if flag is already false", async () => {
      const mockAssignment = {
        id: 100,
        guestNotLeftReported: false,
        update: jest.fn(),
      };

      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      await GuestNotLeftService.clearGuestNotLeftFlag(100);

      expect(mockAssignment.update).not.toHaveBeenCalled();
      expect(GuestNotLeftReport.update).not.toHaveBeenCalled();
    });

    it("should handle missing assignment gracefully", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      // Should not throw
      await expect(
        GuestNotLeftService.clearGuestNotLeftFlag(999)
      ).resolves.toBeUndefined();
    });
  });

  describe("getReportHistory", () => {
    it("should return report history for an assignment", async () => {
      const mockReports = [
        {
          id: 1,
          employeeJobAssignmentId: 100,
          reportedAt: new Date(),
          notes: "First report",
        },
        {
          id: 2,
          employeeJobAssignmentId: 100,
          reportedAt: new Date(),
          notes: "Second report",
        },
      ];

      GuestNotLeftReport.findAll.mockResolvedValue(mockReports);

      const result = await GuestNotLeftService.getReportHistory(100);

      expect(result).toHaveLength(2);
      expect(GuestNotLeftReport.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeJobAssignmentId: 100 },
          order: [["reportedAt", "DESC"]],
        })
      );
    });
  });

  describe("getGuestNotLeftStatus", () => {
    it("should return status for an assignment", async () => {
      const mockAssignment = {
        id: 100,
        guestNotLeftReported: true,
        guestNotLeftReportCount: 2,
        lastGuestNotLeftAt: new Date("2024-01-15T10:00:00Z"),
      };

      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const result = await GuestNotLeftService.getGuestNotLeftStatus(100);

      expect(result).toEqual({
        guestNotLeftReported: true,
        reportCount: 2,
        lastReportedAt: mockAssignment.lastGuestNotLeftAt,
      });
    });

    it("should return null for missing assignment", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      const result = await GuestNotLeftService.getGuestNotLeftStatus(999);

      expect(result).toBeNull();
    });
  });
});
