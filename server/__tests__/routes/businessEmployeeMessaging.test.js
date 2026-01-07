const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Message: {
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  Conversation: {
    create: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  ConversationParticipant: {
    create: jest.fn(),
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserAppointments: {},
  MessageReaction: {},
  MessageReadReceipt: {},
  CleanerClient: {},
  UserHomes: {},
  SuspiciousActivityReport: {},
}));

// Mock services
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
  sendToUser: jest.fn().mockResolvedValue(true),
  sendPush: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/SuspiciousContentDetector", () => ({
  analyze: jest.fn().mockReturnValue({ isSuspicious: false }),
}));

jest.mock("../../services/EncryptionService", () => ({
  encrypt: jest.fn((val) => val),
  decrypt: jest.fn((val) => val),
}));

const {
  User,
  Message,
  Conversation,
  ConversationParticipant,
  BusinessEmployee,
} = require("../../models");

describe("Business Employee Messaging Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  // Test users
  const mockBusinessOwner = {
    id: 1,
    username: "businessowner",
    isBusinessOwner: true,
    employeeOfBusinessId: null,
    firstName: "John",
    lastName: "Owner",
    expoPushToken: "ExponentPushToken[xxx]",
  };

  const mockEmployee = {
    id: 2,
    username: "employee1",
    isBusinessOwner: false,
    employeeOfBusinessId: 1,
    firstName: "Jane",
    lastName: "Employee",
    expoPushToken: "ExponentPushToken[yyy]",
  };

  const mockBusinessEmployee = {
    id: 10,
    businessOwnerId: 1,
    userId: 2,
    firstName: "Jane",
    lastName: "Employee",
    status: "active",
    canMessageClients: true,
    user: mockEmployee,
  };

  const generateToken = (userId) => {
    return jwt.sign({ id: userId }, secretKey, { expiresIn: "1h" });
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.set("io", { to: jest.fn().mockReturnThis(), emit: jest.fn() });

    const messageRouter = require("../../routes/api/v1/messageRouter");
    app.use("/api/v1/messages", messageRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /business-employees", () => {
    it("should return list of employees for business owner", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      BusinessEmployee.findAll.mockResolvedValue([
        {
          id: 10,
          userId: 2,
          firstName: "Jane",
          lastName: "Employee",
          canMessageClients: true,
          user: { id: 2, firstName: "Jane", lastName: "Employee" },
        },
        {
          id: 11,
          userId: 3,
          firstName: "Bob",
          lastName: "Worker",
          canMessageClients: false,
          user: { id: 3, firstName: "Bob", lastName: "Worker" },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/messages/business-employees")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(2);
      expect(res.body.employees[0].firstName).toBe("Jane");
      expect(res.body.employees[1].firstName).toBe("Bob");
    });

    it("should return 403 for non-business owner", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .get("/api/v1/messages/business-employees")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("business owners");
    });

    it("should return empty array when no employees", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      BusinessEmployee.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/messages/business-employees")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(0);
    });
  });

  describe("POST /employee-conversation", () => {
    it("should create new conversation between business owner and employee", async () => {
      const token = generateToken(1);

      User.findByPk
        .mockResolvedValueOnce(mockBusinessOwner) // For auth check
        .mockResolvedValueOnce(mockBusinessOwner) // For business owner lookup
        .mockResolvedValueOnce(mockEmployee); // For employee user lookup

      BusinessEmployee.findOne.mockResolvedValue({
        ...mockBusinessEmployee,
        user: mockEmployee,
      });

      Conversation.findOne.mockResolvedValue(null); // No existing conversation

      const mockCreatedConversation = {
        id: 100,
        conversationType: "business_employee",
        title: "John & Jane",
        relatedEntityId: 10,
      };

      Conversation.create.mockResolvedValue(mockCreatedConversation);
      ConversationParticipant.bulkCreate.mockResolvedValue([]);
      Conversation.findByPk.mockResolvedValue({
        ...mockCreatedConversation,
        participants: [
          { userId: 1, role: "business_owner", user: mockBusinessOwner },
          { userId: 2, role: "employee", user: mockEmployee },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/employee-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ employeeId: 10 });

      expect(res.status).toBe(201);
      expect(res.body.conversation).toBeDefined();
      expect(res.body.conversation.conversationType).toBe("business_employee");
    });

    it("should return existing conversation if one exists", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      BusinessEmployee.findOne.mockResolvedValue({
        ...mockBusinessEmployee,
        user: mockEmployee,
      });

      const existingConversation = {
        id: 100,
        conversationType: "business_employee",
        relatedEntityId: 10,
        participants: [
          { userId: 1, role: "business_owner", user: mockBusinessOwner },
          { userId: 2, role: "employee", user: mockEmployee },
        ],
        toJSON: function() { return this; },
      };

      Conversation.findOne.mockResolvedValue(existingConversation);

      const res = await request(app)
        .post("/api/v1/messages/employee-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ employeeId: 10 });

      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(100);
      expect(Conversation.create).not.toHaveBeenCalled();
    });

    it("should allow employee to start conversation with business owner", async () => {
      const token = generateToken(2);

      User.findByPk
        .mockResolvedValueOnce(mockEmployee) // For auth check
        .mockResolvedValueOnce(mockEmployee) // For route handler user check (line 2220)
        .mockResolvedValueOnce(mockBusinessOwner) // For business owner lookup (line 2292)
        .mockResolvedValueOnce(mockEmployee); // For employee user lookup (line 2293)

      BusinessEmployee.findOne.mockResolvedValue(mockBusinessEmployee);
      Conversation.findOne.mockResolvedValue(null);

      const mockCreatedConversation = {
        id: 101,
        conversationType: "business_employee",
        title: "John & Jane",
        relatedEntityId: 10,
      };

      Conversation.create.mockResolvedValue(mockCreatedConversation);
      ConversationParticipant.bulkCreate.mockResolvedValue([]);
      Conversation.findByPk.mockResolvedValue({
        ...mockCreatedConversation,
        participants: [
          { userId: 1, role: "business_owner", user: mockBusinessOwner },
          { userId: 2, role: "employee", user: mockEmployee },
        ],
      });

      const res = await request(app)
        .post("/api/v1/messages/employee-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({}); // Employee doesn't need to specify employeeId

      expect(res.status).toBe(201);
      expect(res.body.conversation).toBeDefined();
    });

    it("should return 404 for non-existent employee", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      BusinessEmployee.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/messages/employee-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ employeeId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });
  });

  describe("POST /employee-broadcast", () => {
    it("should send broadcast to all active employees", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      BusinessEmployee.findAll.mockResolvedValue([
        { ...mockBusinessEmployee, userId: 2, user: { ...mockEmployee, expoPushToken: "token1" } },
        { id: 11, businessOwnerId: 1, userId: 3, firstName: "Bob", lastName: "Worker", status: "active", user: { id: 3, expoPushToken: "token2" } },
      ]);

      const mockConversation = {
        id: 200,
        conversationType: "employee_broadcast",
        save: jest.fn(),
      };

      Conversation.findOne.mockResolvedValue(mockConversation);
      Message.create.mockResolvedValue({
        id: 1,
        content: "Team meeting at 3pm",
        senderId: 1,
        conversationId: 200,
      });

      const res = await request(app)
        .post("/api/v1/messages/employee-broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Team meeting at 3pm" });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
      expect(Message.create).toHaveBeenCalled();
    });

    it("should create broadcast conversation if none exists", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      BusinessEmployee.findAll.mockResolvedValue([
        { ...mockBusinessEmployee, userId: 2, user: { ...mockEmployee, expoPushToken: "token1" } },
      ]);

      Conversation.findOne.mockResolvedValue(null);
      Conversation.create.mockResolvedValue({
        id: 201,
        conversationType: "employee_broadcast",
        save: jest.fn(),
      });
      ConversationParticipant.bulkCreate.mockResolvedValue([]);
      Message.create.mockResolvedValue({
        id: 1,
        content: "Welcome team!",
        senderId: 1,
        conversationId: 201,
      });

      const res = await request(app)
        .post("/api/v1/messages/employee-broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Welcome team!" });

      expect(res.status).toBe(201);
      expect(Conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationType: "employee_broadcast",
        })
      );
    });

    it("should return 403 for non-business owner", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .post("/api/v1/messages/employee-broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Hello" });

      expect(res.status).toBe(403);
    });

    it("should return 400 for empty content", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const res = await request(app)
        .post("/api/v1/messages/employee-broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });
  });

  describe("GET /my-business-conversations", () => {
    it("should return all business conversations for business owner", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const mockConversations = [
        {
          id: 100,
          conversationType: "business_employee",
          participants: [
            { userId: 1, role: "business_owner", user: mockBusinessOwner, toJSON: function() { return this; } },
            { userId: 2, role: "employee", user: mockEmployee, toJSON: function() { return this; } },
          ],
          messages: [{ id: 1, content: "Hi", createdAt: new Date(), sender: mockBusinessOwner, toJSON: function() { return this; } }],
          toJSON: function() { return { ...this, toJSON: undefined, participants: this.participants.map(p => p.toJSON ? p.toJSON() : p), messages: this.messages.map(m => m.toJSON ? m.toJSON() : m) }; },
        },
        {
          id: 200,
          conversationType: "employee_broadcast",
          participants: [
            { userId: 1, role: "business_owner", user: mockBusinessOwner, toJSON: function() { return this; } },
          ],
          messages: [{ id: 2, content: "Announcement", createdAt: new Date(), sender: mockBusinessOwner, toJSON: function() { return this; } }],
          toJSON: function() { return { ...this, toJSON: undefined, participants: this.participants.map(p => p.toJSON ? p.toJSON() : p), messages: this.messages.map(m => m.toJSON ? m.toJSON() : m) }; },
        },
      ];

      ConversationParticipant.findAll.mockResolvedValue(
        mockConversations.map((c) => ({
          conversationId: c.id,
          lastReadAt: new Date(),
          conversation: c,
        }))
      );

      Message.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(2);
    });

    it("should return 403 for non-business owner and non-employee", async () => {
      const token = generateToken(3);

      // Regular user who is neither business owner nor employee
      const regularUser = {
        id: 3,
        username: "regularuser",
        isBusinessOwner: false,
        employeeOfBusinessId: null,
        firstName: "Regular",
        lastName: "User",
      };

      User.findByPk.mockResolvedValue(regularUser);

      const res = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
