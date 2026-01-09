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
  hash: jest.fn((value) => `hashed_${value}`),
}));

// Mock bcrypt for password hashing
jest.mock("bcrypt", () => ({
  genSalt: jest.fn().mockResolvedValue("salt"),
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock models
const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  EmployeeJobAssignment: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn((callback) => callback(mockTransaction)),
    Sequelize: {
      Op: {
        in: Symbol("in"),
        notIn: Symbol("notIn"),
        between: Symbol("between"),
        gte: Symbol("gte"),
        lte: Symbol("lte"),
        ne: Symbol("ne"),
      },
    },
  },
}));

// Mock BusinessEmployeeService
jest.mock("../../services/BusinessEmployeeService", () => ({
  inviteEmployee: jest.fn(),
  validateInviteToken: jest.fn(),
  acceptInvite: jest.fn(),
  acceptInviteWithSignup: jest.fn(),
  declineInvite: jest.fn(),
  resendInvite: jest.fn(),
  getEmployeesByBusinessOwner: jest.fn(),
}));

// Mock BusinessEmployeeSerializer
jest.mock("../../serializers/BusinessEmployeeSerializer", () => ({
  serializeInvitation: jest.fn((employee) => ({
    id: employee.id,
    email: employee.email,
    firstName: employee.firstName,
    lastName: employee.lastName,
    businessName: employee.businessOwner?.businessName,
    ownerName: employee.businessOwner
      ? `${employee.businessOwner.firstName} ${employee.businessOwner.lastName}`
      : null,
    position: employee.position,
  })),
  serializeProfile: jest.fn(),
}));

// Mock EmployeeJobAssignmentService
jest.mock("../../services/EmployeeJobAssignmentService", () => ({
  getMyJobs: jest.fn(),
}));

// Mock MarketplaceJobRequirementsService
jest.mock("../../services/MarketplaceJobRequirementsService", () => ({
  getPublishedChecklist: jest.fn(),
}));

// Mock AppointmentJobFlowService
jest.mock("../../services/AppointmentJobFlowService", () => ({}));

// Mock GuestNotLeftService
jest.mock("../../services/GuestNotLeftService", () => ({}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmployeeInvitation: jest.fn().mockResolvedValue(true),
}));

const { User, BusinessEmployee } = require("../../models");
const BusinessEmployeeService = require("../../services/BusinessEmployeeService");
const BusinessEmployeeSerializer = require("../../serializers/BusinessEmployeeSerializer");

describe("Business Employee Router - Invitation Flow", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const businessEmployeeRouter = require("../../routes/api/v1/businessEmployeeRouter");
    app.use("/api/v1/business-employee", businessEmployeeRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // GET /invite/:token - Validate Invitation Token
  // =============================================
  describe("GET /invite/:token - Validate Invitation Token", () => {
    it("should return invitation details for valid token", async () => {
      const mockEmployee = {
        id: 1,
        email: "employee@example.com",
        firstName: "John",
        lastName: "Employee",
        status: "pending_invite",
        businessOwner: {
          id: 100,
          firstName: "Jane",
          lastName: "Owner",
          businessName: "CleanCo",
        },
        position: "Cleaner",
        toJSON: function () {
          return { ...this, toJSON: undefined };
        },
      };

      BusinessEmployeeService.validateInviteToken.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .get("/api/v1/business-employee/invite/abc123def456abc123def456abc12345");

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.invitation).toBeDefined();
      expect(BusinessEmployeeSerializer.serializeInvitation).toHaveBeenCalledWith(mockEmployee);
    });

    it("should return 404 for invalid token", async () => {
      BusinessEmployeeService.validateInviteToken.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/business-employee/invite/invalid-token");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Invalid invitation link");
    });

    it("should return 410 for expired invitation", async () => {
      BusinessEmployeeService.validateInviteToken.mockResolvedValue({
        isExpired: true,
      });

      const res = await request(app)
        .get("/api/v1/business-employee/invite/abc123def456abc123def456abc12345");

      expect(res.status).toBe(410);
      expect(res.body.isExpired).toBe(true);
      expect(res.body.error).toBe("Invitation has expired");
    });

    it("should return 409 for already accepted invitation", async () => {
      BusinessEmployeeService.validateInviteToken.mockResolvedValue({
        isAlreadyAccepted: true,
      });

      const res = await request(app)
        .get("/api/v1/business-employee/invite/abc123def456abc123def456abc12345");

      expect(res.status).toBe(409);
      expect(res.body.isAlreadyAccepted).toBe(true);
      expect(res.body.error).toBe("Invitation already accepted");
    });

    it("should return 410 for terminated employee invitation", async () => {
      BusinessEmployeeService.validateInviteToken.mockResolvedValue({
        isTerminated: true,
      });

      const res = await request(app)
        .get("/api/v1/business-employee/invite/abc123def456abc123def456abc12345");

      expect(res.status).toBe(410);
      expect(res.body.isTerminated).toBe(true);
      expect(res.body.error).toBe("This employee record has been terminated");
    });
  });

  // =============================================
  // POST /invite/:token/accept - Accept Invitation (Authenticated)
  // =============================================
  describe("POST /invite/:token/accept - Accept Invitation (Authenticated User)", () => {
    it("should accept invitation for authenticated user", async () => {
      const userId = 200;
      const token = jwt.sign({ userId }, secretKey);

      const mockEmployee = {
        id: 1,
        firstName: "John",
        lastName: "Employee",
        status: "active",
      };

      // Mock authenticateToken middleware
      User.findByPk.mockResolvedValue({
        id: userId,
        type: "cleaner",
      });

      BusinessEmployeeService.acceptInvite.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Welcome! You have joined the team.");
      expect(res.body.employee).toBeDefined();
      expect(res.body.employee.firstName).toBe("John");
      expect(res.body.employee.status).toBe("active");
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept");

      expect(res.status).toBe(401);
    });

    it("should return 400 for invalid invitation token", async () => {
      const userId = 200;
      const token = jwt.sign({ userId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: userId,
        type: "cleaner",
      });

      BusinessEmployeeService.acceptInvite.mockRejectedValue(
        new Error("Invalid invitation token")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/invalid-token/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid invitation token");
    });

    it("should return 400 if user is already employee of another business", async () => {
      const userId = 200;
      const token = jwt.sign({ userId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: userId,
        type: "cleaner",
      });

      BusinessEmployeeService.acceptInvite.mockRejectedValue(
        new Error("User is already an employee of another business")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("User is already an employee of another business");
    });
  });

  // =============================================
  // POST /invite/:token/accept-with-signup - Accept with Account Creation
  // =============================================
  describe("POST /invite/:token/accept-with-signup - Accept Invitation with Signup", () => {
    const validSignupData = {
      firstName: "John",
      lastName: "Employee",
      username: "johnemp",
      password: "AAbb@@33cc",
      phone: "5551234567",
      termsId: 1,
      privacyPolicyId: 1,
    };

    it("should create account and accept invitation successfully", async () => {
      const mockResult = {
        user: {
          id: 200,
          firstName: "John",
          lastName: "Employee",
          type: "employee",
        },
        employee: {
          id: 1,
          firstName: "John",
          lastName: "Employee",
          status: "active",
          businessOwnerId: 100,
        },
      };

      BusinessEmployeeService.acceptInviteWithSignup.mockResolvedValue(mockResult);

      User.findByPk.mockResolvedValue({
        id: 100,
        firstName: "Jane",
        lastName: "Owner",
        businessName: "CleanCo",
      });

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send(validSignupData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Welcome to the team! Your account has been created.");
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.firstName).toBe("John");
      expect(res.body.user.type).toBe("employee");
      expect(res.body.employee).toBeDefined();
      expect(res.body.employer).toBeDefined();
    });

    it("should return 400 if password is too short", async () => {
      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send({
          ...validSignupData,
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Password must be at least 8 characters");
    });

    it("should return 400 if password lacks required characters", async () => {
      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send({
          ...validSignupData,
          password: "password123", // No uppercase or special chars
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "Password must contain at least 2 uppercase letters, 2 lowercase letters, and 2 special characters"
      );
    });

    it("should return 400 if password has only 1 uppercase letter", async () => {
      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send({
          ...validSignupData,
          password: "Aabcdef@@", // Only 1 uppercase
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("2 uppercase letters");
    });

    it("should return 400 for invalid invitation token", async () => {
      BusinessEmployeeService.acceptInviteWithSignup.mockRejectedValue(
        new Error("Invalid invitation token")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/invalid-token/accept-with-signup")
        .send(validSignupData);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid invitation token");
    });

    it("should return 400 for expired invitation", async () => {
      BusinessEmployeeService.acceptInviteWithSignup.mockRejectedValue(
        new Error("Invitation has expired")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send(validSignupData);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invitation has expired");
    });

    it("should return 400 if username already exists", async () => {
      BusinessEmployeeService.acceptInviteWithSignup.mockRejectedValue(
        new Error("Username already exists")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send(validSignupData);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Username already exists");
    });

    it("should return 400 if email already has an account", async () => {
      BusinessEmployeeService.acceptInviteWithSignup.mockRejectedValue(
        new Error("An account with this email already exists")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send(validSignupData);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("An account with this email already exists");
    });

    it("should return 400 if required fields are missing", async () => {
      BusinessEmployeeService.acceptInviteWithSignup.mockRejectedValue(
        new Error("First name, last name, username, and password are required")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send({
          firstName: "John",
          // Missing lastName, username, password
        });

      expect(res.status).toBe(400);
    });

    it("should return 400 if username is too short", async () => {
      BusinessEmployeeService.acceptInviteWithSignup.mockRejectedValue(
        new Error("Username must be between 4 and 12 characters")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/accept-with-signup")
        .send({
          ...validSignupData,
          username: "abc", // Too short
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Username must be between 4 and 12 characters");
    });
  });

  // =============================================
  // POST /invite/:token/decline - Decline Invitation
  // =============================================
  describe("POST /invite/:token/decline - Decline Invitation", () => {
    it("should decline invitation successfully", async () => {
      BusinessEmployeeService.declineInvite.mockResolvedValue();

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/decline");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Invitation declined");
    });

    it("should return 400 for invalid token", async () => {
      BusinessEmployeeService.declineInvite.mockRejectedValue(
        new Error("Invalid invitation token")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/invalid-token/decline");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid invitation token");
    });

    it("should return 400 if invitation already accepted", async () => {
      BusinessEmployeeService.declineInvite.mockRejectedValue(
        new Error("Invitation has already been accepted")
      );

      const res = await request(app)
        .post("/api/v1/business-employee/invite/abc123def456abc123def456abc12345/decline");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invitation has already been accepted");
    });
  });
});
