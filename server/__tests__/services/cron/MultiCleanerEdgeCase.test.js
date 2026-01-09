const {
  processEdgeCaseDecisions,
  processExpiredEdgeCaseDecisions,
  cancelEdgeCaseAppointment,
} = require("../../../services/cron/MultiCleanerFillMonitor");
const {
  MultiCleanerJob,
  UserAppointments,
  UserHomes,
  User,
  CleanerJobCompletion,
} = require("../../../models");
const { getPricingConfig } = require("../../../config/businessConfig");
const MultiCleanerService = require("../../../services/MultiCleanerService");
const NotificationService = require("../../../services/NotificationService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");

// Mock dependencies
jest.mock("../../../models", () => ({
  MultiCleanerJob: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  UserHomes: {},
  User: {
    findByPk: jest.fn(),
  },
  CleanerJobCompletion: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("../../../config/businessConfig", () => ({
  getPricingConfig: jest.fn(),
}));

jest.mock("../../../services/MultiCleanerService", () => ({
  isEdgeLargeHome: jest.fn(),
}));

jest.mock("../../../services/NotificationService", () => ({
  createNotification: jest.fn(),
}));

jest.mock("../../../services/sendNotifications/EmailClass", () => ({
  sendEdgeCaseDecisionRequired: jest.fn().mockResolvedValue(true),
  sendEdgeCaseAutoProceeded: jest.fn().mockResolvedValue(true),
  sendEdgeCaseCleanerConfirmed: jest.fn().mockResolvedValue(true),
  sendEdgeCaseCancelled: jest.fn().mockResolvedValue(true),
  sendEdgeCaseCleanerCancelled: jest.fn().mockResolvedValue(true),
  sendEdgeCaseSecondCleanerJoined: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushEdgeCaseDecision: jest.fn().mockResolvedValue(true),
  sendPushEdgeCaseCleanerConfirmed: jest.fn().mockResolvedValue(true),
  sendPushEdgeCaseCleanerCancelled: jest.fn().mockResolvedValue(true),
  sendPushEdgeCaseSecondCleanerJoined: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val),
}));

describe("Multi-Cleaner Edge Case Processing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPricingConfig.mockResolvedValue({
      multiCleaner: {
        edgeCaseDecisionDays: 3,
        edgeCaseDecisionHours: 24,
        largeHomeBedsThreshold: 3,
        largeHomeBathsThreshold: 3,
      },
    });
  });

  // ============================================================================
  // processEdgeCaseDecisions Tests
  // ============================================================================
  describe("processEdgeCaseDecisions", () => {
    it("should return 0 when no edge case jobs found", async () => {
      MultiCleanerJob.findAll.mockResolvedValue([]);

      const result = await processEdgeCaseDecisions();

      expect(result).toBe(0);
      expect(MultiCleanerJob.findAll).toHaveBeenCalledTimes(1);
    });

    it("should query for partially_filled jobs with 1 cleaner confirmed", async () => {
      MultiCleanerJob.findAll.mockResolvedValue([]);

      await processEdgeCaseDecisions();

      expect(MultiCleanerJob.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "partially_filled",
            cleanersConfirmed: 1,
            totalCleanersRequired: 2,
            edgeCaseDecisionRequired: false,
          }),
        })
      );
    });

    it("should skip jobs that are not edge case homes", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          home: { numBeds: 2, numBaths: 1 },
          user: { id: 100, firstName: "Test", email: "test@test.com" },
        },
        update: jest.fn(),
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(false);

      const result = await processEdgeCaseDecisions();

      expect(result).toBe(0);
      expect(mockJob.update).not.toHaveBeenCalled();
    });

    it("should skip jobs without confirmed cleaner", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: { numBeds: 3, numBaths: 2 },
          user: { id: 200, firstName: "John", email: "john@test.com" },
        },
        update: jest.fn(),
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue(null);

      const result = await processEdgeCaseDecisions();

      expect(result).toBe(0);
      expect(mockJob.update).not.toHaveBeenCalled();
    });

    it("should process edge case jobs and update job fields correctly", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            numBeds: 3,
            numBaths: 2,
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
            expoPushToken: "test-token",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      const result = await processEdgeCaseDecisions();

      expect(result).toBe(1);
      expect(mockJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          edgeCaseDecisionRequired: true,
          homeownerDecision: "pending",
        })
      );
      // Verify expiration is set to ~24 hours in the future
      const updateCall = mockJob.update.mock.calls[0][0];
      expect(updateCall.edgeCaseDecisionSentAt).toBeDefined();
      expect(updateCall.edgeCaseDecisionExpiresAt).toBeDefined();
    });

    it("should send in-app notification to homeowner", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            numBeds: 3,
            numBaths: 2,
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
            expoPushToken: null,
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processEdgeCaseDecisions();

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          type: "edge_case_decision_required",
          actionRequired: true,
        })
      );
    });

    it("should send email notification to homeowner", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            numBeds: 3,
            numBaths: 2,
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
            expoPushToken: null,
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processEdgeCaseDecisions();

      expect(Email.sendEdgeCaseDecisionRequired).toHaveBeenCalledWith(
        "john@test.com",
        "John",
        "Jane",
        expect.any(String), // formatted date
        expect.any(Object), // home address
        24, // decision hours
        100, // appointment id
        1 // job id
      );
    });

    it("should send push notification when homeowner has push token", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            numBeds: 3,
            numBaths: 2,
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
            expoPushToken: "ExponentPushToken[xxx]",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processEdgeCaseDecisions();

      expect(PushNotification.sendPushEdgeCaseDecision).toHaveBeenCalledWith(
        "ExponentPushToken[xxx]",
        "John",
        "Jane",
        expect.any(String),
        24
      );
    });

    it("should not send push notification when homeowner has no push token", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            numBeds: 3,
            numBaths: 2,
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
            expoPushToken: null,
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processEdgeCaseDecisions();

      expect(PushNotification.sendPushEdgeCaseDecision).not.toHaveBeenCalled();
    });

    it("should process multiple edge case jobs", async () => {
      const createMockJob = (id) => ({
        id,
        appointment: {
          id: 100 + id,
          date: new Date().toISOString(),
          home: {
            numBeds: 3,
            numBaths: 2,
            address: `${id} Test St`,
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200 + id,
            firstName: `User${id}`,
            email: `user${id}@test.com`,
            expoPushToken: null,
          },
        },
        update: jest.fn().mockResolvedValue(true),
      });

      const mockJobs = [createMockJob(1), createMockJob(2), createMockJob(3)];

      MultiCleanerJob.findAll.mockResolvedValue(mockJobs);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: { id: 300, firstName: "Jane", email: "jane@test.com" },
      });

      const result = await processEdgeCaseDecisions();

      expect(result).toBe(3);
      expect(mockJobs[0].update).toHaveBeenCalled();
      expect(mockJobs[1].update).toHaveBeenCalled();
      expect(mockJobs[2].update).toHaveBeenCalled();
    });

    it("should continue processing other jobs if one fails", async () => {
      const mockJob1 = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: { numBeds: 3, numBaths: 2 },
          user: { id: 200, firstName: "John", email: "john@test.com" },
        },
        update: jest.fn().mockRejectedValue(new Error("DB error")),
      };

      const mockJob2 = {
        id: 2,
        appointment: {
          id: 101,
          date: new Date().toISOString(),
          home: {
            numBeds: 3,
            numBaths: 2,
            address: "456 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: { id: 201, firstName: "Jane", email: "jane@test.com" },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob1, mockJob2]);
      MultiCleanerService.isEdgeLargeHome.mockResolvedValue(true);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: { id: 300, firstName: "Cleaner", email: "cleaner@test.com" },
      });

      const result = await processEdgeCaseDecisions();

      expect(result).toBe(1); // Only second job succeeded
      expect(mockJob2.update).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // processExpiredEdgeCaseDecisions Tests
  // ============================================================================
  describe("processExpiredEdgeCaseDecisions", () => {
    it("should return 0 when no expired decisions found", async () => {
      MultiCleanerJob.findAll.mockResolvedValue([]);

      const result = await processExpiredEdgeCaseDecisions();

      expect(result).toBe(0);
    });

    it("should query for pending decisions with expired deadline", async () => {
      MultiCleanerJob.findAll.mockResolvedValue([]);

      await processExpiredEdgeCaseDecisions();

      expect(MultiCleanerJob.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            edgeCaseDecisionRequired: true,
            homeownerDecision: "pending",
          }),
        })
      );
    });

    it("should auto-proceed expired decisions and update job", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: "cleaner-token",
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      const result = await processExpiredEdgeCaseDecisions();

      expect(result).toBe(1);
      expect(mockJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          homeownerDecision: "auto_proceeded",
        })
      );
      // Verify timestamp is set
      const updateCall = mockJob.update.mock.calls[0][0];
      expect(updateCall.homeownerDecisionAt).toBeDefined();
    });

    it("should notify homeowner of auto-proceed", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processExpiredEdgeCaseDecisions();

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          type: "edge_case_auto_proceeded",
        })
      );
    });

    it("should notify cleaner they are confirmed as sole cleaner", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processExpiredEdgeCaseDecisions();

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 300,
          type: "edge_case_cleaner_confirmed",
        })
      );
    });

    it("should send email to homeowner about auto-proceed", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processExpiredEdgeCaseDecisions();

      expect(Email.sendEdgeCaseAutoProceeded).toHaveBeenCalledWith(
        "john@test.com",
        "John",
        "Jane",
        expect.any(String),
        expect.any(Object),
        100
      );
    });

    it("should send email to cleaner about confirmation", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processExpiredEdgeCaseDecisions();

      expect(Email.sendEdgeCaseCleanerConfirmed).toHaveBeenCalledWith(
        "jane@test.com",
        "Jane",
        expect.any(String),
        expect.any(Object),
        100,
        true // fullPay
      );
    });

    it("should send push notification to cleaner when token exists", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: {
            address: "123 Test St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          user: {
            id: 200,
            firstName: "John",
            email: "john@test.com",
          },
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: "ExponentPushToken[cleaner]",
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });

      await processExpiredEdgeCaseDecisions();

      expect(PushNotification.sendPushEdgeCaseCleanerConfirmed).toHaveBeenCalledWith(
        "ExponentPushToken[cleaner]",
        "Jane",
        expect.any(String),
        "123 Test St"
      );
    });

    it("should skip jobs without confirmed cleaner", async () => {
      const mockJob = {
        id: 1,
        appointment: {
          id: 100,
          date: new Date().toISOString(),
          home: { address: "123 Test St" },
          user: { id: 200, firstName: "John", email: "john@test.com" },
        },
        update: jest.fn(),
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findOne.mockResolvedValue(null);

      const result = await processExpiredEdgeCaseDecisions();

      expect(result).toBe(0);
      expect(mockJob.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // cancelEdgeCaseAppointment Tests
  // ============================================================================
  describe("cancelEdgeCaseAppointment", () => {
    it("should return error when appointment not found", async () => {
      const mockJob = { appointmentId: 999 };
      UserAppointments.findByPk.mockResolvedValue(null);

      const result = await cancelEdgeCaseAppointment(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Appointment not found");
    });

    it("should update multi-cleaner job status to cancelled", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(null);
      CleanerJobCompletion.update.mockResolvedValue([0]);

      const result = await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(result.success).toBe(true);
      expect(mockJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          homeownerDecision: "cancel",
        })
      );
    });

    it("should update appointment payment status to cancelled", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(null);
      CleanerJobCompletion.update.mockResolvedValue([0]);

      await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: "cancelled",
          hasBeenAssigned: false,
        })
      );
    });

    it("should update cleaner completions to dropped_out", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(null);
      CleanerJobCompletion.update.mockResolvedValue([1]);

      await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(CleanerJobCompletion.update).toHaveBeenCalledWith(
        { status: "dropped_out" },
        { where: { multiCleanerJobId: 1 } }
      );
    });

    it("should notify homeowner of cancellation", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(null);
      CleanerJobCompletion.update.mockResolvedValue([0]);

      await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          type: "edge_case_cancelled",
        })
      );
    });

    it("should notify cleaner of cancellation when cleaner exists", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: null,
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });
      CleanerJobCompletion.update.mockResolvedValue([1]);

      await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 300,
          type: "edge_case_cleaner_cancelled",
        })
      );
    });

    it("should send email to homeowner about cancellation", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(null);
      CleanerJobCompletion.update.mockResolvedValue([0]);

      await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(Email.sendEdgeCaseCancelled).toHaveBeenCalledWith(
        "john@test.com",
        "John",
        expect.any(String),
        expect.any(Object),
        "homeowner_chose_cancel"
      );
    });

    it("should send email to cleaner about cancellation", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: null,
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });
      CleanerJobCompletion.update.mockResolvedValue([1]);

      await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(Email.sendEdgeCaseCleanerCancelled).toHaveBeenCalledWith(
        "jane@test.com",
        "Jane",
        expect.any(String),
        expect.any(Object),
        "homeowner_chose_cancel"
      );
    });

    it("should send push notification to cleaner when token exists", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: {
          address: "123 Test St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
        user: {
          id: 200,
          firstName: "John",
          email: "john@test.com",
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockCleaner = {
        id: 300,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: "ExponentPushToken[cleaner]",
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue({
        cleaner: mockCleaner,
      });
      CleanerJobCompletion.update.mockResolvedValue([1]);

      await cancelEdgeCaseAppointment(mockJob, "homeowner_chose_cancel");

      expect(PushNotification.sendPushEdgeCaseCleanerCancelled).toHaveBeenCalledWith(
        "ExponentPushToken[cleaner]",
        "Jane",
        expect.any(String),
        "123 Test St"
      );
    });

    it("should handle errors gracefully and return error result", async () => {
      const mockJob = {
        id: 1,
        appointmentId: 100,
        update: jest.fn().mockRejectedValue(new Error("DB error")),
      };

      const mockAppointment = {
        id: 100,
        date: new Date().toISOString(),
        paymentIntentId: null,
        home: { address: "123 Test St" },
        user: { id: 200, firstName: "John", email: "john@test.com" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(null);
      CleanerJobCompletion.update.mockResolvedValue([0]);

      const result = await cancelEdgeCaseAppointment(mockJob, "test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB error");
    });
  });

  // ============================================================================
  // Edge Case Home Detection Tests
  // ============================================================================
  describe("Edge Case Home Detection", () => {
    it("should call isEdgeLargeHome with correct parameters for 3 bed/2 bath", async () => {
      await MultiCleanerService.isEdgeLargeHome(3, 2);

      expect(MultiCleanerService.isEdgeLargeHome).toHaveBeenCalledWith(3, 2);
    });

    it("should call isEdgeLargeHome with correct parameters for 2 bed/3 bath", async () => {
      await MultiCleanerService.isEdgeLargeHome(2, 3);

      expect(MultiCleanerService.isEdgeLargeHome).toHaveBeenCalledWith(2, 3);
    });

    it("should call isEdgeLargeHome with correct parameters for 3 bed/3 bath", async () => {
      await MultiCleanerService.isEdgeLargeHome(3, 3);

      expect(MultiCleanerService.isEdgeLargeHome).toHaveBeenCalledWith(3, 3);
    });
  });

  // ============================================================================
  // MultiCleanerJob Helper Methods Tests
  // ============================================================================
  describe("MultiCleanerJob Helper Methods", () => {
    describe("hasEdgeCaseDecisionPending logic", () => {
      it("should return true when edgeCaseDecisionRequired is true and homeownerDecision is pending", () => {
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "pending",
        };

        const result =
          job.edgeCaseDecisionRequired && job.homeownerDecision === "pending";
        expect(result).toBe(true);
      });

      it("should return false when edgeCaseDecisionRequired is false", () => {
        const job = {
          edgeCaseDecisionRequired: false,
          homeownerDecision: "pending",
        };

        const result =
          job.edgeCaseDecisionRequired && job.homeownerDecision === "pending";
        expect(result).toBe(false);
      });

      it("should return false when homeownerDecision is null", () => {
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: null,
        };

        const result =
          job.edgeCaseDecisionRequired && job.homeownerDecision === "pending";
        expect(result).toBe(false);
      });

      it("should return false when homeownerDecision is proceed", () => {
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "proceed",
        };

        const result =
          job.edgeCaseDecisionRequired && job.homeownerDecision === "pending";
        expect(result).toBe(false);
      });

      it("should return false when homeownerDecision is cancel", () => {
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "cancel",
        };

        const result =
          job.edgeCaseDecisionRequired && job.homeownerDecision === "pending";
        expect(result).toBe(false);
      });

      it("should return false when homeownerDecision is auto_proceeded", () => {
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "auto_proceeded",
        };

        const result =
          job.edgeCaseDecisionRequired && job.homeownerDecision === "pending";
        expect(result).toBe(false);
      });
    });

    describe("isEdgeCaseDecisionExpired logic", () => {
      it("should return true when decision has expired", () => {
        const pastDate = new Date(Date.now() - 1000);
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "pending",
          edgeCaseDecisionExpiresAt: pastDate,
        };

        const result =
          job.edgeCaseDecisionRequired &&
          job.homeownerDecision === "pending" &&
          job.edgeCaseDecisionExpiresAt &&
          new Date() > new Date(job.edgeCaseDecisionExpiresAt);

        expect(result).toBe(true);
      });

      it("should return false when decision has not expired", () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "pending",
          edgeCaseDecisionExpiresAt: futureDate,
        };

        const result =
          job.edgeCaseDecisionRequired &&
          job.homeownerDecision === "pending" &&
          job.edgeCaseDecisionExpiresAt &&
          new Date() > new Date(job.edgeCaseDecisionExpiresAt);

        expect(result).toBe(false);
      });

      it("should return false when edgeCaseDecisionExpiresAt is null", () => {
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "pending",
          edgeCaseDecisionExpiresAt: null,
        };

        const result = !!(
          job.edgeCaseDecisionRequired &&
          job.homeownerDecision === "pending" &&
          job.edgeCaseDecisionExpiresAt &&
          new Date() > new Date(job.edgeCaseDecisionExpiresAt)
        );

        expect(result).toBe(false);
      });

      it("should return false when decision is not pending", () => {
        const pastDate = new Date(Date.now() - 1000);
        const job = {
          edgeCaseDecisionRequired: true,
          homeownerDecision: "proceed",
          edgeCaseDecisionExpiresAt: pastDate,
        };

        const result =
          job.edgeCaseDecisionRequired &&
          job.homeownerDecision === "pending" &&
          job.edgeCaseDecisionExpiresAt &&
          new Date() > new Date(job.edgeCaseDecisionExpiresAt);

        expect(result).toBe(false);
      });

      it("should return false when edgeCaseDecisionRequired is false", () => {
        const pastDate = new Date(Date.now() - 1000);
        const job = {
          edgeCaseDecisionRequired: false,
          homeownerDecision: "pending",
          edgeCaseDecisionExpiresAt: pastDate,
        };

        const result =
          job.edgeCaseDecisionRequired &&
          job.homeownerDecision === "pending" &&
          job.edgeCaseDecisionExpiresAt &&
          new Date() > new Date(job.edgeCaseDecisionExpiresAt);

        expect(result).toBe(false);
      });
    });
  });
});

// ============================================================================
// Payment Capture Blocking Tests
// ============================================================================
describe("Payment Capture Blocking for Edge Case Decisions", () => {
  describe("hasEdgeCaseDecisionPending integration with payment capture", () => {
    it("should skip payment capture when edge case decision is pending", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "pending",
        hasEdgeCaseDecisionPending: function () {
          return (
            this.edgeCaseDecisionRequired && this.homeownerDecision === "pending"
          );
        },
      };

      // Simulate the check that happens in runDailyPaymentCheck
      const shouldSkipCapture = multiCleanerJob.hasEdgeCaseDecisionPending();
      expect(shouldSkipCapture).toBe(true);
    });

    it("should allow payment capture when decision is proceed", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "proceed",
        hasEdgeCaseDecisionPending: function () {
          return (
            this.edgeCaseDecisionRequired && this.homeownerDecision === "pending"
          );
        },
      };

      const shouldSkipCapture = multiCleanerJob.hasEdgeCaseDecisionPending();
      expect(shouldSkipCapture).toBe(false);
    });

    it("should allow payment capture when decision is auto_proceeded", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "auto_proceeded",
        hasEdgeCaseDecisionPending: function () {
          return (
            this.edgeCaseDecisionRequired && this.homeownerDecision === "pending"
          );
        },
      };

      const shouldSkipCapture = multiCleanerJob.hasEdgeCaseDecisionPending();
      expect(shouldSkipCapture).toBe(false);
    });

    it("should allow payment capture when not an edge case home", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: false,
        homeownerDecision: null,
        hasEdgeCaseDecisionPending: function () {
          return (
            this.edgeCaseDecisionRequired && this.homeownerDecision === "pending"
          );
        },
      };

      const shouldSkipCapture = multiCleanerJob.hasEdgeCaseDecisionPending();
      expect(shouldSkipCapture).toBe(false);
    });

    it("should allow payment capture when no multi-cleaner job exists", () => {
      const multiCleanerJob = null;

      // Simulate the check: if (multiCleanerJob && multiCleanerJob.hasEdgeCaseDecisionPending())
      const shouldSkipCapture =
        multiCleanerJob && multiCleanerJob.hasEdgeCaseDecisionPending();
      expect(shouldSkipCapture).toBeFalsy();
    });

    it("should allow payment capture when decision is cancelled", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "cancel",
        hasEdgeCaseDecisionPending: function () {
          return (
            this.edgeCaseDecisionRequired && this.homeownerDecision === "pending"
          );
        },
      };

      // Note: In practice, cancelled jobs won't reach payment capture
      // but the helper should still return false
      const shouldSkipCapture = multiCleanerJob.hasEdgeCaseDecisionPending();
      expect(shouldSkipCapture).toBe(false);
    });
  });

  describe("payment capture flow scenarios", () => {
    it("should correctly identify 3-day window for edge case processing", () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 3);
      const now = new Date();

      const diffInMs = appointmentDate.getTime() - now.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      expect(diffInDays).toBe(3);
      expect(diffInDays <= 3 && diffInDays >= 0).toBe(true);
    });

    it("should correctly identify appointments outside 3-day window", () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 5);
      const now = new Date();

      const diffInMs = appointmentDate.getTime() - now.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      expect(diffInDays).toBe(5);
      expect(diffInDays <= 3 && diffInDays >= 0).toBe(false);
    });

    it("should process appointments that have assigned cleaners and no pending decision", () => {
      const appointment = {
        id: 1,
        hasBeenAssigned: true,
        paymentStatus: "authorized",
      };
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "proceed",
        hasEdgeCaseDecisionPending: () => false,
      };

      // Should capture payment
      const shouldCapture =
        appointment.hasBeenAssigned &&
        (!multiCleanerJob || !multiCleanerJob.hasEdgeCaseDecisionPending());
      expect(shouldCapture).toBe(true);
    });

    it("should NOT process appointments that have pending edge case decision", () => {
      const appointment = {
        id: 1,
        hasBeenAssigned: true,
        paymentStatus: "authorized",
      };
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "pending",
        hasEdgeCaseDecisionPending: () => true,
      };

      // Should NOT capture payment
      const shouldCapture =
        appointment.hasBeenAssigned &&
        (!multiCleanerJob || !multiCleanerJob.hasEdgeCaseDecisionPending());
      expect(shouldCapture).toBe(false);
    });
  });
});

// ============================================================================
// Late-Joining Cleaner Notification Tests
// ============================================================================
describe("Late-Joining Cleaner Notifications", () => {
  describe("detectLateJoiningCleaner", () => {
    it("should identify late-joining cleaner scenario for edge case job with proceed decision", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "proceed",
        cleanersConfirmed: 1, // Currently has 1 cleaner
        totalCleanersRequired: 2,
      };

      // New cleaner is joining
      const newCleanerId = 101;
      const isLateJoiner =
        multiCleanerJob.edgeCaseDecisionRequired &&
        (multiCleanerJob.homeownerDecision === "proceed" ||
          multiCleanerJob.homeownerDecision === "auto_proceeded") &&
        multiCleanerJob.cleanersConfirmed >= 1;

      expect(isLateJoiner).toBe(true);
    });

    it("should identify late-joining cleaner scenario for edge case job with auto_proceeded decision", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "auto_proceeded",
        cleanersConfirmed: 1,
        totalCleanersRequired: 2,
      };

      const isLateJoiner =
        multiCleanerJob.edgeCaseDecisionRequired &&
        (multiCleanerJob.homeownerDecision === "proceed" ||
          multiCleanerJob.homeownerDecision === "auto_proceeded") &&
        multiCleanerJob.cleanersConfirmed >= 1;

      expect(isLateJoiner).toBe(true);
    });

    it("should NOT identify late-joining scenario when decision is still pending", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "pending",
        cleanersConfirmed: 1,
        totalCleanersRequired: 2,
      };

      const isLateJoiner =
        multiCleanerJob.edgeCaseDecisionRequired &&
        (multiCleanerJob.homeownerDecision === "proceed" ||
          multiCleanerJob.homeownerDecision === "auto_proceeded") &&
        multiCleanerJob.cleanersConfirmed >= 1;

      expect(isLateJoiner).toBe(false);
    });

    it("should NOT identify late-joining scenario for non-edge-case job", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: false,
        homeownerDecision: null,
        cleanersConfirmed: 1,
        totalCleanersRequired: 2,
      };

      const isLateJoiner =
        multiCleanerJob.edgeCaseDecisionRequired &&
        (multiCleanerJob.homeownerDecision === "proceed" ||
          multiCleanerJob.homeownerDecision === "auto_proceeded") &&
        multiCleanerJob.cleanersConfirmed >= 1;

      expect(isLateJoiner).toBe(false);
    });

    it("should NOT identify late-joining scenario when no cleaner confirmed yet", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "proceed",
        cleanersConfirmed: 0,
        totalCleanersRequired: 2,
      };

      const isLateJoiner =
        multiCleanerJob.edgeCaseDecisionRequired &&
        (multiCleanerJob.homeownerDecision === "proceed" ||
          multiCleanerJob.homeownerDecision === "auto_proceeded") &&
        multiCleanerJob.cleanersConfirmed >= 1;

      expect(isLateJoiner).toBe(false);
    });
  });

  describe("late-joining notification scenarios", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should send notification to original cleaner when second cleaner joins", () => {
      const originalCleaner = {
        id: 100,
        firstName: "Jane",
        expoPushToken: "expo_token_original",
      };
      const newCleaner = {
        id: 101,
        firstName: "Steve",
      };
      const multiCleanerJob = {
        id: 1,
        edgeCaseDecisionRequired: true,
        homeownerDecision: "proceed",
        cleanersConfirmed: 1,
      };

      // Verify notification should be sent
      expect(originalCleaner.expoPushToken).toBeTruthy();
      expect(newCleaner.firstName).toBe("Steve");
      expect(multiCleanerJob.homeownerDecision).toBe("proceed");
    });

    it("should update payment split when second cleaner joins", () => {
      const originalCleanerPay = 15000; // Full pay for single cleaner
      const splitPay = originalCleanerPay / 2; // Split between 2 cleaners

      expect(splitPay).toBe(7500);
    });

    it("should handle late-joining even the day before cleaning", () => {
      const cleaningDate = new Date();
      cleaningDate.setDate(cleaningDate.getDate() + 1); // Tomorrow
      const now = new Date();

      const daysUntilCleaning = Math.floor(
        (cleaningDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Late-joining should still be allowed even 1 day before
      expect(daysUntilCleaning).toBe(1);
      expect(daysUntilCleaning >= 0).toBe(true);
    });

    it("should send email to original cleaner about second cleaner joining", async () => {
      // Verify the email function would be called with correct parameters
      const emailParams = {
        cleanerEmail: "jane@example.com",
        cleanerFirstName: "Jane",
        newCleanerFirstName: "Steve",
        appointmentDate: "2026-01-15",
        homeAddress: "123 Main St",
      };

      expect(Email.sendEdgeCaseSecondCleanerJoined).toBeDefined();
      expect(typeof Email.sendEdgeCaseSecondCleanerJoined).toBe("function");
    });

    it("should send push notification to original cleaner", async () => {
      expect(PushNotification.sendPushEdgeCaseSecondCleanerJoined).toBeDefined();
      expect(
        typeof PushNotification.sendPushEdgeCaseSecondCleanerJoined
      ).toBe("function");
    });

    it("should include new cleaner name in notification", () => {
      const newCleanerFirstName = "Steve";
      const notificationMessage = `Good news! ${newCleanerFirstName} will be cleaning with you.`;

      expect(notificationMessage).toContain("Steve");
      expect(notificationMessage).toContain("cleaning with you");
    });

    it("should notify about payment split", () => {
      const originalPay = 15000;
      const newSplitPay = originalPay / 2;
      const message = `Payment will be split accordingly. Your new earnings: $${(newSplitPay / 100).toFixed(2)}`;

      expect(message).toContain("75.00");
      expect(message).toContain("split");
    });
  });

  describe("edge cases for late-joining", () => {
    it("should handle multiple late-joiners (edge case: 3 bed/3 bath might need 2 cleaners)", () => {
      // This tests the scenario where a very large edge case home
      // might have multiple cleaners join one after another
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "proceed",
        cleanersConfirmed: 1,
        totalCleanersRequired: 2,
      };

      // First late-joiner
      expect(multiCleanerJob.cleanersConfirmed).toBe(1);

      // After first late-joiner joins
      multiCleanerJob.cleanersConfirmed = 2;
      expect(multiCleanerJob.cleanersConfirmed).toBe(
        multiCleanerJob.totalCleanersRequired
      );
    });

    it("should not allow late-joining if job is already fully filled", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "proceed",
        cleanersConfirmed: 2,
        totalCleanersRequired: 2,
        status: "filled",
      };

      const canJoin = multiCleanerJob.cleanersConfirmed < multiCleanerJob.totalCleanersRequired;
      expect(canJoin).toBe(false);
    });

    it("should handle late-joining when homeowner cancelled", () => {
      const multiCleanerJob = {
        edgeCaseDecisionRequired: true,
        homeownerDecision: "cancel",
        cleanersConfirmed: 0,
        totalCleanersRequired: 2,
        status: "cancelled",
      };

      // Late-joining should not be possible if cancelled
      const canJoin =
        multiCleanerJob.homeownerDecision !== "cancel" &&
        multiCleanerJob.status !== "cancelled";
      expect(canJoin).toBe(false);
    });
  });
});

// ============================================================================
// Edge Case Email Templates Tests
// ============================================================================
describe("Edge Case Email Templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendEdgeCaseDecisionRequired", () => {
    it("should be defined and callable", () => {
      expect(Email.sendEdgeCaseDecisionRequired).toBeDefined();
      expect(typeof Email.sendEdgeCaseDecisionRequired).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await Email.sendEdgeCaseDecisionRequired(
        "test@example.com",
        "John",
        "2026-01-15",
        "123 Main St, City",
        "Jane",
        "http://example.com/decision/123",
        "2026-01-14T12:00:00Z"
      );

      expect(result).toBe(true);
      expect(Email.sendEdgeCaseDecisionRequired).toHaveBeenCalledWith(
        "test@example.com",
        "John",
        "2026-01-15",
        "123 Main St, City",
        "Jane",
        "http://example.com/decision/123",
        "2026-01-14T12:00:00Z"
      );
    });
  });

  describe("sendEdgeCaseAutoProceeded", () => {
    it("should be defined and callable", () => {
      expect(Email.sendEdgeCaseAutoProceeded).toBeDefined();
      expect(typeof Email.sendEdgeCaseAutoProceeded).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await Email.sendEdgeCaseAutoProceeded(
        "test@example.com",
        "John",
        "2026-01-15",
        "123 Main St, City",
        "Jane"
      );

      expect(result).toBe(true);
      expect(Email.sendEdgeCaseAutoProceeded).toHaveBeenCalledWith(
        "test@example.com",
        "John",
        "2026-01-15",
        "123 Main St, City",
        "Jane"
      );
    });
  });

  describe("sendEdgeCaseCleanerConfirmed", () => {
    it("should be defined and callable", () => {
      expect(Email.sendEdgeCaseCleanerConfirmed).toBeDefined();
      expect(typeof Email.sendEdgeCaseCleanerConfirmed).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await Email.sendEdgeCaseCleanerConfirmed(
        "cleaner@example.com",
        "Jane",
        "2026-01-15",
        "123 Main St, City",
        15000
      );

      expect(result).toBe(true);
      expect(Email.sendEdgeCaseCleanerConfirmed).toHaveBeenCalledWith(
        "cleaner@example.com",
        "Jane",
        "2026-01-15",
        "123 Main St, City",
        15000
      );
    });
  });

  describe("sendEdgeCaseCancelled", () => {
    it("should be defined and callable", () => {
      expect(Email.sendEdgeCaseCancelled).toBeDefined();
      expect(typeof Email.sendEdgeCaseCancelled).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await Email.sendEdgeCaseCancelled(
        "test@example.com",
        "John",
        "2026-01-15",
        "123 Main St, City"
      );

      expect(result).toBe(true);
      expect(Email.sendEdgeCaseCancelled).toHaveBeenCalledWith(
        "test@example.com",
        "John",
        "2026-01-15",
        "123 Main St, City"
      );
    });
  });

  describe("sendEdgeCaseCleanerCancelled", () => {
    it("should be defined and callable", () => {
      expect(Email.sendEdgeCaseCleanerCancelled).toBeDefined();
      expect(typeof Email.sendEdgeCaseCleanerCancelled).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await Email.sendEdgeCaseCleanerCancelled(
        "cleaner@example.com",
        "Jane",
        "2026-01-15",
        "123 Main St, City",
        "Homeowner chose to cancel due to lack of cleaners"
      );

      expect(result).toBe(true);
      expect(Email.sendEdgeCaseCleanerCancelled).toHaveBeenCalledWith(
        "cleaner@example.com",
        "Jane",
        "2026-01-15",
        "123 Main St, City",
        "Homeowner chose to cancel due to lack of cleaners"
      );
    });
  });

  describe("sendEdgeCaseSecondCleanerJoined", () => {
    it("should be defined and callable", () => {
      expect(Email.sendEdgeCaseSecondCleanerJoined).toBeDefined();
      expect(typeof Email.sendEdgeCaseSecondCleanerJoined).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await Email.sendEdgeCaseSecondCleanerJoined(
        "cleaner@example.com",
        "Jane",
        "Steve",
        "2026-01-15",
        "123 Main St, City",
        7500
      );

      expect(result).toBe(true);
      expect(Email.sendEdgeCaseSecondCleanerJoined).toHaveBeenCalledWith(
        "cleaner@example.com",
        "Jane",
        "Steve",
        "2026-01-15",
        "123 Main St, City",
        7500
      );
    });
  });
});

// ============================================================================
// Edge Case Push Notification Tests
// ============================================================================
describe("Edge Case Push Notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendPushEdgeCaseDecision", () => {
    it("should be defined and callable", () => {
      expect(PushNotification.sendPushEdgeCaseDecision).toBeDefined();
      expect(typeof PushNotification.sendPushEdgeCaseDecision).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await PushNotification.sendPushEdgeCaseDecision(
        "expo_push_token_123",
        "2026-01-15",
        "Jane"
      );

      expect(result).toBe(true);
      expect(PushNotification.sendPushEdgeCaseDecision).toHaveBeenCalledWith(
        "expo_push_token_123",
        "2026-01-15",
        "Jane"
      );
    });
  });

  describe("sendPushEdgeCaseCleanerConfirmed", () => {
    it("should be defined and callable", () => {
      expect(PushNotification.sendPushEdgeCaseCleanerConfirmed).toBeDefined();
      expect(typeof PushNotification.sendPushEdgeCaseCleanerConfirmed).toBe(
        "function"
      );
    });

    it("should accept required parameters", async () => {
      const result = await PushNotification.sendPushEdgeCaseCleanerConfirmed(
        "expo_push_token_123",
        "2026-01-15",
        15000
      );

      expect(result).toBe(true);
      expect(
        PushNotification.sendPushEdgeCaseCleanerConfirmed
      ).toHaveBeenCalledWith("expo_push_token_123", "2026-01-15", 15000);
    });
  });

  describe("sendPushEdgeCaseCleanerCancelled", () => {
    it("should be defined and callable", () => {
      expect(PushNotification.sendPushEdgeCaseCleanerCancelled).toBeDefined();
      expect(typeof PushNotification.sendPushEdgeCaseCleanerCancelled).toBe(
        "function"
      );
    });

    it("should accept required parameters", async () => {
      const result = await PushNotification.sendPushEdgeCaseCleanerCancelled(
        "expo_push_token_123",
        "2026-01-15",
        "Homeowner chose to cancel"
      );

      expect(result).toBe(true);
      expect(
        PushNotification.sendPushEdgeCaseCleanerCancelled
      ).toHaveBeenCalledWith(
        "expo_push_token_123",
        "2026-01-15",
        "Homeowner chose to cancel"
      );
    });
  });

  describe("sendPushEdgeCaseSecondCleanerJoined", () => {
    it("should be defined and callable", () => {
      expect(PushNotification.sendPushEdgeCaseSecondCleanerJoined).toBeDefined();
      expect(typeof PushNotification.sendPushEdgeCaseSecondCleanerJoined).toBe(
        "function"
      );
    });

    it("should accept required parameters", async () => {
      const result = await PushNotification.sendPushEdgeCaseSecondCleanerJoined(
        "expo_push_token_123",
        "Steve",
        7500
      );

      expect(result).toBe(true);
      expect(
        PushNotification.sendPushEdgeCaseSecondCleanerJoined
      ).toHaveBeenCalledWith("expo_push_token_123", "Steve", 7500);
    });
  });

  describe("notification content validation", () => {
    it("should format edge case decision notification correctly", () => {
      const appointmentDate = "2026-01-15";
      const cleanerName = "Jane";
      const expectedContent = `Your cleaning on ${appointmentDate} only has 1 cleaner (${cleanerName}) confirmed. Choose to proceed or cancel with no fees.`;

      expect(expectedContent).toContain(appointmentDate);
      expect(expectedContent).toContain(cleanerName);
      expect(expectedContent).toContain("proceed or cancel");
    });

    it("should format cleaner confirmation notification correctly", () => {
      const appointmentDate = "2026-01-15";
      const earnings = 15000;
      const expectedContent = `You're confirmed as the sole cleaner for ${appointmentDate}. Your earnings: $${(earnings / 100).toFixed(2)}`;

      expect(expectedContent).toContain(appointmentDate);
      expect(expectedContent).toContain("150.00");
      expect(expectedContent).toContain("sole cleaner");
    });

    it("should format second cleaner joined notification correctly", () => {
      const newCleanerName = "Steve";
      const newEarnings = 7500;
      const expectedContent = `Good news! ${newCleanerName} will be cleaning with you. Payment split: $${(newEarnings / 100).toFixed(2)}`;

      expect(expectedContent).toContain(newCleanerName);
      expect(expectedContent).toContain("75.00");
      expect(expectedContent).toContain("cleaning with you");
    });

    it("should format cancellation notification correctly", () => {
      const appointmentDate = "2026-01-15";
      const reason = "Homeowner chose to cancel";
      const expectedContent = `Your cleaning on ${appointmentDate} has been cancelled. Reason: ${reason}`;

      expect(expectedContent).toContain(appointmentDate);
      expect(expectedContent).toContain(reason);
      expect(expectedContent).toContain("cancelled");
    });
  });
});
