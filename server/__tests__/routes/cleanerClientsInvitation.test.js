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

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  RecurringSchedule: {},
  UserAppointments: {},
  UserCleanerAppointments: {},
  UserBills: {
    create: jest.fn(),
  },
  Payout: {},
  Review: {
    findAll: jest.fn().mockResolvedValue([]),
  },
}));

// Mock Email
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendClientInvitation: jest.fn().mockResolvedValue(true),
  sendInvitationReminder: jest.fn().mockResolvedValue(true),
  sendInvitationAccepted: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushInvitationAccepted: jest.fn().mockResolvedValue(true),
}));

// Mock InvitationService
jest.mock("../../services/InvitationService", () => ({
  createInvitation: jest.fn(),
  validateInviteToken: jest.fn(),
  acceptInvitation: jest.fn(),
  resendInvitation: jest.fn(),
  getCleanerClients: jest.fn(),
  declineInvitation: jest.fn(),
}));

// Mock IncentiveService
jest.mock("../../services/IncentiveService", () => ({
  calculateCleanerPrice: jest.fn(),
}));

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  addNotification: jest.fn(),
}));

// Mock CalculatePrice
jest.mock("../../services/CalculatePrice", () => jest.fn());

const { User, CleanerClient, UserHomes, UserBills } = require("../../models");
const InvitationService = require("../../services/InvitationService");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const EncryptionService = require("../../services/EncryptionService");

describe("Cleaner Clients Router - Invitation Flow", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const cleanerClientsRouter = require("../../routes/api/v1/cleanerClientsRouter");
    app.use("/api/v1/cleaner-clients", cleanerClientsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /invite", () => {
    const cleanerId = 100;

    it("should create a new invitation successfully", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
        firstName: "encrypted_Jane",
        lastName: "encrypted_Cleaner",
      });

      const mockCleanerClient = {
        id: 1,
        cleanerId,
        inviteToken: "abc123def456abc123def456abc12345",
        invitedEmail: "client@example.com",
        invitedName: "John Client",
        status: "pending_invite",
      };

      InvitationService.createInvitation.mockResolvedValue(mockCleanerClient);

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "John Client",
          email: "client@example.com",
          phone: "555-123-4567",
          address: {
            address: "123 Main St",
            city: "Test City",
            state: "TS",
            zipcode: "12345",
          },
          beds: 3,
          baths: 2,
          frequency: "weekly",
          price: 150,
        });

      expect(res.status).toBe(201);
      expect(res.body.cleanerClient).toBeDefined();
      expect(InvitationService.createInvitation).toHaveBeenCalled();
      expect(Email.sendClientInvitation).toHaveBeenCalled();
    });

    it("should return 400 if name is missing", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "client@example.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Client name is required");
    });

    it("should return 400 if email is missing", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "John Client",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Client email is required");
    });

    it("should return 400 if email format is invalid", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "John Client",
          email: "invalid-email",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid email format");
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .post("/api/v1/cleaner-clients/invite")
        .send({
          name: "John Client",
          email: "client@example.com",
        });

      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not a cleaner", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 200,
        type: "homeowner",
      });

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "John Client",
          email: "client@example.com",
        });

      expect(res.status).toBe(403);
    });

    it("should return 400 if invitation already exists", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      InvitationService.createInvitation.mockRejectedValue(
        new Error("An invitation has already been sent to this email")
      );

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "John Client",
          email: "client@example.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("An invitation has already been sent to this email");
    });
  });

  describe("GET /invitations/:token", () => {
    it("should return invitation details for valid token", async () => {
      const mockCleanerClient = {
        id: 1,
        invitedEmail: "client@example.com",
        invitedName: "John Client",
        invitedPhone: "555-123-4567",
        invitedAddress: JSON.stringify({
          address: "123 Main St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        }),
        invitedBeds: 3,
        invitedBaths: 2,
        status: "pending_invite",
        cleaner: {
          id: 100,
          firstName: "encrypted_Jane",
          lastName: "encrypted_Cleaner",
        },
        toJSON: function () {
          return {
            ...this,
            toJSON: undefined,
          };
        },
      };

      InvitationService.validateInviteToken.mockResolvedValue(mockCleanerClient);

      const res = await request(app)
        .get("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345");

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.invitation).toBeDefined();
      expect(res.body.invitation.name).toBe("John Client");
      expect(res.body.invitation.cleanerName).toBe("Jane Cleaner");
    });

    it("should return 404 for invalid token", async () => {
      InvitationService.validateInviteToken.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/cleaner-clients/invitations/invalid-token");

      expect(res.status).toBe(404);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toBe("Invalid invitation link");
    });

    it("should return 400 if invitation already accepted", async () => {
      InvitationService.validateInviteToken.mockResolvedValue({
        isAlreadyAccepted: true,
      });

      const res = await request(app)
        .get("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345");

      expect(res.status).toBe(400);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toBe("This invitation has already been accepted. Please log in.");
    });

    it("should return 400 if invitation was declined", async () => {
      InvitationService.validateInviteToken.mockResolvedValue({
        isExpired: true,
      });

      const res = await request(app)
        .get("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345");

      expect(res.status).toBe(400);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toBe("This invitation has been declined.");
    });
  });

  describe("POST /invitations/:token/accept", () => {
    it("should accept invitation and create user account", async () => {
      const mockResult = {
        user: {
          id: 200,
          firstName: "encrypted_John",
          lastName: "encrypted_Client",
          email: "encrypted_client@example.com",
          type: "homeowner",
        },
        home: {
          id: 300,
          address: "encrypted_123 Main St",
          city: "encrypted_Test City",
        },
        cleanerClient: {
          id: 1,
          cleanerId: 100,
        },
      };

      InvitationService.acceptInvitation.mockResolvedValue(mockResult);

      User.findByPk.mockResolvedValue({
        id: 100,
        firstName: "encrypted_Jane",
        lastName: "encrypted_Cleaner",
        email: "encrypted_cleaner@example.com",
        expoPushToken: "ExponentPushToken[xxx]",
      });

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345/accept")
        .send({
          password: "SecurePassword123!",
          phone: "555-123-4567",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(Email.sendInvitationAccepted).toHaveBeenCalled();
    });

    it("should return 400 if password is missing", async () => {
      const res = await request(app)
        .post("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345/accept")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Password must be at least 8 characters");
    });

    it("should return 400 if password is too short", async () => {
      const res = await request(app)
        .post("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345/accept")
        .send({
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Password must be at least 8 characters");
    });

    it("should return 400 for invalid invitation", async () => {
      InvitationService.acceptInvitation.mockRejectedValue(
        new Error("Invalid or expired invitation")
      );

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invitations/invalid-token/accept")
        .send({
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid or expired invitation");
    });

    it("should return 400 if user already exists", async () => {
      InvitationService.acceptInvitation.mockRejectedValue(
        new Error("An account with this email already exists. Please log in instead.")
      );

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345/accept")
        .send({
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("An account with this email already exists. Please log in instead.");
    });
  });

  describe("POST /invitations/:token/decline", () => {
    it("should decline invitation successfully", async () => {
      InvitationService.declineInvitation.mockResolvedValue(true);

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invitations/abc123def456abc123def456abc12345/decline");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Invitation declined");
    });

    it("should return 400 for invalid invitation", async () => {
      InvitationService.declineInvitation.mockRejectedValue(
        new Error("Invitation not found or already processed")
      );

      const res = await request(app)
        .post("/api/v1/cleaner-clients/invitations/invalid-token/decline");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invitation not found or already processed");
    });
  });

  describe("GET /my-cleaner (Client endpoint)", () => {
    const clientId = 200;

    it("should return cleaner relationship for homeowner", async () => {
      const token = jwt.sign({ userId: clientId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: clientId,
        type: "homeowner",
      });

      const mockCleanerClient = {
        id: 1,
        cleanerId: 100,
        clientId,
        status: "active",
        defaultPrice: 150,
        defaultFrequency: "weekly",
        since: "2024-01-15T00:00:00Z",
        cleaner: {
          id: 100,
          firstName: "encrypted_Jane",
          lastName: "encrypted_Cleaner",
          profilePhoto: null,
        },
      };

      CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

      const res = await request(app)
        .get("/api/v1/cleaner-clients/my-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cleaner).toBeDefined();
      expect(res.body.cleaner.firstName).toBe("Jane");
      expect(res.body.relationship).toBeDefined();
      expect(res.body.relationship.defaultPrice).toBe(150);
    });

    it("should return null cleaner if no relationship exists", async () => {
      const token = jwt.sign({ userId: clientId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: clientId,
        type: "homeowner",
      });

      CleanerClient.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/cleaner-clients/my-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cleaner).toBeNull();
    });
  });

  describe("POST /:id/resend (Resend invitation)", () => {
    const cleanerId = 100;

    it("should resend invitation successfully", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
        firstName: "encrypted_Jane",
        lastName: "encrypted_Cleaner",
      });

      const mockCleanerClient = {
        id: 1,
        inviteToken: "abc123def456abc123def456abc12345",
        invitedEmail: "encrypted_client@example.com",
        invitedName: "encrypted_John Client",
      };

      InvitationService.resendInvitation.mockResolvedValue(mockCleanerClient);

      const res = await request(app)
        .post("/api/v1/cleaner-clients/1/resend-invite")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Email.sendInvitationReminder).toHaveBeenCalled();
    });

    it("should return 400 if invitation not found", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      InvitationService.resendInvitation.mockRejectedValue(
        new Error("Invitation not found or already accepted")
      );

      const res = await request(app)
        .post("/api/v1/cleaner-clients/999/resend-invite")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invitation not found or already accepted");
    });
  });

  describe("GET / (List all clients)", () => {
    const cleanerId = 100;

    it("should return all clients for cleaner", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const mockClients = [
        {
          id: 1,
          status: "active",
          clientId: 200,
          defaultPrice: 150,
          client: {
            id: 200,
            firstName: "encrypted_John",
            lastName: "encrypted_Client",
          },
          home: {
            id: 300,
            address: "encrypted_123 Main St",
            city: "encrypted_Test City",
            numBeds: 3,
            numBaths: 2,
          },
        },
        {
          id: 2,
          status: "pending_invite",
          invitedEmail: "encrypted_pending@example.com",
          invitedName: "encrypted_Jane Pending",
        },
      ];

      InvitationService.getCleanerClients.mockResolvedValue(mockClients);

      const res = await request(app)
        .get("/api/v1/cleaner-clients")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.clients).toHaveLength(2);
      expect(InvitationService.getCleanerClients).toHaveBeenCalledWith(
        cleanerId,
        undefined,
        expect.any(Object)
      );
    });

    it("should filter clients by status", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      InvitationService.getCleanerClients.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/cleaner-clients?status=active")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(InvitationService.getCleanerClients).toHaveBeenCalledWith(
        cleanerId,
        "active",
        expect.any(Object)
      );
    });
  });
});
