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
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  Message: {
    create: jest.fn(),
    findAll: jest.fn(),
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
  Op: {
    or: Symbol("or"),
    in: Symbol("in"),
    ne: Symbol("ne"),
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
  Conversation,
  ConversationParticipant,
} = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");

describe("Message Routes - HR Integration", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.set("io", mockIo);

    const messageRouter = require("../../routes/api/v1/messageRouter");
    app.use("/api/v1/messages", messageRouter);
  });

  describe("POST /conversation/support - HR User Restriction", () => {
    it("should prevent HR user from creating support conversation", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hrstaff",
        type: "humanResources",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Owners and HR cannot create support conversations");
    });

    it("should prevent owner from creating support conversation", async () => {
      const token = generateToken(1);

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

  describe("POST /conversation/support - HR Added as Participant", () => {
    it("should add all HR users to new support conversation", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: null,
      });

      // Mock finding all support staff (owners + HR)
      User.findAll.mockResolvedValue([
        { id: 2, username: "owner1", type: "owner", email: "owner@example.com" },
        { id: 3, username: "hr1", type: "humanResources", email: "hr1@example.com" },
        { id: 4, username: "hr2", type: "humanResources", email: "hr2@example.com" },
      ]);

      ConversationParticipant.findAll.mockResolvedValue([]);
      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);

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
          { userId: 3, user: { id: 3, username: "hr1" } },
          { userId: 4, user: { id: 4, username: "hr2" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Verify findAll was called to get support staff (owners + HR)
      expect(User.findAll).toHaveBeenCalled();

      // Verify all support staff were added as participants
      expect(ConversationParticipant.findOrCreate).toHaveBeenCalledTimes(3);
    });

    it("should NOT send notifications when support conversation is created (only on message send)", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: "homeowner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "owner1", type: "owner", email: "owner@example.com" },
        { id: 3, username: "hr1", type: "humanResources", email: "hr1@example.com" },
      ]);

      ConversationParticipant.findAll.mockResolvedValue([]);
      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        createdBy: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        participants: [],
      });

      await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      // Notifications should NOT be sent when conversation is created
      // They are sent when the user actually sends a message via /send endpoint
      expect(mockIo.emit).not.toHaveBeenCalledWith("new_support_conversation", expect.any(Object));
    });

    it("should NOT send email notifications when creating support conversation", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: "cleaner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "owner1", type: "owner", email: "owner@example.com" },
        { id: 3, username: "hr1", type: "humanResources", email: "hr1@example.com" },
        { id: 4, username: "hr2", type: "humanResources", email: "hr2@example.com" },
      ]);

      ConversationParticipant.findAll.mockResolvedValue([]);
      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        createdBy: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        participants: [],
      });

      await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      // Notifications should NOT be sent when conversation is created
      // They are sent when the user actually sends a message via /send endpoint
      expect(Email.sendNewMessageNotification).not.toHaveBeenCalled();
    });
  });

  describe("Support Conversation - Multiple HR Staff", () => {
    it("should handle case with no HR users (only owner)", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: null,
      });

      // Only owner, no HR users
      User.findAll.mockResolvedValue([
        { id: 2, username: "owner1", type: "owner", email: "owner@example.com" },
      ]);

      ConversationParticipant.findAll.mockResolvedValue([]);
      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        createdBy: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(ConversationParticipant.findOrCreate).toHaveBeenCalledTimes(1);
    });

    it("should handle case with many HR users", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: null,
      });

      // Multiple HR users
      User.findAll.mockResolvedValue([
        { id: 2, username: "owner1", type: "owner", email: "owner@example.com" },
        { id: 3, username: "hr1", type: "humanResources", email: "hr1@example.com" },
        { id: 4, username: "hr2", type: "humanResources", email: "hr2@example.com" },
        { id: 5, username: "hr3", type: "humanResources", email: "hr3@example.com" },
        { id: 6, username: "hr4", type: "humanResources", email: "hr4@example.com" },
        { id: 7, username: "hr5", type: "humanResources", email: "hr5@example.com" },
      ]);

      ConversationParticipant.findAll.mockResolvedValue([]);
      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.create.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        createdBy: 1,
      });

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        title: "Support - testuser",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // 1 owner + 5 HR = 6 support staff
      expect(ConversationParticipant.findOrCreate).toHaveBeenCalledTimes(6);
    });
  });

  describe("Error Handling with HR", () => {
    it("should return 404 when no support staff found", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        type: null,
      });

      // No support staff available
      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/messages/conversation/support")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("No support staff available");
    });
  });

  describe("POST /conversation/hr-group - HR Team Group Chat", () => {
    it("should return 403 for non-owner users", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hrstaff",
        type: "humanResources",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-group")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can access HR group chat");
    });

    it("should return 404 when no HR staff available", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-group")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("No HR staff available");
    });

    it("should create new HR Team conversation if none exists", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Jane", lastName: "HR" },
        { id: 3, username: "hr2", firstName: "Bob", lastName: "HR" },
      ]);

      Conversation.findOne.mockResolvedValue(null);
      Conversation.create.mockResolvedValue({
        id: 10,
        conversationType: "internal",
        title: "HR Team",
        createdBy: 1,
      });
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 10,
        conversationType: "internal",
        title: "HR Team",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1", type: "owner" } },
          { userId: 2, user: { id: 2, username: "hr1", type: "humanResources" } },
          { userId: 3, user: { id: 3, username: "hr2", type: "humanResources" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-group")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
      expect(res.body.conversation.title).toBe("HR Team");
      expect(Conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationType: "internal",
          title: "HR Team",
        })
      );
    });

    it("should return existing HR Team conversation", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1" },
      ]);

      Conversation.findOne.mockResolvedValue({
        id: 5,
        conversationType: "internal",
        title: "HR Team",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1" } },
          { userId: 2, user: { id: 2, username: "hr1" } },
        ],
      });

      ConversationParticipant.findOrCreate.mockResolvedValue([{}, false]);

      Conversation.findByPk.mockResolvedValue({
        id: 5,
        conversationType: "internal",
        title: "HR Team",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-group")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(false);
    });
  });

  describe("POST /conversation/hr-direct - Direct Messaging", () => {
    it("should return 403 for non-owner/non-HR users", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner or HR can use this endpoint");
    });

    it("should require targetUserId for owner", async () => {
      const token = generateToken(1);

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

    it("should validate owner can only message HR staff", async () => {
      const token = generateToken(1);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, username: "owner1", type: "owner" })
        .mockResolvedValueOnce({ id: 2, username: "cleaner1", type: "cleaner" });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Target must be an HR staff member");
    });

    it("should create 1-on-1 conversation for owner messaging HR", async () => {
      const token = generateToken(1);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, username: "owner1", type: "owner" })
        .mockResolvedValueOnce({ id: 2, username: "hr1", type: "humanResources", firstName: "Jane", lastName: "Doe" });

      ConversationParticipant.findAll.mockResolvedValue([]);
      Conversation.create.mockResolvedValue({
        id: 15,
        conversationType: "internal",
        title: "Direct - Jane Doe",
        createdBy: 1,
      });
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 15,
        conversationType: "internal",
        title: "Direct - Jane Doe",
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
      expect(res.body.created).toBe(true);
      expect(mockIo.to).toHaveBeenCalledWith("user_2");
      expect(mockIo.emit).toHaveBeenCalledWith("new_internal_conversation", expect.any(Object));
    });

    it("should allow HR to message owner without specifying targetUserId", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValueOnce({
        id: 1,
        username: "hr1",
        type: "humanResources",
      });

      User.findOne.mockResolvedValue({
        id: 2,
        username: "owner1",
        type: "owner",
        firstName: "Owner",
        lastName: "Name",
      });

      ConversationParticipant.findAll.mockResolvedValue([]);
      Conversation.create.mockResolvedValue({
        id: 20,
        conversationType: "internal",
        title: "Direct - Owner Name",
        createdBy: 1,
      });
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 20,
        conversationType: "internal",
        title: "Direct - Owner Name",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
    });

    it("should allow HR to message another HR", async () => {
      const token = generateToken(1);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, username: "hr1", type: "humanResources" })
        .mockResolvedValueOnce({ id: 3, username: "hr2", type: "humanResources", firstName: "Bob", lastName: "Jones" });

      ConversationParticipant.findAll.mockResolvedValue([]);
      Conversation.create.mockResolvedValue({
        id: 25,
        conversationType: "internal",
        title: "Direct - Bob Jones",
        createdBy: 1,
      });
      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 25,
        conversationType: "internal",
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
      const token = generateToken(1);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, username: "hr1", type: "humanResources" })
        .mockResolvedValueOnce({ id: 1, username: "hr1", type: "humanResources" });

      const res = await request(app)
        .post("/api/v1/messages/conversation/hr-direct")
        .set("Authorization", `Bearer ${token}`)
        .send({ targetUserId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot message yourself");
    });

    it("should return existing conversation instead of creating new one", async () => {
      const token = generateToken(1);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, username: "owner1", type: "owner" })
        .mockResolvedValueOnce({ id: 2, username: "hr1", type: "humanResources" });

      ConversationParticipant.findAll.mockResolvedValue([
        {
          conversationId: 30,
          conversation: {
            id: 30,
            conversationType: "internal",
            participants: [
              { userId: 1 },
              { userId: 2 },
            ],
          },
        },
      ]);

      Conversation.findByPk.mockResolvedValue({
        id: 30,
        conversationType: "internal",
        title: "Direct - HR1",
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
  });

  describe("GET /staff - Staff List", () => {
    it("should return 403 for non-owner/non-HR users", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .get("/api/v1/messages/staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner or HR can access this endpoint");
    });

    it("should return all HR staff for owner", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Jane", lastName: "HR", type: "humanResources" },
        { id: 3, username: "hr2", firstName: "Bob", lastName: "HR", type: "humanResources" },
      ]);

      const res = await request(app)
        .get("/api/v1/messages/staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.staff).toHaveLength(2);
      expect(res.body.staff[0].type).toBe("humanResources");
    });

    it("should return owner and other HR staff for HR user (excluding self)", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hr1",
        type: "humanResources",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "owner1", firstName: "Owner", lastName: "Name", type: "owner" },
        { id: 3, username: "hr2", firstName: "Bob", lastName: "HR", type: "humanResources" },
      ]);

      const res = await request(app)
        .get("/api/v1/messages/staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.staff).toHaveLength(2);
      // Should include owner and other HR, but not self (id: 1)
      const userIds = res.body.staff.map((s) => s.id);
      expect(userIds).toContain(2);
      expect(userIds).toContain(3);
      expect(userIds).not.toContain(1);
    });

    it("should filter staff by search query", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "janehr", firstName: "Jane", lastName: "Smith", type: "humanResources" },
      ]);

      const res = await request(app)
        .get("/api/v1/messages/staff?search=jane")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.staff).toHaveLength(1);
      expect(res.body.staff[0].firstName).toBe("Jane");
    });

    it("should return empty array when search has no matches", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/messages/staff?search=nonexistent")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.staff).toHaveLength(0);
    });
  });

  describe("POST /conversation/custom-group - Custom Group Creation", () => {
    it("should return 403 for non-owner/non-HR users", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({ memberIds: [2, 3] });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner or HR can create custom groups");
    });

    it("should return 400 when no members provided", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({ memberIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("At least one member is required");
    });

    it("should return 400 when only self is in memberIds", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({ memberIds: [1] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("At least one other member is required");
    });

    it("should return 400 when member is not owner or HR", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      // Only returns 1 valid user when 2 were requested
      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Jane", lastName: "HR", type: "humanResources" },
      ]);

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({ memberIds: [2, 99] }); // 99 is invalid

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("All members must be valid owner or HR staff");
    });

    it("should create custom group with selected members", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Greg", lastName: "Smith", type: "humanResources" },
        { id: 3, username: "hr2", firstName: "Sarah", lastName: "Jones", type: "humanResources" },
        { id: 4, username: "hr3", firstName: "Steven", lastName: "Brown", type: "humanResources" },
      ]);

      Conversation.create.mockResolvedValue({
        id: 50,
        conversationType: "internal",
        title: "Greg, Sarah, Steven",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 50,
        conversationType: "internal",
        title: "Greg, Sarah, Steven",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1" } },
          { userId: 2, user: { id: 2, username: "hr1", firstName: "Greg" } },
          { userId: 3, user: { id: 3, username: "hr2", firstName: "Sarah" } },
          { userId: 4, user: { id: 4, username: "hr3", firstName: "Steven" } },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({ memberIds: [2, 3, 4] });

      expect(res.status).toBe(201);
      expect(res.body.conversation.title).toBe("Greg, Sarah, Steven");
      expect(res.body.memberNames).toHaveLength(3);
      // Verify socket notifications were sent
      expect(mockIo.to).toHaveBeenCalledWith("user_2");
      expect(mockIo.to).toHaveBeenCalledWith("user_3");
      expect(mockIo.to).toHaveBeenCalledWith("user_4");
    });

    it("should use custom title when provided", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Greg", lastName: "Smith", type: "humanResources" },
        { id: 3, username: "hr2", firstName: "Sarah", lastName: "Jones", type: "humanResources" },
      ]);

      Conversation.create.mockResolvedValue({
        id: 51,
        conversationType: "internal",
        title: "Project Team",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 51,
        conversationType: "internal",
        title: "Project Team",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({ memberIds: [2, 3], title: "Project Team" });

      expect(res.status).toBe(201);
      expect(Conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Project Team",
        })
      );
    });

    it("should remove duplicate member IDs", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      User.findAll.mockResolvedValue([
        { id: 2, username: "hr1", firstName: "Greg", lastName: "Smith", type: "humanResources" },
      ]);

      Conversation.create.mockResolvedValue({
        id: 52,
        conversationType: "internal",
        title: "Greg",
        createdBy: 1,
      });

      ConversationParticipant.create.mockResolvedValue({ id: 1 });

      Conversation.findByPk.mockResolvedValue({
        id: 52,
        conversationType: "internal",
        title: "Greg",
        participants: [],
      });

      const res = await request(app)
        .post("/api/v1/messages/conversation/custom-group")
        .set("Authorization", `Bearer ${token}`)
        .send({ memberIds: [2, 2, 2] }); // duplicates

      expect(res.status).toBe(201);
      // Should only create 2 participants (owner + 1 HR)
      expect(ConversationParticipant.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("GET /conversations/internal - Internal Conversations List", () => {
    it("should return 403 for non-owner/non-HR users", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .get("/api/v1/messages/conversations/internal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner or HR can access internal conversations");
    });

    it("should return internal conversations for owner", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      ConversationParticipant.findAll.mockResolvedValue([
        {
          conversationId: 10,
          lastReadAt: new Date(),
          conversation: {
            id: 10,
            conversationType: "internal",
            title: "HR Team",
            updatedAt: new Date(),
            messages: [
              {
                content: "Hello team!",
                sender: { id: 1, username: "owner1" },
                createdAt: new Date(),
              },
            ],
            participants: [
              { user: { id: 1, username: "owner1", type: "owner" } },
              { user: { id: 2, username: "hr1", type: "humanResources" } },
              { user: { id: 3, username: "hr2", type: "humanResources" } },
            ],
          },
        },
        {
          conversationId: 15,
          lastReadAt: new Date(),
          conversation: {
            id: 15,
            conversationType: "internal",
            title: "Direct - Jane HR",
            updatedAt: new Date(),
            messages: [],
            participants: [
              { user: { id: 1, username: "owner1", type: "owner" } },
              { user: { id: 2, username: "hr1", type: "humanResources" } },
            ],
          },
        },
      ]);

      const { Message } = require("../../models");
      Message.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/v1/messages/conversations/internal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(2);
      expect(res.body.conversations[0].isGroupChat).toBe(true); // 3 participants
      expect(res.body.conversations[1].isGroupChat).toBe(false); // 2 participants
    });

    it("should return internal conversations for HR", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hr1",
        type: "humanResources",
      });

      ConversationParticipant.findAll.mockResolvedValue([
        {
          conversationId: 10,
          lastReadAt: new Date(),
          conversation: {
            id: 10,
            conversationType: "internal",
            title: "HR Team",
            updatedAt: new Date(),
            messages: [],
            participants: [
              { user: { id: 1, username: "hr1", type: "humanResources" } },
              { user: { id: 2, username: "owner1", type: "owner" } },
            ],
          },
        },
      ]);

      const { Message } = require("../../models");
      Message.count.mockResolvedValue(2);

      const res = await request(app)
        .get("/api/v1/messages/conversations/internal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].unreadCount).toBe(2);
    });

    it("should return empty array when no internal conversations exist", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      ConversationParticipant.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/messages/conversations/internal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(0);
    });
  });
});
