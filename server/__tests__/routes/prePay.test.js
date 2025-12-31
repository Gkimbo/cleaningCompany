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
        amount: 15000,
        amount_received: 15000,
        latest_charge: "ch_test_123",
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

const { UserAppointments, Payout, UserPendingRequests } = require("../../models");

describe("Pre-Pay and Retry Payment Routes", () => {
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

  describe("POST /pre-pay", () => {
    describe("Authentication", () => {
      it("should return 401 if no authorization header", async () => {
        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .send({ appointmentId: 1 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Authorization required");
      });

      it("should return 401 if authorization header is invalid format", async () => {
        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", "InvalidFormat token123")
          .send({ appointmentId: 1 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Authorization required");
      });

      it("should return 401 if token is invalid", async () => {
        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", "Bearer invalid_token")
          .send({ appointmentId: 1 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid token");
      });
    });

    describe("Appointment Validation", () => {
      it("should return 404 if appointment not found", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 999 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Appointment not found");
      });

      it("should return 403 if user does not own appointment", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 2, // Different user
          paid: false,
          hasBeenAssigned: true,
          paymentIntentId: "pi_test_123",
        });

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Not authorized");
      });

      it("should return 400 if appointment already paid", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: true,
          hasBeenAssigned: true,
          paymentIntentId: "pi_test_123",
        });

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Appointment already paid");
      });

      it("should return 400 if no cleaner assigned", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          hasBeenAssigned: false,
          paymentIntentId: "pi_test_123",
        });

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Cannot pre-pay until a cleaner is assigned");
      });

      it("should return 400 if no payment intent on file", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          hasBeenAssigned: true,
          paymentIntentId: null,
        });

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No payment method on file. Please add a payment method first.");
      });
    });

    describe("Successful Pre-Pay", () => {
      it("should successfully capture payment and set manuallyPaid to true", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        const mockUpdate = jest.fn().mockResolvedValue(true);

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          hasBeenAssigned: true,
          paymentIntentId: "pi_test_123",
          update: mockUpdate,
        });

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Payment successful! Your appointment is confirmed.");
        expect(res.body.paymentIntent).toHaveProperty("id");
        expect(res.body.paymentIntent).toHaveProperty("amount");
        expect(res.body.paymentIntent).toHaveProperty("status");

        // Verify manuallyPaid was set to true
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentStatus: "captured",
            paid: true,
            manuallyPaid: true,
            paymentCaptureFailed: false,
          })
        );
      });

      it("should update Payout records to held status", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          hasBeenAssigned: true,
          paymentIntentId: "pi_test_123",
          update: jest.fn().mockResolvedValue(true),
        });

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(200);
        expect(Payout.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: "held" }),
          expect.objectContaining({ where: { appointmentId: 1, status: "pending" } })
        );
      });

      it("should clean up pending requests after pre-pay", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          hasBeenAssigned: true,
          paymentIntentId: "pi_test_123",
          update: jest.fn().mockResolvedValue(true),
        });

        const res = await request(app)
          .post("/api/v1/payments/pre-pay")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(200);
        expect(UserPendingRequests.destroy).toHaveBeenCalledWith({
          where: { appointmentId: 1 },
        });
      });
    });

  });

  describe("POST /retry-payment", () => {
    describe("Authentication", () => {
      it("should return 401 if no authorization header", async () => {
        const res = await request(app)
          .post("/api/v1/payments/retry-payment")
          .send({ appointmentId: 1 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Authorization required");
      });

      it("should return 401 if authorization header is malformed", async () => {
        const res = await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", "Token abc123")
          .send({ appointmentId: 1 });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Authorization required");
      });
    });

    describe("Appointment Validation", () => {
      it("should return 404 if appointment not found", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 999 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Appointment not found");
      });

      it("should return 403 if user does not own appointment", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 2, // Different user
          paid: false,
          paymentIntentId: "pi_test_123",
        });

        const res = await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Not authorized to retry payment for this appointment");
      });

      it("should return success with alreadyPaid flag if payment completed", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: true,
          paymentStatus: "captured",
          paymentIntentId: "pi_test_123",
        });

        const res = await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.alreadyPaid).toBe(true);
        expect(res.body.message).toBe("Payment already completed");
      });

      it("should return 400 if no payment intent found", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          paymentIntentId: null,
        });

        const res = await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No payment intent found for this appointment");
      });
    });

    describe("Successful Retry", () => {
      it("should successfully retry payment capture", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        const mockUpdate = jest.fn().mockResolvedValue(true);

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          paymentStatus: "failed",
          paymentCaptureFailed: true,
          paymentIntentId: "pi_test_123",
          update: mockUpdate,
        });

        const res = await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Payment successful! Your appointment is confirmed.");
        expect(res.body.paymentIntent).toBeDefined();
      });

      it("should update appointment with correct status after retry", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);
        const mockUpdate = jest.fn().mockResolvedValue(true);

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          paymentStatus: "failed",
          paymentCaptureFailed: true,
          paymentIntentId: "pi_test_123",
          update: mockUpdate,
        });

        await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentStatus: "captured",
            paid: true,
            paymentCaptureFailed: false,
          })
        );
      });

      it("should update Payout status to held after successful retry", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          paid: false,
          paymentIntentId: "pi_test_123",
          update: jest.fn().mockResolvedValue(true),
        });

        await request(app)
          .post("/api/v1/payments/retry-payment")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 1 });

        expect(Payout.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: "held" }),
          expect.objectContaining({ where: { appointmentId: 1 } })
        );
      });
    });
  });

  describe("ManuallyPaid vs Auto-Captured Distinction", () => {
    it("should set manuallyPaid true for pre-pay", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      const mockUpdate = jest.fn().mockResolvedValue(true);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        paid: false,
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        update: mockUpdate,
      });

      await request(app)
        .post("/api/v1/payments/pre-pay")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 1 });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ manuallyPaid: true })
      );
    });

    it("should NOT set manuallyPaid for retry-payment", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      const mockUpdate = jest.fn().mockResolvedValue(true);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        paid: false,
        paymentIntentId: "pi_test_123",
        update: mockUpdate,
      });

      await request(app)
        .post("/api/v1/payments/retry-payment")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 1 });

      // Retry does not set manuallyPaid (it's for failed captures, not pre-pay)
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ manuallyPaid: true })
      );
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
