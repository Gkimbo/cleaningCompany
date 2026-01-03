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
  UserAppointments,
} = require("../../models");

describe("Completed Appointment Messaging Restrictions", () => {
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

  describe("POST /send - Completed Appointment Check", () => {
    it("should return 403 when trying to send message to a completed appointment conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // User is a valid participant
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      // Conversation is an appointment type with completed appointment
      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
        appointment: {
          id: 100,
          completed: true,
          date: "2024-01-15",
        },
      });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Hello, is there anything else needed?",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Messaging is disabled for completed appointments");
    });

    it("should allow sending message to an active (not completed) appointment conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // User is a valid participant
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      // Conversation is an appointment type with active appointment
      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        appointmentId: 100,
        appointment: {
          id: 100,
          completed: false,
          date: "2024-01-20",
        },
      });

      // No existing messages
      Message.count.mockResolvedValue(0);

      // Create message
      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "I will be there at 2pm",
        messageType: "text",
      });

      // Return message with sender info
      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "I will be there at 2pm",
        messageType: "text",
        sender: { id: 1, username: "cleaner1", firstName: "John", lastName: "Doe" },
      });

      // Mock conversation update
      Conversation.update.mockResolvedValue([1]);

      // No other participants for email notifications
      ConversationParticipant.findAll.mockResolvedValue([]);

      // Mock sender
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        firstName: "John",
        lastName: "Doe",
      });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "I will be there at 2pm",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.content).toBe("I will be there at 2pm");
    });

    it("should allow sending message to a support conversation (not affected by appointment status)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // User is a valid participant
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 2,
        userId: 1,
      });

      // Conversation is a support type (no appointment)
      Conversation.findByPk.mockResolvedValue({
        id: 2,
        conversationType: "support",
        appointmentId: null,
        appointment: null,
      });

      // No existing messages
      Message.count.mockResolvedValue(0);

      // Create message
      Message.create.mockResolvedValue({
        id: 2,
        conversationId: 2,
        senderId: 1,
        content: "I need help with scheduling",
        messageType: "text",
      });

      // Return message with sender info
      Message.findByPk.mockResolvedValue({
        id: 2,
        conversationId: 2,
        senderId: 1,
        content: "I need help with scheduling",
        messageType: "text",
        sender: { id: 1, username: "user1", firstName: "Jane", lastName: "Smith" },
      });

      // Mock conversation update
      Conversation.update.mockResolvedValue([1]);

      // No other participants for email notifications
      ConversationParticipant.findAll.mockResolvedValue([]);

      // Mock sender
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "user1",
        firstName: "Jane",
        lastName: "Smith",
      });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 2,
          content: "I need help with scheduling",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
    });

    it("should allow sending message to an internal conversation (not affected by appointment status)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // User is a valid participant
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 3,
        userId: 1,
      });

      // Conversation is an internal type (no appointment)
      Conversation.findByPk.mockResolvedValue({
        id: 3,
        conversationType: "internal",
        appointmentId: null,
        appointment: null,
      });

      // No existing messages
      Message.count.mockResolvedValue(0);

      // Create message
      Message.create.mockResolvedValue({
        id: 3,
        conversationId: 3,
        senderId: 1,
        content: "Team meeting at 3pm",
        messageType: "text",
      });

      // Return message with sender info
      Message.findByPk.mockResolvedValue({
        id: 3,
        conversationId: 3,
        senderId: 1,
        content: "Team meeting at 3pm",
        messageType: "text",
        sender: { id: 1, username: "owner1", firstName: "Owner", lastName: "Admin" },
      });

      // Mock conversation update
      Conversation.update.mockResolvedValue([1]);

      // No other participants for email notifications
      ConversationParticipant.findAll.mockResolvedValue([]);

      // Mock sender
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        firstName: "Owner",
        lastName: "Admin",
      });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 3,
          content: "Team meeting at 3pm",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
    });

    it("should allow sending message to a cleaner-client conversation (not affected by appointment status)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // User is a valid participant
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 4,
        userId: 1,
      });

      // Conversation is a cleaner-client type (no appointment)
      Conversation.findByPk.mockResolvedValue({
        id: 4,
        conversationType: "cleaner-client",
        appointmentId: null,
        appointment: null,
      });

      // No existing messages
      Message.count.mockResolvedValue(0);

      // Create message
      Message.create.mockResolvedValue({
        id: 4,
        conversationId: 4,
        senderId: 1,
        content: "Thanks for booking with me!",
        messageType: "text",
      });

      // Return message with sender info
      Message.findByPk.mockResolvedValue({
        id: 4,
        conversationId: 4,
        senderId: 1,
        content: "Thanks for booking with me!",
        messageType: "text",
        sender: { id: 1, username: "cleaner1", firstName: "John", lastName: "Cleaner" },
      });

      // Mock conversation update
      Conversation.update.mockResolvedValue([1]);

      // No other participants for email notifications
      ConversationParticipant.findAll.mockResolvedValue([]);

      // Mock sender
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        firstName: "John",
        lastName: "Cleaner",
      });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 4,
          content: "Thanks for booking with me!",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
    });

    it("should return 403 for non-participants regardless of appointment status", async () => {
      const token = jwt.sign({ userId: 999 }, secretKey);

      // User is NOT a participant
      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Trying to send a message",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized to send messages in this conversation");
    });

    it("should return 400 for empty message content", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Message content is required");
    });

    it("should return 400 for whitespace-only message content", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "   ",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Message content is required");
    });

    it("should return 401 without authentication token", async () => {
      const res = await request(app)
        .post("/api/v1/messages/send")
        .send({
          conversationId: 1,
          content: "Hello",
        });

      expect(res.status).toBe(401);
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
