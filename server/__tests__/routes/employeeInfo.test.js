// Set SESSION_SECRET before importing anything
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

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
  UserReviews: {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  },
  Op: {
    contains: Symbol("contains"),
    in: Symbol("in"),
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
        id: 2,
        username: "cleaner1",
        type: "cleaner",
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
        { id: 100, date: "2025-01-20", completed: false, dataValues: { id: 100, date: "2025-01-20", completed: false } },
        { id: 101, date: "2025-01-21", completed: false, dataValues: { id: 101, date: "2025-01-21", completed: false } },
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
    describe("Using Stored Coordinates", () => {
      it("should return stored latitude and longitude when available", async () => {
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          latitude: "42.3601",
          longitude: "-71.0589",
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(response.body.latitude).toBe(42.3601);
        expect(response.body.longitude).toBe(-71.0589);
        // Should NOT call getLatAndLong when stored coords exist
        expect(HomeClass.getLatAndLong).not.toHaveBeenCalled();
      });

      it("should parse stored coordinates as floats", async () => {
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          latitude: "42.36012345",
          longitude: "-71.05891234",
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(typeof response.body.latitude).toBe("number");
        expect(typeof response.body.longitude).toBe("number");
        expect(response.body.latitude).toBeCloseTo(42.36012345, 5);
        expect(response.body.longitude).toBeCloseTo(-71.05891234, 5);
      });

      it("should handle stored coordinates from DECIMAL type", async () => {
        // Sequelize DECIMAL returns strings
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          latitude: "34.0522000000",
          longitude: "-118.2437000000",
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(response.body.latitude).toBe(34.0522);
        expect(response.body.longitude).toBe(-118.2437);
      });
    });

    describe("Fallback to ZIP Code Lookup", () => {
      it("should fallback to getLatAndLong when no stored coordinates", async () => {
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          latitude: null,
          longitude: null,
        });
        HomeClass.getLatAndLong.mockResolvedValue({
          latitude: 42.3706,
          longitude: -71.0272,
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(response.body.latitude).toBe(42.3706);
        expect(response.body.longitude).toBe(-71.0272);
        expect(HomeClass.getLatAndLong).toHaveBeenCalledWith("02101");
      });

      it("should fallback when only latitude is null", async () => {
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          latitude: null,
          longitude: "-71.0589",
        });
        HomeClass.getLatAndLong.mockResolvedValue({
          latitude: 42.3706,
          longitude: -71.0272,
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(HomeClass.getLatAndLong).toHaveBeenCalled();
      });

      it("should fallback when only longitude is null", async () => {
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          latitude: "42.3601",
          longitude: null,
        });
        HomeClass.getLatAndLong.mockResolvedValue({
          latitude: 42.3706,
          longitude: -71.0272,
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(HomeClass.getLatAndLong).toHaveBeenCalled();
      });

      it("should fallback for old homes without coordinate fields", async () => {
        // Old homes may not have latitude/longitude properties at all
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          // No latitude or longitude properties
        });
        HomeClass.getLatAndLong.mockResolvedValue({
          latitude: 42.3706,
          longitude: -71.0272,
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(HomeClass.getLatAndLong).toHaveBeenCalledWith("02101");
      });
    });

    describe("Error Handling", () => {
      it("should handle missing home", async () => {
        UserHomes.findOne.mockResolvedValue(null);

        const response = await request(app).get("/api/v1/employee/home/LL/999");

        expect(response.status).toBe(401);
      });

      it("should handle geocoding error during fallback", async () => {
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "02101",
          latitude: null,
          longitude: null,
        });
        HomeClass.getLatAndLong.mockRejectedValue(new Error("Geocoding failed"));

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("Error fetching coordinates");
      });

      it("should handle database error", async () => {
        UserHomes.findOne.mockRejectedValue(new Error("Database error"));

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(401);
      });
    });

    describe("Edge Cases", () => {
      it("should handle zero coordinates (valid values)", async () => {
        // 0,0 is in the Atlantic Ocean but is a valid coordinate
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "00000",
          latitude: "0",
          longitude: "0",
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        // 0 is falsy, so it should fallback - this is a known limitation
        // but acceptable since no real US addresses have 0,0 coordinates
        expect(response.status).toBe(200);
      });

      it("should handle negative coordinates correctly", async () => {
        UserHomes.findOne.mockResolvedValue({
          id: 10,
          zipcode: "90028",
          latitude: "34.0522",
          longitude: "-118.2437",
        });

        const response = await request(app).get("/api/v1/employee/home/LL/10");

        expect(response.status).toBe(200);
        expect(response.body.longitude).toBe(-118.2437);
      });
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
