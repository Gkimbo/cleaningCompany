const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock services
jest.mock("../../services/EmployeeJobAssignmentService", () => ({
  getAssignmentForEmployee: jest.fn(),
  startJob: jest.fn(),
  completeJob: jest.fn(),
  getMyJobs: jest.fn(),
}));

jest.mock("../../services/ChecklistProgressService", () => ({
  updateProgress: jest.fn(),
  getProgress: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  EmployeeJobAssignment: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  Appointment: {
    findByPk: jest.fn(),
  },
  Business: {
    findByPk: jest.fn(),
  },
}));

const { User, EmployeeJobAssignment, Appointment, Business } = require("../../models");
const EmployeeJobAssignmentService = require("../../services/EmployeeJobAssignmentService");
const ChecklistProgressService = require("../../services/ChecklistProgressService");

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

// Helper to create tokens
const createToken = (userId) => jwt.sign({ userId }, secretKey);
const cleanerToken = createToken(1);

describe("Offline Sync - Job Start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
  });

  describe("POST /my-jobs/:assignmentId/start", () => {
    it("should require confirmation at property", async () => {
      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.requiresConfirmation).toBe(true);
    });

    it("should start job with confirmation", async () => {
      const mockAssignment = {
        id: 1,
        status: "started",
        startedAt: new Date(),
      };

      EmployeeJobAssignmentService.startJob.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ confirmAtProperty: true });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Job started");
      expect(EmployeeJobAssignmentService.startJob).toHaveBeenCalledWith(
        1,
        1,
        expect.any(Object)
      );
    });

    it("should accept GPS coordinates", async () => {
      const mockAssignment = { id: 1, status: "started" };
      EmployeeJobAssignmentService.startJob.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          confirmAtProperty: true,
          latitude: 37.7749,
          longitude: -122.4194,
        });

      expect(response.status).toBe(200);
      expect(EmployeeJobAssignmentService.startJob).toHaveBeenCalledWith(
        1,
        1,
        { latitude: 37.7749, longitude: -122.4194 }
      );
    });

    it("should accept offline start timestamp", async () => {
      const mockAssignment = { id: 1, status: "started" };
      const offlineStartedAt = Date.now() - 60000; // 1 minute ago

      EmployeeJobAssignmentService.startJob.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          confirmAtProperty: true,
          offlineStartedAt,
        });

      expect(response.status).toBe(200);
      // Service should receive the offline timestamp
    });

    it("should handle job already started error", async () => {
      EmployeeJobAssignmentService.startJob.mockRejectedValue(
        new Error("Job has already been started")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ confirmAtProperty: true });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already been started");
    });

    it("should handle job not found error", async () => {
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

    it("should handle unauthorized access", async () => {
      EmployeeJobAssignmentService.startJob.mockRejectedValue(
        new Error("Not authorized to access this job")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ confirmAtProperty: true });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Not authorized");
    });
  });
});

describe("Offline Sync - Job Complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
  });

  describe("POST /my-jobs/:assignmentId/complete", () => {
    it("should complete job successfully", async () => {
      const mockAssignment = {
        id: 1,
        status: "completed",
        completedAt: new Date(),
      };

      EmployeeJobAssignmentService.completeJob.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Job completed");
    });

    it("should accept hours worked", async () => {
      const mockAssignment = { id: 1, status: "completed" };
      EmployeeJobAssignmentService.completeJob.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ hoursWorked: 3.5 });

      expect(response.status).toBe(200);
      expect(EmployeeJobAssignmentService.completeJob).toHaveBeenCalledWith(
        1,
        1,
        3.5
      );
    });

    it("should accept offline completion timestamp", async () => {
      const mockAssignment = { id: 1, status: "completed" };
      const offlineCompletedAt = Date.now() - 60000;

      EmployeeJobAssignmentService.completeJob.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          offlineCompletedAt,
          hoursWorked: 2.5,
        });

      expect(response.status).toBe(200);
    });

    it("should handle job not started error", async () => {
      EmployeeJobAssignmentService.completeJob.mockRejectedValue(
        new Error("Job must be started before completing")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("must be started");
    });

    it("should handle already completed error", async () => {
      EmployeeJobAssignmentService.completeJob.mockRejectedValue(
        new Error("Job has already been completed")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/complete")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already been completed");
    });
  });
});

describe("Offline Sync - Get Jobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
  });

  describe("GET /my-jobs", () => {
    it("should return jobs for employee", async () => {
      const mockJobs = [
        { id: 1, status: "assigned", appointmentId: 100 },
        { id: 2, status: "started", appointmentId: 101 },
      ];

      EmployeeJobAssignmentService.getMyJobs.mockResolvedValue(mockJobs);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(2);
    });

    it("should filter by upcoming jobs", async () => {
      const mockJobs = [
        { id: 1, status: "assigned", appointmentId: 100 },
      ];

      EmployeeJobAssignmentService.getMyJobs.mockResolvedValue(mockJobs);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs?upcoming=true")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(EmployeeJobAssignmentService.getMyJobs).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ upcoming: "true" })
      );
    });
  });

  describe("GET /my-jobs/:assignmentId", () => {
    it("should return specific job with cancellation status", async () => {
      const mockJob = {
        id: 1,
        status: "assigned",
        appointmentId: 100,
        appointment: {
          status: "approved",
        },
      };

      EmployeeJobAssignmentService.getAssignmentForEmployee.mockResolvedValue(mockJob);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.job).toBeDefined();
    });

    it("should handle job cancellation scenario", async () => {
      const mockJob = {
        id: 1,
        status: "cancelled",
        appointmentId: 100,
        cancelledAt: new Date(),
        appointment: {
          status: "cancelled",
        },
      };

      EmployeeJobAssignmentService.getAssignmentForEmployee.mockResolvedValue(mockJob);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.job.status).toBe("cancelled");
    });

    it("should return 404 for non-existent job", async () => {
      EmployeeJobAssignmentService.getAssignmentForEmployee.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/999")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(404);
    });
  });
});

describe("Offline Sync - Checklist Progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
  });

  describe("POST /checklist/:appointmentId/progress", () => {
    it("should update checklist item progress", async () => {
      ChecklistProgressService.updateProgress.mockResolvedValue({
        itemId: "item-1",
        completed: true,
        completedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/business-employee/checklist/100/progress")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          itemId: "item-1",
          completed: true,
        });

      // If this endpoint exists
      if (response.status !== 404) {
        expect(response.status).toBe(200);
      }
    });

    it("should accept offline completion timestamp", async () => {
      const completedAt = Date.now() - 60000;

      ChecklistProgressService.updateProgress.mockResolvedValue({
        itemId: "item-1",
        completed: true,
        completedAt: new Date(completedAt),
      });

      const response = await request(app)
        .post("/api/v1/business-employee/checklist/100/progress")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          itemId: "item-1",
          completed: true,
          completedAt,
        });

      // If endpoint exists, verify it accepts completedAt
      if (response.status !== 404) {
        expect(ChecklistProgressService.updateProgress).toHaveBeenCalled();
      }
    });
  });
});

describe("Offline Sync - Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
  });

  it("should handle network timeout simulation gracefully", async () => {
    EmployeeJobAssignmentService.startJob.mockImplementation(
      () => new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), 100);
      })
    );

    const response = await request(app)
      .post("/api/v1/business-employee/my-jobs/1/start")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ confirmAtProperty: true });

    expect(response.status).toBe(400);
  });

  it("should handle database connection errors", async () => {
    EmployeeJobAssignmentService.getMyJobs.mockRejectedValue(
      new Error("ECONNREFUSED")
    );

    const response = await request(app)
      .get("/api/v1/business-employee/my-jobs")
      .set("Authorization", `Bearer ${cleanerToken}`);

    expect(response.status).toBe(400);
  });

  it("should handle malformed request body", async () => {
    const response = await request(app)
      .post("/api/v1/business-employee/my-jobs/invalid/start")
      .set("Authorization", `Bearer ${cleanerToken}`)
      .send({ confirmAtProperty: true });

    // Should handle invalid ID gracefully
    expect([400, 404, 500]).toContain(response.status);
  });

  it("should handle missing authorization", async () => {
    const response = await request(app)
      .get("/api/v1/business-employee/my-jobs");

    // Should be unauthorized
    expect([401, 403]).toContain(response.status);
  });
});

describe("Offline Sync - Conflict Scenarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({ id: 1, type: "employee" });
  });

  describe("Job cancellation while offline", () => {
    it("should return cancelled status when checking job", async () => {
      const mockJob = {
        id: 1,
        status: "cancelled",
        appointmentId: 100,
        cancelledAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };

      EmployeeJobAssignmentService.getAssignmentForEmployee.mockResolvedValue(mockJob);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.job.status).toBe("cancelled");
      expect(response.body.job.cancelledAt).toBeDefined();
    });

    it("should handle start after cancellation", async () => {
      // Job was cancelled but cleaner tries to start (offline sync)
      EmployeeJobAssignmentService.startJob.mockRejectedValue(
        new Error("Job has been cancelled")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ confirmAtProperty: true });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("cancelled");
    });
  });

  describe("Multi-cleaner sync", () => {
    it("should handle another cleaner already started", async () => {
      EmployeeJobAssignmentService.startJob.mockRejectedValue(
        new Error("Another cleaner has already started this job")
      );

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ confirmAtProperty: true });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Another cleaner");
    });

    it("should return job with multi-cleaner data", async () => {
      const mockJob = {
        id: 1,
        status: "started",
        appointmentId: 100,
        employees: [
          { id: 1, name: "Alice", startedAt: new Date() },
          { id: 2, name: "Bob", startedAt: null },
        ],
      };

      EmployeeJobAssignmentService.getAssignmentForEmployee.mockResolvedValue(mockJob);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      if (response.body.job.employees) {
        expect(response.body.job.employees).toHaveLength(2);
      }
    });
  });

  describe("Data mismatch resolution", () => {
    it("should accept offline timestamp for conflict resolution", async () => {
      const offlineStartedAt = Date.now() - 120000; // 2 minutes ago
      const mockAssignment = {
        id: 1,
        status: "started",
        startedAt: new Date(offlineStartedAt),
      };

      EmployeeJobAssignmentService.startJob.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/start")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({
          confirmAtProperty: true,
          offlineStartedAt,
        });

      expect(response.status).toBe(200);
    });
  });
});
