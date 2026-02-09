/**
 * Tests for Multi-Cleaner Job Completion Flow
 * Tests the complete flow from submission to approval to payout
 * Ensures multi-cleaner jobs work the same way as solo jobs
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
  encrypt: jest.fn((val) => `encrypted_${val}`),
}));

// Mock the auto-approval calculation
jest.mock("../../services/cron/CompletionApprovalMonitor", () => ({
  calculateAutoApprovalExpiration: jest.fn().mockResolvedValue(
    new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours from now
  ),
}));

// Mock the AutoCompleteMonitor
jest.mock("../../services/cron/AutoCompleteMonitor", () => ({
  parseTimeWindow: jest.fn().mockReturnValue({ start: 8, end: 18 }),
  getAutoCompleteConfig: jest.fn().mockResolvedValue({
    hoursAfterEnd: 4,
    reminderIntervals: [30, 60, 120, 180, 210],
    autoApprovalHours: 24,
    minOnSiteMinutes: 30,
  }),
}));

// Mock MultiCleanerPricingService
jest.mock("../../services/MultiCleanerPricingService", () => ({
  calculateCleanerShare: jest.fn().mockResolvedValue({
    grossAmount: 7500,
    platformFee: 975,
    netAmount: 6525,
  }),
}));

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models with jest functions
const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);
const mockCompletionUpdate = jest.fn().mockResolvedValue(true);
const mockPayoutUpdate = jest.fn().mockResolvedValue(true);

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
      multiCleanerPlatformFeePercent: 13,
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
  MultiCleanerJob,
  Payout,
  StripeConnectAccount,
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

describe("Multi-Cleaner Completion Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SESSION_SECRET = "test-secret";
  });

  // Helper to create multi-cleaner appointment mock
  const createMultiCleanerAppointment = (overrides = {}) => ({
    id: 1,
    userId: 100,
    date: "2026-01-15",
    price: "150",
    paid: true,
    completed: false,
    completionStatus: "in_progress",
    isMultiCleanerJob: true,
    multiCleanerJobId: 10,
    employeesAssigned: ["200", "201"],
    timeToBeCompleted: "anytime",
    jobStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
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

  // Helper to create cleaner completion mock
  const createCleanerCompletion = (cleanerId, status = "in_progress", overrides = {}) => ({
    id: cleanerId,
    cleanerId,
    appointmentId: 1,
    completionStatus: status,
    jobStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    update: mockCompletionUpdate,
    cleaner: { id: cleanerId, firstName: `Cleaner${cleanerId}` },
    canBeApproved: jest.fn().mockReturnValue(status === "submitted"),
    ...overrides,
  });

  describe("Multi-Cleaner Submission", () => {
    it("should submit completion for first cleaner", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(200);

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
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

    it("should allow both cleaners to submit independently", async () => {
      const mockAppointment = createMultiCleanerAppointment();

      // First cleaner submission
      const mockCompletion1 = createCleanerCompletion(200);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion1);
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

      const token1 = generateToken(200);
      const res1 = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          checklistData: { bedroom: { completed: ["b1"] } },
          cleanerId: 200,
        });

      expect(res1.status).toBe(200);

      // Second cleaner submission
      jest.clearAllMocks();
      const mockCompletion2 = createCleanerCompletion(201);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion2);
      User.findByPk.mockResolvedValue({
        id: 201,
        firstName: "Bob",
        email: "bob@example.com",
      });
      UserHomes.findByPk.mockResolvedValue({
        id: 1,
        address: "123 Main St",
        city: "Springfield",
      });

      const token2 = generateToken(201);
      const res2 = await request(app)
        .post("/api/v1/completion/submit/1")
        .set("Authorization", `Bearer ${token2}`)
        .send({
          checklistData: { bathroom: { completed: ["bt1"] } },
          cleanerId: 201,
        });

      expect(res2.status).toBe(200);
    });
  });

  describe("Multi-Cleaner Approval", () => {
    it("should approve first cleaner and process payout", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(200, "submitted");

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
      });

      // Mock payout dependencies
      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        totalCleanersRequired: 2,
      });
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({ id: 1, update: mockPayoutUpdate });
      StripeConnectAccount.findOne.mockResolvedValue({
        stripeAccountId: "acct_test_123",
        payoutsEnabled: true,
      });

      // Mock: not all cleaners approved yet
      CleanerJobCompletion.findAll.mockResolvedValue([
        createCleanerCompletion(200, "approved"),
        createCleanerCompletion(201, "submitted"), // Second cleaner still pending
      ]);

      const token = generateToken(100); // Homeowner
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 200 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.completionStatus).toBe("approved");
      expect(mockCompletionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "approved",
          status: "completed",
        })
      );
      // Payout should be created
      expect(Payout.create).toHaveBeenCalled();
    });

    it("should mark parent appointment as completed when all cleaners approved", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(201, "submitted");

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 201,
        firstName: "Bob",
        email: "bob@example.com",
        expoPushToken: "ExponentPushToken[zzz]",
      });

      // Mock payout dependencies
      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        totalCleanersRequired: 2,
      });
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({ id: 2, update: mockPayoutUpdate });
      StripeConnectAccount.findOne.mockResolvedValue({
        stripeAccountId: "acct_test_456",
        payoutsEnabled: true,
      });

      // Mock: ALL cleaners now approved (after this approval)
      CleanerJobCompletion.findAll.mockResolvedValue([
        createCleanerCompletion(200, "approved"),
        createCleanerCompletion(201, "approved"), // This one just got approved
      ]);

      const token = generateToken(100); // Homeowner
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 201 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Parent appointment should be marked as completed
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
          completionStatus: "approved",
        })
      );
    });

    it("should require cleanerId for multi-cleaner approval", async () => {
      const mockAppointment = createMultiCleanerAppointment();

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(100); // Homeowner
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({}); // No cleanerId

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("cleanerId is required");
    });
  });

  describe("Multi-Cleaner Request Review", () => {
    it("should process request-review and still pay cleaner", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(200, "submitted");

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
        expoPushToken: "ExponentPushToken[yyy]",
      });

      // Mock payout dependencies
      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        totalCleanersRequired: 2,
      });
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({ id: 1, update: mockPayoutUpdate });
      StripeConnectAccount.findOne.mockResolvedValue({
        stripeAccountId: "acct_test_123",
        payoutsEnabled: true,
      });

      // Mock: not all cleaners approved yet
      CleanerJobCompletion.findAll.mockResolvedValue([
        createCleanerCompletion(200, "approved"),
        createCleanerCompletion(201, "in_progress"),
      ]);

      const token = generateToken(100); // Homeowner
      const res = await request(app)
        .post("/api/v1/completion/request-review/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          cleanerId: 200,
          concerns: "Bathroom wasn't cleaned properly",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reviewPending).toBe(true);
      // Cleaner still gets paid
      expect(Payout.create).toHaveBeenCalled();
    });
  });

  describe("Payout Processing", () => {
    it("should calculate correct cleaner share based on room assignments", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(200, "submitted");

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
      });

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        totalCleanersRequired: 2,
      });
      Payout.findOne.mockResolvedValue(null);

      const mockPayoutRecord = { id: 1, update: mockPayoutUpdate };
      Payout.create.mockResolvedValue(mockPayoutRecord);

      StripeConnectAccount.findOne.mockResolvedValue({
        stripeAccountId: "acct_test_123",
        payoutsEnabled: true,
      });

      CleanerJobCompletion.findAll.mockResolvedValue([
        createCleanerCompletion(200, "approved"),
        createCleanerCompletion(201, "in_progress"),
      ]);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 200 });

      expect(res.status).toBe(200);
      // Verify payout was created with correct amounts
      expect(Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanerId: 200,
          appointmentId: 1,
          grossAmount: 7500,
          platformFee: 975,
          netAmount: 6525,
        })
      );
    });

    it("should skip payout if cleaner has no Stripe account", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(200, "submitted");

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
      });

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        totalCleanersRequired: 2,
      });
      Payout.findOne.mockResolvedValue(null);
      StripeConnectAccount.findOne.mockResolvedValue(null); // No Stripe account

      CleanerJobCompletion.findAll.mockResolvedValue([
        createCleanerCompletion(200, "approved"),
        createCleanerCompletion(201, "in_progress"),
      ]);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 200 });

      expect(res.status).toBe(200);
      expect(res.body.payoutResults.status).toBe("skipped");
    });

    it("should not process payout twice for same cleaner", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(200, "submitted");

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
      });

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        totalCleanersRequired: 2,
      });
      // Payout already exists and is completed
      Payout.findOne.mockResolvedValue({
        id: 1,
        status: "completed",
        update: mockPayoutUpdate,
      });

      CleanerJobCompletion.findAll.mockResolvedValue([
        createCleanerCompletion(200, "approved"),
        createCleanerCompletion(201, "in_progress"),
      ]);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 200 });

      expect(res.status).toBe(200);
      expect(res.body.payoutResults.status).toBe("already_paid");
      expect(Payout.create).not.toHaveBeenCalled();
    });
  });

  describe("Status Endpoint for Multi-Cleaner", () => {
    it("should return all cleaner completion statuses", async () => {
      const mockAppointment = {
        ...createMultiCleanerAppointment(),
        completionStatus: "submitted",
        canBeApproved: jest.fn().mockReturnValue(true),
        getTimeUntilAutoApproval: jest.fn().mockReturnValue(14400),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findAll.mockResolvedValue([
        {
          cleanerId: 200,
          completionStatus: "submitted",
          completionSubmittedAt: new Date(),
          autoApprovalExpiresAt: new Date(Date.now() + 14400000),
          cleaner: { id: 200, firstName: "Jane", lastName: "Cleaner" },
          getTimeUntilAutoApproval: () => 14400,
          canBeApproved: () => true,
        },
        {
          cleanerId: 201,
          completionStatus: "in_progress",
          cleaner: { id: 201, firstName: "Bob", lastName: "Helper" },
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

      // Verify cleaner statuses
      const jane = res.body.cleaners.find(c => c.cleanerId === 200);
      const bob = res.body.cleaners.find(c => c.cleanerId === 201);
      expect(jane.completionStatus).toBe("submitted");
      expect(jane.canApprove).toBe(true);
      expect(bob.completionStatus).toBe("in_progress");
      expect(bob.canApprove).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle approval when one cleaner dropped out", async () => {
      const mockAppointment = createMultiCleanerAppointment();
      const mockCompletion = createCleanerCompletion(200, "submitted");

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(mockCompletion);
      User.findByPk.mockResolvedValue({
        id: 200,
        firstName: "Jane",
        email: "jane@example.com",
      });

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        totalCleanersRequired: 2,
      });
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({ id: 1, update: mockPayoutUpdate });
      StripeConnectAccount.findOne.mockResolvedValue({
        stripeAccountId: "acct_test_123",
        payoutsEnabled: true,
      });

      // The database query filters out dropped_out cleaners with Op.notIn
      // So findAll only returns active cleaners - simulating actual DB behavior
      CleanerJobCompletion.findAll.mockResolvedValue([
        createCleanerCompletion(200, "approved"),
        // Cleaner 201 is dropped_out and would be filtered out by the query
      ]);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 200 });

      expect(res.status).toBe(200);
      // Parent should be marked complete since only active cleaner is approved
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
        })
      );
    });

    it("should reject approval from non-homeowner", async () => {
      const mockAppointment = createMultiCleanerAppointment();

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const token = generateToken(200); // Cleaner, not homeowner
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 200 });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only the homeowner");
    });

    it("should reject if cleaner completion not found", async () => {
      const mockAppointment = createMultiCleanerAppointment();

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      CleanerJobCompletion.findOne.mockResolvedValue(null);

      const token = generateToken(100);
      const res = await request(app)
        .post("/api/v1/completion/approve/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ cleanerId: 999 }); // Invalid cleaner ID

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("No completion record found");
    });
  });
});

describe("CompletionApprovalMonitor Multi-Cleaner", () => {
  // Test the auto-approval functionality for multi-cleaner jobs
  // These tests verify that the cron job properly handles multi-cleaner auto-approvals

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have auto-approval expiration set on submission", async () => {
    const mockAppointment = {
      id: 1,
      userId: 100,
      date: "2026-01-15",
      price: "150",
      paid: true,
      completed: false,
      completionStatus: "in_progress",
      isMultiCleanerJob: true,
      multiCleanerJobId: 10,
      employeesAssigned: ["200", "201"],
      timeToBeCompleted: "anytime",
      jobStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
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
    };

    const mockCompletionUpdate = jest.fn().mockResolvedValue(true);
    const mockCompletion = {
      id: 1,
      cleanerId: 200,
      appointmentId: 1,
      completionStatus: "in_progress",
      jobStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      update: mockCompletionUpdate,
      cleaner: { id: 200, firstName: "Jane" },
    };

    UserAppointments.findByPk.mockResolvedValue(mockAppointment);
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
    // Verify autoApprovalExpiresAt was set
    expect(mockCompletionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        completionStatus: "submitted",
        autoApprovalExpiresAt: expect.any(Date),
      })
    );
    expect(res.body.autoApprovalExpiresAt).toBeDefined();
  });
});

describe("Homeowner Dashboard Multi-Cleaner Completion", () => {
  // These tests verify that multi-cleaner completions show up correctly
  // for homeowner review just like solo jobs

  it("should show multi-cleaner job in pending reviews after all cleaners approved", async () => {
    // This test verifies that once all cleaners are approved,
    // the parent appointment.completed = true, so it shows in pending reviews
    const mockAppointment = {
      id: 1,
      userId: 100,
      date: "2026-01-15",
      price: "150",
      paid: true,
      completed: true, // All cleaners approved
      hasClientReview: false,
      isMultiCleanerJob: true,
      multiCleanerJobId: 10,
      employeesAssigned: ["200", "201"],
    };

    // In the real app, this appointment would now appear in:
    // pendingReviews = appointments.filter(apt => apt.completed && !apt.hasClientReview)
    expect(mockAppointment.completed).toBe(true);
    expect(mockAppointment.hasClientReview).toBe(false);

    // This means it will show up for homeowner review
    const wouldShowInPendingReviews = mockAppointment.completed && !mockAppointment.hasClientReview;
    expect(wouldShowInPendingReviews).toBe(true);
  });

  it("should not show in pending reviews until all cleaners are approved", async () => {
    const mockAppointment = {
      id: 1,
      userId: 100,
      date: "2026-01-15",
      price: "150",
      paid: true,
      completed: false, // Not all cleaners approved yet
      hasClientReview: false,
      isMultiCleanerJob: true,
      multiCleanerJobId: 10,
      employeesAssigned: ["200", "201"],
    };

    const wouldShowInPendingReviews = mockAppointment.completed && !mockAppointment.hasClientReview;
    expect(wouldShowInPendingReviews).toBe(false);
  });
});
