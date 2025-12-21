const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Stripe - store mock functions for later reference
const mockPaymentIntentsRetrieve = jest.fn();
const mockPaymentIntentsCancel = jest.fn();
const mockRefundsCreate = jest.fn();

jest.mock("stripe", () => {
  return jest.fn(() => ({
    paymentIntents: {
      retrieve: mockPaymentIntentsRetrieve,
      cancel: mockPaymentIntentsCancel,
    },
    refunds: {
      create: mockRefundsCreate,
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

const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
  UserCleanerAppointments,
  UserPendingRequests,
  UserReviews,
  Payout,
} = require("../../models");

describe("Cancellation Endpoints", () => {
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

  describe("GET /cancellation-info/:id", () => {
    describe("Homeowner cancellation info", () => {
      it("should return full refund info when appointment is more than 3 days away", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 1,
          type: "homeowner",
        });

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          date: getFutureDate(5), // 5 days from now
          price: "200",
          hasBeenAssigned: true,
          employeesAssigned: ["2"],
        });

        const res = await request(app)
          .get("/api/v1/appointments/cancellation-info/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isHomeowner).toBe(true);
        expect(res.body.isWithinPenaltyWindow).toBe(false);
        expect(res.body.estimatedRefund).toBe("200.00");
        expect(res.body.cleanerPayout).toBe("0.00");
      });

      it("should return partial refund info when appointment is within 3 days", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 1,
          type: "homeowner",
        });

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          date: getFutureDate(2), // 2 days from now
          price: "200",
          hasBeenAssigned: true,
          employeesAssigned: ["2"],
        });

        const res = await request(app)
          .get("/api/v1/appointments/cancellation-info/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isHomeowner).toBe(true);
        expect(res.body.isWithinPenaltyWindow).toBe(true);
        expect(res.body.estimatedRefund).toBe("100.00"); // 50%
        expect(res.body.cleanerPayout).toBe("90.00"); // 50% * 90%
        expect(res.body.warningMessage).toContain("50%");
      });

      it("should not penalize if no cleaner is assigned", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 1,
          type: "homeowner",
        });

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          date: getFutureDate(1), // 1 day from now
          price: "200",
          hasBeenAssigned: false,
          employeesAssigned: [],
        });

        const res = await request(app)
          .get("/api/v1/appointments/cancellation-info/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isWithinPenaltyWindow).toBe(false);
        expect(res.body.estimatedRefund).toBe("200.00");
      });
    });

    describe("Cleaner cancellation info", () => {
      it("should return penalty warning when appointment is within 4 days", async () => {
        const token = jwt.sign({ userId: 2 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 2,
          type: "cleaner",
        });

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          date: getFutureDate(3), // 3 days from now
          price: "200",
          hasBeenAssigned: true,
          employeesAssigned: ["2"],
        });

        UserReviews.count.mockResolvedValue(1); // 1 existing penalty

        const res = await request(app)
          .get("/api/v1/appointments/cancellation-info/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isCleaner).toBe(true);
        expect(res.body.isWithinPenaltyWindow).toBe(true);
        expect(res.body.recentCancellationPenalties).toBe(1);
        expect(res.body.willResultInFreeze).toBe(false);
        expect(res.body.warningMessage).toContain("1-star");
      });

      it("should warn about account freeze when 2 prior penalties exist", async () => {
        const token = jwt.sign({ userId: 2 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 2,
          type: "cleaner",
        });

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          date: getFutureDate(2), // 2 days from now
          price: "200",
          hasBeenAssigned: true,
          employeesAssigned: ["2"],
        });

        UserReviews.count.mockResolvedValue(2); // 2 existing penalties

        const res = await request(app)
          .get("/api/v1/appointments/cancellation-info/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.willResultInFreeze).toBe(true);
        expect(res.body.warningMessage).toContain("FREEZE YOUR ACCOUNT");
      });

      it("should not penalize when appointment is more than 4 days away", async () => {
        const token = jwt.sign({ userId: 2 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 2,
          type: "cleaner",
        });

        UserAppointments.findByPk.mockResolvedValue({
          id: 1,
          userId: 1,
          date: getFutureDate(7), // 7 days from now
          price: "200",
          hasBeenAssigned: true,
          employeesAssigned: ["2"],
        });

        UserReviews.count.mockResolvedValue(0);

        const res = await request(app)
          .get("/api/v1/appointments/cancellation-info/1")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isWithinPenaltyWindow).toBe(false);
        expect(res.body.warningMessage).toContain("without penalty");
      });
    });

    it("should return 401 without authorization", async () => {
      const res = await request(app).get("/api/v1/appointments/cancellation-info/1");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization token required");
    });

    it("should return 404 for non-existent appointment", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1 });
      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Appointment not found");
    });

    it("should return 403 for unauthorized user", async () => {
      const token = jwt.sign({ userId: 3 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 3, type: "homeowner" });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1, // Different user
        hasBeenAssigned: false,
        employeesAssigned: [],
      });

      const res = await request(app)
        .get("/api/v1/appointments/cancellation-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You are not authorized to cancel this appointment");
    });
  });

  describe("POST /:id/cancel-homeowner", () => {
    it("should cancel appointment and refund fully when outside penalty window", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: "pi_test",
        status: "succeeded",
      });

      mockRefundsCreate.mockResolvedValue({
        id: "re_test",
        amount: 20000, // $200 in cents
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(5), // 5 days away
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: "pi_test",
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 200,
        cancellationFee: 0,
        totalDue: 200,
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
      expect(res.body.wasWithinPenaltyWindow).toBe(false);
      expect(res.body.refund.amount).toBe(200); // Full refund
    });

    it("should process partial refund within penalty window", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: "pi_test",
        status: "succeeded",
      });

      mockRefundsCreate.mockResolvedValue({
        id: "re_test",
        amount: 10000, // $100 in cents (50%)
      });

      const mockAppointment = {
        id: 1,
        userId: 1,
        date: getFutureDate(2), // 2 days away - within penalty window
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
        completed: false,
        paymentIntentId: "pi_test",
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 200,
        cancellationFee: 0,
        totalDue: 200,
        update: jest.fn().mockResolvedValue(true),
      });

      User.findByPk.mockResolvedValue({
        id: 2,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      });

      UserHomes.findByPk.mockResolvedValue({
        address: "123 Test St",
      });

      UserCleanerAppointments.destroy.mockResolvedValue(1);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.wasWithinPenaltyWindow).toBe(true);
      expect(res.body.refund.amount).toBe(100); // 50% refund
      expect(res.body.cleanerPayout).toBeDefined();
      expect(Payout.create).toHaveBeenCalled();
    });

    it("should cancel authorization if payment not yet captured", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: "pi_test",
        status: "requires_capture",
      });

      mockPaymentIntentsCancel.mockResolvedValue({
        id: "pi_test",
        status: "canceled",
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(5),
        price: "200",
        hasBeenAssigned: false,
        employeesAssigned: [],
        completed: false,
        paymentIntentId: "pi_test",
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      });

      UserBills.findOne.mockResolvedValue({
        appointmentDue: 200,
        cancellationFee: 0,
        totalDue: 200,
        update: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      Payout.destroy.mockResolvedValue(0);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith("pi_test");
    });

    it("should return 403 if user is not the homeowner", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1, // Different user
        completed: false,
      });

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You can only cancel your own appointments");
    });

    it("should return 400 if appointment is already completed", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        completed: true,
      });

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot cancel a completed appointment");
    });
  });

  describe("POST /:id/cancel-cleaner", () => {
    it("should remove cleaner without penalty when outside 4-day window", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 2,
        type: "cleaner",
        accountFrozen: false,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(7), // 7 days away
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      });

      // Mock homeowner for notification
      User.findByPk.mockResolvedValueOnce({
        id: 2,
        type: "cleaner",
        accountFrozen: false,
      }).mockResolvedValueOnce({
        id: 1,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      });

      UserHomes.findByPk.mockResolvedValue({
        address: "123 Test St",
      });

      UserCleanerAppointments.destroy.mockResolvedValue(1);
      Payout.destroy.mockResolvedValue(1);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.wasWithinPenaltyWindow).toBe(false);
      expect(res.body.penaltyApplied).toBe(false);
      expect(UserReviews.create).not.toHaveBeenCalled();
    });

    it("should create 1-star review when within 4-day window", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      const mockCleaner = {
        id: 2,
        type: "cleaner",
        accountFrozen: false,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      User.findByPk
        .mockResolvedValueOnce(mockCleaner) // First call for cleaner
        .mockResolvedValueOnce({
          // Second call for homeowner notification
          id: 1,
          notifications: [],
          update: jest.fn().mockResolvedValue(true),
        });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(3), // 3 days away - within penalty window
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      });

      UserReviews.count.mockResolvedValue(0); // No prior penalties
      UserReviews.create.mockResolvedValue({ id: 1 });

      UserHomes.findByPk.mockResolvedValue({
        address: "123 Test St",
      });

      UserCleanerAppointments.destroy.mockResolvedValue(1);
      Payout.destroy.mockResolvedValue(1);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.wasWithinPenaltyWindow).toBe(true);
      expect(res.body.penaltyApplied).toBe(true);
      expect(res.body.accountFrozen).toBe(false);
      expect(UserReviews.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          reviewType: "system_cancellation_penalty",
          review: 1,
          reviewComment: "Last minute cancellation",
          isPublished: true,
        })
      );
    });

    it("should freeze account after 3 cancellation penalties", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      const mockCleaner = {
        id: 2,
        type: "cleaner",
        accountFrozen: false,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      User.findByPk
        .mockResolvedValueOnce(mockCleaner)
        .mockResolvedValueOnce({
          id: 1,
          notifications: [],
          update: jest.fn().mockResolvedValue(true),
        });

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(2), // 2 days away
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      });

      UserReviews.count.mockResolvedValue(3); // Already has 3 penalties (this makes 3rd one)
      UserReviews.create.mockResolvedValue({ id: 1 });

      UserHomes.findByPk.mockResolvedValue({
        address: "123 Test St",
      });

      UserCleanerAppointments.destroy.mockResolvedValue(1);
      Payout.destroy.mockResolvedValue(1);

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accountFrozen).toBe(true);
      expect(mockCleaner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          accountFrozen: true,
          accountFrozenReason: "3 or more last-minute cancellations within 3 months",
        })
      );
    });

    it("should return 403 if cleaner is not assigned to appointment", async () => {
      const token = jwt.sign({ userId: 3 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(7),
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"], // Different cleaner
        completed: false,
      });

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You are not assigned to this appointment");
    });

    it("should return 403 if cleaner account is already frozen", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(7),
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
        completed: false,
      });

      User.findByPk.mockResolvedValue({
        id: 2,
        type: "cleaner",
        accountFrozen: true, // Already frozen
      });

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Your account is frozen. Please contact support.");
    });

    it("should return 400 if appointment is already completed", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        date: getFutureDate(7),
        price: "200",
        hasBeenAssigned: true,
        employeesAssigned: ["2"],
        completed: true, // Already completed
      });

      const res = await request(app)
        .post("/api/v1/appointments/1/cancel-cleaner")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot cancel a completed appointment");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
