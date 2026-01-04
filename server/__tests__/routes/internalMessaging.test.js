/**
 * Comprehensive tests for Internal Messaging System
 * Tests owner-HR messaging, custom groups, search, and display names
 */

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
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  Message: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
  },
  Conversation: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  ConversationParticipant: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOrCreate: jest.fn(),
  },
  UserAppointments: {},
  Op: {
    or: Symbol("or"),
    and: Symbol("and"),
    in: Symbol("in"),
    ne: Symbol("ne"),
    gt: Symbol("gt"),
    iLike: Symbol("iLike"),
  },
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewMessageNotification: jest.fn().mockResolvedValue(true),
}));

// Mock Push notification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNewMessage: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  Message,
  Conversation,
  ConversationParticipant,
} = require("../../models");

describe("Internal Messaging System", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Mock users
  const mockOwner = {
    id: 1,
    username: "owner1",
    firstName: "John",
    lastName: "Owner",
    type: "owner",
    email: "owner@example.com",
  };

  const mockHR1 = {
    id: 2,
    username: "hr1",
    firstName: "Jane",
    lastName: "Smith",
    type: "humanResources",
    email: "jane@example.com",
  };

  const mockHR2 = {
    id: 3,
    username: "hr2",
    firstName: "Bob",
    lastName: "Jones",
    type: "humanResources",
    email: "bob@example.com",
  };

  const mockHR3 = {
    id: 4,
    username: "hr3",
    firstName: "Sarah",
    lastName: "Wilson",
    type: "humanResources",
    email: "sarah@example.com",
  };

  const mockCleaner = {
    id: 5,
    username: "cleaner1",
    firstName: "Mike",
    lastName: "Clean",
    type: "cleaner",
  };

  const mockHomeowner = {
    id: 6,
    username: "homeowner1",
    firstName: "Alice",
    lastName: "Home",
    type: "homeowner",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.set("io", mockIo);

    const messageRouter = require("../../routes/api/v1/messageRouter");
    app.use("/api/v1/messages", messageRouter);
  });

  // ============================================
  // HR GROUP CHAT TESTS
  // ============================================
  describe("POST /conversation/hr-group - HR Team Group Chat", () => {
    describe("Authorization", () => {
      it("should return 401 without authorization header", async () => {
        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-group");

        expect(res.status).toBe(401);
      });

      it("should return 403 for cleaner user", async () => {
        const token = generateToken(5);
        User.findByPk.mockResolvedValue(mockCleaner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner can access HR group chat");
      });

      it("should return 403 for homeowner user", async () => {
        const token = generateToken(6);
        User.findByPk.mockResolvedValue(mockHomeowner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner can access HR group chat");
      });

      it("should return 403 for HR user trying to create group", async () => {
        const token = generateToken(2);
        User.findByPk.mockResolvedValue(mockHR1);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner can access HR group chat");
      });
    });

    describe("HR Staff Validation", () => {
      it("should return 404 when no HR staff exist", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);
        User.findAll.mockResolvedValue([]);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("No HR staff available");
      });
    });

    describe("Successful Group Creation", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockOwner);
        User.findAll.mockResolvedValue([mockHR1, mockHR2, mockHR3]);
      });

      it("should create new HR Team conversation when none exists", async () => {
        const token = generateToken(1);

        Conversation.findOne.mockResolvedValue(null);
        Conversation.create.mockResolvedValue({
          id: 100,
          conversationType: "internal",
          title: "HR Team",
          createdBy: 1,
        });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({
          id: 100,
          conversationType: "internal",
          title: "HR Team",
          participants: [
            { userId: 1, user: mockOwner },
            { userId: 2, user: mockHR1 },
            { userId: 3, user: mockHR2 },
            { userId: 4, user: mockHR3 },
          ],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(true);
        expect(res.body.conversation.title).toBe("HR Team");
        expect(res.body.conversation.conversationType).toBe("internal");
      });

      it("should add owner and all HR staff as participants", async () => {
        const token = generateToken(1);

        Conversation.findOne.mockResolvedValue(null);
        Conversation.create.mockResolvedValue({ id: 100 });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({
          id: 100,
          participants: [],
        });

        await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        // Owner + 3 HR = 4 participants
        expect(ConversationParticipant.create).toHaveBeenCalledTimes(4);
      });

      it("should return existing HR Team conversation without creating new one", async () => {
        const token = generateToken(1);

        const existingConvo = {
          id: 50,
          conversationType: "internal",
          title: "HR Team",
          participants: [
            { userId: 1, user: mockOwner },
            { userId: 2, user: mockHR1 },
          ],
        };

        Conversation.findOne.mockResolvedValue(existingConvo);
        ConversationParticipant.findOrCreate.mockResolvedValue([{}, false]);
        Conversation.findByPk.mockResolvedValue(existingConvo);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(false);
        expect(Conversation.create).not.toHaveBeenCalled();
      });

      it("should auto-add new HR staff to existing conversation", async () => {
        const token = generateToken(1);

        Conversation.findOne.mockResolvedValue({
          id: 50,
          participants: [{ userId: 1 }, { userId: 2 }],
        });
        ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);
        Conversation.findByPk.mockResolvedValue({ id: 50, participants: [] });

        await request(app)
          .post("/api/v1/messages/conversation/hr-group")
          .set("Authorization", `Bearer ${token}`);

        // Should try to add all 3 HR staff
        expect(ConversationParticipant.findOrCreate).toHaveBeenCalledTimes(3);
      });
    });
  });

  // ============================================
  // DIRECT MESSAGING TESTS
  // ============================================
  describe("POST /conversation/hr-direct - Direct Messaging", () => {
    describe("Authorization", () => {
      it("should return 403 for cleaner user", async () => {
        const token = generateToken(5);
        User.findByPk.mockResolvedValue(mockCleaner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 1 });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner or HR can use this endpoint");
      });

      it("should return 403 for homeowner user", async () => {
        const token = generateToken(6);
        User.findByPk.mockResolvedValue(mockHomeowner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 1 });

        expect(res.status).toBe(403);
      });
    });

    describe("Owner Direct Messaging", () => {
      it("should require targetUserId for owner", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("targetUserId is required for owner");
      });

      it("should reject non-HR target for owner", async () => {
        const token = generateToken(1);
        User.findByPk
          .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockOwner)
          .mockResolvedValueOnce(mockCleaner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 5 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Target must be an HR staff member");
      });

      it("should create 1-on-1 conversation with HR staff", async () => {
        const token = generateToken(1);
        User.findByPk
          .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockOwner)
          .mockResolvedValueOnce(mockHR1);

        ConversationParticipant.findAll.mockResolvedValue([]);
        Conversation.create.mockResolvedValue({
          id: 200,
          conversationType: "internal",
          title: "Direct - Jane Smith",
          createdBy: 1,
        });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({
          id: 200,
          conversationType: "internal",
          title: "Direct - Jane Smith",
          participants: [
            { userId: 1, user: mockOwner },
            { userId: 2, user: mockHR1 },
          ],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 2 });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(true);
      });

      it("should notify target user via socket", async () => {
        const token = generateToken(1);
        User.findByPk
          .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockOwner)
          .mockResolvedValueOnce(mockHR1);

        ConversationParticipant.findAll.mockResolvedValue([]);
        Conversation.create.mockResolvedValue({ id: 200, createdBy: 1 });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 200, participants: [] });

        await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 2 });

        expect(mockIo.to).toHaveBeenCalledWith("user_2");
        expect(mockIo.emit).toHaveBeenCalledWith(
          "new_internal_conversation",
          expect.objectContaining({
            conversationId: 200,
            initiator: expect.objectContaining({ id: 1 }),
          })
        );
      });
    });

    describe("HR Direct Messaging", () => {
      it("should default to owner when no targetUserId provided", async () => {
        const token = generateToken(2);
        User.findByPk
          .mockResolvedValueOnce({ id: 2, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockHR1);
        User.findOne.mockResolvedValue(mockOwner);

        ConversationParticipant.findAll.mockResolvedValue([]);
        Conversation.create.mockResolvedValue({ id: 201, createdBy: 2 });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 201, participants: [] });

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(true);
        expect(User.findOne).toHaveBeenCalledWith({
          where: { type: "owner" },
        });
      });

      it("should allow HR to message another HR", async () => {
        const token = generateToken(2);
        User.findByPk
          .mockResolvedValueOnce({ id: 2, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockHR1)
          .mockResolvedValueOnce(mockHR2);

        ConversationParticipant.findAll.mockResolvedValue([]);
        Conversation.create.mockResolvedValue({
          id: 202,
          title: "Direct - Bob Jones",
          createdBy: 2,
        });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({
          id: 202,
          title: "Direct - Bob Jones",
          participants: [],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 3 });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(true);
      });

      it("should prevent HR from messaging themselves", async () => {
        const token = generateToken(2);
        User.findByPk
          .mockResolvedValueOnce({ id: 2, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockHR1)
          .mockResolvedValueOnce(mockHR1);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 2 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Cannot message yourself");
      });

      it("should reject HR messaging a cleaner", async () => {
        const token = generateToken(2);
        User.findByPk
          .mockResolvedValueOnce({ id: 2, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockHR1)
          .mockResolvedValueOnce(mockCleaner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 5 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Target must be owner or HR staff");
      });
    });

    describe("Existing Conversation Detection", () => {
      it("should return existing conversation without creating new", async () => {
        const token = generateToken(1);
        User.findByPk
          .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockOwner)
          .mockResolvedValueOnce(mockHR1);

        // Existing conversation with exactly 2 participants
        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 300,
            conversation: {
              id: 300,
              conversationType: "internal",
              participants: [{ userId: 1 }, { userId: 2 }],
            },
          },
        ]);

        Conversation.findByPk.mockResolvedValue({
          id: 300,
          conversationType: "internal",
          title: "Direct - Jane Smith",
          participants: [],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 2 });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(false);
        expect(Conversation.create).not.toHaveBeenCalled();
      });

      it("should not match group conversations (3+ participants)", async () => {
        const token = generateToken(1);
        User.findByPk
          .mockResolvedValueOnce({ id: 1, accountFrozen: false }) // Middleware call
          .mockResolvedValueOnce(mockOwner)
          .mockResolvedValueOnce(mockHR1);

        // Existing group conversation with 3 participants
        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 301,
            conversation: {
              id: 301,
              conversationType: "internal",
              participants: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
            },
          },
        ]);

        Conversation.create.mockResolvedValue({ id: 302, createdBy: 1 });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 302, participants: [] });

        const res = await request(app)
          .post("/api/v1/messages/conversation/hr-direct")
          .set("Authorization", `Bearer ${token}`)
          .send({ targetUserId: 2 });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(true);
        expect(Conversation.create).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // CUSTOM GROUP TESTS
  // ============================================
  describe("POST /conversation/custom-group - Custom Group Creation", () => {
    describe("Authorization", () => {
      it("should return 403 for cleaner", async () => {
        const token = generateToken(5);
        User.findByPk.mockResolvedValue(mockCleaner);

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 3] });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner or HR can create custom groups");
      });

      it("should allow owner to create custom group", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);
        User.findAll.mockResolvedValue([mockHR1, mockHR2]);

        Conversation.create.mockResolvedValue({
          id: 400,
          conversationType: "internal",
          title: "Jane, Bob",
          createdBy: 1,
        });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({
          id: 400,
          participants: [],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 3] });

        expect(res.status).toBe(201);
      });

      it("should allow HR to create custom group", async () => {
        const token = generateToken(2);
        User.findByPk.mockResolvedValue(mockHR1);
        User.findAll.mockResolvedValue([mockOwner, mockHR2]);

        Conversation.create.mockResolvedValue({ id: 401, createdBy: 2 });
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 401, participants: [] });

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [1, 3] });

        expect(res.status).toBe(201);
      });
    });

    describe("Member Validation", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockOwner);
      });

      it("should return 400 when memberIds is missing", async () => {
        const token = generateToken(1);

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("At least one member is required");
      });

      it("should return 400 when memberIds is empty", async () => {
        const token = generateToken(1);

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("At least one member is required");
      });

      it("should return 400 when only creator is in memberIds", async () => {
        const token = generateToken(1);

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [1] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("At least one other member is required");
      });

      it("should return 400 when some members are invalid", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1]); // Only returns 1 valid user

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 999] }); // 999 is invalid

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("All members must be valid owner or HR staff");
      });

      it("should return 400 when member is a cleaner", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1]); // Cleaner not returned

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 5] }); // 5 is cleaner

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("All members must be valid owner or HR staff");
      });
    });

    describe("Successful Custom Group Creation", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockOwner);
        ConversationParticipant.create.mockResolvedValue({ id: 1 });
      });

      it("should create group with selected members only", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR3]); // Jane and Sarah, NOT Bob

        Conversation.create.mockResolvedValue({
          id: 402,
          conversationType: "internal",
          title: "Jane, Sarah",
          createdBy: 1,
        });
        Conversation.findByPk.mockResolvedValue({
          id: 402,
          participants: [],
        });

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 4] }); // Jane and Sarah

        expect(res.status).toBe(201);
        expect(res.body.memberNames).toHaveLength(2);
        expect(res.body.memberNames.map((m) => m.id)).toContain(2);
        expect(res.body.memberNames.map((m) => m.id)).toContain(4);
        expect(res.body.memberNames.map((m) => m.id)).not.toContain(3); // Bob not included
      });

      it("should auto-generate title from member names", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR2, mockHR3]);

        Conversation.create.mockResolvedValue({
          id: 403,
          title: "Jane, Bob, Sarah",
          createdBy: 1,
        });
        Conversation.findByPk.mockResolvedValue({ id: 403, participants: [] });

        await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 3, 4] });

        expect(Conversation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Jane, Bob, Sarah",
          })
        );
      });

      it("should truncate title for many members", async () => {
        const token = generateToken(1);
        const manyHR = [
          { id: 2, firstName: "A", type: "humanResources" },
          { id: 3, firstName: "B", type: "humanResources" },
          { id: 4, firstName: "C", type: "humanResources" },
          { id: 5, firstName: "D", type: "humanResources" },
          { id: 6, firstName: "E", type: "humanResources" },
        ];
        User.findAll.mockResolvedValue(manyHR);

        Conversation.create.mockResolvedValue({ id: 404, createdBy: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 404, participants: [] });

        await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 3, 4, 5, 6] });

        expect(Conversation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "A, B, C +2 more",
          })
        );
      });

      it("should use custom title when provided", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR2]);

        Conversation.create.mockResolvedValue({ id: 405, createdBy: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 405, participants: [] });

        await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 3], title: "Project Alpha Team" });

        expect(Conversation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Project Alpha Team",
          })
        );
      });

      it("should remove duplicate member IDs", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1]);

        Conversation.create.mockResolvedValue({ id: 406, createdBy: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 406, participants: [] });

        await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 2, 2, 2] });

        // Should only create 2 participants (owner + 1 unique HR)
        expect(ConversationParticipant.create).toHaveBeenCalledTimes(2);
      });

      it("should notify all members via socket", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR2, mockHR3]);

        Conversation.create.mockResolvedValue({ id: 407, createdBy: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 407, participants: [] });

        await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 3, 4] });

        expect(mockIo.to).toHaveBeenCalledWith("user_2");
        expect(mockIo.to).toHaveBeenCalledWith("user_3");
        expect(mockIo.to).toHaveBeenCalledWith("user_4");
        expect(mockIo.emit).toHaveBeenCalledWith(
          "new_internal_conversation",
          expect.objectContaining({ isGroup: true })
        );
      });

      it("should return memberNames with display names", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR2]);

        Conversation.create.mockResolvedValue({ id: 408, createdBy: 1 });
        Conversation.findByPk.mockResolvedValue({ id: 408, participants: [] });

        const res = await request(app)
          .post("/api/v1/messages/conversation/custom-group")
          .set("Authorization", `Bearer ${token}`)
          .send({ memberIds: [2, 3] });

        expect(res.status).toBe(201);
        expect(res.body.memberNames).toEqual([
          { id: 2, name: "Jane Smith" },
          { id: 3, name: "Bob Jones" },
        ]);
      });
    });
  });

  // ============================================
  // STAFF SEARCH TESTS
  // ============================================
  describe("GET /staff - Staff List with Search", () => {
    describe("Authorization", () => {
      it("should return 403 for cleaner", async () => {
        const token = generateToken(5);
        User.findByPk.mockResolvedValue(mockCleaner);

        const res = await request(app)
          .get("/api/v1/messages/staff")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner or HR can access this endpoint");
      });

      it("should return 403 for homeowner", async () => {
        const token = generateToken(6);
        User.findByPk.mockResolvedValue(mockHomeowner);

        const res = await request(app)
          .get("/api/v1/messages/staff")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
      });
    });

    describe("Owner Staff List", () => {
      it("should return all HR staff for owner", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);
        User.findAll.mockResolvedValue([mockHR1, mockHR2, mockHR3]);

        const res = await request(app)
          .get("/api/v1/messages/staff")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(3);
        res.body.staff.forEach((s) => {
          expect(s.type).toBe("humanResources");
        });
      });
    });

    describe("HR Staff List", () => {
      it("should return owner and other HR for HR user", async () => {
        const token = generateToken(2);
        User.findByPk.mockResolvedValue(mockHR1);
        User.findAll.mockResolvedValue([mockOwner, mockHR2, mockHR3]);

        const res = await request(app)
          .get("/api/v1/messages/staff")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(3);

        const ids = res.body.staff.map((s) => s.id);
        expect(ids).toContain(1); // owner
        expect(ids).toContain(3); // other HR
        expect(ids).toContain(4); // other HR
        expect(ids).not.toContain(2); // self excluded
      });
    });

    describe("Search Functionality", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockOwner);
      });

      it("should filter by first name", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1]);

        const res = await request(app)
          .get("/api/v1/messages/staff?search=jane")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(1);
        expect(res.body.staff[0].firstName).toBe("Jane");
      });

      it("should filter by last name", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR2]);

        const res = await request(app)
          .get("/api/v1/messages/staff?search=jones")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(1);
        expect(res.body.staff[0].lastName).toBe("Jones");
      });

      it("should filter by username", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR3]);

        const res = await request(app)
          .get("/api/v1/messages/staff?search=hr3")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(1);
        expect(res.body.staff[0].username).toBe("hr3");
      });

      it("should be case insensitive", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1]);

        const res = await request(app)
          .get("/api/v1/messages/staff?search=JANE")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(1);
      });

      it("should return empty array when no matches", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([]);

        const res = await request(app)
          .get("/api/v1/messages/staff?search=nonexistent")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(0);
      });

      it("should handle empty search string", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR2, mockHR3]);

        const res = await request(app)
          .get("/api/v1/messages/staff?search=")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(3);
      });

      it("should handle whitespace-only search", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR2, mockHR3]);

        const res = await request(app)
          .get("/api/v1/messages/staff?search=%20%20%20")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.staff).toHaveLength(3);
      });

      it("should return sorted results", async () => {
        const token = generateToken(1);
        User.findAll.mockResolvedValue([mockHR1, mockHR2, mockHR3]);

        await request(app)
          .get("/api/v1/messages/staff")
          .set("Authorization", `Bearer ${token}`);

        expect(User.findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            order: [["firstName", "ASC"], ["lastName", "ASC"]],
          })
        );
      });
    });
  });

  // ============================================
  // INTERNAL CONVERSATIONS LIST TESTS
  // ============================================
  describe("GET /conversations/internal - Internal Conversations List", () => {
    describe("Authorization", () => {
      it("should return 403 for cleaner", async () => {
        const token = generateToken(5);
        User.findByPk.mockResolvedValue(mockCleaner);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner or HR can access internal conversations");
      });

      it("should return 403 for homeowner", async () => {
        const token = generateToken(6);
        User.findByPk.mockResolvedValue(mockHomeowner);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
      });
    });

    describe("Display Names", () => {
      it("should include displayName for 1-on-1 conversation", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);

        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 500,
            lastReadAt: new Date(),
            conversation: {
              id: 500,
              conversationType: "internal",
              title: "Direct - Jane Smith",
              updatedAt: new Date(),
              messages: [],
              participants: [
                { user: { id: 1, username: "owner1", firstName: "John", lastName: "Owner", type: "owner" } },
                { user: { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" } },
              ],
            },
          },
        ]);
        Message.count.mockResolvedValue(0);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.conversations[0].displayName).toBe("Jane Smith");
        expect(res.body.conversations[0].isGroupChat).toBe(false);
      });

      it("should include displayName for group conversation", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);

        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 501,
            lastReadAt: new Date(),
            conversation: {
              id: 501,
              conversationType: "internal",
              title: "HR Team",
              updatedAt: new Date(),
              messages: [],
              participants: [
                { user: { id: 1, username: "owner1", firstName: "John", lastName: "Owner", type: "owner" } },
                { user: { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" } },
                { user: { id: 3, username: "hr2", firstName: "Bob", lastName: "Jones", type: "humanResources" } },
              ],
            },
          },
        ]);
        Message.count.mockResolvedValue(0);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.conversations[0].displayName).toBe("Jane, Bob");
        expect(res.body.conversations[0].isGroupChat).toBe(true);
      });

      it("should include otherParticipants array", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);

        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 502,
            lastReadAt: new Date(),
            conversation: {
              id: 502,
              conversationType: "internal",
              title: "Direct",
              updatedAt: new Date(),
              messages: [],
              participants: [
                { user: { id: 1, username: "owner1", firstName: "John", lastName: "Owner", type: "owner" } },
                { user: { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" } },
              ],
            },
          },
        ]);
        Message.count.mockResolvedValue(0);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.conversations[0].otherParticipants).toHaveLength(1);
        expect(res.body.conversations[0].otherParticipants[0].id).toBe(2);
        expect(res.body.conversations[0].otherParticipants[0].displayName).toBe("Jane Smith");
      });

      it("should include displayName in lastMessage sender", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);

        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 503,
            lastReadAt: new Date(),
            conversation: {
              id: 503,
              conversationType: "internal",
              title: "Chat",
              updatedAt: new Date(),
              messages: [
                {
                  content: "Hello!",
                  createdAt: new Date(),
                  sender: { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith" },
                },
              ],
              participants: [
                { user: { id: 1, username: "owner1", firstName: "John", lastName: "Owner", type: "owner" } },
                { user: { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" } },
              ],
            },
          },
        ]);
        Message.count.mockResolvedValue(1);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.conversations[0].lastMessage.sender.displayName).toBe("Jane Smith");
      });
    });

    describe("Unread Counts", () => {
      it("should calculate unread count correctly", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);

        ConversationParticipant.findAll.mockResolvedValue([
          {
            conversationId: 504,
            lastReadAt: new Date("2025-01-01"),
            conversation: {
              id: 504,
              conversationType: "internal",
              title: "Chat",
              updatedAt: new Date(),
              messages: [],
              participants: [
                { user: { id: 1, username: "owner1", firstName: "John", lastName: "Owner", type: "owner" } },
                { user: { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" } },
              ],
            },
          },
        ]);
        Message.count.mockResolvedValue(5);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.conversations[0].unreadCount).toBe(5);
      });
    });

    describe("Empty State", () => {
      it("should return empty array when no internal conversations", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);
        ConversationParticipant.findAll.mockResolvedValue([]);

        const res = await request(app)
          .get("/api/v1/messages/conversations/internal")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.conversations).toHaveLength(0);
      });
    });
  });
});
