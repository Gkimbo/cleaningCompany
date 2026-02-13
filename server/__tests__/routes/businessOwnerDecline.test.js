/**
 * Tests for Business Owner Decline Flow
 * Tests the complete flow when a business owner cannot assign anyone to a client's appointment
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Set SESSION_SECRET before any router imports (middleware captures it at module load time)
process.env.SESSION_SECRET = "test_secret";

// Mock NotificationService before requiring router
jest.mock("../../services/NotificationService", () => ({
  notifyBusinessOwnerDeclined: jest.fn().mockResolvedValue(true),
  notifyClientOpenedToMarketplace: jest.fn().mockResolvedValue(true),
  notifyClientCancelledAfterDecline: jest.fn().mockResolvedValue(true),
}));

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val || "decrypted"),
  encrypt: jest.fn((val) => val),
}));

// Mock CalculatePrice
const mockCalculatePrice = jest.fn(() => 200);
jest.mock("../../services/CalculatePrice", () => mockCalculatePrice);

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendBusinessOwnerDeclinedEmail: jest.fn().mockResolvedValue(true),
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));

// Store mock functions
const mockAppointmentUpdate = jest.fn().mockResolvedValue([1]);
const mockNotificationUpdate = jest.fn().mockResolvedValue([1]);

// Mock models - comprehensive for all router dependencies
jest.mock("../../models", () => {
  const mockSequelize = {
    transaction: jest.fn((cb) => cb({ commit: jest.fn(), rollback: jest.fn() })),
    literal: jest.fn((val) => val),
    define: jest.fn(),
  };

  const Op = {
    ne: Symbol("ne"),
    in: Symbol("in"),
    notIn: Symbol("notIn"),
    gte: Symbol("gte"),
    lte: Symbol("lte"),
    gt: Symbol("gt"),
    lt: Symbol("lt"),
    like: Symbol("like"),
    or: Symbol("or"),
    and: Symbol("and"),
    eq: Symbol("eq"),
    between: Symbol("between"),
  };

  return {
    sequelize: mockSequelize,
    Sequelize: { Op },
    Op, // Also export directly for destructuring in router
    User: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      findAll: jest.fn(),
    },
    UserAppointments: {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    UserHomes: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn(),
    },
    CleanerClient: {
      findOne: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Notification: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue([1]),
    },
    EmployeeJobAssignment: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    },
    BusinessEmployee: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    },
    PricingConfig: {
      findOne: jest.fn().mockResolvedValue({
        basePrice: 150,
        extraBedBathFee: 50,
        halfBathFee: 25,
        platformFeePercent: 15,
      }),
      getActive: jest.fn().mockResolvedValue({
        platformFeePercent: 10,
      }),
    },
    RecurringSchedule: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    },
    Payout: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    },
    UserCleanerAppointments: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    },
    UserBills: {
      findOne: jest.fn(),
    },
    UserPendingRequests: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    CleanerJobCompletion: {
      findOne: jest.fn(),
    },
    HomePreferredCleaner: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    StripeConnectAccount: {
      findOne: jest.fn(),
    },
  };
});

// Mock services that businessOwnerRouter imports
jest.mock("../../services/BusinessEmployeeService", () => ({
  getEmployeesByBusinessOwner: jest.fn().mockResolvedValue([]),
  getEmployeeById: jest.fn(),
}));

jest.mock("../../services/EmployeeJobAssignmentService", () => ({
  getAssignmentsForJob: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../services/BusinessAnalyticsService", () => ({
  getOverview: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../services/BusinessVolumeService", () => ({
  getVolumeStats: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../services/BusinessVerificationService", () => ({
  getVerificationStatus: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../services/PayCalculatorService", () => ({
  calculatePay: jest.fn().mockReturnValue({ totalPay: 100 }),
  estimateHours: jest.fn().mockReturnValue(2),
}));

jest.mock("../../services/CustomJobFlowService", () => ({
  getFlowsByBusinessOwner: jest.fn().mockResolvedValue([]),
}));

// Mock serializers
jest.mock("../../serializers/BusinessEmployeeSerializer", () => ({
  serializeArray: jest.fn((arr) => arr),
  serializeOne: jest.fn((obj) => obj),
}));

jest.mock("../../serializers/EmployeeJobAssignmentSerializer", () => ({
  serializeArray: jest.fn((arr) => arr),
}));

jest.mock("../../serializers/AppointmentSerializer", () => ({
  serializeArray: jest.fn((arr) => arr),
  serialize: jest.fn((obj) => obj),
}));

jest.mock("../../serializers/CustomJobFlowSerializer", () => ({
  serializeArrayForList: jest.fn((arr) => arr),
}));

jest.mock("../../serializers/ClientJobFlowAssignmentSerializer", () => ({
  serializeArray: jest.fn((arr) => arr),
}));

jest.mock("../../serializers/CustomJobFlowChecklistSerializer", () => ({
  serializeArray: jest.fn((arr) => arr),
}));

jest.mock("../../serializers/TimesheetSerializer", () => ({
  serializeArray: jest.fn((arr) => arr),
}));

// Import after all mocks
const NotificationService = require("../../services/NotificationService");
const {
  User,
  UserAppointments,
  UserHomes,
  Notification,
} = require("../../models");

describe("Business Owner Decline Flow", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  // Helper to get a future date string
  const getFutureDate = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split("T")[0];
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Import routers after mocks are set up
    const businessOwnerRouter = require("../../routes/api/v1/businessOwnerRouter");
    const appointmentRouter = require("../../routes/api/v1/appointmentsRouter");
    app.use("/api/v1/business-owner", businessOwnerRouter);
    app.use("/api/v1/appointments", appointmentRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /business-owner/appointments/:appointmentId/decline", () => {
    const businessOwnerId = 100;
    const clientId = 200;
    const appointmentId = 1;

    const mockBusinessOwner = {
      id: businessOwnerId,
      type: "cleaner",
      isBusinessOwner: true,
      accountFrozen: false,
      firstName: "Demo",
      lastName: "BusinessOwner",
      businessName: "Demo Cleaning Co",
    };

    const mockClient = {
      id: clientId,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      expoPushToken: "ExponentPushToken[xxx]",
      notifications: { push: true, email: true },
    };

    const createMockAppointment = (overrides = {}) => ({
      id: appointmentId,
      userId: clientId,
      bookedByCleanerId: businessOwnerId,
      date: getFutureDate(3),
      completed: false,
      wasCancelled: false,
      businessOwnerDeclined: false,
      user: mockClient,
      home: { id: 1, address: "123 Main St" },
      update: mockAppointmentUpdate,
      ...overrides,
    });

    it("should successfully decline an appointment with a reason", async () => {
      const token = jwt.sign({ userId: businessOwnerId }, secretKey);

      User.findByPk
        .mockResolvedValueOnce(mockBusinessOwner) // middleware
        .mockResolvedValueOnce(mockBusinessOwner); // getting business owner name
      UserAppointments.findOne.mockResolvedValue(createMockAppointment());

      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Staff unavailable for this date" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Client has been notified");

      // Verify appointment was updated
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessOwnerDeclined: true,
          businessOwnerDeclineReason: "Staff unavailable for this date",
        })
      );

      // Verify notification was sent
      expect(NotificationService.notifyBusinessOwnerDeclined).toHaveBeenCalled();
    });

    it("should successfully decline without a reason", async () => {
      const token = jwt.sign({ userId: businessOwnerId }, secretKey);

      User.findByPk
        .mockResolvedValueOnce(mockBusinessOwner)
        .mockResolvedValueOnce(mockBusinessOwner);
      UserAppointments.findOne.mockResolvedValue(createMockAppointment());

      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject if user is not a business owner", async () => {
      const token = jwt.sign({ userId: businessOwnerId }, secretKey);

      User.findByPk.mockResolvedValue({
        ...mockBusinessOwner,
        isBusinessOwner: false,
      });

      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Test" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Business owner access required");
    });

    it("should reject if appointment does not belong to business owner", async () => {
      const token = jwt.sign({ userId: businessOwnerId }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      UserAppointments.findOne.mockResolvedValue(null); // findOne returns null when bookedByCleanerId doesn't match

      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Test" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("should reject if appointment is already completed", async () => {
      const token = jwt.sign({ userId: businessOwnerId }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      UserAppointments.findOne.mockResolvedValue(
        createMockAppointment({ completed: true })
      );

      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Test" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("completed");
    });

    it("should reject if appointment is already cancelled", async () => {
      const token = jwt.sign({ userId: businessOwnerId }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      UserAppointments.findOne.mockResolvedValue(
        createMockAppointment({ wasCancelled: true })
      );

      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Test" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("cancelled");
    });

    it("should reject if appointment is already declined", async () => {
      const token = jwt.sign({ userId: businessOwnerId }, secretKey);

      User.findByPk.mockResolvedValue(mockBusinessOwner);
      UserAppointments.findOne.mockResolvedValue(
        createMockAppointment({ businessOwnerDeclined: true })
      );

      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Test" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("already been declined");
    });

    it("should reject without authorization token", async () => {
      const res = await request(app)
        .post(`/api/v1/business-owner/appointments/${appointmentId}/decline`)
        .send({ reason: "Test" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /appointments/:id/decline-response", () => {
    const clientId = 200;
    const businessOwnerId = 100;
    const appointmentId = 1;
    const homeId = 50;

    const mockClient = {
      id: clientId,
      firstName: "John",
      lastName: "Doe",
    };

    const mockBusinessOwner = {
      id: businessOwnerId,
      firstName: "Demo",
      lastName: "BusinessOwner",
    };

    const mockHome = {
      id: homeId,
      numBeds: 3,
      numBaths: 2,
      timeToBeCompleted: "3",
    };

    const incompleteHome = {
      id: homeId,
      numBeds: null,
      numBaths: null,
      timeToBeCompleted: null,
    };

    const createMockAppointment = (homeOverrides = {}, appointmentOverrides = {}) => ({
      id: appointmentId,
      userId: clientId,
      homeId: homeId,
      bookedByCleanerId: businessOwnerId,
      businessOwnerDeclined: true,
      date: getFutureDate(3),
      price: 150,
      wasCancelled: false,
      home: { ...mockHome, ...homeOverrides },
      bookedByCleaner: mockBusinessOwner,
      update: mockAppointmentUpdate,
      ...appointmentOverrides,
    });

    describe("action: cancel", () => {
      it("should successfully cancel the appointment", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk
          .mockResolvedValueOnce(mockClient)
          .mockResolvedValueOnce(mockBusinessOwner);
        UserAppointments.findOne.mockResolvedValue(createMockAppointment());

        const res = await request(app)
          .post(`/api/v1/appointments/${appointmentId}/decline-response`)
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "cancel" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.action).toBe("cancelled");

        // Verify appointment was updated
        expect(mockAppointmentUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            wasCancelled: true,
            cancellationMethod: "app",
          })
        );

        // Verify business owner was notified
        expect(NotificationService.notifyClientCancelledAfterDecline).toHaveBeenCalled();
      });
    });

    describe("action: marketplace", () => {
      it("should return needsHomeDetails if home is missing required fields", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue(mockClient);
        // Pass incomplete home in the appointment mock
        UserAppointments.findOne.mockResolvedValue(
          createMockAppointment(incompleteHome)
        );

        const res = await request(app)
          .post(`/api/v1/appointments/${appointmentId}/decline-response`)
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "marketplace" });

        expect(res.status).toBe(200);
        expect(res.body.needsHomeDetails).toBe(true);
        expect(res.body.missingFields).toContain("numBeds");
        expect(res.body.missingFields).toContain("numBaths");
        expect(res.body.missingFields).toContain("timeToBeCompleted");
        expect(res.body.homeId).toBe(homeId);
      });

      it("should return confirmRequired with marketplace price if home is complete", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue(mockClient);
        UserAppointments.findOne.mockResolvedValue(createMockAppointment());

        const res = await request(app)
          .post(`/api/v1/appointments/${appointmentId}/decline-response`)
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "marketplace" });

        expect(res.status).toBe(200);
        expect(res.body.confirmRequired).toBe(true);
        expect(res.body.marketplacePrice).toBeDefined();
        expect(res.body.currentPrice).toBe(150);
        expect(res.body.homeId).toBe(homeId);
      });

      it("should return 404 if appointment was not declined by business owner", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue(mockClient);
        // findOne returns null when businessOwnerDeclined is false (it's in the where clause)
        UserAppointments.findOne.mockResolvedValue(null);

        const res = await request(app)
          .post(`/api/v1/appointments/${appointmentId}/decline-response`)
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "marketplace" });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain("not found");
      });

      it("should reject invalid action", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue(mockClient);
        UserAppointments.findOne.mockResolvedValue(createMockAppointment());

        const res = await request(app)
          .post(`/api/v1/appointments/${appointmentId}/decline-response`)
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "invalid_action" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Invalid action");
      });
    });
  });

  describe("POST /appointments/:id/confirm-marketplace", () => {
    const clientId = 200;
    const businessOwnerId = 100;
    const appointmentId = 1;
    const homeId = 50;

    const mockClient = {
      id: clientId,
      firstName: "John",
      lastName: "Doe",
    };

    const mockBusinessOwner = {
      id: businessOwnerId,
      firstName: "Demo",
      lastName: "BusinessOwner",
    };

    const mockHome = {
      id: homeId,
      numBeds: 3,
      numBaths: 2,
      timeToBeCompleted: "3",
    };

    const incompleteHome = {
      id: homeId,
      numBeds: null,
      numBaths: null,
      timeToBeCompleted: null,
    };

    const createMockAppointment = (homeOverrides = {}, appointmentOverrides = {}) => ({
      id: appointmentId,
      userId: clientId,
      homeId: homeId,
      bookedByCleanerId: businessOwnerId,
      businessOwnerDeclined: true,
      date: getFutureDate(3),
      price: 150,
      wasCancelled: false,
      openToMarket: false,
      home: { ...mockHome, ...homeOverrides },
      update: mockAppointmentUpdate,
      ...appointmentOverrides,
    });

    it("should successfully open appointment to marketplace", async () => {
      const token = jwt.sign({ userId: clientId }, secretKey);

      User.findByPk
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(mockBusinessOwner);
      UserAppointments.findOne.mockResolvedValue(createMockAppointment());

      const res = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/confirm-marketplace`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.marketplacePrice).toBeDefined();

      // Verify appointment was updated for marketplace
      expect(mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          openToMarket: true,
          bookedByCleanerId: null,
          hasBeenAssigned: false,
        })
      );

      // Verify business owner was notified
      expect(NotificationService.notifyClientOpenedToMarketplace).toHaveBeenCalled();
    });

    it("should reject with 400 if home details are incomplete", async () => {
      const token = jwt.sign({ userId: clientId }, secretKey);

      User.findByPk.mockResolvedValue(mockClient);
      UserAppointments.findOne.mockResolvedValue(createMockAppointment(incompleteHome));

      const res = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/confirm-marketplace`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Home details incomplete");
    });

    it("should return 404 if appointment was not declined", async () => {
      const token = jwt.sign({ userId: clientId }, secretKey);

      User.findByPk.mockResolvedValue(mockClient);
      // findOne returns null because businessOwnerDeclined: true is in where clause
      UserAppointments.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/confirm-marketplace`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("should return 404 if appointment is already on marketplace", async () => {
      const token = jwt.sign({ userId: clientId }, secretKey);

      User.findByPk.mockResolvedValue(mockClient);
      // findOne returns null because openToMarket: false is in where clause
      UserAppointments.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/confirm-marketplace`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    it("should return 404 if user does not own the appointment", async () => {
      const token = jwt.sign({ userId: 999 }, secretKey); // Different user

      User.findByPk.mockResolvedValue({ id: 999, firstName: "Other" });
      // findOne returns null because userId doesn't match
      UserAppointments.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/confirm-marketplace`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
