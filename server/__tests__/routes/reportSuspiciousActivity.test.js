const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Socket.io
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// Mock models
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  Message: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  Conversation: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  ConversationParticipant: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    findOrCreate: jest.fn(),
  },
  MessageReaction: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  MessageReadReceipt: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
    findOrCreate: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
  },
  UserHomes: {
    findOne: jest.fn(),
  },
  SuspiciousActivityReport: {
    findOne: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewMessageNotification: jest.fn().mockResolvedValue(true),
  sendBroadcastNotification: jest.fn().mockResolvedValue(true),
  sendSuspiciousActivityReport: jest.fn().mockResolvedValue(true),
}));

// Mock Push Notification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNewMessage: jest.fn().mockResolvedValue(true),
  sendPushBroadcast: jest.fn().mockResolvedValue(true),
  sendPushReaction: jest.fn().mockResolvedValue(true),
  sendPushSuspiciousActivityReport: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  Message,
  Conversation,
  ConversationParticipant,
  SuspiciousActivityReport,
} = require("../../models");

const EmailService = require("../../services/sendNotifications/EmailClass");
const PushNotificationService = require("../../services/sendNotifications/PushNotificationClass");

describe("Report Suspicious Activity API", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.set("io", mockIo);

    const messageRouter = require("../../routes/api/v1/messageRouter");
    app.use("/api/v1/messages", messageRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /:messageId/report-suspicious", () => {
    it("should successfully report a suspicious message", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      // Message exists with suspicious content
      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointmentId: 100,
        },
        sender: {
          id: 1,
          username: "johnsmith",
          firstName: "John",
          lastName: "Smith",
          type: "cleaner",
        },
      });

      // User is a participant (recipient)
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 2,
      });

      // Conversation is an appointment type
      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
      });

      // No existing report
      SuspiciousActivityReport.findOne.mockResolvedValue(null);

      // Create the report
      SuspiciousActivityReport.create.mockResolvedValue({
        id: 1,
        messageId: 1,
        reporterId: 2,
        reportedUserId: 1,
        conversationId: 1,
        appointmentId: 100,
        suspiciousContentTypes: ["phone_number"],
        messageContent: "Call me at 123-456-7890",
        status: "pending",
      });

      // Reporter and reported user info
      User.findByPk.mockImplementation((id) => {
        if (id === 2) {
          return Promise.resolve({
            id: 2,
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@example.com",
            username: "janedoe",
          });
        }
        return Promise.resolve({
          id: 1,
          firstName: "John",
          lastName: "Smith",
          email: "john@example.com",
          username: "johnsmith",
        });
      });

      // HR/Owner users for email notification
      User.findAll.mockResolvedValue([
        {
          id: 10,
          email: "hr@example.com",
          firstName: "HR",
          lastName: "Manager",
          role: "HR",
        },
        {
          id: 11,
          email: "owner@example.com",
          firstName: "Business",
          lastName: "Owner",
          role: "owner",
        },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Report submitted successfully");

      // Verify report was created
      expect(SuspiciousActivityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 1,
          reporterId: 2,
          reportedUserId: 1,
          conversationId: 1,
          appointmentId: 100,
        })
      );

      // Verify email was sent
      expect(EmailService.sendSuspiciousActivityReport).toHaveBeenCalled();
    });

    it("should return 409 if message was already reported by this user", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 2,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
      });

      // Already reported
      SuspiciousActivityReport.findOne.mockResolvedValue({
        id: 1,
        messageId: 1,
        reporterId: 2,
      });

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already reported");
    });

    it("should return 404 if message does not exist", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      Message.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/999/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("should return 403 if user is not a participant in the conversation", async () => {
      const token = jwt.sign({ userId: 3 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
      });

      // User is NOT a participant
      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Not authorized");
    });

    it("should return 400 if user tries to report their own message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1, // Same as reporter
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("own message");
    });

    it("should return 400 if message is not flagged as suspicious", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "See you tomorrow!",
        hasSuspiciousContent: false,
        suspiciousContentTypes: [],
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 2,
      });

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("not flagged as suspicious");
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).post("/api/v1/messages/1/report-suspicious");

      expect(res.status).toBe(401);
    });

    it("should send push notifications to HR and Owner with push tokens", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      // Message with suspicious content
      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointmentId: 100,
        },
        sender: {
          id: 1,
          username: "cleaner1",
          firstName: "Jane",
          lastName: "Cleaner",
          type: "cleaner",
        },
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 2,
      });

      SuspiciousActivityReport.findOne.mockResolvedValue(null);

      SuspiciousActivityReport.create.mockResolvedValue({
        id: 1,
        messageId: 1,
        reporterId: 2,
        reportedUserId: 1,
        status: "pending",
      });

      // Mock pending count
      SuspiciousActivityReport.count.mockResolvedValue(5);

      User.findByPk.mockResolvedValue({
        id: 2,
        firstName: "John",
        lastName: "Client",
        username: "client1",
        type: "homeowner",
      });

      // HR/Owner with push tokens
      User.findAll.mockResolvedValue([
        {
          id: 10,
          email: "hr@example.com",
          firstName: "HR",
          lastName: "Manager",
          type: "humanResources",
          expoPushToken: "ExponentPushToken[hrtoken123]",
        },
        {
          id: 11,
          email: "owner@example.com",
          firstName: "Business",
          lastName: "Owner",
          type: "owner",
          expoPushToken: "ExponentPushToken[ownertoken456]",
        },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(201);

      // Verify push notifications were sent to both HR and Owner
      expect(PushNotificationService.sendPushSuspiciousActivityReport).toHaveBeenCalledTimes(2);

      // Verify HR received push notification
      expect(PushNotificationService.sendPushSuspiciousActivityReport).toHaveBeenCalledWith(
        "ExponentPushToken[hrtoken123]",
        "HR",
        "John Client",
        "Jane Cleaner",
        5
      );

      // Verify Owner received push notification
      expect(PushNotificationService.sendPushSuspiciousActivityReport).toHaveBeenCalledWith(
        "ExponentPushToken[ownertoken456]",
        "Business",
        "John Client",
        "Jane Cleaner",
        5
      );
    });

    it("should not send push notifications to staff without push tokens", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointmentId: 100,
        },
        sender: {
          id: 1,
          username: "cleaner1",
          firstName: "Jane",
          lastName: "Cleaner",
          type: "cleaner",
        },
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 2,
      });

      SuspiciousActivityReport.findOne.mockResolvedValue(null);

      SuspiciousActivityReport.create.mockResolvedValue({
        id: 1,
        messageId: 1,
        reporterId: 2,
        reportedUserId: 1,
        status: "pending",
      });

      SuspiciousActivityReport.count.mockResolvedValue(1);

      User.findByPk.mockResolvedValue({
        id: 2,
        firstName: "John",
        lastName: "Client",
        username: "client1",
        type: "homeowner",
      });

      // Staff WITHOUT push tokens
      User.findAll.mockResolvedValue([
        {
          id: 10,
          email: "hr@example.com",
          firstName: "HR",
          lastName: "Manager",
          type: "humanResources",
          expoPushToken: null,
        },
        {
          id: 11,
          email: "owner@example.com",
          firstName: "Business",
          lastName: "Owner",
          type: "owner",
          expoPushToken: undefined,
        },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(201);

      // Push notifications should NOT have been sent
      expect(PushNotificationService.sendPushSuspiciousActivityReport).not.toHaveBeenCalled();
    });

    it("should emit socket event with pending count to staff", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointmentId: 100,
        },
        sender: {
          id: 1,
          username: "cleaner1",
          firstName: "Jane",
          lastName: "Cleaner",
          type: "cleaner",
        },
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 2,
      });

      SuspiciousActivityReport.findOne.mockResolvedValue(null);

      SuspiciousActivityReport.create.mockResolvedValue({
        id: 1,
        messageId: 1,
        reporterId: 2,
        reportedUserId: 1,
        status: "pending",
      });

      SuspiciousActivityReport.count.mockResolvedValue(3);

      User.findByPk.mockResolvedValue({
        id: 2,
        firstName: "John",
        lastName: "Client",
        username: "client1",
        type: "homeowner",
      });

      User.findAll.mockResolvedValue([
        {
          id: 10,
          email: "hr@example.com",
          firstName: "HR",
          lastName: "Manager",
          type: "humanResources",
        },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(201);

      // Verify socket event was emitted
      expect(mockIo.to).toHaveBeenCalledWith("user_10");
      expect(mockIo.emit).toHaveBeenCalledWith(
        "suspicious_activity_report",
        expect.objectContaining({
          reportId: 1,
          pendingCount: 3,
        })
      );
    });

    it("should include pending count in notification data", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Pay me on Venmo",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["off_platform"],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointmentId: 100,
        },
        sender: {
          id: 1,
          username: "badactor",
          firstName: "Bad",
          lastName: "Actor",
          type: "cleaner",
        },
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 2,
      });

      SuspiciousActivityReport.findOne.mockResolvedValue(null);

      SuspiciousActivityReport.create.mockResolvedValue({
        id: 99,
        messageId: 1,
        reporterId: 2,
        reportedUserId: 1,
        status: "pending",
      });

      // 10 pending reports
      SuspiciousActivityReport.count.mockResolvedValue(10);

      User.findByPk.mockResolvedValue({
        id: 2,
        firstName: "Reporter",
        lastName: "User",
        username: "reporter",
        type: "homeowner",
      });

      User.findAll.mockResolvedValue([
        {
          id: 20,
          email: "owner@example.com",
          firstName: "Owner",
          lastName: "Boss",
          type: "owner",
          expoPushToken: "ExponentPushToken[valid]",
        },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/1/report-suspicious")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(201);

      // Verify push notification includes correct pending count
      expect(PushNotificationService.sendPushSuspiciousActivityReport).toHaveBeenCalledWith(
        "ExponentPushToken[valid]",
        "Owner",
        "Reporter User",
        "Bad Actor",
        10
      );
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
