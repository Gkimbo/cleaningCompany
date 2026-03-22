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

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendITDisputeNotification: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushITDispute: jest.fn().mockResolvedValue(true),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  ITDispute: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
}));

const { User, ITDispute } = require("../../models");
const NotificationService = require("../../services/NotificationService");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("IT Disputes Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock user
  const createMockUser = (overrides = {}) => ({
    id: 10,
    firstName: "encrypted_John",
    lastName: "encrypted_Doe",
    username: "johndoe",
    email: "encrypted_john@example.com",
    type: "homeowner",
    notifications: ["phone", "email"],
    expoPushToken: "ExponentPushToken[xxx]",
    ...overrides,
  });

  // Helper to create mock IT staff
  const createMockITStaff = (overrides = {}) => ({
    id: 1,
    firstName: "encrypted_IT",
    lastName: "encrypted_Staff",
    username: "itstaff",
    email: "encrypted_it@example.com",
    type: "it",
    notifications: ["phone", "email"],
    expoPushToken: "ExponentPushToken[yyy]",
    ...overrides,
  });

  // Helper to create mock dispute
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
    attachments: [],
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    // Import router fresh for each test
    jest.isolateModules(() => {
      const itDisputeRouter = require("../../routes/api/v1/itDisputeRouter");
      app.use("/api/v1/it-disputes", itDisputeRouter);
    });
  });

  describe("POST /api/v1/it-disputes/submit", () => {
    it("should create a new IT dispute successfully", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);

      const mockDispute = createMockDispute();
      ITDispute.create.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
          description: "App crashed when opening settings page",
          priority: "normal",
          deviceInfo: { os: "iOS", version: "17.0" },
          appVersion: "2.1.0",
          platform: "ios",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.dispute.caseNumber).toBe("IT-20250215-00001");
      expect(ITDispute.create).toHaveBeenCalled();
      expect(NotificationService.notifyUser).toHaveBeenCalled();
    });

    it("should auto-elevate priority for security issues", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);

      ITDispute.create.mockImplementation((data) => ({
        id: 1,
        caseNumber: "IT-20250215-00001",
        ...data,
      }));

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "security_issue",
          description: "Suspicious login attempt detected from unknown location",
          priority: "normal",
        });

      expect(response.status).toBe(201);
      // Priority should be elevated from normal to high for security issues
      expect(ITDispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "high",
        })
      );
    });

    it("should auto-elevate priority for suspicious_activity", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);

      ITDispute.create.mockImplementation((data) => ({
        id: 1,
        caseNumber: "IT-20250215-00002",
        ...data,
      }));

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "suspicious_activity",
          description: "Someone accessed my account without permission",
          priority: "low",
        });

      expect(response.status).toBe(201);
      // Priority should be elevated from low to normal for suspicious activity
      expect(ITDispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "normal",
        })
      );
    });

    it("should auto-elevate priority for system_outage", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);

      ITDispute.create.mockImplementation((data) => ({
        id: 1,
        caseNumber: "IT-20250215-00003",
        ...data,
      }));

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "system_outage",
          description: "The entire app is down and not loading",
          priority: "normal",
        });

      expect(response.status).toBe(201);
      expect(ITDispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "high",
        })
      );
    });

    it("should return 400 for invalid category", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "invalid_category",
          description: "This is a test description",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid category");
      expect(response.body.validCategories).toBeDefined();
    });

    it("should return 400 for missing category", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "This is a test description",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid category");
    });

    it("should return 400 for description too short", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
          description: "Too short",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Description must be at least 10 characters");
    });

    it("should return 400 for missing description", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Description must be at least 10 characters");
    });

    it("should return 404 when user not found", async () => {
      const token = generateToken(999);
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
          description: "App crashed when opening settings",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .send({
          category: "app_crash",
          description: "App crashed when opening settings",
        });

      expect(response.status).toBe(401);
    });

    it("should send email notification for critical priority", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);

      ITDispute.create.mockImplementation((data) => ({
        id: 1,
        caseNumber: "IT-20250215-00004",
        ...data,
      }));

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
          description: "Critical system crash affecting all users",
          priority: "critical",
        });

      expect(response.status).toBe(201);
      expect(Email.sendITDisputeNotification).toHaveBeenCalled();
    });

    it("should send push notification to IT staff", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);

      ITDispute.create.mockResolvedValue(createMockDispute());

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "login_problem",
          description: "Cannot log in to my account after password change",
        });

      expect(response.status).toBe(201);
      expect(PushNotification.sendPushITDispute).toHaveBeenCalled();
    });

    it("should handle rate limiting (429 after too many requests)", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);
      ITDispute.create.mockResolvedValue(createMockDispute());

      // Make 3 successful requests (the limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/v1/it-disputes/submit")
          .set("Authorization", `Bearer ${token}`)
          .send({
            category: "app_crash",
            description: `Test description for request ${i + 1}`,
          });
      }

      // 4th request should be rate limited
      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
          description: "This should be rate limited",
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain("Too many dispute submissions");
      expect(response.body.retryAfter).toBeDefined();
    });

    it("should use default priority when invalid priority provided", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);

      ITDispute.create.mockImplementation((data) => ({
        id: 1,
        caseNumber: "IT-20250215-00005",
        ...data,
      }));

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
          description: "App crashed with invalid priority",
          priority: "super_urgent", // invalid
        });

      expect(response.status).toBe(201);
      expect(ITDispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "normal", // default
        })
      );
    });

    it("should handle all valid categories", async () => {
      const validCategories = [
        "app_crash", "login_problem", "system_outage", "performance_issue",
        "profile_change", "account_access", "password_reset", "data_correction",
        "billing_error", "payment_system_error",
        "security_issue", "suspicious_activity",
        "data_request",
      ];

      for (const category of validCategories) {
        jest.clearAllMocks();
        const token = generateToken(10 + validCategories.indexOf(category));
        User.findByPk.mockResolvedValue(createMockUser({ id: 10 + validCategories.indexOf(category) }));
        User.findAll.mockResolvedValue([createMockITStaff()]);
        ITDispute.create.mockResolvedValue(createMockDispute({ category }));

        const response = await request(app)
          .post("/api/v1/it-disputes/submit")
          .set("Authorization", `Bearer ${token}`)
          .send({
            category,
            description: `Testing category: ${category}`,
          });

        expect(response.status).toBe(201);
      }
    });
  });

  describe("GET /api/v1/it-disputes/my-disputes", () => {
    it("should return user's submitted disputes", async () => {
      const token = generateToken(10);

      const mockDisputes = [
        createMockDispute(),
        createMockDispute({ id: 2, caseNumber: "IT-20250215-00002" }),
      ];
      ITDispute.findAll.mockResolvedValue(mockDisputes);

      const response = await request(app)
        .get("/api/v1/it-disputes/my-disputes")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.disputes).toHaveLength(2);
    });

    it("should return empty array when user has no disputes", async () => {
      const token = generateToken(10);
      ITDispute.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/it-disputes/my-disputes")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.disputes).toHaveLength(0);
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .get("/api/v1/it-disputes/my-disputes");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/it-disputes/:id", () => {
    it("should return specific dispute for reporter", async () => {
      const token = generateToken(10);

      const mockDispute = createMockDispute();
      ITDispute.findOne.mockResolvedValue(mockDispute);

      const response = await request(app)
        .get("/api/v1/it-disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.dispute.id).toBe(1);
      expect(ITDispute.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1", reporterId: 10 },
        })
      );
    });

    it("should return 404 for non-existent dispute", async () => {
      const token = generateToken(10);
      ITDispute.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/it-disputes/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Dispute not found");
    });

    it("should return 404 when accessing another user's dispute", async () => {
      const token = generateToken(20); // Different user
      ITDispute.findOne.mockResolvedValue(null); // Won't find due to reporterId filter

      const response = await request(app)
        .get("/api/v1/it-disputes/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/v1/it-disputes/:id/add-info", () => {
    it("should add additional info to open dispute", async () => {
      const token = generateToken(10);

      const mockDispute = createMockDispute();
      ITDispute.findOne.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-disputes/1/add-info")
        .set("Authorization", `Bearer ${token}`)
        .send({
          additionalInfo: "I found that this happens only on WiFi",
          attachments: [{ type: "screenshot", url: "https://example.com/screenshot.png" }],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Information added successfully");
      expect(mockDispute.update).toHaveBeenCalled();
    });

    it("should return 400 for resolved dispute", async () => {
      const token = generateToken(10);

      const mockDispute = createMockDispute({ status: "resolved" });
      ITDispute.findOne.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-disputes/1/add-info")
        .set("Authorization", `Bearer ${token}`)
        .send({
          additionalInfo: "Some additional info",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Cannot add info to a closed dispute");
    });

    it("should return 400 for closed dispute", async () => {
      const token = generateToken(10);

      const mockDispute = createMockDispute({ status: "closed" });
      ITDispute.findOne.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-disputes/1/add-info")
        .set("Authorization", `Bearer ${token}`)
        .send({
          additionalInfo: "Some additional info",
        });

      expect(response.status).toBe(400);
    });

    it("should return 404 for non-existent dispute", async () => {
      const token = generateToken(10);
      ITDispute.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/it-disputes/999/add-info")
        .set("Authorization", `Bearer ${token}`)
        .send({
          additionalInfo: "Some additional info",
        });

      expect(response.status).toBe(404);
    });

    it("should change status from awaiting_info to in_progress", async () => {
      const token = generateToken(10);

      const mockDispute = createMockDispute({ status: "awaiting_info" });
      ITDispute.findOne.mockResolvedValue(mockDispute);

      const response = await request(app)
        .post("/api/v1/it-disputes/1/add-info")
        .set("Authorization", `Bearer ${token}`)
        .send({
          additionalInfo: "Here is the information you requested",
        });

      expect(response.status).toBe(200);
      expect(mockDispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "in_progress",
        })
      );
    });
  });

  describe("GET /api/v1/it-disputes/categories/list", () => {
    it("should return all available categories", async () => {
      const token = generateToken(10);

      const response = await request(app)
        .get("/api/v1/it-disputes/categories/list")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.categories).toBeDefined();
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBeGreaterThan(0);

      // Check structure of each category
      response.body.categories.forEach((cat) => {
        expect(cat).toHaveProperty("value");
        expect(cat).toHaveProperty("label");
        expect(cat).toHaveProperty("group");
      });
    });

    it("should include all category groups", async () => {
      const token = generateToken(10);

      const response = await request(app)
        .get("/api/v1/it-disputes/categories/list")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      const groups = new Set(response.body.categories.map((c) => c.group));
      expect(groups.has("technical")).toBe(true);
      expect(groups.has("profile")).toBe(true);
      expect(groups.has("billing")).toBe(true);
      expect(groups.has("security")).toBe(true);
      expect(groups.has("data")).toBe(true);
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .get("/api/v1/it-disputes/categories/list");

      expect(response.status).toBe(401);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully on submit", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([createMockITStaff()]);
      ITDispute.create.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await request(app)
        .post("/api/v1/it-disputes/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          category: "app_crash",
          description: "App crashed with database error",
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to submit IT dispute");

      consoleSpy.mockRestore();
    });

    it("should handle database errors gracefully on my-disputes", async () => {
      const token = generateToken(10);
      ITDispute.findAll.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await request(app)
        .get("/api/v1/it-disputes/my-disputes")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch disputes");

      consoleSpy.mockRestore();
    });
  });
});
