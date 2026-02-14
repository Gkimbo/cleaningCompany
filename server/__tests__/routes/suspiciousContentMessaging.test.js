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
    findOne: jest.fn(),
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
    create: jest.fn(),
  },
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewMessageNotification: jest.fn().mockResolvedValue(true),
  sendBroadcastNotification: jest.fn().mockResolvedValue(true),
}));

// Mock Push Notification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNewMessage: jest.fn().mockResolvedValue(true),
  sendPushBroadcast: jest.fn().mockResolvedValue(true),
  sendPushReaction: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  Message,
  Conversation,
  ConversationParticipant,
} = require("../../models");

describe("Suspicious Content Detection in Messaging", () => {
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

  describe("POST /send - Suspicious Content Detection", () => {
    it("should flag message with phone number in appointment conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // User is a valid participant
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      // Conversation is an appointment type
      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
        appointment: {
          id: 100,
          completed: false,
        },
      });

      // No existing messages
      Message.count.mockResolvedValue(0);

      // Create message with suspicious content
      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "My number is 123-456-7890",
        messageType: "text",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
      });

      // Return message with sender info
      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "My number is 123-456-7890",
        messageType: "text",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number"],
        sender: { id: 1, username: "user1", firstName: "John", lastName: "Doe" },
      });

      // Mock conversation update
      Conversation.update.mockResolvedValue([1]);

      // No other participants
      ConversationParticipant.findAll.mockResolvedValue([]);

      // Mock sender
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "user1",
        firstName: "John",
        lastName: "Doe",
      });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Here is 123-456-7890",
        });

      expect(res.status).toBe(201);

      // Verify Message.create was called with suspicious content flags
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSuspiciousContent: true,
          suspiciousContentTypes: expect.arrayContaining(["phone_number"]),
        })
      );
    });

    it("should flag message with email in appointment conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
        appointment: { id: 100, completed: false },
      });

      Message.count.mockResolvedValue(0);

      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Email me at test@example.com",
        messageType: "text",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["email"],
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Email me at test@example.com",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["email"],
        sender: { id: 1, username: "user1" },
      });

      Conversation.update.mockResolvedValue([1]);
      ConversationParticipant.findAll.mockResolvedValue([]);
      User.findByPk.mockResolvedValue({ id: 1, username: "user1" });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Email me at test@example.com",
        });

      expect(res.status).toBe(201);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSuspiciousContent: true,
          suspiciousContentTypes: ["email"],
        })
      );
    });

    it("should flag message with off-platform keywords in appointment conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
        appointment: { id: 100, completed: false },
      });

      Message.count.mockResolvedValue(0);

      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Pay me on Venmo instead",
        messageType: "text",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["off_platform"],
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Pay me on Venmo instead",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["off_platform"],
        sender: { id: 1, username: "user1" },
      });

      Conversation.update.mockResolvedValue([1]);
      ConversationParticipant.findAll.mockResolvedValue([]);
      User.findByPk.mockResolvedValue({ id: 1, username: "user1" });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Pay me on Venmo instead",
        });

      expect(res.status).toBe(201);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSuspiciousContent: true,
          suspiciousContentTypes: ["off_platform"],
        })
      );
    });

    it("should NOT flag suspicious content in support conversations", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 2,
        userId: 1,
      });

      // Support conversation (not appointment)
      Conversation.findByPk.mockResolvedValue({
        id: 2,
        conversationType: "support",
        appointmentId: null,
        appointment: null,
      });

      Message.count.mockResolvedValue(0);

      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 2,
        senderId: 1,
        content: "Call me at 123-456-7890",
        messageType: "text",
        hasSuspiciousContent: false,
        suspiciousContentTypes: [],
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 2,
        senderId: 1,
        content: "Call me at 123-456-7890",
        hasSuspiciousContent: false,
        suspiciousContentTypes: [],
        sender: { id: 1, username: "user1" },
      });

      Conversation.update.mockResolvedValue([1]);
      ConversationParticipant.findAll.mockResolvedValue([]);
      User.findByPk.mockResolvedValue({ id: 1, username: "user1" });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 2,
          content: "Call me at 123-456-7890",
        });

      expect(res.status).toBe(201);

      // Should NOT be flagged because it's a support conversation
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSuspiciousContent: false,
          suspiciousContentTypes: [],
        })
      );
    });

    it("should NOT flag clean message in appointment conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
        appointment: { id: 100, completed: false },
      });

      Message.count.mockResolvedValue(0);

      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "See you tomorrow at 3pm!",
        messageType: "text",
        hasSuspiciousContent: false,
        suspiciousContentTypes: [],
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "See you tomorrow at 3pm!",
        hasSuspiciousContent: false,
        suspiciousContentTypes: [],
        sender: { id: 1, username: "user1" },
      });

      Conversation.update.mockResolvedValue([1]);
      ConversationParticipant.findAll.mockResolvedValue([]);
      User.findByPk.mockResolvedValue({ id: 1, username: "user1" });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "See you tomorrow at 3pm!",
        });

      expect(res.status).toBe(201);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSuspiciousContent: false,
          suspiciousContentTypes: [],
        })
      );
    });

    it("should flag message with multiple suspicious types", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
        appointment: { id: 100, completed: false },
      });

      Message.count.mockResolvedValue(0);

      // The actual creation call
      Message.create.mockImplementation((data) => {
        return Promise.resolve({
          id: 1,
          ...data,
        });
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Call 123-456-7890 or email test@example.com, I accept venmo",
        hasSuspiciousContent: true,
        suspiciousContentTypes: ["phone_number", "email", "off_platform"],
        sender: { id: 1, username: "user1" },
      });

      Conversation.update.mockResolvedValue([1]);
      ConversationParticipant.findAll.mockResolvedValue([]);
      User.findByPk.mockResolvedValue({ id: 1, username: "user1" });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Call 123-456-7890 or email test@example.com, I accept venmo",
        });

      expect(res.status).toBe(201);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSuspiciousContent: true,
          suspiciousContentTypes: expect.arrayContaining([
            "phone_number",
            "email",
            "off_platform",
          ]),
        })
      );
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
