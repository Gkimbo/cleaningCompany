/**
 * Tests for the 2-Step Completion Confirmation Router
 * Tests the API endpoints for submit, approve, request-review, and status
 */

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn(() => ({
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        latest_charge: "ch_test_123",
      }),
    },
    transfers: {
      create: jest.fn().mockResolvedValue({
        id: "tr_test_123",
      }),
    },
  }));
});

// Mock notification services
jest.mock("../../services/NotificationService", () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendCompletionSubmittedHomeowner: jest.fn().mockResolvedValue(true),
  sendCompletionAutoApproved: jest.fn().mockResolvedValue(true),
  sendCompletionApprovedCleaner: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushCompletionAwaitingApproval: jest.fn().mockResolvedValue(true),
  sendPushCompletionAutoApproved: jest.fn().mockResolvedValue(true),
  sendPushCompletionApproved: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => `decrypted_${val}`),
}));

// Mock the auto-approval calculation
jest.mock("../../services/cron/CompletionApprovalMonitor", () => ({
  calculateAutoApprovalExpiration: jest.fn().mockResolvedValue(
    new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours from now
  ),
}));

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Create mock models with jest functions
const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);
const mockCompletionUpdate = jest.fn().mockResolvedValue(true);
const mockCanBeApproved = jest.fn().mockReturnValue(true);
const mockGetTimeUntilAutoApproval = jest.fn().mockReturnValue(14400);

// Mock models
jest.mock("../../models", () => ({
  UserAppointments: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  CleanerJobCompletion: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  JobPhoto: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  PricingConfig: {
    getActive: jest.fn().mockResolvedValue({
      completionAutoApprovalHours: 4,
      completionRequiresPhotos: false,
    }),
  },
  MultiCleanerJob: {
    findByPk: jest.fn(),
  },
  UserReviews: {},
  Payout: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  StripeConnectAccount: {
    findOne: jest.fn(),
  },
  UserPendingRequests: {
    destroy: jest.fn(),
  },
  CleanerRoomAssignment: {
    findAll: jest.fn(),
  },
}));

const {
  UserAppointments,
  CleanerJobCompletion,
  User,
  UserHomes,
  JobPhoto,
  PricingConfig,
} = require("../../models");

const completionRouter = require("../../routes/api/v1/completionRouter");

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/completion", completionRouter);

const secretKey = process.env.SESSION_SECRET || "test-secret";

// Helper to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, secretKey);
};

describe("Completion Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SESSION_SECRET = "test-secret";
  });

  describe("POST /submit/:appointmentId", () => {
    const createMockAppointment = (overrides = {}) => ({
      id: 1,
      userId: 100,
      date: "2026-01-15",
      price: "150",
      paid: true,
      completed: false,
      completionStatus: "in_progress",
      isMultiCleanerJob: false,
      employeesAssigned: ["200"],
      user: {
        id: 100,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        expoPushToken: "ExponentPushToken[xxx]",
      },
      home: {
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      },
      update: mockAppointmentUpdate,
      ...overrides,
    });

    it("should submit completion successfully", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        lastName: "Cleaner",
        email: "jane@example.com",
      });
      JobPhoto.count.mockResolvedValue(2);

      const token = generateToken(200);
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          checklistData: { kitchen: { completed: ["k1", "k2"], total: ["k1", "k2", "k3"] } },
          notes: "All done!",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.completionStatus).toBe("submitted");
      expect(res.body.autoApprovalExpiresAt).toBeDefined();
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "submitted",
        })
      );
    });

    it("should reject if user is not assigned to job", async () => {
      const mockAppointment = createMockAppointment({ employeesAssigned: ["300"] });
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(200);
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          checklistData: { kitchen: { completed: ["k1"] } },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("not assigned");
    });

    it("should reject if payment not captured", async () => {
      const mockAppointment = createMockAppointment({ paid: false });
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(200);
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          checklistData: { kitchen: { completed: ["k1"] } },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Payment not yet captured");
    });

    it("should reject if already submitted", async () => {
      const mockAppointment = createMockAppointment({ completionStatus: "submitted" });
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(200);
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          checklistData: { kitchen: { completed: ["k1"] } },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("already submitted");
    });

    it("should reject if already approved", async () => {
      const mockAppointment = createMockAppointment({ completionStatus: "approved" });
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(200);
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          checklistData: { kitchen: { completed: ["k1"] } },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("already approved");
    });

    it("should reject if checklist data is missing", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(200);
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Checklist data is required");
    });

    it("should reject without authorization", async () => {
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .send({
          checklistData: { kitchen: { completed: ["k1"] } },
        });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /approve/:appointmentId", () => {
    const createMockAppointment = (overrides = {}) => ({
      id: 1,
      userId: 100,
      date: "2026-01-15",
      price: "150",
      paid: true,
      completed: false,
      completionStatus: "submitted",
      isMultiCleanerJob: false,
      employeesAssigned: ["200"],
      user: {
        id: 100,
        firstName: "John",
      },
      home: {
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      },
      update: mockAppointmentUpdate,
      canBeApproved: mockCanBeApproved,
      ...overrides,
    });

    it("should approve completion successfully", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
      });

      // Mock payout dependencies
      const { Payout, StripeConnectAccount, UserPendingRequests } = require("../../models");
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({ id: 1, update: jest.fn() });
      StripeConnectAccount.findOne.mockResolvedValue({
        stripeAccountId: "acct_test_123",
        payoutsEnabled: true,
      });
      UserPendingRequests.destroy.mockResolvedValue(1);

      const token = generateToken(100); // Homeowner
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.completionStatus).toBe("approved");
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "approved",
          completed: true,
        })
      );
    });

    it("should reject if not the homeowner", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(200); // Cleaner, not homeowner
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only the homeowner");
    });

    it("should reject if cannot be approved", async () => {
      const mockAppointment = createMockAppointment();
      mockAppointment.canBeApproved = jest.fn().mockReturnValue(false);
      mockAppointment.completionStatus = "in_progress";
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("cannot be approved");
    });
  });

  describe("POST /request-review/:appointmentId", () => {
    const createMockAppointment = (overrides = {}) => ({
      id: 1,
      userId: 100,
      date: "2026-01-15",
      price: "150",
      paid: true,
      completed: false,
      completionStatus: "submitted",
      isMultiCleanerJob: false,
      employeesAssigned: ["200"],
      user: {
        id: 100,
        firstName: "John",
      },
      home: {
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      },
      update: mockAppointmentUpdate,
      ...overrides,
    });

    it("should process request-review and still pay cleaner", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
      });

      // Mock payout dependencies
      const { Payout, StripeConnectAccount, UserPendingRequests } = require("../../models");
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({ id: 1, update: jest.fn() });
      StripeConnectAccount.findOne.mockResolvedValue({
        stripeAccountId: "acct_test_123",
        payoutsEnabled: true,
      });
      UserPendingRequests.destroy.mockResolvedValue(1);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/request-review/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          concerns: "The bathroom wasn't cleaned properly",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reviewPending).toBe(true);
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "approved",
          completed: true,
          homeownerFeedbackRequired: true,
        })
      );
    });

    it("should reject if not submitted yet", async () => {
      const mockAppointment = createMockAppointment({ completionStatus: "in_progress" });
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/request-review/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          concerns: "Issues found",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot request review");
    });
  });

  describe("GET /status/:appointmentId", () => {
    const createMockAppointment = (overrides = {}) => ({
      id: 1,
      userId: 100,
      date: "2026-01-15",
      completionStatus: "submitted",
      completionSubmittedAt: new Date(),
      completionChecklistData: { kitchen: { completed: ["k1"] } },
      completionNotes: "Done!",
      autoApprovalExpiresAt: new Date(Date.now() + 14400000),
      isMultiCleanerJob: false,
      employeesAssigned: ["200"],
      user: {
        id: 100,
        firstName: "John",
        lastName: "Doe",
      },
      home: {
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      },
      canBeApproved: mockCanBeApproved,
      getTimeUntilAutoApproval: mockGetTimeUntilAutoApproval,
      ...overrides,
    });

    it("should return completion status for homeowner", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      JobPhoto.findAll.mockResolvedValue([
        { id: 1, photoType: "before", photoUrl: "https://example.com/before.jpg" },
        { id: 2, photoType: "after", photoUrl: "https://example.com/after.jpg" },
      ]);

      const token = generateToken(100); // Homeowner
      const res = await request(app)
        .get("/api/v1/completion/status/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appointmentId).toBe(1);
      expect(res.body.completionStatus).toBe("submitted");
      expect(res.body.canApprove).toBe(true);
      expect(res.body.photos).toHaveLength(2);
    });

    it("should return completion status for cleaner", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      JobPhoto.findAll.mockResolvedValue([]);

      const token = generateToken(200); // Cleaner
      const res = await request(app)
        .get("/api/v1/completion/status/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.completionStatus).toBe("submitted");
      expect(res.body.canApprove).toBe(false); // Cleaner can't approve
    });

    it("should reject if user has no access", async () => {
      const mockAppointment = createMockAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(999); // Random user
      const res = await request(app)
        .get("/api/v1/completion/status/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("do not have access");
    });

    it("should return 404 for non-existent appointment", async () => {
      UserAppointments.findByPk.mockResolvedValue(null);

      const token = generateToken(100);
      const res = await request(app)
        .get("/api/v1/completion/status/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Multi-cleaner job handling", () => {
    const createMultiCleanerAppointment = () => ({
      id: 1,
      userId: 100,
      date: "2026-01-15",
      paid: true,
      completed: false,
      completionStatus: "in_progress",
      isMultiCleanerJob: true,
      multiCleanerJobId: 10,
      employeesAssigned: ["200", "201"],
      user: {
        id: 100,
        firstName: "John",
        email: "john@example.com",
      },
      home: {
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      },
      update: mockAppointmentUpdate,
    });

    it("should handle multi-cleaner submission", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const mockCompletion = {
        id: 1,
        cleanerId: 200,
        completionStatus: "in_progress",
        update: mockCompletionUpdate,
        cleaner: { id: 200, firstName: "Jane" },
      };
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
      });
      UserHomes.findByPk.mockResolvedValue({
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      });

      const token = generateToken(200);
      const res = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          checklistData: { kitchen: { completed: ["k1"] } },
          cleanerId: 200,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockCompletionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "submitted",
        })
      );
    });

    it("should return all cleaner statuses for multi-cleaner job", async () => {
      const mockAppointment = {
        ...createMultiCleanerAppointment(),
        completionStatus: "submitted",
        getTimeUntilAutoApproval: mockGetTimeUntilAutoApproval,
        canBeApproved: mockCanBeApproved,
      };
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      CleanerJobCompletion.findAll.mockResolvedValue([
        {
          cleanerId: 200,
          completionStatus: "submitted",
          completionSubmittedAt: new Date(),
          autoApprovalExpiresAt: new Date(Date.now() + 14400000),
          cleaner: { id: 200, firstName: "Jane", lastName: "A" },
          getTimeUntilAutoApproval: () => 14400,
          canBeApproved: () => true,
        },
        {
          cleanerId: 201,
          completionStatus: "in_progress",
          cleaner: { id: 201, firstName: "Bob", lastName: "B" },
          getTimeUntilAutoApproval: () => null,
          canBeApproved: () => false,
        },
      ]);
      JobPhoto.findAll.mockResolvedValue([]);

      const token = generateToken(100); // Homeowner
      const res = await request(app)
        .get("/api/v1/completion/status/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isMultiCleanerJob).toBe(true);
      expect(res.body.cleaners).toHaveLength(2);
      expect(res.body.pendingApprovals).toBe(1);
    });
  });
});
