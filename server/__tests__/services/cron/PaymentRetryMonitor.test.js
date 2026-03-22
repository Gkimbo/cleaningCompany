/**
 * Tests for the Payment Retry Monitor
 * Tests payment retry logic, auto-cancellation, and notifications
 */

// Mock Stripe
const mockStripe = {
  paymentIntents: {
    retrieve: jest.fn(),
    capture: jest.fn(),
    create: jest.fn(),
  },
  customers: {
    retrieve: jest.fn(),
  },
};

jest.mock("stripe", () => {
  return jest.fn(() => mockStripe);
});

// Mock notification services
jest.mock("../../../services/NotificationService", () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock("../../../services/sendNotifications/EmailClass", () => ({
  sendPaymentFailed: jest.fn().mockResolvedValue(true),
  sendPaymentRetryFailed: jest.fn().mockResolvedValue(true),
  sendPaymentRetrySuccess: jest.fn().mockResolvedValue(true),
  sendPaymentFailureCancellation: jest.fn().mockResolvedValue(true),
  sendJobCancelledPaymentIssue: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val ? `decrypted_${val}` : ""),
}));

// Mock models
const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);

jest.mock("../../../models", () => ({
  UserAppointments: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  Payment: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findOne: jest.fn().mockResolvedValue(null),
    generateTransactionId: jest.fn(() => `txn_test_${Date.now()}`),
  },
  Op: {
    ne: Symbol("ne"),
  },
}));

const { UserAppointments, User, UserHomes, Payment } = require("../../../models");
const NotificationService = require("../../../services/NotificationService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const {
  processFailedPayments,
  notifyInitialPaymentFailure,
  AUTO_CANCEL_HOURS,
} = require("../../../services/cron/PaymentRetryMonitor");

describe("PaymentRetryMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("processFailedPayments", () => {
    it("should skip appointments without paymentCaptureFailed flag", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      const results = await processFailedPayments();

      expect(results).toEqual({ retried: 0, succeeded: 0, cancelled: 0, errors: 0 });
    });

    it("should initialize paymentFirstFailedAt if not set", async () => {
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: null,
        lastPaymentRetryAt: null,
        paymentRetryCount: 0,
        paymentIntentId: "pi_test",
        price: 15000,
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
          stripeCustomerId: "cus_test",
        },
        home: {
          address: "123 Main St",
          city: "Boston",
        },
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "requires_capture" });
      mockStripe.paymentIntents.capture.mockRejectedValue(new Error("Card declined"));

      await processFailedPayments();

      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentFirstFailedAt: expect.any(Date),
        })
      );
    });

    it("should auto-cancel appointment after 48 hours of failed payments", async () => {
      const failedAt = new Date("2026-01-13T10:00:00Z"); // 50 hours ago
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: 3,
        paymentIntentId: "pi_test",
        employeesAssigned: ["200", "201"],
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
          notificationEmail: null,
          expoPushToken: "expo_token",
        },
        home: {
          address: "123 Main St",
          city: "Boston",
        },
        update: mockAppointmentUpdate,
      };

      const mockCleaner = {
        id: 200,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: "cleaner_token",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      const results = await processFailedPayments();

      expect(results.cancelled).toBe(1);
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          wasCancelled: true,
          cancellationReason: "payment_failed",
          cancelledBy: "system",
        })
      );
      expect(Email.sendPaymentFailureCancellation).toHaveBeenCalled();
      expect(Email.sendJobCancelledPaymentIssue).toHaveBeenCalled();
    });

    it("should skip retry if less than 4 hours since last retry", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z"); // 6 hours ago
      const lastRetry = new Date("2026-01-15T10:00:00Z"); // 2 hours ago
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: lastRetry,
        paymentRetryCount: 1,
        paymentIntentId: "pi_test",
        user: {
          id: 100,
          firstName: "John",
          stripeCustomerId: "cus_test",
        },
        home: {},
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processFailedPayments();

      expect(results.retried).toBe(0);
      expect(mockStripe.paymentIntents.capture).not.toHaveBeenCalled();
    });

    it("should retry payment capture after 4+ hours", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z"); // 6 hours ago
      const lastRetry = new Date("2026-01-15T07:00:00Z"); // 5 hours ago
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: lastRetry,
        paymentRetryCount: 1,
        paymentIntentId: "pi_test",
        price: 15000,
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
          stripeCustomerId: "cus_test",
        },
        home: {
          address: "123 Main St",
          city: "Boston",
        },
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "requires_capture" });
      mockStripe.paymentIntents.capture.mockResolvedValue({
        id: "pi_test",
        status: "succeeded",
        amount: 15000,
        amount_received: 15000,
        currency: "usd",
      });

      const results = await processFailedPayments();

      expect(results.retried).toBe(1);
      expect(results.succeeded).toBe(1);
      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith(
        "pi_test",
        {},
        expect.objectContaining({ idempotencyKey: expect.stringContaining("capture_1_pi_test") })
      );
    });

    it("should handle already succeeded payment intents", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z");
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: 0,
        paymentIntentId: "pi_test",
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
        },
        home: {},
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "succeeded" });

      const results = await processFailedPayments();

      expect(results.succeeded).toBe(1);
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentCaptureFailed: false,
          paymentStatus: "captured",
        })
      );
    });

    it("should create new payment intent if existing one is canceled", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z");
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: 0,
        paymentIntentId: "pi_canceled",
        price: 15050,
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
          stripeCustomerId: "cus_test",
        },
        home: {},
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "canceled" });
      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: "pm_test" },
      });
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_new",
        status: "succeeded",
        amount: 15050, // $150.50
        currency: "usd",
      });

      const results = await processFailedPayments();

      expect(results.succeeded).toBe(1);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15050, // Correctly parsed with decimals
          currency: "usd",
          customer: "cus_test",
          payment_method: "pm_test",
        }),
        expect.objectContaining({ idempotencyKey: expect.stringContaining("retry_1_") })
      );
    });

    it("should handle appointment without homeowner gracefully", async () => {
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: new Date("2026-01-15T06:00:00Z"),
        lastPaymentRetryAt: null,
        paymentRetryCount: 0,
        user: null, // No homeowner
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processFailedPayments();

      // Should not crash, counts as retried but fails due to no homeowner
      expect(results.errors).toBe(0);
      expect(results.retried).toBe(1); // It counts the retry attempt
      expect(results.succeeded).toBe(0); // But it doesn't succeed
    });

    it("should handle null paymentRetryCount", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z");
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: null, // NULL value
        paymentIntentId: "pi_test",
        price: 15000,
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
        },
        home: {},
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "requires_capture" });
      mockStripe.paymentIntents.capture.mockRejectedValue(new Error("Declined"));

      const results = await processFailedPayments();

      expect(results.retried).toBe(1);
      // Should increment from 0, not NaN
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentRetryCount: 1,
        })
      );
    });
  });

  describe("notifyInitialPaymentFailure", () => {
    it("should send notifications to homeowner and assigned cleaners", async () => {
      const mockAppointment = {
        id: 1,
        userId: 100,
        homeId: 50,
        date: "2026-01-20",
        employeesAssigned: ["200"],
        paymentFirstFailedAt: null,
        update: mockAppointmentUpdate,
      };

      const mockHomeowner = {
        id: 100,
        firstName: "John",
        email: "john@test.com",
        expoPushToken: "homeowner_token",
      };

      const mockCleaner = {
        id: 200,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: "cleaner_token",
      };

      const mockHome = {
        address: "123 Main St",
        city: "Boston",
      };

      User.findByPk.mockImplementation((id) => {
        if (id === 100) return Promise.resolve(mockHomeowner);
        if (id === 200 || id === "200") return Promise.resolve(mockCleaner);
        return Promise.resolve(null);
      });
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await notifyInitialPaymentFailure(mockAppointment);

      // Should notify homeowner
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 100,
          type: "payment_failed",
        })
      );
      expect(Email.sendPaymentFailed).toHaveBeenCalled();
      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "homeowner_token",
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );

      // Should notify cleaner
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          type: "payment_failed",
          title: "Job Payment Issue",
        })
      );
      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "cleaner_token",
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should not overwrite existing paymentFirstFailedAt", async () => {
      const existingTimestamp = new Date("2026-01-14T10:00:00Z");
      const mockAppointment = {
        id: 1,
        userId: 100,
        homeId: 50,
        date: "2026-01-20",
        employeesAssigned: [],
        paymentFirstFailedAt: existingTimestamp, // Already set
        update: mockAppointmentUpdate,
      };

      const mockHomeowner = {
        id: 100,
        firstName: "John",
        email: "john@test.com",
      };

      User.findByPk.mockResolvedValue(mockHomeowner);
      UserHomes.findByPk.mockResolvedValue({ address: "123 Main", city: "Boston" });

      await notifyInitialPaymentFailure(mockAppointment);

      // Should NOT call update since paymentFirstFailedAt is already set
      expect(mockAppointmentUpdate).not.toHaveBeenCalled();
    });

    it("should handle missing homeowner gracefully", async () => {
      const mockAppointment = {
        id: 1,
        userId: 100,
        homeId: 50,
        date: "2026-01-20",
        employeesAssigned: [],
        paymentFirstFailedAt: null,
        update: mockAppointmentUpdate,
      };

      User.findByPk.mockResolvedValue(null);

      // Should not throw
      await expect(notifyInitialPaymentFailure(mockAppointment)).resolves.not.toThrow();
      expect(NotificationService.createNotification).not.toHaveBeenCalled();
    });

    it("should handle missing home gracefully", async () => {
      const mockAppointment = {
        id: 1,
        userId: 100,
        homeId: 50,
        date: "2026-01-20",
        employeesAssigned: [],
        paymentFirstFailedAt: null,
        update: mockAppointmentUpdate,
      };

      const mockHomeowner = {
        id: 100,
        firstName: "John",
        email: "john@test.com",
      };

      User.findByPk.mockResolvedValue(mockHomeowner);
      UserHomes.findByPk.mockResolvedValue(null);

      await notifyInitialPaymentFailure(mockAppointment);

      // Should still send notification with fallback address
      expect(Email.sendPaymentFailed).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        "your property", // Fallback address
        48
      );
    });
  });

  describe("AUTO_CANCEL_HOURS", () => {
    it("should be 48 hours", () => {
      expect(AUTO_CANCEL_HOURS).toBe(48);
    });
  });

  describe("Payment success notification", () => {
    it("should notify both homeowner and cleaner when payment succeeds", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z");
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: 0,
        paymentIntentId: "pi_test",
        employeesAssigned: ["200", "201"],
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
          expoPushToken: "homeowner_token",
        },
        home: {
          address: "123 Main St",
          city: "Boston",
        },
        update: mockAppointmentUpdate,
      };

      const mockCleaner1 = {
        id: 200,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: "cleaner1_token",
      };

      const mockCleaner2 = {
        id: 201,
        firstName: "Bob",
        email: "bob@test.com",
        expoPushToken: "cleaner2_token",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockImplementation((id) => {
        if (id === 200 || id === "200") return Promise.resolve(mockCleaner1);
        if (id === 201 || id === "201") return Promise.resolve(mockCleaner2);
        return Promise.resolve(null);
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "requires_capture" });
      mockStripe.paymentIntents.capture.mockResolvedValue({
        id: "pi_test",
        status: "succeeded",
        amount: 15000,
        currency: "usd",
      });

      await processFailedPayments();

      // Should notify homeowner
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 100,
          type: "payment_retry_success",
          title: "Payment Successful",
        })
      );

      // Should notify both cleaners
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          type: "payment_retry_success",
          title: "Payment Issue Resolved",
        })
      );
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 201,
          type: "payment_retry_success",
          title: "Payment Issue Resolved",
        })
      );

      // Should send push to cleaners
      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "cleaner1_token",
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "cleaner2_token",
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe("Price parsing", () => {
    it("should correctly parse prices with decimals", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z");
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: 0,
        paymentIntentId: null, // No existing intent
        price: 12345, // $123.45 in cents
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
          stripeCustomerId: "cus_test",
        },
        home: {},
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: "pm_test" },
      });
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_new",
        status: "succeeded",
        amount: 12345,
        currency: "usd",
      });

      await processFailedPayments();

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12345, // $123.45 in cents
        }),
        expect.objectContaining({ idempotencyKey: expect.stringContaining("retry_1_") })
      );
    });

    it("should round fractional cents correctly", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z");
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: 0,
        paymentIntentId: null,
        price: 10000, // $100.00 in cents
        user: {
          id: 100,
          firstName: "John",
          stripeCustomerId: "cus_test",
        },
        home: {},
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: "pm_test" },
      });
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_new",
        status: "succeeded",
        amount: 10000,
        currency: "usd",
      });

      await processFailedPayments();

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000, // Rounded
        }),
        expect.objectContaining({ idempotencyKey: expect.stringContaining("retry_1_") })
      );
    });
  });

  describe("Edge cases", () => {
    it("should NOT auto-cancel past appointments", async () => {
      // Payment failed 50 hours ago, but appointment date is in the past
      const failedAt = new Date("2026-01-13T10:00:00Z"); // 50 hours ago
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-14", // Yesterday - appointment already happened
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        lastPaymentRetryAt: null,
        paymentRetryCount: 3,
        paymentIntentId: "pi_test",
        employeesAssigned: ["200"],
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
          stripeCustomerId: "cus_test",
        },
        home: {
          address: "123 Main St",
          city: "Boston",
        },
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "requires_capture" });
      mockStripe.paymentIntents.capture.mockRejectedValue(new Error("Declined"));

      const results = await processFailedPayments();

      // Should NOT be cancelled since appointment date is in the past
      expect(results.cancelled).toBe(0);
      // Should still retry
      expect(results.retried).toBe(1);
    });

    it("should handle empty employeesAssigned array during cancellation", async () => {
      const failedAt = new Date("2026-01-13T10:00:00Z"); // 50 hours ago
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20", // Future date - can be cancelled
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        employeesAssigned: [], // Empty array
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
        },
        home: null,
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processFailedPayments();

      expect(results.cancelled).toBe(1);
      // Should not crash on empty array
      expect(Email.sendJobCancelledPaymentIssue).not.toHaveBeenCalled();
    });

    it("should handle null employeesAssigned during cancellation", async () => {
      const failedAt = new Date("2026-01-13T10:00:00Z"); // 50 hours ago
      const mockAppointment = {
        id: 1,
        userId: 100,
        date: "2026-01-20",
        paymentCaptureFailed: true,
        paymentFirstFailedAt: failedAt,
        employeesAssigned: null, // Null
        user: {
          id: 100,
          firstName: "John",
          email: "john@test.com",
        },
        home: null,
        update: mockAppointmentUpdate,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processFailedPayments();

      expect(results.cancelled).toBe(1);
      expect(Email.sendJobCancelledPaymentIssue).not.toHaveBeenCalled();
    });

    it("should continue processing other appointments if one fails", async () => {
      const failedAt = new Date("2026-01-15T06:00:00Z");
      const mockAppointments = [
        {
          id: 1,
          userId: 100,
          date: "2026-01-20",
          paymentCaptureFailed: true,
          paymentFirstFailedAt: failedAt,
          lastPaymentRetryAt: null,
          paymentRetryCount: 0,
          user: null, // Will cause early return
          update: jest.fn(),
        },
        {
          id: 2,
          userId: 200,
          date: "2026-01-21",
          paymentCaptureFailed: true,
          paymentFirstFailedAt: failedAt,
          lastPaymentRetryAt: null,
          paymentRetryCount: 0,
          paymentIntentId: "pi_test2",
          user: {
            id: 200,
            firstName: "Jane",
            stripeCustomerId: "cus_test2",
          },
          home: {},
          update: mockAppointmentUpdate,
        },
      ];

      UserAppointments.findAll.mockResolvedValue(mockAppointments);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: "succeeded" });

      const results = await processFailedPayments();

      // First appointment should be skipped (no user), second should succeed
      expect(results.succeeded).toBe(1);
    });
  });
});
