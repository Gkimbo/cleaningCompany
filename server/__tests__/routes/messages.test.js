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
  UserAppointments: {
    findByPk: jest.fn(),
  },
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewMessageNotification: jest.fn().mockResolvedValue(true),
  sendBroadcastNotification: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  Message,
  Conversation,
  ConversationParticipant,
  UserAppointments,
} = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");

describe("Message Routes", () => {
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

  describe("GET /conversations", () => {
    it("should return user conversations with unread counts", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findAll.mockResolvedValue([
        {
          id: 1,
          conversationId: 1,
          userId: 1,
          lastReadAt: new Date(),
          toJSON: () => ({
            id: 1,
            conversationId: 1,
            userId: 1,
            conversation: {
              id: 1,
              conversationType: "appointment",
              messages: [{ id: 1, content: "Hello", createdAt: new Date() }],
              participants: [],
            },
          }),
        },
      ]);

      Message.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/v1/messages/conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversations");
      expect(Array.isArray(res.body.conversations)).toBe(true);
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/v1/messages/conversations");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /conversation/:conversationId", () => {
    it("should return messages for a conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      });

      Message.findAll.mockResolvedValue([
        {
          id: 1,
          conversationId: 1,
          senderId: 2,
          content: "Hello",
          messageType: "text",
          createdAt: new Date(),
          sender: { id: 2, username: "user2", type: null },
        },
      ]);

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "appointment",
        participants: [],
      });

      const res = await request(app)
        .get("/api/v1/messages/conversation/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("messages");
      expect(res.body).toHaveProperty("conversation");
    });

    it("should return 403 if user is not a participant", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/messages/conversation/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized to view this conversation");
    });
  });

  describe("POST /send", () => {
    it("should send a message successfully", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Test message",
        messageType: "text",
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Test message",
        messageType: "text",
        sender: { id: 1, username: "user1", type: null },
      });

      Conversation.update.mockResolvedValue([1]);

      ConversationParticipant.findAll.mockResolvedValue([
        {
          userId: 2,
          user: {
            id: 2,
            email: "user2@example.com",
            username: "user2",
            notifications: ["email"],
          },
        },
      ]);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "user1",
      });

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Test message",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("message");
      expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
      expect(mockIo.emit).toHaveBeenCalledWith("new_message", expect.any(Object));
    });

    it("should return 400 for empty message content", async () => {
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

    it("should return 403 if user is not a participant", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          content: "Test message",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized to send messages in this conversation");
    });
  });

  describe("POST /conversation/appointment", () => {
    it("should create a new conversation for an appointment", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        employeesAssigned: ["2"],
      });

      Conversation.findOne.mockResolvedValue(null);

      Conversation.create.mockResolvedValue({
        id: 1,
        appointmentId: 1,
        conversationType: "appointment",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });
      ConversationParticipant.findOrCreate.mockResolvedValue([{ id: 2 }, true]);

      User.findOne.mockResolvedValue({
        id: 3,
        username: "owner1",
        type: "owner",
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        appointmentId: 1,
        conversationType: "appointment",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/appointment")
        .set("Authorization", `Bearer ${token}`)
        .send({
          appointmentId: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversation");
    });

    it("should return existing conversation if one exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        employeesAssigned: ["2"],
      });

      Conversation.findOne.mockResolvedValue({
        id: 1,
        appointmentId: 1,
        conversationType: "appointment",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/appointment")
        .set("Authorization", `Bearer ${token}`)
        .send({
          appointmentId: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversation");
      expect(Conversation.create).not.toHaveBeenCalled();
    });

    it("should return 404 for non-existent appointment", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/conversation/appointment")
        .set("Authorization", `Bearer ${token}`)
        .send({
          appointmentId: 999,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Appointment not found");
    });
  });

  describe("POST /conversation/support", () => {
    it("should create a new support conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: null,
      });

      User.findOne.mockResolvedValue({
        id: 2,
        username: "owner1",
        email: "owner@example.com",
        type: "owner",
      });

      ConversationParticipant.findAll.mockResolvedValue([]);

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        participants: [
          { userId: 1, user: { id: 1, username: "testuser" } },
          { userId: 2, user: { id: 2, username: "owner1" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversation");
      expect(res.body.conversation.conversationType).toBe("support");
      expect(mockIo.to).toHaveBeenCalledWith("user_2");
      expect(mockIo.emit).toHaveBeenCalledWith("new_support_conversation", expect.any(Object));
    });

    it("should return existing support conversation if one exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: null,
      });

      User.findOne.mockResolvedValue({
        id: 2,
        username: "owner1",
        type: "owner",
      });

      ConversationParticipant.findAll.mockResolvedValue([
        {
          conversationId: 5,
          conversation: {
            id: 5,
            conversationType: "support",
            participants: [{ userId: 2 }],
          },
        },
      ]);

      Conversation.findByPk.mockResolvedValue({
        id: 5,
        conversationType: "support",
        title: "Support - testuser",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(5);
      expect(Conversation.create).not.toHaveBeenCalled();
    });

    it("should return 400 if owner tries to create support conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Owners cannot create support conversations");
    });
  });

  describe("POST /broadcast", () => {
    it("should send a broadcast message (owner only)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "user2", email: "user2@example.com", notifications: ["email"] },
        { id: 3, username: "user3", email: "user3@example.com", notifications: [] },
      ]);

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "broadcast",
        title: "Test Announcement",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Important announcement",
        messageType: "broadcast",
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        content: "Important announcement",
        messageType: "broadcast",
        sender: { id: 1, username: "owner1" },
      });

      const res = await request(app)
        .post("/api/v1/messages/broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({
          content: "Important announcement",
          targetAudience: "all",
          title: "Test Announcement",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("conversation");
      expect(res.body).toHaveProperty("message");
      expect(mockIo.emit).toHaveBeenCalledWith("broadcast", expect.any(Object));
    });

    it("should return 403 for non-owner users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "regularuser",
        type: null,
      });

      const res = await request(app)
        .post("/api/v1/messages/broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({
          content: "Attempted broadcast",
          targetAudience: "all",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owners can send broadcasts");
    });

    it("should return 400 for empty broadcast content", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/messages/broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({
          content: "",
          targetAudience: "all",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Broadcast content is required");
    });
  });

  describe("GET /unread-count", () => {
    it("should return total unread count", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findAll.mockResolvedValue([
        { conversationId: 1, lastReadAt: new Date(Date.now() - 60000) },
        { conversationId: 2, lastReadAt: new Date(Date.now() - 60000) },
      ]);

      Message.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      const res = await request(app)
        .get("/api/v1/messages/unread-count")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("unreadCount");
      expect(res.body.unreadCount).toBe(5);
    });
  });

  describe("PATCH /mark-read/:conversationId", () => {
    it("should mark conversation as read", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .patch("/api/v1/messages/mark-read/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 403 if not a participant", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/messages/mark-read/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not a participant of this conversation");
    });
  });

  describe("POST /add-participant", () => {
    it("should add a participant to a conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      ConversationParticipant.findOrCreate.mockResolvedValue([
        { id: 2, conversationId: 1, userId: 3 },
        true,
      ]);

      const res = await request(app)
        .post("/api/v1/messages/add-participant")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          userIdToAdd: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("participant");
      expect(res.body.created).toBe(true);
      expect(mockIo.to).toHaveBeenCalledWith("user_3");
      expect(mockIo.emit).toHaveBeenCalledWith("added_to_conversation", { conversationId: 1 });
    });

    it("should return 403 if requester is not a participant", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/add-participant")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          userIdToAdd: 3,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
