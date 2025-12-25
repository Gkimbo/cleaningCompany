const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
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

const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
  UserCleanerAppointments,
  UserPendingRequests,
  UserReviews,
} = require("../../models");

describe("Appointment Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const appointmentRouter = require("../../routes/api/v1/appointmentsRouter");
    app.use("/api/v1/appointments", appointmentRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /unassigned", () => {
    it("should return unassigned appointments", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserAppointments.findAll.mockResolvedValue([
        {
          id: 1,
          date: "2025-01-15",
          price: "150",
          hasBeenAssigned: false,
          dataValues: {
            id: 1,
            date: "2025-01-15",
            price: "150",
            hasBeenAssigned: false,
          },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/appointments/unassigned")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("appointments");
    });
  });

  describe("GET /unassigned/:id", () => {
    it("should return a specific unassigned appointment", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserAppointments.findOne.mockResolvedValue({
        id: 1,
        dataValues: {
          id: 1,
          date: "2025-01-15",
          price: "150",
        },
      });

      UserCleanerAppointments.findAll.mockResolvedValue([
        { dataValues: { employeeId: 2 } },
      ]);

      const res = await request(app)
        .get("/api/v1/appointments/unassigned/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("appointment");
      expect(res.body).toHaveProperty("employeesAssigned");
    });
  });

  describe("GET /:homeId", () => {
    it("should return appointments for a home", async () => {
      UserAppointments.findAll.mockResolvedValue([
        {
          id: 1,
          homeId: 1,
          dataValues: {
            id: 1,
            date: "2025-01-15",
            price: "150",
          },
        },
      ]);

      const res = await request(app).get("/api/v1/appointments/1");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("appointments");
    });
  });

  describe("GET /home/:homeId", () => {
    it("should return home details", async () => {
      UserHomes.findAll.mockResolvedValue([
        {
          id: 1,
          dataValues: {
            id: 1,
            nickName: "Test Home",
            address: "123 Test St",
          },
        },
      ]);

      const res = await request(app).get("/api/v1/appointments/home/1");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("home");
    });
  });

  describe("POST / (create appointment)", () => {
    it("should create new appointments", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        hasPaymentMethod: true,
      });

      UserHomes.findOne.mockResolvedValue({
        dataValues: {
          id: 1,
          numBeds: 3,
          numBaths: 2,
          timeToBeCompleted: "3",
          cleanersNeeded: 1,
          outsideServiceArea: false,
        },
      });

      UserBills.findOne.mockResolvedValue({
        dataValues: {
          appointmentDue: 0,
          cancellationFee: 0,
          totalDue: 0,
        },
        update: jest.fn().mockResolvedValue(true),
      });

      UserAppointments.create.mockResolvedValue({
        id: 1,
        dataValues: { id: 1 },
      });

      const res = await request(app)
        .post("/api/v1/appointments")
        .send({
          token,
          homeId: 1,
          dateArray: [
            {
              date: "2025-01-15",
              bringTowels: "no",
              bringSheets: "no",
              paid: false,
            },
          ],
          keyPadCode: "1234",
          keyLocation: "Under mat",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("appointments");
    });
  });

  describe("DELETE /:id", () => {
    it("should delete an appointment", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserBills.findOne.mockResolvedValue({
        dataValues: {
          cancellationFee: 0,
          appointmentDue: 150,
          totalDue: 150,
        },
        update: jest.fn().mockResolvedValue(true),
      });

      UserAppointments.findOne.mockResolvedValue({
        dataValues: { price: "150" },
      });

      UserCleanerAppointments.destroy.mockResolvedValue(1);
      UserAppointments.destroy.mockResolvedValue(1);

      const res = await request(app)
        .delete("/api/v1/appointments/1")
        .send({ fee: 25, user: token });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Appointment Deleted");
    });
  });

  describe("GET /booking-info/:appointmentId", () => {
    const token = jwt.sign({ userId: 1 }, secretKey);

    it("should return booking info for small home without acknowledgment required", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "2",
        numBaths: "2",
        timeToBeCompleted: "anytime",
        cleanersNeeded: 1,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(false);
      expect(res.body.requiresAcknowledgment).toBe(false);
      expect(res.body.acknowledgmentMessage).toBeNull();
    });

    it("should return acknowledgment required for large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "3",
        timeToBeCompleted: "anytime",
        cleanersNeeded: 2,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.hasTimeConstraint).toBe(false);
      expect(res.body.requiresAcknowledgment).toBe(true);
      expect(res.body.acknowledgmentMessage).toContain("larger home");
      expect(res.body.acknowledgmentMessage).toContain("4 beds, 3 baths");
      expect(res.body.acknowledgmentMessage).toContain("Kleanr will not provide extra cleaners");
    });

    it("should include time constraint warning for large home with time limit", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "5",
        numBaths: "4",
        timeToBeCompleted: "10-3",
        cleanersNeeded: 3,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.hasTimeConstraint).toBe(true);
      expect(res.body.acknowledgmentMessage).toContain("10-3");
      expect(res.body.acknowledgmentMessage).toContain("difficult without assistance");
    });

    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1");

      expect(res.status).toBe(401);
    });

    it("should return 404 if appointment not found", async () => {
      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Appointment not found");
    });

    // Edge case: exactly 3 beds and 3 baths (minimum large home)
    it("should consider 3 beds and 3 baths as large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "3",
        numBaths: "3",
        timeToBeCompleted: "anytime",
        cleanersNeeded: 2,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.requiresAcknowledgment).toBe(true);
    });

    // Edge case: 3 beds but only 2 baths (not large - both must exceed 2)
    it("should NOT consider 3 beds and 2 baths as large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "3",
        numBaths: "2",
        timeToBeCompleted: "anytime",
        cleanersNeeded: 1,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(false);
      expect(res.body.requiresAcknowledgment).toBe(false);
    });

    // Edge case: 2 beds but 3 baths (not large - both must exceed 2)
    it("should NOT consider 2 beds and 3 baths as large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "2",
        numBaths: "3",
        timeToBeCompleted: "anytime",
        cleanersNeeded: 1,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(false);
      expect(res.body.requiresAcknowledgment).toBe(false);
    });

    // Edge case: exactly 2 beds and 2 baths (boundary - not large)
    it("should NOT consider exactly 2 beds and 2 baths as large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "2",
        numBaths: "2",
        timeToBeCompleted: "10-3",
        cleanersNeeded: 1,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(false);
      expect(res.body.hasTimeConstraint).toBe(false); // Time constraint only relevant for large homes
      expect(res.body.requiresAcknowledgment).toBe(false);
    });

    // Test different time constraints
    it("should show time constraint for large home with 11-4 time window", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "3",
        timeToBeCompleted: "11-4",
        cleanersNeeded: 2,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.hasTimeConstraint).toBe(true);
      expect(res.body.acknowledgmentMessage).toContain("11-4");
    });

    it("should show time constraint for large home with 12-2 time window", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "5",
        numBaths: "4",
        timeToBeCompleted: "12-2",
        cleanersNeeded: 3,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.hasTimeConstraint).toBe(true);
      expect(res.body.acknowledgmentMessage).toContain("12-2");
    });

    // Very large home test
    it("should handle very large homes (6+ beds and baths)", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "7",
        numBaths: "6",
        timeToBeCompleted: "10-3",
        cleanersNeeded: 4,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.hasTimeConstraint).toBe(true);
      expect(res.body.requiresAcknowledgment).toBe(true);
      expect(res.body.homeInfo.numBeds).toBe(7);
      expect(res.body.homeInfo.numBaths).toBe(6);
      expect(res.body.homeInfo.cleanersNeeded).toBe(4);
    });

    // Test homeInfo structure
    it("should return complete homeInfo structure", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "3",
        timeToBeCompleted: "10-3",
        cleanersNeeded: 2,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.homeInfo).toBeDefined();
      expect(res.body.homeInfo.numBeds).toBe(4);
      expect(res.body.homeInfo.numBaths).toBe(3);
      expect(res.body.homeInfo.timeToBeCompleted).toBe("10-3");
      expect(res.body.homeInfo.cleanersNeeded).toBe(2);
      expect(res.body.appointmentId).toBe(1);
    });

    // Test with numeric bed/bath values instead of strings
    it("should handle numeric bed/bath values", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: 4,
        numBaths: 3,
        timeToBeCompleted: "anytime",
        cleanersNeeded: 2,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.requiresAcknowledgment).toBe(true);
    });

    // Test with null/undefined bed/bath values
    it("should handle missing bed/bath values gracefully", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: null,
        numBaths: undefined,
        timeToBeCompleted: "anytime",
        cleanersNeeded: 1,
      });

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(false);
      expect(res.body.requiresAcknowledgment).toBe(false);
    });

    // Test 404 when home not found
    it("should return 404 if home not found", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 1,
        homeId: 1,
      });

      UserHomes.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/appointments/booking-info/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Home not found");
    });
  });

  describe("PATCH /request-employee", () => {
    it("should create a request for a cleaner (small home)", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "2",
        numBaths: "2",
        timeToBeCompleted: "anytime",
      });

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request sent to the client for approval");
    });

    it("should require acknowledgment for large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "3",
        timeToBeCompleted: "anytime",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1, acknowledged: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Acknowledgment required");
      expect(res.body.requiresAcknowledgment).toBe(true);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.message).toContain("larger home");
      expect(res.body.message).toContain("Kleanr will not provide extra cleaners");
    });

    it("should include time warning for large home with time constraint", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "5",
        numBaths: "4",
        timeToBeCompleted: "10-3",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1, acknowledged: false });

      expect(res.status).toBe(400);
      expect(res.body.hasTimeConstraint).toBe(true);
      expect(res.body.message).toContain("10-3");
      expect(res.body.message).toContain("difficult without assistance");
    });

    it("should allow request for large home when acknowledged", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "3",
        timeToBeCompleted: "10-3",
      });

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1, acknowledged: true });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request sent to the client for approval");
    });

    it("should return 400 if request already exists", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1 },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com" } })
        .mockResolvedValueOnce({ dataValues: { id: 2 } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "2",
        numBaths: "2",
        timeToBeCompleted: "anytime",
      });

      UserPendingRequests.findOne.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Request already sent to the client");
    });

    // Edge case: 3 beds and 3 baths requires acknowledgment
    it("should require acknowledgment for minimum large home (3 beds, 3 baths)", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "3",
        numBaths: "3",
        timeToBeCompleted: "anytime",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1, acknowledged: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Acknowledgment required");
      expect(res.body.isLargeHome).toBe(true);
    });

    // Edge case: 3 beds, 2 baths does NOT require acknowledgment
    it("should NOT require acknowledgment for 3 beds, 2 baths", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "3",
        numBaths: "2",
        timeToBeCompleted: "anytime",
      });

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 }); // No acknowledged field needed

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request sent to the client for approval");
    });

    // Edge case: 2 beds, 3 baths does NOT require acknowledgment
    it("should NOT require acknowledgment for 2 beds, 3 baths", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "2",
        numBaths: "3",
        timeToBeCompleted: "10-3",
      });

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request sent to the client for approval");
    });

    // Test acknowledgment with 11-4 time window
    it("should include 11-4 time window in error message for large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "4",
        timeToBeCompleted: "11-4",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1, acknowledged: false });

      expect(res.status).toBe(400);
      expect(res.body.hasTimeConstraint).toBe(true);
      expect(res.body.message).toContain("11-4");
    });

    // Test acknowledgment with 12-2 time window
    it("should include 12-2 time window in error message for large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "5",
        numBaths: "5",
        timeToBeCompleted: "12-2",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.hasTimeConstraint).toBe(true);
      expect(res.body.message).toContain("12-2");
    });

    // Test very large home with acknowledgment
    it("should allow booking very large home (6+ beds/baths) when acknowledged", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "7",
        numBaths: "6",
        timeToBeCompleted: "10-3",
      });

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1, acknowledged: true });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request sent to the client for approval");
    });

    // Test that acknowledged: undefined is treated as false
    it("should treat undefined acknowledged as false for large home", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "3",
        timeToBeCompleted: "anytime",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 }); // No acknowledged field

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Acknowledgment required");
    });

    // Test that small home works without acknowledged field
    it("should allow small home booking without acknowledged field", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "1",
        numBaths: "1",
        timeToBeCompleted: "10-3",
      });

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request sent to the client for approval");
    });

    // Test error response structure for large home
    it("should return complete error structure for large home without acknowledgment", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "5",
        numBaths: "4",
        timeToBeCompleted: "10-3",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Acknowledgment required");
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("requiresAcknowledgment", true);
      expect(res.body).toHaveProperty("isLargeHome", true);
      expect(res.body).toHaveProperty("hasTimeConstraint", true);
      expect(res.body.message).toContain("5 beds, 4 baths");
      expect(res.body.message).toContain("Kleanr will not provide extra cleaners");
      expect(res.body.message).toContain("10-3");
    });

    // Test large home without time constraint
    it("should NOT include time constraint in message for large home with anytime", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: "4",
        numBaths: "3",
        timeToBeCompleted: "anytime",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.hasTimeConstraint).toBe(false);
      expect(res.body.message).not.toContain("difficult without assistance");
    });

    // Test handling of numeric bed/bath values
    it("should handle numeric bed/bath values in request-employee", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
        homeId: 1,
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserHomes.findByPk.mockResolvedValue({
        numBeds: 4, // numeric, not string
        numBaths: 3, // numeric, not string
        timeToBeCompleted: "anytime",
      });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Acknowledgment required");
      expect(res.body.isLargeHome).toBe(true);
    });
  });

  describe("PATCH /approve-request", () => {
    it("should approve a cleaning request", async () => {
      const { Payout } = require("../../models");

      UserPendingRequests.findOne.mockResolvedValue({
        id: 1,
        dataValues: { id: 1, employeeId: 2, appointmentId: 1 },
        destroy: jest.fn().mockResolvedValue(true),
        update: jest.fn().mockResolvedValue(true),
      });

      // Mock the update for setting other requests to onHold
      UserPendingRequests.update.mockResolvedValue([0]);

      UserCleanerAppointments.create.mockResolvedValue({ id: 1 });

      UserAppointments.findOne.mockResolvedValue({
        id: 1,
        dataValues: {
          id: 1,
          employeesAssigned: [],
          price: "150",
          userId: 1,
          homeId: 1,
          date: "2025-01-15",
          hasBeenAssigned: false,
        },
        update: jest.fn().mockResolvedValue(true),
      });

      // Mock User.findByPk for cleaner and homeowner
      User.findByPk
        .mockResolvedValueOnce({
          dataValues: {
            id: 2,
            email: "cleaner@test.com",
            username: "cleaner",
            notifications: [],
          },
          update: jest.fn().mockResolvedValue(true),
        })
        .mockResolvedValueOnce({
          dataValues: {
            id: 1,
            email: "homeowner@test.com",
            username: "homeowner",
          },
        });

      // Mock UserHomes.findByPk
      UserHomes.findByPk.mockResolvedValue({
        dataValues: {
          address: "123 Main St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
      });

      Payout.findOne.mockResolvedValue(null); // No existing payout
      Payout.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .patch("/api/v1/appointments/approve-request")
        .send({ requestId: 1, approve: true });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Cleaner assigned successfully");
    });

    it("should deny a cleaning request", async () => {
      UserPendingRequests.findOne.mockResolvedValue({
        dataValues: { employeeId: 2, appointmentId: 1 },
        destroy: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .patch("/api/v1/appointments/approve-request")
        .send({ requestId: 1, approve: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request denied");
    });

    it("should use getPricingConfig for payout calculations", async () => {
      const { Payout } = require("../../models");
      const { getPricingConfig } = require("../../config/businessConfig");

      UserPendingRequests.findOne.mockResolvedValue({
        id: 1,
        dataValues: { id: 1, employeeId: 2, appointmentId: 1 },
        destroy: jest.fn().mockResolvedValue(true),
        update: jest.fn().mockResolvedValue(true),
      });

      // Mock the update for setting other requests to onHold
      UserPendingRequests.update.mockResolvedValue([0]);

      UserCleanerAppointments.create.mockResolvedValue({ id: 1 });

      UserAppointments.findOne.mockResolvedValue({
        id: 1,
        dataValues: {
          id: 1,
          employeesAssigned: [],
          price: "200",
          userId: 1,
          homeId: 1,
          date: "2025-01-15",
          hasBeenAssigned: false,
        },
        update: jest.fn().mockResolvedValue(true),
      });

      User.findByPk
        .mockResolvedValueOnce({
          dataValues: {
            id: 2,
            email: "cleaner@test.com",
            username: "cleaner",
            notifications: [],
          },
          update: jest.fn().mockResolvedValue(true),
        })
        .mockResolvedValueOnce({
          dataValues: {
            id: 1,
            email: "homeowner@test.com",
            username: "homeowner",
          },
        });

      UserHomes.findByPk.mockResolvedValue({
        dataValues: {
          address: "123 Main St",
          city: "Test City",
          state: "TS",
          zipcode: "12345",
        },
      });

      Payout.findOne.mockResolvedValue(null);
      Payout.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .patch("/api/v1/appointments/approve-request")
        .send({ requestId: 1, approve: true });

      expect(res.status).toBe(200);

      // Verify Payout.create was called with correct calculated values
      expect(Payout.create).toHaveBeenCalled();
      const createCall = Payout.create.mock.calls[0][0];

      // Price is $200, so 20000 cents
      // With 10% fee: platformFee = 2000, netAmount = 18000
      expect(createCall.grossAmount).toBe(20000);
      expect(createCall.platformFee).toBe(2000);
      expect(createCall.netAmount).toBe(18000);
    });

    it("should block approval if cleaner already assigned", async () => {
      UserPendingRequests.findOne.mockResolvedValue({
        id: 1,
        dataValues: { id: 1, employeeId: 3, appointmentId: 1 },
        destroy: jest.fn().mockResolvedValue(true),
        update: jest.fn().mockResolvedValue(true),
      });

      // Already has one cleaner assigned
      UserAppointments.findOne.mockResolvedValue({
        id: 1,
        dataValues: {
          id: 1,
          employeesAssigned: ["2"], // One cleaner already assigned
          price: "300",
          userId: 1,
          homeId: 1,
          date: "2025-01-15",
          hasBeenAssigned: true, // Cleaner already assigned
        },
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .patch("/api/v1/appointments/approve-request")
        .send({ requestId: 1, approve: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("A cleaner is already assigned to this appointment. Remove them first to approve another.");
    });

    it("should return 404 if request not found", async () => {
      UserPendingRequests.findOne.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/appointments/approve-request")
        .send({ requestId: 999, approve: true });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Request not found");
    });
  });

  describe("PATCH /:id (update appointment)", () => {
    it("should update appointment details", async () => {
      const UserInfo = require("../../services/UserInfoClass");

      const res = await request(app)
        .patch("/api/v1/appointments/1")
        .send({
          id: 1,
          bringTowels: "yes",
        });

      expect(res.status).toBe(200);
      expect(UserInfo.editTowelsInDB).toHaveBeenCalled();
    });
  });

  describe("GET /my-requests", () => {
    it("should return pending requests for a user", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      UserAppointments.findAll.mockResolvedValue([
        { id: 1, dataValues: { id: 1 } },
      ]);

      UserPendingRequests.findAll.mockResolvedValue([
        {
          dataValues: { appointmentId: 1, employeeId: 2 },
        },
      ]);

      User.findOne.mockResolvedValue({
        dataValues: {
          id: 2,
          username: "cleaner",
          reviews: [],
        },
      });

      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/appointments/my-requests")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("pendingRequestsEmployee");
    });
  });
});

afterAll(async () => {
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.useRealTimers();
});
