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

// Mock Sequelize Op
const mockOp = {
  ne: Symbol("ne"),
  in: Symbol("in"),
  or: Symbol("or"),
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

// Mock PushNotification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushReaction: jest.fn().mockResolvedValue(true),
  sendPushNewMessage: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  Conversation,
  ConversationParticipant,
  CleanerClient,
  UserHomes,
} = require("../../models");

describe("Cleaner-Client Messaging Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

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

  describe("POST /conversation/cleaner-client", () => {
    describe("Cleaner Initiating Conversation", () => {
      const cleanerId = 100;
      const clientId = 200;

      it("should create a new conversation when cleaner messages their client", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({ id: cleanerId, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce({
            id: cleanerId,
            type: "cleaner",
            firstName: "John",
            lastName: "Cleaner",
            username: "johncleaner",
          })
          .mockResolvedValueOnce({
            id: clientId,
            type: "homeowner",
            firstName: "Jane",
            lastName: "Client",
            username: "janeclient",
          });

        CleanerClient.findOne.mockResolvedValue({
          id: 1,
          cleanerId,
          clientId,
          status: "active",
        });

        ConversationParticipant.findAll.mockResolvedValue([]);

        const mockConversation = {
          id: 1,
          conversationType: "cleaner-client",
          title: "John Cleaner & Jane Client",
          createdBy: cleanerId,
        };

        Conversation.create.mockResolvedValue(mockConversation);
        ConversationParticipant.create.mockResolvedValue({});
        Conversation.findByPk.mockResolvedValue({
          ...mockConversation,
          participants: [
            { userId: cleanerId, user: { id: cleanerId, firstName: "John" } },
            { userId: clientId, user: { id: clientId, firstName: "Jane" } },
          ],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ clientUserId: clientId });

        expect(res.status).toBe(200);
        expect(res.body.conversation).toBeDefined();
        expect(res.body.conversation.conversationType).toBe("cleaner-client");
      });

      it("should return existing conversation if one already exists", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({ id: cleanerId, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce({
            id: cleanerId,
            type: "cleaner",
            firstName: "John",
            lastName: "Cleaner",
          })
          .mockResolvedValueOnce({
            id: clientId,
            type: "homeowner",
            firstName: "Jane",
            lastName: "Client",
          });

        CleanerClient.findOne.mockResolvedValue({
          id: 1,
          cleanerId,
          clientId,
          status: "active",
        });

        // Existing conversation found
        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 5,
            conversation: {
              id: 5,
              conversationType: "cleaner-client",
              participants: [{ userId: clientId }],
            },
          },
        ]);

        const existingConversation = {
          id: 5,
          conversationType: "cleaner-client",
          title: "John Cleaner & Jane Client",
          participants: [
            { userId: cleanerId, user: { id: cleanerId } },
            { userId: clientId, user: { id: clientId } },
          ],
        };

        Conversation.findByPk.mockResolvedValue(existingConversation);

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ clientUserId: clientId });

        expect(res.status).toBe(200);
        expect(res.body.conversation.id).toBe(5);
        expect(Conversation.create).not.toHaveBeenCalled();
      });

      it("should return 400 if cleaner does not specify clientUserId", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("clientUserId is required for cleaner");
      });

      it("should return 403 if no active relationship with client", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        CleanerClient.findOne.mockResolvedValue(null);
        UserHomes.findOne.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ clientUserId: 999 });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("No active relationship with this client");
      });

      it("should allow conversation if cleaner is preferred cleaner for client home", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({
            id: cleanerId,
            type: "cleaner",
            firstName: "John",
            lastName: "Cleaner",
          })
          .mockResolvedValueOnce({
            id: clientId,
            type: "homeowner",
            firstName: "Jane",
            lastName: "Client",
          });

        // No CleanerClient relationship
        CleanerClient.findOne.mockResolvedValue(null);

        // But is preferred cleaner for a home
        UserHomes.findOne.mockResolvedValue({
          id: 1,
          userId: clientId,
          preferredCleanerId: cleanerId,
        });

        ConversationParticipant.findAll.mockResolvedValue([]);
        Conversation.create.mockResolvedValue({
          id: 1,
          conversationType: "cleaner-client",
        });
        ConversationParticipant.create.mockResolvedValue({});
        Conversation.findByPk.mockResolvedValue({
          id: 1,
          conversationType: "cleaner-client",
          participants: [],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ clientUserId: clientId });

        expect(res.status).toBe(200);
        expect(res.body.conversation).toBeDefined();
      });
    });

    describe("Client (Homeowner) Initiating Conversation", () => {
      const cleanerId = 100;
      const clientId = 200;

      it("should create conversation when client specifies cleanerUserId", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({ id: clientId, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce({
            id: clientId,
            type: "homeowner",
            firstName: "Jane",
            lastName: "Client",
          })
          .mockResolvedValueOnce({
            id: cleanerId,
            type: "cleaner",
            firstName: "John",
            lastName: "Cleaner",
          });

        CleanerClient.findOne.mockResolvedValue({
          id: 1,
          cleanerId,
          clientId,
          status: "active",
        });

        ConversationParticipant.findAll.mockResolvedValue([]);
        Conversation.create.mockResolvedValue({
          id: 1,
          conversationType: "cleaner-client",
        });
        ConversationParticipant.create.mockResolvedValue({});
        Conversation.findByPk.mockResolvedValue({
          id: 1,
          conversationType: "cleaner-client",
          participants: [],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ cleanerUserId: cleanerId });

        expect(res.status).toBe(200);
        expect(res.body.conversation).toBeDefined();
      });

      it("should auto-find preferred cleaner if cleanerUserId not specified", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({ id: clientId, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce({
            id: clientId,
            type: "homeowner",
            firstName: "Jane",
            lastName: "Client",
          })
          .mockResolvedValueOnce({
            id: cleanerId,
            type: "cleaner",
            firstName: "John",
            lastName: "Cleaner",
          });

        // Find preferred cleaner from home
        UserHomes.findOne.mockResolvedValue({
          id: 1,
          userId: clientId,
          preferredCleanerId: cleanerId,
        });

        CleanerClient.findOne.mockResolvedValue(null);

        ConversationParticipant.findAll.mockResolvedValue([]);
        Conversation.create.mockResolvedValue({
          id: 1,
          conversationType: "cleaner-client",
        });
        ConversationParticipant.create.mockResolvedValue({});
        Conversation.findByPk.mockResolvedValue({
          id: 1,
          conversationType: "cleaner-client",
          participants: [],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.conversation).toBeDefined();
      });

      it("should return 404 if no preferred cleaner found", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        UserHomes.findOne.mockResolvedValue(null);
        CleanerClient.findOne.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("No preferred cleaner found. Please specify cleanerUserId.");
      });

      it("should return 403 if client has no relationship with specified cleaner", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        CleanerClient.findOne.mockResolvedValue(null);
        UserHomes.findOne.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ cleanerUserId: 999 });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("No active relationship with this cleaner");
      });
    });

    describe("Error Handling", () => {
      it("should return 404 if user not found", async () => {
        const token = jwt.sign({ userId: 999 }, secretKey);

        User.findByPk.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ clientUserId: 100 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("User not found");
      });

      it("should return 404 if client not found", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({ id: 100, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce({
            id: 100,
            type: "cleaner",
          })
          .mockResolvedValueOnce(null); // Client not found

        CleanerClient.findOne.mockResolvedValue({ status: "active" });

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ clientUserId: 999 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Client not found");
      });

      it("should return 404 if cleaner not found", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({ id: 100, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce({
            id: 100,
            type: "homeowner",
          })
          .mockResolvedValueOnce(null); // Cleaner not found

        UserHomes.findOne.mockResolvedValue({ preferredCleanerId: 999 });
        CleanerClient.findOne.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ cleanerUserId: 999 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Cleaner not found");
      });

      it("should return 401 if no token provided", async () => {
        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .send({ clientUserId: 100 });

        expect(res.status).toBe(401);
      });

      it("should return 403 for non-cleaner/homeowner user types", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 100,
          type: "humanResources",
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/cleaner-client")
          .set("Authorization", `Bearer ${token}`)
          .send({ clientUserId: 200 });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only cleaners and homeowners can use this endpoint");
      });
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
