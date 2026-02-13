/**
 * SupportTicketService Tests
 *
 * Tests the SupportTicketService methods for creating and managing support tickets.
 */

// Mock models
jest.mock("../../models", () => ({
  SupportTicket: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    generateCaseNumber: jest.fn((id) => `SUP-${id.toString().padStart(6, "0")}`),
    calculateSlaDeadline: jest.fn((priority) => {
      const hours = priority === "urgent" ? 12 : priority === "high" ? 24 : 48;
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + hours);
      return deadline;
    }),
  },
  Conversation: {
    findByPk: jest.fn(),
  },
  Message: {
    findAll: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  Op: {
    in: Symbol("in"),
    or: Symbol("or"),
  },
}));

const { SupportTicket, Conversation, Message, User } = require("../../models");
const SupportTicketService = require("../../services/SupportTicketService");

describe("SupportTicketService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createFromConversation", () => {
    const mockConversation = {
      id: 1,
      conversationType: "support",
      title: "Support - Test User",
      participants: [
        { userId: 10, user: { id: 10, firstName: "Test", lastName: "User", type: "homeowner" } },
        { userId: 1, user: { id: 1, firstName: "HR", lastName: "Staff", type: "humanResources" } },
      ],
    };

    const ticketData = {
      category: "account_issue",
      description: "User having login issues",
      priority: "normal",
      subjectUserId: 10,
      subjectType: "homeowner",
    };

    const mockCreatedTicket = {
      id: 1,
      conversationId: 1,
      reporterId: 1,
      subjectUserId: 10,
      subjectType: "homeowner",
      category: "account_issue",
      description: "User having login issues",
      status: "submitted",
      priority: "normal",
      slaDeadline: new Date(),
      submittedAt: new Date(),
    };

    it("should create ticket linked to conversation", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      Conversation.findByPk.mockResolvedValue(mockConversation);
      SupportTicket.create.mockResolvedValue(mockCreatedTicket);

      const result = await SupportTicketService.createFromConversation(1, ticketData, 1);

      expect(Conversation.findByPk).toHaveBeenCalledWith(1, expect.any(Object));
      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 1,
          reporterId: 1,
          category: "account_issue",
          description: "User having login issues",
          status: "submitted",
          priority: "normal",
        })
      );
      expect(result).toEqual(mockCreatedTicket);
    });

    it("should throw error if conversation not found", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      Conversation.findByPk.mockResolvedValue(null);

      await expect(
        SupportTicketService.createFromConversation(999, ticketData, 1)
      ).rejects.toThrow("Conversation not found");
    });

    it("should calculate SLA deadline based on priority", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      Conversation.findByPk.mockResolvedValue(mockConversation);
      SupportTicket.create.mockResolvedValue(mockCreatedTicket);

      const before = new Date();
      await SupportTicketService.createFromConversation(
        1,
        { ...ticketData, priority: "urgent" },
        1
      );
      const after = new Date();

      // Urgent priority should have 12 hour SLA
      const createCall = SupportTicket.create.mock.calls[0][0];
      expect(createCall.slaDeadline).toBeDefined();
      // SLA should be roughly 12 hours from now
      const expectedMinHours = 11.9;
      const expectedMaxHours = 12.1;
      const hoursFromNow = (createCall.slaDeadline.getTime() - before.getTime()) / (1000 * 60 * 60);
      expect(hoursFromNow).toBeGreaterThan(expectedMinHours);
      expect(hoursFromNow).toBeLessThan(expectedMaxHours);
    });

    it("should use normal priority as default", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      Conversation.findByPk.mockResolvedValue(mockConversation);
      SupportTicket.create.mockResolvedValue(mockCreatedTicket);

      await SupportTicketService.createFromConversation(
        1,
        { ...ticketData, priority: undefined },
        1
      );

      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "normal",
        })
      );
    });

    it("should set submittedAt to current time", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      Conversation.findByPk.mockResolvedValue(mockConversation);
      SupportTicket.create.mockResolvedValue(mockCreatedTicket);

      const before = new Date();
      await SupportTicketService.createFromConversation(1, ticketData, 1);
      const after = new Date();

      const createCall = SupportTicket.create.mock.calls[0][0];
      expect(createCall.submittedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createCall.submittedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("createDirect", () => {
    const ticketData = {
      category: "billing_question",
      description: "Question about invoice",
      priority: "high",
      subjectUserId: null,
      subjectType: null,
    };

    const mockCreatedTicket = {
      id: 2,
      conversationId: null,
      reporterId: 1,
      subjectUserId: null,
      subjectType: null,
      category: "billing_question",
      description: "Question about invoice",
      status: "submitted",
      priority: "high",
      slaDeadline: new Date(),
      submittedAt: new Date(),
    };

    it("should create ticket without conversation link", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      SupportTicket.create.mockResolvedValue(mockCreatedTicket);

      const result = await SupportTicketService.createDirect(ticketData, 1);

      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: null,
          reporterId: 1,
          category: "billing_question",
        })
      );
      expect(result).toEqual(mockCreatedTicket);
    });

    it("should handle all valid categories", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      SupportTicket.create.mockResolvedValue(mockCreatedTicket);

      const categories = [
        "account_issue",
        "behavior_concern",
        "service_complaint",
        "billing_question",
        "technical_issue",
        "policy_violation",
        "other",
      ];

      for (const category of categories) {
        await SupportTicketService.createDirect({ ...ticketData, category }, 1);
        expect(SupportTicket.create).toHaveBeenCalledWith(
          expect.objectContaining({ category })
        );
      }
    });

    it("should handle all valid priorities", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      SupportTicket.create.mockResolvedValue(mockCreatedTicket);

      const priorities = ["normal", "high", "urgent"];

      for (const priority of priorities) {
        await SupportTicketService.createDirect({ ...ticketData, priority }, 1);
        expect(SupportTicket.create).toHaveBeenCalledWith(
          expect.objectContaining({ priority })
        );
      }
    });
  });

  describe("getLinkedMessages", () => {
    const mockTicket = {
      id: 1,
      conversationId: 5,
    };

    const mockMessages = [
      {
        id: 1,
        content: "Hello, I need help",
        createdAt: new Date("2025-01-15T10:00:00"),
        messageType: "text",
        sender: {
          id: 10,
          firstName: "Test",
          lastName: "User",
          type: "homeowner",
          profileImage: null,
        },
      },
      {
        id: 2,
        content: "How can I assist you?",
        createdAt: new Date("2025-01-15T10:05:00"),
        messageType: "text",
        sender: {
          id: 1,
          firstName: "HR",
          lastName: "Staff",
          type: "humanResources",
          profileImage: null,
        },
      },
    ];

    it("should return messages for linked conversation", async () => {
      SupportTicket.findByPk.mockResolvedValue(mockTicket);
      Message.findAll.mockResolvedValue(mockMessages);

      const result = await SupportTicketService.getLinkedMessages(1);

      expect(SupportTicket.findByPk).toHaveBeenCalledWith(1);
      expect(Message.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: 5 },
        })
      );
      expect(result.messages).toHaveLength(2);
      expect(result.conversationId).toBe(5);
    });

    it("should throw error if ticket not found", async () => {
      SupportTicket.findByPk.mockResolvedValue(null);

      await expect(SupportTicketService.getLinkedMessages(999)).rejects.toThrow(
        "Support ticket not found"
      );
    });

    it("should return empty messages if no conversation linked", async () => {
      SupportTicket.findByPk.mockResolvedValue({ id: 1, conversationId: null });

      const result = await SupportTicketService.getLinkedMessages(1);

      expect(result.messages).toHaveLength(0);
      expect(result.hasConversation).toBe(false);
    });

    it("should order messages by createdAt ascending", async () => {
      SupportTicket.findByPk.mockResolvedValue(mockTicket);
      Message.findAll.mockResolvedValue(mockMessages);

      await SupportTicketService.getLinkedMessages(1);

      expect(Message.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [["createdAt", "ASC"]],
        })
      );
    });
  });

  describe("resolve", () => {
    const mockTicket = {
      id: 1,
      status: "under_review",
      update: jest.fn(),
      save: jest.fn(),
    };

    it("should resolve ticket with decision", async () => {
      SupportTicket.findByPk.mockResolvedValue(mockTicket);
      mockTicket.update.mockResolvedValue(mockTicket);

      // Method signature: resolve(ticketId, decision, notes, reviewerId)
      await SupportTicketService.resolve(1, "resolved", "Problem was fixed", 1);

      expect(mockTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "resolved",
          resolutionNotes: "Problem was fixed",
          reviewedBy: 1,
        })
      );
    });

    it("should throw error if ticket not found", async () => {
      SupportTicket.findByPk.mockResolvedValue(null);

      await expect(
        SupportTicketService.resolve(999, "resolved", "", 1)
      ).rejects.toThrow("Support ticket not found");
    });

    it("should set closedAt timestamp", async () => {
      SupportTicket.findByPk.mockResolvedValue(mockTicket);
      mockTicket.update.mockResolvedValue(mockTicket);

      const before = new Date();
      await SupportTicketService.resolve(1, "resolved", "", 1);
      const after = new Date();

      const updateCall = mockTicket.update.mock.calls[0][0];
      expect(updateCall.closedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updateCall.closedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});

describe("SupportTicketService edge cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createFromConversation validation", () => {
    it("should handle missing optional fields", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        participants: [],
      });
      SupportTicket.create.mockResolvedValue({ id: 1 });

      await SupportTicketService.createFromConversation(
        1,
        {
          category: "other",
          description: "Test",
          // No subjectUserId, subjectType, priority
        },
        1
      );

      // When no subject is found, subjectType defaults to "general"
      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectUserId: null,
          subjectType: "general",
          priority: "normal",
        })
      );
    });

    it("should handle empty description with whitespace", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "humanResources" });
      Conversation.findByPk.mockResolvedValue({
        id: 1,
        conversationType: "support",
        participants: [],
      });
      SupportTicket.create.mockResolvedValue({ id: 1 });

      await SupportTicketService.createFromConversation(
        1,
        {
          category: "other",
          description: "  Test description  ",
        },
        1
      );

      // Description should be passed as-is (trimming is done at router level)
      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "  Test description  ",
        })
      );
    });
  });

  describe("getLinkedMessages formatting", () => {
    it("should include sender details in messages", async () => {
      const mockDate = new Date();
      SupportTicket.findByPk.mockResolvedValue({ id: 1, conversationId: 5 });
      Message.findAll.mockResolvedValue([
        {
          id: 1,
          content: "Test message",
          createdAt: mockDate,
          messageType: "text",
          sender: {
            id: 10,
            firstName: "John",
            lastName: "Doe",
            type: "homeowner",
            profileImage: "https://example.com/photo.jpg",
          },
        },
      ]);

      const result = await SupportTicketService.getLinkedMessages(1);

      expect(result.messages[0].sender).toBeDefined();
      // Service maps firstName + lastName to name
      expect(result.messages[0].sender.name).toBe("John Doe");
      expect(result.messages[0].sender.type).toBe("homeowner");
    });

    it("should handle messages without sender (system messages)", async () => {
      const mockDate = new Date();
      SupportTicket.findByPk.mockResolvedValue({ id: 1, conversationId: 5 });
      Message.findAll.mockResolvedValue([
        {
          id: 1,
          content: "System notification",
          createdAt: mockDate,
          messageType: "system",
          sender: null,
        },
      ]);

      const result = await SupportTicketService.getLinkedMessages(1);

      expect(result.messages[0].sender).toBeNull();
      expect(result.messages[0].messageType).toBe("system");
    });
  });
});
