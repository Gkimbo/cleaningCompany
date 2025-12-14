/**
 * Stripe Connect Integration Tests
 *
 * Tests the complete Stripe Connect payment flow:
 * 1. Homeowner creates appointment and pays
 * 2. Cleaner sets up Stripe Connect account
 * 3. Payment is captured 3 days before cleaning
 * 4. Job is completed
 * 5. 90% payout is sent to cleaner
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

const secretKey = process.env.SESSION_SECRET;

// Mock Stripe with Connect capabilities
jest.mock("stripe", () => {
  return jest.fn(() => ({
    accounts: {
      create: jest.fn().mockResolvedValue({
        id: "acct_test_cleaner",
        type: "express",
        payouts_enabled: false,
        charges_enabled: false,
        details_submitted: false,
        controller: {
          fees: { payer: "application" },
          losses: { payments: "application" },
          stripe_dashboard: { type: "express" },
        },
        requirements: {
          currently_due: ["individual.verification.document"],
        },
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "acct_test_cleaner",
        payouts_enabled: true,
        charges_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
        },
      }),
      createLoginLink: jest.fn().mockResolvedValue({
        url: "https://connect.stripe.com/express/login/test",
      }),
    },
    accountLinks: {
      create: jest.fn().mockResolvedValue({
        url: "https://connect.stripe.com/setup/test_onboarding",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    },
    paymentIntents: {
      create: jest.fn().mockImplementation((params) => ({
        id: `pi_test_${Date.now()}`,
        client_secret: `pi_test_${Date.now()}_secret`,
        amount: params.amount,
        currency: params.currency,
        status: "requires_capture",
        capture_method: "manual",
        metadata: params.metadata || {},
      })),
      capture: jest.fn().mockImplementation((id) => ({
        id,
        status: "succeeded",
        amount_received: 15000,
      })),
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "requires_capture",
        amount: 15000,
      }),
    },
    transfers: {
      create: jest.fn().mockImplementation((params) => ({
        id: `tr_test_${Date.now()}`,
        amount: params.amount,
        currency: params.currency,
        destination: params.destination,
        metadata: params.metadata,
      })),
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation((body) => {
        return JSON.parse(body.toString());
      }),
    },
  }));
});

// Create mock user objects
const mockHomeowner = {
  id: 1,
  username: "homeowner",
  email: "homeowner@test.com",
  type: "homeowner",
};

const mockCleaner = {
  id: 2,
  username: "cleaner",
  email: "cleaner@test.com",
  type: "cleaner",
};

// Create mock appointment
const mockAppointment = {
  id: 1,
  userId: 1,
  homeId: 1,
  date: "2025-02-01",
  price: "150.00",
  paid: false,
  completed: false,
  hasBeenAssigned: false,
  employeesAssigned: [],
  paymentIntentId: null,
  paymentStatus: "pending",
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
};

// Mock connect account
const mockConnectAccount = {
  id: 1,
  userId: 2,
  stripeAccountId: "acct_test_cleaner",
  accountStatus: "active",
  payoutsEnabled: true,
  chargesEnabled: true,
  detailsSubmitted: true,
  onboardingComplete: true,
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
};

// Mock payout
const mockPayout = {
  id: 1,
  appointmentId: 1,
  cleanerId: 2,
  grossAmount: 15000,
  platformFee: 1500,
  netAmount: 13500,
  status: "pending",
  stripeTransferId: null,
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
};

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
  },
  UserHomes: {
    findByPk: jest.fn().mockResolvedValue({
      id: 1,
      nickName: "Test Home",
      address: "123 Test St",
    }),
  },
  StripeConnectAccount: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  UserBills: {},
}));

// Mock services
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
}));

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

const {
  User,
  UserAppointments,
  StripeConnectAccount,
  Payout,
} = require("../../models");

describe("Stripe Connect Full Payment Flow", () => {
  let app;

  beforeAll(() => {
    app = express();

    // Import routers
    const paymentRouter = require("../../routes/api/v1/paymentRouter");
    const stripeConnectRouter = require("../../routes/api/v1/stripeConnectRouter");

    // JSON parser middleware (skips webhook routes)
    app.use((req, res, next) => {
      if (
        req.path === "/api/v1/payments/webhook" ||
        req.path === "/api/v1/stripe-connect/webhook"
      ) {
        return next();
      }
      express.json()(req, res, next);
    });

    app.use("/api/v1/payments", paymentRouter);
    app.use("/api/v1/stripe-connect", stripeConnectRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock state
    mockAppointment.paid = false;
    mockAppointment.completed = false;
    mockAppointment.hasBeenAssigned = false;
    mockAppointment.employeesAssigned = [];
    mockAppointment.paymentIntentId = null;
    mockAppointment.paymentStatus = "pending";

    mockPayout.status = "pending";
    mockPayout.stripeTransferId = null;
  });

  describe("Step 1: Cleaner Onboarding", () => {
    it("should allow cleaner to create Connect account", async () => {
      const token = jwt.sign({ userId: mockCleaner.id }, secretKey);

      User.findByPk.mockResolvedValue(mockCleaner);
      StripeConnectAccount.findOne.mockResolvedValue(null);
      StripeConnectAccount.create.mockResolvedValue({
        ...mockConnectAccount,
        accountStatus: "pending",
        payoutsEnabled: false,
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.stripeAccountId).toBe("acct_test_cleaner");
    });

    it("should generate onboarding link for cleaner", async () => {
      const token = jwt.sign({ userId: mockCleaner.id }, secretKey);

      StripeConnectAccount.findOne.mockResolvedValue({
        ...mockConnectAccount,
        accountStatus: "pending",
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/onboarding-link")
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toContain("stripe.com");
    });

    it("should show account status after onboarding", async () => {
      StripeConnectAccount.findOne.mockResolvedValue({
        ...mockConnectAccount,
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app).get(
        `/api/v1/stripe-connect/account-status/${mockCleaner.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.hasAccount).toBe(true);
      expect(res.body.payoutsEnabled).toBe(true);
      expect(res.body.accountStatus).toBe("active");
    });
  });

  describe("Step 2: Appointment Creation & Payment Authorization", () => {
    it("should create payment intent with manual capture", async () => {
      const res = await request(app)
        .post("/api/v1/payments/create-intent")
        .send({
          amount: 15000,
          email: mockHomeowner.email,
        });

      expect(res.status).toBe(200);
      expect(res.body.clientSecret).toBeDefined();
    });
  });

  describe("Step 3: Cleaner Assignment & Payout Record", () => {
    it("should create payout record when cleaner is assigned", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        ...mockAppointment,
        employeesAssigned: [mockCleaner.id],
      });
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue(mockPayout);

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-payout-record")
        .send({
          appointmentId: mockAppointment.id,
          cleanerId: mockCleaner.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.payout).toBeDefined();
    });
  });

  describe("Step 4: Payment Capture (3 days before)", () => {
    it("should capture payment when cleaner is assigned", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        ...mockAppointment,
        paymentIntentId: "pi_test_123",
        hasBeenAssigned: true,
        employeesAssigned: [mockCleaner.id],
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post("/api/v1/payments/capture")
        .send({ appointmentId: mockAppointment.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Step 5: Job Completion & Payout Processing", () => {
    it("should process payout after job completion", async () => {
      // Setup: completed job with payment captured
      UserAppointments.findByPk.mockResolvedValue({
        ...mockAppointment,
        paid: true,
        completed: true,
        hasBeenAssigned: true,
        employeesAssigned: [mockCleaner.id],
        paymentIntentId: "pi_test_123",
      });

      // Payout record exists but not completed
      Payout.findOne.mockResolvedValue({
        ...mockPayout,
        status: "held",
        update: jest.fn().mockResolvedValue(true),
      });

      // Cleaner has active Connect account
      StripeConnectAccount.findOne.mockResolvedValue(mockConnectAccount);

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: mockAppointment.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].status).toBe("success");
      expect(res.body.results[0].netAmount).toBe(13500); // 90% of $150
    });

    it("should correctly calculate 90/10 split", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        ...mockAppointment,
        price: "200.00", // $200 job
        paid: true,
        completed: true,
        hasBeenAssigned: true,
        employeesAssigned: [mockCleaner.id],
        paymentIntentId: "pi_test_123",
      });

      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({
        ...mockPayout,
        grossAmount: 20000,
        platformFee: 2000,
        netAmount: 18000,
        update: jest.fn().mockResolvedValue(true),
      });

      StripeConnectAccount.findOne.mockResolvedValue(mockConnectAccount);

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: mockAppointment.id });

      expect(res.status).toBe(200);
      const result = res.body.results[0];
      expect(result.grossAmount).toBe(20000); // $200 in cents
      expect(result.platformFee).toBe(2000); // $20 (10%)
      expect(result.netAmount).toBe(18000); // $180 (90%)
    });

    it("should split payout among multiple cleaners", async () => {
      const cleanerIds = [2, 3]; // Two cleaners

      UserAppointments.findByPk.mockResolvedValue({
        ...mockAppointment,
        price: "300.00", // $300 job
        paid: true,
        completed: true,
        hasBeenAssigned: true,
        employeesAssigned: cleanerIds,
        paymentIntentId: "pi_test_123",
      });

      // No existing payout records
      Payout.findOne.mockResolvedValue(null);

      // Mock payout creation for each cleaner
      let createCallCount = 0;
      Payout.create.mockImplementation(() => {
        createCallCount++;
        return Promise.resolve({
          id: createCallCount,
          appointmentId: 1,
          cleanerId: cleanerIds[createCallCount - 1] || 2,
          grossAmount: 15000, // $150 each
          platformFee: 1500, // $15 each
          netAmount: 13500, // $135 each
          status: "processing",
          update: jest.fn().mockResolvedValue(true),
        });
      });

      // Both cleaners have active Connect accounts
      StripeConnectAccount.findOne.mockResolvedValue(mockConnectAccount);

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: mockAppointment.id });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.summary.total).toBe(2);
      expect(res.body.summary.successful).toBe(2);

      // Each cleaner gets half of $300 = $150, minus 10% = $135
      res.body.results.forEach((result) => {
        expect(result.grossAmount).toBe(15000); // $150
        expect(result.netAmount).toBe(13500); // $135
      });
    });
  });

  describe("Step 6: Payout History", () => {
    it("should show payout history for cleaner", async () => {
      Payout.findAll.mockResolvedValue([
        {
          ...mockPayout,
          status: "completed",
          stripeTransferId: "tr_test_123",
          completedAt: new Date(),
          appointment: {
            id: 1,
            date: "2025-02-01",
            price: "150.00",
            homeId: 1,
            completed: true,
          },
        },
      ]);

      const res = await request(app).get(
        `/api/v1/stripe-connect/payouts/${mockCleaner.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.payouts).toHaveLength(1);
      expect(res.body.totals.totalPaidCents).toBe(13500);
      expect(res.body.totals.totalPaidDollars).toBe("135.00");
      expect(res.body.platformFeePercent).toBe(10);
      expect(res.body.cleanerPercent).toBe(90);
    });
  });

  describe("Error Handling", () => {
    it("should fail payout if cleaner has no Connect account", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        ...mockAppointment,
        paid: true,
        completed: true,
        hasBeenAssigned: true,
        employeesAssigned: [mockCleaner.id],
        paymentIntentId: "pi_test_123",
      });

      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({
        ...mockPayout,
        update: jest.fn().mockResolvedValue(true),
      });

      // No Connect account
      StripeConnectAccount.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: mockAppointment.id });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe("failed");
      expect(res.body.results[0].code).toBe("NO_CONNECT_ACCOUNT");
    });

    it("should fail payout if cleaner onboarding incomplete", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        ...mockAppointment,
        paid: true,
        completed: true,
        hasBeenAssigned: true,
        employeesAssigned: [mockCleaner.id],
        paymentIntentId: "pi_test_123",
      });

      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({
        ...mockPayout,
        update: jest.fn().mockResolvedValue(true),
      });

      // Connect account exists but not enabled
      StripeConnectAccount.findOne.mockResolvedValue({
        ...mockConnectAccount,
        payoutsEnabled: false,
        onboardingComplete: false,
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: mockAppointment.id });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe("failed");
      expect(res.body.results[0].code).toBe("ONBOARDING_INCOMPLETE");
    });

    it("should not allow non-cleaners to create Connect accounts", async () => {
      const token = jwt.sign({ userId: mockHomeowner.id }, secretKey);

      User.findByPk.mockResolvedValue(mockHomeowner);

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_A_CLEANER");
    });
  });

  describe("Webhook Processing", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("should update account status via webhook", async () => {
      StripeConnectAccount.findOne.mockResolvedValue({
        ...mockConnectAccount,
        onboardingComplete: false,
        update: jest.fn().mockResolvedValue(true),
      });

      User.findByPk.mockResolvedValue(mockCleaner);

      const res = await request(app)
        .post("/api/v1/stripe-connect/webhook")
        .set("stripe-signature", "test_sig")
        .set("Content-Type", "application/json")
        .send(
          JSON.stringify({
            type: "account.updated",
            data: {
              object: {
                id: "acct_test_cleaner",
                payouts_enabled: true,
                charges_enabled: true,
                details_submitted: true,
                requirements: { currently_due: [] },
              },
            },
          })
        );

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });
});

describe("Payment Flow Calculations", () => {
  const { calculatePayoutSplit } = require("../../routes/api/v1/stripeConnectRouter");

  it("should correctly calculate various payout amounts", () => {
    const testCases = [
      { gross: 10000, expectedFee: 1000, expectedNet: 9000 }, // $100
      { gross: 15000, expectedFee: 1500, expectedNet: 13500 }, // $150
      { gross: 20000, expectedFee: 2000, expectedNet: 18000 }, // $200
      { gross: 7500, expectedFee: 750, expectedNet: 6750 }, // $75
      { gross: 25000, expectedFee: 2500, expectedNet: 22500 }, // $250
    ];

    testCases.forEach(({ gross, expectedFee, expectedNet }) => {
      const { platformFee, netAmount } = calculatePayoutSplit(gross);
      expect(platformFee).toBe(expectedFee);
      expect(netAmount).toBe(expectedNet);
    });
  });

  it("should handle odd amounts with rounding", () => {
    // $99.99 = 9999 cents
    const { platformFee, netAmount } = calculatePayoutSplit(9999);
    // 9999 * 0.10 = 999.9, rounds to 1000
    expect(platformFee).toBe(1000);
    expect(netAmount).toBe(8999);
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
