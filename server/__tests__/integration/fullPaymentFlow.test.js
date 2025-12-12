/**
 * Full Payment Flow Integration Tests
 *
 * Tests the complete payment workflow from booking to completion.
 */

const request = require("supertest");
const express = require("express");

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockImplementation((params) => ({
        id: `pi_test_${Date.now()}`,
        client_secret: `pi_test_${Date.now()}_secret`,
        amount: params.amount,
        currency: params.currency,
        status: params.capture_method === "manual" ? "requires_capture" : "requires_payment_method",
        capture_method: params.capture_method || "automatic",
        metadata: params.metadata || {},
      })),
      capture: jest.fn().mockImplementation((id) => ({
        id,
        status: "succeeded",
        amount_received: 15000,
      })),
      cancel: jest.fn().mockImplementation((id) => ({
        id,
        status: "canceled",
      })),
      retrieve: jest.fn().mockImplementation((id) => ({
        id,
        status: "requires_capture",
        amount: 15000,
      })),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({
        id: "re_test_123",
        status: "succeeded",
        amount: 15000,
      }),
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test_123", amount: 15000 } },
      }),
    },
  }));
});

// Mock models
const mockAppointment = {
  id: 1,
  userId: 1,
  homeId: 1,
  date: "2025-02-01",
  price: "150",
  paid: false,
  completed: false,
  hasBeenAssigned: false,
  paymentIntentId: null,
  paymentStatus: "pending",
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
};

jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn().mockResolvedValue({ id: 1, email: "test@example.com" }),
    findOne: jest.fn().mockResolvedValue({ id: 1, email: "test@example.com" }),
  },
  UserAppointments: {
    findByPk: jest.fn().mockResolvedValue(mockAppointment),
    findOne: jest.fn().mockResolvedValue(mockAppointment),
    findAll: jest.fn().mockResolvedValue([mockAppointment]),
    create: jest.fn().mockResolvedValue(mockAppointment),
  },
  UserHomes: {
    findByPk: jest.fn().mockResolvedValue({
      id: 1,
      nickName: "Test Home",
      address: "123 Test St",
    }),
  },
  UserBills: {},
  Payment: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    generateTransactionId: jest.fn(() => `txn_test_${Date.now()}`),
    findAll: jest.fn().mockResolvedValue([]),
  },
  Payout: {
    findByPk: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
  },
}));

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

describe("Full Payment Flow", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const paymentRouter = require("../../routes/api/v1/paymentRouter");
    app.use("/api/v1/payments", paymentRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock appointment state
    mockAppointment.paid = false;
    mockAppointment.completed = false;
    mockAppointment.hasBeenAssigned = false;
    mockAppointment.paymentIntentId = null;
    mockAppointment.paymentStatus = "pending";
  });

  describe("Complete Payment Workflow", () => {
    it("Step 1: Customer creates payment intent", async () => {
      const res = await request(app)
        .post("/api/v1/payments/create-intent")
        .send({
          amount: 15000,
          email: "customer@example.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.clientSecret).toBeDefined();
      expect(res.body.clientSecret).toMatch(/^pi_test_/);
    });

    it("Step 2: Get Stripe config for frontend", async () => {
      const res = await request(app).get("/api/v1/payments/config");

      expect(res.status).toBe(200);
      expect(res.body.publishableKey).toBeDefined();
    });

    it("Step 3: Cleaner gets assigned and marks job complete", async () => {
      // Setup: appointment has payment and cleaner assigned
      mockAppointment.paymentIntentId = "pi_test_123";
      mockAppointment.hasBeenAssigned = true;

      const { UserAppointments } = require("../../models");
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const res = await request(app)
        .post("/api/v1/payments/capture")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Step 4: Customer can view payment history", async () => {
      const res = await request(app).get("/api/v1/payments/history/1");

      expect(res.status).toBe(200);
      expect(res.body.payments).toBeDefined();
      expect(Array.isArray(res.body.payments)).toBe(true);
    });

    it("Step 5: Employee can view earnings", async () => {
      const res = await request(app).get("/api/v1/payments/earnings/2");

      expect(res.status).toBe(200);
      expect(res.body.totalEarnings).toBeDefined();
      expect(res.body.pendingEarnings).toBeDefined();
      expect(res.body.completedJobs).toBeDefined();
    });
  });

  describe("Cancellation Flow", () => {
    it("should cancel uncaptured payment", async () => {
      mockAppointment.paymentIntentId = "pi_test_cancel";

      const stripe = require("stripe")();
      stripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_cancel",
        status: "requires_capture",
      });

      const res = await request(app)
        .post("/api/v1/payments/cancel-or-refund")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Refund Flow", () => {
    it("should refund captured payment", async () => {
      mockAppointment.paymentIntentId = "pi_test_refund";

      const stripe = require("stripe")();
      stripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_refund",
        status: "succeeded",
      });

      const res = await request(app)
        .post("/api/v1/payments/refund")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing appointment", async () => {
      const { UserAppointments } = require("../../models");
      UserAppointments.findByPk.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/payments/capture")
        .send({ appointmentId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Appointment not found");
    });

    it("should handle capture without cleaner", async () => {
      mockAppointment.hasBeenAssigned = false;
      mockAppointment.paymentIntentId = "pi_test_123";

      const res = await request(app)
        .post("/api/v1/payments/capture")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot charge without a cleaner assigned");
    });

    it("should handle missing payment intent", async () => {
      mockAppointment.paymentIntentId = null;

      const res = await request(app)
        .post("/api/v1/payments/refund")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("No payment intent found for this appointment");
    });
  });

  describe("Webhook Processing", () => {
    it("should handle payment_intent.succeeded webhook", async () => {
      const { UserAppointments } = require("../../models");
      UserAppointments.findOne.mockResolvedValue(mockAppointment);

      const res = await request(app)
        .post("/api/v1/payments/webhook")
        .set("stripe-signature", "test_sig")
        .send(
          JSON.stringify({
            type: "payment_intent.succeeded",
            data: { object: { id: "pi_test_123", amount: 15000 } },
          })
        );

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });

  describe("Multi-step Booking Flow", () => {
    it("should handle complete booking with payment", async () => {
      // 1. Create payment intent with manual capture
      const createRes = await request(app)
        .post("/api/v1/payments/create-intent")
        .send({
          amount: 20000,
          email: "booker@example.com",
        });

      expect(createRes.status).toBe(200);
      const { clientSecret } = createRes.body;

      // 2. Simulate payment confirmation (would happen on frontend)
      // In real app, Stripe.js confirms the payment

      // 3. Admin assigns cleaner
      mockAppointment.hasBeenAssigned = true;
      mockAppointment.paymentIntentId = clientSecret.split("_secret")[0];

      // 4. Cleaner completes job and triggers capture
      const captureRes = await request(app)
        .post("/api/v1/payments/capture")
        .send({ appointmentId: 1 });

      expect(captureRes.status).toBe(200);
      expect(captureRes.body.success).toBe(true);

      // 5. Check earnings updated
      const earningsRes = await request(app).get("/api/v1/payments/earnings/2");

      expect(earningsRes.status).toBe(200);
    });
  });
});

describe("Payment Amount Calculations", () => {
  it("should convert dollars to cents correctly", () => {
    const dollarAmount = 150.5;
    const centsAmount = Math.round(dollarAmount * 100);

    expect(centsAmount).toBe(15050);
  });

  it("should handle decimal precision", () => {
    const amounts = [
      { dollars: 99.99, cents: 9999 },
      { dollars: 0.01, cents: 1 },
      { dollars: 1000.0, cents: 100000 },
    ];

    amounts.forEach(({ dollars, cents }) => {
      expect(Math.round(dollars * 100)).toBe(cents);
    });
  });

  it("should calculate split earnings correctly", () => {
    const jobPrice = 300;
    const numCleaners = 3;
    const perCleanerEarning = jobPrice / numCleaners;

    expect(perCleanerEarning).toBe(100);
  });
});

afterAll(async () => {
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.useRealTimers();
});
