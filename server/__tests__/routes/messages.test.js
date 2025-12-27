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
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
