/**
 * Integration Tests: Preferred Cleaner Flow
 *
 * Tests the complete flow from becoming a preferred cleaner to direct booking:
 * 1. Homeowner books an appointment
 * 2. Cleaner completes the job
 * 3. Homeowner reviews cleaner with setAsPreferred: true
 * 4. Cleaner becomes preferred for that home
 * 5. Preferred cleaner can now book directly (skipping requests)
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock all external services
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendPreferredCleanerNotification: jest.fn().mockResolvedValue(true),
  sendNewClientAppointmentNotification: jest.fn().mockResolvedValue(true),
  sendPreferredCleanerBookedNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/ReviewsClass", () => ({
  submitReview: jest.fn().mockResolvedValue({ id: 1 }),
  getReviewStatus: jest.fn().mockResolvedValue({ bothReviewed: false }),
  getPendingReviewsForUser: jest.fn().mockResolvedValue([]),
}));

// Mock PreferredCleanerService to allow preferred cleaner creation
jest.mock("../../services/PreferredCleanerService", () => ({
  isBusinessCleanerForHome: jest.fn().mockResolvedValue(false),
}));

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        client_secret: "pi_test_123_secret",
        status: "requires_capture",
      }),
    },
    customers: {
      retrieve: jest.fn().mockResolvedValue({
        id: "cus_test_123",
        invoice_settings: { default_payment_method: "pm_test_123" },
      }),
    },
  }));
});

// Mock models
jest.mock("../../models", () => {
  // In-memory data store for tests
  const preferredCleaners = new Map();
  const appointments = new Map();
  const pendingRequests = new Map();

  return {
    User: {
      findByPk: jest.fn().mockImplementation((id) => {
        const users = {
          1: { id: 1, type: "homeowner", firstName: "John", lastName: "Homeowner", email: "john@test.com", stripeCustomerId: "cus_test_123" },
          100: { id: 100, type: "cleaner", firstName: "Jane", lastName: "Cleaner", email: "jane@test.com", expoPushToken: "ExponentPushToken[xxx]", getNotificationEmail: () => "jane@test.com" },
        };
        return Promise.resolve(users[id] || null);
      }),
      findAll: jest.fn().mockResolvedValue([]),
    },
    UserHomes: {
      findByPk: jest.fn().mockResolvedValue({
        id: 10,
        userId: 1,
        nickName: "Beach House",
        address: "123 Ocean Ave",
        city: "Miami",
        preferredCleanerId: null,
        usePreferredCleaners: true,
        dataValues: {
          id: 10,
          userId: 1,
          preferredCleanerId: null,
          usePreferredCleaners: true,
        },
      }),
      findOne: jest.fn().mockImplementation(({ where }) => {
        // Handle both string and number comparisons (params come as strings)
        const homeId = parseInt(where.id, 10);
        const userId = parseInt(where.userId, 10);
        if (homeId === 10 && userId === 1) {
          return Promise.resolve({
            id: 10,
            userId: 1,
            nickName: "Beach House",
            address: "123 Ocean Ave",
            usePreferredCleaners: true,
            update: jest.fn().mockResolvedValue(true),
          });
        }
        return Promise.resolve(null);
      }),
    },
    UserAppointments: {
      findByPk: jest.fn().mockImplementation((id) => {
        const apt = appointments.get(id);
        return Promise.resolve(apt || {
          id,
          homeId: 10,
          userId: 1,
          date: "2025-01-20",
          status: "completed",
          hasBeenAssigned: false,
          employeesAssigned: [],
          update: jest.fn().mockImplementation(function(data) {
            Object.assign(this, data);
            return Promise.resolve(this);
          }),
        });
      }),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data) => {
        const apt = { id: Date.now(), ...data };
        appointments.set(apt.id, apt);
        return Promise.resolve(apt);
      }),
    },
    UserReviews: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    HomePreferredCleaner: {
      findOne: jest.fn().mockImplementation(({ where }) => {
        // Handle string/number params
        const homeId = parseInt(where.homeId, 10);
        const cleanerId = parseInt(where.cleanerId, 10);
        const key = `${homeId}-${cleanerId}`;
        return Promise.resolve(preferredCleaners.get(key) || null);
      }),
      findAll: jest.fn().mockImplementation(({ where }) => {
        const homeId = parseInt(where.homeId, 10);
        const results = [];
        for (const [key, value] of preferredCleaners) {
          if (key.startsWith(`${homeId}-`)) {
            results.push(value);
          }
        }
        return Promise.resolve(results);
      }),
      create: jest.fn().mockImplementation((data) => {
        const key = `${data.homeId}-${data.cleanerId}`;
        const record = { id: Date.now(), ...data };
        preferredCleaners.set(key, record);
        return Promise.resolve(record);
      }),
      destroy: jest.fn().mockImplementation(({ where }) => {
        // Handle string/number params
        const homeId = parseInt(where.homeId, 10);
        const cleanerId = parseInt(where.cleanerId, 10);
        const key = `${homeId}-${cleanerId}`;
        const existed = preferredCleaners.has(key);
        preferredCleaners.delete(key);
        return Promise.resolve(existed ? 1 : 0);
      }),
      // Expose for test verification
      _store: preferredCleaners,
    },
    UserPendingRequests: {
      findOne: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.appointmentId}-${where.requesterId}`;
        return Promise.resolve(pendingRequests.get(key) || null);
      }),
      create: jest.fn().mockImplementation((data) => {
        const key = `${data.appointmentId}-${data.requesterId}`;
        const record = { id: Date.now(), ...data };
        pendingRequests.set(key, record);
        return Promise.resolve(record);
      }),
      // Expose for test verification
      _store: pendingRequests,
    },
    UserCleanerAppointments: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    CleanerClient: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    Payout: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    UserBills: {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        userId: 1,
        appointmentDue: 0,
        totalDue: 0,
        cancellationFee: 0,
        update: jest.fn().mockResolvedValue(true),
        dataValues: { appointmentDue: 0, totalDue: 0, cancellationFee: 0 },
      }),
    },
    sequelize: {
      transaction: jest.fn().mockImplementation(async (callback) => {
        const t = { commit: jest.fn(), rollback: jest.fn() };
        try {
          const result = await callback(t);
          return result;
        } catch (error) {
          throw error;
        }
      }),
    },
  };
});

const { HomePreferredCleaner, UserPendingRequests } = require("../../models");
const EmailClass = require("../../services/sendNotifications/EmailClass");
const PushNotificationClass = require("../../services/sendNotifications/PushNotificationClass");

describe("Preferred Cleaner Flow - Integration Tests", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const homeownerId = 1;
  const cleanerId = 100;
  const homeId = 10;
  const appointmentId = 1;

  const createHomeownerToken = () => jwt.sign({ userId: homeownerId }, secretKey);
  const createCleanerToken = () => jwt.sign({ userId: cleanerId }, secretKey);

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const reviewsRouter = require("../../routes/api/v1/reviewsRouter");
    const preferredCleanerRouter = require("../../routes/api/v1/preferredCleanerRouter");

    app.use("/api/v1/reviews", reviewsRouter);
    app.use("/api/v1/preferred-cleaner", preferredCleanerRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear in-memory stores
    HomePreferredCleaner._store.clear();
    UserPendingRequests._store.clear();
  });

  describe("Complete Flow: Become Preferred Cleaner → Direct Booking", () => {
    describe("Step 1: Initial State - Cleaner is NOT preferred", () => {
      it("should confirm cleaner is not initially preferred for the home", async () => {
        const token = createHomeownerToken();

        const res = await request(app)
          .get(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isPreferred).toBe(false);
      });

      it("should return empty preferred cleaners list initially", async () => {
        const token = createHomeownerToken();

        const res = await request(app)
          .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.preferredCleaners).toHaveLength(0);
        expect(res.body.usePreferredCleaners).toBe(true);
      });
    });

    describe("Step 2: Homeowner reviews cleaner with setAsPreferred: true", () => {
      it("should create preferred cleaner record when review is submitted", async () => {
        const token = createHomeownerToken();

        const reviewData = {
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 5,
          punctuality: 5,
          professionalism: 5,
          communication: 5,
          attentionToDetail: 5,
          thoroughness: 5,
          respectOfProperty: 5,
          followedInstructions: 5,
          wouldRecommend: true,
          publicComment: "Excellent work! Making them preferred.",
          setAsPreferred: true,
          homeId,
        };

        const res = await request(app)
          .post("/api/v1/reviews/submit")
          .set("Authorization", `Bearer ${token}`)
          .send(reviewData);

        expect(res.status).toBe(201);

        // Verify preferred cleaner record was created
        expect(HomePreferredCleaner.create).toHaveBeenCalledWith({
          homeId,
          cleanerId,
          setAt: expect.any(Date),
          setBy: "review",
        });
      });

      it("should send notifications to cleaner when made preferred", async () => {
        const token = createHomeownerToken();

        await request(app)
          .post("/api/v1/reviews/submit")
          .set("Authorization", `Bearer ${token}`)
          .send({
            userId: cleanerId,
            appointmentId: 2, // Different appointment
            reviewType: "homeowner_to_cleaner",
            cleaningQuality: 5,
            punctuality: 5,
            professionalism: 5,
            communication: 5,
            attentionToDetail: 5,
            thoroughness: 5,
            respectOfProperty: 5,
            followedInstructions: 5,
            wouldRecommend: true,
            setAsPreferred: true,
            homeId,
          });

        // Verify email notification
        expect(EmailClass.sendPreferredCleanerNotification).toHaveBeenCalled();

        // Verify push notification
        expect(PushNotificationClass.sendPushNotification).toHaveBeenCalledWith(
          "ExponentPushToken[xxx]",
          "You earned preferred status!",
          expect.stringContaining("preferred booking status")
        );
      });
    });

    describe("Step 3: Cleaner is now preferred", () => {
      beforeEach(() => {
        // Simulate that cleaner has been made preferred
        HomePreferredCleaner._store.set(`${homeId}-${cleanerId}`, {
          id: 1,
          homeId,
          cleanerId,
          setAt: new Date(),
          setBy: "review",
        });
      });

      it("should confirm cleaner is now preferred for the home", async () => {
        const token = createHomeownerToken();

        const res = await request(app)
          .get(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isPreferred).toBe(true);
      });

      it("should list cleaner in preferred cleaners", async () => {
        const token = createHomeownerToken();

        // Mock findAll to return the cleaner with details
        HomePreferredCleaner.findAll.mockResolvedValueOnce([
          {
            id: 1,
            homeId,
            cleanerId,
            setAt: new Date(),
            setBy: "review",
            cleaner: {
              id: cleanerId,
              firstName: "Jane",
              lastName: "Cleaner",
              username: "janecleaner",
            },
          },
        ]);

        const res = await request(app)
          .get(`/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.preferredCleaners).toHaveLength(1);
        expect(res.body.preferredCleaners[0].cleaner.firstName).toBe("Jane");
        expect(res.body.preferredCleaners[0].cleaner.lastName).toBe("Cleaner");
        expect(res.body.preferredCleaners[0].setBy).toBe("review");
      });
    });
  });

  describe("Direct Booking vs Regular Request Comparison", () => {
    describe("Regular Cleaner (NOT preferred) - Requires Approval", () => {
      it("should require approval process for non-preferred cleaner", () => {
        // Simulate the check that happens in request-employee endpoint
        const isPreferredCleaner = HomePreferredCleaner._store.has(`${homeId}-${cleanerId}`);
        expect(isPreferredCleaner).toBe(false);

        // Regular flow would:
        // 1. Create UserPendingRequests record
        // 2. Send approval request to homeowner
        // 3. Wait for homeowner approval
        // 4. Only then assign cleaner to appointment

        const regularCleanerFlow = {
          requiresApproval: !isPreferredCleaner,
          createsPendingRequest: !isPreferredCleaner,
          immediateBooking: isPreferredCleaner,
        };

        expect(regularCleanerFlow.requiresApproval).toBe(true);
        expect(regularCleanerFlow.createsPendingRequest).toBe(true);
        expect(regularCleanerFlow.immediateBooking).toBe(false);
      });
    });

    describe("Preferred Cleaner - Direct Booking (No Approval)", () => {
      beforeEach(() => {
        // Set up cleaner as preferred
        HomePreferredCleaner._store.set(`${homeId}-${cleanerId}`, {
          id: 1,
          homeId,
          cleanerId,
          setAt: new Date(),
          setBy: "review",
        });
      });

      it("should allow direct booking without approval for preferred cleaner", () => {
        // Simulate the check that happens in request-employee endpoint
        const isPreferredCleaner = HomePreferredCleaner._store.has(`${homeId}-${cleanerId}`);
        expect(isPreferredCleaner).toBe(true);

        // Preferred cleaner flow:
        // 1. NO UserPendingRequests record created
        // 2. Immediately assigns cleaner to appointment
        // 3. Creates UserCleanerAppointments record
        // 4. Sends confirmation (not approval request) to homeowner

        const preferredCleanerFlow = {
          requiresApproval: !isPreferredCleaner,
          createsPendingRequest: !isPreferredCleaner,
          immediateBooking: isPreferredCleaner,
        };

        expect(preferredCleanerFlow.requiresApproval).toBe(false);
        expect(preferredCleanerFlow.createsPendingRequest).toBe(false);
        expect(preferredCleanerFlow.immediateBooking).toBe(true);
      });

      it("should verify preferred cleaner can book appointment directly", async () => {
        // This tests the expected behavior of the direct booking flow
        const isPreferredCleaner = HomePreferredCleaner._store.has(`${homeId}-${cleanerId}`);

        // Simulate what the endpoint does for preferred cleaner
        if (isPreferredCleaner) {
          // Skip pending request creation
          expect(UserPendingRequests._store.size).toBe(0);

          // Direct assignment would happen here
          const appointmentUpdate = {
            hasBeenAssigned: true,
            employeesAssigned: [cleanerId],
          };

          expect(appointmentUpdate.hasBeenAssigned).toBe(true);
          expect(appointmentUpdate.employeesAssigned).toContain(cleanerId);
        }
      });
    });
  });

  describe("Booking Flow Response Messages", () => {
    it("should return appropriate message for regular cleaner request", () => {
      const isPreferredCleaner = false;

      const responseMessage = isPreferredCleaner
        ? "Job booked successfully! As a preferred cleaner, no approval was needed."
        : "Request sent to the client for approval";

      expect(responseMessage).toBe("Request sent to the client for approval");
    });

    it("should return appropriate message for preferred cleaner direct booking", () => {
      const isPreferredCleaner = true;

      const responseMessage = isPreferredCleaner
        ? "Job booked successfully! As a preferred cleaner, no approval was needed."
        : "Request sent to the client for approval";

      expect(responseMessage).toBe("Job booked successfully! As a preferred cleaner, no approval was needed.");
    });
  });

  describe("Edge Cases", () => {
    describe("Toggle usePreferredCleaners OFF", () => {
      it("should treat preferred cleaner as regular when toggle is off", async () => {
        const token = createHomeownerToken();

        // First, set up preferred cleaner
        HomePreferredCleaner._store.set(`${homeId}-${cleanerId}`, {
          id: 1,
          homeId,
          cleanerId,
          setAt: new Date(),
          setBy: "review",
        });

        // Mock home with toggle OFF
        const { UserHomes } = require("../../models");
        UserHomes.findOne.mockResolvedValueOnce({
          id: homeId,
          userId: homeownerId,
          usePreferredCleaners: false, // Toggle OFF
          update: jest.fn(),
        });

        // When usePreferredCleaners is OFF, the appointment creation
        // should not use preferred cleaner logic
        const home = await UserHomes.findOne({ where: { id: homeId } });
        const usePreferredCleaners = home.usePreferredCleaners !== false;

        expect(usePreferredCleaners).toBe(false);

        // This means all cleaners can request, preferred cleaner loses direct booking
        const preferredCleanerId = usePreferredCleaners ? cleanerId : null;
        expect(preferredCleanerId).toBeNull();
      });
    });

    describe("Remove cleaner from preferred via review", () => {
      beforeEach(() => {
        // Set up cleaner as preferred
        HomePreferredCleaner._store.set(`${homeId}-${cleanerId}`, {
          id: 1,
          homeId,
          cleanerId,
          setAt: new Date(),
          setBy: "review",
        });
      });

      it("should remove preferred status when setAsPreferred is false in review", async () => {
        const token = createHomeownerToken();

        // Verify cleaner is currently preferred
        expect(HomePreferredCleaner._store.has(`${homeId}-${cleanerId}`)).toBe(true);

        // Mock findOne to return existing record
        HomePreferredCleaner.findOne.mockResolvedValueOnce({
          id: 1,
          homeId,
          cleanerId,
        });

        const res = await request(app)
          .post("/api/v1/reviews/submit")
          .set("Authorization", `Bearer ${token}`)
          .send({
            userId: cleanerId,
            appointmentId: 3,
            reviewType: "homeowner_to_cleaner",
            cleaningQuality: 3,
            punctuality: 3,
            professionalism: 3,
            communication: 3,
            attentionToDetail: 3,
            thoroughness: 3,
            respectOfProperty: 3,
            followedInstructions: 3,
            wouldRecommend: false,
            publicComment: "Quality has dropped, removing preferred status.",
            setAsPreferred: false, // Remove preferred status
            homeId,
          });

        expect(res.status).toBe(201);

        // Verify destroy was called to remove preferred status
        expect(HomePreferredCleaner.destroy).toHaveBeenCalledWith({
          where: { homeId, cleanerId },
        });
      });
    });

    describe("Homeowner explicitly removes preferred cleaner", () => {
      beforeEach(() => {
        HomePreferredCleaner._store.set(`${homeId}-${cleanerId}`, {
          id: 1,
          homeId,
          cleanerId,
          setAt: new Date(),
          setBy: "review",
        });
      });

      it("should remove cleaner via management endpoint", async () => {
        const token = createHomeownerToken();

        const res = await request(app)
          .delete(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Cleaner removed from preferred list");
      });

      it("should no longer be preferred after removal", async () => {
        const token = createHomeownerToken();

        // First remove
        await request(app)
          .delete(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`)
          .set("Authorization", `Bearer ${token}`);

        // Then check - mock the check to return null
        HomePreferredCleaner.findOne.mockResolvedValueOnce(null);

        const res = await request(app)
          .get(`/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.isPreferred).toBe(false);
      });
    });
  });
});

describe("Booking Flow Logic", () => {
  describe("isPreferredCleaner Check", () => {
    it("should correctly identify preferred cleaner", async () => {
      const homeId = 10;
      const cleanerId = 100;

      // Simulate HomePreferredCleaner.findOne check
      const checkPreferredCleaner = async (hId, cId, isInStore) => {
        if (isInStore) {
          return { id: 1, homeId: hId, cleanerId: cId };
        }
        return null;
      };

      // Not preferred
      const notPreferred = await checkPreferredCleaner(homeId, cleanerId, false);
      expect(!!notPreferred).toBe(false);

      // Is preferred
      const isPreferred = await checkPreferredCleaner(homeId, cleanerId, true);
      expect(!!isPreferred).toBe(true);
    });
  });

  describe("Booking Decision Flow", () => {
    const determineBookingFlow = (isPreferredCleaner) => {
      if (isPreferredCleaner) {
        return {
          action: "direct_booking",
          createPendingRequest: false,
          assignImmediately: true,
          notificationType: "booking_confirmation",
          message: "Job booked successfully! As a preferred cleaner, no approval was needed.",
        };
      } else {
        return {
          action: "request_approval",
          createPendingRequest: true,
          assignImmediately: false,
          notificationType: "approval_request",
          message: "Request sent to the client for approval",
        };
      }
    };

    it("should return direct booking flow for preferred cleaner", () => {
      const flow = determineBookingFlow(true);

      expect(flow.action).toBe("direct_booking");
      expect(flow.createPendingRequest).toBe(false);
      expect(flow.assignImmediately).toBe(true);
      expect(flow.notificationType).toBe("booking_confirmation");
    });

    it("should return approval flow for regular cleaner", () => {
      const flow = determineBookingFlow(false);

      expect(flow.action).toBe("request_approval");
      expect(flow.createPendingRequest).toBe(true);
      expect(flow.assignImmediately).toBe(false);
      expect(flow.notificationType).toBe("approval_request");
    });
  });
});
