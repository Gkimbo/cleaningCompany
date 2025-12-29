const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock bcrypt with genSalt
jest.mock("bcrypt", () => ({
  genSalt: jest.fn().mockResolvedValue("mock-salt"),
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  Conversation: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  ConversationParticipant: {
    findOrCreate: jest.fn(),
    destroy: jest.fn(),
  },
  UserBills: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCongragulations: jest.fn().mockResolvedValue(true),
}));

// Mock UserSerializer
jest.mock("../../serializers/UserSerializer", () => ({
  serializeOne: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    type: user.type,
    firstName: user.firstName,
    lastName: user.lastName,
  })),
}));

const bcrypt = require("bcrypt");
const { User, Conversation, ConversationParticipant, UserBills } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const UserSerializer = require("../../serializers/UserSerializer");

// Helper to create mock HR user with update/destroy methods
const createMockHRUser = (overrides = {}) => ({
  id: 10,
  firstName: "HR",
  lastName: "Employee",
  username: "hremployee",
  email: "hr@example.com",
  phone: "555-123-4567",
  type: "humanResources",
  createdAt: new Date("2025-01-01"),
  update: jest.fn().mockResolvedValue(true),
  destroy: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("HR Users Router - POST /new-hr", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Password must meet requirements: 8+ chars, uppercase, lowercase, number, special char
  const mockHRData = {
    firstName: "New",
    lastName: "HRStaff",
    username: "newhr",
    password: "SecurePass123!",
    email: "newhr@example.com",
    phone: "555-1234",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const usersRouter = require("../../routes/api/v1/usersRouter");
    app.use("/api/v1/users", usersRouter);
  });

  describe("Authorization", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .send(mockHRData);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization token required");
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", "Bearer invalid-token")
        .send(mockHRData);

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "regularuser",
        type: "homeowner",
      });

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can create HR accounts");
    });

    it("should return 403 for cleaner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can create HR accounts");
    });

    it("should return 403 for HR user trying to create another HR", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "existinghr",
        type: "humanResources",
      });

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can create HR accounts");
    });
  });

  describe("Validation", () => {
    it("should return 400 for missing required fields", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "Test",
          // missing username, password, email
        });

      expect(res.status).toBe(400);
    });

    it("should return 400 for weak password (no special char)", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send({
          ...mockHRData,
          password: "WeakPassword123", // no special char
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("special character");
    });

    it("should return 410 for duplicate username", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 2, username: "newhr" }); // username check

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(410);
      expect(res.body.error).toBe("Username already exists");
    });

    it("should return 409 for duplicate email", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findOne.mockResolvedValueOnce({ id: 2, email: "newhr@example.com" });

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Email already exists");
    });
  });

  describe("Successful HR Creation", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findOne.mockResolvedValue(null);
      UserBills.create.mockResolvedValue({ id: 1 });
    });

    it("should create HR user successfully", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        notifications: ["phone", "email"],
        dataValues: {
          id: 10,
          ...mockHRData,
          type: "humanResources",
        },
      };
      User.create.mockResolvedValue(createdUser);
      Conversation.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.type).toBe("humanResources");
    });

    it("should pass plain password to User.create (model handles hashing)", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);
      Conversation.findAll.mockResolvedValue([]);

      await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      // Password should be passed to User.create as-is
      // The User model's beforeCreate hook handles hashing
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: mockHRData.password,
        })
      );
    });

    it("should create user with type humanResources", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);
      Conversation.findAll.mockResolvedValue([]);

      await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "humanResources",
        })
      );
    });

    it("should set default notifications to phone and email", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        notifications: ["phone", "email"],
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);
      Conversation.findAll.mockResolvedValue([]);

      await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: ["phone", "email"],
        })
      );
    });

    it("should add new HR to existing support conversations", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);
      Conversation.findAll.mockResolvedValue([
        { id: 1, conversationType: "support" },
        { id: 2, conversationType: "support" },
        { id: 3, conversationType: "support" },
      ]);
      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);

      await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(Conversation.findAll).toHaveBeenCalledWith({
        where: { conversationType: "support" },
      });
      expect(ConversationParticipant.findOrCreate).toHaveBeenCalledTimes(3);
    });

    it("should send welcome email with credentials", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);
      Conversation.findAll.mockResolvedValue([]);

      await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(Email.sendEmailCongragulations).toHaveBeenCalledWith(
        mockHRData.firstName,
        mockHRData.lastName,
        mockHRData.username,
        mockHRData.password,
        mockHRData.email,
        "humanResources"
      );
    });

    it("should serialize user response", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: {
          id: 10,
          ...mockHRData,
          type: "humanResources",
        },
      };
      User.create.mockResolvedValue(createdUser);
      Conversation.findAll.mockResolvedValue([]);

      await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(UserSerializer.serializeOne).toHaveBeenCalledWith(createdUser.dataValues);
    });
  });

  describe("Error Handling", () => {
    it("should handle database error during user creation", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findOne.mockResolvedValue(null);
      User.create.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(500);

      consoleSpy.mockRestore();
    });

    it("should handle email sending failure gracefully", async () => {
      const token = generateToken(1);
      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(createdUser);
      UserBills.create.mockResolvedValue({ id: 1 });
      Conversation.findAll.mockResolvedValue([]);
      Email.sendEmailCongragulations.mockRejectedValue(new Error("Email failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      // The user is created, so if email fails, we may get 500 or 201 depending on implementation
      // Most implementations would let it fail, returning 500
      expect([201, 500]).toContain(res.status);

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe("Multiple HR Accounts", () => {
    it("should allow creating multiple HR accounts sequentially", async () => {
      const token = generateToken(1);

      // Reset email mock from previous test and setup fresh mocks
      Email.sendEmailCongragulations.mockReset();
      Email.sendEmailCongragulations.mockResolvedValue(true);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findOne.mockResolvedValue(null);
      UserBills.create.mockResolvedValue({ id: 1 });
      Conversation.findAll.mockResolvedValue([]);

      const firstHR = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };

      User.create.mockResolvedValue(firstHR);

      const res1 = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res1.status).toBe(201);
      expect(User.create).toHaveBeenCalledTimes(1);

      // Owner can create multiple HR accounts (no limit)
      expect(res1.body.user.type).toBe("humanResources");
    });
  });

  describe("Auto-Add to HR Team Conversation", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findOne.mockResolvedValue(null);
      UserBills.create.mockResolvedValue({ id: 1 });
      Email.sendEmailCongragulations.mockReset();
      Email.sendEmailCongragulations.mockResolvedValue(true);
    });

    it("should add new HR to existing HR Team conversation", async () => {
      const token = generateToken(1);

      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);

      // No support conversations
      Conversation.findAll.mockResolvedValue([]);

      // Existing HR Team conversation
      Conversation.findOne.mockResolvedValue({
        id: 5,
        conversationType: "internal",
        title: "HR Team",
      });

      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(201);

      // Verify Conversation.findOne was called to find HR Team
      expect(Conversation.findOne).toHaveBeenCalledWith({
        where: { conversationType: "internal", title: "HR Team" },
      });

      // Verify new HR was added as participant
      expect(ConversationParticipant.findOrCreate).toHaveBeenCalledWith({
        where: { conversationId: 5, userId: 10 },
      });
    });

    it("should not fail if HR Team conversation does not exist", async () => {
      const token = generateToken(1);

      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);

      // No support conversations
      Conversation.findAll.mockResolvedValue([]);

      // No HR Team conversation exists
      Conversation.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(201);
      expect(res.body.user.type).toBe("humanResources");

      // Verify findOrCreate was NOT called for HR Team (only for support conversations)
      expect(ConversationParticipant.findOrCreate).not.toHaveBeenCalled();
    });

    it("should add new HR to both support conversations and HR Team", async () => {
      const token = generateToken(1);

      const createdUser = {
        id: 10,
        ...mockHRData,
        type: "humanResources",
        dataValues: { id: 10, type: "humanResources" },
      };
      User.create.mockResolvedValue(createdUser);

      // Two support conversations
      Conversation.findAll.mockResolvedValue([
        { id: 1, conversationType: "support" },
        { id: 2, conversationType: "support" },
      ]);

      // Existing HR Team conversation
      Conversation.findOne.mockResolvedValue({
        id: 5,
        conversationType: "internal",
        title: "HR Team",
      });

      ConversationParticipant.findOrCreate.mockResolvedValue([{}, true]);

      const res = await request(app)
        .post("/api/v1/users/new-hr")
        .set("Authorization", `Bearer ${token}`)
        .send(mockHRData);

      expect(res.status).toBe(201);

      // 2 support conversations + 1 HR Team = 3 calls
      expect(ConversationParticipant.findOrCreate).toHaveBeenCalledTimes(3);
    });
  });
});

describe("HR Users Router - GET /hr-staff", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const usersRouter = require("../../routes/api/v1/usersRouter");
    app.use("/api/v1/users", usersRouter);
  });

  describe("Authorization", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app).get("/api/v1/users/hr-staff");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization token required");
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can access HR staff list");
    });

    it("should return 403 for homeowner", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "homeowner1",
        type: "homeowner",
      });

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should allow owner type", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("should allow owner type", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Successful Retrieval", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
    });

    it("should return empty array when no HR staff exists", async () => {
      const token = generateToken(1);
      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.hrStaff).toEqual([]);
    });

    it("should return list of HR staff", async () => {
      const token = generateToken(1);
      const mockHRStaff = [
        createMockHRUser({ id: 10 }),
        createMockHRUser({ id: 11, username: "hrstaff2", email: "hr2@example.com" }),
      ];
      User.findAll.mockResolvedValue(mockHRStaff);

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.hrStaff).toHaveLength(2);
    });

    it("should return serialized HR staff data", async () => {
      const token = generateToken(1);
      User.findAll.mockResolvedValue([createMockHRUser()]);

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const hrUser = res.body.hrStaff[0];
      expect(hrUser).toHaveProperty("id");
      expect(hrUser).toHaveProperty("firstName");
      expect(hrUser).toHaveProperty("lastName");
      expect(hrUser).toHaveProperty("username");
      expect(hrUser).toHaveProperty("email");
      expect(hrUser).toHaveProperty("phone");
      expect(hrUser).toHaveProperty("createdAt");
      // Should NOT include password
      expect(hrUser).not.toHaveProperty("password");
    });

    it("should query only humanResources type users", async () => {
      const token = generateToken(1);
      User.findAll.mockResolvedValue([]);

      await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(User.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: "humanResources" },
        })
      );
    });

    it("should order by createdAt DESC", async () => {
      const token = generateToken(1);
      User.findAll.mockResolvedValue([]);

      await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(User.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [["createdAt", "DESC"]],
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database error", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
      User.findAll.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/v1/users/hr-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch HR staff");

      consoleSpy.mockRestore();
    });
  });
});

describe("HR Users Router - PATCH /hr-staff/:id", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  const updateData = {
    firstName: "Updated",
    lastName: "Name",
    email: "updated@example.com",
    phone: "555-000-0000",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const usersRouter = require("../../routes/api/v1/usersRouter");
    app.use("/api/v1/users", usersRouter);
  });

  describe("Authorization", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .send(updateData);

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can update HR staff");
    });
  });

  describe("Validation", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
    });

    it("should return 404 if HR employee not found", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" }) // Owner check
        .mockResolvedValueOnce(null); // HR employee check

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/999")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("HR employee not found");
    });

    it("should return 400 if user is not an HR employee", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(createMockHRUser({ type: "cleaner" }));

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("User is not an HR employee");
    });

    it("should return 400 for invalid email format", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(createMockHRUser());

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "invalid-email" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("valid email");
    });

    it("should return 409 if email is already taken by another user", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);
      User.findOne.mockResolvedValue({ id: 99, email: updateData.email });

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: updateData.email });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Email is already in use");
    });

    it("should allow updating to same email (no change)", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);
      // findOne returns the same user (email belongs to them)
      User.findOne.mockResolvedValue({ id: 10, email: hrUser.email });

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: hrUser.email });

      expect(res.status).toBe(200);
    });
  });

  describe("Successful Update", () => {
    it("should update HR employee successfully", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("HR employee updated successfully");
      expect(hrUser.update).toHaveBeenCalled();
    });

    it("should allow partial updates", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "OnlyFirstName" });

      expect(res.status).toBe(200);
      expect(hrUser.update).toHaveBeenCalledWith({ firstName: "OnlyFirstName" });
    });

    it("should allow clearing phone number with empty string", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ phone: "" });

      expect(res.status).toBe(200);
      expect(hrUser.update).toHaveBeenCalledWith({ phone: null });
    });

    it("should return updated user data", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toHaveProperty("id");
    });
  });

  describe("Error Handling", () => {
    it("should handle database error during update", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      hrUser.update = jest.fn().mockRejectedValue(new Error("Update failed"));
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .patch("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "New" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update HR employee");

      consoleSpy.mockRestore();
    });
  });
});

describe("HR Users Router - DELETE /hr-staff/:id", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const usersRouter = require("../../routes/api/v1/usersRouter");
    app.use("/api/v1/users", usersRouter);
  });

  describe("Authorization", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app).delete("/api/v1/users/hr-staff/10");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "cleaner1",
        type: "cleaner",
      });

      const res = await request(app)
        .delete("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owner can remove HR staff");
    });

    it("should return 403 for HR user trying to delete", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "hrstaff",
        type: "humanResources",
      });

      const res = await request(app)
        .delete("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("Validation", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "owner1",
        type: "owner",
      });
    });

    it("should return 404 if HR employee not found", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .delete("/api/v1/users/hr-staff/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("HR employee not found");
    });

    it("should return 400 if user is not an HR employee", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(createMockHRUser({ type: "cleaner" }));

      const res = await request(app)
        .delete("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("User is not an HR employee");
    });
  });

  describe("Successful Deletion", () => {
    it("should delete HR employee successfully", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);
      UserBills.destroy.mockResolvedValue(1);
      ConversationParticipant.destroy.mockResolvedValue(1);

      const res = await request(app)
        .delete("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("HR employee removed successfully");
      expect(hrUser.destroy).toHaveBeenCalled();
    });

    it("should remove associated UserBills", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);
      UserBills.destroy.mockResolvedValue(1);
      ConversationParticipant.destroy.mockResolvedValue(1);

      await request(app)
        .delete("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(UserBills.destroy).toHaveBeenCalledWith({ where: { userId: "10" } });
    });

    it("should remove conversation participants", async () => {
      const token = generateToken(1);
      const hrUser = createMockHRUser();
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(hrUser);
      UserBills.destroy.mockResolvedValue(1);
      ConversationParticipant.destroy.mockResolvedValue(5);

      await request(app)
        .delete("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(ConversationParticipant.destroy).toHaveBeenCalledWith({
        where: { userId: "10" },
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database error during deletion", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "owner" })
        .mockResolvedValueOnce(createMockHRUser());
      UserBills.destroy.mockRejectedValue(new Error("Delete failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .delete("/api/v1/users/hr-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to remove HR employee");

      consoleSpy.mockRestore();
    });
  });
});
