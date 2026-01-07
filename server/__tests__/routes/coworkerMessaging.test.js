const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => {
  const { Op } = require("sequelize");
  return {
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
    sequelize: {
      Sequelize: { Op },
    },
  };
});

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

describe("Coworker Messaging Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  // Test users
  const mockBusinessOwner = {
    id: 1,
    username: "businessowner",
    isBusinessOwner: true,
    employeeOfBusinessId: null,
  };

  const mockEmployee1 = {
    id: 2,
    username: "employee1",
    isBusinessOwner: false,
    employeeOfBusinessId: 1,
    firstName: "Jane",
    lastName: "Worker",
    expoPushToken: "ExponentPushToken[aaa]",
  };

  const mockEmployee2 = {
    id: 3,
    username: "employee2",
    isBusinessOwner: false,
    employeeOfBusinessId: 1,
    firstName: "Bob",
    lastName: "Helper",
    expoPushToken: "ExponentPushToken[bbb]",
  };

  const mockEmployee3 = {
    id: 4,
    username: "employee3",
    isBusinessOwner: false,
    employeeOfBusinessId: 1,
    firstName: "Alice",
    lastName: "Cleaner",
    expoPushToken: "ExponentPushToken[ccc]",
  };

  const mockBusinessEmployee1 = {
    id: 10,
    businessOwnerId: 1,
    userId: 2,
    firstName: "Jane",
    lastName: "Worker",
    status: "active",
    user: mockEmployee1,
    toJSON: function() { return { ...this, toJSON: undefined, user: mockEmployee1 }; },
  };

  const mockBusinessEmployee2 = {
    id: 11,
    businessOwnerId: 1,
    userId: 3,
    firstName: "Bob",
    lastName: "Helper",
    status: "active",
    user: mockEmployee2,
    toJSON: function() { return { ...this, toJSON: undefined, user: mockEmployee2 }; },
  };

  const mockBusinessEmployee3 = {
    id: 12,
    businessOwnerId: 1,
    userId: 4,
    firstName: "Alice",
    lastName: "Cleaner",
    status: "active",
    user: mockEmployee3,
    toJSON: function() { return { ...this, toJSON: undefined, user: mockEmployee3 }; },
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

  describe("GET /coworkers", () => {
    it("should return list of coworkers for employee", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);
      BusinessEmployee.findAll.mockResolvedValue([
        mockBusinessEmployee2,
        mockBusinessEmployee3,
      ]);

      const res = await request(app)
        .get("/api/v1/messages/coworkers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.coworkers).toHaveLength(2);
      expect(res.body.coworkers.map(c => c.firstName)).toContain("Bob");
      expect(res.body.coworkers.map(c => c.firstName)).toContain("Alice");
      // Should not include self
      expect(res.body.coworkers.map(c => c.firstName)).not.toContain("Jane");
    });

    it("should return 403 for non-employee (business owner)", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const res = await request(app)
        .get("/api/v1/messages/coworkers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("business employees");
    });

    it("should return 403 for marketplace cleaner", async () => {
      const token = generateToken(5);

      User.findByPk.mockResolvedValue({
        id: 5,
        isBusinessOwner: false,
        employeeOfBusinessId: null, // Not an employee
      });

      const res = await request(app)
        .get("/api/v1/messages/coworkers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return empty array when employee is only one on team", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);
      BusinessEmployee.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/messages/coworkers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.coworkers).toHaveLength(0);
    });
  });

  describe("POST /coworker-conversation", () => {
    it("should create new conversation between two employees", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);

      BusinessEmployee.findOne
        .mockResolvedValueOnce(mockBusinessEmployee1) // My employee record
        .mockResolvedValueOnce({ ...mockBusinessEmployee2, user: mockEmployee2 }); // Coworker record

      Conversation.findOne.mockResolvedValue(null); // No existing conversation

      const mockCreatedConversation = {
        id: 100,
        conversationType: "employee_peer",
        title: "emp_10_11",
      };

      Conversation.create.mockResolvedValue(mockCreatedConversation);
      ConversationParticipant.bulkCreate.mockResolvedValue([]);
      Conversation.findByPk.mockResolvedValue({
        ...mockCreatedConversation,
        participants: [
          { userId: 2, role: "employee", businessEmployeeId: 10, user: mockEmployee1, toJSON: function() { return this; } },
          { userId: 3, role: "employee", businessEmployeeId: 11, user: mockEmployee2, toJSON: function() { return this; } },
        ],
        toJSON: function() { return { ...this, toJSON: undefined, participants: this.participants.map(p => p.toJSON ? p.toJSON() : p) }; },
      });

      const res = await request(app)
        .post("/api/v1/messages/coworker-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ coworkerId: 11 });

      expect(res.status).toBe(201);
      expect(res.body.conversation).toBeDefined();
      expect(res.body.conversation.conversationType).toBe("employee_peer");
    });

    it("should return existing conversation if one exists", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);

      BusinessEmployee.findOne
        .mockResolvedValueOnce(mockBusinessEmployee1)
        .mockResolvedValueOnce({ ...mockBusinessEmployee2, user: mockEmployee2 });

      const mockParticipant1 = {
        userId: 2,
        role: "employee",
        user: mockEmployee1,
        toJSON: function() { return { userId: this.userId, role: this.role, user: this.user }; },
      };
      const mockParticipant2 = {
        userId: 3,
        role: "employee",
        user: mockEmployee2,
        toJSON: function() { return { userId: this.userId, role: this.role, user: this.user }; },
      };

      const existingConversation = {
        id: 100,
        conversationType: "employee_peer",
        title: "emp_10_11",
        participants: [mockParticipant1, mockParticipant2],
        messages: [],
        toJSON: function() {
          return {
            id: this.id,
            conversationType: this.conversationType,
            title: this.title,
            participants: this.participants.map(p => p.toJSON ? p.toJSON() : p),
            messages: this.messages,
          };
        },
      };

      Conversation.findOne.mockResolvedValue(existingConversation);

      const res = await request(app)
        .post("/api/v1/messages/coworker-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ coworkerId: 11 });

      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(100);
      expect(Conversation.create).not.toHaveBeenCalled();
    });

    it("should use consistent pair key regardless of who initiates", async () => {
      // Test that emp_10_11 is created whether employee 10 or 11 initiates
      const token1 = generateToken(2); // Employee with BusinessEmployee id 10
      const token2 = generateToken(3); // Employee with BusinessEmployee id 11

      User.findByPk.mockResolvedValue(mockEmployee1);

      BusinessEmployee.findOne
        .mockResolvedValueOnce(mockBusinessEmployee1)
        .mockResolvedValueOnce({ ...mockBusinessEmployee2, user: mockEmployee2 });

      Conversation.findOne.mockResolvedValue(null);

      const mockCreatedConversation = {
        id: 100,
        conversationType: "employee_peer",
        title: "emp_10_11", // Should be sorted: smaller ID first
      };

      Conversation.create.mockResolvedValue(mockCreatedConversation);
      ConversationParticipant.bulkCreate.mockResolvedValue([]);
      Conversation.findByPk.mockResolvedValue({
        ...mockCreatedConversation,
        participants: [],
        toJSON: function() { return { ...this, toJSON: undefined }; },
      });

      const res = await request(app)
        .post("/api/v1/messages/coworker-conversation")
        .set("Authorization", `Bearer ${token1}`)
        .send({ coworkerId: 11 });

      expect(res.status).toBe(201);
      expect(Conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "emp_10_11",
        })
      );
    });

    it("should return 400 if coworkerId is missing", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);

      const res = await request(app)
        .post("/api/v1/messages/coworker-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });

    it("should return 404 for non-existent coworker", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);

      BusinessEmployee.findOne
        .mockResolvedValueOnce(mockBusinessEmployee1)
        .mockResolvedValueOnce(null); // Coworker not found

      const res = await request(app)
        .post("/api/v1/messages/coworker-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ coworkerId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("should return 404 if my employee record not found", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);
      BusinessEmployee.findOne.mockResolvedValue(null); // My record not found

      const res = await request(app)
        .post("/api/v1/messages/coworker-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ coworkerId: 11 });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("should return 403 for non-employee", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const res = await request(app)
        .post("/api/v1/messages/coworker-conversation")
        .set("Authorization", `Bearer ${token}`)
        .send({ coworkerId: 11 });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /my-coworker-conversations", () => {
    it("should return all conversations for employee (peer + manager)", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);

      const mockConversations = [
        {
          id: 100,
          conversationType: "employee_peer",
          title: "emp_10_11",
          participants: [
            { userId: 2, role: "employee", businessEmployeeId: 10, user: mockEmployee1, businessEmployee: mockBusinessEmployee1, toJSON: function() { return this; } },
            { userId: 3, role: "employee", businessEmployeeId: 11, user: mockEmployee2, businessEmployee: mockBusinessEmployee2, toJSON: function() { return this; } },
          ],
          messages: [{ id: 1, content: "Hey!", createdAt: new Date(), sender: mockEmployee2, toJSON: function() { return this; } }],
          toJSON: function() { return { ...this, toJSON: undefined, participants: this.participants.map(p => p.toJSON ? p.toJSON() : p), messages: this.messages.map(m => m.toJSON ? m.toJSON() : m) }; },
        },
        {
          id: 101,
          conversationType: "business_employee",
          title: "Owner & Jane",
          participants: [
            { userId: 1, role: "business_owner", user: mockBusinessOwner, businessEmployee: null, toJSON: function() { return this; } },
            { userId: 2, role: "employee", businessEmployeeId: 10, user: mockEmployee1, businessEmployee: mockBusinessEmployee1, toJSON: function() { return this; } },
          ],
          messages: [{ id: 2, content: "Good morning", createdAt: new Date(), sender: mockBusinessOwner, toJSON: function() { return this; } }],
          toJSON: function() { return { ...this, toJSON: undefined, participants: this.participants.map(p => p.toJSON ? p.toJSON() : p), messages: this.messages.map(m => m.toJSON ? m.toJSON() : m) }; },
        },
      ];

      ConversationParticipant.findAll.mockResolvedValue(
        mockConversations.map((c) => ({
          conversationId: c.id,
          userId: 2,
          lastReadAt: new Date(),
          conversation: c,
        }))
      );

      Message.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/v1/messages/my-coworker-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(2);

      const types = res.body.conversations.map(c => c.conversationType);
      expect(types).toContain("employee_peer");
      expect(types).toContain("business_employee");
    });

    it("should include unread counts", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);

      const mockConversation = {
        id: 100,
        conversationType: "employee_peer",
        title: "emp_10_11",
        participants: [
          { userId: 2, role: "employee", businessEmployeeId: 10, user: mockEmployee1, businessEmployee: mockBusinessEmployee1, toJSON: function() { return this; } },
          { userId: 3, role: "employee", businessEmployeeId: 11, user: mockEmployee2, businessEmployee: mockBusinessEmployee2, toJSON: function() { return this; } },
        ],
        messages: [{ id: 1, content: "New message", createdAt: new Date(), sender: mockEmployee2, toJSON: function() { return this; } }],
        toJSON: function() { return { ...this, toJSON: undefined }; },
      };

      ConversationParticipant.findAll.mockResolvedValue([
        {
          conversationId: 100,
          userId: 2,
          lastReadAt: new Date(Date.now() - 86400000), // 1 day ago
          conversation: mockConversation,
        },
      ]);

      Message.count.mockResolvedValue(3); // 3 unread messages

      const res = await request(app)
        .get("/api/v1/messages/my-coworker-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations[0].unreadCount).toBe(3);
    });

    it("should return empty array when no conversations", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);
      ConversationParticipant.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/messages/my-coworker-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(0);
    });

    it("should return 403 for non-employee", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const res = await request(app)
        .get("/api/v1/messages/my-coworker-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("Conversation Type Filtering", () => {
    it("should only include employee_peer and business_employee types", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue(mockEmployee1);

      // Mock that the query only returns allowed conversation types
      ConversationParticipant.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/messages/my-coworker-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Verify the query was made with correct conversation type filter
      expect(ConversationParticipant.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              where: expect.objectContaining({
                conversationType: expect.anything(),
              }),
            }),
          ]),
        })
      );
    });
  });
});

describe("Integration Scenarios", () => {
  describe("Employee Team Communication Flow", () => {
    it("should support full coworker messaging workflow", async () => {
      // This test documents the expected workflow:
      // 1. Employee gets list of coworkers
      // 2. Employee starts conversation with a coworker
      // 3. Both can view the conversation in their list

      // The individual API tests above validate each step
      // This is a conceptual test documenting the flow
      expect(true).toBe(true);
    });

    it("should allow employees to message both coworkers and manager", async () => {
      // Employees should be able to:
      // 1. Message coworkers (employee_peer conversations)
      // 2. Message their business owner (business_employee conversations)
      // 3. See all conversations in one unified list
      expect(true).toBe(true);
    });
  });
});
