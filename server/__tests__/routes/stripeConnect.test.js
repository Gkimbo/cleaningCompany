const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Stripe before requiring the router
jest.mock("stripe", () => {
  const mockStripe = jest.fn(() => ({
    accounts: {
      create: jest.fn().mockResolvedValue({
        id: "acct_test_123456",
        type: "express",
        payouts_enabled: false,
        charges_enabled: false,
        details_submitted: false,
        requirements: {
          currently_due: ["individual.verification.document"],
          eventually_due: [],
          past_due: [],
        },
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "acct_test_123456",
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
        url: "https://connect.stripe.com/setup/test_onboarding_link",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    },
    transfers: {
      create: jest.fn().mockResolvedValue({
        id: "tr_test_123",
        amount: 13500,
        currency: "usd",
        destination: "acct_test_123456",
      }),
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation((body, sig, secret) => {
        return JSON.parse(body.toString());
      }),
    },
  }));
  return mockStripe;
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
  },
  StripeConnectAccount: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
}));

const {
  User,
  UserAppointments,
  StripeConnectAccount,
  Payout,
} = require("../../models");

// Import helper functions from the router for unit testing
const {
  calculatePayoutSplit,
  determineAccountStatus,
  validateUserId,
  PLATFORM_FEE_PERCENT,
  PAYOUT_STATUS,
  ACCOUNT_STATUS,
} = require("../../routes/api/v1/stripeConnectRouter");

describe("Stripe Connect Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  beforeAll(() => {
    app = express();

    // Import router after mocks are set up
    const stripeConnectRouter = require("../../routes/api/v1/stripeConnectRouter");

    // Custom middleware to handle JSON parsing for non-webhook routes
    // The webhook endpoint uses express.raw() internally
    app.use((req, res, next) => {
      // Skip JSON parsing for webhook route - it handles its own raw body parsing
      if (req.path === "/api/v1/stripe-connect/webhook") {
        return next();
      }
      express.json()(req, res, next);
    });

    app.use("/api/v1/stripe-connect", stripeConnectRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // UNIT TESTS: Helper Functions
  // ============================================================================

  describe("Helper Functions", () => {
    describe("calculatePayoutSplit", () => {
      it("should correctly calculate 90/10 split", () => {
        const result = calculatePayoutSplit(10000);
        expect(result.platformFee).toBe(1000);
        expect(result.netAmount).toBe(9000);
      });

      it("should round platform fee correctly for odd amounts", () => {
        const result = calculatePayoutSplit(15001);
        expect(result.platformFee).toBe(1500); // 15001 * 0.10 = 1500.1, rounds to 1500
        expect(result.netAmount).toBe(13501);
      });

      it("should handle zero amount", () => {
        const result = calculatePayoutSplit(0);
        expect(result.platformFee).toBe(0);
        expect(result.netAmount).toBe(0);
      });

      it("should handle small amounts", () => {
        const result = calculatePayoutSplit(100); // $1.00
        expect(result.platformFee).toBe(10); // $0.10
        expect(result.netAmount).toBe(90); // $0.90
      });
    });

    describe("determineAccountStatus", () => {
      it("should return ACTIVE when payouts and charges enabled", () => {
        const status = determineAccountStatus({
          payouts_enabled: true,
          charges_enabled: true,
          details_submitted: true,
        });
        expect(status).toBe(ACCOUNT_STATUS.ACTIVE);
      });

      it("should return RESTRICTED when details submitted but payouts not enabled", () => {
        const status = determineAccountStatus({
          payouts_enabled: false,
          charges_enabled: false,
          details_submitted: true,
        });
        expect(status).toBe(ACCOUNT_STATUS.RESTRICTED);
      });

      it("should return ONBOARDING when has requirements due", () => {
        const status = determineAccountStatus({
          payouts_enabled: false,
          charges_enabled: false,
          details_submitted: false,
          requirements: {
            currently_due: ["individual.verification.document"],
          },
        });
        expect(status).toBe(ACCOUNT_STATUS.ONBOARDING);
      });

      it("should return PENDING when no requirements and nothing submitted", () => {
        const status = determineAccountStatus({
          payouts_enabled: false,
          charges_enabled: false,
          details_submitted: false,
          requirements: {
            currently_due: [],
          },
        });
        expect(status).toBe(ACCOUNT_STATUS.PENDING);
      });
    });

    describe("validateUserId", () => {
      it("should return parsed integer for valid user ID", () => {
        expect(validateUserId("123")).toBe(123);
        expect(validateUserId(456)).toBe(456);
      });

      it("should return null for invalid user IDs", () => {
        expect(validateUserId("abc")).toBeNull();
        expect(validateUserId("-1")).toBeNull();
        expect(validateUserId("0")).toBeNull();
        expect(validateUserId(null)).toBeNull();
        expect(validateUserId(undefined)).toBeNull();
      });
    });

    describe("Constants", () => {
      it("should have correct platform fee percentage", () => {
        expect(PLATFORM_FEE_PERCENT).toBe(0.1);
      });

      it("should have all payout statuses defined", () => {
        expect(PAYOUT_STATUS.PENDING).toBe("pending");
        expect(PAYOUT_STATUS.HELD).toBe("held");
        expect(PAYOUT_STATUS.PROCESSING).toBe("processing");
        expect(PAYOUT_STATUS.COMPLETED).toBe("completed");
        expect(PAYOUT_STATUS.FAILED).toBe("failed");
      });

      it("should have all account statuses defined", () => {
        expect(ACCOUNT_STATUS.PENDING).toBe("pending");
        expect(ACCOUNT_STATUS.ONBOARDING).toBe("onboarding");
        expect(ACCOUNT_STATUS.RESTRICTED).toBe("restricted");
        expect(ACCOUNT_STATUS.ACTIVE).toBe("active");
        expect(ACCOUNT_STATUS.DISABLED).toBe("disabled");
      });
    });
  });

  // ============================================================================
  // API TESTS: Account Status
  // ============================================================================

  describe("GET /account-status/:userId", () => {
    it("should return no account status for user without Connect account", async () => {
      StripeConnectAccount.findOne.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/stripe-connect/account-status/1");

      expect(res.status).toBe(200);
      expect(res.body.hasAccount).toBe(false);
      expect(res.body.accountStatus).toBeNull();
      expect(res.body.payoutsEnabled).toBe(false);
    });

    it("should return account status for user with Connect account", async () => {
      const mockConnectAccount = {
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_123456",
        accountStatus: "active",
        payoutsEnabled: true,
        chargesEnabled: true,
        detailsSubmitted: true,
        onboardingComplete: true,
        update: jest.fn().mockResolvedValue(true),
      };

      StripeConnectAccount.findOne.mockResolvedValue(mockConnectAccount);

      const res = await request(app).get("/api/v1/stripe-connect/account-status/1");

      expect(res.status).toBe(200);
      expect(res.body.hasAccount).toBe(true);
      expect(res.body.accountStatus).toBe("active");
      expect(res.body.payoutsEnabled).toBe(true);
      expect(res.body.chargesEnabled).toBe(true);
      expect(res.body.stripeAccountId).toBe("acct_test_123456");
    });

    it("should return 400 for invalid user ID", async () => {
      const res = await request(app).get("/api/v1/stripe-connect/account-status/invalid");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_USER_ID");
    });

    it("should return 400 for negative user ID", async () => {
      const res = await request(app).get("/api/v1/stripe-connect/account-status/-5");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_USER_ID");
    });
  });

  // ============================================================================
  // API TESTS: Account Creation
  // ============================================================================

  describe("POST /create-account", () => {
    it("should create a Connect account for a cleaner", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testcleaner",
        email: "cleaner@test.com",
        type: "cleaner",
      });

      StripeConnectAccount.findOne.mockResolvedValue(null);
      StripeConnectAccount.create.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_123456",
        accountStatus: "pending",
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.stripeAccountId).toBe("acct_test_123456");
      expect(res.body.accountStatus).toBe("pending");
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token: "invalid_token" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("should return 401 for missing token", async () => {
      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("should return 404 for non-existent user", async () => {
      const token = jwt.sign({ userId: 999 }, secretKey);
      User.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("USER_NOT_FOUND");
    });

    it("should return 403 for non-cleaner users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "homeowner",
        email: "homeowner@test.com",
        type: "homeowner",
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_A_CLEANER");
    });

    it("should return 409 if account already exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testcleaner",
        email: "cleaner@test.com",
        type: "cleaner",
      });

      StripeConnectAccount.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_existing_123",
        accountStatus: "active",
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ACCOUNT_EXISTS");
      expect(res.body.stripeAccountId).toBe("acct_existing_123");
    });

    it("should create account with personalInfo (DOB, address, SSN last 4)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testcleaner",
        firstName: "John",
        lastName: "Doe",
        email: "cleaner@test.com",
        phone: "555-1234",
        type: "cleaner",
      });

      StripeConnectAccount.findOne.mockResolvedValue(null);
      StripeConnectAccount.create.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_123456",
        accountStatus: "pending",
      });

      const personalInfo = {
        dob: "1990-05-15",
        address: {
          line1: "123 Main St",
          line2: "Apt 4",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
        },
        ssn_last_4: "1234",
      };

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token, personalInfo });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.stripeAccountId).toBe("acct_test_123456");
    });

    it("should handle partial personalInfo (only DOB)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testcleaner",
        email: "cleaner@test.com",
        type: "cleaner",
      });

      StripeConnectAccount.findOne.mockResolvedValue(null);
      StripeConnectAccount.create.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_partial",
        accountStatus: "pending",
      });

      const personalInfo = {
        dob: "1985-12-25",
      };

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token, personalInfo });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should handle partial personalInfo (only address)", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testcleaner",
        email: "cleaner@test.com",
        type: "cleaner",
      });

      StripeConnectAccount.findOne.mockResolvedValue(null);
      StripeConnectAccount.create.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_addr",
        accountStatus: "pending",
      });

      const personalInfo = {
        address: {
          line1: "456 Oak Ave",
          city: "Houston",
          state: "TX",
          postalCode: "77001",
        },
      };

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token, personalInfo });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should create account without personalInfo", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testcleaner",
        email: "cleaner@test.com",
        type: "cleaner",
      });

      StripeConnectAccount.findOne.mockResolvedValue(null);
      StripeConnectAccount.create.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_no_info",
        accountStatus: "pending",
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-account")
        .send({ token });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================================
  // API TESTS: Onboarding
  // ============================================================================

  describe("POST /onboarding-link", () => {
    it("should generate an onboarding link", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const mockConnectAccount = {
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_123456",
        update: jest.fn().mockResolvedValue(true),
      };

      StripeConnectAccount.findOne.mockResolvedValue(mockConnectAccount);

      const res = await request(app)
        .post("/api/v1/stripe-connect/onboarding-link")
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toContain("https://connect.stripe.com");
      expect(res.body.expiresAt).toBeDefined();
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/stripe-connect/onboarding-link")
        .send({ token: "invalid" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("should return 404 if no Connect account exists", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      StripeConnectAccount.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/stripe-connect/onboarding-link")
        .send({ token });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("ACCOUNT_NOT_FOUND");
    });
  });

  describe("POST /dashboard-link", () => {
    it("should generate a dashboard link for completed onboarding", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      StripeConnectAccount.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_123456",
        detailsSubmitted: true,
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/dashboard-link")
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toContain("https://connect.stripe.com");
    });

    it("should return 400 if onboarding not completed", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      StripeConnectAccount.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_123456",
        detailsSubmitted: false,
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/dashboard-link")
        .send({ token });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ONBOARDING_INCOMPLETE");
    });
  });

  // ============================================================================
  // API TESTS: Payouts
  // ============================================================================

  describe("GET /payouts/:userId", () => {
    it("should return payout history for a cleaner", async () => {
      const mockPayouts = [
        {
          id: 1,
          appointmentId: 1,
          cleanerId: 1,
          grossAmount: 15000,
          platformFee: 1500,
          netAmount: 13500,
          status: "completed",
          stripeTransferId: "tr_test_123",
          paymentCapturedAt: new Date(),
          transferInitiatedAt: new Date(),
          completedAt: new Date(),
          failureReason: null,
          createdAt: new Date(),
          appointment: {
            id: 1,
            date: "2025-01-15",
            price: "150",
            homeId: 1,
            completed: true,
          },
        },
        {
          id: 2,
          appointmentId: 2,
          cleanerId: 1,
          grossAmount: 20000,
          platformFee: 2000,
          netAmount: 18000,
          status: "held",
          stripeTransferId: null,
          paymentCapturedAt: new Date(),
          transferInitiatedAt: null,
          completedAt: null,
          failureReason: null,
          createdAt: new Date(),
          appointment: {
            id: 2,
            date: "2025-01-20",
            price: "200",
            homeId: 2,
            completed: false,
          },
        },
      ];

      Payout.findAll.mockResolvedValue(mockPayouts);

      const res = await request(app).get("/api/v1/stripe-connect/payouts/1");

      expect(res.status).toBe(200);
      expect(res.body.payouts).toHaveLength(2);
      expect(res.body.totals.totalPaidCents).toBe(13500);
      expect(res.body.totals.pendingAmountCents).toBe(18000);
      expect(res.body.totals.completedCount).toBe(1);
      expect(res.body.totals.pendingCount).toBe(1);
      expect(res.body.platformFeePercent).toBe(10);
      expect(res.body.cleanerPercent).toBe(90);
    });

    it("should return empty payouts for cleaner with no payouts", async () => {
      Payout.findAll.mockResolvedValue([]);

      const res = await request(app).get("/api/v1/stripe-connect/payouts/1");

      expect(res.status).toBe(200);
      expect(res.body.payouts).toHaveLength(0);
      expect(res.body.totals.totalPaidCents).toBe(0);
      expect(res.body.totals.pendingAmountCents).toBe(0);
    });

    it("should return 400 for invalid user ID", async () => {
      const res = await request(app).get("/api/v1/stripe-connect/payouts/invalid");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_USER_ID");
    });
  });

  describe("POST /create-payout-record", () => {
    it("should create a payout record for an appointment", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        price: "150.00",
        employeesAssigned: [1],
      });

      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({
        id: 1,
        appointmentId: 1,
        cleanerId: 1,
        grossAmount: 15000,
        platformFee: 1500,
        netAmount: 13500,
        status: "pending",
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-payout-record")
        .send({
          appointmentId: 1,
          cleanerId: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.payout).toBeDefined();
    });

    it("should return existing payout if already exists", async () => {
      const existingPayout = {
        id: 1,
        appointmentId: 1,
        cleanerId: 1,
        grossAmount: 15000,
        platformFee: 1500,
        netAmount: 13500,
        status: "pending",
      };

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        price: "150.00",
        employeesAssigned: [1],
      });

      Payout.findOne.mockResolvedValue(existingPayout);

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-payout-record")
        .send({
          appointmentId: 1,
          cleanerId: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Payout record already exists");
    });

    it("should return 400 if missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/stripe-connect/create-payout-record")
        .send({
          appointmentId: 1,
          // Missing cleanerId
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("should return 404 if appointment not found", async () => {
      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/stripe-connect/create-payout-record")
        .send({
          appointmentId: 999,
          cleanerId: 1,
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("APPOINTMENT_NOT_FOUND");
    });
  });

  describe("POST /process-payout", () => {
    it("should return 400 if appointment ID is missing", async () => {
      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MISSING_APPOINTMENT_ID");
    });

    it("should return 404 if appointment not found", async () => {
      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("APPOINTMENT_NOT_FOUND");
    });

    it("should return 400 if job not completed", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        completed: false,
        paid: true,
        employeesAssigned: [1],
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("JOB_NOT_COMPLETE");
    });

    it("should return 400 if payment not captured", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        completed: true,
        paid: false,
        employeesAssigned: [1],
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PAYMENT_NOT_CAPTURED");
    });

    it("should return 400 if no cleaners assigned", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        completed: true,
        paid: true,
        employeesAssigned: [],
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("NO_CLEANERS_ASSIGNED");
    });

    it("should process payouts for completed job", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        completed: true,
        paid: true,
        price: "150.00",
        employeesAssigned: [1],
      });

      // Mock payout not existing yet
      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({
        id: 1,
        appointmentId: 1,
        cleanerId: 1,
        grossAmount: 15000,
        platformFee: 1500,
        netAmount: 13500,
        status: "processing",
        update: jest.fn().mockResolvedValue(true),
      });

      // Mock connect account
      StripeConnectAccount.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        stripeAccountId: "acct_test_123456",
        payoutsEnabled: true,
      });

      const res = await request(app)
        .post("/api/v1/stripe-connect/process-payout")
        .send({ appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.summary.total).toBe(1);
    });
  });

  // ============================================================================
  // API TESTS: Webhooks
  // ============================================================================

  describe("POST /webhook", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      // Set NODE_ENV to development to allow webhook processing without signature verification
      process.env.NODE_ENV = "development";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("should handle account.updated webhook event", async () => {
      const mockConnectAccount = {
        id: 1,
        stripeAccountId: "acct_test_123456",
        onboardingComplete: false,
        update: jest.fn().mockResolvedValue(true),
      };

      StripeConnectAccount.findOne.mockResolvedValue(mockConnectAccount);
      User.findByPk.mockResolvedValue({ id: 1, email: "test@test.com" });

      const webhookPayload = {
        type: "account.updated",
        data: {
          object: {
            id: "acct_test_123456",
            payouts_enabled: true,
            charges_enabled: true,
            details_submitted: true,
            requirements: {
              currently_due: [],
              eventually_due: [],
              past_due: [],
            },
          },
        },
      };

      const res = await request(app)
        .post("/api/v1/stripe-connect/webhook")
        .set("stripe-signature", "test_signature")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(webhookPayload));

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it("should handle transfer.failed webhook event", async () => {
      const mockPayout = {
        id: 1,
        stripeTransferId: "tr_test_failed",
        status: "processing",
        update: jest.fn().mockResolvedValue(true),
      };

      Payout.findOne.mockResolvedValue(mockPayout);

      const webhookPayload = {
        type: "transfer.failed",
        data: {
          object: {
            id: "tr_test_failed",
            failure_message: "Insufficient funds",
          },
        },
      };

      const res = await request(app)
        .post("/api/v1/stripe-connect/webhook")
        .set("stripe-signature", "test_signature")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(webhookPayload));

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it("should return 400 if webhook secret not configured and not in development", async () => {
      process.env.NODE_ENV = "production";

      const res = await request(app)
        .post("/api/v1/stripe-connect/webhook")
        .set("stripe-signature", "test_signature")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ type: "test" }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("WEBHOOK_SECRET_MISSING");
    });
  });
});

// Additional test for split calculations with multiple cleaners
describe("Payout Calculations", () => {
  it("should split payment correctly between multiple cleaners", () => {
    const totalPrice = 30000; // $300.00
    const numCleaners = 3;
    const perCleanerGross = Math.round(totalPrice / numCleaners); // $100.00 each

    const { platformFee, netAmount } = calculatePayoutSplit(perCleanerGross);

    expect(perCleanerGross).toBe(10000);
    expect(platformFee).toBe(1000); // $10.00
    expect(netAmount).toBe(9000); // $90.00

    // Total paid out should be 90% of total
    const totalPaidOut = netAmount * numCleaners;
    expect(totalPaidOut).toBe(27000); // $270.00 (90% of $300)
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
