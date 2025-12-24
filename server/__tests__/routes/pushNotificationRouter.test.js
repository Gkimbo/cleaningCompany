process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  isValidExpoPushToken: jest.fn(),
}));

const { User } = require("../../models");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const pushNotificationRouter = require("../../routes/api/v1/pushNotificationRouter");

const app = express();
app.use(express.json());
app.use("/api/v1/push-notifications", pushNotificationRouter);

describe("Push Notification Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const userToken = jwt.sign({ userId: 1 }, secretKey);
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /register-token", () => {
    it("should register a valid push token", async () => {
      PushNotification.isValidExpoPushToken.mockReturnValue(true);
      const mockUser = {
        id: 1,
        expoPushToken: null,
        update: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/v1/push-notifications/register-token")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ expoPushToken: validExpoPushToken });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Push token registered successfully");
      expect(mockUser.update).toHaveBeenCalledWith({ expoPushToken: validExpoPushToken });
    });

    it("should return 400 if push token is missing", async () => {
      const response = await request(app)
        .post("/api/v1/push-notifications/register-token")
        .set("Authorization", `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Push token is required");
    });

    it("should return 400 for invalid token format", async () => {
      PushNotification.isValidExpoPushToken.mockReturnValue(false);

      const response = await request(app)
        .post("/api/v1/push-notifications/register-token")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ expoPushToken: "invalid-token" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid Expo push token format");
    });

    it("should return 404 if user not found", async () => {
      PushNotification.isValidExpoPushToken.mockReturnValue(true);
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/push-notifications/register-token")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ expoPushToken: validExpoPushToken });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 401 or 403 for invalid auth token", async () => {
      const response = await request(app)
        .post("/api/v1/push-notifications/register-token")
        .set("Authorization", "Bearer invalid_token")
        .send({ expoPushToken: validExpoPushToken });

      expect([401, 403]).toContain(response.status);
    });

    it("should return 401 for missing auth token", async () => {
      const response = await request(app)
        .post("/api/v1/push-notifications/register-token")
        .send({ expoPushToken: validExpoPushToken });

      expect(response.status).toBe(401);
    });

    it("should handle database errors gracefully", async () => {
      PushNotification.isValidExpoPushToken.mockReturnValue(true);
      User.findByPk.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/v1/push-notifications/register-token")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ expoPushToken: validExpoPushToken });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to register push token");
    });
  });

  describe("DELETE /remove-token", () => {
    it("should remove push token successfully", async () => {
      const mockUser = {
        id: 1,
        expoPushToken: validExpoPushToken,
        update: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .delete("/api/v1/push-notifications/remove-token")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Push token removed successfully");
      expect(mockUser.update).toHaveBeenCalledWith({ expoPushToken: null });
    });

    it("should return 404 if user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/v1/push-notifications/remove-token")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 401 or 403 for invalid auth token", async () => {
      const response = await request(app)
        .delete("/api/v1/push-notifications/remove-token")
        .set("Authorization", "Bearer invalid_token");

      expect([401, 403]).toContain(response.status);
    });

    it("should handle database errors gracefully", async () => {
      User.findByPk.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .delete("/api/v1/push-notifications/remove-token")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to remove push token");
    });
  });

  describe("GET /preferences", () => {
    it("should return notification preferences with email and phone enabled", async () => {
      const mockUser = {
        id: 1,
        notifications: ["email", "phone"],
        expoPushToken: validExpoPushToken,
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .get("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBe(true);
      expect(response.body.pushNotifications).toBe(true);
      expect(response.body.hasPushToken).toBe(true);
    });

    it("should return false for disabled notifications", async () => {
      const mockUser = {
        id: 1,
        notifications: [],
        expoPushToken: null,
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .get("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBe(false);
      expect(response.body.pushNotifications).toBe(false);
      expect(response.body.hasPushToken).toBe(false);
    });

    it("should handle null notifications array", async () => {
      const mockUser = {
        id: 1,
        notifications: null,
        expoPushToken: null,
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .get("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBe(false);
      expect(response.body.pushNotifications).toBe(false);
    });

    it("should return 404 if user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 401 or 403 for invalid auth token", async () => {
      const response = await request(app)
        .get("/api/v1/push-notifications/preferences")
        .set("Authorization", "Bearer invalid_token");

      expect([401, 403]).toContain(response.status);
    });
  });

  describe("PATCH /preferences", () => {
    it("should update preferences to enable both email and push", async () => {
      const mockUser = {
        id: 1,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .patch("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ emailNotifications: true, pushNotifications: true });

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBe(true);
      expect(response.body.pushNotifications).toBe(true);
      expect(mockUser.update).toHaveBeenCalledWith({
        notifications: ["email", "phone"],
      });
    });

    it("should update preferences to disable both", async () => {
      const mockUser = {
        id: 1,
        notifications: ["email", "phone"],
        update: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .patch("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ emailNotifications: false, pushNotifications: false });

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBe(false);
      expect(response.body.pushNotifications).toBe(false);
      expect(mockUser.update).toHaveBeenCalledWith({
        notifications: [],
      });
    });

    it("should update preferences to enable only email", async () => {
      const mockUser = {
        id: 1,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .patch("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ emailNotifications: true, pushNotifications: false });

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBe(true);
      expect(response.body.pushNotifications).toBe(false);
      expect(mockUser.update).toHaveBeenCalledWith({
        notifications: ["email"],
      });
    });

    it("should update preferences to enable only push", async () => {
      const mockUser = {
        id: 1,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .patch("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ emailNotifications: false, pushNotifications: true });

      expect(response.status).toBe(200);
      expect(response.body.emailNotifications).toBe(false);
      expect(response.body.pushNotifications).toBe(true);
      expect(mockUser.update).toHaveBeenCalledWith({
        notifications: ["phone"],
      });
    });

    it("should return 404 if user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ emailNotifications: true, pushNotifications: true });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 401 or 403 for invalid auth token", async () => {
      const response = await request(app)
        .patch("/api/v1/push-notifications/preferences")
        .set("Authorization", "Bearer invalid_token")
        .send({ emailNotifications: true, pushNotifications: true });

      expect([401, 403]).toContain(response.status);
    });

    it("should handle database errors gracefully", async () => {
      User.findByPk.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .patch("/api/v1/push-notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ emailNotifications: true, pushNotifications: true });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to update notification preferences");
    });
  });
});
