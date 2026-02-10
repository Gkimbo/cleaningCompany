const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock PreferredCleanerService
jest.mock("../../services/PreferredCleanerService", () => ({
  getClientAppointments: jest.fn(),
  acceptAppointment: jest.fn(),
  declineAppointment: jest.fn(),
  clientRespond: jest.fn(),
}));

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    return value.replace("encrypted_", "");
  }),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
    count: jest.fn(),
  },
}));

const { User, UserAppointments, UserHomes } = require("../../models");
const PreferredCleanerService = require("../../services/PreferredCleanerService");
const EncryptionService = require("../../services/EncryptionService");

describe("Preferred Cleaner Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const preferredCleanerRouter = require("../../routes/api/v1/preferredCleanerRouter");
    app.use("/api/v1/preferred-cleaner", preferredCleanerRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: homeowner (clientId 200) has homes, cleaner (cleanerId 100) does not
    UserHomes.count.mockImplementation(({ where }) => {
      if (where?.userId === 200) return Promise.resolve(1);
      return Promise.resolve(0);
    });
  });

  describe("Cleaner (Business Owner) Endpoints", () => {
    const cleanerId = 100;

    describe("GET /my-client-appointments", () => {
      it("should return grouped appointments for cleaner", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        PreferredCleanerService.getClientAppointments.mockResolvedValue({
          pending: [
            { id: 1, date: "2025-01-15", client: { name: "John Doe" } },
          ],
          declined: [],
          upcoming: [
            { id: 2, date: "2025-01-20", client: { name: "Jane Doe" } },
          ],
        });

        const res = await request(app)
          .get("/api/v1/preferred-cleaner/my-client-appointments")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.pending).toHaveLength(1);
        expect(res.body.upcoming).toHaveLength(1);
        expect(res.body.declined).toHaveLength(0);
      });

      it("should return 401 if no token provided", async () => {
        const res = await request(app)
          .get("/api/v1/preferred-cleaner/my-client-appointments");

        expect(res.status).toBe(401);
      });

      it("should return 403 if user is not a cleaner", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 200,
          type: "homeowner",
        });

        const res = await request(app)
          .get("/api/v1/preferred-cleaner/my-client-appointments")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Cleaner access required");
      });

      it("should return 500 on service error", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        PreferredCleanerService.getClientAppointments.mockRejectedValue(
          new Error("Database error")
        );

        const res = await request(app)
          .get("/api/v1/preferred-cleaner/my-client-appointments")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to fetch appointments");
      });
    });

    describe("POST /appointments/:id/accept", () => {
      it("should accept an appointment", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        PreferredCleanerService.acceptAppointment.mockResolvedValue({
          success: true,
          appointment: { id: 1, date: "2025-01-15", assigned: true },
        });

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/accept")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.appointment.assigned).toBe(true);
      });

      it("should return 400 on service error", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        PreferredCleanerService.acceptAppointment.mockRejectedValue(
          new Error("Appointment not found")
        );

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/999/accept")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Appointment not found");
      });

      it("should return 403 if user is not a cleaner", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 200,
          type: "homeowner",
        });

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/accept")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
      });
    });

    describe("POST /appointments/:id/decline", () => {
      it("should decline an appointment", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        PreferredCleanerService.declineAppointment.mockResolvedValue({
          success: true,
          appointment: { id: 1, date: "2025-01-15", clientResponsePending: true },
        });

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/decline")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.appointment.clientResponsePending).toBe(true);
      });

      it("should return 400 on service error", async () => {
        const token = jwt.sign({ userId: cleanerId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: cleanerId,
          type: "cleaner",
        });

        PreferredCleanerService.declineAppointment.mockRejectedValue(
          new Error("Already declined")
        );

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/decline")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Already declined");
      });
    });
  });

  describe("Client (Homeowner) Endpoints", () => {
    const clientId = 200;

    describe("GET /pending-responses", () => {
      it("should return appointments pending client response", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk
          .mockResolvedValueOnce({
            id: clientId,
            type: "homeowner",
          })
          .mockResolvedValueOnce({
            id: 100,
            firstName: "John",
            lastName: "Cleaner",
          });

        UserAppointments.findAll.mockResolvedValue([
          {
            id: 1,
            date: "2025-01-15",
            price: "150",
            timeToBeCompleted: "10-3",
            declinedAt: new Date(),
            home: {
              id: 1,
              nickName: "Beach House",
              address: "encrypted_123 Main St",
              city: "encrypted_Boston",
              preferredCleanerId: 100,
            },
          },
        ]);

        const res = await request(app)
          .get("/api/v1/preferred-cleaner/pending-responses")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.appointments).toHaveLength(1);
        expect(res.body.appointments[0].cleaner.name).toBe("John Cleaner");
      });

      it("should decrypt home addresses", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        UserAppointments.findAll.mockResolvedValue([
          {
            id: 1,
            date: "2025-01-15",
            price: "150",
            timeToBeCompleted: "10-3",
            home: {
              id: 1,
              nickName: "Beach House",
              address: "encrypted_123 Main St",
              city: "encrypted_Boston",
              preferredCleanerId: null,
            },
          },
        ]);

        const res = await request(app)
          .get("/api/v1/preferred-cleaner/pending-responses")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_123 Main St");
        expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_Boston");
        expect(res.body.appointments[0].home.address).toBe("123 Main St, Boston");
      });

      it("should return 403 if user is not a homeowner", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        User.findByPk.mockResolvedValue({
          id: 100,
          type: "cleaner",
        });

        const res = await request(app)
          .get("/api/v1/preferred-cleaner/pending-responses")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Homeowner access required");
      });
    });

    describe("POST /appointments/:id/respond", () => {
      it("should handle cancel action", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        PreferredCleanerService.clientRespond.mockResolvedValue({
          success: true,
          action: "cancelled",
          message: "Appointment has been cancelled",
        });

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/respond")
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "cancel" });

        expect(res.status).toBe(200);
        expect(res.body.action).toBe("cancelled");
      });

      it("should handle open_to_market action", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        PreferredCleanerService.clientRespond.mockResolvedValue({
          success: true,
          action: "opened_to_market",
          message: "Appointment is now open to other cleaners",
          originalPrice: 100,
          newPrice: 150,
        });

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/respond")
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "open_to_market" });

        expect(res.status).toBe(200);
        expect(res.body.action).toBe("opened_to_market");
        expect(res.body.newPrice).toBe(150);
      });

      it("should return 400 for invalid action", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/respond")
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "invalid_action" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid action. Must be 'cancel' or 'open_to_market'");
      });

      it("should return 400 for missing action", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/respond")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid action. Must be 'cancel' or 'open_to_market'");
      });

      it("should return 400 on service error", async () => {
        const token = jwt.sign({ userId: clientId }, secretKey);

        User.findByPk.mockResolvedValue({
          id: clientId,
          type: "homeowner",
        });

        PreferredCleanerService.clientRespond.mockRejectedValue(
          new Error("Appointment not found")
        );

        const res = await request(app)
          .post("/api/v1/preferred-cleaner/appointments/1/respond")
          .set("Authorization", `Bearer ${token}`)
          .send({ action: "cancel" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Appointment not found");
      });
    });
  });

  describe("Authentication", () => {
    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-client-appointments")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("should return 401 for missing Authorization header", async () => {
      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-client-appointments");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 401 for malformed Authorization header", async () => {
      const res = await request(app)
        .get("/api/v1/preferred-cleaner/my-client-appointments")
        .set("Authorization", "NotBearer token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
