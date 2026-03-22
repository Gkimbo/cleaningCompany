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
      cancel: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "canceled",
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "requires_capture",
      }),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({
        id: "re_test_123",
        status: "succeeded",
      }),
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_123",
            amount: 15000,
          },
        },
      }),
    },
  }));
});

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn().mockImplementation((id) => {
      if (id === 1) return Promise.resolve({ id: 1, email: "owner@example.com", type: "owner" });
      return Promise.resolve(null);
    }),
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
  Payment: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    generateTransactionId: jest.fn(() => `txn_test_${Date.now()}`),
    findAll: jest.fn().mockResolvedValue([]),
  },
  Payout: {
    findByPk: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([1]),
  },
  UserPendingRequests: {
    destroy: jest.fn().mockResolvedValue(0),
  },
  StripeWebhookEvent: {
    claimEvent: jest.fn().mockResolvedValue({ id: 1, stripeEventId: "evt_test_123", status: "processing" }),
    markCompleted: jest.fn().mockResolvedValue(true),
    markFailed: jest.fn().mockResolvedValue(true),
    markSkipped: jest.fn().mockResolvedValue(true),
  },
  sequelize: {
    transaction: jest.fn().mockImplementation(() => Promise.resolve({
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      finished: false,
    })),
  },
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
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

const { UserAppointments, User, UserHomes } = require("../../models");

describe("Payment Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

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

  describe("GET /config", () => {
    it("should return the Stripe publishable key", async () => {
      const res = await request(app).get("/api/v1/payments/config");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("publishableKey");
    });
  });

  describe("POST /create-intent", () => {
    it("should require authentication", async () => {
      const res = await request(app)
        .post("/api/v1/payments/create-intent")
        .send({
          amount: 15000,
          email: "test@example.com",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization required");
    });

    it("should create a payment intent with valid data and auth", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      User.findByPk.mockResolvedValueOnce({ id: 1, email: "owner@example.com", type: "owner" });

      const res = await request(app)
        .post("/api/v1/payments/create-intent")
        .set("Authorization", `Bearer ${token}`)
        .send({
          amount: 15000,
          email: "test@example.com",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("clientSecret");
    });

    it("should return 400 for invalid amount", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      User.findByPk.mockResolvedValueOnce({ id: 1, email: "owner@example.com", type: "owner" });

      const res = await request(app)
        .post("/api/v1/payments/create-intent")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "test@example.com",
          // Missing amount
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Amount must be a valid integer in cents");
    });

    it("should return 400 for negative amount", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      User.findByPk.mockResolvedValueOnce({ id: 1, email: "owner@example.com", type: "owner" });

      const res = await request(app)
        .post("/api/v1/payments/create-intent")
        .set("Authorization", `Bearer ${token}`)
        .send({
          amount: -100,
          email: "test@example.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Amount must be between $1.00 and $10,000.00");
    });
  });

  describe("POST /create-payment-intent", () => {
    it("should create a payment intent with JWT token", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // Mock home with all necessary properties for appointment creation
      UserHomes.findByPk.mockResolvedValue({
        id: 1,
        towelsProvided: true,
        sheetsProvided: false,
        keyPadCode: "1234",
        keyLocation: "Under mat",
        cleanersNeeded: 2,
      });
      UserAppointments.create.mockResolvedValue({
        id: 1,
        userId: 1,
        homeId: 1,
      });

      const res = await request(app)
        .post("/api/v1/payments/create-payment-intent")
        .send({
          token,
          homeId: 1,
          amount: 15000,
          appointmentDate: "2025-01-15",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("clientSecret");
      expect(res.body).toHaveProperty("appointmentId");

      // Verify appointment is created with correct field names and price in cents
      expect(UserAppointments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          homeId: 1,
          date: "2025-01-15",
          price: 15000, // Price should stay in cents, NOT be divided by 100
          paid: false,
          bringTowels: "no", // towelsProvided=true means we don't need to bring
          bringSheets: "yes", // sheetsProvided=false means we need to bring
          completed: false,
          hasBeenAssigned: false,
          employeesNeeded: 2,
          timeToBeCompleted: "anytime",
        })
      );
    });

    it("should return 404 if home not found", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      UserHomes.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/payments/create-payment-intent")
        .send({
          token,
          homeId: 999,
          amount: 15000,
          appointmentDate: "2025-01-15",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Home not found");
    });
  });

  describe("POST /capture and /capture-payment", () => {
    it("should capture payment for a valid appointment", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        hasBeenAssigned: true,
        employeesAssigned: ["1"],
        paymentIntentId: "pi_test_123",
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post("/api/v1/payments/capture")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 404 if appointment not found", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/payments/capture")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Appointment not found");
    });

    it("should return 400 if no cleaner assigned", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        hasBeenAssigned: false,
        employeesAssigned: ["1"],
        paymentIntentId: "pi_test_123",
      });

      const res = await request(app)
        .post("/api/v1/payments/capture")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot charge without a cleaner assigned");
    });
  });

  describe("POST /refund and /cancel-or-refund", () => {
    it("should require authentication", async () => {
      const res = await request(app)
        .post("/api/v1/payments/refund")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization required");
    });

    it("should reject non-owner users", async () => {
      const cleanerToken = jwt.sign({ userId: 2 }, secretKey);
      User.findByPk.mockResolvedValueOnce({ id: 2, type: "cleaner" });

      const res = await request(app)
        .post("/api/v1/payments/refund")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ appointmentId: 1 });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owners can cancel or refund payments");
    });

    it("should cancel an uncaptured payment", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);
      const stripe = require("stripe")();
      stripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_123",
        status: "requires_capture",
      });

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        paymentIntentId: "pi_test_123",
        paymentStatus: "requires_capture",
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post("/api/v1/payments/refund")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should refund a captured payment", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);
      const stripe = require("stripe")();
      stripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_123",
        status: "succeeded",
      });

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        paymentIntentId: "pi_test_123",
        paymentStatus: "captured",
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post("/api/v1/payments/refund")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 400 if no payment intent found", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        paymentIntentId: null,
        paymentStatus: null,
      });

      const res = await request(app)
        .post("/api/v1/payments/refund")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("No payment intent found for this appointment");
    });

    it("should return 400 if appointment ID is missing", async () => {
      const ownerToken = jwt.sign({ userId: 1 }, secretKey);
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const res = await request(app)
        .post("/api/v1/payments/refund")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Appointment ID is required");
    });
  });

  describe("GET /history/:userId", () => {
    it("should return payment history for a user", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      UserAppointments.findAll.mockResolvedValue([
        {
          id: 1,
          date: "2025-01-15",
          price: "150",
          paid: true,
          paymentStatus: "succeeded",
          amountPaid: 15000,
          paymentIntentId: "pi_test_123",
          createdAt: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/api/v1/payments/history/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("payments");
      expect(Array.isArray(res.body.payments)).toBe(true);
    });

    it("should reject invalid user ID", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .get("/api/v1/payments/history/invalid")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid user ID");
    });

    it("should reject negative user ID", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .get("/api/v1/payments/history/-1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid user ID");
    });
  });

  describe("GET /earnings/:employeeId", () => {
    it("should return earnings for an employee", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      UserAppointments.findAll.mockResolvedValue([
        {
          id: 1,
          price: "150",
          paid: true,
          completed: true,
          employeesAssigned: ["1"],
        },
      ]);

      const res = await request(app)
        .get("/api/v1/payments/earnings/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalEarnings");
      expect(res.body).toHaveProperty("pendingEarnings");
      expect(res.body).toHaveProperty("completedJobs");
    });

    it("should reject invalid employee ID", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .get("/api/v1/payments/earnings/abc")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid employee ID");
    });

    it("should reject zero employee ID", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .get("/api/v1/payments/earnings/0")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid employee ID");
    });
  });

  describe("GET /:homeId (appointments)", () => {
    it("should return appointments for a home", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      UserHomes.findByPk.mockResolvedValue({ id: 1, userId: 1 });
      UserAppointments.findAll.mockResolvedValue([
        { id: 1, date: "2025-01-15", price: "150" },
      ]);

      const res = await request(app)
        .get("/api/v1/payments/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("appointments");
    });

    it("should reject invalid home ID", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .get("/api/v1/payments/notanumber")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid home ID");
    });

    it("should reject negative home ID", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .get("/api/v1/payments/-5")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid home ID");
    });
  });

  describe("Payment History Serialization", () => {
    let ownerToken;

    beforeAll(() => {
      ownerToken = jwt.sign({ userId: 1 }, process.env.SESSION_SECRET || "test-secret");
    });

    it("should return plain objects without Sequelize metadata for payment history", async () => {
      // When using raw: true, Sequelize returns plain objects without any Sequelize metadata
      // This mock simulates what raw: true actually returns
      const mockRawResults = [
        {
          id: 1,
          date: "2025-01-15",
          price: "150",
          paid: true,
          paymentStatus: "succeeded",
          amountPaid: 15000,
          paymentIntentId: "pi_test_123",
          createdAt: new Date("2025-01-15T10:00:00Z"),
        },
      ];
      UserAppointments.findAll.mockResolvedValue(mockRawResults);

      const res = await request(app)
        .get("/api/v1/payments/history/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payments).toHaveLength(1);
      // Should have the actual data
      expect(res.body.payments[0].id).toBe(1);
      expect(res.body.payments[0].date).toBe("2025-01-15");
      expect(res.body.payments[0].paid).toBe(true);
      expect(res.body.payments[0].paymentStatus).toBe("succeeded");
      expect(res.body.payments[0].amountPaid).toBe(15000);
      expect(res.body.payments[0].paymentIntentId).toBe("pi_test_123");
      // With raw: true, these Sequelize internals are never included
      expect(res.body.payments[0]._previousDataValues).toBeUndefined();
      expect(res.body.payments[0]._changed).toBeUndefined();
      expect(res.body.payments[0].dataValues).toBeUndefined();
      expect(res.body.payments[0].save).toBeUndefined();
    });

    it("should verify findAll is called with raw: true option", async () => {
      const mockResults = [
        {
          id: 1,
          date: "2025-01-15",
          price: "150",
          paid: true,
          paymentStatus: "succeeded",
          amountPaid: 15000,
          paymentIntentId: "pi_test_123",
          createdAt: new Date(),
        },
      ];
      UserAppointments.findAll.mockResolvedValue(mockResults);

      await request(app)
        .get("/api/v1/payments/history/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      // Verify raw: true was passed in the query options
      expect(UserAppointments.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          raw: true,
        })
      );
    });

    it("should handle multiple payment records with proper serialization", async () => {
      const mockAppointments = [
        {
          id: 1,
          date: "2025-01-15",
          price: "150",
          paid: true,
          paymentStatus: "succeeded",
          amountPaid: 15000,
          paymentIntentId: "pi_test_1",
          createdAt: new Date("2025-01-15T10:00:00Z"),
        },
        {
          id: 2,
          date: "2025-01-20",
          price: "200",
          paid: true,
          paymentStatus: "succeeded",
          amountPaid: 20000,
          paymentIntentId: "pi_test_2",
          createdAt: new Date("2025-01-20T10:00:00Z"),
        },
        {
          id: 3,
          date: "2025-01-25",
          price: "175",
          paid: false,
          paymentStatus: "pending",
          amountPaid: 0,
          paymentIntentId: null,
          createdAt: new Date("2025-01-25T10:00:00Z"),
        },
      ];
      UserAppointments.findAll.mockResolvedValue(mockAppointments);

      const res = await request(app)
        .get("/api/v1/payments/history/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payments).toHaveLength(3);
      expect(res.body.payments[0].id).toBe(1);
      expect(res.body.payments[1].id).toBe(2);
      expect(res.body.payments[2].id).toBe(3);
      expect(res.body.payments[2].paid).toBe(false);
    });

    it("should return only specified attributes from raw query", async () => {
      // When using raw: true, only the attributes specified in the query should be returned
      const mockAppointments = [
        {
          id: 1,
          date: "2025-01-15",
          price: "150",
          paid: true,
          paymentStatus: "succeeded",
          amountPaid: 15000,
          paymentIntentId: "pi_test_123",
          createdAt: new Date("2025-01-15T10:00:00Z"),
        },
      ];
      UserAppointments.findAll.mockResolvedValue(mockAppointments);

      const res = await request(app)
        .get("/api/v1/payments/history/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const payment = res.body.payments[0];
      // These should be present (specified in query attributes)
      expect(payment).toHaveProperty("id");
      expect(payment).toHaveProperty("date");
      expect(payment).toHaveProperty("price");
      expect(payment).toHaveProperty("paid");
      expect(payment).toHaveProperty("paymentStatus");
      expect(payment).toHaveProperty("amountPaid");
      expect(payment).toHaveProperty("paymentIntentId");
      expect(payment).toHaveProperty("createdAt");
    });

    it("should handle empty payment history", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/payments/history/999")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payments).toEqual([]);
    });

    it("should handle database error gracefully", async () => {
      UserAppointments.findAll.mockRejectedValue(new Error("Database connection failed"));

      const res = await request(app)
        .get("/api/v1/payments/history/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });
});

afterAll(async () => {
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.useRealTimers();
});
