const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  TermsAndConditions: {
    findOne: jest.fn(),
  },
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

jest.mock("../../serializers/userSerializer", () => ({
  login: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    type: user.type,
  })),
  serializeOne: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    type: user.type,
  })),
}));

jest.mock("../../middleware/authenticatedToken", () => {
  const jsonwebtoken = require("jsonwebtoken");
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access token required" });
    }
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jsonwebtoken.verify(token, process.env.SESSION_SECRET || "test_secret");
      req.userId = decoded.userId;
      next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
});

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendUsernameRecovery: jest.fn(),
  sendPasswordReset: jest.fn(),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushUsernameRecovery: jest.fn(),
  sendPushPasswordReset: jest.fn(),
}));

jest.mock("passport", () => ({
  authenticate: jest.fn(() => (req, res, next) => next()),
}));

const { User, TermsAndConditions } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");

const sessionRouter = require("../../routes/api/v1/userSessionsRouter");
const app = express();
app.use(express.json());

// Mock session
app.use((req, res, next) => {
  req.session = { destroy: jest.fn() };
  req.login = jest.fn((user, callback) => callback(null));
  next();
});

app.use("/api/v1/sessions", sessionRouter);

describe("User Sessions Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /login", () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      email: "test@test.com",
      password: "hashedpassword",
      type: "client",
      update: jest.fn().mockResolvedValue(true),
    };

    it("should login successfully with valid credentials", async () => {
      User.findOne.mockResolvedValue(mockUser);
      User.findAll.mockResolvedValue([]); // No linked accounts
      bcrypt.compare.mockResolvedValue(true);
      TermsAndConditions.findOne.mockResolvedValue(null); // No terms to accept

      const response = await request(app)
        .post("/api/v1/sessions/login")
        .send({ username: "testuser", password: "password123" });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.requiresTermsAcceptance).toBe(false);
      expect(response.body.linkedAccounts).toEqual([]);
    });

    it("should return 401 for non-existent user (generic error to prevent enumeration)", async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/sessions/login")
        .send({ username: "nonexistent", password: "password123" });

      expect(response.status).toBe(401); // Same status as wrong password
      expect(response.body.error).toBe("Invalid credentials"); // Generic error
    });

    it("should return 401 for incorrect password (generic error to prevent enumeration)", async () => {
      const mockUserWithLockout = {
        ...mockUser,
        failedLoginAttempts: 0,
        lockedUntil: null,
        update: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUserWithLockout);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post("/api/v1/sessions/login")
        .send({ username: "testuser", password: "wrongpassword" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials"); // Generic error
    });

    it("should handle database error", async () => {
      User.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/v1/sessions/login")
        .send({ username: "testuser", password: "password123" });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal server error");
    });
  });

  describe("GET /current", () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      email: "test@test.com",
      type: "client",
    };

    it("should return current user with valid token", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .get("/api/v1/sessions/current")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
    });

    it("should return 401 without token", async () => {
      const response = await request(app).get("/api/v1/sessions/current");

      expect(response.status).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/sessions/current")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /logout", () => {
    it("should logout successfully", async () => {
      const response = await request(app).post("/api/v1/sessions/logout");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logout successful");
    });
  });

  describe("POST /forgot-username", () => {
    it("should send username recovery email for existing user", async () => {
      User.findAll.mockResolvedValue([{
        id: 1,
        username: "testuser",
        email: "test@test.com",
        type: null,
      }]);

      const response = await request(app)
        .post("/api/v1/sessions/forgot-username")
        .send({ email: "test@test.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("If an account");
      expect(Email.sendUsernameRecovery).toHaveBeenCalledWith(
        "test@test.com",
        "testuser (Homeowner)"
      );
    });

    it("should return success even for non-existent email (security)", async () => {
      User.findAll.mockResolvedValue([]);

      const response = await request(app)
        .post("/api/v1/sessions/forgot-username")
        .send({ email: "nonexistent@test.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("If an account");
      expect(Email.sendUsernameRecovery).not.toHaveBeenCalled();
    });

    it("should return 400 if email not provided", async () => {
      const response = await request(app)
        .post("/api/v1/sessions/forgot-username")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email is required");
    });

    it("should handle email sending error", async () => {
      User.findAll.mockResolvedValue([{
        id: 1,
        username: "testuser",
        email: "test@test.com",
        type: null,
      }]);
      Email.sendUsernameRecovery.mockRejectedValue(new Error("Email error"));

      const response = await request(app)
        .post("/api/v1/sessions/forgot-username")
        .send({ email: "test@test.com" });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Failed to process");
    });

    it("should send all usernames for email with multiple accounts", async () => {
      User.findAll.mockResolvedValue([
        { id: 1, username: "testuser1", email: "test@test.com", type: "cleaner", expoPushToken: null },
        { id: 2, username: "testuser2", email: "test@test.com", type: null, expoPushToken: null },
      ]);
      Email.sendUsernameRecovery.mockResolvedValue(true);

      const response = await request(app)
        .post("/api/v1/sessions/forgot-username")
        .send({ email: "test@test.com" });

      expect(response.status).toBe(200);
      expect(Email.sendUsernameRecovery).toHaveBeenCalledWith(
        "test@test.com",
        "testuser1 (Cleaner), testuser2 (Homeowner)"
      );
    });
  });

  describe("POST /forgot-password", () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      email: "test@test.com",
      type: null,
      update: jest.fn(),
    };

    it("should send password reset email for existing user", async () => {
      User.findAll.mockResolvedValue([mockUser]);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedpassword");

      const response = await request(app)
        .post("/api/v1/sessions/forgot-password")
        .send({ email: "test@test.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("password reset");
      expect(mockUser.update).toHaveBeenCalled();
      expect(Email.sendPasswordReset).toHaveBeenCalled();
    });

    it("should return success even for non-existent email (security)", async () => {
      User.findAll.mockResolvedValue([]);

      const response = await request(app)
        .post("/api/v1/sessions/forgot-password")
        .send({ email: "nonexistent@test.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("If an account");
      expect(Email.sendPasswordReset).not.toHaveBeenCalled();
    });

    it("should return 400 if email not provided", async () => {
      const response = await request(app)
        .post("/api/v1/sessions/forgot-password")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email is required");
    });

    it("should handle password update error", async () => {
      User.findAll.mockResolvedValue([{
        ...mockUser,
        update: jest.fn().mockRejectedValue(new Error("Update error")),
      }]);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedpassword");

      const response = await request(app)
        .post("/api/v1/sessions/forgot-password")
        .send({ email: "test@test.com" });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Failed to process");
    });

    it("should return 300 for multiple accounts without accountType", async () => {
      User.findAll.mockResolvedValue([
        { id: 1, username: "user1", email: "test@test.com", type: "cleaner", update: jest.fn() },
        { id: 2, username: "user2", email: "test@test.com", type: null, update: jest.fn() },
      ]);

      const response = await request(app)
        .post("/api/v1/sessions/forgot-password")
        .send({ email: "test@test.com" });

      expect(response.status).toBe(300);
      expect(response.body.requiresAccountSelection).toBe(true);
      expect(response.body.accountOptions).toHaveLength(2);
    });

    it("should reset specific account when accountType provided", async () => {
      const cleanerUser = { id: 1, username: "cleaner1", email: "test@test.com", type: "cleaner", update: jest.fn() };
      const homeownerUser = { id: 2, username: "homeowner1", email: "test@test.com", type: null, update: jest.fn() };

      User.findAll.mockResolvedValue([cleanerUser, homeownerUser]);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedpassword");

      const response = await request(app)
        .post("/api/v1/sessions/forgot-password")
        .send({ email: "test@test.com", accountType: "cleaner" });

      expect(response.status).toBe(200);
      expect(cleanerUser.update).toHaveBeenCalled();
      expect(homeownerUser.update).not.toHaveBeenCalled();
    });
  });
});
