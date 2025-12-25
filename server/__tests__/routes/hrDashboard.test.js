const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  UserHomes: {},
  Message: {},
  Conversation: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  ConversationParticipant: {},
  HomeSizeAdjustmentRequest: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  HomeSizeAdjustmentPhoto: {},
  Op: {
    in: Symbol("in"),
    gte: Symbol("gte"),
  },
}));

const {
  User,
  Conversation,
  HomeSizeAdjustmentRequest,
} = require("../../models");

describe("HR Dashboard Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock user
  const createMockUser = (overrides = {}) => ({
    id: 1,
    firstName: "HR",
    lastName: "Staff",
    username: "hrstaff",
    email: "hr@example.com",
    type: "humanResources",
    ...overrides,
  });

  // Helper to create mock dispute
  const createMockDispute = (overrides = {}) => ({
    id: 1,
    homeId: 10,
    appointmentId: 100,
    cleanerId: 2,
    homeownerId: 3,
    status: "pending_owner",
    originalNumBeds: "3",
    originalNumBaths: "2",
    reportedNumBeds: "4",
    reportedNumBaths: "3",
    priceDifference: 2500,
    cleanerNotes: "Home is larger than listed",
    homeownerNotes: null,
    createdAt: new Date("2025-01-15"),
    home: {
      id: 10,
      address: "123 Main St",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
      nickName: "Main House",
    },
    appointment: {
      id: 100,
      date: "2025-01-15",
      price: 15000,
    },
    cleaner: {
      id: 2,
      username: "cleaner1",
      firstName: "Jane",
      lastName: "Cleaner",
      ownerPrivateNotes: null,
      falseClaimCount: 0,
    },
    homeowner: {
      id: 3,
      username: "homeowner1",
      firstName: "John",
      lastName: "Homeowner",
      ownerPrivateNotes: null,
      falseHomeSizeCount: 0,
    },
    photos: [
      {
        id: 1,
        roomType: "bedroom",
        roomNumber: 4,
        photoUrl: "https://example.com/photo1.jpg",
        createdAt: new Date("2025-01-15"),
      },
    ],
    ...overrides,
  });

  // Helper to create mock conversation
  const createMockConversation = (overrides = {}) => ({
    id: 1,
    conversationType: "support",
    title: "Support - testuser",
    updatedAt: new Date("2025-01-15T10:00:00"),
    createdAt: new Date("2025-01-14T09:00:00"),
    messages: [
      {
        id: 1,
        content: "I need help with my appointment",
        createdAt: new Date("2025-01-15T10:00:00"),
        sender: {
          id: 4,
          firstName: "Test",
          lastName: "User",
          type: "homeowner",
        },
      },
    ],
    participants: [
      {
        userId: 4,
        user: {
          id: 4,
          firstName: "Test",
          lastName: "User",
          type: "homeowner",
        },
      },
      {
        userId: 1,
        user: {
          id: 1,
          firstName: "HR",
          lastName: "Staff",
          type: "humanResources",
        },
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const hrDashboardRouter = require("../../routes/api/v1/hrDashboardRouter");
    app.use("/api/v1/hr-dashboard", hrDashboardRouter);
  });

  describe("GET /disputes/pending", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/pending");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "homeowner" }));

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("HR or Owner access required");
    });

    it("should return pending disputes for HR user", async () => {
      const token = generateToken(1);
      const mockHR = createMockUser({ type: "humanResources" });
      const mockDisputes = [
        createMockDispute({ id: 1, status: "pending_owner" }),
        createMockDispute({ id: 2, status: "expired" }),
        createMockDispute({ id: 3, status: "denied" }),
      ];

      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockDisputes);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("disputes");
      expect(res.body.disputes).toHaveLength(3);
    });

    it("should return pending disputes for owner user", async () => {
      const token = generateToken(1);
      const mockOwner = createMockUser({ type: "owner", username: "owner1" });
      const mockDisputes = [createMockDispute()];

      User.findByPk.mockResolvedValue(mockOwner);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockDisputes);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("disputes");
      expect(res.body.disputes).toHaveLength(1);
    });

    it("should return empty array when no pending disputes", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.disputes).toHaveLength(0);
    });

    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.findAll.mockRejectedValue(new Error("DB error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch pending disputes");

      consoleSpy.mockRestore();
    });
  });

  describe("GET /disputes/:id", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/1");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "cleaner" }));

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return dispute details for HR user", async () => {
      const token = generateToken(1);
      const mockDispute = createMockDispute();

      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockDispute);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dispute");
      expect(res.body.dispute.id).toBe(1);
      expect(res.body.dispute.home).toBeDefined();
      expect(res.body.dispute.cleaner).toBeDefined();
      expect(res.body.dispute.homeowner).toBeDefined();
      expect(res.body.dispute.photos).toBeDefined();
    });

    it("should return 404 when dispute not found", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Dispute not found");
    });

    it("should include cleaner falseClaimCount in response", async () => {
      const token = generateToken(1);
      const mockDispute = createMockDispute({
        cleaner: {
          id: 2,
          username: "badcleaner",
          firstName: "Bad",
          lastName: "Cleaner",
          falseClaimCount: 3,
        },
      });

      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockDispute);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.dispute.cleaner.falseClaimCount).toBe(3);
    });

    it("should include homeowner falseHomeSizeCount in response", async () => {
      const token = generateToken(1);
      const mockDispute = createMockDispute({
        homeowner: {
          id: 3,
          username: "badhomeowner",
          firstName: "Bad",
          lastName: "Homeowner",
          falseHomeSizeCount: 2,
        },
      });

      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockDispute);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.dispute.homeowner.falseHomeSizeCount).toBe(2);
    });
  });

  describe("GET /support-conversations", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/hr-dashboard/support-conversations");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "homeowner" }));

      const res = await request(app)
        .get("/api/v1/hr-dashboard/support-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return support conversations for HR user", async () => {
      const token = generateToken(1);
      const mockConversations = [
        createMockConversation({ id: 1 }),
        createMockConversation({ id: 2, title: "Support - anotheruser" }),
      ];

      User.findByPk.mockResolvedValue(createMockUser());
      Conversation.findAll.mockResolvedValue(mockConversations);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/support-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conversations");
      expect(res.body.conversations).toHaveLength(2);
    });

    it("should format conversation data correctly", async () => {
      const token = generateToken(1);
      const mockConversation = createMockConversation();

      User.findByPk.mockResolvedValue(createMockUser());
      Conversation.findAll.mockResolvedValue([mockConversation]);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/support-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const conv = res.body.conversations[0];
      expect(conv).toHaveProperty("id");
      expect(conv).toHaveProperty("title");
      expect(conv).toHaveProperty("lastMessage");
      expect(conv).toHaveProperty("lastMessageSender");
      expect(conv).toHaveProperty("customer");
      expect(conv.customer.type).toBe("homeowner");
    });

    it("should identify customer as non-HR/owner participant", async () => {
      const token = generateToken(1);
      const mockConversation = createMockConversation({
        participants: [
          { userId: 4, user: { id: 4, firstName: "Cleaner", lastName: "User", type: "cleaner" } },
          { userId: 1, user: { id: 1, firstName: "HR", lastName: "Staff", type: "humanResources" } },
          { userId: 2, user: { id: 2, firstName: "Owner", lastName: "User", type: "owner" } },
        ],
      });

      User.findByPk.mockResolvedValue(createMockUser());
      Conversation.findAll.mockResolvedValue([mockConversation]);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/support-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations[0].customer.type).toBe("cleaner");
    });

    it("should return empty array when no support conversations", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      Conversation.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/support-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(0);
    });

    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      Conversation.findAll.mockRejectedValue(new Error("DB error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/v1/hr-dashboard/support-conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch support conversations");

      consoleSpy.mockRestore();
    });
  });

  describe("GET /quick-stats", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/hr-dashboard/quick-stats");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "homeowner" }));

      const res = await request(app)
        .get("/api/v1/hr-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return quick stats for HR user", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.count
        .mockResolvedValueOnce(5)   // pending disputes
        .mockResolvedValueOnce(10); // resolved this week
      Conversation.count.mockResolvedValue(3);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("pendingDisputes", 5);
      expect(res.body).toHaveProperty("supportConversations", 3);
      expect(res.body).toHaveProperty("disputesResolvedThisWeek", 10);
    });

    it("should return zeros when no data exists", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.count.mockResolvedValue(0);
      Conversation.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/v1/hr-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingDisputes).toBe(0);
      expect(res.body.supportConversations).toBe(0);
      expect(res.body.disputesResolvedThisWeek).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      HomeSizeAdjustmentRequest.count.mockRejectedValue(new Error("DB error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/v1/hr-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch quick stats");

      consoleSpy.mockRestore();
    });
  });
});
