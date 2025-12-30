const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

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
    findOne: jest.fn(),
  },
}));

const { User, UserAppointments, UserHomes, UserReviews } = require("../../models");

describe("Archived Appointments Endpoint", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeAll(() => {
    process.env.SESSION_SECRET = secretKey;

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
    });

    it("should return archived appointments with reviews for authenticated user", async () => {
      const token = generateToken(1);

      // Mock user's homes
      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [{ id: 10 }, { id: 20 }],
      });

      // Mock completed appointments
      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          price: "150.00",
          toJSON: function() { return this; },
        },
        {
          id: 101,
          homeId: 20,
          date: "2025-12-20",
          completed: true,
          employeesAssigned: ["6"],
          price: "200.00",
          toJSON: function() { return this; },
        },
      ]);

      // Mock review check - user has reviewed both
      UserReviews.findOne.mockResolvedValue({ id: 1 });

      // Mock home details
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

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAppointments).toBeDefined();
      expect(res.body.archivedAppointments).toHaveLength(2);
    });

    it("should only return completed appointments with client review", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [{ id: 10 }],
      });

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          toJSON: function() { return this; },
        },
      ]);

      // User has reviewed this appointment
      UserReviews.findOne.mockResolvedValue({ id: 1 });

      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        nickName: "Test Home",
      });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(UserReviews.findOne).toHaveBeenCalledWith({
        where: {
          appointmentId: 100,
          reviewerId: 1,
          reviewType: "homeowner_to_cleaner",
        },
      });
    });

    it("should filter out appointments without client review", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [{ id: 10 }],
      });

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          toJSON: function() { return this; },
        },
      ]);

      // User has NOT reviewed this appointment
      UserReviews.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAppointments).toHaveLength(0);
    });

    it("should include home details in response", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [{ id: 10 }],
      });

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          toJSON: function() { return this; },
        },
      ]);

      UserReviews.findOne.mockResolvedValue({ id: 1 });

      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        nickName: "Beach House",
        address: "123 Beach Rd",
        city: "Miami",
        state: "FL",
      });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAppointments[0].home).toBeDefined();
      expect(res.body.archivedAppointments[0].home.nickName).toBe("Beach House");
    });

    it("should return empty array when user has no homes", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [],
      });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAppointments).toEqual([]);
    });

    it("should return empty array when no completed appointments exist", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [{ id: 10 }],
      });

      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAppointments).toEqual([]);
    });

    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);

      User.findByPk.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
    });

    it("should sort appointments by date descending", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [{ id: 10 }],
      });

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 100,
          homeId: 10,
          date: "2025-12-20",
          completed: true,
          employeesAssigned: ["5"],
          toJSON: function() { return this; },
        },
        {
          id: 101,
          homeId: 10,
          date: "2025-12-25",
          completed: true,
          employeesAssigned: ["5"],
          toJSON: function() { return this; },
        },
      ]);

      UserReviews.findOne.mockResolvedValue({ id: 1 });
      UserHomes.findByPk.mockResolvedValue({ id: 10, nickName: "Home" });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Should be sorted newest first
      expect(UserAppointments.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [["date", "DESC"]],
        })
      );
    });
  });

  describe("Route ordering - /archived before /:homeId", () => {
    it("should not treat 'archived' as a homeId parameter", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({
        id: 1,
        homes: [],
      });

      const res = await request(app)
        .get("/api/v1/appointments/archived")
        .set("Authorization", `Bearer ${token}`);

      // Should return 200, not route to /:homeId handler
      expect(res.status).toBe(200);
      expect(res.body.archivedAppointments).toBeDefined();
    });
  });
});
