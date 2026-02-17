const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return null;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
  hash: jest.fn((value) => `hashed_${value}`),
}));

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  notifyUser: jest.fn().mockResolvedValue(true),
}));

// Mock sequelize literal for CASE WHEN ordering
const mockLiteral = jest.fn((sql) => ({ sql }));

// Mock models
jest.mock("../../models", () => ({
  sequelize: {
    literal: mockLiteral,
  },
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  ITDispute: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
}));

const { User, ITDispute } = require("../../models");
const EncryptionService = require("../../services/EncryptionService");
const NotificationService = require("../../services/NotificationService");

describe("IT Dashboard Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock IT user
  const createMockITUser = (overrides = {}) => ({
    id: 1,
    firstName: "encrypted_IT",
    lastName: "encrypted_Staff",
    username: "itstaff",
    email: "encrypted_it@example.com",
    type: "it",
    ...overrides,
  });

  // Helper to create mock owner user
  const createMockOwner = (overrides = {}) => ({
    id: 2,
    firstName: "encrypted_Owner",
    lastName: "encrypted_User",
    username: "owner",
    email: "encrypted_owner@example.com",
    type: "owner",
    ...overrides,
  });

  // Helper to create mock IT dispute
  const createMockDispute = (overrides = {}) => ({
    id: 1,
    caseNumber: "IT-20250215-00001",
    reporterId: 10,
    category: "app_crash",
    description: "App crashed when opening settings",
    status: "submitted",
    priority: "normal",
    submittedAt: new Date("2025-02-15T10:00:00Z"),
    slaDeadline: new Date("2025-02-17T10:00:00Z"),
    assignedTo: null,
    resolvedAt: null,
    resolution: {},
    resolutionNotes: null,
    deviceInfo: { os: "iOS", version: "17.0" },
    appVersion: "2.1.0",
    platform: "ios",
    reporter: {
      id: 10,
      firstName: "encrypted_John",
      lastName: "encrypted_Doe",
      username: "johndoe",
      email: "encrypted_john@example.com",
    },
    assignee: null,
    toJSON: function() { return { ...this, toJSON: undefined }; },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    // Import router fresh for each test
    jest.isolateModules(() => {
      const itDashboardRouter = require("../../routes/api/v1/itDashboardRouter");
      app.use("/api/v1/it-dashboard", itDashboardRouter);
    });
  });

  describe("GET /api/v1/it-dashboard/quick-stats", () => {
    it("should return quick stats for IT user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.count
        .mockResolvedValueOnce(5)  // openDisputes
        .mockResolvedValueOnce(2)  // criticalHighPriority
        .mockResolvedValueOnce(10) // resolvedThisWeek
        .mockResolvedValueOnce(1)  // slaBreaches
        .mockResolvedValueOnce(2)  // technical
        .mockResolvedValueOnce(1)  // profile
        .mockResolvedValueOnce(1)  // billing
        .mockResolvedValueOnce(1)  // security
        .mockResolvedValueOnce(0)  // data
        .mockResolvedValueOnce(3); // myAssigned

      const response = await request(app)
        .get("/api/v1/it-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("openDisputes");
      expect(response.body).toHaveProperty("criticalHighPriority");
      expect(response.body).toHaveProperty("resolvedThisWeek");
      expect(response.body).toHaveProperty("slaBreaches");
      expect(response.body).toHaveProperty("disputesByGroup");
      expect(response.body).toHaveProperty("myAssigned");
    });

    it("should return quick stats for owner user", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(createMockOwner());

      ITDispute.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/v1/it-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should return 403 for non-IT/owner user", async () => {
      const token = generateToken(3);
      User.findByPk.mockResolvedValue({
        id: 3,
        type: "homeowner",
        username: "homeowner1",
      });

      const response = await request(app)
        .get("/api/v1/it-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .get("/api/v1/it-dashboard/quick-stats");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/it-dashboard/disputes", () => {
    it("should return disputes list with default filters", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDisputes = [createMockDispute()];
      ITDispute.findAll.mockResolvedValue(mockDisputes);
      ITDispute.count.mockResolvedValue(1);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.disputes).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.disputes[0].reporter.firstName).toBe("John");
    });

    it("should filter disputes by category", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);
      ITDispute.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes?category=login_problem")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(ITDispute.findAll).toHaveBeenCalled();
    });

    it("should filter disputes by category group", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);
      ITDispute.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes?categoryGroup=technical")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should filter by status 'open'", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);
      ITDispute.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes?status=open")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should filter by priority", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);
      ITDispute.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes?priority=critical")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should filter by 'me' for assignedTo", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);
      ITDispute.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes?assignedTo=me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should filter by 'unassigned'", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);
      ITDispute.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes?assignedTo=unassigned")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should respect pagination parameters", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);
      ITDispute.count.mockResolvedValue(100);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes?limit=10&offset=20")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(20);
    });
  });

  describe("GET /api/v1/it-dashboard/disputes/:id", () => {
    it("should return specific dispute details", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = createMockDispute();
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.dispute.id).toBe(1);
      expect(response.body.dispute.caseNumber).toBe("IT-20250215-00001");
    });

    it("should return 404 for non-existent dispute", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Dispute not found");
    });

    it("should decrypt all user PII fields", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = createMockDispute({
        resolver: {
          id: 5,
          firstName: "encrypted_Resolver",
          lastName: "encrypted_Name",
        },
      });
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .get("/api/v1/it-dashboard/disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(EncryptionService.decrypt).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/it-dashboard/disputes/:id/assign", () => {
    it("should assign dispute to IT staff", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      User.findByPk
        .mockResolvedValueOnce(itUser) // middleware
        .mockResolvedValueOnce({ id: 5, type: "it", lockedUntil: null, accountFrozen: false }); // assignee validation

      const mockDispute = {
        ...createMockDispute(),
        update: jest.fn().mockResolvedValue(true),
      };
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/assign")
        .set("Authorization", `Bearer ${token}`)
        .send({ assigneeId: 5 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Dispute assigned successfully");
      expect(mockDispute.update).toHaveBeenCalled();
    });

    it("should unassign dispute when assigneeId is null", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = {
        ...createMockDispute(),
        update: jest.fn().mockResolvedValue(true),
      };
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/assign")
        .set("Authorization", `Bearer ${token}`)
        .send({ assigneeId: null });

      expect(response.status).toBe(200);
    });

    it("should return 404 for non-existent dispute", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/999/assign")
        .set("Authorization", `Bearer ${token}`)
        .send({ assigneeId: 5 });

      expect(response.status).toBe(404);
    });

    it("should return 400 for non-IT assignee", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      User.findByPk
        .mockResolvedValueOnce(itUser) // middleware
        .mockResolvedValueOnce({ id: 10, type: "homeowner" }); // assignee validation

      const mockDispute = createMockDispute();
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/assign")
        .set("Authorization", `Bearer ${token}`)
        .send({ assigneeId: 10 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid assignee - must be IT staff or owner");
    });

    it("should return 400 for locked/frozen assignee", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      User.findByPk
        .mockResolvedValueOnce(itUser) // middleware
        .mockResolvedValueOnce({
          id: 5,
          type: "it",
          lockedUntil: new Date(Date.now() + 3600000), // locked for 1 hour
          accountFrozen: false,
        });

      const mockDispute = createMockDispute();
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/assign")
        .set("Authorization", `Bearer ${token}`)
        .send({ assigneeId: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Cannot assign to locked or frozen account");
    });
  });

  describe("POST /api/v1/it-dashboard/disputes/:id/status", () => {
    it("should update dispute status to in_progress", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = {
        ...createMockDispute(),
        update: jest.fn().mockResolvedValue(true),
      };
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "in_progress" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Status updated successfully");
    });

    it("should return 400 for invalid status", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = createMockDispute();
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "resolved" }); // should use /resolve endpoint

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid status");
    });

    it("should return 400 for already resolved dispute", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = createMockDispute({ status: "resolved" });
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "in_progress" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Cannot change status of resolved or closed disputes");
    });
  });

  describe("POST /api/v1/it-dashboard/disputes/:id/resolve", () => {
    it("should resolve dispute with notes", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = {
        ...createMockDispute(),
        update: jest.fn().mockResolvedValue(true),
      };
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({
          resolutionNotes: "Issue was fixed by clearing cache",
          resolution: { action: "cache_clear" },
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Dispute resolved successfully");
      expect(NotificationService.notifyUser).toHaveBeenCalled();
    });

    it("should return 400 for already resolved dispute", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDispute = createMockDispute({ status: "resolved" });
      ITDispute.findByPk.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/1/resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({ resolutionNotes: "Already resolved" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Dispute is already resolved or closed");
    });

    it("should return 404 for non-existent dispute", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/it-dashboard/disputes/999/resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({ resolutionNotes: "Test" });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/v1/it-dashboard/my-assigned", () => {
    it("should return disputes assigned to current user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const mockDisputes = [
        createMockDispute({ assignedTo: 1 }),
      ];
      ITDispute.findAll.mockResolvedValue(mockDisputes);

      const response = await request(app)
        .get("/api/v1/it-dashboard/my-assigned")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.disputes).toHaveLength(1);
    });

    it("should return empty array when no disputes assigned", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/it-dashboard/my-assigned")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.disputes).toHaveLength(0);
    });
  });

  describe("GET /api/v1/it-dashboard/it-staff", () => {
    it("should return list of IT staff for assignment dropdown", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      User.findAll.mockResolvedValue([
        { id: 1, firstName: "encrypted_IT1", lastName: "encrypted_Staff1", username: "it1" },
        { id: 2, firstName: "encrypted_IT2", lastName: "encrypted_Staff2", username: "it2" },
      ]);

      const response = await request(app)
        .get("/api/v1/it-dashboard/it-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.itStaff).toHaveLength(2);
      expect(response.body.itStaff[0].firstName).toBe("IT1");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      ITDispute.count.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await request(app)
        .get("/api/v1/it-dashboard/quick-stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch dashboard stats");

      consoleSpy.mockRestore();
    });
  });
});
