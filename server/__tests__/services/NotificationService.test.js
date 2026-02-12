/**
 * NotificationService Tests
 * Tests for unified notification service including push, in-app, and email notifications
 */

// Mock the models
jest.mock("../../models", () => ({
  Notification: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    getUnreadCount: jest.fn(),
    destroy: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn(),
}));

// Mock Email
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmployeeJobAssigned: jest.fn(),
  sendPendingBookingEmail: jest.fn(),
  sendBookingAcceptedEmail: jest.fn(),
  sendBookingDeclinedEmail: jest.fn(),
  sendBookingExpiredEmail: jest.fn(),
  sendNewClientAppointmentEmail: jest.fn(),
}));

const { Notification, User } = require("../../models");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const Email = require("../../services/sendNotifications/EmailClass");
const NotificationService = require("../../services/NotificationService");

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createNotification", () => {
    it("should create an in-app notification", async () => {
      const mockNotification = {
        id: 1,
        userId: 5,
        type: "test_notification",
        title: "Test Title",
        body: "Test Body",
      };
      Notification.create.mockResolvedValue(mockNotification);

      const result = await NotificationService.createNotification({
        userId: 5,
        type: "test_notification",
        title: "Test Title",
        body: "Test Body",
        data: { key: "value" },
      });

      expect(result).toEqual(mockNotification);
      expect(Notification.create).toHaveBeenCalledWith({
        userId: 5,
        type: "test_notification",
        title: "Test Title",
        body: "Test Body",
        data: { key: "value" },
        actionRequired: false,
        relatedAppointmentId: null,
        relatedCleanerClientId: null,
        expiresAt: null,
      });
    });
  });

  describe("notifyUser", () => {
    const mockUser = {
      id: 5,
      email: "test@example.com",
      expoPushToken: "ExponentPushToken[xxx]",
      notifications: ["email", "push"],
      getNotificationEmail: jest.fn().mockReturnValue("test@example.com"),
    };

    const mockNotification = {
      id: 1,
      userId: 5,
      type: "test_type",
      title: "Test",
      body: "Test body",
      createdAt: new Date(),
    };

    it("should send push notification when user has push token", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyUser({
        userId: 5,
        type: "test_type",
        title: "Test",
        body: "Test body",
        sendPush: true,
        sendEmail: false,
      });

      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        mockUser.expoPushToken,
        "Test",
        "Test body",
        expect.objectContaining({ notificationId: 1, type: "test_type" })
      );
    });

    it("should not send push notification when user has no push token", async () => {
      const userNoPush = { ...mockUser, expoPushToken: null };
      User.findByPk.mockResolvedValue(userNoPush);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyUser({
        userId: 5,
        type: "test_type",
        title: "Test",
        body: "Test body",
        sendPush: true,
        sendEmail: false,
      });

      expect(PushNotification.sendPushNotification).not.toHaveBeenCalled();
    });

    it("should not send push notification when sendPush is false", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyUser({
        userId: 5,
        type: "test_type",
        title: "Test",
        body: "Test body",
        sendPush: false,
        sendEmail: false,
      });

      expect(PushNotification.sendPushNotification).not.toHaveBeenCalled();
    });

    it("should return null when user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const result = await NotificationService.notifyUser({
        userId: 999,
        type: "test_type",
        title: "Test",
        body: "Test body",
      });

      expect(result).toBeNull();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it("should send email when emailOptions provided and user has email notifications enabled", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      const mockSendFunction = jest.fn();

      await NotificationService.notifyUser({
        userId: 5,
        type: "test_type",
        title: "Test",
        body: "Test body",
        sendPush: false,
        sendEmail: true,
        emailOptions: {
          sendFunction: mockSendFunction,
          args: ["arg1", "arg2"],
        },
      });

      expect(mockSendFunction).toHaveBeenCalledWith("test@example.com", "arg1", "arg2");
    });

    it("should not send email when user has email notifications disabled", async () => {
      const userNoEmail = { ...mockUser, notifications: ["push"] };
      User.findByPk.mockResolvedValue(userNoEmail);
      Notification.create.mockResolvedValue(mockNotification);

      const mockSendFunction = jest.fn();

      await NotificationService.notifyUser({
        userId: 5,
        type: "test_type",
        title: "Test",
        body: "Test body",
        sendPush: false,
        sendEmail: true,
        emailOptions: {
          sendFunction: mockSendFunction,
          args: ["arg1", "arg2"],
        },
      });

      expect(mockSendFunction).not.toHaveBeenCalled();
    });
  });

  describe("notifyEmployeeJobAssigned", () => {
    const mockUser = {
      id: 5,
      email: "employee@test.com",
      expoPushToken: "ExponentPushToken[xxx]",
      notifications: ["email", "push"],
      getNotificationEmail: jest.fn().mockReturnValue("employee@test.com"),
    };

    const mockNotification = {
      id: 1,
      userId: 5,
      type: "employee_job_assigned",
      title: "New job assigned",
      body: "You've been assigned a cleaning on Friday, Feb 15, 2026 for $50.00.",
      createdAt: new Date(),
    };

    it("should send notification with correct job details", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyEmployeeJobAssigned({
        employeeUserId: 5,
        employeeName: "John",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        clientName: "Jane Doe",
        address: "123 Main St",
        payAmount: 5000,
        businessName: "Test Cleaning Co",
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          type: "employee_job_assigned",
          title: "New job assigned",
        })
      );

      expect(PushNotification.sendPushNotification).toHaveBeenCalled();
    });

    it("should include pay amount in notification body when provided", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyEmployeeJobAssigned({
        employeeUserId: 5,
        employeeName: "John",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        clientName: "Jane Doe",
        address: "123 Main St",
        payAmount: 7500,
        businessName: "Test Cleaning Co",
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("$75.00"),
        })
      );
    });

    it("should call email function with correct arguments", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyEmployeeJobAssigned({
        employeeUserId: 5,
        employeeName: "John",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        clientName: "Jane Doe",
        address: "123 Main St",
        payAmount: 5000,
        businessName: "Test Cleaning Co",
      });

      expect(Email.sendEmployeeJobAssigned).toHaveBeenCalledWith(
        "employee@test.com",
        "John",
        "2026-02-15",
        "Jane Doe",
        "123 Main St",
        5000,
        "Test Cleaning Co"
      );
    });

    it("should not send email when user has no email notifications enabled", async () => {
      const userNoEmail = { ...mockUser, notifications: ["push"] };
      User.findByPk.mockResolvedValue(userNoEmail);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyEmployeeJobAssigned({
        employeeUserId: 5,
        employeeName: "John",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        clientName: "Jane Doe",
        address: "123 Main St",
        payAmount: 5000,
        businessName: "Test Cleaning Co",
      });

      expect(Email.sendEmployeeJobAssigned).not.toHaveBeenCalled();
    });
  });

  describe("notifyEmployeeJobReassigned", () => {
    const mockUser = {
      id: 8,
      email: "old-employee@test.com",
      expoPushToken: "ExponentPushToken[yyy]",
      notifications: ["email", "push"],
      getNotificationEmail: jest.fn().mockReturnValue("old-employee@test.com"),
    };

    const mockNotification = {
      id: 2,
      userId: 8,
      type: "employee_job_reassigned",
      title: "Job reassigned",
      createdAt: new Date(),
    };

    it("should notify employee when their job is reassigned", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyEmployeeJobReassigned({
        employeeUserId: 8,
        appointmentId: 100,
        appointmentDate: "2026-02-20",
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 8,
          type: "employee_job_reassigned",
          title: "Job reassigned",
        })
      );

      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        mockUser.expoPushToken,
        "Job reassigned",
        expect.stringContaining("reassigned to another team member"),
        expect.any(Object)
      );
    });
  });

  describe("notifyEmployeePayChanged", () => {
    const mockUser = {
      id: 5,
      email: "employee@test.com",
      expoPushToken: "ExponentPushToken[xxx]",
      notifications: ["email", "push"],
      getNotificationEmail: jest.fn().mockReturnValue("employee@test.com"),
    };

    const mockNotification = {
      id: 3,
      userId: 5,
      type: "employee_pay_changed",
      title: "Pay updated",
      createdAt: new Date(),
    };

    it("should notify employee when their pay is changed", async () => {
      User.findByPk.mockResolvedValue(mockUser);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyEmployeePayChanged({
        employeeUserId: 5,
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        oldPay: 5000,
        newPay: 6000,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          type: "employee_pay_changed",
          title: "Pay updated",
          body: expect.stringContaining("$50.00"),
        })
      );

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("$60.00"),
        })
      );
    });
  });

  describe("notifyClientBookedAppointment", () => {
    const mockBusinessOwner = {
      id: 10,
      email: "owner@business.com",
      expoPushToken: "ExponentPushToken[owner]",
      notifications: ["email", "push"],
      getNotificationEmail: jest.fn().mockReturnValue("owner@business.com"),
    };

    const mockNotification = {
      id: 5,
      userId: 10,
      type: "client_booked_appointment",
      title: "New Client Appointment",
      body: "John Doe booked a cleaning for Saturday, Feb 15, 2026. Tap to view and assign.",
      createdAt: new Date(),
    };

    it("should notify business owner when client books appointment", async () => {
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyClientBookedAppointment({
        businessOwnerId: 10,
        clientId: 5,
        clientName: "John Doe",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        homeAddress: "123 Main St, Anytown",
        price: 15000,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          type: "client_booked_appointment",
          title: "New Client Appointment",
          actionRequired: true,
          relatedAppointmentId: 100,
        })
      );
    });

    it("should include client name in notification body", async () => {
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyClientBookedAppointment({
        businessOwnerId: 10,
        clientId: 5,
        clientName: "Jane Smith",
        appointmentId: 100,
        appointmentDate: "2026-02-20",
        homeAddress: "456 Oak Ave",
        price: 12000,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("Jane Smith"),
        })
      );
    });

    it("should include appointment data in notification", async () => {
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyClientBookedAppointment({
        businessOwnerId: 10,
        clientId: 5,
        clientName: "John Doe",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        homeAddress: "123 Main St",
        price: 15000,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: 100,
            appointmentDate: "2026-02-15",
            clientId: 5,
            clientName: "John Doe",
            homeAddress: "123 Main St",
            price: 15000,
          }),
        })
      );
    });

    it("should send push notification to business owner", async () => {
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyClientBookedAppointment({
        businessOwnerId: 10,
        clientId: 5,
        clientName: "John Doe",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        homeAddress: "123 Main St",
        price: 15000,
      });

      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        mockBusinessOwner.expoPushToken,
        "New Client Appointment",
        expect.stringContaining("John Doe"),
        expect.objectContaining({
          notificationId: 5,
          type: "client_booked_appointment",
        })
      );
    });

    it("should send email notification to business owner", async () => {
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyClientBookedAppointment({
        businessOwnerId: 10,
        clientId: 5,
        clientName: "John Doe",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        homeAddress: "123 Main St",
        price: 15000,
      });

      expect(Email.sendNewClientAppointmentEmail).toHaveBeenCalledWith(
        "owner@business.com",
        "2026-02-15",
        "John Doe",
        "123 Main St",
        15000,
        100
      );
    });

    it("should not send push when business owner has no push token", async () => {
      const ownerNoPush = { ...mockBusinessOwner, expoPushToken: null };
      User.findByPk.mockResolvedValue(ownerNoPush);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyClientBookedAppointment({
        businessOwnerId: 10,
        clientId: 5,
        clientName: "John Doe",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        homeAddress: "123 Main St",
        price: 15000,
      });

      expect(PushNotification.sendPushNotification).not.toHaveBeenCalled();
    });

    it("should set actionRequired to true for assignment", async () => {
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      Notification.create.mockResolvedValue(mockNotification);

      await NotificationService.notifyClientBookedAppointment({
        businessOwnerId: 10,
        clientId: 5,
        clientName: "John Doe",
        appointmentId: 100,
        appointmentDate: "2026-02-15",
        homeAddress: "123 Main St",
        price: 15000,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actionRequired: true,
        })
      );
    });
  });
});
