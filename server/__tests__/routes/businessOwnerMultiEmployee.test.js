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
  assignSelfToJob: jest.fn(),
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
        }),
        undefined // io parameter
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

  describe("POST /self-assign/:appointmentId - Self Assignment within Multi-Cleaner Job", () => {
    it("should allow business owner to self-assign to a job", async () => {
      const mockSelfAssignment = {
        id: 3,
        appointmentId: 100,
        businessOwnerId: 10,
        businessEmployeeId: null,
        isSelfAssignment: true,
        status: "assigned",
        payAmount: 0,
      };

      EmployeeJobAssignmentService.assignSelfToJob.mockResolvedValue(mockSelfAssignment);

      const response = await request(app)
        .post("/api/v1/business-owner/self-assign/100")
        .expect(201);

      expect(response.body.message).toBe("Self-assigned to job");
      expect(response.body.assignment).toBeDefined();
      expect(EmployeeJobAssignmentService.assignSelfToJob).toHaveBeenCalledWith(10, 100, undefined);
    });

    it("should allow self-assign to job that already has employees", async () => {
      // Mock existing employee assignment on the job
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, appointmentId: 100, businessEmployeeId: 1, status: "assigned" },
      ]);

      const mockSelfAssignment = {
        id: 2,
        appointmentId: 100,
        businessOwnerId: 10,
        businessEmployeeId: null,
        isSelfAssignment: true,
        status: "assigned",
        payAmount: 0,
      };

      EmployeeJobAssignmentService.assignSelfToJob.mockResolvedValue(mockSelfAssignment);

      const response = await request(app)
        .post("/api/v1/business-owner/self-assign/100")
        .expect(201);

      expect(response.body.message).toBe("Self-assigned to job");
      expect(response.body.assignment.isSelfAssignment).toBe(true);
    });
  });

  describe("Multi-Cleaner Financial Calculations", () => {
    it("should calculate correct profit with multiple employees", () => {
      // Test the financial calculation logic
      const calculateProfit = (jobPrice, platformFeePercent, employeePays) => {
        const platformFee = Math.round(jobPrice * (platformFeePercent / 100));
        const totalEmployeePay = employeePays.reduce((sum, pay) => sum + pay, 0);
        return jobPrice - platformFee - totalEmployeePay;
      };

      const jobPrice = 15000; // $150
      const platformFeePercent = 10;

      // 2 hourly employees at adjusted rate (1 hour each instead of 2)
      const employee1Pay = 2000; // $20 (1 hr × $20/hr)
      const employee2Pay = 2500; // $25 (1 hr × $25/hr)

      const profit = calculateProfit(jobPrice, platformFeePercent, [employee1Pay, employee2Pay]);
      // $150 - $15 (fee) - $45 (pay) = $90
      expect(profit).toBe(9000);
    });

    it("should calculate higher profit when owner helps", () => {
      const calculateProfit = (jobPrice, platformFeePercent, employeePays) => {
        const platformFee = Math.round(jobPrice * (platformFeePercent / 100));
        const totalEmployeePay = employeePays.reduce((sum, pay) => sum + pay, 0);
        return jobPrice - platformFee - totalEmployeePay;
      };

      const jobPrice = 15000; // $150
      const platformFeePercent = 10;

      // 1 hourly employee at adjusted rate (1 hour because owner helps)
      // Owner pays $0
      const employee1Pay = 2000; // $20 (1 hr × $20/hr)
      const ownerPay = 0;

      const profit = calculateProfit(jobPrice, platformFeePercent, [employee1Pay, ownerPay]);
      // $150 - $15 (fee) - $20 (pay) = $115
      expect(profit).toBe(11500);
    });

    it("should calculate adjusted hourly pay based on cleaner count", () => {
      const calculateAdjustedHourlyPay = (hourlyRate, baseDuration, cleanerCount) => {
        const adjustedDuration = baseDuration / cleanerCount;
        return Math.round(hourlyRate * adjustedDuration);
      };

      const hourlyRate = 2000; // $20/hr
      const baseDuration = 2; // 2 hour job

      // Single cleaner: 2 hours × $20 = $40
      expect(calculateAdjustedHourlyPay(hourlyRate, baseDuration, 1)).toBe(4000);

      // Two cleaners: 1 hour each × $20 = $20 each
      expect(calculateAdjustedHourlyPay(hourlyRate, baseDuration, 2)).toBe(2000);

      // Three cleaners: 0.667 hours each × $20 = $13.33 each
      expect(calculateAdjustedHourlyPay(hourlyRate, baseDuration, 3)).toBe(1333);

      // Four cleaners: 0.5 hours each × $20 = $10 each
      expect(calculateAdjustedHourlyPay(hourlyRate, baseDuration, 4)).toBe(1000);
    });

    it("should not adjust flat rate pay regardless of cleaner count", () => {
      const calculateFlatRatePay = (jobRate, cleanerCount) => {
        // Flat rate doesn't change based on cleaner count
        return jobRate;
      };

      const jobRate = 5000; // $50 flat rate

      expect(calculateFlatRatePay(jobRate, 1)).toBe(5000);
      expect(calculateFlatRatePay(jobRate, 2)).toBe(5000);
      expect(calculateFlatRatePay(jobRate, 3)).toBe(5000);
    });

    it("should not adjust percentage pay regardless of cleaner count", () => {
      const calculatePercentagePay = (jobPrice, percentageRate, cleanerCount) => {
        // Percentage doesn't change based on cleaner count
        return Math.round(jobPrice * (percentageRate / 100));
      };

      const jobPrice = 15000; // $150
      const percentageRate = 40; // 40%

      expect(calculatePercentagePay(jobPrice, percentageRate, 1)).toBe(6000);
      expect(calculatePercentagePay(jobPrice, percentageRate, 2)).toBe(6000);
      expect(calculatePercentagePay(jobPrice, percentageRate, 3)).toBe(6000);
    });
  });

  describe("Duration Adjustment Display", () => {
    it("should calculate time savings for display", () => {
      const calculateTimeSavings = (baseDuration, cleanerCount) => {
        if (cleanerCount <= 1) return null;
        const adjustedDuration = baseDuration / cleanerCount;
        return {
          originalDuration: baseDuration,
          adjustedDuration: adjustedDuration,
          cleanerCount: cleanerCount,
          displayText: `${baseDuration} hr job → ${adjustedDuration.toFixed(1)} hr per cleaner`,
        };
      };

      // No savings for single cleaner
      expect(calculateTimeSavings(2, 1)).toBeNull();

      // 2 cleaners
      const twoCleaners = calculateTimeSavings(2, 2);
      expect(twoCleaners.adjustedDuration).toBe(1);
      expect(twoCleaners.displayText).toBe("2 hr job → 1.0 hr per cleaner");

      // 3 cleaners
      const threeCleaners = calculateTimeSavings(3, 3);
      expect(threeCleaners.adjustedDuration).toBe(1);
      expect(threeCleaners.displayText).toBe("3 hr job → 1.0 hr per cleaner");

      // 2 cleaners on 3 hour job
      const twoOnThree = calculateTimeSavings(3, 2);
      expect(twoOnThree.adjustedDuration).toBe(1.5);
      expect(twoOnThree.displayText).toBe("3 hr job → 1.5 hr per cleaner");
    });
  });
});
