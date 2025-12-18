const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
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
  Message,
  Conversation,
} = require("../../models");
const { updateAllHomesServiceAreaStatus } = require("../../config/businessConfig");

const managerDashboardRouter = require("../../routes/api/v1/managerDashboardRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/manager", managerDashboardRouter);

describe("Manager Dashboard Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const managerToken = jwt.sign({ userId: 1 }, secretKey);
  const cleanerToken = jwt.sign({ userId: 2 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
    // Default manager user mock
    User.findByPk.mockResolvedValue({ id: 1, type: "manager" });
  });

  describe("Authentication", () => {
    it("should return 401 without authorization header", async () => {
      const response = await request(app).get("/api/v1/manager/quick-stats");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should return 403 for non-manager user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/manager/quick-stats")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Manager access required");
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/manager/quick-stats")
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
        .get("/api/v1/manager/financial-summary")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.current).toBeDefined();
      expect(response.body.monthly).toBeDefined();
    });

    it("should handle missing earnings data gracefully", async () => {
      PlatformEarnings.findOne.mockResolvedValue(null);
      PlatformEarnings.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/manager/financial-summary")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .get("/api/v1/manager/user-analytics")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totals).toBeDefined();
      expect(response.body.applications).toBeDefined();
      expect(response.body.active).toBeDefined();
      expect(response.body.growth).toBeDefined();
    });

    it("should include cleaner and homeowner counts", async () => {
      User.count.mockImplementation(async ({ where }) => {
        if (where?.type === "cleaner") return 15;
        if (where?.type === "manager" || where?.[require("sequelize").Op?.or]) return 2;
        return 20;
      });

      const response = await request(app)
        .get("/api/v1/manager/user-analytics")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .get("/api/v1/manager/appointments-analytics")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .get("/api/v1/manager/appointments-analytics")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .get("/api/v1/manager/messages-summary")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalMessages).toBeDefined();
      expect(response.body.recentConversations).toBeDefined();
    });

    it("should include unread count from support conversations", async () => {
      Conversation.count.mockResolvedValue(3);

      const response = await request(app)
        .get("/api/v1/manager/messages-summary")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .get("/api/v1/manager/quick-stats")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .get("/api/v1/manager/service-areas")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .post("/api/v1/manager/recheck-service-areas")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(5);
    });

    it("should handle recheck errors", async () => {
      updateAllHomesServiceAreaStatus.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/v1/manager/recheck-service-areas")
        .set("Authorization", `Bearer ${managerToken}`);

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
        .get("/api/v1/manager/homes-outside-service-area")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.homes).toHaveLength(1);
      expect(response.body.homes[0].city).toBe("Miami");
    });

    it("should return empty list when all homes in service area", async () => {
      UserHomes.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/manager/homes-outside-service-area")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.homes).toHaveLength(0);
    });
  });
});
