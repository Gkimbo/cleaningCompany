const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

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
    destroy: jest.fn(),
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
    destroy: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  MessageReaction: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  MessageReadReceipt: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
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
  MessageReaction,
  MessageReadReceipt,
} = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");

// Mock PushNotification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushReaction: jest.fn().mockResolvedValue(true),
  sendPushNewMessage: jest.fn().mockResolvedValue(true),
}));
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

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

      // Mock User.findAll to return support staff (owners + HR)
      User.findAll.mockResolvedValue([
        {
          id: 2,
          username: "owner1",
          email: "owner@example.com",
          type: "owner",
        },
      ]);

      ConversationParticipant.findAll.mockResolvedValue([]);
      ConversationParticipant.findOrCreate.mockResolvedValue([{ id: 1 }, true]);

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
      // Notifications should NOT be sent when conversation is created
      // They are sent when the user actually sends a message via /send endpoint
      expect(mockIo.emit).not.toHaveBeenCalledWith("new_support_conversation", expect.any(Object));
    });

    it("should return existing support conversation if one exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: null,
      });

      // Mock User.findAll to return support staff (owners + HR)
      User.findAll.mockResolvedValue([
        {
          id: 2,
          username: "owner1",
          type: "owner",
        },
      ]);

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
      expect(res.body.error).toBe("Owners and HR cannot create support conversations");
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

  describe("POST /:messageId/react", () => {
    it("should add a reaction to a message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
        sender: {
          id: 2,
          username: "jane",
          firstName: "Jane",
          lastName: "Doe",
          notifications: ["phone"],
          expoPushToken: "expo-token-123",
        },
      });

      ConversationParticipant.findOne.mockResolvedValue({ id: 1, userId: 1 });
      MessageReaction.findOne.mockResolvedValue(null);

      const mockReaction = {
        id: 1,
        messageId: 1,
        userId: 1,
        emoji: "👍",
        toJSON: () => ({ id: 1, messageId: 1, userId: 1, emoji: "👍" }),
      };
      MessageReaction.create.mockResolvedValue(mockReaction);
      MessageReaction.findByPk.mockResolvedValue({
        ...mockReaction,
        user: { id: 1, username: "john", firstName: "John", lastName: "Doe" },
        toJSON: () => ({
          id: 1,
          messageId: 1,
          userId: 1,
          emoji: "👍",
          user: { id: 1, username: "john", firstName: "John", lastName: "Doe" },
        }),
      });

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "john",
        firstName: "John",
        lastName: "Doe",
      });

      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "👍" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe("added");
    });

    it("should toggle off existing reaction", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
        sender: { id: 2, username: "jane" },
      });

      ConversationParticipant.findOne.mockResolvedValue({ id: 1, userId: 1 });

      const mockReaction = {
        id: 1,
        messageId: 1,
        userId: 1,
        emoji: "👍",
        destroy: jest.fn().mockResolvedValue(true),
      };
      MessageReaction.findOne.mockResolvedValue(mockReaction);

      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "👍" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe("removed");
      expect(mockReaction.destroy).toHaveBeenCalled();
    });
  });

  describe("DELETE /:messageId/react/:emoji", () => {
    const thumbsUpEncoded = encodeURIComponent("👍");

    it("should remove user's own reaction", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
      });

      const mockReaction = {
        id: 1,
        messageId: 1,
        userId: 1,
        emoji: "👍",
        destroy: jest.fn().mockResolvedValue(true),
      };
      MessageReaction.findOne.mockResolvedValue(mockReaction);

      const res = await request(app)
        .delete(`/api/v1/messages/1/react/${thumbsUpEncoded}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReaction.destroy).toHaveBeenCalled();
    });

    it("should return 403 when trying to remove another user's reaction", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
      });

      // User 1's reaction not found (they didn't react with this emoji)
      MessageReaction.findOne
        .mockResolvedValueOnce(null) // First call: looking for user 1's reaction
        .mockResolvedValueOnce({ id: 2, messageId: 1, userId: 2, emoji: "👍" }); // Second call: checking if reaction exists from someone else

      const res = await request(app)
        .delete(`/api/v1/messages/1/react/${thumbsUpEncoded}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You can only remove your own reactions");
    });

    it("should return 404 when reaction does not exist at all", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
      });

      // No reaction found at all
      MessageReaction.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/v1/messages/1/react/${thumbsUpEncoded}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Reaction not found");
    });
  });

  describe("DELETE /conversation/:conversationId", () => {
    it("should delete a conversation (owner only)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const mockConversation = {
        id: 1,
        conversationType: "support",
        participants: [
          { userId: 1 },
          { userId: 2 },
        ],
        messages: [
          { id: 1 },
          { id: 2 },
        ],
        destroy: jest.fn().mockResolvedValue(true),
      };

      Conversation.findByPk.mockResolvedValue(mockConversation);
      MessageReaction.destroy.mockResolvedValue(2);
      MessageReadReceipt.destroy.mockResolvedValue(2);
      Message.destroy.mockResolvedValue(2);
      ConversationParticipant.destroy.mockResolvedValue(2);

      const res = await request(app)
        .delete("/api/v1/messages/conversation/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConversation.destroy).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalledWith("user_1");
      expect(mockIo.to).toHaveBeenCalledWith("user_2");
      expect(mockIo.emit).toHaveBeenCalledWith("conversation_deleted", { conversationId: 1 });
    });

    it("should return 403 for non-owner users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "regularuser",
        type: null,
      });

      const res = await request(app)
        .delete("/api/v1/messages/conversation/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only the owner can delete conversations");
    });

    it("should return 403 for HR users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hruser",
        type: "humanResources",
      });

      const res = await request(app)
        .delete("/api/v1/messages/conversation/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only the owner can delete conversations");
    });

    it("should return 404 for non-existent conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      Conversation.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/messages/conversation/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Conversation not found");
    });
  });

  describe("POST /send - Email notifications", () => {
    it("should send email notification only for the first message in a conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      // First message in conversation
      Message.count.mockResolvedValue(0);

      Message.create.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "First message",
        messageType: "text",
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "First message",
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
          content: "First message",
        });

      expect(res.status).toBe(201);
      expect(Email.sendNewMessageNotification).toHaveBeenCalled();
    });

    it("should NOT send email notification for subsequent messages", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      // Not the first message - already 5 messages exist
      Message.count.mockResolvedValue(5);

      Message.create.mockResolvedValue({
        id: 6,
        conversationId: 1,
        senderId: 1,
        content: "Another message",
        messageType: "text",
      });

      Message.findByPk.mockResolvedValue({
        id: 6,
        conversationId: 1,
        senderId: 1,
        content: "Another message",
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
          content: "Another message",
        });

      expect(res.status).toBe(201);
      // Email should NOT be called for non-first messages
      expect(Email.sendNewMessageNotification).not.toHaveBeenCalled();
    });
  });

  describe("POST /conversation/hr-direct", () => {
    it("should create HR direct conversation with FirstName LastName format (not 'Direct - ' prefix)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // HR user creating the conversation - defaults to messaging owner
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hr1",
        firstName: "Sarah",
        lastName: "Smith",
        type: "humanResources",
      });

      // Find owner
      User.findOne.mockResolvedValue({
        id: 2,
        username: "owner1",
        firstName: "John",
        lastName: "Doe",
        type: "owner",
      });

      // No existing direct conversation
      ConversationParticipant.findAll.mockResolvedValue([]);

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        title: "John Doe",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        title: "John Doe",
        participants: [
          { userId: 1, user: { id: 1, username: "hr1" } },
          { userId: 2, user: { id: 2, username: "owner1" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({});  // HR without target defaults to owner

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversation");
      // Title should be "John Doe" not "Direct - John Doe"
      expect(res.body.conversation.title).toBe("John Doe");
      expect(res.body.conversation.title).not.toContain("Direct -");
    });

    it("should return 403 for non-HR/non-owner users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "regularuser",
        type: null,
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner or HR can use this endpoint");
    });

    it("should return existing conversation if one already exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
        .mockResolvedValueOnce({
          id: 1,
          username: "owner1",
          type: "owner",
        })
        .mockResolvedValueOnce({
          id: 2,
          username: "hr1",
          firstName: "Jane",
          lastName: "Doe",
          type: "humanResources",
        });

      // Existing conversation found
      ConversationParticipant.findAll.mockResolvedValue([
        {
          conversationId: 5,
          conversation: {
            id: 5,
            conversationType: "internal",
            title: "Jane Doe",
            participants: [{ userId: 1 }, { userId: 2 }],
          },
        },
      ]);

      Conversation.findByPk.mockResolvedValue({
        id: 5,
        conversationType: "internal",
        title: "Jane Doe",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(5);
      expect(Conversation.create).not.toHaveBeenCalled();
    });

    it("should allow owner to create direct conversations with HR", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
        .mockResolvedValueOnce({
          id: 1,
          username: "owner1",
          firstName: "Boss",
          lastName: "Man",
          type: "owner",
        })
        .mockResolvedValueOnce({
          id: 2,
          username: "hr1",
          firstName: "Worker",
          lastName: "Bee",
          type: "humanResources",
        });

      ConversationParticipant.findAll.mockResolvedValue([]);

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        title: "Worker Bee",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        title: "Worker Bee",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(200);
      expect(res.body.conversation.title).toBe("Worker Bee");
    });

    it("should return 400 if owner does not specify targetUserId", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("targetUserId is required for owner");
    });

    it("should return 400 if owner targets non-HR user", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
        .mockResolvedValueOnce({
          id: 1,
          username: "owner1",
          type: "owner",
        })
        .mockResolvedValueOnce({
          id: 2,
          username: "cleaner1",
          type: "cleaner",  // Not HR
        });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Target must be an HR staff member");
    });
  });

  describe("System messages", () => {
    it("should create system message with null senderId when title is changed", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        firstName: "John",
        lastName: "Doe",
        type: "owner",
      });

      const mockConversation = {
        id: 1,
        conversationType: "internal",
        title: "Old Title",
        participants: [{ userId: 1 }, { userId: 2 }],
        update: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          id: 1,
          conversationType: "internal",
          title: "Old Title",
          participants: [{ userId: 1 }, { userId: 2 }],
        }),
      };

      Conversation.findByPk.mockResolvedValue(mockConversation);

      Message.create.mockResolvedValue({
        id: 100,
        conversationId: 1,
        senderId: null,
        content: 'John Doe changed the conversation name to "New Title"',
        messageType: "system",
      });

      await request(app)
        .patch("/api/v1/messages/conversation/1/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New Title" });

      // Verify system message was created with null senderId
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: null,
          messageType: "system",
        })
      );
    });

    it("should include system message in response", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        firstName: "Jane",
        lastName: "Smith",
        type: "owner",
      });

      const mockConversation = {
        id: 1,
        conversationType: "internal",
        title: "Team Chat",
        participants: [{ userId: 1 }, { userId: 2 }],
        update: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          id: 1,
          conversationType: "internal",
          title: "Team Chat",
          participants: [{ userId: 1 }, { userId: 2 }],
        }),
      };

      Conversation.findByPk.mockResolvedValue(mockConversation);

      const mockSystemMessage = {
        id: 100,
        conversationId: 1,
        senderId: null,
        content: 'Jane Smith changed the conversation name to "New Chat Name"',
        messageType: "system",
      };

      Message.create.mockResolvedValue(mockSystemMessage);

      const res = await request(app)
        .patch("/api/v1/messages/conversation/1/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New Chat Name" });

      // Verify the response includes the system message
      expect(res.status).toBe(200);
      expect(res.body.systemMessage).toBeDefined();
      expect(res.body.systemMessage.messageType).toBe("system");
      expect(res.body.systemMessage.senderId).toBeNull();
    });
  });

  describe("DELETE /:messageId - Message deletion", () => {
    it("should soft delete a message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const mockMessage = {
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Message to delete",
        deletedAt: null,
        update: jest.fn().mockResolvedValue(true),
      };

      Message.findByPk.mockResolvedValue(mockMessage);

      const res = await request(app)
        .delete("/api/v1/messages/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      );
    });

    it("should return 403 if user is not the message sender", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2, // Different user
        content: "Not my message",
      });

      const res = await request(app)
        .delete("/api/v1/messages/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You can only delete your own messages");
    });

    it("should return 404 for non-existent message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/messages/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Message not found");
    });

    it("should emit message_deleted event through socket", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const mockMessage = {
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "Message to delete",
        deletedAt: null,
        update: jest.fn().mockResolvedValue(true),
      };

      Message.findByPk.mockResolvedValue(mockMessage);

      await request(app)
        .delete("/api/v1/messages/1")
        .set("Authorization", `Bearer ${token}`);

      expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
      expect(mockIo.emit).toHaveBeenCalledWith("message_deleted", {
        messageId: 1,
        conversationId: 1,
      });
    });
  });

  describe("PATCH /conversation/:conversationId/title", () => {
    it("should update conversation title (owner)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        firstName: "John",
        lastName: "Doe",
        type: "owner",
      });

      const mockConversation = {
        id: 1,
        conversationType: "internal",
        title: "Old Title",
        participants: [
          { userId: 1 },
          { userId: 2 },
        ],
        update: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          id: 1,
          conversationType: "internal",
          title: "Old Title",
          participants: [{ userId: 1 }, { userId: 2 }],
        }),
      };

      Conversation.findByPk.mockResolvedValue(mockConversation);

      Message.create.mockResolvedValue({
        id: 100,
        conversationId: 1,
        senderId: null,
        content: 'John Doe changed the conversation name to "New Title"',
        messageType: "system",
      });

      const res = await request(app)
        .patch("/api/v1/messages/conversation/1/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConversation.update).toHaveBeenCalledWith({ title: "New Title" });
      expect(Message.create).toHaveBeenCalledWith({
        conversationId: 1,
        senderId: null,
        content: 'John Doe changed the conversation name to "New Title"',
        messageType: "system",
      });
      expect(mockIo.to).toHaveBeenCalledWith("user_1");
      expect(mockIo.to).toHaveBeenCalledWith("user_2");
      expect(mockIo.emit).toHaveBeenCalledWith("conversation_title_changed", expect.any(Object));
    });

    it("should update conversation title (HR)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hr1",
        firstName: "Sarah",
        lastName: "Smith",
        type: "humanResources",
      });

      const mockConversation = {
        id: 1,
        conversationType: "internal",
        title: "Team Chat",
        participants: [{ userId: 1 }],
        update: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          id: 1,
          conversationType: "internal",
          title: "Team Chat",
          participants: [{ userId: 1 }],
        }),
      };

      Conversation.findByPk.mockResolvedValue(mockConversation);
      Message.create.mockResolvedValue({ id: 100 });

      const res = await request(app)
        .patch("/api/v1/messages/conversation/1/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Q4 Planning" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 403 for regular users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "regularuser",
        type: null,
      });

      const res = await request(app)
        .patch("/api/v1/messages/conversation/1/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner or HR can edit conversation titles");
    });

    it("should return 400 for non-internal conversations", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support Chat",
        participants: [],
      });

      const res = await request(app)
        .patch("/api/v1/messages/conversation/1/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Can only edit titles of internal conversations");
    });

    it("should return 400 for empty title", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .patch("/api/v1/messages/conversation/1/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Title is required");
    });

    it("should return 404 for non-existent conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      Conversation.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/messages/conversation/999/title")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Conversation not found");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
