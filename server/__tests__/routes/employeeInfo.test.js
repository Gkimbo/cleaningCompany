const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  UserHomes: {
    findOne: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  UserCleanerAppointments: {},
  UserBills: {},
  UserReviews: {},
  Op: {
    contains: Symbol("contains"),
  },
}));

jest.mock("../../services/HomeClass", () => ({
  getLatAndLong: jest.fn(),
}));

jest.mock("../../serializers/userSerializer", () => ({
  serializeOne: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    type: user.type,
    email: user.email,
    cleanerAppointments: [],
  })),
}));

jest.mock("../../serializers/AppointmentSerializer", () => ({
  serializeArray: jest.fn((appointments) => appointments),
}));

const { User, UserHomes, UserAppointments } = require("../../models");
const HomeClass = require("../../services/HomeClass");

const employeeInfoRouter = require("../../routes/api/v1/employeeInfoRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/employee", employeeInfoRouter);

describe("Employee Info Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const cleanerToken = jwt.sign({ userId: 2 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /", () => {
    it("should return employee info with appointments", async () => {
      User.findByPk.mockResolvedValue({
        dataValues: {
          id: 2,
          username: "cleaner1",
          type: "cleaner",
          cleanerAppointments: [
            { appointmentId: 100 },
            { appointmentId: 101 },
          ],
        },
      });
      UserAppointments.findAll.mockResolvedValue([
        { id: 100, date: "2025-01-20" },
        { id: 101, date: "2025-01-21" },
      ]);

      const response = await request(app)
        .get("/api/v1/employee")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.employee).toBeDefined();
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/employee")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });

  });

  describe("GET /home/:id", () => {
    it("should return home info by id", async () => {
      const mockHome = {
        id: 10,
        nickName: "Beach House",
        address: "123 Beach St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };
      UserHomes.findOne.mockResolvedValue(mockHome);

      const response = await request(app).get("/api/v1/employee/home/10");

      expect(response.status).toBe(200);
      expect(response.body.home).toEqual(mockHome);
    });

    it("should return null for non-existent home", async () => {
      UserHomes.findOne.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/employee/home/999");

      expect(response.status).toBe(200);
      expect(response.body.home).toBeNull();
    });

    it("should handle database error", async () => {
      UserHomes.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/v1/employee/home/10");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /home/LL/:id", () => {
    it("should return latitude and longitude for home", async () => {
      UserHomes.findOne.mockResolvedValue({
        id: 10,
        zipcode: "02101",
      });
      HomeClass.getLatAndLong.mockResolvedValue({
        latitude: 42.3601,
        longitude: -71.0589,
      });

      const response = await request(app).get("/api/v1/employee/home/LL/10");

      expect(response.status).toBe(200);
      expect(response.body.latitude).toBe(42.3601);
      expect(response.body.longitude).toBe(-71.0589);
    });

    it("should handle missing home", async () => {
      UserHomes.findOne.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/employee/home/LL/999");

      expect(response.status).toBe(401);
    });

    it("should handle geocoding error", async () => {
      UserHomes.findOne.mockResolvedValue({
        id: 10,
        zipcode: "02101",
      });
      HomeClass.getLatAndLong.mockRejectedValue(new Error("Geocoding failed"));

      const response = await request(app).get("/api/v1/employee/home/LL/10");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /employeeSchedule", () => {
    it("should return all cleaner employees", async () => {
      const mockEmployees = [
        { id: 2, username: "cleaner1", type: "cleaner", daysWorking: ["Monday", "Tuesday"] },
        { id: 3, username: "cleaner2", type: "cleaner", daysWorking: ["Wednesday", "Thursday"] },
      ];
      User.findAll.mockResolvedValue(mockEmployees);

      const response = await request(app).get("/api/v1/employee/employeeSchedule");

      expect(response.status).toBe(200);
      expect(response.body.employees).toHaveLength(2);
      expect(User.findAll).toHaveBeenCalledWith({
        where: { type: "cleaner" },
      });
    });

    it("should return empty array when no cleaners", async () => {
      User.findAll.mockResolvedValue([]);

      const response = await request(app).get("/api/v1/employee/employeeSchedule");

      expect(response.status).toBe(200);
      expect(response.body.employees).toHaveLength(0);
    });

    it("should handle database error", async () => {
      User.findAll.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/v1/employee/employeeSchedule");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /cleaner/:id", () => {
    it("should return cleaner profile with reviews", async () => {
      User.findByPk.mockResolvedValue({
        id: 2,
        username: "cleaner1",
        type: "cleaner",
        daysWorking: ["Monday", "Tuesday"],
        reviews: [
          { id: 1, review: 5, reviewComment: "Great!" },
          { id: 2, review: 4, reviewComment: "Good" },
        ],
        cleanerAppointments: [],
        createdAt: new Date("2024-01-01"),
      });
      UserAppointments.count.mockResolvedValue(25);

      const response = await request(app).get("/api/v1/employee/cleaner/2");

      expect(response.status).toBe(200);
      expect(response.body.cleaner.id).toBe(2);
      expect(response.body.cleaner.completedJobs).toBe(25);
      expect(response.body.cleaner.totalReviews).toBe(2);
    });

    it("should return 404 for non-existent cleaner", async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/employee/cleaner/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Cleaner not found");
    });

    it("should handle cleaner with no reviews", async () => {
      User.findByPk.mockResolvedValue({
        id: 2,
        username: "cleaner1",
        type: "cleaner",
        daysWorking: [],
        reviews: [],
        cleanerAppointments: [],
        createdAt: new Date("2024-01-01"),
      });
      UserAppointments.count.mockResolvedValue(0);

      const response = await request(app).get("/api/v1/employee/cleaner/2");

      expect(response.status).toBe(200);
      expect(response.body.cleaner.totalReviews).toBe(0);
      expect(response.body.cleaner.completedJobs).toBe(0);
    });

    it("should handle server error", async () => {
      User.findByPk.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/v1/employee/cleaner/2");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Server error");
    });
  });

  describe("POST /shifts", () => {
    it("should update cleaner shifts successfully", async () => {
      const mockUser = {
        id: 2,
        username: "cleaner1",
        daysWorking: [],
        update: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/v1/employee/shifts")
        .send({
          user: { token: cleanerToken },
          days: ["Monday", "Tuesday", "Wednesday"],
        });

      expect(response.status).toBe(201);
      expect(mockUser.update).toHaveBeenCalledWith({
        daysWorking: ["Monday", "Tuesday", "Wednesday"],
      });
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .post("/api/v1/employee/shifts")
        .send({
          user: { token: "invalid_token" },
          days: ["Monday"],
        });

      expect(response.status).toBe(401);
    });

    it("should handle empty days array", async () => {
      const mockUser = {
        id: 2,
        username: "cleaner1",
        daysWorking: ["Monday"],
        update: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/v1/employee/shifts")
        .send({
          user: { token: cleanerToken },
          days: [],
        });

      expect(response.status).toBe(201);
      expect(mockUser.update).toHaveBeenCalledWith({ daysWorking: [] });
    });

    it("should handle database error", async () => {
      User.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/v1/employee/shifts")
        .send({
          user: { token: cleanerToken },
          days: ["Monday"],
        });

      expect(response.status).toBe(401);
    });
  });
});
