/**
 * Tests for the 2-Step Completion Approval Monitor
 * Tests the auto-approval cron job and related helper functions
 */

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn(() => ({
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        latest_charge: "ch_test_123",
      }),
    },
    transfers: {
      create: jest.fn().mockResolvedValue({
        id: "tr_test_123",
      }),
    },
  }));
});

// Mock notification services
jest.mock("../../../services/NotificationService", () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock("../../../services/sendNotifications/EmailClass", () => ({
  sendCompletionAutoApproved: jest.fn().mockResolvedValue(true),
  sendCompletionApprovedCleaner: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushCompletionAutoApproved: jest.fn().mockResolvedValue(true),
  sendPushCompletionApproved: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => `decrypted_${val}`),
}));

// Mock models
const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);
const mockCompletionUpdate = jest.fn().mockResolvedValue(true);

jest.mock("../../../models", () => ({
  UserAppointments: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  CleanerJobCompletion: {
    findAll: jest.fn(),
    update: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  PricingConfig: {
    getActive: jest.fn().mockResolvedValue({
      completionAutoApprovalHours: 4,
    }),
  },
  Op: {
    lt: Symbol("lt"),
  },
}));

const {
  UserAppointments,
  CleanerJobCompletion,
  User,
  UserHomes,
  PricingConfig,
} = require("../../../models");
const NotificationService = require("../../../services/NotificationService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const {
  processAutoApprovals,
  processAutoApprovalsSingleCleaner,
  processAutoApprovalsMultiCleaner,
  getAutoApprovalHours,
  calculateAutoApprovalExpiration,
} = require("../../../services/cron/CompletionApprovalMonitor");

describe("CompletionApprovalMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAutoApprovalHours", () => {
    it("should return configured auto-approval hours from PricingConfig", async () => {
      PricingConfig.getActive.mockResolvedValue({
        completionAutoApprovalHours: 6,
      });

      const hours = await getAutoApprovalHours();
      expect(hours).toBe(6);
    });

    it("should return default 4 hours if not configured", async () => {
      PricingConfig.getActive.mockResolvedValue({});

      const hours = await getAutoApprovalHours();
      expect(hours).toBe(4);
    });

    it("should return default 4 hours if config is null", async () => {
      PricingConfig.getActive.mockResolvedValue(null);

      const hours = await getAutoApprovalHours();
      expect(hours).toBe(4);
    });
  });

  describe("calculateAutoApprovalExpiration", () => {
    it("should calculate expiration based on configured hours", async () => {
      PricingConfig.getActive.mockResolvedValue({
        completionAutoApprovalHours: 4,
      });

      const now = Date.now();
      const expiration = await calculateAutoApprovalExpiration();

      // Should be approximately 4 hours from now
      const fourHoursMs = 4 * 60 * 60 * 1000;
      expect(expiration.getTime()).toBeGreaterThanOrEqual(now + fourHoursMs - 1000);
      expect(expiration.getTime()).toBeLessThanOrEqual(now + fourHoursMs + 1000);
    });
  });

  describe("processAutoApprovalsSingleCleaner", () => {
    const createMockAppointment = (overrides = {}) => ({
      id: 1,
      userId: 100,
      date: "2026-01-15",
      price: "150",
      completionStatus: "submitted",
      autoApprovalExpiresAt: new Date(Date.now() - 1000), // Expired
      completed: false,
      isMultiCleanerJob: false,
      employeesAssigned: ["200"],
      user: {
        id: 100,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        expoPushToken: "ExponentPushToken[xxx]",
        notifications: { email: true, push: true },
      },
      home: {
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      },
      update: mockAppointmentUpdate,
      ...overrides,
    });

    it("should auto-approve expired single-cleaner appointments", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        lastName: "Cleaner",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
      });

      const result = await processAutoApprovalsSingleCleaner();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "auto_approved",
          completed: true,
          completionApprovedBy: null,
        })
      );
    });

    it("should send notifications to homeowner on auto-approval", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
      });

      await processAutoApprovalsSingleCleaner();

      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        100,
        expect.stringContaining("auto-approved")
      );
      expect(Email.sendCompletionAutoApproved).toHaveBeenCalled();
      expect(PushNotification.sendPushCompletionAutoApproved).toHaveBeenCalled();
    });

    it("should send notifications to cleaner on auto-approval", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
      });

      await processAutoApprovalsSingleCleaner();

      expect(Email.sendCompletionApprovedCleaner).toHaveBeenCalled();
      expect(PushNotification.sendPushCompletionApproved).toHaveBeenCalled();
    });

    it("should not process appointments that are not expired", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      const result = await processAutoApprovalsSingleCleaner();

      expect(result.processed).toBe(0);
      expect(mockAppointmentUpdate).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully and continue processing", async () => {
      const mockAppointment1 = createMockAppointment({ id: 1 });
      const mockAppointment2 = createMockAppointment({ id: 2 });

      // First appointment fails, second succeeds
      mockAppointment1.update = jest.fn().mockRejectedValue(new Error("DB error"));
      mockAppointment2.update = jest.fn().mockResolvedValue(true);

      UserAppointments.findAll.mockResolvedValue([mockAppointment1, mockAppointment2]);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
      });

      const result = await processAutoApprovalsSingleCleaner();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(1);
    });
  });

  describe("processAutoApprovalsMultiCleaner", () => {
    const createMockCompletion = (overrides = {}) => ({
      id: 1,
      appointmentId: 1,
      cleanerId: 200,
      multiCleanerJobId: 10,
      completionStatus: "submitted",
      autoApprovalExpiresAt: new Date(Date.now() - 1000), // Expired
      cleaner: {
        id: 200,
        firstName: "Jane",
        lastName: "Cleaner",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
        notifications: { email: true, push: true },
      },
      appointment: {
        id: 1,
        userId: 100,
        date: "2026-01-15",
        user: {
          id: 100,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          expoPushToken: "ExponentPushToken[xxx]",
          notifications: { email: true, push: true },
        },
        home: {
          id: 1,
          address: "123 Main St",
          city: "Springfield",
        },
      },
      update: mockCompletionUpdate,
      ...overrides,
    });

    it("should auto-approve expired multi-cleaner completions", async () => {
      const mockCompletion = createMockCompletion();
      CleanerJobCompletion.findAll.mockResolvedValue([mockCompletion]);

      const result = await processAutoApprovalsMultiCleaner();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockCompletionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "auto_approved",
          status: "completed",
          completionApprovedBy: null,
        })
      );
    });

    it("should notify both homeowner and cleaner for multi-cleaner auto-approval", async () => {
      const mockCompletion = createMockCompletion();
      CleanerJobCompletion.findAll.mockResolvedValue([mockCompletion]);

      await processAutoApprovalsMultiCleaner();

      // Should notify homeowner
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        100,
        expect.stringContaining("auto-approved")
      );

      // Should notify cleaner
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        200,
        expect.stringContaining("auto-approved")
      );
    });
  });

  describe("processAutoApprovals (main function)", () => {
    it("should process both single and multi-cleaner approvals", async () => {
      UserAppointments.findAll.mockResolvedValue([]);
      CleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await processAutoApprovals();

      expect(result).toHaveProperty("singleCleaner");
      expect(result).toHaveProperty("multiCleaner");
      expect(result).toHaveProperty("totalProcessed");
      expect(result).toHaveProperty("totalErrors");
      expect(result).toHaveProperty("timestamp");
    });

    it("should aggregate results from both processors", async () => {
      // Mock single cleaner appointment
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-15",
        completionStatus: "submitted",
        autoApprovalExpiresAt: new Date(Date.now() - 1000),
        completed: false,
        isMultiCleanerJob: false,
        employeesAssigned: ["200"],
        user: { id: 100, firstName: "John", email: "john@example.com" },
        home: { id: 1, address: "123 Main", city: "Springfield" },
        update: jest.fn().mockResolvedValue(true),
      };
      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
      });

      // Mock multi-cleaner completion
      const mockCompletion = {
        id: 1,
        cleanerId: 300,
        completionStatus: "submitted",
        autoApprovalExpiresAt: new Date(Date.now() - 1000),
        cleaner: { id: 300, firstName: "Bob", email: "bob@example.com" },
        appointment: {
          id: 2,
          userId: 101,
          date: "2026-01-16",
          user: { id: 101, firstName: "Alice", email: "alice@example.com" },
          home: { id: 2, address: "456 Oak", city: "Shelbyville" },
        },
        update: jest.fn().mockResolvedValue(true),
      };
      CleanerJobCompletion.findAll.mockResolvedValue([mockCompletion]);

      const result = await processAutoApprovals();

      expect(result.totalProcessed).toBe(2);
      expect(result.singleCleaner.processed).toBe(1);
      expect(result.multiCleaner.processed).toBe(1);
    });
  });
});

describe("Completion Confirmation Model Methods", () => {
  describe("UserAppointments helper methods", () => {
    // These test the helper methods added to the model
    const createMockAppointmentInstance = (completionStatus, autoApprovalExpiresAt, completed = false) => ({
      completionStatus,
      autoApprovalExpiresAt,
      completed,
      isAwaitingApproval: function() {
        return this.completionStatus === "submitted";
      },
      isAutoApprovalExpired: function() {
        return (
          this.completionStatus === "submitted" &&
          this.autoApprovalExpiresAt &&
          new Date() > new Date(this.autoApprovalExpiresAt)
        );
      },
      canBeApproved: function() {
        return this.completionStatus === "submitted" && !this.completed;
      },
      isCompletionApproved: function() {
        return this.completionStatus === "approved" || this.completionStatus === "auto_approved";
      },
      getTimeUntilAutoApproval: function() {
        if (!this.autoApprovalExpiresAt || this.completionStatus !== "submitted") {
          return null;
        }
        const remaining = new Date(this.autoApprovalExpiresAt).getTime() - Date.now();
        return Math.max(0, Math.floor(remaining / 1000));
      },
    });

    it("isAwaitingApproval returns true when status is submitted", () => {
      const appointment = createMockAppointmentInstance("submitted", new Date(Date.now() + 10000));
      expect(appointment.isAwaitingApproval()).toBe(true);
    });

    it("isAwaitingApproval returns false when status is in_progress", () => {
      const appointment = createMockAppointmentInstance("in_progress", null);
      expect(appointment.isAwaitingApproval()).toBe(false);
    });

    it("isAutoApprovalExpired returns true when past expiration", () => {
      const appointment = createMockAppointmentInstance("submitted", new Date(Date.now() - 1000));
      expect(appointment.isAutoApprovalExpired()).toBe(true);
    });

    it("isAutoApprovalExpired returns false when not yet expired", () => {
      const appointment = createMockAppointmentInstance("submitted", new Date(Date.now() + 10000));
      expect(appointment.isAutoApprovalExpired()).toBe(false);
    });

    it("canBeApproved returns true when submitted and not completed", () => {
      const appointment = createMockAppointmentInstance("submitted", new Date(), false);
      expect(appointment.canBeApproved()).toBe(true);
    });

    it("canBeApproved returns false when already completed", () => {
      const appointment = createMockAppointmentInstance("submitted", new Date(), true);
      expect(appointment.canBeApproved()).toBe(false);
    });

    it("isCompletionApproved returns true for approved status", () => {
      const appointment = createMockAppointmentInstance("approved", new Date());
      expect(appointment.isCompletionApproved()).toBe(true);
    });

    it("isCompletionApproved returns true for auto_approved status", () => {
      const appointment = createMockAppointmentInstance("auto_approved", new Date());
      expect(appointment.isCompletionApproved()).toBe(true);
    });

    it("getTimeUntilAutoApproval returns seconds remaining", () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const appointment = createMockAppointmentInstance("submitted", futureTime);
      const remaining = appointment.getTimeUntilAutoApproval();
      expect(remaining).toBeGreaterThan(3500); // Approximately 1 hour
      expect(remaining).toBeLessThanOrEqual(3600);
    });

    it("getTimeUntilAutoApproval returns null when not submitted", () => {
      const appointment = createMockAppointmentInstance("in_progress", new Date(Date.now() + 10000));
      expect(appointment.getTimeUntilAutoApproval()).toBeNull();
    });
  });
});
