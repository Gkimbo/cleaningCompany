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
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  MessageReadReceipt: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
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
  MessageReaction,
  MessageReadReceipt,
} = require("../../models");

describe("Message Reactions API", () => {
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

  describe("POST /:messageId/react", () => {
    it("should add a new reaction to a message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // User is a participant
      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      // Message exists
      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
      });

      // No existing reaction
      MessageReaction.findOne.mockResolvedValue(null);

      // Create new reaction
      MessageReaction.create.mockResolvedValue({
        id: 1,
        messageId: 1,
        userId: 1,
        emoji: "👍",
      });

      // Return all reactions for the message
      MessageReaction.findAll.mockResolvedValue([
        { id: 1, messageId: 1, userId: 1, emoji: "👍", user: { id: 1, username: "user1" } },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "👍" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("reactions");
      expect(res.body.reactions).toHaveLength(1);
      expect(res.body.reactions[0].emoji).toBe("👍");
      expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
      expect(mockIo.emit).toHaveBeenCalledWith("message_reaction", expect.any(Object));
    });

    it("should toggle off an existing reaction (same emoji)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
      });

      // Existing reaction with same emoji
      MessageReaction.findOne.mockResolvedValue({
        id: 1,
        messageId: 1,
        userId: 1,
        emoji: "👍",
        destroy: jest.fn().mockResolvedValue(true),
      });

      MessageReaction.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "👍" });

      expect(res.status).toBe(200);
      expect(res.body.reactions).toHaveLength(0);
    });

    it("should replace reaction with different emoji", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
      });

      // Existing reaction with different emoji
      const existingReaction = {
        id: 1,
        messageId: 1,
        userId: 1,
        emoji: "👍",
        destroy: jest.fn().mockResolvedValue(true),
      };
      MessageReaction.findOne.mockResolvedValue(existingReaction);

      MessageReaction.create.mockResolvedValue({
        id: 2,
        messageId: 1,
        userId: 1,
        emoji: "❤️",
      });

      MessageReaction.findAll.mockResolvedValue([
        { id: 2, messageId: 1, userId: 1, emoji: "❤️", user: { id: 1, username: "user1" } },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "❤️" });

      expect(res.status).toBe(200);
      expect(existingReaction.destroy).toHaveBeenCalled();
      expect(res.body.reactions[0].emoji).toBe("❤️");
    });

    it("should return 400 for missing emoji", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Emoji is required");
    });

    it("should return 404 for non-existent message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/999/react")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "👍" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Message not found");
    });

    it("should return 403 if user is not a participant", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
      });

      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "👍" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized to react to this message");
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .post("/api/v1/messages/1/react")
        .send({ emoji: "👍" });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /:messageId/react/:emoji", () => {
    it("should remove a specific reaction", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      const mockReaction = {
        id: 1,
        messageId: 1,
        userId: 1,
        emoji: "👍",
        destroy: jest.fn().mockResolvedValue(true),
      };
      MessageReaction.findOne.mockResolvedValue(mockReaction);

      MessageReaction.findAll.mockResolvedValue([]);

      const res = await request(app)
        .delete("/api/v1/messages/1/react/👍")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockReaction.destroy).toHaveBeenCalled();
      expect(res.body.success).toBe(true);
    });

    it("should return 404 if reaction does not exist", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2,
        content: "Hello",
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      MessageReaction.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/messages/1/react/👍")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Reaction not found");
    });
  });
});

describe("Message Deletion API", () => {
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

  describe("DELETE /:messageId", () => {
    it("should soft delete own message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const mockMessage = {
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "My message",
        deletedAt: null,
        update: jest.fn().mockResolvedValue(true),
      };

      Message.findByPk.mockResolvedValue(mockMessage);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      const res = await request(app)
        .delete("/api/v1/messages/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMessage.update).toHaveBeenCalledWith({ deletedAt: expect.any(Date) });
      expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
      expect(mockIo.emit).toHaveBeenCalledWith("message_deleted", expect.any(Object));
    });

    it("should return 403 when trying to delete another user's message", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 2, // Different user
        content: "Not my message",
        deletedAt: null,
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
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

    it("should return 400 if message already deleted", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      Message.findByPk.mockResolvedValue({
        id: 1,
        conversationId: 1,
        senderId: 1,
        content: "My message",
        deletedAt: new Date(), // Already deleted
      });

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
      });

      const res = await request(app)
        .delete("/api/v1/messages/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Message already deleted");
    });
  });
});

describe("Read Receipts API", () => {
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

  describe("POST /mark-messages-read", () => {
    it("should create read receipts for multiple messages", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      });

      Message.findAll.mockResolvedValue([
        { id: 1, conversationId: 1, senderId: 2 },
        { id: 2, conversationId: 1, senderId: 2 },
        { id: 3, conversationId: 1, senderId: 2 },
      ]);

      MessageReadReceipt.bulkCreate.mockResolvedValue([
        { id: 1, messageId: 1, userId: 1 },
        { id: 2, messageId: 2, userId: 1 },
        { id: 3, messageId: 3, userId: 1 },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/mark-messages-read")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          messageIds: [1, 2, 3],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.markedCount).toBe(3);
    });

    it("should filter out own messages from read receipts", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      });

      // Include a message sent by the current user
      Message.findAll.mockResolvedValue([
        { id: 1, conversationId: 1, senderId: 2 },
        { id: 2, conversationId: 1, senderId: 1 }, // Own message
        { id: 3, conversationId: 1, senderId: 2 },
      ]);

      MessageReadReceipt.bulkCreate.mockResolvedValue([
        { id: 1, messageId: 1, userId: 1 },
        { id: 2, messageId: 3, userId: 1 },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/mark-messages-read")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          messageIds: [1, 2, 3],
        });

      expect(res.status).toBe(200);
      // Should only mark 2 messages (excluding own message)
      expect(MessageReadReceipt.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ messageId: 1 }),
          expect.objectContaining({ messageId: 3 }),
        ]),
        expect.any(Object)
      );
    });

    it("should return 400 for missing conversationId", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/messages/mark-messages-read")
        .set("Authorization", `Bearer ${token}`)
        .send({
          messageIds: [1, 2, 3],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("conversationId and messageIds are required");
    });

    it("should return 400 for empty messageIds array", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/messages/mark-messages-read")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          messageIds: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("conversationId and messageIds are required");
    });

    it("should return 403 if not a participant", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/mark-messages-read")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          messageIds: [1, 2, 3],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not a participant of this conversation");
    });

    it("should emit read receipts via socket", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      ConversationParticipant.findOne.mockResolvedValue({
        id: 1,
        conversationId: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      });

      Message.findAll.mockResolvedValue([
        { id: 1, conversationId: 1, senderId: 2 },
      ]);

      MessageReadReceipt.bulkCreate.mockResolvedValue([
        { id: 1, messageId: 1, userId: 1 },
      ]);

      await request(app)
        .post("/api/v1/messages/mark-messages-read")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 1,
          messageIds: [1],
        });

      expect(mockIo.to).toHaveBeenCalledWith("conversation_1");
      expect(mockIo.emit).toHaveBeenCalledWith("message_read", expect.any(Object));
    });
  });
});

describe("Staff List and Internal Conversations API", () => {
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

  describe("GET /staff", () => {
    it("should return staff list for owner", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" },
        { id: 3, username: "hr2", firstName: "Bob", lastName: "Jones", type: "humanResources" },
      ]);

      const res = await request(app)
        .get("/api/v1/messages/staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("staff");
      expect(res.body.staff).toHaveLength(2);
    });

    it("should return staff list for HR", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 2,
        username: "hr1",
        type: "humanResources",
      });

      User.findAll.mockResolvedValue([
        { id: 1, username: "owner1", firstName: "John", lastName: "Owner", type: "owner" },
        { id: 3, username: "hr2", firstName: "Bob", lastName: "Jones", type: "humanResources" },
      ]);

      const res = await request(app)
        .get("/api/v1/messages/staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.staff).toHaveLength(2);
    });

    it("should filter staff by search query", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" },
      ]);

      const res = await request(app)
        .get("/api/v1/messages/staff?search=jane")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(User.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object),
        })
      );
    });

    it("should return 403 for non-owner/HR users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .get("/api/v1/messages/staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized");
    });
  });

  describe("POST /conversation/hr-direct", () => {
    it("should create direct conversation with HR member", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, username: "owner1", type: "owner" })
        .mockResolvedValueOnce({ id: 2, username: "hr1", type: "humanResources" });

      ConversationParticipant.findAll.mockResolvedValue([]);

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1" } },
          { userId: 2, user: { id: 2, username: "hr1" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversation");
      expect(res.body.conversation.conversationType).toBe("internal");
    });

    it("should return existing conversation if one exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, username: "owner1", type: "owner" })
        .mockResolvedValueOnce({ id: 2, username: "hr1", type: "humanResources" });

      // Existing conversation
      ConversationParticipant.findAll.mockResolvedValue([
        {
          conversationId: 5,
          conversation: {
            id: 5,
            conversationType: "internal",
            participants: [{ userId: 1 }, { userId: 2 }],
          },
        },
      ]);

      Conversation.findByPk.mockResolvedValue({
        id: 5,
        conversationType: "internal",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1" } },
          { userId: 2, user: { id: 2, username: "hr1" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(5);
      expect(Conversation.create).not.toHaveBeenCalled();
    });
  });

  describe("POST /conversation/custom-group", () => {
    it("should create a custom group conversation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        title: "Project Team",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "internal",
        title: "Project Team",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1" } },
          { userId: 2, user: { id: 2, username: "hr1" } },
          { userId: 3, user: { id: 3, username: "hr2" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({
          memberIds: [2, 3],
          title: "Project Team",
        });

      expect(res.status).toBe(200);
      expect(res.body.conversation.title).toBe("Project Team");
      expect(mockIo.emit).toHaveBeenCalledWith("new_internal_conversation", expect.any(Object));
    });

    it("should return 400 for empty memberIds", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({
          memberIds: [],
          title: "Empty Group",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("At least one member is required");
    });
  });

  describe("GET /conversations/internal", () => {
    it("should return internal conversations for owner/HR", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      ConversationParticipant.findAll.mockResolvedValue([
        {
          id: 1,
          conversationId: 1,
          userId: 1,
          toJSON: () => ({
            id: 1,
            conversationId: 1,
            conversation: {
              id: 1,
              conversationType: "internal",
              title: "HR Team",
              messages: [],
              participants: [],
            },
          }),
        },
      ]);

      Message.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/v1/messages/conversations/internal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversations");
    });

    it("should return 403 for non-owner/HR users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .get("/api/v1/messages/conversations/internal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
