const request = require("supertest");
const express = require("express");

// Mock models
jest.mock("../../models", () => ({
  UserAppointments: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  UserHomes: {},
  User: {
    findByPk: jest.fn(),
  },
  Payout: {},
  CleanerClient: {
    count: jest.fn(),
  },
  EmployeeJobAssignment: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  BusinessEmployee: {},
  sequelize: {},
}));

// Mock services
jest.mock("../../services/BusinessEmployeeService", () => ({
  getEmployeeStats: jest.fn(),
  getEmployeesByBusinessOwner: jest.fn(),
}));

jest.mock("../../services/PayCalculatorService", () => ({
  getFinancialSummary: jest.fn(),
}));

jest.mock("../../services/EmployeeJobAssignmentService", () => ({
  getUpcomingAssignments: jest.fn(),
  getUnpaidAssignments: jest.fn(),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendPaymentReminder: jest.fn(),
}));

// Mock middleware
jest.mock("../../middleware/verifyBusinessOwner", () => (req, res, next) => {
  req.businessOwnerId = 100;
  next();
});

const { UserAppointments, User, CleanerClient, EmployeeJobAssignment } = require("../../models");
const BusinessEmployeeService = require("../../services/BusinessEmployeeService");
const PayCalculatorService = require("../../services/PayCalculatorService");
const EmployeeJobAssignmentService = require("../../services/EmployeeJobAssignmentService");
const Email = require("../../services/sendNotifications/EmailClass");

// Create express app with router
const app = express();
app.use(express.json());
const businessOwnerRouter = require("../../routes/api/v1/businessOwnerRouter");
app.use("/api/v1/business-owner", businessOwnerRouter);

describe("Business Owner Profile Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================
  // Dashboard Endpoint Tests
  // =====================
  describe("GET /api/v1/business-owner/dashboard", () => {
    const mockEmployeeStats = {
      totalEmployees: 5,
      activeEmployees: 4,
    };

    const mockFinancials = {
      totalRevenue: 5000,
      totalPayroll: 2000,
    };

    const mockUpcomingAssignments = [
      {
        id: 1,
        appointmentId: 101,
        status: "assigned",
        appointment: {
          date: "2024-02-06",
          paymentStatus: "pending",
          home: {
            address: "123 Main St",
            user: { firstName: "John", lastName: "Doe" },
          },
        },
        employee: { id: 1, firstName: "Jane", lastName: "Smith" },
      },
      {
        id: 2,
        appointmentId: 102,
        status: "completed",
        appointment: {
          date: "2024-02-06",
          paymentStatus: "paid",
          home: {
            address: "456 Oak Ave",
            user: { firstName: "Bob", lastName: "Johnson" },
          },
        },
        employee: { id: 2, firstName: "Mike", lastName: "Brown" },
      },
    ];

    const mockUnpaidAssignments = [
      { id: 1, payAmount: 100 },
      { id: 2, payAmount: 150 },
    ];

    beforeEach(() => {
      BusinessEmployeeService.getEmployeeStats.mockResolvedValue(mockEmployeeStats);
      BusinessEmployeeService.getEmployeesByBusinessOwner.mockResolvedValue([
        { id: 1, firstName: "Jane", lastName: "Smith", status: "active" },
        { id: 2, firstName: "Mike", lastName: "Brown", status: "active" },
      ]);
      PayCalculatorService.getFinancialSummary.mockResolvedValue(mockFinancials);
      EmployeeJobAssignmentService.getUpcomingAssignments.mockResolvedValue(mockUpcomingAssignments);
      EmployeeJobAssignmentService.getUnpaidAssignments.mockResolvedValue(mockUnpaidAssignments);
      CleanerClient.count.mockResolvedValue(10);
      // Mock cancelled assignments query (for unassigned appointments)
      EmployeeJobAssignment.findAll.mockResolvedValue([]);
      // Mock unassigned appointments query
      UserAppointments.findAll.mockResolvedValue([]);
    });

    it("should return dashboard overview data", async () => {
      const res = await request(app).get("/api/v1/business-owner/dashboard");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("employeeStats");
      expect(res.body).toHaveProperty("financials");
      expect(res.body).toHaveProperty("upcomingJobCount");
      expect(res.body).toHaveProperty("unpaidPayrollCount");
      expect(res.body).toHaveProperty("unpaidPayrollTotal");
    });

    it("should return today's appointments with assignment info", async () => {
      const res = await request(app).get("/api/v1/business-owner/dashboard");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("todaysAppointments");
      expect(Array.isArray(res.body.todaysAppointments)).toBe(true);
    });

    it("should return total clients count", async () => {
      const res = await request(app).get("/api/v1/business-owner/dashboard");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalClients");
      expect(res.body.totalClients).toBe(10);
      expect(CleanerClient.count).toHaveBeenCalledWith({
        where: { cleanerId: 100, status: "active" },
      });
    });

    it("should return monthly and weekly revenue", async () => {
      const res = await request(app).get("/api/v1/business-owner/dashboard");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("monthlyRevenue");
      expect(res.body).toHaveProperty("weeklyRevenue");
    });

    it("should calculate unpaid payroll total correctly", async () => {
      const res = await request(app).get("/api/v1/business-owner/dashboard");

      expect(res.status).toBe(200);
      expect(res.body.unpaidPayrollTotal).toBe(250); // 100 + 150
      expect(res.body.unpaidPayrollCount).toBe(2);
    });

    it("should count unpaid appointments", async () => {
      const res = await request(app).get("/api/v1/business-owner/dashboard");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("unpaidAppointments");
      // One appointment has paymentStatus: "pending", one has "paid"
      expect(res.body.unpaidAppointments).toBe(1);
    });

    it("should handle errors gracefully", async () => {
      BusinessEmployeeService.getEmployeeStats.mockRejectedValue(new Error("Database error"));

      const res = await request(app).get("/api/v1/business-owner/dashboard");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    });
  });

  // =====================
  // Client Payments Endpoint Tests
  // =====================
  describe("GET /api/v1/business-owner/client-payments", () => {
    const mockUnpaidAppointments = [
      {
        id: 1,
        date: "2024-02-01",
        price: 150,
        paymentStatus: "pending",
        home: {
          address: "123 Main St",
          user: {
            id: 10,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
        },
      },
      {
        id: 2,
        date: "2024-01-25",
        price: 200,
        paymentStatus: "pending",
        home: {
          address: "456 Oak Ave",
          user: {
            id: 11,
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
        },
      },
    ];

    beforeEach(() => {
      UserAppointments.findAll.mockResolvedValue(mockUnpaidAppointments);
    });

    it("should return unpaid client appointments", async () => {
      const res = await request(app).get("/api/v1/business-owner/client-payments");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("unpaidAppointments");
      expect(Array.isArray(res.body.unpaidAppointments)).toBe(true);
      expect(res.body.unpaidAppointments.length).toBe(2);
    });

    it("should return total unpaid amount", async () => {
      const res = await request(app).get("/api/v1/business-owner/client-payments");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalUnpaid");
      expect(res.body.totalUnpaid).toBe(350); // 150 + 200
    });

    it("should include client name in response", async () => {
      const res = await request(app).get("/api/v1/business-owner/client-payments");

      expect(res.status).toBe(200);
      expect(res.body.unpaidAppointments[0]).toHaveProperty("clientName");
      expect(res.body.unpaidAppointments[0].clientName).toBe("John Doe");
    });

    it("should include client email in response", async () => {
      const res = await request(app).get("/api/v1/business-owner/client-payments");

      expect(res.status).toBe(200);
      expect(res.body.unpaidAppointments[0]).toHaveProperty("clientEmail");
      expect(res.body.unpaidAppointments[0].clientEmail).toBe("john@example.com");
    });

    it("should filter for completed appointments only", async () => {
      await request(app).get("/api/v1/business-owner/client-payments");

      expect(UserAppointments.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            completed: true,
            bookedByCleanerId: 100,
          }),
        })
      );
    });

    it("should handle empty results", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app).get("/api/v1/business-owner/client-payments");

      expect(res.status).toBe(200);
      expect(res.body.unpaidAppointments).toEqual([]);
      expect(res.body.totalUnpaid).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      UserAppointments.findAll.mockRejectedValue(new Error("Database error"));

      const res = await request(app).get("/api/v1/business-owner/client-payments");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    });
  });

  // =====================
  // Mark Appointment Paid Tests
  // =====================
  describe("POST /api/v1/business-owner/appointments/:id/mark-paid", () => {
    const mockAppointment = {
      id: 1,
      preferredCleanerId: 100,
      paymentStatus: "pending",
      update: jest.fn(),
    };

    beforeEach(() => {
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      mockAppointment.update.mockResolvedValue(mockAppointment);
    });

    it("should mark appointment as paid", async () => {
      const res = await request(app)
        .post("/api/v1/business-owner/appointments/1/mark-paid");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(mockAppointment.update).toHaveBeenCalledWith({
        paymentStatus: "paid",
        manuallyPaid: true,
      });
    });

    it("should verify appointment belongs to business owner", async () => {
      await request(app).post("/api/v1/business-owner/appointments/1/mark-paid");

      expect(UserAppointments.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
          bookedByCleanerId: 100,
        },
      });
    });

    it("should return 404 if appointment not found", async () => {
      UserAppointments.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/business-owner/appointments/999/mark-paid");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Appointment not found");
    });

    it("should return updated appointment in response", async () => {
      const res = await request(app)
        .post("/api/v1/business-owner/appointments/1/mark-paid");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("appointment");
    });

    it("should handle errors gracefully", async () => {
      UserAppointments.findOne.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .post("/api/v1/business-owner/appointments/1/mark-paid");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    });
  });

  // =====================
  // Send Payment Reminder Tests
  // =====================
  describe("POST /api/v1/business-owner/appointments/:id/send-reminder", () => {
    const mockAppointment = {
      id: 1,
      date: "2024-02-01",
      price: 150,
      preferredCleanerId: 100,
      home: {
        address: "123 Main St",
        user: {
          id: 10,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      },
    };

    const mockBusinessOwner = {
      id: 100,
      firstName: "Business",
      lastName: "Owner",
      businessName: "Clean Co",
    };

    beforeEach(() => {
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      User.findByPk.mockResolvedValue(mockBusinessOwner);
      Email.sendPaymentReminder.mockResolvedValue(true);
    });

    it("should send payment reminder email", async () => {
      const res = await request(app)
        .post("/api/v1/business-owner/appointments/1/send-reminder");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("message", "Payment reminder sent");
    });

    it("should call Email.sendPaymentReminder with correct params", async () => {
      await request(app)
        .post("/api/v1/business-owner/appointments/1/send-reminder");

      expect(Email.sendPaymentReminder).toHaveBeenCalledWith(
        "john@example.com",
        "John",
        "2024-02-01",
        150,
        "Clean Co"
      );
    });

    it("should return 404 if appointment not found", async () => {
      UserAppointments.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/business-owner/appointments/999/send-reminder");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Appointment not found");
    });

    it("should return 400 if client email not found", async () => {
      UserAppointments.findOne.mockResolvedValue({
        ...mockAppointment,
        home: {
          ...mockAppointment.home,
          user: { ...mockAppointment.home.user, email: null },
        },
      });

      const res = await request(app)
        .post("/api/v1/business-owner/appointments/1/send-reminder");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Client email not found");
    });

    it("should use business name in reminder if available", async () => {
      await request(app)
        .post("/api/v1/business-owner/appointments/1/send-reminder");

      expect(Email.sendPaymentReminder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        "Clean Co"
      );
    });

    it("should fallback to owner name if no business name", async () => {
      User.findByPk.mockResolvedValue({
        ...mockBusinessOwner,
        businessName: null,
      });

      await request(app)
        .post("/api/v1/business-owner/appointments/1/send-reminder");

      expect(Email.sendPaymentReminder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        "Business's Cleaning"
      );
    });

    it("should handle errors gracefully", async () => {
      Email.sendPaymentReminder.mockRejectedValue(new Error("Email error"));

      const res = await request(app)
        .post("/api/v1/business-owner/appointments/1/send-reminder");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    });
  });
});
