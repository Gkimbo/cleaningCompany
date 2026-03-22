const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => value?.replace("encrypted_", "") || value),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock CalculatePrice
jest.mock("../../services/CalculatePrice", () => jest.fn().mockResolvedValue(150));

// Mock IncentiveService
jest.mock("../../services/IncentiveService", () => ({
  calculateCleanerFee: jest.fn().mockResolvedValue({
    platformFee: 1500,
    netAmount: 13500,
    incentiveApplied: false,
    originalPlatformFee: 1500,
  }),
}));

// Mock businessConfig
jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn().mockResolvedValue({
    platform: { feePercent: 0.10 },
  }),
}));

// Mock RecurringScheduleSerializer
jest.mock("../../serializers/RecurringScheduleSerializer", () => ({
  serializeOne: jest.fn((schedule) => ({ id: schedule.id, frequency: schedule.frequency })),
  serializeMany: jest.fn((schedules) => schedules.map(s => ({ id: s.id }))),
}));

// Mock models
const mockScheduleUpdate = jest.fn().mockResolvedValue(true);
const mockSchedule = {
  id: 1,
  cleanerId: 100,
  cleanerClientId: 10,
  frequency: "weekly",
  dayOfWeek: 1,
  timeWindow: "morning",
  price: 150,
  isActive: true,
  isPaused: false,
  startDate: "2025-01-01",
  lastGeneratedDate: null,
  update: mockScheduleUpdate,
  calculateNextDate: jest.fn().mockReturnValue(new Date("2025-02-20")),
};

jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  CleanerClient: {
    findByPk: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  RecurringSchedule: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserCleanerAppointments: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Payout: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  EmployeeJobAssignment: {
    destroy: jest.fn(),
  },
}));

const {
  User,
  CleanerClient,
  UserHomes,
  RecurringSchedule,
  UserAppointments,
  UserCleanerAppointments,
  UserBills,
  Payout,
  EmployeeJobAssignment,
} = require("../../models");

describe("Recurring Schedules Deletion", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";
  const cleanerId = 100;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const recurringSchedulesRouter = require("../../routes/api/v1/recurringSchedulesRouter");
    app.use("/api/v1/recurring-schedules", recurringSchedulesRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default user mock
    User.findByPk.mockResolvedValue({
      id: cleanerId,
      type: "cleaner",
    });
  });

  describe("DELETE /:id - Deactivate Schedule", () => {
    it("should delete all future appointments when deactivating a schedule", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue({
        ...mockSchedule,
        update: mockScheduleUpdate,
      });

      // Mock future appointments to delete (unpaid)
      const futureAppointments = [
        { id: 101, userId: 200, price: "150" },
        { id: 102, userId: 200, price: "150" },
        { id: 103, userId: 200, price: "150" },
      ];
      // First call returns unpaid appointments, second call returns paid appointments (none)
      UserAppointments.findAll
        .mockResolvedValueOnce(futureAppointments)
        .mockResolvedValueOnce([]); // No paid appointments
      UserAppointments.destroy.mockResolvedValue(3);
      UserCleanerAppointments.destroy.mockResolvedValue(3);
      EmployeeJobAssignment.destroy.mockResolvedValue(3);
      Payout.destroy.mockResolvedValue(3);

      const mockUserBill = {
        appointmentDue: 450,
        totalDue: 450,
        update: jest.fn().mockResolvedValue(true),
      };
      UserBills.findOne.mockResolvedValue(mockUserBill);

      const res = await request(app)
        .delete("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelledAppointments).toBe(3);
      expect(res.body.skippedPaidAppointments).toBe(0);

      // Verify appointments were queried correctly
      expect(UserAppointments.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recurringScheduleId: "1",
            completed: false,
          }),
        })
      );

      // Verify related records were deleted
      expect(UserCleanerAppointments.destroy).toHaveBeenCalled();
      expect(EmployeeJobAssignment.destroy).toHaveBeenCalled();
      expect(Payout.destroy).toHaveBeenCalled();

      // Verify UserBills was adjusted
      expect(mockUserBill.update).toHaveBeenCalledWith({
        appointmentDue: 0,
        totalDue: 0,
      });

      // Verify schedule was deactivated
      expect(mockScheduleUpdate).toHaveBeenCalledWith({ isActive: false });
    });

    it("should handle case with no future appointments gracefully", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue({
        ...mockSchedule,
        update: mockScheduleUpdate,
      });

      // No future appointments (unpaid or paid)
      UserAppointments.findAll
        .mockResolvedValueOnce([])  // No unpaid appointments
        .mockResolvedValueOnce([]); // No paid appointments

      const res = await request(app)
        .delete("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cancelledAppointments).toBe(0);
      expect(res.body.skippedPaidAppointments).toBe(0);

      // Should not try to delete related records
      expect(UserCleanerAppointments.destroy).not.toHaveBeenCalled();
      expect(Payout.destroy).not.toHaveBeenCalled();
    });

    it("should not delete cancelled or paid appointments", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue({
        ...mockSchedule,
        update: mockScheduleUpdate,
      });

      // Return only non-cancelled, non-paid appointments
      UserAppointments.findAll
        .mockResolvedValueOnce([{ id: 101, userId: 200, price: "150" }]) // Unpaid to delete
        .mockResolvedValueOnce([{ id: 102 }, { id: 103 }]); // 2 paid appointments skipped
      UserAppointments.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(1);
      EmployeeJobAssignment.destroy.mockResolvedValue(1);
      Payout.destroy.mockResolvedValue(1);

      const mockUserBill = {
        appointmentDue: 150,
        totalDue: 150,
        update: jest.fn().mockResolvedValue(true),
      };
      UserBills.findOne.mockResolvedValue(mockUserBill);

      const res = await request(app)
        .delete("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cancelledAppointments).toBe(1);
      expect(res.body.skippedPaidAppointments).toBe(2);
      expect(res.body.message).toContain("2 paid appointment(s) were not deleted");

      // Verify the query included wasCancelled and paid filters
      expect(UserAppointments.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wasCancelled: expect.any(Object),
            paid: expect.any(Object),
          }),
        })
      );
    });

    it("should return 404 for non-existent schedule", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/recurring-schedules/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Schedule not found");
    });
  });

  describe("POST /:id/pause - Pause Schedule", () => {
    it("should delete all future appointments when pausing a schedule", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue({
        ...mockSchedule,
        update: mockScheduleUpdate,
      });

      const futureAppointments = [
        { id: 101, userId: 200, price: "150" },
        { id: 102, userId: 200, price: "150" },
      ];
      UserAppointments.findAll
        .mockResolvedValueOnce(futureAppointments) // Unpaid
        .mockResolvedValueOnce([]); // No paid
      UserAppointments.destroy.mockResolvedValue(2);
      UserCleanerAppointments.destroy.mockResolvedValue(2);
      EmployeeJobAssignment.destroy.mockResolvedValue(2);
      Payout.destroy.mockResolvedValue(2);

      const mockUserBill = {
        appointmentDue: 300,
        totalDue: 300,
        update: jest.fn().mockResolvedValue(true),
      };
      UserBills.findOne.mockResolvedValue(mockUserBill);

      const res = await request(app)
        .post("/api/v1/recurring-schedules/1/pause")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Vacation" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelledAppointments).toBe(2);
      expect(res.body.skippedPaidAppointments).toBe(0);

      // Verify schedule was paused
      expect(mockScheduleUpdate).toHaveBeenCalledWith({
        isPaused: true,
        pausedUntil: null,
        pauseReason: "Vacation",
      });
    });

    it("should pause with an until date", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue({
        ...mockSchedule,
        update: mockScheduleUpdate,
      });

      UserAppointments.findAll
        .mockResolvedValueOnce([]) // No unpaid
        .mockResolvedValueOnce([]); // No paid

      const res = await request(app)
        .post("/api/v1/recurring-schedules/1/pause")
        .set("Authorization", `Bearer ${token}`)
        .send({ until: "2025-03-01", reason: "Home renovation" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("paused until 2025-03-01");

      expect(mockScheduleUpdate).toHaveBeenCalledWith({
        isPaused: true,
        pausedUntil: "2025-03-01",
        pauseReason: "Home renovation",
      });
    });
  });

  describe("PATCH /:id - Update Schedule", () => {
    it("should delete future appointments when updating schedule", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      // Use a paused schedule to avoid regeneration complexity in this test
      const updatableSchedule = {
        ...mockSchedule,
        isPaused: true, // Paused so no regeneration
        update: mockScheduleUpdate,
      };
      RecurringSchedule.findOne.mockResolvedValue(updatableSchedule);

      // Mock future appointments to delete
      const futureAppointments = [
        { id: 101, userId: 200, price: "150" },
      ];
      UserAppointments.findAll
        .mockResolvedValueOnce(futureAppointments) // Unpaid
        .mockResolvedValueOnce([]); // No paid
      UserAppointments.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(1);
      EmployeeJobAssignment.destroy.mockResolvedValue(1);
      Payout.destroy.mockResolvedValue(1);

      const mockUserBill = {
        appointmentDue: 150,
        totalDue: 150,
        update: jest.fn().mockResolvedValue(true),
      };
      UserBills.findOne.mockResolvedValue(mockUserBill);

      const res = await request(app)
        .patch("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ frequency: "biweekly" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelledAppointments).toBe(1);
      expect(res.body.skippedPaidAppointments).toBe(0);
      expect(res.body.newAppointmentsCreated).toBe(0); // No regeneration for paused

      // Verify schedule was updated with new frequency and reset lastGeneratedDate
      expect(mockScheduleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: "biweekly",
          lastGeneratedDate: null,
        })
      );

      // Verify related records were deleted
      expect(Payout.destroy).toHaveBeenCalled();
      expect(mockUserBill.update).toHaveBeenCalledWith({
        appointmentDue: 0,
        totalDue: 0,
      });
    });

    it("should update price without regenerating if schedule is paused", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      const pausedSchedule = {
        ...mockSchedule,
        isPaused: true,
        update: mockScheduleUpdate,
      };
      RecurringSchedule.findOne.mockResolvedValue(pausedSchedule);

      UserAppointments.findAll
        .mockResolvedValueOnce([]) // No unpaid
        .mockResolvedValueOnce([]); // No paid

      const res = await request(app)
        .patch("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 175 });

      expect(res.status).toBe(200);
      expect(res.body.newAppointmentsCreated).toBe(0); // No regeneration for paused schedule
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple users with appointments correctly", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue({
        ...mockSchedule,
        update: mockScheduleUpdate,
      });

      // Appointments for different users
      const futureAppointments = [
        { id: 101, userId: 200, price: "150" },
        { id: 102, userId: 200, price: "150" },
        { id: 103, userId: 201, price: "200" },
      ];
      UserAppointments.findAll
        .mockResolvedValueOnce(futureAppointments) // Unpaid
        .mockResolvedValueOnce([]); // No paid
      UserAppointments.destroy.mockResolvedValue(3);
      UserCleanerAppointments.destroy.mockResolvedValue(3);
      EmployeeJobAssignment.destroy.mockResolvedValue(3);
      Payout.destroy.mockResolvedValue(3);

      const mockUserBill200 = {
        appointmentDue: 300,
        totalDue: 300,
        update: jest.fn().mockResolvedValue(true),
      };
      const mockUserBill201 = {
        appointmentDue: 200,
        totalDue: 200,
        update: jest.fn().mockResolvedValue(true),
      };

      UserBills.findOne
        .mockResolvedValueOnce(mockUserBill200)
        .mockResolvedValueOnce(mockUserBill201);

      const res = await request(app)
        .delete("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cancelledAppointments).toBe(3);

      // Verify both users' bills were adjusted
      expect(UserBills.findOne).toHaveBeenCalledTimes(2);
    });

    it("should handle UserBills not existing for a user", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      RecurringSchedule.findOne.mockResolvedValue({
        ...mockSchedule,
        update: mockScheduleUpdate,
      });

      const futureAppointments = [
        { id: 101, userId: 200, price: "150" },
      ];
      UserAppointments.findAll
        .mockResolvedValueOnce(futureAppointments) // Unpaid
        .mockResolvedValueOnce([]); // No paid
      UserAppointments.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(1);
      EmployeeJobAssignment.destroy.mockResolvedValue(1);
      Payout.destroy.mockResolvedValue(1);

      // No UserBills exists
      UserBills.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cancelledAppointments).toBe(1);
      // Should not throw error when UserBills doesn't exist
    });

    it("should not allow deactivating another cleaner's schedule", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      // Schedule belongs to different cleaner - findOne returns null due to cleanerId filter
      RecurringSchedule.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/recurring-schedules/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Schedule not found");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
