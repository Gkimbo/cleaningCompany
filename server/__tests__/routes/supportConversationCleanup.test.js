const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => value),
  encrypt: jest.fn((value) => value),
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
    destroy: jest.fn(),
  },
  ConversationParticipant: {
    create: jest.fn(),
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserAppointments: {},
  MessageReaction: {
    destroy: jest.fn(),
  },
  MessageReadReceipt: {
    destroy: jest.fn(),
  },
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

describe("Support Conversation Cleanup Tests", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const mockUser = {
    id: 1,
    username: "testuser",
    type: "cleaner",
    isBusinessOwner: false,
    employeeOfBusinessId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const messageRouter = require("../../routes/api/v1/messageRouter");
    app.use("/api/v1/messages", messageRouter);
  });

  describe("DELETE /conversation/support/:conversationId/cleanup", () => {
    it("should delete empty support conversation", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);

      // Mock empty support conversation with participants and no messages
      const mockConversation = {
        id: 1,
        conversationType: "support",
        participants: [{ userId: 1 }],
        messages: [],
        destroy: jest.fn().mockResolvedValue(true),
      };
      Conversation.findByPk.mockResolvedValue(mockConversation);
      ConversationParticipant.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/messages/conversation/support/1/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(true);
      expect(mockConversation.destroy).toHaveBeenCalled();
    });

    it("should not delete conversation with messages", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);

      // Conversation with messages
      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        participants: [{ userId: 1 }],
        messages: [{ id: 1, content: "Hello" }], // Has messages
      });

      const response = await request(app)
        .delete("/api/v1/messages/conversation/support/1/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(false);
      expect(response.body.reason).toBe("has_messages");
    });

    it("should not delete non-support conversations", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "internal", // Not a support conversation
        participants: [{ userId: 1 }],
        messages: [],
      });

      const response = await request(app)
        .delete("/api/v1/messages/conversation/support/1/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Can only cleanup support conversations");
    });

    it("should not allow non-participants to delete", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);

      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        participants: [{ userId: 2 }], // User 1 is not a participant
        messages: [],
      });

      const response = await request(app)
        .delete("/api/v1/messages/conversation/support/1/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("You are not a participant of this conversation");
    });

    it("should return success with not_found reason for non-existent conversation", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);
      Conversation.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/v1/messages/conversation/support/999/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(false);
      expect(response.body.reason).toBe("not_found");
    });

    it("should handle database errors gracefully", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);
      Conversation.findByPk.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .delete("/api/v1/messages/conversation/support/1/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to cleanup conversation");
    });

    it("should delete participants before conversation", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);

      const mockConversation = {
        id: 1,
        conversationType: "support",
        participants: [{ userId: 1 }],
        messages: [],
        destroy: jest.fn().mockResolvedValue(true),
      };
      Conversation.findByPk.mockResolvedValue(mockConversation);
      ConversationParticipant.destroy.mockResolvedValue(1);

      await request(app)
        .delete("/api/v1/messages/conversation/support/1/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      // Verify participants were deleted before conversation
      expect(ConversationParticipant.destroy).toHaveBeenCalledWith({
        where: { conversationId: 1 },
      });
      expect(mockConversation.destroy).toHaveBeenCalled();
    });

    it("should return 400 for invalid conversation ID", async () => {
      const userToken = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .delete("/api/v1/messages/conversation/support/invalid/cleanup")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid conversation ID");
    });
  });
});
