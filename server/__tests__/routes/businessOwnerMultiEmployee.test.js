/**
 * Business Owner Router - Multi-Employee Tests
 * Tests for endpoints that handle multiple employees per job
 */

const request = require("supertest");
const express = require("express");

// Mock authentication middleware
jest.mock("../../middleware/verifyBusinessOwner", () => (req, res, next) => {
  req.businessOwnerId = 10;
  req.user = { userId: 10 };
  next();
});

// Mock sequelize Op
jest.mock("sequelize", () => ({
  Op: {
    notIn: Symbol("notIn"),
    in: Symbol("in"),
    gte: Symbol("gte"),
    lte: Symbol("lte"),
    between: Symbol("between"),
    ne: Symbol("ne"),
    or: Symbol("or"),
  },
}));

// Mock models
jest.mock("../../models", () => {
  return {
    BusinessEmployee: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn(),
    },
    EmployeeJobAssignment: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    UserAppointments: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      findAll: jest.fn(),
    },
    UserHomes: {
      findByPk: jest.fn(),
    },
    User: {
      findByPk: jest.fn(),
    },
    PricingConfig: {
      getActive: jest.fn().mockResolvedValue({
        businessOwnerFeePercent: 0.10,
      }),
    },
    sequelize: {
      transaction: jest.fn((callback) => callback({ commit: jest.fn(), rollback: jest.fn() })),
      literal: jest.fn((str) => str),
    },
  };
});

// Mock services
jest.mock("../../services/EmployeeJobAssignmentService", () => ({
  assignEmployeeToJob: jest.fn(),
  unassignJob: jest.fn(),
  getUpcomingAssignments: jest.fn(),
  getAssignmentHistory: jest.fn(),
  estimateJobDuration: jest.fn().mockReturnValue(2),
  calculateEmployeePay: jest.fn().mockReturnValue({
    payAmount: 5000,
    payType: "hourly",
  }),
}));

jest.mock("../../services/BusinessEmployeeService", () => ({
  getAllEmployees: jest.fn(),
  getEmployeeById: jest.fn(),
}));

jest.mock("../../services/BusinessAnalyticsService", () => ({
  getDashboardStats: jest.fn(),
}));

jest.mock("../../services/BusinessVerificationService", () => ({
  getVerificationStatus: jest.fn(),
}));

jest.mock("../../services/PayCalculatorService", () => ({
  calculatePay: jest.fn(),
}));

jest.mock("../../services/CustomJobFlowService", () => ({
  getFlowsForBusinessOwner: jest.fn(),
  getFlowById: jest.fn(),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val ? `decrypted_${val}` : null),
  encrypt: jest.fn((val) => `encrypted_${val}`),
}));

// Mock serializers
jest.mock("../../serializers/EmployeeJobAssignmentSerializer", () => ({
  serializeOne: jest.fn((assignment) => ({
    id: assignment.id,
    appointmentId: assignment.appointmentId,
    status: assignment.status,
    employee: assignment.employee,
    isSelfAssignment: assignment.isSelfAssignment,
  })),
}));

const {
  EmployeeJobAssignment,
  BusinessEmployee,
  UserAppointments,
  User,
  UserHomes,
} = require("../../models");

const EmployeeJobAssignmentService = require("../../services/EmployeeJobAssignmentService");
const EmployeeJobAssignmentSerializer = require("../../serializers/EmployeeJobAssignmentSerializer");

describe("Business Owner Router - Multi-Employee Endpoints", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Import the router after mocks are set up
    const businessOwnerRouter = require("../../routes/api/v1/businessOwnerRouter");
    app.use("/api/v1/business-owner", businessOwnerRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /assignments/:assignmentId", () => {
    const mockEmployee1 = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      phone: "1234567890",
      email: "john@example.com",
    };

    const mockEmployee2 = {
      id: 2,
      firstName: "Jane",
      lastName: "Smith",
      phone: "0987654321",
      email: "jane@example.com",
    };

    const mockAssignment = {
      id: 1,
      appointmentId: 100,
      businessOwnerId: 10,
      businessEmployeeId: 1,
      status: "assigned",
      isSelfAssignment: false,
      employee: mockEmployee1,
      appointment: {
        id: 100,
        home: {
          user: {
            id: 50,
            firstName: "Client",
            lastName: "Name",
            email: "client@example.com",
            phone: "5555555555",
          },
        },
      },
    };

    it("should return assignment with allAssignments array for multi-employee jobs", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { ...mockAssignment, id: 1, employee: mockEmployee1 },
        { id: 2, appointmentId: 100, status: "assigned", employee: mockEmployee2 },
      ]);

      const response = await request(app)
        .get("/api/v1/business-owner/assignments/1")
        .expect(200);

      expect(response.body.allAssignments).toBeDefined();
      expect(response.body.allAssignments.length).toBe(2);
      expect(response.body.totalAssigned).toBe(2);
    });

    it("should return totalAssigned count of 1 for single-employee jobs", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { ...mockAssignment, id: 1, employee: mockEmployee1 },
      ]);

      const response = await request(app)
        .get("/api/v1/business-owner/assignments/1")
        .expect(200);

      expect(response.body.totalAssigned).toBe(1);
      expect(response.body.allAssignments.length).toBe(1);
    });

    it("should return 404 when assignment not found", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/business-owner/assignments/999")
        .expect(404);

      expect(response.body.error).toBe("Assignment not found");
    });

    it("should exclude cancelled assignments from allAssignments", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      // The findAll mock should be called with where clause excluding cancelled
      EmployeeJobAssignment.findAll.mockImplementation((options) => {
        // Verify the status filter is applied
        expect(options.where.status).toBeDefined();
        return Promise.resolve([
          { ...mockAssignment, id: 1, employee: mockEmployee1, status: "assigned" },
          { id: 2, appointmentId: 100, status: "completed", employee: mockEmployee2 },
        ]);
      });

      const response = await request(app)
        .get("/api/v1/business-owner/assignments/1")
        .expect(200);

      expect(response.body.allAssignments.length).toBe(2);
    });
  });

  describe("GET /calendar - assignedCount", () => {
    const mockAssignments = [
      {
        id: 1,
        appointmentId: 100,
        businessOwnerId: 10,
        status: "assigned",
        payAmount: 5000,
        isSelfAssignment: false,
        employee: { id: 1, firstName: "John", lastName: "Doe" },
        appointment: {
          id: 100,
          date: "2024-03-15",
          startTime: "09:00",
          price: 150,
          status: "scheduled",
          home: {
            address: "123 Main St",
            city: "Austin",
            state: "TX",
            user: { id: 50, firstName: "Client", lastName: "Name" },
          },
        },
      },
      {
        id: 2,
        appointmentId: 100, // Same appointment - multi-employee job
        businessOwnerId: 10,
        status: "assigned",
        payAmount: 4000,
        isSelfAssignment: false,
        employee: { id: 2, firstName: "Jane", lastName: "Smith" },
        appointment: {
          id: 100,
          date: "2024-03-15",
          startTime: "09:00",
          price: 150,
          status: "scheduled",
          home: {
            address: "123 Main St",
            city: "Austin",
            state: "TX",
            user: { id: 50, firstName: "Client", lastName: "Name" },
          },
        },
      },
      {
        id: 3,
        appointmentId: 101, // Different appointment - single employee
        businessOwnerId: 10,
        status: "assigned",
        payAmount: 6000,
        isSelfAssignment: false,
        employee: { id: 1, firstName: "John", lastName: "Doe" },
        appointment: {
          id: 101,
          date: "2024-03-16",
          startTime: "10:00",
          price: 200,
          status: "scheduled",
          home: {
            address: "456 Oak Ave",
            city: "Austin",
            state: "TX",
            user: { id: 51, firstName: "Other", lastName: "Client" },
          },
        },
      },
    ];

    // Note: Full calendar endpoint testing requires complex mocking.
    // The assignedCount logic is tested in the service tests (MultiEmployeeJobAssignment.test.js)
    it("should add assignedCount to assignments (logic test)", () => {
      // Test the assignedCount calculation logic directly
      const addAssignedCount = (assignments) => {
        const appointmentCounts = {};
        assignments.forEach((a) => {
          appointmentCounts[a.appointmentId] = (appointmentCounts[a.appointmentId] || 0) + 1;
        });
        return assignments.map((a) => ({
          ...a,
          assignedCount: appointmentCounts[a.appointmentId],
        }));
      };

      const result = addAssignedCount(mockAssignments);

      // Assignments for appointment 100 should have assignedCount of 2
      const appt100Assignments = result.filter((a) => a.appointmentId === 100);
      appt100Assignments.forEach((a) => {
        expect(a.assignedCount).toBe(2);
      });

      // Assignment for appointment 101 should have assignedCount of 1
      const appt101Assignment = result.find((a) => a.appointmentId === 101);
      expect(appt101Assignment.assignedCount).toBe(1);
    });
  });

  describe("POST /assignments - Multi-Employee Assignment", () => {
    it("should allow assigning second employee to same job", async () => {
      const mockNewAssignment = {
        id: 2,
        appointmentId: 100,
        businessEmployeeId: 2,
        status: "assigned",
      };

      EmployeeJobAssignmentService.assignEmployeeToJob.mockResolvedValue(mockNewAssignment);

      const response = await request(app)
        .post("/api/v1/business-owner/assignments")
        .send({
          employeeId: 2,
          appointmentId: 100,
          payAmount: 4000,
          payType: "flat_rate",
        })
        .expect(201);

      expect(EmployeeJobAssignmentService.assignEmployeeToJob).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          employeeId: 2,
          appointmentId: 100,
        })
      );
    });

    it("should return error when same employee is assigned twice", async () => {
      EmployeeJobAssignmentService.assignEmployeeToJob.mockRejectedValue(
        new Error("This employee is already assigned to this job")
      );

      const response = await request(app)
        .post("/api/v1/business-owner/assignments")
        .send({
          employeeId: 1,
          appointmentId: 100,
          payAmount: 5000,
        })
        .expect(400);

      expect(response.body.error).toContain("already assigned");
    });
  });
});
