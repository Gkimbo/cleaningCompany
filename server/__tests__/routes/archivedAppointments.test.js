// Set SESSION_SECRET before importing anything
process.env.SESSION_SECRET = "test-secret-key";

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock sequelize Op
jest.mock("sequelize", () => {
  const actualSequelize = jest.requireActual("sequelize");
  return {
    ...actualSequelize,
    Op: {
      ...actualSequelize.Op,
      in: Symbol("in"),
    },
  };
});

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  UserReviews: {
    findAll: jest.fn(),
  },
  UserCleanerAppointments: {
    findAll: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
  UserPendingRequests: {
    findAll: jest.fn(),
  },
  Payout: {
    findAll: jest.fn(),
  },
  JobPhoto: {
    findAll: jest.fn(),
  },
  CalendarSync: {
    findOne: jest.fn(),
  },
  StripeConnectAccount: {
    findOne: jest.fn(),
  },
}));

// Mock serializers
jest.mock("../../serializers/AppointmentSerializer", () => ({
  serializeOne: jest.fn((apt) => ({
    id: apt.id,
    homeId: apt.homeId,
    date: apt.date,
    completed: apt.completed,
    employeesAssigned: apt.employeesAssigned,
    price: apt.price,
  })),
  serializeArray: jest.fn((apts) => apts.map((apt) => ({
    id: apt.id,
    homeId: apt.homeId,
    date: apt.date,
    completed: apt.completed,
  }))),
}));

jest.mock("../../serializers/homesSerializer", () => ({
  serializeOne: jest.fn((home) => ({
    id: home.id,
    nickName: home.nickName,
    address: home.address,
    city: home.city,
  })),
}));

// Mock other dependencies
jest.mock("../../services/UserInfoClass", () => ({}));
jest.mock("../../services/CalculatePrice", () => jest.fn());
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmail: jest.fn(),
}));
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn(),
}));
jest.mock("../../config/businessConfig", () => ({
  businessConfig: { pricing: {} },
  getPricingConfig: jest.fn().mockResolvedValue({}),
}));
jest.mock("stripe", () => jest.fn(() => ({
  paymentIntents: { create: jest.fn(), retrieve: jest.fn(), capture: jest.fn() },
})));

const { User, UserAppointments, UserHomes, UserReviews } = require("../../models");

describe("Archived Appointments Endpoint", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const appointmentsRouter = require("../../routes/api/v1/appointmentsRouter");
    app.use("/api/v1/appointments", appointmentsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /appointments/archived", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app).get("/api/v1/appointments/archived");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization token required");
    });

    it("should return archived appointments with reviews for authenticated user", async () => {
      const token = generateToken(1);

      // Mock completed appointments for user
      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          price: "150.00",
          userId: 1,
        },
        {
          id: 101,
          homeId: 20,
          date: "2025-12-20",
          completed: true,
          employeesAssigned: ["6"],
          price: "200.00",
          userId: 1,
        },
      ]);

      // Mock reviews - user has reviewed both
      UserReviews.findAll.mockResolvedValue([
        { id: 1, appointmentId: 100, reviewType: "homeowner_to_cleaner" },
        { id: 2, appointmentId: 101, reviewType: "homeowner_to_cleaner" },
      ]);

      // Mock home lookups
      UserHomes.findByPk
        .mockResolvedValueOnce({
          id: 10,
          nickName: "Beach House",
          address: "123 Beach Rd",
          city: "Miami",
        })
        .mockResolvedValueOnce({
          id: 20,
          nickName: "Mountain Cabin",
          address: "456 Mountain Rd",
          city: "Denver",
        });

      // Mock cleaner lookups
      User.findByPk
        .mockResolvedValueOnce({ id: 5, username: "cleaner1" })
        .mockResolvedValueOnce({ id: 6, username: "cleaner2" });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appointments).toBeDefined();
      expect(res.body.appointments).toHaveLength(2);
    });

    it("should only return appointments that have been reviewed", async () => {
      const token = generateToken(1);

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          userId: 1,
        },
        {
          id: 101,
          homeId: 10,
          date: "2025-12-20",
          completed: true,
          employeesAssigned: ["5"],
          userId: 1,
        },
      ]);

      // Only one appointment has been reviewed
      UserReviews.findAll.mockResolvedValue([
        { id: 1, appointmentId: 100, reviewType: "homeowner_to_cleaner" },
      ]);

      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        nickName: "Test Home",
      });

      User.findByPk.mockResolvedValue({ id: 5, username: "cleaner1" });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appointments).toHaveLength(1);
      expect(res.body.appointments[0].id).toBe(100);
    });

    it("should filter out appointments without client review", async () => {
      const token = generateToken(1);

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          userId: 1,
        },
      ]);

      // No reviews exist
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appointments).toHaveLength(0);
    });

    it("should include home details in response", async () => {
      const token = generateToken(1);

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          userId: 1,
        },
      ]);

      UserReviews.findAll.mockResolvedValue([
        { id: 1, appointmentId: 100, reviewType: "homeowner_to_cleaner" },
      ]);

      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        nickName: "Beach House",
        address: "123 Beach Rd",
        city: "Miami",
      });

      User.findByPk.mockResolvedValue({ id: 5, username: "cleaner1" });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appointments[0].home).toBeDefined();
      expect(res.body.appointments[0].home.nickName).toBe("Beach House");
    });

    it("should include cleaner name in response", async () => {
      const token = generateToken(1);

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          userId: 1,
        },
      ]);

      UserReviews.findAll.mockResolvedValue([
        { id: 1, appointmentId: 100, reviewType: "homeowner_to_cleaner" },
      ]);

      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        nickName: "Test Home",
      });

      User.findByPk.mockResolvedValue({ id: 5, username: "cleaner123" });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appointments[0].cleanerName).toBe("cleaner123");
    });

    it("should return empty array when no completed appointments exist", async () => {
      const token = generateToken(1);

      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.appointments).toEqual([]);
    });

    it("should query appointments sorted by date descending", async () => {
      const token = generateToken(1);

      UserAppointments.findAll.mockResolvedValue([]);

      await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(UserAppointments.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1, completed: true },
          order: [["date", "DESC"]],
        })
      );
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
    });
  });

  describe("Route ordering - /archived before /:homeId", () => {
    it("should not treat 'archived' as a homeId parameter", async () => {
      const token = generateToken(1);

      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      // Should return 200 with appointments array, not route to /:homeId handler
      expect(res.status).toBe(200);
      expect(res.body.appointments).toBeDefined();
    });
  });
});
