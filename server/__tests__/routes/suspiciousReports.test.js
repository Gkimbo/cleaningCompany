const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  SuspiciousActivityReport: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
  },
  Message: {},
  Conversation: {},
  UserAppointments: {},
  ConversationParticipant: {},
  Op: {
    in: Symbol("in"),
    gte: Symbol("gte"),
    gt: Symbol("gt"),
    ne: Symbol("ne"),
  },
}));

const {
  User,
  SuspiciousActivityReport,
} = require("../../models");

describe("Suspicious Reports Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock user
  const createMockUser = (overrides = {}) => ({
    id: 1,
    firstName: "HR",
    lastName: "Staff",
    username: "hrstaff",
    email: "hr@example.com",
    type: "humanResources",
    accountFrozen: false,
    warningCount: 0,
    ...overrides,
  });

  // Helper to create mock report
  const createMockReport = (overrides = {}) => ({
    id: 1,
    messageId: 100,
    messageContent: "Call me at 555-123-4567 for a discount!",
    suspiciousContentTypes: ["phone_number", "off_platform"],
    status: "pending",
    createdAt: new Date("2025-01-15"),
    reviewedAt: null,
    reviewNotes: null,
    appointmentId: 50,
    conversationId: 10,
    reporterId: 2,
    reportedUserId: 3,
    reviewedById: null,
    reporter: {
      id: 2,
      username: "client1",
      firstName: "John",
      lastName: "Client",
      type: "homeowner",
      accountFrozen: false,
      warningCount: 0,
    },
    reportedUser: {
      id: 3,
      username: "cleaner1",
      firstName: "Jane",
      lastName: "Cleaner",
      type: "cleaner",
      accountFrozen: false,
      warningCount: 0,
      update: jest.fn(),
    },
    reviewedBy: null,
    appointment: {
      id: 50,
      date: "2025-01-15",
      price: 15000,
    },
    conversation: {
      id: 10,
      conversationType: "appointment",
      title: "Cleaning on Jan 15",
    },
    message: {
      id: 100,
      content: "Call me at 555-123-4567 for a discount!",
      createdAt: new Date("2025-01-15"),
    },
    update: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const suspiciousReportsRouter = require("../../routes/api/v1/suspiciousReportsRouter");
    app.use("/api/v1/suspicious-reports", suspiciousReportsRouter);
  });

  describe("GET /", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/suspicious-reports");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "homeowner" }));

      const res = await request(app)
        .get("/api/v1/suspicious-reports")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("HR or Owner access required");
    });

    it("should return reports for HR user", async () => {
      const token = generateToken(1);
      const mockReports = [
        createMockReport({ id: 1 }),
        createMockReport({ id: 2, status: "reviewed" }),
      ];

      User.findByPk.mockResolvedValue(createMockUser({ type: "humanResources" }));
      SuspiciousActivityReport.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockReports,
      });

      const res = await request(app)
        .get("/api/v1/suspicious-reports")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("reports");
      expect(res.body.reports).toHaveLength(2);
      expect(res.body).toHaveProperty("pagination");
    });

    it("should return reports for owner user", async () => {
      const token = generateToken(1);
      const mockReports = [createMockReport()];

      User.findByPk.mockResolvedValue(createMockUser({ type: "owner" }));
      SuspiciousActivityReport.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockReports,
      });

      const res = await request(app)
        .get("/api/v1/suspicious-reports")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.reports).toHaveLength(1);
    });

    it("should filter by status when provided", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [createMockReport({ status: "pending" })],
      });

      const res = await request(app)
        .get("/api/v1/suspicious-reports?status=pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(SuspiciousActivityReport.findAndCountAll).toHaveBeenCalled();
    });

    it("should return empty array when no reports exist", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      const res = await request(app)
        .get("/api/v1/suspicious-reports")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.reports).toHaveLength(0);
    });

    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findAndCountAll.mockRejectedValue(new Error("DB error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/v1/suspicious-reports")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch reports");

      consoleSpy.mockRestore();
    });
  });

  describe("GET /stats", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/suspicious-reports/stats");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "cleaner" }));

      const res = await request(app)
        .get("/api/v1/suspicious-reports/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return stats for HR user", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.count
        .mockResolvedValueOnce(5)   // pending
        .mockResolvedValueOnce(10)  // reviewed
        .mockResolvedValueOnce(3)   // dismissed
        .mockResolvedValueOnce(2)   // action_taken
        .mockResolvedValueOnce(8);  // resolved this week
      User.count
        .mockResolvedValueOnce(4)   // warned users
        .mockResolvedValueOnce(1);  // suspended users

      const res = await request(app)
        .get("/api/v1/suspicious-reports/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("pending", 5);
      expect(res.body).toHaveProperty("reviewed", 10);
      expect(res.body).toHaveProperty("dismissed", 3);
      expect(res.body).toHaveProperty("actionTaken", 2);
      expect(res.body).toHaveProperty("resolvedThisWeek", 8);
      expect(res.body).toHaveProperty("warnedUsers", 4);
      expect(res.body).toHaveProperty("suspendedUsers", 1);
    });

    it("should return zeros when no data exists", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.count.mockResolvedValue(0);
      User.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/v1/suspicious-reports/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pending).toBe(0);
      expect(res.body.reviewed).toBe(0);
      expect(res.body.warnedUsers).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.count.mockRejectedValue(new Error("DB error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/v1/suspicious-reports/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch stats");

      consoleSpy.mockRestore();
    });
  });

  describe("GET /:id", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/suspicious-reports/1");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "homeowner" }));

      const res = await request(app)
        .get("/api/v1/suspicious-reports/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return report details for HR user", async () => {
      const token = generateToken(1);
      const mockReport = createMockReport();

      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findByPk.mockResolvedValue(mockReport);
      SuspiciousActivityReport.findAll.mockResolvedValue([]); // previous reports

      const res = await request(app)
        .get("/api/v1/suspicious-reports/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("report");
      expect(res.body.report.id).toBe(1);
      expect(res.body.report.messageContent).toBe("Call me at 555-123-4567 for a discount!");
      expect(res.body.report.reporter).toBeDefined();
      expect(res.body.report.reportedUser).toBeDefined();
      expect(res.body.report).toHaveProperty("previousReports");
    });

    it("should return 404 when report not found", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/suspicious-reports/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Report not found");
    });

    it("should include previous reports for repeat offenders", async () => {
      const token = generateToken(1);
      const mockReport = createMockReport();
      const previousReports = [
        createMockReport({ id: 2, status: "reviewed", reviewedAt: new Date() }),
        createMockReport({ id: 3, status: "action_taken", reviewedAt: new Date() }),
      ];

      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findByPk.mockResolvedValue(mockReport);
      SuspiciousActivityReport.findAll.mockResolvedValue(previousReports);

      const res = await request(app)
        .get("/api/v1/suspicious-reports/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.report.previousReports).toHaveLength(2);
    });
  });

  describe("GET /user/:userId/history", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/suspicious-reports/user/3/history");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "cleaner" }));

      const res = await request(app)
        .get("/api/v1/suspicious-reports/user/3/history")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return user report history for HR user", async () => {
      const token = generateToken(1);
      const mockUser = createMockUser({ id: 3, type: "cleaner", warningCount: 2 });
      const mockReports = [
        createMockReport({ id: 1 }),
        createMockReport({ id: 2, status: "reviewed" }),
      ];

      // First call for HR verification, subsequent for user lookup
      User.findByPk
        .mockResolvedValueOnce(createMockUser()) // HR user check
        .mockResolvedValueOnce(mockUser);         // Target user lookup

      SuspiciousActivityReport.findAll.mockResolvedValue(mockReports);

      const res = await request(app)
        .get("/api/v1/suspicious-reports/user/3/history")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("reports");
      expect(res.body.reports).toHaveLength(2);
      expect(res.body.user.warningCount).toBe(2);
    });

    it("should return 404 when user not found", async () => {
      const token = generateToken(1);
      User.findByPk
        .mockResolvedValueOnce(createMockUser()) // HR check
        .mockResolvedValueOnce(null);             // User not found

      SuspiciousActivityReport.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/suspicious-reports/user/999/history")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });
  });

  describe("POST /:id/action", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .send({ action: "dismiss" });

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-HR/owner user", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser({ type: "cleaner" }));

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "dismiss" });

      expect(res.status).toBe(403);
    });

    it("should return 400 for invalid action", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "invalid_action" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid action");
    });

    it("should return 400 when notes missing for warn action", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "warn" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Notes are required for warn and suspend actions");
    });

    it("should return 400 when notes missing for suspend action", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "suspend" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Notes are required for warn and suspend actions");
    });

    it("should return 404 when report not found", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/suspicious-reports/999/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "dismiss" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Report not found");
    });

    it("should successfully dismiss a report", async () => {
      const token = generateToken(1);
      const mockReport = createMockReport();
      const updatedReport = {
        ...mockReport,
        status: "dismissed",
        reviewedAt: new Date(),
        reviewedBy: { id: 1, firstName: "HR", lastName: "Staff" },
      };

      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([{ id: 1 }]); // Staff to notify
      SuspiciousActivityReport.findByPk
        .mockResolvedValueOnce(mockReport)
        .mockResolvedValueOnce(updatedReport);
      SuspiciousActivityReport.count.mockResolvedValue(0); // Pending count

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "dismiss", notes: "False report" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("dismiss");
      expect(mockReport.update).toHaveBeenCalled();
    });

    it("should successfully mark a report as reviewed", async () => {
      const token = generateToken(1);
      const mockReport = createMockReport();
      const updatedReport = {
        ...mockReport,
        status: "reviewed",
        reviewedAt: new Date(),
        reviewedBy: { id: 1, firstName: "HR", lastName: "Staff" },
      };

      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([{ id: 1 }]); // Staff to notify
      SuspiciousActivityReport.findByPk
        .mockResolvedValueOnce(mockReport)
        .mockResolvedValueOnce(updatedReport);
      SuspiciousActivityReport.count.mockResolvedValue(0); // Pending count

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "reviewed" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should successfully warn a user and increment warning count", async () => {
      const token = generateToken(1);
      const mockReport = createMockReport();
      const updatedReport = {
        ...mockReport,
        status: "action_taken",
        reviewedAt: new Date(),
        reviewNotes: "First warning for solicitation",
        reviewedBy: { id: 1, firstName: "HR", lastName: "Staff" },
        reportedUser: { ...mockReport.reportedUser, warningCount: 1 },
      };

      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([{ id: 1 }]); // Staff to notify
      SuspiciousActivityReport.findByPk
        .mockResolvedValueOnce(mockReport)
        .mockResolvedValueOnce(updatedReport);
      SuspiciousActivityReport.count.mockResolvedValue(0); // Pending count

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "warn", notes: "First warning for solicitation" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReport.reportedUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          warningCount: 1,
          accountStatusUpdatedById: 1,
        })
      );
    });

    it("should successfully suspend a user", async () => {
      const token = generateToken(1);
      const mockReport = createMockReport();
      const updatedReport = {
        ...mockReport,
        status: "action_taken",
        reviewedAt: new Date(),
        reviewNotes: "Multiple violations - account suspended",
        reviewedBy: { id: 1, firstName: "HR", lastName: "Staff" },
        reportedUser: { ...mockReport.reportedUser, accountFrozen: true, warningCount: 0 },
      };

      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([{ id: 1 }]); // Staff to notify
      SuspiciousActivityReport.findByPk
        .mockResolvedValueOnce(mockReport)
        .mockResolvedValueOnce(updatedReport);
      SuspiciousActivityReport.count.mockResolvedValue(0); // Pending count

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "suspend", notes: "Multiple violations - account suspended" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReport.reportedUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          accountFrozen: true,
          accountFrozenReason: "Multiple violations - account suspended",
        })
      );
    });

    it("should successfully clear all flags from a user", async () => {
      const token = generateToken(1);
      const mockReport = createMockReport({
        reportedUser: {
          ...createMockReport().reportedUser,
          accountFrozen: true,
          warningCount: 3,
          update: jest.fn(),
        },
      });
      const updatedReport = {
        ...mockReport,
        status: "action_taken",
        reviewedAt: new Date(),
        reviewNotes: "Cleared after appeal",
        reviewedBy: { id: 1, firstName: "HR", lastName: "Staff" },
        reportedUser: { ...mockReport.reportedUser, accountFrozen: false, warningCount: 0 },
      };

      User.findByPk.mockResolvedValue(createMockUser());
      User.findAll.mockResolvedValue([{ id: 1 }]); // Staff to notify
      SuspiciousActivityReport.findByPk
        .mockResolvedValueOnce(mockReport)
        .mockResolvedValueOnce(updatedReport);
      SuspiciousActivityReport.count.mockResolvedValue(0); // Pending count

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "clear_flags", notes: "Cleared after appeal" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReport.reportedUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          accountFrozen: false,
          accountFrozenAt: null,
          accountFrozenReason: null,
          warningCount: 0,
        })
      );
    });

    it("should handle database errors gracefully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(createMockUser());
      SuspiciousActivityReport.findByPk.mockRejectedValue(new Error("DB error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .post("/api/v1/suspicious-reports/1/action")
        .set("Authorization", `Bearer ${token}`)
        .send({ action: "dismiss" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to process action");

      consoleSpy.mockRestore();
    });
  });
});
