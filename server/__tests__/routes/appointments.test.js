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

      UserHomes.findOne.mockResolvedValue({
        dataValues: {
          id: 1,
          numBeds: 3,
          numBaths: 2,
          timeToBeCompleted: "3",
          cleanersNeeded: 1,
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

  describe("PATCH /request-employee", () => {
    it("should create a request for a cleaner", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1, date: "2025-01-15" },
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com", username: "client" } })
        .mockResolvedValueOnce({ dataValues: { id: 2, username: "cleaner" } });

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Request sent to the client for approval");
    });

    it("should return 400 if request already exists", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: { userId: 1 },
      });

      User.findByPk
        .mockResolvedValueOnce({ dataValues: { email: "client@test.com" } })
        .mockResolvedValueOnce({ dataValues: { id: 2 } });

      UserPendingRequests.findOne.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .patch("/api/v1/appointments/request-employee")
        .send({ id: 2, appointmentId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Request already sent to the client");
    });
  });

  describe("PATCH /approve-request", () => {
    it("should approve a cleaning request", async () => {
      const { Payout } = require("../../models");

      UserPendingRequests.findOne.mockResolvedValue({
        dataValues: { employeeId: 2, appointmentId: 1 },
        destroy: jest.fn().mockResolvedValue(true),
      });

      UserCleanerAppointments.create.mockResolvedValue({ id: 1 });

      UserAppointments.findOne.mockResolvedValue({
        dataValues: { employeesAssigned: [], price: "150" },
        update: jest.fn().mockResolvedValue(true),
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
