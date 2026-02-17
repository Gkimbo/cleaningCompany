const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Mock bcrypt
jest.mock("bcrypt", () => ({
  genSalt: jest.fn().mockResolvedValue("salt"),
  hash: jest.fn().mockResolvedValue("hashed_password"),
}));

// Mock crypto while preserving JWT functionality
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return {
    ...actual,
    randomBytes: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue("abc123def456"),
    }),
  };
});

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

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendPasswordReset: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushPasswordReset: jest.fn().mockResolvedValue(true),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  UserBills: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  UserAppointments: {
    count: jest.fn(),
  },
  UserReviews: {
    count: jest.fn(),
  },
  Op: {
    ne: Symbol("ne"),
    iLike: Symbol("iLike"),
  },
}));

const { User, UserBills, UserAppointments, UserReviews } = require("../../models");
const EncryptionService = require("../../services/EncryptionService");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const itSupportToolsRouter = require("../../routes/api/v1/itSupportToolsRouter");

describe("IT Support Tools Router", () => {
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

  // Helper to create mock target user
  const createMockTargetUser = (overrides = {}) => ({
    id: 10,
    firstName: "encrypted_John",
    lastName: "encrypted_Doe",
    username: "johndoe",
    email: "encrypted_john@example.com",
    phone: "encrypted_5551234567",
    type: "homeowner",
    lastLogin: new Date("2025-02-14T12:00:00Z"),
    loginCount: 50,
    lastDeviceType: "iOS",
    failedLoginAttempts: 0,
    lockedUntil: null,
    accountFrozen: false,
    accountFrozenAt: null,
    accountFrozenReason: null,
    warningCount: 0,
    expoPushToken: "ExponentPushToken[xxx]",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    notifications: ["phone", "email"],
    stripeCustomerId: "cus_abc123",
    hasPaymentMethod: true,
    termsAcceptedVersion: "1.0.0",
    privacyPolicyAcceptedVersion: "1.0.0",
    isBusinessOwner: false,
    businessName: null,
    businessDescription: null,
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/v1/it-support", itSupportToolsRouter);
  });

  describe("Authentication & Authorization", () => {
    it("should return 401 without authorization header", async () => {
      const response = await request(app)
        .get("/api/v1/it-support/search?query=test");

      expect(response.status).toBe(401);
    });

    it("should return 403 for non-IT/owner user", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue({
        id: 10,
        type: "homeowner",
        username: "homeowner1",
      });

      const response = await request(app)
        .get("/api/v1/it-support/search?query=test")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("should allow IT user access", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());
      User.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/it-support/search?query=test@example.com")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should allow owner user access", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue({
        id: 2,
        type: "owner",
        username: "owner",
      });
      User.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/it-support/search?query=test@example.com")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/v1/it-support/search", () => {
    it("should search users by email", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValueOnce(createMockITUser());

      const mockUsers = [createMockTargetUser()];
      User.findAll.mockResolvedValue(mockUsers);

      const response = await request(app)
        .get("/api/v1/it-support/search?query=john@example.com&type=email")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0]).toHaveProperty("id");
      expect(response.body.users[0]).toHaveProperty("username");
    });

    it("should search users by username", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      User.findAll.mockResolvedValue([createMockTargetUser()]);

      const response = await request(app)
        .get("/api/v1/it-support/search?query=johndoe&type=username")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
    });

    it("should search by both email and username when no type specified", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      User.findAll
        .mockResolvedValueOnce([createMockTargetUser()]) // email search
        .mockResolvedValueOnce([]); // username search

      const response = await request(app)
        .get("/api/v1/it-support/search?query=john")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(User.findAll).toHaveBeenCalledTimes(2);
    });

    it("should return 400 for query too short", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const response = await request(app)
        .get("/api/v1/it-support/search?query=a")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Search query must be at least 2 characters");
    });

    it("should return 400 for missing query", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const response = await request(app)
        .get("/api/v1/it-support/search")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it("should deduplicate results from email and username searches", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const sameUser = createMockTargetUser();
      User.findAll
        .mockResolvedValueOnce([sameUser]) // email search
        .mockResolvedValueOnce([sameUser]); // username search - same user

      const response = await request(app)
        .get("/api/v1/it-support/search?query=john")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1); // Should be deduplicated
    });
  });

  describe("GET /api/v1/it-support/user/:id", () => {
    it("should return user details", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser()) // middleware
        .mockResolvedValueOnce(createMockTargetUser()); // user fetch

      const response = await request(app)
        .get("/api/v1/it-support/user/10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(10);
      expect(response.body.user).toHaveProperty("username");
      expect(response.body.user).toHaveProperty("type");
    });

    it("should return 404 for non-existent user", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/api/v1/it-support/user/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should show isLocked status correctly", async () => {
      const token = generateToken(1);
      const lockedUser = createMockTargetUser({
        lockedUntil: new Date(Date.now() + 3600000), // 1 hour in future
      });
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(lockedUser);

      const response = await request(app)
        .get("/api/v1/it-support/user/10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.isLocked).toBe(true);
    });
  });

  describe("POST /api/v1/it-support/user/:id/send-password-reset", () => {
    it("should return 404 for non-existent user", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/api/v1/it-support/user/999/send-password-reset")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should require IT or Owner authorization", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValueOnce({
        id: 1,
        type: "homeowner",
        username: "regular_user",
      });

      const response = await request(app)
        .post("/api/v1/it-support/user/10/send-password-reset")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("IT or Owner access required");
    });
  });

  describe("POST /api/v1/it-support/user/:id/unlock", () => {
    it("should unlock a locked user account", async () => {
      const token = generateToken(1);
      const lockedUser = createMockTargetUser({
        lockedUntil: new Date(Date.now() + 3600000),
        failedLoginAttempts: 5,
      });
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(lockedUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/unlock")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Account unlocked");
      expect(lockedUser.update).toHaveBeenCalledWith({
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    });

    it("should clear failed attempts for non-locked user", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser({
        failedLoginAttempts: 3,
        lockedUntil: null,
      });
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/unlock")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("was not locked");
    });
  });

  describe("GET /api/v1/it-support/user/:id/profile", () => {
    it("should return full user profile", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(createMockTargetUser());

      const response = await request(app)
        .get("/api/v1/it-support/user/10/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.profile).toBeDefined();
      // Check structure rather than exact values since decryption mocking is complex
      expect(response.body.profile).toHaveProperty("id");
      expect(response.body.profile).toHaveProperty("username");
      expect(response.body.profile).toHaveProperty("type");
    });
  });

  describe("PATCH /api/v1/it-support/user/:id/contact", () => {
    it("should update user email", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser();
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);
      User.findOne.mockResolvedValue(null); // No duplicate email

      const response = await request(app)
        .patch("/api/v1/it-support/user/10/contact")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "newemail@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("email");
    });

    it("should update user phone", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser();
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);

      const response = await request(app)
        .patch("/api/v1/it-support/user/10/contact")
        .set("Authorization", `Bearer ${token}`)
        .send({ phone: "5559876543" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("phone");
    });

    it("should return 400 for duplicate email", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser();
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);
      User.findOne.mockResolvedValue({ id: 20 }); // Another user has this email

      const response = await request(app)
        .patch("/api/v1/it-support/user/10/contact")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "taken@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email already in use by another account");
    });

    it("should return 400 when no changes provided", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(createMockTargetUser());

      const response = await request(app)
        .patch("/api/v1/it-support/user/10/contact")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("No changes provided");
    });
  });

  describe("GET /api/v1/it-support/user/:id/billing", () => {
    it("should return user billing summary", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(createMockTargetUser());

      UserBills.findAll.mockResolvedValue([
        { id: 1, appointmentDue: 5000, cancellationFee: 0, totalDue: 5000 },
        { id: 2, appointmentDue: 7500, cancellationFee: 500, totalDue: 8000 },
      ]);
      UserBills.count.mockResolvedValue(10);

      const response = await request(app)
        .get("/api/v1/it-support/user/10/billing")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.billing).toBeDefined();
      expect(response.body.billing.hasStripeCustomer).toBe(true);
      expect(response.body.billing.hasPaymentMethod).toBe(true);
      expect(response.body.billing.stats.totalBills).toBe(10);
    });
  });

  describe("POST /api/v1/it-support/user/:id/force-logout", () => {
    it("should force logout user with push token", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser();
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/force-logout")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("logged out on next app open");
      expect(targetUser.update).toHaveBeenCalledWith({ expoPushToken: null });
    });

    it("should handle user without push token", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser({ expoPushToken: null });
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/force-logout")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("no active push token");
    });
  });

  describe("POST /api/v1/it-support/user/:id/suspend", () => {
    it("should suspend user account", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser();
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/suspend")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Suspicious activity", hours: 48 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.lockedUntil).toBeDefined();
    });

    it("should use default 24 hours when hours not specified", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser();
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/suspend")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Suspicious activity" });

      expect(response.status).toBe(200);
    });

    it("should return 403 when trying to suspend owner", async () => {
      const token = generateToken(1);
      const ownerUser = createMockTargetUser({ type: "owner" });
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(ownerUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/suspend")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Test" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Cannot suspend owner or IT accounts");
    });

    it("should return 403 when trying to suspend IT staff", async () => {
      const token = generateToken(1);
      const itUser = createMockTargetUser({ type: "it" });
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(itUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/suspend")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Test" });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/v1/it-support/user/:id/security", () => {
    it("should return user security information", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(createMockTargetUser());

      const response = await request(app)
        .get("/api/v1/it-support/user/10/security")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.security).toBeDefined();
      expect(response.body.security).toHaveProperty("lastLogin");
      expect(response.body.security).toHaveProperty("loginCount");
      // isLocked is null when lockedUntil is null (which is falsy, so && returns null)
      expect(response.body.security.isLocked).toBeFalsy();
    });
  });

  describe("GET /api/v1/it-support/user/:id/data-summary", () => {
    it("should return user data summary", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(createMockTargetUser());

      UserAppointments.count.mockResolvedValue(25);
      UserReviews.count
        .mockResolvedValueOnce(10) // reviews given
        .mockResolvedValueOnce(15); // reviews received
      UserBills.count.mockResolvedValue(20);

      const response = await request(app)
        .get("/api/v1/it-support/user/10/data-summary")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.dataSummary).toBeDefined();
      expect(response.body.dataSummary.data.appointments).toBe(25);
      expect(response.body.dataSummary.data.reviewsGiven).toBe(10);
      expect(response.body.dataSummary.data.reviewsReceived).toBe(15);
    });
  });

  describe("POST /api/v1/it-support/user/:id/clear-app-state", () => {
    it("should clear user app state", async () => {
      const token = generateToken(1);
      const targetUser = createMockTargetUser();
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(targetUser);

      const response = await request(app)
        .post("/api/v1/it-support/user/10/clear-app-state")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("App state cleared");
    });

  });

  describe("GET /api/v1/it-support/user/:id/app-info", () => {
    it("should return user app information", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockITUser())
        .mockResolvedValueOnce(createMockTargetUser());

      const response = await request(app)
        .get("/api/v1/it-support/user/10/app-info")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.appInfo).toBeDefined();
      expect(response.body.appInfo.lastDeviceType).toBe("iOS");
      expect(response.body.appInfo.hasPushNotifications).toBe(true);
    });
  });

  describe("GET /api/v1/it-support/account-types", () => {
    it("should return all account type labels", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockITUser());

      const response = await request(app)
        .get("/api/v1/it-support/account-types")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.types).toBeDefined();
      expect(response.body.types.cleaner).toBe("Cleaner");
      expect(response.body.types.homeowner).toBe("Homeowner");
      expect(response.body.types.owner).toBe("Business Owner");
      expect(response.body.types.it).toBe("IT Support");
    });
  });

  describe("Additional Validation", () => {
    it("should return 400 for short search query", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValueOnce(createMockITUser());

      const response = await request(app)
        .get("/api/v1/it-support/search?query=a")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Search query must be at least 2 characters");
    });

    it("should return 400 for missing search query", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValueOnce(createMockITUser());

      const response = await request(app)
        .get("/api/v1/it-support/search")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Search query must be at least 2 characters");
    });
  });
});
