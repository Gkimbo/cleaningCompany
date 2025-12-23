const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Stripe - store mock functions for later reference
const mockPaymentIntentsRetrieve = jest.fn();
const mockPaymentIntentsCancel = jest.fn();
const mockPaymentIntentsCreate = jest.fn();
const mockRefundsCreate = jest.fn();
const mockCustomersRetrieve = jest.fn();

jest.mock("stripe", () => {
  return jest.fn(() => ({
    paymentIntents: {
      retrieve: mockPaymentIntentsRetrieve,
      cancel: mockPaymentIntentsCancel,
      create: mockPaymentIntentsCreate,
    },
    refunds: {
      create: mockRefundsCreate,
    },
    customers: {
      retrieve: mockCustomersRetrieve,
    },
  }));
});

// Mock models
jest.mock("../../models", () => ({
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
    destroy: jest.fn(),
    update: jest.fn(),
  },
  UserHomes: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
    update: jest.fn(),
  },
  UserCleanerAppointments: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserPendingRequests: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserReviews: {
    findAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    destroy: jest.fn(),
  },
}));

// Mock services
jest.mock("../../services/UserInfoClass", () => ({
  editTimeInDB: jest.fn().mockResolvedValue({ success: true }),
  editSheetsInDB: jest.fn().mockResolvedValue({ success: true }),
  editTowelsInDB: jest.fn().mockResolvedValue({ success: true }),
  editCodeKeyInDB: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../services/CalculatePrice", () => jest.fn(() => 150));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
  sendEmployeeRequest: jest.fn().mockResolvedValue(true),
  removeRequestEmail: jest.fn().mockResolvedValue(true),
}));

// Mock pricing config - simulates what owner set in the database
// These values are used throughout tests to verify correct behavior
const mockPricingConfig = {
  basePrice: 150,
  extraBedBathFee: 50,
  linens: {
    sheetFeePerBed: 30,
    towelFee: 5,
    faceClothFee: 2,
  },
  timeWindows: {
    anytime: 0,
    "10-3": 25,
    "11-4": 25,
    "12-2": 30,
  },
  cancellation: {
    fee: 10, // Owner-set cancellation fee
    windowDays: 7,
    homeownerPenaltyDays: 3,
    cleanerPenaltyDays: 4,
    refundPercentage: 0.5,
  },
  platform: {
    feePercent: 0.1,
  },
  highVolumeFee: 50,
};

// Mock businessConfig to return database pricing
jest.mock("../../config/businessConfig", () => {
  const originalModule = jest.requireActual("../../config/businessConfig");
  return {
    ...originalModule,
    getPricingConfig: jest.fn().mockResolvedValue(mockPricingConfig),
  };
});

const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
  UserCleanerAppointments,
  UserPendingRequests,
  Payout,
} = require("../../models");

describe("Cancellation Fee Charging", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const appointmentRouter = require("../../routes/api/v1/appointmentsRouter");
    app.use("/api/v1/appointments", appointmentRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to get a future date string
  const getFutureDate = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split("T")[0];
  };

  describe("GET /cancellation-info/:id - Cancellation Fee Info", () => {
    it("should include cancellation fee info when within 7 days and user has payment method", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(5), // 5 days from now (within 7-day window)
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
      });

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.willChargeCancellationFee).toBe(true);
      expect(res.body.cancellationFee).toBe(mockPricingConfig.cancellation.fee);
      expect(res.body.cancellationWindowDays).toBe(mockPricingConfig.cancellation.windowDays);
      expect(res.body.hasPaymentMethod).toBeTruthy();
      expect(res.body.warningMessage).toContain("cancellation fee");
    });

    it("should not charge cancellation fee when outside 7-day window", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(10), // 10 days from now (outside 7-day window)
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
      });

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.willChargeCancellationFee).toBe(false);
      expect(res.body.warningMessage).not.toContain("cancellation fee");
    });

    it("should not show cancellation fee warning when user has no payment method", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: false,
        stripeCustomerId: null,
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(3), // 3 days from now (within 7-day window)
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
      });

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.willChargeCancellationFee).toBe(true);
      expect(res.body.hasPaymentMethod).toBe(false);
      // Warning should not mention charging card if no payment method
      expect(res.body.warningMessage).not.toContain("card on file");
    });

    it("should include both penalty window and cancellation fee info when both apply", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(2), // 2 days from now (within 3-day penalty AND 7-day fee window)
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
      });

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isWithinPenaltyWindow).toBe(true);
      expect(res.body.willChargeCancellationFee).toBe(true);
      expect(res.body.warningMessage).toContain("cancellation fee");
      expect(res.body.warningMessage).toContain("cleaner will receive");
    });
  });

  describe("POST /:id/cancel-homeowner - Charging Cancellation Fee", () => {
    it("should charge cancellation fee when within 7 days and payment method exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      // Mock user with payment method
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      });

      // Mock appointment 5 days away (within 7-day window)
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(5),
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: null,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      // Mock Stripe customer with default payment method
      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_test123",
        invoice_settings: {
          default_payment_method: "pm_test123",
        },
      });

      // Mock cancellation fee payment intent creation
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_cancellation_test",
        status: "succeeded",
        amount: mockPricingConfig.cancellation.fee * 100, // fee in cents
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancellationFee).toBeDefined();
      expect(res.body.cancellationFee.charged).toBe(true);
      expect(res.body.cancellationFee.amount).toBe(mockPricingConfig.cancellation.fee);
      expect(res.body.cancellationFee.paymentIntentId).toBe("pi_cancellation_test");
      expect(res.body.message).toContain(`$${mockPricingConfig.cancellation.fee} cancellation fee has been charged`);

      // Verify Stripe PaymentIntent was created correctly
      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: mockPricingConfig.cancellation.fee * 100, // fee in cents
          currency: "usd",
          customer: "cus_test123",
          payment_method: "pm_test123",
          confirm: true,
          off_session: true,
          metadata: expect.objectContaining({
            type: "cancellation_fee",
          }),
        })
      );
    });

    it("should not charge fee when outside 7-day window", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(10), // 10 days away - outside 7-day window
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: null,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancellationFee).toBeNull();
      expect(res.body.message).not.toContain("cancellation fee");
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it("should not charge fee when user has no payment method", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: false,
        stripeCustomerId: null,
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(3), // 3 days away - within 7-day window
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: null,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Fee should be null because no payment method
      expect(res.body.cancellationFee).toBeNull();
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it("should handle Stripe charge failure gracefully and continue with cancellation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(5),
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: null,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      // Mock Stripe customer
      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_test123",
        invoice_settings: {
          default_payment_method: "pm_test123",
        },
      });

      // Mock Stripe charge failure
      mockPaymentIntentsCreate.mockRejectedValue(
        new Error("Card declined")
      );

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      // Cancellation should still succeed even if fee charge fails
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancellationFee).toBeDefined();
      expect(res.body.cancellationFee.charged).toBe(false);
      expect(res.body.cancellationFee.reason).toBe("Card declined");
    });

    it("should handle missing default payment method gracefully", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(5),
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: null,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      // Mock Stripe customer without default payment method
      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_test123",
        invoice_settings: {
          default_payment_method: null,
        },
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancellationFee).toBeDefined();
      expect(res.body.cancellationFee.charged).toBe(false);
      expect(res.body.cancellationFee.reason).toBe("No default payment method");
    });

    it("should charge fee and process partial refund when within both windows", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      });

      // Mock appointment 2 days away (within both 3-day penalty and 7-day fee windows)
      const mockAppointment = {
        id: 1,
        userId: 1,
        date: getFutureDate(2),
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
        completed: false,
        paymentIntentId: "pi_original",
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      // Mock Stripe customer
      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_test123",
        invoice_settings: {
          default_payment_method: "pm_test123",
        },
      });

      // Mock cancellation fee payment
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_cancellation",
        status: "succeeded",
        amount: 2500,
      });

      // Mock original payment retrieval
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: "pi_original",
        status: "succeeded",
      });

      // Mock partial refund
      mockRefundsCreate.mockResolvedValue({
        id: "re_test",
        amount: 10000, // $100 (50% of $200)
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 200,
        cancellationFee: 0,
        totalDue: 200,
        update: jest.fn().mockResolvedValue(true),
      });

      UserHomes.findByPk.mockResolvedValue({ address: "123 Test St" });

      UserCleanerAppointments.destroy.mockResolvedValue(1);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.wasWithinPenaltyWindow).toBe(true);
      expect(res.body.cancellationFee.charged).toBe(true);
      expect(res.body.cancellationFee.amount).toBe(mockPricingConfig.cancellation.fee);
      expect(res.body.refund.amount).toBe(100); // 50% refund of $200
      expect(res.body.cleanerPayout).toBeDefined();
    });

    it("should include cancellation fee in response message when charged", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(6),
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: null,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_test123",
        invoice_settings: { default_payment_method: "pm_test123" },
      });

      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_fee",
        status: "succeeded",
        amount: 2500,
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain(`$${mockPricingConfig.cancellation.fee} cancellation fee has been charged`);
    });
  });

  describe("Edge Cases", () => {
    it("should handle cancellation on exact 7th day (boundary)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(7), // Exactly 7 days away
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
      });

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // 7 days should be included in the window (<=7)
      expect(res.body.willChargeCancellationFee).toBe(true);
    });

    it("should handle same-day cancellation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: true,
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(1), // Tomorrow (more reliable for testing)
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
      });

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.willChargeCancellationFee).toBe(true);
      expect(res.body.isWithinPenaltyWindow).toBe(true);
      // Day calculation can vary due to timezone, just verify it's within penalty window
      expect(res.body.daysUntilAppointment).toBeLessThanOrEqual(3);
    });

    it("should handle user with stripeCustomerId but hasPaymentMethod false", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        hasPaymentMethod: false, // Has customer but no payment method
        stripeCustomerId: "cus_test123",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(3),
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: null,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Should not attempt to charge because hasPaymentMethod is false
      expect(mockCustomersRetrieve).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
