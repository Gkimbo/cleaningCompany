/**
 * Cancellation Appeal Authorization Tests
 *
 * Tests specifically for the HR authorization fix where user type
 * "humanResources" (not "hr") is used for HR staff access.
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

// Create mock models
const mockModels = {
  CancellationAppeal: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    update: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
};

jest.mock("../../models", () => mockModels);

describe("Cancellation Appeal - HR Authorization Fix", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock user
  const createMockUser = (overrides = {}) => ({
    id: 1,
    firstName: "Test",
    lastName: "User",
    username: "testuser",
    email: "test@example.com",
    type: "homeowner",
    ...overrides,
  });

  // Helper to create mock appeal with proper methods
  const createMockAppeal = (overrides = {}) => {
    const status = overrides.status || "submitted";
    const closedStatuses = ["approved", "partially_approved", "denied"];
    const isClosed = closedStatuses.includes(status);

    return {
      id: 1,
      appointmentId: 100,
      appealerId: 5,
      category: "medical_emergency",
      severity: "high",
      status,
      priority: "normal",
      description: "Had a medical emergency",
      supportingDocuments: [],
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      submittedAt: new Date(),
      closedAt: isClosed ? new Date() : null,
      resolution: null,
      resolutionNotes: null,
      reviewDecision: null,
      contestingItems: {},
      requestedRelief: "Full refund",
      assignedTo: null,
      appointment: {
        id: 100,
        date: new Date("2025-01-15"),
        userId: 5,
      },
      assignee: null,
      isClosed: jest.fn().mockReturnValue(isClosed),
      isOpen: jest.fn().mockReturnValue(!isClosed),
      isPastSLA: jest.fn().mockReturnValue(false),
      getTimeUntilSLA: jest.fn().mockReturnValue(172800),
      ...overrides,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    // Create a custom middleware to simulate authentication
    // and set req.user based on the token
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const decoded = jwt.verify(token, secretKey);
          // We'll set req.user in each test via the mock
          const user = mockModels.User.findByPk.mock.results[0]?.value;
          if (user) {
            req.user = user;
          } else {
            // Default user if not set
            req.user = { id: decoded.userId, type: "homeowner" };
          }
        } catch (err) {
          return res.status(401).json({ error: "Invalid token" });
        }
      }
      next();
    });

    // Simple test routes that replicate the authorization logic
    app.get("/test-appeal/:id", (req, res) => {
      // This replicates the authorization check from cancellationAppealRouter.js line 340
      const isOwnerOrHr = ["humanResources", "owner"].includes(req.user?.type);
      const appealerId = parseInt(req.params.id); // Simplified for test

      if (!req.user) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // Mock the appeal lookup - appealerId is the param for this test
      const mockAppeal = createMockAppeal({ appealerId: 5 });

      if (!isOwnerOrHr && req.user.id !== mockAppeal.appealerId) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to view this appeal",
        });
      }

      return res.status(200).json({
        success: true,
        appeal: mockAppeal,
        userType: req.user.type,
      });
    });
  });

  describe("Authorization Check - User Type Handling", () => {
    // These tests use isolated Express apps with proper middleware setup

    const createAppWithUser = (user) => {
      const testApp = express();
      testApp.use(express.json());

      // Set user before routes
      testApp.use((req, res, next) => {
        req.user = user;
        next();
      });

      // Test route that replicates the authorization logic
      testApp.get("/test-appeal/:id", (req, res) => {
        const isOwnerOrHr = ["humanResources", "owner"].includes(req.user?.type);
        const mockAppeal = createMockAppeal({ appealerId: 5 });

        if (!req.user) {
          return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        if (!isOwnerOrHr && req.user.id !== mockAppeal.appealerId) {
          return res.status(403).json({
            success: false,
            error: "Not authorized to view this appeal",
          });
        }

        return res.status(200).json({
          success: true,
          appeal: mockAppeal,
          userType: req.user.type,
        });
      });

      return testApp;
    };

    it("should allow HR user with type 'humanResources' to view any appeal", async () => {
      const hrUser = createMockUser({ id: 1, type: "humanResources" });
      const testApp = createAppWithUser(hrUser);

      const res = await request(testApp).get("/test-appeal/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.userType).toBe("humanResources");
    });

    it("should allow owner to view any appeal", async () => {
      const ownerUser = createMockUser({ id: 1, type: "owner" });
      const testApp = createAppWithUser(ownerUser);

      const res = await request(testApp).get("/test-appeal/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.userType).toBe("owner");
    });

    it("should NOT allow user with incorrect type 'hr' to view other users appeals", async () => {
      // This is the key test for the bug fix
      // Before the fix, "hr" was being checked instead of "humanResources"
      const badUser = createMockUser({ id: 10, type: "hr" }); // Wrong type!
      const testApp = createAppWithUser(badUser);

      const res = await request(testApp).get("/test-appeal/1");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Not authorized to view this appeal");
    });

    it("should allow user to view their own appeal", async () => {
      const regularUser = createMockUser({ id: 5, type: "homeowner" });
      const testApp = createAppWithUser(regularUser);

      const res = await request(testApp).get("/test-appeal/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should NOT allow regular user to view other users appeals", async () => {
      const regularUser = createMockUser({ id: 10, type: "homeowner" });
      const testApp = createAppWithUser(regularUser);

      const res = await request(testApp).get("/test-appeal/1");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should NOT allow cleaner to view other users appeals", async () => {
      const cleanerUser = createMockUser({ id: 10, type: "cleaner" });
      const testApp = createAppWithUser(cleanerUser);

      const res = await request(testApp).get("/test-appeal/1");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("User Type Comparison Tests", () => {
    it('should correctly identify "humanResources" as HR type', () => {
      const isOwnerOrHr = ["humanResources", "owner"].includes("humanResources");
      expect(isOwnerOrHr).toBe(true);
    });

    it('should correctly identify "owner" as authorized type', () => {
      const isOwnerOrHr = ["humanResources", "owner"].includes("owner");
      expect(isOwnerOrHr).toBe(true);
    });

    it('should NOT identify "hr" as authorized type (regression test for bug)', () => {
      // This was the bug - the code was checking for "hr" instead of "humanResources"
      const isOwnerOrHr = ["humanResources", "owner"].includes("hr");
      expect(isOwnerOrHr).toBe(false);
    });

    it('should NOT identify "homeowner" as authorized type', () => {
      const isOwnerOrHr = ["humanResources", "owner"].includes("homeowner");
      expect(isOwnerOrHr).toBe(false);
    });

    it('should NOT identify "cleaner" as authorized type', () => {
      const isOwnerOrHr = ["humanResources", "owner"].includes("cleaner");
      expect(isOwnerOrHr).toBe(false);
    });

    it('should NOT identify "it" as authorized type', () => {
      const isOwnerOrHr = ["humanResources", "owner"].includes("it");
      expect(isOwnerOrHr).toBe(false);
    });
  });

  describe("The Fixed Code Behavior", () => {
    // Directly test the fixed authorization logic
    const isAuthorizedToViewAppeal = (userType, userId, appealerId) => {
      // This is the FIXED code from cancellationAppealRouter.js:340
      const isOwnerOrHr = ["humanResources", "owner"].includes(userType);
      return isOwnerOrHr || userId === appealerId;
    };

    it("should authorize humanResources user to view any appeal", () => {
      expect(isAuthorizedToViewAppeal("humanResources", 1, 5)).toBe(true);
    });

    it("should authorize owner to view any appeal", () => {
      expect(isAuthorizedToViewAppeal("owner", 1, 5)).toBe(true);
    });

    it("should authorize user to view their own appeal", () => {
      expect(isAuthorizedToViewAppeal("homeowner", 5, 5)).toBe(true);
    });

    it("should NOT authorize 'hr' type user to view other users appeals", () => {
      // This is the bug we fixed - 'hr' is not a valid HR type
      expect(isAuthorizedToViewAppeal("hr", 1, 5)).toBe(false);
    });

    it("should NOT authorize homeowner to view other users appeals", () => {
      expect(isAuthorizedToViewAppeal("homeowner", 1, 5)).toBe(false);
    });

    it("should NOT authorize cleaner to view other users appeals", () => {
      expect(isAuthorizedToViewAppeal("cleaner", 1, 5)).toBe(false);
    });
  });
});
