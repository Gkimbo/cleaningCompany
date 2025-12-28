const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Stripe before requiring the router
const mockStripe = {
  paymentMethods: {
    list: jest.fn(),
    detach: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
    capture: jest.fn(),
    cancel: jest.fn(),
  },
  customers: {
    retrieve: jest.fn(),
  },
};

jest.mock("stripe", () => {
  return jest.fn(() => mockStripe);
});

// Mock models
const mockUser = {
  id: 1,
  stripeCustomerId: "cus_test123",
  hasPaymentMethod: true,
  update: jest.fn().mockResolvedValue(true),
};

const mockUserBill = {
  id: 1,
  userId: 1,
  cancellationFee: 0,
  appointmentDue: 0,
  totalDue: 0,
  update: jest.fn().mockResolvedValue(true),
};

const mockAppointment = {
  id: 1,
  userId: 1,
  homeId: 1,
  date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 5 days from now
  price: "150.00",
  paid: false,
  completed: false,
  hasBeenAssigned: false,
  employeesAssigned: [],
  paymentIntentId: "pi_test123",
  paymentStatus: "pending",
  update: jest.fn().mockResolvedValue(true),
  destroy: jest.fn().mockResolvedValue(true),
};

jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn().mockResolvedValue({
      id: 1,
      address: "123 Test St",
      city: "Test City",
      state: "TS",
    }),
  },
  UserPendingRequests: {
    destroy: jest.fn().mockResolvedValue(0),
  },
  Payment: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    generateTransactionId: jest.fn(() => `txn_test_${Date.now()}`),
  },
  Payout: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  PricingConfig: {
    findOne: jest.fn().mockResolvedValue({
      config: {
        cancellation: {
          fee: 25,
          windowDays: 7,
          homeownerPenaltyDays: 3,
          refundPercentage: 0.5,
        },
        platform: {
          feePercent: 0.20,
        },
      },
    }),
  },
}));

// Mock Push Notification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushCancellation: jest.fn().mockResolvedValue(true),
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
}));

const { User, UserAppointments, UserBills } = require("../../models");

describe("Payment Method Removal Protection", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";
  let validToken;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const paymentRouter = require("../../routes/api/v1/paymentRouter");
    app.use("/api/v1/payments", paymentRouter);

    validToken = jwt.sign({ userId: 1 }, secretKey);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setups
    User.findByPk.mockResolvedValue({ ...mockUser });
    UserBills.findOne.mockResolvedValue({ ...mockUserBill });
    UserAppointments.findAll.mockResolvedValue([]);

    mockStripe.paymentMethods.list.mockResolvedValue({
      data: [{ id: "pm_test123", type: "card" }],
    });
  });

  describe("GET /removal-eligibility/:paymentMethodId", () => {
    it("should return canRemove: true when user has multiple payment methods", async () => {
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [
          { id: "pm_test123", type: "card" },
          { id: "pm_test456", type: "card" },
        ],
      });

      const res = await request(app)
        .get("/api/v1/payments/removal-eligibility/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canRemove).toBe(true);
      expect(res.body.isLastPaymentMethod).toBe(false);
      expect(res.body.paymentMethodCount).toBe(2);
    });

    it("should return canRemove: true when last card but no appointments or fees", async () => {
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [{ id: "pm_test123", type: "card" }],
      });
      UserAppointments.findAll.mockResolvedValue([]);
      UserBills.findOne.mockResolvedValue({ ...mockUserBill, totalDue: 0 });

      const res = await request(app)
        .get("/api/v1/payments/removal-eligibility/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canRemove).toBe(true);
      expect(res.body.isLastPaymentMethod).toBe(true);
    });

    it("should return canRemove: false when last card with outstanding fees", async () => {
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [{ id: "pm_test123", type: "card" }],
      });
      UserBills.findOne.mockResolvedValue({
        ...mockUserBill,
        cancellationFee: 25,
        totalDue: 25,
      });

      const res = await request(app)
        .get("/api/v1/payments/removal-eligibility/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canRemove).toBe(false);
      expect(res.body.outstandingFees.totalDue).toBe(25);
      expect(res.body.options.mustPayOutstandingFirst).toBe(true);
    });

    it("should return canRemove: false when last card with unpaid appointments", async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      UserAppointments.findAll.mockResolvedValue([
        { ...mockAppointment, date: futureDate },
      ]);

      const res = await request(app)
        .get("/api/v1/payments/removal-eligibility/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canRemove).toBe(false);
      expect(res.body.unpaidAppointments.length).toBe(1);
      expect(res.body.options.canPrepayAll).toBe(true);
      expect(res.body.options.canCancelAll).toBe(true);
    });

    it("should include cancellation fees for appointments within 7 days", async () => {
      const within7Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      UserAppointments.findAll.mockResolvedValue([
        { ...mockAppointment, date: within7Days },
      ]);

      const res = await request(app)
        .get("/api/v1/payments/removal-eligibility/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.unpaidAppointments[0].isWithinCancellationWindow).toBe(true);
      expect(res.body.unpaidAppointments[0].cancellationFee).toBe(25);
      expect(res.body.totalCancellationFees).toBe(25);
    });

    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/payments/removal-eligibility/pm_test123");

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /payment-method/:paymentMethodId", () => {
    it("should allow removal when user has multiple payment methods", async () => {
      mockStripe.paymentMethods.list
        .mockResolvedValueOnce({
          data: [
            { id: "pm_test123", type: "card" },
            { id: "pm_test456", type: "card" },
          ],
        })
        .mockResolvedValueOnce({
          data: [{ id: "pm_test456", type: "card" }],
        });
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: "pm_test123" });

      const res = await request(app)
        .delete("/api/v1/payments/payment-method/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith("pm_test123");
    });

    it("should block removal when last card with outstanding fees", async () => {
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [{ id: "pm_test123", type: "card" }],
      });
      UserBills.findOne.mockResolvedValue({
        ...mockUserBill,
        cancellationFee: 25,
        totalDue: 25,
      });

      const res = await request(app)
        .delete("/api/v1/payments/payment-method/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("OUTSTANDING_FEES");
      expect(mockStripe.paymentMethods.detach).not.toHaveBeenCalled();
    });

    it("should block removal when last card with unpaid appointments", async () => {
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [{ id: "pm_test123", type: "card" }],
      });
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      UserAppointments.findAll.mockResolvedValue([
        { ...mockAppointment, date: futureDate },
      ]);

      const res = await request(app)
        .delete("/api/v1/payments/payment-method/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("UNPAID_APPOINTMENTS");
      expect(mockStripe.paymentMethods.detach).not.toHaveBeenCalled();
    });

    it("should allow removal when last card but no obligations", async () => {
      mockStripe.paymentMethods.list
        .mockResolvedValueOnce({
          data: [{ id: "pm_test123", type: "card" }],
        })
        .mockResolvedValueOnce({
          data: [],
        });
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: "pm_test123" });
      UserAppointments.findAll.mockResolvedValue([]);
      UserBills.findOne.mockResolvedValue({ ...mockUserBill, totalDue: 0 });

      const res = await request(app)
        .delete("/api/v1/payments/payment-method/pm_test123")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.hasPaymentMethod).toBe(false);
    });
  });

  describe("POST /prepay-all-and-remove", () => {
    it("should prepay all appointments and remove payment method", async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const appointmentWithUpdate = {
        ...mockAppointment,
        date: futureDate,
        update: jest.fn().mockResolvedValue(true),
      };
      UserAppointments.findAll.mockResolvedValue([appointmentWithUpdate]);

      mockStripe.paymentIntents.capture.mockResolvedValue({
        id: "pi_test123",
        status: "succeeded",
        amount_received: 15000,
      });
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: "pm_test123" });
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] });

      const res = await request(app)
        .post("/api/v1/payments/prepay-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ paymentMethodId: "pm_test123" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.capturedAppointments.length).toBe(1);
      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith("pi_test123");
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith("pm_test123");
    });

    it("should pay outstanding fees before prepaying appointments", async () => {
      UserBills.findOne.mockResolvedValue({
        ...mockUserBill,
        cancellationFee: 25,
        totalDue: 25,
        update: jest.fn().mockResolvedValue(true),
      });
      UserAppointments.findAll.mockResolvedValue([]);

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_fee_123",
        status: "succeeded",
      });
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: "pm_test123" });
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] });

      const res = await request(app)
        .post("/api/v1/payments/prepay-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ paymentMethodId: "pm_test123" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.outstandingFeesPaid).toBe(25);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2500, // 25 * 100 cents
          description: "Outstanding fees payment before card removal",
        })
      );
    });

    it("should return 400 when payment method ID is missing", async () => {
      const res = await request(app)
        .post("/api/v1/payments/prepay-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Payment method ID required");
    });

    it("should not remove card if prepayment fails", async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      UserAppointments.findAll.mockResolvedValue([
        { ...mockAppointment, date: futureDate },
      ]);

      mockStripe.paymentIntents.capture.mockRejectedValue(new Error("Card declined"));

      const res = await request(app)
        .post("/api/v1/payments/prepay-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ paymentMethodId: "pm_test123" });

      expect(res.status).toBe(400);
      expect(res.body.failedAppointments.length).toBe(1);
      expect(mockStripe.paymentMethods.detach).not.toHaveBeenCalled();
    });
  });

  describe("POST /cancel-all-and-remove", () => {
    it("should cancel all appointments and remove payment method", async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const appointmentWithDestroy = {
        ...mockAppointment,
        date: futureDate,
        destroy: jest.fn().mockResolvedValue(true),
      };
      UserAppointments.findAll.mockResolvedValue([appointmentWithDestroy]);

      mockStripe.paymentIntents.cancel.mockResolvedValue({ id: "pi_test123", status: "canceled" });
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: "pm_test123" });
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] });

      const res = await request(app)
        .post("/api/v1/payments/cancel-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          paymentMethodId: "pm_test123",
          acknowledgedCancellationFees: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelledAppointments.length).toBe(1);
      expect(appointmentWithDestroy.destroy).toHaveBeenCalled();
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith("pm_test123");
    });

    it("should charge cancellation fees for appointments within 7 days", async () => {
      const within7Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const appointmentWithDestroy = {
        ...mockAppointment,
        date: within7Days,
        destroy: jest.fn().mockResolvedValue(true),
      };
      UserAppointments.findAll.mockResolvedValue([appointmentWithDestroy]);
      UserBills.findOne.mockResolvedValue({
        ...mockUserBill,
        update: jest.fn().mockResolvedValue(true),
      });

      mockStripe.paymentIntents.cancel.mockResolvedValue({ id: "pi_test123", status: "canceled" });
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_fee_123",
        status: "succeeded",
      });
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: "pm_test123" });
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] });

      const res = await request(app)
        .post("/api/v1/payments/cancel-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          paymentMethodId: "pm_test123",
          acknowledgedCancellationFees: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalCancellationFees).toBe(25);
      expect(res.body.cancelledAppointments[0].wasWithinWindow).toBe(true);
    });

    it("should not charge cancellation fees for appointments outside 7 days", async () => {
      const outside7Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const appointmentWithDestroy = {
        ...mockAppointment,
        date: outside7Days,
        destroy: jest.fn().mockResolvedValue(true),
      };
      UserAppointments.findAll.mockResolvedValue([appointmentWithDestroy]);

      mockStripe.paymentIntents.cancel.mockResolvedValue({ id: "pi_test123", status: "canceled" });
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: "pm_test123" });
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] });

      const res = await request(app)
        .post("/api/v1/payments/cancel-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          paymentMethodId: "pm_test123",
          acknowledgedCancellationFees: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.totalCancellationFees).toBe(0);
      expect(res.body.cancelledAppointments[0].wasWithinWindow).toBe(false);
    });

    it("should return 400 without acknowledgement of fees", async () => {
      const res = await request(app)
        .post("/api/v1/payments/cancel-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          paymentMethodId: "pm_test123",
          // Missing acknowledgedCancellationFees
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Must acknowledge cancellation fees");
    });

    it("should return 400 when payment method ID is missing", async () => {
      const res = await request(app)
        .post("/api/v1/payments/cancel-all-and-remove")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          acknowledgedCancellationFees: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Payment method ID required");
    });
  });

  describe("Authorization", () => {
    it("should return 401 for removal-eligibility without token", async () => {
      const res = await request(app)
        .get("/api/v1/payments/removal-eligibility/pm_test123");

      expect(res.status).toBe(401);
    });

    it("should return 401 for prepay-all-and-remove without token", async () => {
      const res = await request(app)
        .post("/api/v1/payments/prepay-all-and-remove")
        .send({ paymentMethodId: "pm_test123" });

      expect(res.status).toBe(401);
    });

    it("should return 401 for cancel-all-and-remove without token", async () => {
      const res = await request(app)
        .post("/api/v1/payments/cancel-all-and-remove")
        .send({
          paymentMethodId: "pm_test123",
          acknowledgedCancellationFees: true,
        });

      expect(res.status).toBe(401);
    });
  });
});
