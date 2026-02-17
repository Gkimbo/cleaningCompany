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

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCongragulations: jest.fn().mockResolvedValue(true),
}));

// Mock UserSerializer
jest.mock("../../serializers/userSerializer", () => ({
  login: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    type: user.type,
  })),
  serializeOne: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    type: user.type,
  })),
}));

// Mock models
jest.mock("../../models", () => {
  const models = {
    User: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
    },
    UserBills: {
      create: jest.fn(),
      destroy: jest.fn().mockResolvedValue(true),
    },
    UserAppointments: {},
    UserCleanerAppointments: {},
    UserPendingRequests: {},
    UserReviews: {},
    TermsAndConditions: {
      findByPk: jest.fn(),
    },
    UserTermsAcceptance: {
      create: jest.fn(),
    },
    Conversation: {
      findOne: jest.fn(),
    },
    ConversationParticipant: {
      findOrCreate: jest.fn(),
      destroy: jest.fn().mockResolvedValue(true),
    },
    UserHomes: {},
    MultiCleanerJob: {},
    Referral: {
      update: jest.fn().mockResolvedValue(true),
    },
    Op: {
      ne: Symbol("ne"),
    },
  };
  return models;
});

// Mock ReferralService
jest.mock("../../services/ReferralService", () => ({
  validateReferralCode: jest.fn(),
  generateReferralCode: jest.fn(),
  createReferral: jest.fn(),
}));

// Mock MultiCleanerService
jest.mock("../../services/MultiCleanerService", () => ({}));

const {
  User,
  UserBills,
  Conversation,
  ConversationParticipant,
} = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const EncryptionService = require("../../services/EncryptionService");
const UserSerializer = require("../../serializers/userSerializer");

describe("IT Account Management (usersRouter)", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock owner user
  const createMockOwner = (overrides = {}) => ({
    id: 1,
    firstName: "encrypted_Owner",
    lastName: "encrypted_User",
    username: "owner",
    email: "encrypted_owner@example.com",
    type: "owner",
    ...overrides,
  });

  // Helper to create mock IT user
  const createMockITUser = (overrides = {}) => ({
    id: 10,
    firstName: "encrypted_IT",
    lastName: "encrypted_Staff",
    username: "itstaff",
    email: "encrypted_it@example.com",
    phone: "encrypted_5551234567",
    type: "it",
    createdAt: new Date("2025-02-15T10:00:00Z"),
    update: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    // Import router fresh for each test
    jest.isolateModules(() => {
      const usersRouter = require("../../routes/api/v1/usersRouter");
      app.use("/api/v1/users", usersRouter);
    });
  });

  describe("POST /api/v1/users/new-it", () => {
    it("should create a new IT account successfully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findOne.mockResolvedValue(null); // No existing user with email/username

      const newITUser = {
        id: 10,
        firstName: "New",
        lastName: "ITStaff",
        username: "newitstaff",
        email: "newit@example.com",
        type: "it",
        dataValues: {
          id: 10,
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          type: "it",
        },
      };
      User.create.mockResolvedValue(newITUser);
      UserBills.create.mockResolvedValue({ id: 1 });
      Conversation.findOne.mockResolvedValue(null); // No IT Team conversation

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "SecurePass123!",
          phone: "5551234567",
        });

      expect(response.status).toBe(201);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "newitstaff",
          type: "it",
        })
      );
      expect(UserBills.create).toHaveBeenCalled();
      expect(Email.sendEmailCongragulations).toHaveBeenCalled();
    });

    it("should add new IT user to existing IT Team conversation", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findOne.mockResolvedValue(null);

      const newITUser = {
        id: 10,
        username: "newitstaff",
        type: "it",
        dataValues: { id: 10, username: "newitstaff", type: "it" },
      };
      User.create.mockResolvedValue(newITUser);
      UserBills.create.mockResolvedValue({ id: 1 });

      const mockConversation = { id: 100, title: "IT Team" };
      Conversation.findOne.mockResolvedValue(mockConversation);
      ConversationParticipant.findOrCreate.mockResolvedValue([{ id: 1 }, true]);

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(201);
      expect(ConversationParticipant.findOrCreate).toHaveBeenCalledWith({
        where: {
          conversationId: 100,
          userId: 10,
        },
      });
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .post("/api/v1/users/new-it")
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(5);
      User.findByPk.mockResolvedValue({
        id: 5,
        type: "homeowner",
        username: "homeowner1",
      });

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Only owner can create IT accounts");
    });

    it("should return 400 for missing required fields", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          // Missing username, password, email
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Username, password, and email are required");
    });

    it("should return 400 for weak password", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "weak", // Too short, missing requirements
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Password");
    });

    it("should return 400 for password without uppercase", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "password123!", // No uppercase
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("uppercase");
    });

    it("should return 400 for password without special character", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "Password123", // No special character
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("special character");
    });

    it("should return 400 for username containing 'owner'", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "itowner123", // Contains "owner"
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Username cannot contain the word 'owner'");
    });

    it("should return 400 for username containing 'OWNER' (case insensitive)", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "itOWNERstaff",
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Username cannot contain the word 'owner'");
    });

    it("should return 409 for duplicate email", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findOne.mockResolvedValueOnce({ id: 5 }); // Existing user with email

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "existing@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email already exists");
    });

    it("should return 410 for duplicate username", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findOne
        .mockResolvedValueOnce(null) // No email match
        .mockResolvedValueOnce({ id: 5 }); // Username exists

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "existinguser",
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(410);
      expect(response.body.error).toBe("Username already exists");
    });
  });

  describe("GET /api/v1/users/it-staff", () => {
    it("should return list of all IT employees", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());

      const mockITStaff = [
        createMockITUser({ id: 10 }),
        createMockITUser({ id: 11, username: "itstaff2" }),
      ];
      User.findAll.mockResolvedValue(mockITStaff);

      const response = await request(app)
        .get("/api/v1/users/it-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.itStaff).toHaveLength(2);
      expect(response.body.itStaff[0].firstName).toBe("IT");
      expect(EncryptionService.decrypt).toHaveBeenCalled();
    });

    it("should return empty array when no IT staff exists", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/users/it-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.itStaff).toHaveLength(0);
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .get("/api/v1/users/it-staff");

      expect(response.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(5);
      User.findByPk.mockResolvedValue({
        id: 5,
        type: "homeowner",
        username: "homeowner1",
      });

      const response = await request(app)
        .get("/api/v1/users/it-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Only owner can access IT staff list");
    });

    it("should return 403 for IT user (only owner can view)", async () => {
      const token = generateToken(10);
      User.findByPk.mockResolvedValue(createMockITUser());

      const response = await request(app)
        .get("/api/v1/users/it-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /api/v1/users/it-staff/:id", () => {
    it("should update IT employee details", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockOwner()) // Auth check
        .mockResolvedValueOnce(createMockITUser()); // User to update

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "Updated",
          lastName: "Name",
          phone: "5559876543",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("IT employee updated successfully");
    });

    it("should update IT employee email", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(itUser);
      User.findOne.mockResolvedValue(null); // No duplicate email

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "newemail@example.com",
        });

      expect(response.status).toBe(200);
      expect(itUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newemail@example.com",
        })
      );
    });

    it("should return 404 for non-existent IT employee", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .patch("/api/v1/users/it-staff/999")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "Updated" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("IT employee not found");
    });

    it("should return 400 when trying to update non-IT user", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce({ id: 10, type: "homeowner" });

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "Updated" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User is not an IT employee");
    });

    it("should return 400 for invalid email format", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(createMockITUser());

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "invalid-email" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Please enter a valid email address");
    });

    it("should return 409 for duplicate email", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(createMockITUser());
      User.findOne.mockResolvedValue({ id: 20 }); // Another user has this email

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "taken@example.com" });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email is already in use");
    });

    it("should allow updating to same email (own email)", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(itUser);
      User.findOne.mockResolvedValue({ id: 10 }); // Same user found

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "sameemail@example.com" });

      expect(response.status).toBe(200);
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .send({ firstName: "Updated" });

      expect(response.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(5);
      User.findByPk.mockResolvedValue({
        id: 5,
        type: "homeowner",
        username: "homeowner1",
      });

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "Updated" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Only owner can update IT staff");
    });
  });

  describe("DELETE /api/v1/users/it-staff/:id", () => {
    it("should delete IT employee", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(itUser);

      const response = await request(app)
        .delete("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("IT employee removed successfully");
      expect(itUser.destroy).toHaveBeenCalled();
    });

    it("should return 404 for non-existent IT employee", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .delete("/api/v1/users/it-staff/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("IT employee not found");
    });

    it("should return 400 when trying to delete non-IT user", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce({ id: 10, type: "homeowner" });

      const response = await request(app)
        .delete("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User is not an IT employee");
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .delete("/api/v1/users/it-staff/10");

      expect(response.status).toBe(401);
    });

    it("should return 403 for non-owner user", async () => {
      const token = generateToken(5);
      User.findByPk.mockResolvedValue({
        id: 5,
        type: "homeowner",
        username: "homeowner1",
      });

      const response = await request(app)
        .delete("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Only owner can remove IT staff");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors on create", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findOne.mockResolvedValue(null);
      User.create.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "ITStaff",
          username: "newitstaff",
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to create IT account");

      consoleSpy.mockRestore();
    });

    it("should handle database errors on list", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findAll.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await request(app)
        .get("/api/v1/users/it-staff")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch IT staff");

      consoleSpy.mockRestore();
    });

    it("should handle database errors on update", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      itUser.update.mockRejectedValue(new Error("Database error"));
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(itUser);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "Updated" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to update IT employee");

      consoleSpy.mockRestore();
    });

    it("should handle database errors on delete", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      itUser.destroy.mockRejectedValue(new Error("Database error"));
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(itUser);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await request(app)
        .delete("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to remove IT employee");

      consoleSpy.mockRestore();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty firstName and lastName on create", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockOwner());
      User.findOne.mockResolvedValue(null);

      const newITUser = {
        id: 10,
        firstName: "",
        lastName: "",
        username: "newitstaff",
        email: "newit@example.com",
        type: "it",
        dataValues: {
          id: 10,
          firstName: "",
          lastName: "",
          username: "newitstaff",
          email: "newit@example.com",
          type: "it",
        },
      };
      User.create.mockResolvedValue(newITUser);
      UserBills.create.mockResolvedValue({ id: 1 });
      Conversation.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/users/new-it")
        .set("Authorization", `Bearer ${token}`)
        .send({
          // firstName and lastName omitted
          username: "newitstaff",
          email: "newit@example.com",
          password: "SecurePass123!",
        });

      expect(response.status).toBe(201);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "",
          lastName: "",
        })
      );
    });

    it("should handle phone being cleared on update", async () => {
      const token = generateToken(1);
      const itUser = createMockITUser();
      User.findByPk
        .mockResolvedValueOnce(createMockOwner())
        .mockResolvedValueOnce(itUser);

      const response = await request(app)
        .patch("/api/v1/users/it-staff/10")
        .set("Authorization", `Bearer ${token}`)
        .send({ phone: "" }); // Clear phone

      expect(response.status).toBe(200);
      expect(itUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: null,
        })
      );
    });
  });
});
