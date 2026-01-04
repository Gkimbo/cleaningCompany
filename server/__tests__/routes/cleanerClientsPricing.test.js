const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock CalculatePrice
jest.mock("../../services/CalculatePrice", () => jest.fn());

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
}));

// Mock Email and PushNotification
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendClientInvitation: jest.fn(),
  sendInvitationReminder: jest.fn(),
  sendInvitationAccepted: jest.fn(),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushInvitationAccepted: jest.fn(),
}));

// Mock InvitationService
jest.mock("../../services/InvitationService", () => ({
  createInvitation: jest.fn(),
  validateInviteToken: jest.fn(),
  acceptInvitation: jest.fn(),
  resendInvitation: jest.fn(),
  getCleanerClients: jest.fn(),
  declineInvitation: jest.fn(),
}));

// Mock IncentiveService
jest.mock("../../services/IncentiveService", () => ({
  calculateCleanerPrice: jest.fn(),
}));

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  addNotification: jest.fn(),
}));

const { User, CleanerClient, UserHomes } = require("../../models");
const calculatePrice = require("../../services/CalculatePrice");
const EncryptionService = require("../../services/EncryptionService");

describe("Cleaner Clients Router - Pricing Endpoints", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const cleanerClientsRouter = require("../../routes/api/v1/cleanerClientsRouter");
    app.use("/api/v1/cleaner-clients", cleanerClientsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /:id/platform-price", () => {
    const cleanerId = 100;
    const clientId = 200;
    const homeId = 300;

    it("should calculate platform price for a client's home", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      CleanerClient.findOne.mockResolvedValue({
        id: 1,
        cleanerId,
        clientId,
        homeId,
        home: {
          id: homeId,
          numBeds: 3,
          numBaths: 2,
        },
      });

      calculatePrice.mockResolvedValue(175);

      const res = await request(app)
        .get("/api/v1/cleaner-clients/1/platform-price")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.platformPrice).toBe(175);
      expect(res.body.numBeds).toBe(3);
      expect(res.body.numBaths).toBe(2);
      expect(res.body.breakdown).toEqual({
        basePrice: 150,
        extraBeds: 2,
        extraBaths: 1,
        halfBath: 0,
      });

      expect(calculatePrice).toHaveBeenCalledWith("no", "no", 3, 2, "anytime");
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .get("/api/v1/cleaner-clients/1/platform-price");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 403 if user is not a cleaner", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 200,
        type: "homeowner",
      });

      const res = await request(app)
        .get("/api/v1/cleaner-clients/1/platform-price")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Cleaner access required");
    });

    it("should return 404 if client not found", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      CleanerClient.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/cleaner-clients/1/platform-price")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Client not found");
    });

    it("should return 400 if no home associated with client", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      CleanerClient.findOne.mockResolvedValue({
        id: 1,
        cleanerId,
        clientId,
        homeId: null,
        home: null,
      });

      const res = await request(app)
        .get("/api/v1/cleaner-clients/1/platform-price")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("No home associated with this client");
    });

    it("should handle service error", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      CleanerClient.findOne.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/api/v1/cleaner-clients/1/platform-price")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to calculate platform price");
    });
  });

  describe("PATCH /:id/default-price", () => {
    const cleanerId = 100;

    it("should update default price successfully", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const mockCleanerClient = {
        id: 1,
        cleanerId,
        defaultPrice: 150,
        update: jest.fn().mockResolvedValue(true),
      };

      CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 175 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockCleanerClient.update).toHaveBeenCalledWith({ defaultPrice: 175 });
    });

    it("should return 401 if no token provided", async () => {
      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .send({ price: 175 });

      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not a cleaner", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 200,
        type: "homeowner",
      });

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 175 });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Cleaner access required");
    });

    it("should return 400 if price is missing", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Price is required");
    });

    it("should return 400 if price is negative", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: -50 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Price must be a positive number");
    });

    it("should return 400 if price is not a number", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: "not-a-number" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Price must be a positive number");
    });

    it("should return 404 if client not found", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      CleanerClient.findOne.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 175 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Client not found");
    });

    it("should accept price as string and convert to number", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const mockCleanerClient = {
        id: 1,
        cleanerId,
        defaultPrice: 150,
        update: jest.fn().mockResolvedValue(true),
      };

      CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: "175.50" });

      expect(res.status).toBe(200);
      expect(mockCleanerClient.update).toHaveBeenCalledWith({ defaultPrice: 175.5 });
    });

    it("should accept zero as a valid price", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      const mockCleanerClient = {
        id: 1,
        cleanerId,
        defaultPrice: 150,
        update: jest.fn().mockResolvedValue(true),
      };

      CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 0 });

      expect(res.status).toBe(200);
      expect(mockCleanerClient.update).toHaveBeenCalledWith({ defaultPrice: 0 });
    });

    it("should handle database error", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      CleanerClient.findOne.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .patch("/api/v1/cleaner-clients/1/default-price")
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 175 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update default price");
    });
  });
});
