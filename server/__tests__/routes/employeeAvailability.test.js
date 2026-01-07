const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock sequelize
const mockSequelize = {
  fn: jest.fn(),
  col: jest.fn(),
  Sequelize: {
    Op: {
      between: Symbol("between"),
      ne: Symbol("ne"),
      and: Symbol("and"),
    },
  },
  models: {
    UserAppointments: {},
  },
};

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  EmployeeJobAssignment: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  sequelize: mockSequelize,
}));

// Mock services
jest.mock("../../services/BusinessEmployeeService", () => ({
  getEmployeeById: jest.fn(),
  updateEmployee: jest.fn(),
  updateAvailability: jest.fn(),
  getAvailableEmployees: jest.fn(),
}));

const { User, BusinessEmployee, EmployeeJobAssignment } = require("../../models");
const BusinessEmployeeService = require("../../services/BusinessEmployeeService");

describe("Employee Availability Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const mockBusinessOwner = {
    id: 1,
    username: "businessowner",
    isBusinessOwner: true,
    employeeOfBusinessId: null,
  };

  const mockEmployee = {
    id: 10,
    businessOwnerId: 1,
    userId: 2,
    firstName: "Jane",
    lastName: "Employee",
    status: "active",
    availableSchedule: null,
    defaultJobTypes: null,
    maxJobsPerDay: null,
    toJSON: function() { return { ...this, toJSON: undefined }; },
  };

  const generateToken = (userId) => {
    return jwt.sign({ id: userId }, secretKey, { expiresIn: "1h" });
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const businessOwnerRouter = require("../../routes/api/v1/businessOwnerRouter");
    app.use("/api/v1/business-owner", businessOwnerRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PUT /employees/:employeeId/availability", () => {
    it("should update employee availability schedule", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const schedule = {
        monday: { available: true, start: "09:00", end: "17:00" },
        tuesday: { available: true, start: "09:00", end: "17:00" },
        wednesday: { available: false },
        thursday: { available: true, start: "10:00", end: "18:00" },
        friday: { available: true, start: "09:00", end: "15:00" },
        saturday: { available: false },
        sunday: { available: false },
      };

      BusinessEmployeeService.updateAvailability.mockResolvedValue({
        ...mockEmployee,
        availableSchedule: schedule,
      });

      BusinessEmployeeService.getEmployeeById.mockResolvedValue({
        ...mockEmployee,
        availableSchedule: schedule,
      });

      const res = await request(app)
        .put("/api/v1/business-owner/employees/10/availability")
        .set("Authorization", `Bearer ${token}`)
        .send({ schedule });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("updated");
      expect(BusinessEmployeeService.updateAvailability).toHaveBeenCalledWith(
        10,
        1,
        schedule
      );
    });

    it("should update default job types", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const defaultJobTypes = ["standard", "deep"];

      BusinessEmployeeService.updateEmployee.mockResolvedValue({
        ...mockEmployee,
        defaultJobTypes,
      });

      BusinessEmployeeService.getEmployeeById.mockResolvedValue({
        ...mockEmployee,
        defaultJobTypes,
      });

      const res = await request(app)
        .put("/api/v1/business-owner/employees/10/availability")
        .set("Authorization", `Bearer ${token}`)
        .send({ defaultJobTypes });

      expect(res.status).toBe(200);
      expect(BusinessEmployeeService.updateEmployee).toHaveBeenCalledWith(
        10,
        1,
        expect.objectContaining({ defaultJobTypes })
      );
    });

    it("should update max jobs per day", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      BusinessEmployeeService.updateEmployee.mockResolvedValue({
        ...mockEmployee,
        maxJobsPerDay: 3,
      });

      BusinessEmployeeService.getEmployeeById.mockResolvedValue({
        ...mockEmployee,
        maxJobsPerDay: 3,
      });

      const res = await request(app)
        .put("/api/v1/business-owner/employees/10/availability")
        .set("Authorization", `Bearer ${token}`)
        .send({ maxJobsPerDay: 3 });

      expect(res.status).toBe(200);
      expect(BusinessEmployeeService.updateEmployee).toHaveBeenCalledWith(
        10,
        1,
        expect.objectContaining({ maxJobsPerDay: 3 })
      );
    });

    it("should update all availability settings at once", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const schedule = {
        monday: { available: true, start: "08:00", end: "16:00" },
        friday: { available: true, start: "08:00", end: "12:00" },
      };
      const defaultJobTypes = ["standard", "move_in"];
      const maxJobsPerDay = 4;

      BusinessEmployeeService.updateAvailability.mockResolvedValue({
        ...mockEmployee,
        availableSchedule: schedule,
      });

      BusinessEmployeeService.updateEmployee.mockResolvedValue({
        ...mockEmployee,
        defaultJobTypes,
        maxJobsPerDay,
      });

      BusinessEmployeeService.getEmployeeById.mockResolvedValue({
        ...mockEmployee,
        availableSchedule: schedule,
        defaultJobTypes,
        maxJobsPerDay,
      });

      const res = await request(app)
        .put("/api/v1/business-owner/employees/10/availability")
        .set("Authorization", `Bearer ${token}`)
        .send({ schedule, defaultJobTypes, maxJobsPerDay });

      expect(res.status).toBe(200);
      expect(BusinessEmployeeService.updateAvailability).toHaveBeenCalled();
      expect(BusinessEmployeeService.updateEmployee).toHaveBeenCalled();
    });

    it("should return 400 for invalid schedule format", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      BusinessEmployeeService.updateAvailability.mockRejectedValue(
        new Error("Invalid start time format for monday")
      );

      const res = await request(app)
        .put("/api/v1/business-owner/employees/10/availability")
        .set("Authorization", `Bearer ${token}`)
        .send({
          schedule: {
            monday: { available: true, start: "invalid", end: "17:00" },
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid");
    });

    it("should return 403 for non-business owner", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue({
        id: 2,
        isBusinessOwner: false,
      });

      const res = await request(app)
        .put("/api/v1/business-owner/employees/10/availability")
        .set("Authorization", `Bearer ${token}`)
        .send({ maxJobsPerDay: 2 });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /employees/available", () => {
    it("should return available employees for a specific date", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      BusinessEmployeeService.getAvailableEmployees.mockResolvedValue([
        {
          id: 10,
          firstName: "Jane",
          lastName: "Employee",
          availability: {
            isAvailable: true,
            canHandleType: true,
            currentJobCount: 1,
            maxJobsPerDay: 3,
            maxReached: false,
            reason: null,
          },
        },
        {
          id: 11,
          firstName: "Bob",
          lastName: "Worker",
          availability: {
            isAvailable: false,
            canHandleType: true,
            currentJobCount: 0,
            maxJobsPerDay: null,
            maxReached: false,
            reason: "Not available on this day/time",
          },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/business-owner/employees/available")
        .query({ date: "2024-01-15" })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(2);
      expect(res.body.employees[0].availability.isAvailable).toBe(true);
      expect(res.body.employees[1].availability.isAvailable).toBe(false);
    });

    it("should filter by start time", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      BusinessEmployeeService.getAvailableEmployees.mockResolvedValue([
        {
          id: 10,
          firstName: "Jane",
          lastName: "Employee",
          availability: {
            isAvailable: true,
            canHandleType: true,
            currentJobCount: 0,
            maxJobsPerDay: null,
            maxReached: false,
            reason: null,
          },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/business-owner/employees/available")
        .query({ date: "2024-01-15", startTime: "10:00" })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(BusinessEmployeeService.getAvailableEmployees).toHaveBeenCalledWith(
        1,
        "2024-01-15",
        "10:00",
        null
      );
    });

    it("should filter by job type", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      BusinessEmployeeService.getAvailableEmployees.mockResolvedValue([
        {
          id: 10,
          firstName: "Jane",
          lastName: "Employee",
          availability: {
            isAvailable: true,
            canHandleType: true,
            currentJobCount: 0,
            maxJobsPerDay: null,
            maxReached: false,
            reason: null,
          },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/business-owner/employees/available")
        .query({ date: "2024-01-15", jobType: "deep" })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(BusinessEmployeeService.getAvailableEmployees).toHaveBeenCalledWith(
        1,
        "2024-01-15",
        null,
        "deep"
      );
    });

    it("should return 400 if date is missing", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      const res = await request(app)
        .get("/api/v1/business-owner/employees/available")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Date is required");
    });

    it("should show employees at max capacity", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(mockBusinessOwner);

      BusinessEmployeeService.getAvailableEmployees.mockResolvedValue([
        {
          id: 10,
          firstName: "Jane",
          lastName: "Employee",
          availability: {
            isAvailable: true,
            canHandleType: true,
            currentJobCount: 3,
            maxJobsPerDay: 3,
            maxReached: true,
            reason: "Already has 3 job(s) on this day",
          },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/business-owner/employees/available")
        .query({ date: "2024-01-15" })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.employees[0].availability.maxReached).toBe(true);
      expect(res.body.employees[0].availability.reason).toContain("Already has");
    });
  });
});

describe("BusinessEmployee Model - Availability Methods", () => {
  // Test the model instance methods
  describe("isAvailableOn", () => {
    const createEmployee = (schedule) => ({
      availableSchedule: schedule,
      defaultJobTypes: null,
      isAvailableOn: function(dayOfWeek, startTime) {
        if (!this.availableSchedule) return true;
        const daySchedule = this.availableSchedule[dayOfWeek.toLowerCase()];
        if (!daySchedule) return true;
        if (!daySchedule.available) return false;

        if (startTime && daySchedule.start && daySchedule.end) {
          const jobTime = startTime.split(":").map(Number);
          const schedStart = daySchedule.start.split(":").map(Number);
          const schedEnd = daySchedule.end.split(":").map(Number);

          const jobMinutes = jobTime[0] * 60 + (jobTime[1] || 0);
          const startMinutes = schedStart[0] * 60 + (schedStart[1] || 0);
          const endMinutes = schedEnd[0] * 60 + (schedEnd[1] || 0);

          return jobMinutes >= startMinutes && jobMinutes <= endMinutes;
        }
        return daySchedule.available;
      },
    });

    it("should return true when no schedule is set", () => {
      const employee = createEmployee(null);
      expect(employee.isAvailableOn("monday", "10:00")).toBe(true);
    });

    it("should return true when day is not in schedule", () => {
      const employee = createEmployee({ tuesday: { available: true } });
      expect(employee.isAvailableOn("monday", "10:00")).toBe(true);
    });

    it("should return false when day is marked unavailable", () => {
      const employee = createEmployee({
        monday: { available: false },
      });
      expect(employee.isAvailableOn("monday", "10:00")).toBe(false);
    });

    it("should return true when time is within range", () => {
      const employee = createEmployee({
        monday: { available: true, start: "09:00", end: "17:00" },
      });
      expect(employee.isAvailableOn("monday", "10:00")).toBe(true);
      expect(employee.isAvailableOn("monday", "09:00")).toBe(true);
      expect(employee.isAvailableOn("monday", "17:00")).toBe(true);
    });

    it("should return false when time is outside range", () => {
      const employee = createEmployee({
        monday: { available: true, start: "09:00", end: "17:00" },
      });
      expect(employee.isAvailableOn("monday", "08:00")).toBe(false);
      expect(employee.isAvailableOn("monday", "18:00")).toBe(false);
    });

    it("should handle edge cases for time boundaries", () => {
      const employee = createEmployee({
        monday: { available: true, start: "08:30", end: "16:30" },
      });
      expect(employee.isAvailableOn("monday", "08:30")).toBe(true);
      expect(employee.isAvailableOn("monday", "08:29")).toBe(false);
      expect(employee.isAvailableOn("monday", "16:30")).toBe(true);
      expect(employee.isAvailableOn("monday", "16:31")).toBe(false);
    });
  });

  describe("canHandleJobType", () => {
    const createEmployee = (jobTypes) => ({
      defaultJobTypes: jobTypes,
      canHandleJobType: function(jobType) {
        if (!this.defaultJobTypes || this.defaultJobTypes.length === 0) return true;
        return this.defaultJobTypes.includes(jobType);
      },
    });

    it("should return true when no job types are set", () => {
      const employee = createEmployee(null);
      expect(employee.canHandleJobType("deep")).toBe(true);
    });

    it("should return true when job types array is empty", () => {
      const employee = createEmployee([]);
      expect(employee.canHandleJobType("deep")).toBe(true);
    });

    it("should return true when job type is in list", () => {
      const employee = createEmployee(["standard", "deep"]);
      expect(employee.canHandleJobType("standard")).toBe(true);
      expect(employee.canHandleJobType("deep")).toBe(true);
    });

    it("should return false when job type is not in list", () => {
      const employee = createEmployee(["standard"]);
      expect(employee.canHandleJobType("deep")).toBe(false);
      expect(employee.canHandleJobType("move_in")).toBe(false);
    });
  });
});
