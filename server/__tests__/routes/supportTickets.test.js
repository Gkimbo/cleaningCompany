/**
 * Support Ticket Routes Tests
 *
 * Tests the support ticket endpoints in conflictRouter.
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => value),
  encrypt: jest.fn((value) => value),
}));

// Mock SupportTicketService
jest.mock("../../services/SupportTicketService", () => ({
  createFromConversation: jest.fn(),
  createDirect: jest.fn(),
  getLinkedMessages: jest.fn(),
}));

// Mock ConflictResolutionService
jest.mock("../../services/ConflictResolutionService", () => ({
  getConflictQueue: jest.fn(),
  getQueueStats: jest.fn(),
  getConflictCase: jest.fn(),
  addNote: jest.fn(),
  resolveCase: jest.fn(),
  assignCase: jest.fn(),
}));

// Mock AnalyticsService
jest.mock("../../services/AnalyticsService", () => ({
  trackDisputeResolved: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  SupportTicket: {
    findByPk: jest.fn(),
  },
}));

const { User } = require("../../models");
const SupportTicketService = require("../../services/SupportTicketService");
const ConflictResolutionService = require("../../services/ConflictResolutionService");

describe("Support Ticket Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  const createMockUser = (overrides = {}) => ({
    id: 1,
    firstName: "HR",
    lastName: "Staff",
    username: "hrstaff",
    email: "hr@example.com",
    type: "humanResources",
    ...overrides,
  });

  const createMockTicket = (overrides = {}) => ({
    id: 1,
    conversationId: 5,
    reporterId: 1,
    subjectUserId: 10,
    subjectType: "homeowner",
    category: "account_issue",
    description: "User having login issues",
    status: "submitted",
    priority: "normal",
    slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
    submittedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const conflictRouter = require("../../routes/api/v1/conflictRouter");
    app.use("/api/v1/conflicts", conflictRouter);
  });

  describe("POST /support/create", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .send({ category: "account_issue", description: "Test" });

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "homeowner" }));

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ category: "account_issue", description: "Test" });

      expect(res.status).toBe(403);
    });

    it("should create ticket successfully for HR user", async () => {
      const token = generateToken(1);
      const mockTicket = createMockTicket();

      User.findByPk.mockResolvedValue(createMockUser());
      SupportTicketService.createDirect.mockResolvedValue(mockTicket);

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "account_issue",
          description: "User having login issues",
          priority: "normal",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.ticket).toBeDefined();
      expect(res.body.ticket.caseNumber).toBe("SUP-000001");
    });

    it("should create ticket with conversation link", async () => {
      const token = generateToken(1);
      const mockTicket = createMockTicket({ conversationId: 5 });

      User.findByPk.mockResolvedValue(createMockUser());
      SupportTicketService.createFromConversation.mockResolvedValue(mockTicket);

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: 5,
          category: "account_issue",
          description: "Issue from support chat",
          priority: "high",
        });

      expect(res.status).toBe(201);
      expect(SupportTicketService.createFromConversation).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          category: "account_issue",
          description: "Issue from support chat",
          priority: "high",
        }),
        1
      );
    });

    it("should return 400 if category is missing", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Test without category" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Category and description are required");
    });

    it("should return 400 if description is missing", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ category: "account_issue" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Category and description are required");
    });

    it("should return 400 for invalid category", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ category: "invalid_category", description: "Test" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid category");
    });

    it.each([
      "account_issue",
      "behavior_concern",
      "service_complaint",
      "billing_question",
      "technical_issue",
      "policy_violation",
      "other",
    ])("should accept %s as valid category", async (category) => {
      const token = generateToken(1);
      const mockTicket = createMockTicket({ category });

      User.findByPk.mockResolvedValue(createMockUser());
      SupportTicketService.createDirect.mockResolvedValue(mockTicket);

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ category, description: "Test" });

      expect(res.status).toBe(201);
    });

    it("should include subject user info when provided", async () => {
      const token = generateToken(1);
      const mockTicket = createMockTicket();

      User.findByPk.mockResolvedValue(createMockUser());
      SupportTicketService.createDirect.mockResolvedValue(mockTicket);

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "behavior_concern",
          description: "Behavior issue with cleaner",
          subjectUserId: 10,
          subjectType: "cleaner",
        });

      expect(res.status).toBe(201);
      expect(SupportTicketService.createDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectUserId: 10,
          subjectType: "cleaner",
        }),
        1
      );
    });

    it("should work for owner user", async () => {
      const token = generateToken(1);
      const mockTicket = createMockTicket();

      User.findByPk.mockResolvedValue(createMockUser({ type: "owner" }));
      SupportTicketService.createDirect.mockResolvedValue(mockTicket);

      const res = await request(app)
        .post("/api/v1/conflicts/support/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ category: "account_issue", description: "Test" });

      expect(res.status).toBe(201);
    });
  });

  describe("GET /support/:id/conversation", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app).get("/api/v1/conflicts/support/1/conversation");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "cleaner" }));

      const res = await request(app)
        .get("/api/v1/conflicts/support/1/conversation")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return linked messages for valid ticket", async () => {
      const token = generateToken(1);
      const mockMessages = [
        {
          id: 1,
          content: "Hello, I need help",
          createdAt: new Date(),
          sender: { id: 10, firstName: "Test", lastName: "User", type: "homeowner" },
        },
        {
          id: 2,
          content: "How can I assist you?",
          createdAt: new Date(),
          sender: { id: 1, firstName: "HR", lastName: "Staff", type: "humanResources" },
        },
      ];

      User.findByPk.mockResolvedValue(createMockUser());
      SupportTicketService.getLinkedMessages.mockResolvedValue({
        messages: mockMessages,
        conversationId: 5,
      });

      const res = await request(app)
        .get("/api/v1/conflicts/support/1/conversation")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.conversationId).toBe(5);
    });

    it("should return empty messages for ticket without conversation", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(createMockUser());
      SupportTicketService.getLinkedMessages.mockResolvedValue({
        messages: [],
        conversationId: null,
      });

      const res = await request(app)
        .get("/api/v1/conflicts/support/1/conversation")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
    });

    it("should handle service errors gracefully", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(createMockUser());
      SupportTicketService.getLinkedMessages.mockRejectedValue(
        new Error("Support ticket not found")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/v1/conflicts/support/999/conversation")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Support ticket not found");

      consoleSpy.mockRestore();
    });
  });

  describe("GET /:type/:id for support type", () => {
    it("should accept support as valid case type", async () => {
      const token = generateToken(1);
      const mockCase = {
        id: 1,
        caseNumber: "SUP-000001",
        category: "account_issue",
        status: "submitted",
      };

      User.findByPk.mockResolvedValue(createMockUser());
      ConflictResolutionService.getConflictCase.mockResolvedValue(mockCase);

      const res = await request(app)
        .get("/api/v1/conflicts/support/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(ConflictResolutionService.getConflictCase).toHaveBeenCalledWith(1, "support");
    });
  });
});

describe("Route ordering - support routes before dynamic routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const conflictRouter = require("../../routes/api/v1/conflictRouter");
    app.use("/api/v1/conflicts", conflictRouter);
  });

  it("POST /support/create should NOT be intercepted by /:type/:id routes", async () => {
    const token = generateToken(1);
    User.findByPk.mockResolvedValue({
      id: 1,
      type: "humanResources",
    });

    // This should hit /support/create, not /:type/:id with type=support, id=create
    const res = await request(app)
      .post("/api/v1/conflicts/support/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "other", description: "Test" });

    // If it hit /:type/:id, it would return 400 for invalid ID
    // Since we're hitting the correct route, we should get 201 or other expected response
    expect(res.status).not.toBe(400);
  });

  it("GET /support/:id/conversation should NOT be intercepted by /:type/:id routes", async () => {
    const token = generateToken(1);
    User.findByPk.mockResolvedValue({
      id: 1,
      type: "humanResources",
    });
    SupportTicketService.getLinkedMessages.mockResolvedValue({
      messages: [],
      conversationId: null,
    });

    const res = await request(app)
      .get("/api/v1/conflicts/support/1/conversation")
      .set("Authorization", `Bearer ${token}`);

    // This should hit the correct route
    expect(SupportTicketService.getLinkedMessages).toHaveBeenCalled();
  });
});

describe("Support Ticket in Conflict Queue", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const conflictRouter = require("../../routes/api/v1/conflictRouter");
    app.use("/api/v1/conflicts", conflictRouter);
  });

  it("should include support tickets in queue when filtering by caseType=support", async () => {
    const token = generateToken(1);
    User.findByPk.mockResolvedValue({
      id: 1,
      type: "humanResources",
    });
    ConflictResolutionService.getConflictQueue.mockResolvedValue({
      cases: [
        { id: 1, caseType: "support", caseNumber: "SUP-000001" },
        { id: 2, caseType: "support", caseNumber: "SUP-000002" },
      ],
      total: 2,
    });

    const res = await request(app)
      .get("/api/v1/conflicts/queue?caseType=support")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(ConflictResolutionService.getConflictQueue).toHaveBeenCalledWith(
      expect.objectContaining({ caseType: "support" })
    );
  });

  it("should include support ticket count in stats", async () => {
    const token = generateToken(1);
    User.findByPk.mockResolvedValue({
      id: 1,
      type: "owner",
    });
    ConflictResolutionService.getQueueStats.mockResolvedValue({
      totalPending: 10,
      appeals: { total: 3 },
      adjustments: { total: 2 },
      payments: { total: 2 },
      support: { total: 3 },
    });

    const res = await request(app)
      .get("/api/v1/conflicts/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.support).toBeDefined();
    expect(res.body.support.total).toBe(3);
  });
});
