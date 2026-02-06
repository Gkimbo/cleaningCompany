const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Stripe before requiring the router
jest.mock("stripe", () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        client_secret: "pi_test_123_secret_mock",
        amount: 15000,
        currency: "usd",
        status: "requires_payment_method",
      }),
      capture: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "succeeded",
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "requires_capture",
      }),
    },
    transfers: {
      create: jest.fn().mockResolvedValue({
        id: "tr_test_123",
        amount: 13500,
      }),
    },
  }));
});

// Mock models
const mockUserUpdate = jest.fn().mockResolvedValue(true);
const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);

jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  UserBills: {
    findByPk: jest.fn(),
  },
  JobPhoto: {
    count: jest.fn(),
  },
  Payment: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    generateTransactionId: jest.fn(() => `txn_test_${Date.now()}`),
    findAll: jest.fn().mockResolvedValue([]),
  },
  Payout: {
    findByPk: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
  UserPendingRequests: {
    destroy: jest.fn().mockResolvedValue(0),
  },
  UserCleanerAppointments: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  PricingConfig: {
    getActive: jest.fn().mockResolvedValue({
      completionAutoApprovalHours: 4,
      completionRequiresPhotos: false,
    }),
  },
  CleanerJobCompletion: {
    findOne: jest.fn().mockResolvedValue(null),
  },
}));

// Mock Email service (including new 2-step completion methods)
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
  sendCleaningCompletedNotification: jest.fn().mockResolvedValue(true),
  sendCompletionSubmittedHomeowner: jest.fn().mockResolvedValue(true),
}));

// Mock Push Notification service (including new 2-step completion methods)
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushCleaningCompleted: jest.fn().mockResolvedValue(true),
  sendPushCompletionAwaitingApproval: jest.fn().mockResolvedValue(true),
}));

// Mock Encryption service
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => `decrypted_${val}`),
}));

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 1 }),
}));

// Mock CompletionApprovalMonitor
jest.mock("../../services/cron/CompletionApprovalMonitor", () => ({
  calculateAutoApprovalExpiration: jest.fn().mockResolvedValue(
    new Date(Date.now() + 4 * 60 * 60 * 1000)
  ),
}));

// Mock AutoCompleteMonitor - getAutoCompleteConfig and parseTimeWindow are used for timing validation
jest.mock("../../services/cron/AutoCompleteMonitor", () => ({
  getAutoCompleteConfig: jest.fn().mockResolvedValue({
    minOnSiteMinutes: 0, // Disable timing check for tests
    autoCompleteEnabled: false,
  }),
  parseTimeWindow: jest.fn().mockReturnValue({
    start: 8, // 8 AM (anytime)
    end: 18,
  }),
}));

// Mock AppointmentSerializer
jest.mock("../../serializers/AppointmentSerializer", () => ({
  serializeArray: jest.fn((appointments) =>
    appointments.map((appt) => ({
      id: appt.id,
      date: appt.date,
      price: appt.price,
    }))
  ),
  serialize: jest.fn((appointment) => ({
    id: appointment.id,
    date: appointment.date,
    price: appointment.price,
  })),
}));

const { UserAppointments, User, UserHomes, JobPhoto } = require("../../models");

describe("Business Owner Complete Job - Photo Requirements", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Import router after mocks are set up
    const paymentRouter = require("../../routes/api/v1/paymentRouter");
    app.use("/api/v1/payments", paymentRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /complete-job - Business Owner (Preferred Cleaner)", () => {
    const businessOwnerId = 100;
    const clientId = 200;
    const homeId = 300;
    const appointmentId = 400;

    const createMockAppointment = (overrides = {}) => ({
      id: appointmentId,
      userId: clientId,
      homeId: homeId,
      paid: true,
      completed: false,
      completionStatus: "in_progress",
      price: "150",
      employeesAssigned: [businessOwnerId.toString()],
      date: "2025-01-01", // Past date for timing validation
      timeToBeCompleted: "anytime",
      isMultiCleanerJob: false,
      jobStartedAt: new Date(Date.now() - 60 * 60 * 1000), // Started 1 hour ago
      update: mockAppointmentUpdate,
      ...overrides,
    });

    const createMockHome = (preferredCleanerId = null) => ({
      id: homeId,
      address: "encrypted_address",
      city: "encrypted_city",
      state: "encrypted_state",
      zipcode: "12345",
      preferredCleanerId,
    });

    it("should allow business owner to complete job WITHOUT photos", async () => {
      // Setup: Business owner is the preferred cleaner
      const mockAppointment = createMockAppointment();
      const mockHome = createMockHome(businessOwnerId); // preferredCleanerId matches

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      JobPhoto.count.mockResolvedValue(0); // No photos
      User.findByPk.mockResolvedValue({
        id: businessOwnerId,
        firstName: "Test",
        email: "owner@test.com",
        expoPushToken: null,
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: businessOwnerId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // 2-step flow: submission for approval instead of immediate completion
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "submitted",
        })
      );
    });

    it("should allow business owner to complete job WITH photos (optional)", async () => {
      const mockAppointment = createMockAppointment();
      const mockHome = createMockHome(businessOwnerId);

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      // Before photos exist, after photos exist
      JobPhoto.count
        .mockResolvedValueOnce(3) // before photos
        .mockResolvedValueOnce(3); // after photos

      User.findByPk.mockResolvedValue({
        id: businessOwnerId,
        firstName: "Test",
        email: "owner@test.com",
        expoPushToken: null,
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: businessOwnerId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should allow business owner to complete job with only before photos", async () => {
      const mockAppointment = createMockAppointment();
      const mockHome = createMockHome(businessOwnerId);

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      JobPhoto.count
        .mockResolvedValueOnce(3) // before photos exist
        .mockResolvedValueOnce(0); // no after photos

      User.findByPk.mockResolvedValue({
        id: businessOwnerId,
        firstName: "Test",
        email: "owner@test.com",
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: businessOwnerId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should allow business owner to complete job with only after photos", async () => {
      const mockAppointment = createMockAppointment();
      const mockHome = createMockHome(businessOwnerId);

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      JobPhoto.count
        .mockResolvedValueOnce(0) // no before photos
        .mockResolvedValueOnce(3); // after photos exist

      User.findByPk.mockResolvedValue({
        id: businessOwnerId,
        firstName: "Test",
        email: "owner@test.com",
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: businessOwnerId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /complete-job - Regular Cleaner (Not Preferred)", () => {
    const regularCleanerId = 500;
    const clientId = 200;
    const homeId = 300;
    const appointmentId = 400;

    const createMockAppointment = (overrides = {}) => ({
      id: appointmentId,
      userId: clientId,
      homeId: homeId,
      paid: true,
      completed: false,
      completionStatus: "in_progress",
      price: "150",
      employeesAssigned: [regularCleanerId.toString()],
      date: "2025-01-01", // Past date for timing validation
      timeToBeCompleted: "anytime",
      isMultiCleanerJob: false,
      jobStartedAt: new Date(Date.now() - 60 * 60 * 1000), // Started 1 hour ago
      update: mockAppointmentUpdate,
      ...overrides,
    });

    it("should REQUIRE photos for regular cleaner - missing before photos", async () => {
      const mockAppointment = createMockAppointment();
      const mockHome = {
        id: homeId,
        preferredCleanerId: null, // No preferred cleaner
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      JobPhoto.count
        .mockResolvedValueOnce(0) // no before photos
        .mockResolvedValueOnce(3); // after photos exist

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: regularCleanerId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Before photos are required to complete the job");
      expect(res.body.missingPhotos).toBe("before");
    });

    it("should REQUIRE photos for regular cleaner - missing after photos", async () => {
      const mockAppointment = createMockAppointment();
      const mockHome = {
        id: homeId,
        preferredCleanerId: null,
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      JobPhoto.count
        .mockResolvedValueOnce(3) // before photos exist
        .mockResolvedValueOnce(0); // no after photos

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: regularCleanerId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("After photos are required to complete the job");
      expect(res.body.missingPhotos).toBe("after");
    });

    it("should REQUIRE photos for regular cleaner - missing both", async () => {
      const mockAppointment = createMockAppointment();
      const mockHome = {
        id: homeId,
        preferredCleanerId: null,
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      JobPhoto.count
        .mockResolvedValueOnce(0) // no before photos
        .mockResolvedValueOnce(0); // no after photos

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: regularCleanerId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Before photos are required to complete the job");
    });

    it("should allow regular cleaner to complete job when photos exist", async () => {
      const mockAppointment = createMockAppointment();
      const mockHome = {
        id: homeId,
        preferredCleanerId: null,
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      JobPhoto.count
        .mockResolvedValueOnce(3) // before photos exist
        .mockResolvedValueOnce(3); // after photos exist

      User.findByPk.mockResolvedValue({
        id: regularCleanerId,
        firstName: "Test",
        email: "cleaner@test.com",
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: regularCleanerId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should require photos when cleaner is NOT the preferred cleaner for this home", async () => {
      const differentBusinessOwnerId = 999;
      const mockAppointment = createMockAppointment();
      const mockHome = {
        id: homeId,
        preferredCleanerId: differentBusinessOwnerId, // Different business owner
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      JobPhoto.count
        .mockResolvedValueOnce(0) // no before photos
        .mockResolvedValueOnce(0); // no after photos

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId,
          cleanerId: regularCleanerId, // Not the preferred cleaner
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Before photos are required to complete the job");
    });
  });

  describe("POST /complete-job - Edge Cases", () => {
    it("should return 404 if appointment not found", async () => {
      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 9999,
          cleanerId: 1,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Appointment not found");
    });

    it("should return 400 if payment not yet captured", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        paid: false, // Not paid
        completed: false,
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          cleanerId: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Payment not yet captured");
    });

    it("should return 400 if job already marked as complete", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        paid: true,
        completed: true, // Already completed
        date: "2025-01-01",
        timeToBeCompleted: "anytime",
        isMultiCleanerJob: false,
        jobStartedAt: new Date(Date.now() - 60 * 60 * 1000),
        employeesAssigned: ["1"],
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          cleanerId: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Job already marked as complete");
    });

    it("should return 400 if no cleaner assigned", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        paid: true,
        completed: false,
        employeesAssigned: [],
        date: "2025-01-01",
        timeToBeCompleted: "anytime",
        isMultiCleanerJob: false,
        jobStartedAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          // No cleanerId provided
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("No cleaner assigned to this job");
    });

    it("should use first assigned employee if cleanerId not provided", async () => {
      const assignedCleanerId = 123;
      const mockAppointment = {
        id: 1,
        userId: 200,
        homeId: 300,
        paid: true,
        completed: false,
        completionStatus: "in_progress",
        price: "150",
        employeesAssigned: [assignedCleanerId.toString()],
        date: "2025-01-01",
        timeToBeCompleted: "anytime",
        isMultiCleanerJob: false,
        jobStartedAt: new Date(Date.now() - 60 * 60 * 1000),
        update: mockAppointmentUpdate,
      };
      const mockHome = {
        id: 300,
        preferredCleanerId: assignedCleanerId, // Is the preferred cleaner
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      JobPhoto.count.mockResolvedValue(0); // No photos - should be allowed
      User.findByPk.mockResolvedValue({
        id: assignedCleanerId,
        firstName: "Test",
        email: "cleaner@test.com",
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          // No cleanerId - should use employeesAssigned[0]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should handle preferredCleanerId as string comparison correctly", async () => {
      const businessOwnerId = 100;
      const mockAppointment = {
        id: 1,
        userId: 200,
        homeId: 300,
        paid: true,
        completed: false,
        completionStatus: "in_progress",
        price: "150",
        employeesAssigned: [businessOwnerId.toString()],
        date: "2025-01-01",
        timeToBeCompleted: "anytime",
        isMultiCleanerJob: false,
        jobStartedAt: new Date(Date.now() - 60 * 60 * 1000),
        update: mockAppointmentUpdate,
      };
      const mockHome = {
        id: 300,
        preferredCleanerId: businessOwnerId, // Integer
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      JobPhoto.count.mockResolvedValue(0);
      User.findByPk.mockResolvedValue({
        id: businessOwnerId,
        firstName: "Test",
        email: "owner@test.com",
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          cleanerId: businessOwnerId.toString(), // String
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should handle home without preferredCleanerId", async () => {
      const cleanerId = 100;
      const mockAppointment = {
        id: 1,
        userId: 200,
        homeId: 300,
        paid: true,
        completed: false,
        completionStatus: "in_progress",
        price: "150",
        employeesAssigned: [cleanerId.toString()],
        date: "2025-01-01",
        timeToBeCompleted: "anytime",
        isMultiCleanerJob: false,
        jobStartedAt: new Date(Date.now() - 60 * 60 * 1000),
        update: mockAppointmentUpdate,
      };
      const mockHome = {
        id: 300,
        preferredCleanerId: null, // No preferred cleaner
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      JobPhoto.count
        .mockResolvedValueOnce(0) // no before
        .mockResolvedValueOnce(0); // no after

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          cleanerId: cleanerId,
        });

      // Should require photos since there's no preferred cleaner
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Before photos are required to complete the job");
    });
  });

  describe("POST /complete-job - Locking Behavior", () => {
    it("should not allow completing an already completed job", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        paid: true,
        completed: true, // Already completed
        date: "2025-01-01",
        timeToBeCompleted: "anytime",
        isMultiCleanerJob: false,
        jobStartedAt: new Date(Date.now() - 60 * 60 * 1000),
        employeesAssigned: ["1"],
      });

      const res = await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          cleanerId: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Job already marked as complete");
    });

    it("should submit completion for approval after successful completion (2-step flow)", async () => {
      const businessOwnerId = 100;
      const mockAppointment = {
        id: 1,
        userId: 200,
        homeId: 300,
        paid: true,
        completed: false,
        completionStatus: "in_progress",
        price: "150",
        employeesAssigned: [businessOwnerId.toString()],
        date: "2025-01-01",
        timeToBeCompleted: "anytime",
        isMultiCleanerJob: false,
        jobStartedAt: new Date(Date.now() - 60 * 60 * 1000),
        update: mockAppointmentUpdate,
      };
      const mockHome = {
        id: 300,
        preferredCleanerId: businessOwnerId,
        address: "123 Main St",
        city: "Springfield",
        state: "IL",
        zipcode: "62701",
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      JobPhoto.count.mockResolvedValue(0);
      User.findByPk.mockResolvedValue({
        id: businessOwnerId,
        firstName: "Test",
        email: "owner@test.com",
        stripeAccountId: "acct_test",
        stripeAccountStatus: "complete",
      });

      await request(app)
        .post("/api/v1/payments/complete-job")
        .send({
          appointmentId: 1,
          cleanerId: businessOwnerId,
        });

      // With 2-step flow, completion is submitted for approval instead of immediately marked complete
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: "submitted",
        })
      );
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
