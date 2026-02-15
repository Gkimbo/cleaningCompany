const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock InvitationService
jest.mock("../../services/InvitationService", () => ({
  createInvitation: jest.fn(),
  validateInviteToken: jest.fn(),
  getCleanerClients: jest.fn(),
  resendInvitation: jest.fn(),
  acceptInvitation: jest.fn(),
  declineInvitation: jest.fn(),
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendClientInvitation: jest.fn().mockResolvedValue(true),
  sendInvitationReminder: jest.fn().mockResolvedValue(true),
  sendInvitationAccepted: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushInvitationAccepted: jest.fn().mockResolvedValue(true),
}));

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock CalculatePrice
jest.mock("../../services/CalculatePrice", () => jest.fn().mockResolvedValue(150));

// Mock IncentiveService
jest.mock("../../services/IncentiveService", () => ({
  calculateCleanerFee: jest.fn().mockResolvedValue(15),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  RecurringSchedule: {
    update: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserCleanerAppointments: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Payout: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  EmployeeJobAssignment: {
    destroy: jest.fn(),
  },
  Review: {
    findAll: jest.fn(),
  },
}));

const { User, CleanerClient, RecurringSchedule, UserAppointments, UserCleanerAppointments, Payout, EmployeeJobAssignment, UserBills } = require("../../models");
const InvitationService = require("../../services/InvitationService");

describe("Cleaner Clients Router", () => {
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

  describe("DELETE /:id - Cancel/Deactivate Client", () => {
    const cleanerId = 100;

    describe("Cancelling Pending Invitations", () => {
      it("should cancel a pending invitation and set status to cancelled", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);
        const mockCleanerClient = {
          id: 1,
          cleanerId: cleanerId,
          status: "pending_invite",
          update: jest.fn().mockResolvedValue(true),
        };

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

        const res = await request(app)
          .delete("/api/v1/cleaner-clients/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Invitation cancelled");
        expect(mockCleanerClient.update).toHaveBeenCalledWith({ status: "cancelled" });
        expect(RecurringSchedule.update).not.toHaveBeenCalled();
      });

      it("should not deactivate recurring schedules for pending invitations", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);
        const mockCleanerClient = {
          id: 1,
          cleanerId: cleanerId,
          status: "pending_invite",
          update: jest.fn().mockResolvedValue(true),
        };

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

        await request(app)
          .delete("/api/v1/cleaner-clients/1")
          .set("Authorization", `Bearer ${token}`);

        expect(RecurringSchedule.update).not.toHaveBeenCalled();
      });
    });

    describe("Deactivating Active Clients", () => {
      it("should deactivate an active client relationship", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);
        const mockCleanerClient = {
          id: 2,
          cleanerId: cleanerId,
          status: "active",
          update: jest.fn().mockResolvedValue(true),
        };

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        CleanerClient.findOne.mockResolvedValue(mockCleanerClient);
        RecurringSchedule.findAll.mockResolvedValue([]); // No schedules
        RecurringSchedule.update.mockResolvedValue([1]);

        const res = await request(app)
          .delete("/api/v1/cleaner-clients/2")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Client relationship deactivated");
        expect(mockCleanerClient.update).toHaveBeenCalledWith({ status: "inactive" });
      });

      it("should deactivate recurring schedules and delete future appointments for active clients", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);
        const mockCleanerClient = {
          id: 2,
          cleanerId: cleanerId,
          status: "active",
          update: jest.fn().mockResolvedValue(true),
        };

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

        // Mock finding schedules for this client
        RecurringSchedule.findAll.mockResolvedValue([{ id: 10 }, { id: 11 }]);
        RecurringSchedule.update.mockResolvedValue([2]);

        // Mock finding and deleting future appointments
        UserAppointments.findAll.mockResolvedValue([
          { id: 101, userId: 200, price: "150" },
          { id: 102, userId: 200, price: "150" },
        ]);
        UserAppointments.destroy.mockResolvedValue(2);
        UserCleanerAppointments.destroy.mockResolvedValue(2);
        EmployeeJobAssignment.destroy.mockResolvedValue(2);
        Payout.destroy.mockResolvedValue(2);

        const mockUserBill = {
          appointmentDue: 300,
          totalDue: 300,
          update: jest.fn().mockResolvedValue(true),
        };
        UserBills.findOne.mockResolvedValue(mockUserBill);

        const res = await request(app)
          .delete("/api/v1/cleaner-clients/2")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.cancelledAppointments).toBe(4); // 2 appointments x 2 schedules
        expect(RecurringSchedule.update).toHaveBeenCalledWith(
          { isActive: false },
          { where: { cleanerClientId: "2" } }
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 404 if client not found", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        CleanerClient.findOne.mockResolvedValue(null);

        const res = await request(app)
          .delete("/api/v1/cleaner-clients/999")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Client not found");
      });

      it("should return 401 if no token provided", async () => {
        const res = await request(app)
          .delete("/api/v1/cleaner-clients/1");

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Unauthorized");
      });

      it("should return 403 if user is not a cleaner", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 200,
          type: "homeowner",
        });

        const res = await request(app)
          .delete("/api/v1/cleaner-clients/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Cleaner access required");
      });

      it("should return 401 for invalid token", async () => {
        const res = await request(app)
          .delete("/api/v1/cleaner-clients/1")
          .set("Authorization", "Bearer invalid_token");

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid token");
      });

      it("should return 500 on database error", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        CleanerClient.findOne.mockRejectedValue(new Error("Database error"));

        const res = await request(app)
          .delete("/api/v1/cleaner-clients/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to delete client");
      });

      it("should not allow cancelling another cleaner's invitation", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        // CleanerClient.findOne with cleanerId constraint returns null
        CleanerClient.findOne.mockResolvedValue(null);

        const res = await request(app)
          .delete("/api/v1/cleaner-clients/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Client not found");
      });
    });
  });

  describe("GET /invitations/:token - Validate Invitation", () => {
    describe("Cancelled Invitations", () => {
      it("should return isCancelled flag for cancelled invitations", async () => {
        const mockCleanerClient = {
          id: 1,
          invitedName: "encrypted_John Doe",
          invitedEmail: "encrypted_john@example.com",
          invitedPhone: "encrypted_555-1234",
          invitedAddress: JSON.stringify({ address: "123 Main St", city: "Boston" }),
          invitedBeds: 3,
          invitedBaths: 2,
          isCancelled: true,
          cleaner: null,
        };

        InvitationService.validateInviteToken.mockResolvedValue(mockCleanerClient);

        const res = await request(app)
          .get("/api/v1/cleaner-clients/invitations/abc123def456");

        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(true);
        expect(res.body.isCancelled).toBe(true);
        expect(res.body.invitation.cleanerName).toBeNull();
      });

      it("should return cleaner name for valid non-cancelled invitations", async () => {
        const mockCleanerClient = {
          id: 1,
          invitedName: "John Doe",
          invitedEmail: "john@example.com",
          invitedPhone: null,
          invitedAddress: null,
          invitedBeds: null,
          invitedBaths: null,
          isCancelled: false,
          cleaner: {
            id: 100,
            firstName: "encrypted_Jane",
            lastName: "encrypted_Cleaner",
          },
        };

        InvitationService.validateInviteToken.mockResolvedValue(mockCleanerClient);

        const res = await request(app)
          .get("/api/v1/cleaner-clients/invitations/abc123def456");

        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(true);
        expect(res.body.isCancelled).toBe(false);
        expect(res.body.invitation.cleanerName).toBe("Jane Cleaner");
      });
    });

    describe("Invalid Invitations", () => {
      it("should return 404 for invalid token", async () => {
        InvitationService.validateInviteToken.mockResolvedValue(null);

        const res = await request(app)
          .get("/api/v1/cleaner-clients/invitations/invalid_token");

        expect(res.status).toBe(404);
        expect(res.body.valid).toBe(false);
        expect(res.body.error).toBe("Invalid invitation link");
      });

      it("should return 400 for already accepted invitation", async () => {
        InvitationService.validateInviteToken.mockResolvedValue({
          isAlreadyAccepted: true,
        });

        const res = await request(app)
          .get("/api/v1/cleaner-clients/invitations/accepted_token");

        expect(res.status).toBe(400);
        expect(res.body.valid).toBe(false);
        expect(res.body.error).toBe("This invitation has already been accepted. Please log in.");
      });

      it("should return 400 for declined invitation", async () => {
        InvitationService.validateInviteToken.mockResolvedValue({
          isExpired: true,
        });

        const res = await request(app)
          .get("/api/v1/cleaner-clients/invitations/declined_token");

        expect(res.status).toBe(400);
        expect(res.body.valid).toBe(false);
        expect(res.body.error).toBe("This invitation has been declined.");
      });
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
