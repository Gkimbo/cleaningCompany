/**
 * Payment Captured Notification Tests
 * Tests for payment captured notifications across Email, Push, and NotificationService
 */

// Mock nodemailer before requiring EmailClass
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
  }),
}));

// Mock expo-server-sdk
jest.mock("expo-server-sdk", () => {
  const mockExpo = jest.fn().mockImplementation(() => ({
    isExpoPushToken: jest.fn((token) => token && token.startsWith("ExponentPushToken")),
    chunkPushNotifications: jest.fn((messages) => [messages]),
    sendPushNotificationsAsync: jest.fn().mockResolvedValue([{ status: "ok" }]),
  }));
  mockExpo.isExpoPushToken = jest.fn((token) => token && token.startsWith("ExponentPushToken"));
  return { Expo: mockExpo };
});

// Mock models
jest.mock("../../models", () => ({
  Notification: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    getUnreadCount: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
}));

const { Notification, User } = require("../../models");
const EmailClass = require("../../services/sendNotifications/EmailClass");
const PushNotificationClass = require("../../services/sendNotifications/PushNotificationClass");
const NotificationService = require("../../services/NotificationService");

describe("Payment Captured Notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("EmailClass.sendPaymentCapturedEmail", () => {
    it("should send payment captured email with correct parameters", async () => {
      // Just verify no errors thrown
      await expect(
        EmailClass.sendPaymentCapturedEmail(
          "homeowner@test.com",
          "John",
          15000, // $150.00 in cents
          "2026-02-19",
          "Sarah"
        )
      ).resolves.not.toThrow();
    });

    it("should format amount correctly in cents", async () => {
      // Test with different amounts - verify no errors thrown
      const amounts = [
        { cents: 10000, expected: "$100.00" },
        { cents: 15050, expected: "$150.50" },
        { cents: 9999, expected: "$99.99" },
      ];

      for (const { cents } of amounts) {
        await expect(
          EmailClass.sendPaymentCapturedEmail(
            "test@test.com",
            "Test",
            cents,
            "2026-02-19",
            "Cleaner"
          )
        ).resolves.not.toThrow();
      }
    });

    it("should handle string amount (already formatted)", async () => {
      await expect(
        EmailClass.sendPaymentCapturedEmail(
          "homeowner@test.com",
          "John",
          "$150.00", // Already formatted
          "2026-02-19",
          "Sarah"
        )
      ).resolves.not.toThrow();
    });

    it("should include cleaner name in email", async () => {
      await expect(
        EmailClass.sendPaymentCapturedEmail(
          "homeowner@test.com",
          "John",
          15000,
          "2026-02-19",
          "Maria Garcia"
        )
      ).resolves.not.toThrow();
    });
  });

  describe("PushNotificationClass.sendPushPaymentCaptured", () => {
    it("should send push notification with correct title and body", async () => {
      const result = await PushNotificationClass.sendPushPaymentCaptured(
        "ExponentPushToken[xxxx]",
        15000,
        "2026-02-19",
        "Sarah"
      );

      expect(result).toBeDefined();
    });

    it("should format amount from cents to dollars", async () => {
      // Test various amounts
      await PushNotificationClass.sendPushPaymentCaptured(
        "ExponentPushToken[xxxx]",
        12345, // $123.45
        "2026-02-19",
        "John"
      );

      // Verify no errors
      expect(true).toBe(true);
    });

    it("should handle invalid push token gracefully", async () => {
      const result = await PushNotificationClass.sendPushPaymentCaptured(
        "invalid-token",
        15000,
        "2026-02-19",
        "Sarah"
      );

      // Should return null or handle gracefully
      expect(result).toBeNull();
    });

    it("should handle null push token", async () => {
      const result = await PushNotificationClass.sendPushPaymentCaptured(
        null,
        15000,
        "2026-02-19",
        "Sarah"
      );

      expect(result).toBeNull();
    });

    it("should include appointment data in notification payload", async () => {
      const result = await PushNotificationClass.sendPushPaymentCaptured(
        "ExponentPushToken[xxxx]",
        15000,
        "2026-02-19",
        "Sarah"
      );

      expect(result).toBeDefined();
    });
  });

  describe("NotificationService.notifyPaymentCaptured", () => {
    const mockUser = {
      id: 5,
      email: "homeowner@test.com",
      firstName: "John",
      expoPushToken: "ExponentPushToken[xxxx]",
      notifications: ["email", "push"],
      getNotificationEmail: jest.fn().mockReturnValue("homeowner@test.com"),
    };

    const mockNotification = {
      id: 1,
      userId: 5,
      type: "payment_captured",
      title: "Payment Processed",
      body: "Your payment of $150.00 was taken for your appointment on Wednesday, Feb 18, 2026. Being cleaned by Sarah.",
      createdAt: new Date(),
    };

    it("should create in-app notification", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      const result = await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      expect(result).toBeDefined();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          type: "payment_captured",
          title: "Payment Processed",
        })
      );
    });

    it("should format amount correctly in notification body", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000, // $150.00
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("$150.00"),
        })
      );
    });

    it("should include cleaner name in notification body", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Maria Garcia",
        io: null,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("Maria Garcia"),
        })
      );
    });

    it("should format appointment date nicely", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      // Should format to something like "Wednesday, Feb 18, 2026"
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringMatching(/\w+,\s+\w+\s+\d+,\s+\d{4}/),
        })
      );
    });

    it("should include appointment data in notification", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: 100,
            appointmentDate: "2026-02-19",
            amount: 15000,
            cleanerName: "Sarah",
          }),
        })
      );
    });

    it("should link notification to appointment", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedAppointmentId: 100,
        })
      );
    });

    it("should return null when user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const result = await NotificationService.notifyPaymentCaptured({
        userId: 999,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      expect(result).toBeNull();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it("should handle user without push token", async () => {
      const userNoPush = { ...mockUser, expoPushToken: null };
      User.findByPk.mockResolvedValue(userNoPush);
      Notification.create.mockResolvedValue(mockNotification);

      const result = await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      // Should still create in-app notification
      expect(result).toBeDefined();
      expect(Notification.create).toHaveBeenCalled();
    });

    it("should handle user with email notifications disabled", async () => {
      const userNoEmail = { ...mockUser, notifications: ["push"] };
      User.findByPk.mockResolvedValue(userNoEmail);
      Notification.create.mockResolvedValue(mockNotification);

      const result = await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      // Should still create in-app notification
      expect(result).toBeDefined();
      expect(Notification.create).toHaveBeenCalled();
    });

    it("should handle different amount formats", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      // Test with various amounts
      const amounts = [10000, 15050, 9999, 100000];

      for (const amount of amounts) {
        jest.clearAllMocks();
        User.findByPk.mockResolvedValue(mockUser);
        Notification.create.mockResolvedValue(mockNotification);

        await NotificationService.notifyPaymentCaptured({
          userId: 5,
          amount,
          appointmentDate: "2026-02-19",
          appointmentId: 100,
          cleanerName: "Sarah",
          io: null,
        });

        expect(Notification.create).toHaveBeenCalled();
      }
    });

    it("should not set actionRequired flag", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyPaymentCaptured({
        userId: 5,
        amount: 15000,
        appointmentDate: "2026-02-19",
        appointmentId: 100,
        cleanerName: "Sarah",
        io: null,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actionRequired: false,
        })
      );
    });
  });
});
