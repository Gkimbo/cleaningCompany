const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  Payment: {
    count: jest.fn(),
  },
  PlatformEarnings: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  UserHomes: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  UserApplications: {
    count: jest.fn(),
  },
  UserBills: {
    findAll: jest.fn(),
  },
  UserReviews: {
    count: jest.fn(),
  },
  Message: {
    count: jest.fn(),
  },
  Conversation: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  sequelize: {
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    col: jest.fn((name) => ({ col: name })),
    literal: jest.fn((str) => ({ literal: str })),
  },
}));

jest.mock("../../config/businessConfig", () => ({
  businessConfig: {
    serviceAreas: {
      cities: ["Boston", "Cambridge"],
      states: ["MA"],
    },
  },
  updateAllHomesServiceAreaStatus: jest.fn(),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmail: jest.fn(),
}));

const {
  User,
  Payment,
  PlatformEarnings,
  UserAppointments,
  UserHomes,
  UserApplications,
  UserBills,
  UserReviews,
  Message,
  Conversation,
} = require("../../models");
const { updateAllHomesServiceAreaStatus } = require("../../config/businessConfig");

const ownerDashboardRouter = require("../../routes/api/v1/ownerDashboardRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/owner", ownerDashboardRouter);

describe("Owner Dashboard Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const ownerToken = jwt.sign({ userId: 1 }, secretKey);
  const cleanerToken = jwt.sign({ userId: 2 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
    // Default owner user mock
    User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
  });

  describe("Authentication", () => {
    it("should return 401 without authorization header", async () => {
      const response = await request(app).get("/api/v1/owner/quick-stats");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should return 403 for non-owner user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/owner/quick-stats")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Owner access required");
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/owner/quick-stats")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid token");
    });
  });

  describe("GET /financial-summary", () => {
    it("should return financial summary data", async () => {
      PlatformEarnings.findOne
        .mockResolvedValueOnce({ totalEarnings: 100000, netEarnings: 90000, transactionCount: 50 })
        .mockResolvedValueOnce({ earnings: 1000 })
        .mockResolvedValueOnce({ earnings: 5000 })
        .mockResolvedValueOnce({ earnings: 20000 })
        .mockResolvedValueOnce({ pending: 3000 });
      PlatformEarnings.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/owner/financial-summary")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.current).toBeDefined();
      expect(response.body.monthly).toBeDefined();
    });

    it("should handle missing earnings data gracefully", async () => {
      PlatformEarnings.findOne.mockResolvedValue(null);
      PlatformEarnings.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/owner/financial-summary")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.current.todayCents).toBe(0);
    });
  });

  describe("GET /user-analytics", () => {
    beforeEach(() => {
      User.count.mockResolvedValue(10);
      UserHomes.count.mockResolvedValue(5);
      UserApplications.count.mockResolvedValue(3);
      User.findAll.mockResolvedValue([]);
    });

    it("should return user analytics data", async () => {
      const response = await request(app)
        .get("/api/v1/owner/user-analytics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totals).toBeDefined();
      expect(response.body.applications).toBeDefined();
      expect(response.body.active).toBeDefined();
      expect(response.body.growth).toBeDefined();
    });

    it("should include cleaner and homeowner counts", async () => {
      User.count.mockImplementation(async ({ where }) => {
        if (where?.type === "cleaner") return 15;
        if (where?.type === "owner" || where?.[require("sequelize").Op?.or]) return 2;
        return 20;
      });

      const response = await request(app)
        .get("/api/v1/owner/user-analytics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totals.cleaners).toBeDefined();
    });
  });

  describe("GET /appointments-analytics", () => {
    beforeEach(() => {
      UserAppointments.count.mockResolvedValue(100);
      UserAppointments.findAll.mockResolvedValue([]);
    });

    it("should return appointment analytics", async () => {
      const response = await request(app)
        .get("/api/v1/owner/appointments-analytics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totals).toBeDefined();
      expect(response.body.monthly).toBeDefined();
    });

    it("should include total, completed, and upcoming counts", async () => {
      UserAppointments.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(15); // upcoming

      const response = await request(app)
        .get("/api/v1/owner/appointments-analytics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totals.total).toBe(100);
      expect(response.body.totals.completed).toBe(80);
      expect(response.body.totals.upcoming).toBe(15);
    });
  });

  describe("GET /messages-summary", () => {
    beforeEach(() => {
      Conversation.findAll.mockResolvedValue([]);
      Conversation.count.mockResolvedValue(5);
      Message.count.mockResolvedValue(100);
    });

    it("should return messages summary", async () => {
      const response = await request(app)
        .get("/api/v1/owner/messages-summary")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalMessages).toBeDefined();
      expect(response.body.recentConversations).toBeDefined();
    });

    it("should include unread count from support conversations", async () => {
      Conversation.count.mockResolvedValue(3);

      const response = await request(app)
        .get("/api/v1/owner/messages-summary")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.unreadCount).toBe(3);
    });
  });

  describe("GET /quick-stats", () => {
    beforeEach(() => {
      UserAppointments.count.mockResolvedValue(5);
      Payment.count.mockResolvedValue(2);
      User.count.mockResolvedValue(10);
    });

    it("should return quick stats", async () => {
      const response = await request(app)
        .get("/api/v1/owner/quick-stats")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.todaysAppointments).toBeDefined();
      expect(response.body.pendingPayments).toBeDefined();
      expect(response.body.newUsersThisWeek).toBeDefined();
      expect(response.body.completedThisWeek).toBeDefined();
    });
  });

  describe("GET /service-areas", () => {
    beforeEach(() => {
      UserHomes.count.mockResolvedValue(0);
    });

    it("should return service area config", async () => {
      UserHomes.count
        .mockResolvedValueOnce(2) // homes outside area
        .mockResolvedValueOnce(10); // total homes

      const response = await request(app)
        .get("/api/v1/owner/service-areas")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.config).toBeDefined();
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.homesOutsideArea).toBe(2);
    });
  });

  describe("POST /recheck-service-areas", () => {
    it("should trigger service area recheck", async () => {
      updateAllHomesServiceAreaStatus.mockResolvedValue({
        updated: 5,
        nowInArea: 3,
        nowOutOfArea: 2,
      });

      const response = await request(app)
        .post("/api/v1/owner/recheck-service-areas")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(5);
    });

    it("should handle recheck errors", async () => {
      updateAllHomesServiceAreaStatus.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/v1/owner/recheck-service-areas")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(500);
    });
  });

  describe("GET /homes-outside-service-area", () => {
    it("should return homes outside service area", async () => {
      UserHomes.findAll.mockResolvedValue([
        {
          id: 1,
          nickName: "Beach House",
          address: "123 Beach St",
          city: "Miami",
          state: "FL",
          zipcode: "33101",
          user: { id: 1, username: "john", email: "john@test.com" },
        },
      ]);

      const response = await request(app)
        .get("/api/v1/owner/homes-outside-service-area")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.homes).toHaveLength(1);
      expect(response.body.homes[0].city).toBe("Miami");
    });

    it("should return empty list when all homes in service area", async () => {
      UserHomes.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/owner/homes-outside-service-area")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.homes).toHaveLength(0);
    });
  });

  describe("GET /settings", () => {
    it("should return owner settings including notification email", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: "alerts@test.com",
        notifications: ["email", "phone"],
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .get("/api/v1/owner/settings")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe("owner@test.com");
      expect(response.body.notificationEmail).toBe("alerts@test.com");
      expect(response.body.effectiveNotificationEmail).toBe("alerts@test.com");
      expect(response.body.notifications).toEqual(["email", "phone"]);
    });

    it("should return main email as effective when notificationEmail is null", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: null,
        notifications: [],
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .get("/api/v1/owner/settings")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe("owner@test.com");
      expect(response.body.notificationEmail).toBeNull();
      expect(response.body.effectiveNotificationEmail).toBe("owner@test.com");
    });

    it("should require owner authentication", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/owner/settings")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Owner access required");
    });
  });

  describe("PUT /settings/notification-email", () => {
    it("should update notification email successfully", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: null,
        update: jest.fn().mockImplementation(function (data) {
          Object.assign(this, data);
          return Promise.resolve(this);
        }),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ notificationEmail: "alerts@test.com" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.notificationEmail).toBe("alerts@test.com");
      expect(response.body.effectiveNotificationEmail).toBe("alerts@test.com");
      expect(mockOwner.update).toHaveBeenCalledWith({
        notificationEmail: "alerts@test.com",
      });
    });

    it("should clear notification email when empty string provided", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: "alerts@test.com",
        update: jest.fn().mockImplementation(function (data) {
          Object.assign(this, data);
          return Promise.resolve(this);
        }),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ notificationEmail: "" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.notificationEmail).toBeNull();
      expect(response.body.effectiveNotificationEmail).toBe("owner@test.com");
      expect(mockOwner.update).toHaveBeenCalledWith({
        notificationEmail: null,
      });
    });

    it("should clear notification email when null provided", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: "alerts@test.com",
        update: jest.fn().mockImplementation(function (data) {
          Object.assign(this, data);
          return Promise.resolve(this);
        }),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ notificationEmail: null });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockOwner.update).toHaveBeenCalledWith({
        notificationEmail: null,
      });
    });

    it("should reject invalid email format", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: null,
        update: jest.fn(),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ notificationEmail: "invalid-email" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid email format");
      expect(mockOwner.update).not.toHaveBeenCalled();
    });

    it("should reject email without @ symbol", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: null,
        update: jest.fn(),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ notificationEmail: "notanemail.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid email format");
    });

    it("should trim whitespace from email", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: null,
        update: jest.fn().mockImplementation(function (data) {
          Object.assign(this, data);
          return Promise.resolve(this);
        }),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ notificationEmail: "  alerts@test.com  " });

      expect(response.status).toBe(200);
      expect(mockOwner.update).toHaveBeenCalledWith({
        notificationEmail: "alerts@test.com",
      });
    });

    it("should require owner authentication", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ notificationEmail: "alerts@test.com" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Owner access required");
    });

    it("should handle database errors gracefully", async () => {
      const mockOwner = {
        id: 1,
        type: "owner",
        email: "owner@test.com",
        notificationEmail: null,
        update: jest.fn().mockRejectedValue(new Error("Database error")),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .put("/api/v1/owner/settings/notification-email")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ notificationEmail: "alerts@test.com" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to update notification email");
    });
  });

  describe("GET /business-metrics", () => {
    beforeEach(() => {
      // Reset all mocks
      PlatformEarnings.findOne.mockReset();
      UserAppointments.findAll.mockReset();
      UserAppointments.count.mockReset();
      UserBills.findAll.mockReset();
      UserReviews.count.mockReset();
      User.findAll.mockReset();
      User.findOne.mockReset();
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
    });

    it("should return all business metrics", async () => {
      // Mock cost per booking data
      PlatformEarnings.findOne.mockResolvedValue({
        avgFee: 1500,
        totalFee: 150000,
        count: 100,
      });

      // Mock repeat booking rate data
      UserAppointments.findAll.mockResolvedValue([
        { userId: 1, bookingCount: 5 },
        { userId: 2, bookingCount: 1 },
        { userId: 3, bookingCount: 3 },
        { userId: 4, bookingCount: 1 },
      ]);

      // Mock churn data
      UserBills.findAll.mockResolvedValue([{ count: 5, totalFees: 12500 }]);
      UserReviews.count.mockResolvedValue(3);

      // Mock cleaner reliability data
      User.findAll.mockResolvedValue([
        { id: 10, username: "cleaner1", cleanerRating: 4.5 },
        { id: 11, username: "cleaner2", cleanerRating: 4.8 },
      ]);
      UserAppointments.count.mockResolvedValue(50);
      User.findOne.mockResolvedValue({ avgRating: 4.65 });

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.costPerBooking).toBeDefined();
      expect(response.body.repeatBookingRate).toBeDefined();
      expect(response.body.subscriptionRate).toBeDefined();
      expect(response.body.churn).toBeDefined();
      expect(response.body.cleanerReliability).toBeDefined();
    });

    it("should calculate cost per booking correctly", async () => {
      PlatformEarnings.findOne.mockResolvedValue({
        avgFee: 1250,
        totalFee: 125000,
        count: 100,
      });
      UserAppointments.findAll.mockResolvedValue([]);
      UserBills.findAll.mockResolvedValue([]);
      UserReviews.count.mockResolvedValue(0);
      User.findAll.mockResolvedValue([]);
      UserAppointments.count.mockResolvedValue(0);
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.costPerBooking.avgFeeCents).toBe(1250);
      expect(response.body.costPerBooking.totalFeeCents).toBe(125000);
      expect(response.body.costPerBooking.bookingCount).toBe(100);
    });

    it("should calculate repeat booking rate correctly", async () => {
      PlatformEarnings.findOne.mockResolvedValue(null);
      UserAppointments.findAll.mockResolvedValue([
        { userId: 1, bookingCount: 5 },
        { userId: 2, bookingCount: 1 },
        { userId: 3, bookingCount: 3 },
        { userId: 4, bookingCount: 1 },
        { userId: 5, bookingCount: 2 },
      ]);
      UserBills.findAll.mockResolvedValue([]);
      UserReviews.count.mockResolvedValue(0);
      User.findAll.mockResolvedValue([]);
      UserAppointments.count.mockResolvedValue(0);
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      // 3 repeat bookers (5, 3, 2 bookings) out of 5 total = 60%
      expect(response.body.repeatBookingRate.rate).toBe(60);
      expect(response.body.repeatBookingRate.repeatBookers).toBe(3);
      expect(response.body.repeatBookingRate.singleBookers).toBe(2);
      expect(response.body.repeatBookingRate.totalHomeowners).toBe(5);
    });

    it("should calculate subscription rate (customer loyalty) correctly", async () => {
      PlatformEarnings.findOne.mockResolvedValue(null);
      UserAppointments.findAll.mockResolvedValue([
        { userId: 1, bookingCount: 10 }, // frequent (5+)
        { userId: 2, bookingCount: 5 },  // frequent (5+)
        { userId: 3, bookingCount: 4 },  // regular (3-4)
        { userId: 4, bookingCount: 3 },  // regular (3-4)
        { userId: 5, bookingCount: 2 },  // occasional (1-2)
        { userId: 6, bookingCount: 1 },  // occasional (1-2)
      ]);
      UserBills.findAll.mockResolvedValue([]);
      UserReviews.count.mockResolvedValue(0);
      User.findAll.mockResolvedValue([]);
      UserAppointments.count.mockResolvedValue(0);
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      // 2 frequent bookers out of 6 = 33%
      expect(response.body.subscriptionRate.rate).toBe(33);
      expect(response.body.subscriptionRate.frequentBookers).toBe(2);
      expect(response.body.subscriptionRate.regularBookers).toBe(2);
      expect(response.body.subscriptionRate.occasionalBookers).toBe(2);
    });

    it("should calculate churn (cancellations) correctly", async () => {
      PlatformEarnings.findOne.mockResolvedValue(null);
      UserAppointments.findAll.mockResolvedValue([]);
      // cancellationFee is stored in dollars in the database (e.g., 10 users × $25 = $250)
      UserBills.findAll.mockResolvedValue([{ count: 10, totalFees: 250 }]);
      UserReviews.count
        .mockResolvedValueOnce(15) // total cleaner cancellations
        .mockResolvedValueOnce(3)  // last 30 days
        .mockResolvedValueOnce(8); // last 90 days
      User.findAll.mockResolvedValue([]);
      UserAppointments.count.mockResolvedValue(0);
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.churn.homeownerCancellations.usersWithCancellations).toBe(10);
      // totalFeeCents is converted from dollars (250 * 100 = 25000 cents)
      expect(response.body.churn.homeownerCancellations.totalFeeCents).toBe(25000);
      expect(response.body.churn.cleanerCancellations.total).toBe(15);
      expect(response.body.churn.cleanerCancellations.last30Days).toBe(3);
      expect(response.body.churn.cleanerCancellations.last90Days).toBe(8);
    });

    it("should calculate cleaner reliability correctly", async () => {
      PlatformEarnings.findOne.mockResolvedValue(null);
      UserAppointments.findAll.mockResolvedValue([]);
      UserBills.findAll.mockResolvedValue([]);
      UserReviews.count.mockResolvedValue(0);
      User.findAll.mockResolvedValue([
        { id: 10, username: "topCleaner", cleanerRating: 4.9 },
        { id: 11, username: "goodCleaner", cleanerRating: 4.5 },
      ]);
      UserAppointments.count
        .mockResolvedValueOnce(95)  // total completed
        .mockResolvedValueOnce(100) // total assigned
        .mockResolvedValueOnce(50)  // cleaner 1 completed
        .mockResolvedValueOnce(50)  // cleaner 1 assigned
        .mockResolvedValueOnce(45)  // cleaner 2 completed
        .mockResolvedValueOnce(50); // cleaner 2 assigned
      User.findOne.mockResolvedValue({ avgRating: 4.7 });

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cleanerReliability.overallCompletionRate).toBe(95);
      expect(response.body.cleanerReliability.avgRating).toBe(4.7);
      expect(response.body.cleanerReliability.totalCompleted).toBe(95);
      expect(response.body.cleanerReliability.totalAssigned).toBe(100);
      expect(response.body.cleanerReliability.cleanerStats).toBeDefined();
      expect(response.body.cleanerReliability.cleanerStats.length).toBe(2);
    });

    it("should handle empty data gracefully", async () => {
      PlatformEarnings.findOne.mockResolvedValue(null);
      UserAppointments.findAll.mockResolvedValue([]);
      UserBills.findAll.mockResolvedValue([]);
      UserReviews.count.mockResolvedValue(0);
      User.findAll.mockResolvedValue([]);
      UserAppointments.count.mockResolvedValue(0);
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.costPerBooking.avgFeeCents).toBe(0);
      expect(response.body.repeatBookingRate.rate).toBe(0);
      expect(response.body.subscriptionRate.rate).toBe(0);
      expect(response.body.cleanerReliability.overallCompletionRate).toBe(0);
    });

    it("should require owner authentication", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Owner access required");
    });

    it("should handle database errors gracefully", async () => {
      PlatformEarnings.findOne.mockRejectedValue(new Error("Database error"));
      UserAppointments.findAll.mockRejectedValue(new Error("Database error"));
      UserBills.findAll.mockRejectedValue(new Error("Database error"));
      UserReviews.count.mockRejectedValue(new Error("Database error"));
      User.findAll.mockRejectedValue(new Error("Database error"));
      UserAppointments.count.mockRejectedValue(new Error("Database error"));
      User.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/v1/owner/business-metrics")
        .set("Authorization", `Bearer ${ownerToken}`);

      // Should still return 200 with default values due to try-catch blocks
      expect(response.status).toBe(200);
      expect(response.body.costPerBooking).toBeDefined();
      expect(response.body.repeatBookingRate).toBeDefined();
    });
  });
});
