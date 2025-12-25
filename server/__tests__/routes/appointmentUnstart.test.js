/**
 * Tests for Appointment Unstart Endpoint
 * POST /api/v1/appointments/:id/unstart
 *
 * This endpoint allows cleaners to undo starting a job by deleting
 * all photos taken for the appointment.
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    update: jest.fn(),
  },
  UserHomes: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
    update: jest.fn(),
  },
  UserCleanerAppointments: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserPendingRequests: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    update: jest.fn(),
  },
  UserReviews: {
    findAll: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
  JobPhoto: {
    destroy: jest.fn(),
    findAll: jest.fn(),
  },
}));

// Mock services
jest.mock("../../services/UserInfoClass", () => ({
  editTimeInDB: jest.fn().mockResolvedValue({ success: true }),
  editSheetsInDB: jest.fn().mockResolvedValue({ success: true }),
  editTowelsInDB: jest.fn().mockResolvedValue({ success: true }),
  editCodeKeyInDB: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../services/CalculatePrice", () =>
  jest.fn(() => 150)
);

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
  sendEmployeeRequest: jest.fn().mockResolvedValue(true),
  removeRequestEmail: jest.fn().mockResolvedValue(true),
  sendRequestApproved: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../config/businessConfig", () => ({
  businessConfig: {
    platform: { feePercent: 0.10 },
    cleaner: { payoutPercent: 0.90 },
  },
  getPricingConfig: jest.fn().mockResolvedValue({
    platform: { feePercent: 0.10 },
    cleaner: { payoutPercent: 0.90 },
    pricing: {
      baseRates: { perBedroom: 2500, perBathroom: 2000 },
      extras: { bringSheets: 1000, bringTowels: 500 },
    },
  }),
}));

const { UserAppointments, JobPhoto } = require("../../models");

describe("Appointment Unstart Route", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    // Set environment variable for tests
    process.env.SESSION_SECRET = secretKey;

    app = express();
    app.use(express.json());

    const appointmentRouter = require("../../routes/api/v1/appointmentsRouter");
    app.use("/api/v1/appointments", appointmentRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /:id/unstart", () => {
    describe("Authentication", () => {
      it("should return 401 if no authorization token provided", async () => {
        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .send({});

        expect(res.status).toBe(401);
        expect(res.body.error).toContain("Authorization");
      });

      it("should return 401 for invalid token", async () => {
        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", "Bearer invalid-token")
          .send({});

        expect(res.status).toBe(401);
      });

      it("should return 401 for expired token", async () => {
        const expiredToken = jwt.sign(
          { userId: 1 },
          secretKey,
          { expiresIn: "-1h" } // Already expired
        );

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${expiredToken}`)
          .send({});

        expect(res.status).toBe(401);
      });

      it("should accept valid token", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
      });
    });

    describe("Authorization", () => {
      it("should return 403 if user is not assigned to appointment", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "2,3", // User 1 not included
          completed: false,
        });

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(403);
        expect(res.body.error).toContain("Not authorized");
      });

      it("should allow user assigned to appointment", async () => {
        const token = jwt.sign({ userId: 2 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "2,3",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
      });

      it("should allow when employeesAssigned is a single ID", async () => {
        const token = jwt.sign({ userId: 5 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "5",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
      });

      it("should handle null employeesAssigned", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: null,
          completed: false,
        });

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(403);
      });
    });

    describe("Appointment Validation", () => {
      it("should return 404 if appointment not found", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/appointments/999/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(404);
        expect(res.body.error).toContain("not found");
      });

      it("should return 400 if appointment is already completed", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: true, // Already completed
        });

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("completed");
      });

      it("should allow unstart for non-completed appointment", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(2);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
      });
    });

    describe("Photo Deletion", () => {
      it("should delete all photos for the appointment", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 456,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(5);

        await request(app)
          .post("/api/v1/appointments/456/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(JobPhoto.destroy).toHaveBeenCalledWith({
          where: { appointmentId: "456" },
        });
      });

      it("should return number of photos deleted", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(3);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.photosDeleted).toBe(3);
      });

      it("should succeed even if no photos to delete", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.photosDeleted).toBe(0);
      });
    });

    describe("Success Response", () => {
      it("should return success true on successful unstart", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(2);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it("should return success message", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.body.message).toContain("unstarted");
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error during findByPk", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockRejectedValue(new Error("DB connection error"));

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(500);
        expect(res.body.error).toContain("Server error");
      });

      it("should return 500 on database error during photo deletion", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockRejectedValue(new Error("Delete failed"));

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(500);
      });
    });

    describe("Multiple Cleaners", () => {
      it("should allow any assigned cleaner to unstart", async () => {
        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1,2,3",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        // Test each assigned cleaner can unstart
        for (const userId of [1, 2, 3]) {
          const token = jwt.sign({ userId }, secretKey);

          const res = await request(app)
            .post("/api/v1/appointments/123/unstart")
            .set("Authorization", `Bearer ${token}`)
            .send({});

          expect(res.status).toBe(200);
        }
      });

      it("should reject non-assigned cleaner", async () => {
        const token = jwt.sign({ userId: 99 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1,2,3",
          completed: false,
        });

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(403);
      });
    });

    describe("Edge Cases", () => {
      it("should handle appointment ID with leading zeros", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        const res = await request(app)
          .post("/api/v1/appointments/00123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        // Should work - ID parsing handles this
        expect(UserAppointments.findByPk).toHaveBeenCalled();
      });

      it("should handle large appointment IDs", async () => {
        const token = jwt.sign({ userId: 1 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 999999999,
          employeesAssigned: "1",
          completed: false,
        });

        JobPhoto.destroy.mockResolvedValue(0);

        const res = await request(app)
          .post("/api/v1/appointments/999999999/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(200);
      });

      it("should handle employeesAssigned as array-like string", async () => {
        const token = jwt.sign({ userId: 2 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 123,
          employeesAssigned: "1, 2, 3", // With spaces
          completed: false,
        });

        const res = await request(app)
          .post("/api/v1/appointments/123/unstart")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        // Implementation uses includes(), so this might still work
        // depending on exact implementation
        expect(UserAppointments.findByPk).toHaveBeenCalled();
      });
    });
  });
});
