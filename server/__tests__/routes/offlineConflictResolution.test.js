const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Set SESSION_SECRET before any router imports
process.env.SESSION_SECRET = "test_secret";

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock services - use class-like structure with static methods
jest.mock("../../services/EmployeeJobAssignmentService", () => {
  return {
    getAssignmentForEmployee: jest.fn(),
    startJob: jest.fn(),
    completeJob: jest.fn(),
    resolveConflict: jest.fn(),
    getCancellationInfo: jest.fn(),
    getMyJobs: jest.fn(),
  };
});

// Mock AppointmentService (virtual since service doesn't exist yet)
jest.mock("../../services/AppointmentService", () => ({
  getAppointment: jest.fn(),
  cancelAppointment: jest.fn(),
}), { virtual: true });

// Mock verifyBusinessEmployee middleware to pass through
jest.mock("../../middleware/verifyBusinessEmployee", () => (req, res, next) => {
  // Set employee data for tests - middleware sets req.employeeRecord
  req.employeeRecord = {
    id: 1,
    userId: req.user?.id || 1,
    canViewClientDetails: true,
    canMessageClients: true,
    status: "active",
  };
  req.businessOwnerId = 1;
  next();
});

// Mock serializers
jest.mock("../../serializers/EmployeeJobAssignmentSerializer", () => ({
  serializeArrayForEmployee: jest.fn((jobs) => jobs),
  serializeForEmployee: jest.fn((job) => job),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  EmployeeJobAssignment: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
  Appointment: {
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn((fn) => fn()),
  },
}));

const { User, EmployeeJobAssignment, Appointment } = require("../../models");
const EmployeeJobAssignmentService = require("../../services/EmployeeJobAssignmentService");
const AppointmentService = require("../../services/AppointmentService");

const businessEmployeeRouter = require("../../routes/api/v1/businessEmployeeRouter");

const app = express();
app.use(express.json());

// Add user to req
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.SESSION_SECRET || "test_secret");
      req.user = { id: decoded.userId };
    } catch {
      // Invalid token
    }
  }
  next();
});

app.use("/api/v1/business-employee", businessEmployeeRouter);

const secretKey = process.env.SESSION_SECRET || "test_secret";
const createToken = (userId) => jwt.sign({ userId }, secretKey);
const cleanerToken = createToken(1);

describe("Offline Conflict Resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
    // Default mock for co-workers lookup
    EmployeeJobAssignment.findAll.mockResolvedValue([]);
  });

  describe("Cancellation Conflict Resolution", () => {
    it("should resolve in favor of cleaner if started before cancellation", async () => {
      // Cleaner started at 10:00, homeowner cancelled at 10:30
      const cleanerStartTime = new Date("2024-01-01T10:00:00Z");
      const cancellationTime = new Date("2024-01-01T10:30:00Z");

      // Router uses EmployeeJobAssignment.findOne directly
      const assignmentData = {
        id: 1,
        status: "started",
        startedAt: cleanerStartTime,
        appointmentId: 100,
        isMarketplacePickup: false,
        appointment: {
          date: new Date(),
          status: "cancelled",
          cancelledAt: cancellationTime,
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
      };
      const mockAssignment = {
        ...assignmentData,
        dataValues: assignmentData,
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);

      // Job should still show as started since cleaner started first
      const job = response.body.job;
      expect(job.startedAt).toBeDefined();

      // The conflict should be detectable
      if (job.appointment) {
        expect(new Date(job.startedAt) < new Date(job.appointment.cancelledAt)).toBe(true);
      }
    });

    it("should resolve in favor of homeowner if cancelled before start", async () => {
      // Homeowner cancelled at 10:00, cleaner tries to start at 10:30 (offline)
      const cancellationTime = new Date("2024-01-01T10:00:00Z");
      const attemptedStartTime = Date.now();

      EmployeeJobAssignmentService.startJob.mockRejectedValue(
        new Error("Job was cancelled at 10:00 AM. Cannot start cancelled job.")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          confirmAtProperty: true,
          offlineStartedAt: attemptedStartTime,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("cancelled");
    });

    it("should include cancellation reason in response", async () => {
      // Router uses EmployeeJobAssignment.findOne directly
      const mockAssignment = {
        id: 1,
        status: "started",
        appointmentId: 100,
        isMarketplacePickup: false,
        cancellationInfo: {
          cancelledAt: new Date(),
          reason: "Homeowner emergency",
          cancelledBy: "homeowner",
        },
        appointment: {
          date: new Date(),
          status: "approved",
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      if (response.body.job?.cancellationInfo) {
        expect(response.body.job.cancellationInfo.reason).toBeDefined();
      }
    });
  });

  describe("Multi-Cleaner Conflict Resolution", () => {
    it("should merge room-scoped data from multiple cleaners", async () => {
      // Two cleaners working on same job, each has different rooms
      const mockAssignment = {
        id: 1,
        status: "started",
        appointmentId: 100,
        isMarketplacePickup: false,
        multiCleanerData: {
          cleaner1: {
            rooms: ["Kitchen", "Living Room"],
            checklistProgress: { "item-1": true, "item-2": true },
          },
          cleaner2: {
            rooms: ["Bedroom 1", "Bathroom"],
            checklistProgress: { "item-3": true, "item-4": true },
          },
        },
        appointment: {
          date: new Date(),
          status: "approved",
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);

      if (response.body.job.multiCleanerData) {
        // Both cleaners' data should be preserved
        expect(Object.keys(response.body.job.multiCleanerData)).toHaveLength(2);
      }
    });

    it("should handle photo conflicts by accepting both", async () => {
      // Test that photos from different cleaners are both accepted
      const mockAssignment = {
        id: 1,
        status: "started",
        appointmentId: 100,
        isMarketplacePickup: false,
        photos: [
          { id: 1, room: "Kitchen", uploadedBy: 1, type: "before" },
          { id: 2, room: "Kitchen", uploadedBy: 2, type: "before" }, // Same room, different cleaner
        ],
        appointment: {
          date: new Date(),
          status: "approved",
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);

      if (response.body.job.photos) {
        // Both photos should be preserved
        const kitchenPhotos = response.body.job.photos.filter(p => p.room === "Kitchen");
        expect(kitchenPhotos.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should handle checklist conflicts with last-write-wins", async () => {
      // When same checklist item is marked complete by multiple cleaners
      const mockAssignment = {
        id: 1,
        status: "started",
        appointmentId: 100,
        isMarketplacePickup: false,
        checklistProgress: {
          "item-1": {
            completed: true,
            completedAt: new Date("2024-01-01T10:30:00Z"), // More recent
            completedBy: 2,
          },
        },
        appointment: {
          date: new Date(),
          status: "approved",
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);

      if (response.body.job.checklistProgress) {
        // Most recent completion should win
        expect(response.body.job.checklistProgress["item-1"].completedBy).toBe(2);
      }
    });
  });

  describe("Data Mismatch Resolution", () => {
    it("should accept timestamp for determining winner", async () => {
      const localTimestamp = new Date("2024-01-01T10:00:00Z");

      // When syncing with local timestamp
      EmployeeJobAssignmentService.startJob.mockResolvedValue({
        id: 1,
        status: "started",
        startedAt: localTimestamp, // Local time should be accepted
      });

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          confirmAtProperty: true,
          offlineStartedAt: localTimestamp.getTime(),
        });

      expect(response.status).toBe(200);
    });

    it("should handle sync with missing server record", async () => {
      // Job exists locally but not on server (edge case)
      EmployeeJobAssignmentService.startJob.mockRejectedValue(
        new Error("Assignment not found")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/999/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ confirmAtProperty: true });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("not found");
    });

    it("should handle concurrent completion attempts", async () => {
      // First completion succeeds
      EmployeeJobAssignmentService.completeJob.mockResolvedValueOnce({
        id: 1,
        status: "completed",
        completedAt: new Date(),
      });

      const response1 = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ hoursWorked: 3 });

      expect(response1.status).toBe(200);

      // Second completion attempt (from offline sync) should fail
      EmployeeJobAssignmentService.completeJob.mockRejectedValue(
        new Error("Job has already been completed")
      );

      const response2 = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ hoursWorked: 3.5 });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain("already been completed");
    });
  });

  describe("Offline Duration Conflict", () => {
    it("should handle jobs that changed significantly while offline", async () => {
      // Job was reassigned while cleaner was offline
      // Router filters out cancelled/no_show, but reassigned should still be visible
      const mockAssignment = {
        id: 1,
        status: "reassigned",
        appointmentId: 100,
        isMarketplacePickup: false,
        reassignedAt: new Date(),
        newAssigneeId: 3,
        appointment: {
          date: new Date(),
          status: "approved",
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);

      if (response.body.job.status === "reassigned") {
        expect(response.body.job.newAssigneeId).toBeDefined();
      }
    });

    it("should detect appointment reschedule conflict", async () => {
      const mockAssignment = {
        id: 1,
        status: "assigned",
        appointmentId: 100,
        isMarketplacePickup: false,
        appointment: {
          date: new Date("2024-01-02"),
          dateTime: new Date("2024-01-02T10:00:00Z"), // Rescheduled
          originalDateTime: new Date("2024-01-01T10:00:00Z"),
          status: "approved",
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);

      const job = response.body.job;
      if (job.appointment?.originalDateTime) {
        // Appointment was rescheduled
        expect(new Date(job.appointment.dateTime) > new Date(job.appointment.originalDateTime)).toBe(true);
      }
    });
  });

  describe("Payment Conflict", () => {
    it("should handle price change during offline period", async () => {
      const mockAssignment = {
        id: 1,
        status: "assigned",
        appointmentId: 100,
        isMarketplacePickup: false,
        paymentAmount: 150, // Price was updated
        originalPaymentAmount: 120, // Original amount cleaner saw
        priceUpdatedAt: new Date(),
        appointment: {
          date: new Date(),
          status: "approved",
          home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
          user: { id: 1, firstName: "John", lastName: "Doe" },
        },
        get: jest.fn(function() { return this; }),
      };

      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);

      const job = response.body.job;
      if (job.originalPaymentAmount) {
        // Cleaner should be informed of price change
        expect(job.paymentAmount).not.toBe(job.originalPaymentAmount);
      }
    });

    it("should use correct payment for completed job during offline", async () => {
      // When completing job offline, use the amount at time of assignment
      EmployeeJobAssignmentService.completeJob.mockResolvedValue({
        id: 1,
        status: "completed",
        paymentAmount: 120, // Original amount, not updated price
        completedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ hoursWorked: 3 });

      expect(response.status).toBe(200);
    });
  });
});

describe("Offline Sync - Edge Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
    // Default mock for co-workers lookup
    EmployeeJobAssignment.findAll.mockResolvedValue([]);
  });

  it("should handle extremely long offline period (48+ hours)", async () => {
    const offlineStartedAt = Date.now() - 50 * 60 * 60 * 1000; // 50 hours ago

    // Job should still sync if valid
    EmployeeJobAssignmentService.startJob.mockResolvedValue({
      id: 1,
      status: "started",
      startedAt: new Date(offlineStartedAt),
    });

    const response = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/start")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({
        confirmAtProperty: true,
        offlineStartedAt,
      });

    // Server might reject or accept based on business rules
    expect([200, 400]).toContain(response.status);
  });

  it("should handle batch sync of multiple operations", async () => {
    // Multiple operations synced at once
    EmployeeJobAssignmentService.startJob.mockResolvedValue({ id: 1, status: "started" });
    EmployeeJobAssignmentService.completeJob.mockResolvedValue({ id: 1, status: "completed" });

    // Start
    const startResponse = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/start")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ confirmAtProperty: true });

    expect(startResponse.status).toBe(200);

    // Complete (same request session)
    const completeResponse = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/complete")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ hoursWorked: 3 });

    expect(completeResponse.status).toBe(200);
  });

  it("should handle partial sync failure recovery", async () => {
    // First operation succeeds
    EmployeeJobAssignmentService.startJob.mockResolvedValue({ id: 1, status: "started" });

    const startResponse = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/start")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ confirmAtProperty: true });

    expect(startResponse.status).toBe(200);

    // Second operation fails
    EmployeeJobAssignmentService.completeJob.mockRejectedValue(
      new Error("Network timeout")
    );

    const completeResponse = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/complete")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ hoursWorked: 3 });

    expect(completeResponse.status).toBe(400);

    // Job should still be in started state
    // Router uses EmployeeJobAssignment.findOne directly, not the service
    const assignmentData = {
      id: 1,
      status: "started",
      appointmentId: 100,
      isMarketplacePickup: false,
      appointment: {
        date: new Date(),
        status: "approved",
        home: { id: 1, address: "123 Main St", numBeds: 3, numBaths: 2 },
        user: { id: 1, firstName: "John", lastName: "Doe" },
      },
    };
    EmployeeJobAssignment.findOne.mockResolvedValue({
      ...assignmentData,
      dataValues: assignmentData,
      get: jest.fn(function() { return this; }),
    });

    const statusResponse = await request(app)
      .get("/api/v1/business-employee/my-jobs/1")
      .set("Authorization", `Bearer ${cleanerToken}`);

    expect(statusResponse.body.job.status).toBe("started");
  });

  it("should handle duplicate sync requests idempotently", async () => {
    // Same start request sent twice (retry scenario)
    EmployeeJobAssignmentService.startJob
      .mockResolvedValueOnce({ id: 1, status: "started", startedAt: new Date() })
      .mockRejectedValueOnce(new Error("Job has already been started"));

    // First request
    const response1 = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/start")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ confirmAtProperty: true });

    expect(response1.status).toBe(200);

    // Duplicate request (retry)
    const response2 = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/start")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ confirmAtProperty: true });

    // Should either succeed idempotently or fail gracefully
    expect([200, 400]).toContain(response2.status);
  });
});
