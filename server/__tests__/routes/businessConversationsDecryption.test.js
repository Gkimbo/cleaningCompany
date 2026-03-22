const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService - simulates real encryption/decryption
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    // Simulate decryption - remove "enc_" prefix
    if (value.startsWith("enc_")) {
      return value.replace("enc_", "");
    }
    return value;
  }),
  encrypt: jest.fn((value) => `enc_${value}`),
}));

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
    update: jest.fn(),
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

const {
  User,
  Conversation,
  ConversationParticipant,
} = require("../../models");

describe("Business Conversations Decryption Tests", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  // Mock business owner with encrypted data
  const mockBusinessOwner = {
    id: 1,
    username: "businessowner",
    isBusinessOwner: true,
    employeeOfBusinessId: null,
    firstName: "enc_John",
    lastName: "enc_Owner",
    email: "enc_john@test.com",
    dataValues: {
      id: 1,
      username: "businessowner",
      isBusinessOwner: true,
      employeeOfBusinessId: null,
      firstName: "enc_John",
      lastName: "enc_Owner",
      email: "enc_john@test.com",
    },
  };

  // Mock employee with encrypted data
  const mockEmployee = {
    id: 2,
    username: "employee1",
    isBusinessOwner: false,
    employeeOfBusinessId: 1,
    firstName: "enc_Jane",
    lastName: "enc_Employee",
    email: "enc_jane@test.com",
    dataValues: {
      id: 2,
      username: "employee1",
      isBusinessOwner: false,
      employeeOfBusinessId: 1,
      firstName: "enc_Jane",
      lastName: "enc_Employee",
      email: "enc_jane@test.com",
    },
  };

  const createMockConversation = (overrides = {}) => {
    const conv = {
      id: 1,
      conversationType: "business_employee",
      title: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          id: 1,
          content: "Hello!",
          senderId: 2,
          createdAt: new Date(),
          sender: {
            id: 2,
            firstName: "enc_Jane",
            lastName: "enc_Employee",
            dataValues: {
              id: 2,
              firstName: "enc_Jane",
              lastName: "enc_Employee",
            },
          },
        },
      ],
      participants: [
        {
          id: 1,
          conversationId: 1,
          userId: 1,
          role: "business_owner",
          user: {
            id: 1,
            firstName: "enc_John",
            lastName: "enc_Owner",
            username: "businessowner",
            dataValues: {
              id: 1,
              firstName: "enc_John",
              lastName: "enc_Owner",
              username: "businessowner",
            },
          },
          toJSON() {
            return {
              id: this.id,
              conversationId: this.conversationId,
              userId: this.userId,
              role: this.role,
              user: this.user.dataValues,
            };
          },
        },
        {
          id: 2,
          conversationId: 1,
          userId: 2,
          role: "employee",
          user: {
            id: 2,
            firstName: "enc_Jane",
            lastName: "enc_Employee",
            username: "employee1",
            dataValues: {
              id: 2,
              firstName: "enc_Jane",
              lastName: "enc_Employee",
              username: "employee1",
            },
          },
          toJSON() {
            return {
              id: this.id,
              conversationId: this.conversationId,
              userId: this.userId,
              role: this.role,
              user: this.user.dataValues,
            };
          },
        },
      ],
      toJSON() {
        return {
          id: this.id,
          conversationType: this.conversationType,
          title: this.title,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
          messages: this.messages,
          participants: this.participants.map((p) => p.toJSON()),
        };
      },
      ...overrides,
    };
    return conv;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup express app with router
    app = express();
    app.use(express.json());

    // Import router after mocks are set up
    const messageRouter = require("../../routes/api/v1/messageRouter");
    app.use("/api/v1/messages", messageRouter);
  });

  describe("GET /my-business-conversations", () => {
    it("should return decrypted participant names for business owner", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const mockConversation = createMockConversation();
      const mockParticipation = {
        conversation: mockConversation,
      };

      ConversationParticipant.findAll.mockResolvedValue([mockParticipation]);

      const response = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations).toBeDefined();
      expect(response.body.conversations.length).toBe(1);

      const conv = response.body.conversations[0];

      // Verify participants have decrypted names
      const employeeParticipant = conv.participants.find(
        (p) => p.userId === 2
      );
      expect(employeeParticipant).toBeDefined();
      expect(employeeParticipant.user.firstName).toBe("Jane");
      expect(employeeParticipant.user.lastName).toBe("Employee");

      const ownerParticipant = conv.participants.find((p) => p.userId === 1);
      expect(ownerParticipant).toBeDefined();
      expect(ownerParticipant.user.firstName).toBe("John");
      expect(ownerParticipant.user.lastName).toBe("Owner");
    });

    it("should return decrypted sender name in last message", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const mockConversation = createMockConversation();
      const mockParticipation = {
        conversation: mockConversation,
      };

      ConversationParticipant.findAll.mockResolvedValue([mockParticipation]);

      const response = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);

      const conv = response.body.conversations[0];

      // Verify last message sender has decrypted name
      expect(conv.messages).toBeDefined();
      expect(conv.messages[0].sender.firstName).toBe("Jane");
      expect(conv.messages[0].sender.lastName).toBe("Employee");
    });

    it("should reject non-business users", async () => {
      const regularUserToken = jwt.sign({ userId: 3 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 3,
        isBusinessOwner: false,
        employeeOfBusinessId: null,
      });

      const response = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Not a business owner or employee");
    });

    it("should return decrypted data for employees", async () => {
      const employeeToken = jwt.sign({ userId: 2 }, secretKey);

      User.findByPk.mockResolvedValue(mockEmployee);

      const mockConversation = createMockConversation();
      const mockParticipation = {
        conversation: mockConversation,
      };

      ConversationParticipant.findAll.mockResolvedValue([mockParticipation]);

      const response = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations).toBeDefined();

      const conv = response.body.conversations[0];
      const ownerParticipant = conv.participants.find((p) => p.userId === 1);
      expect(ownerParticipant.user.firstName).toBe("John");
    });

    it("should handle multiple conversations with proper decryption", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const conv1 = createMockConversation({ id: 1 });
      const conv2 = createMockConversation({ id: 2 });

      ConversationParticipant.findAll.mockResolvedValue([
        { conversation: conv1 },
        { conversation: conv2 },
      ]);

      const response = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations.length).toBe(2);

      // Verify both conversations have decrypted data
      response.body.conversations.forEach((conv) => {
        conv.participants.forEach((p) => {
          if (p.user) {
            expect(p.user.firstName).not.toContain("enc_");
            expect(p.user.lastName).not.toContain("enc_");
          }
        });
      });
    });

    it("should handle conversations without messages gracefully", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const convWithoutMessages = createMockConversation();
      convWithoutMessages.messages = [];
      convWithoutMessages.toJSON = function () {
        return {
          id: this.id,
          conversationType: this.conversationType,
          title: this.title,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
          messages: [],
          participants: this.participants.map((p) => p.toJSON()),
        };
      };

      ConversationParticipant.findAll.mockResolvedValue([
        { conversation: convWithoutMessages },
      ]);

      const response = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations[0].messages).toEqual([]);
    });

    it("should handle null user in participants", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const convWithNullUser = createMockConversation();
      convWithNullUser.participants[1].user = null;
      convWithNullUser.participants[1].toJSON = function () {
        return {
          id: this.id,
          conversationId: this.conversationId,
          userId: this.userId,
          role: this.role,
          user: null,
        };
      };

      ConversationParticipant.findAll.mockResolvedValue([
        { conversation: convWithNullUser },
      ]);

      const response = await request(app)
        .get("/api/v1/messages/my-business-conversations")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      // Should not throw error when user is null
      const participantWithNullUser = response.body.conversations[0].participants.find(
        (p) => p.user === null
      );
      expect(participantWithNullUser).toBeDefined();
    });
  });
});
