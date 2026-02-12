/**
 * Notifications Router Tests
 * Tests for notification endpoints including get by ID, mark as read, etc.
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  Notification: {
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
    getUnreadCount: jest.fn(),
    getActionRequiredCount: jest.fn(),
    markAllAsRead: jest.fn(),
  },
  UserAppointments: {},
  CleanerClient: {},
  User: {
    findByPk: jest.fn().mockResolvedValue({ id: 5, email: "test@test.com" }),
  },
}));

const { Notification } = require("../../models");

describe("Notifications Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeAll(() => {
    process.env.SESSION_SECRET = secretKey;

    app = express();
    app.use(express.json());

    const notificationsRouter = require("../../routes/api/v1/notificationsRouter");
    app.use("/api/v1/notifications", notificationsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app).get("/api/v1/notifications");

      expect(res.status).toBe(401);
      // Middleware may return 'error' or 'message' field
      expect(res.body.error || res.body.message).toBeDefined();
    });

    it("should return error with invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", "Bearer invalid_token");

      // Middleware returns 403 for invalid token (vs 401 for missing)
      expect([401, 403]).toContain(res.status);
      expect(res.body.error || res.body.message).toBeDefined();
    });
  });

  describe("GET /notifications", () => {
    it("should return paginated notifications for authenticated user", async () => {
      const mockNotifications = [
        {
          id: 1,
          userId: 5,
          type: "client_booked_appointment",
          title: "New Client Appointment",
          body: "John booked a cleaning for Feb 15, 2026",
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 5,
          type: "booking_accepted",
          title: "Booking Accepted!",
          body: "Jane accepted your booking",
          isRead: true,
          createdAt: new Date(),
        },
      ];

      Notification.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockNotifications,
      });

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(2);
      expect(res.body.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it("should support pagination parameters", async () => {
      Notification.findAndCountAll.mockResolvedValue({
        count: 50,
        rows: [],
      });

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications?page=2&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Notification.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10,
        })
      );
    });

    it("should filter expired pending_booking notifications", async () => {
      const expiredNotification = {
        id: 1,
        userId: 5,
        type: "pending_booking",
        expiresAt: new Date(Date.now() - 1000), // expired
      };

      const validNotification = {
        id: 2,
        userId: 5,
        type: "booking_accepted",
        expiresAt: null,
      };

      Notification.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: [expiredNotification, validNotification],
      });

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].id).toBe(2);
    });
  });

  describe("GET /notifications/:id", () => {
    it("should return a single notification by ID", async () => {
      const mockNotification = {
        id: 1,
        userId: 5,
        type: "client_booked_appointment",
        title: "New Client Appointment",
        body: "John booked a cleaning for Feb 15, 2026",
        data: {
          appointmentId: 100,
          appointmentDate: "2026-02-15",
          clientName: "John Doe",
          homeAddress: "123 Main St",
          price: 15000,
        },
        isRead: false,
        createdAt: "2026-02-12T10:00:00.000Z",
      };

      Notification.findOne.mockResolvedValue(mockNotification);

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notification.id).toBe(1);
      expect(res.body.notification.type).toBe("client_booked_appointment");
      expect(res.body.notification.data.appointmentId).toBe(100);
      expect(Notification.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1", userId: 5 },
        })
      );
    });

    it("should return 404 when notification not found", async () => {
      Notification.findOne.mockResolvedValue(null);

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Notification not found");
    });

    it("should not return notification belonging to another user", async () => {
      // User 5 tries to access user 10's notification
      Notification.findOne.mockResolvedValue(null); // findOne filters by userId

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(Notification.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1", userId: 5 },
        })
      );
    });

    it("should not allow access to other users notifications", async () => {
      // User 5 tries to access a notification, but the query finds nothing
      // because the notification belongs to a different user
      Notification.findOne.mockResolvedValue(null);

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Notification not found");
    });
  });

  describe("GET /notifications/unread-count", () => {
    it("should return unread and action required counts", async () => {
      // Set up mocks before making request
      Notification.getUnreadCount.mockResolvedValue(5);
      Notification.getActionRequiredCount.mockResolvedValue(2);

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications/unread-count")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(5);
      expect(res.body.actionRequiredCount).toBe(2);
    });
  });

  describe("PATCH /notifications/:id/read", () => {
    it("should mark notification as read", async () => {
      const mockNotification = {
        id: 1,
        userId: 5,
        isRead: false,
        update: jest.fn().mockResolvedValue({ id: 1, isRead: true }),
      };

      Notification.findOne.mockResolvedValue(mockNotification);

      const token = generateToken(5);
      const res = await request(app)
        .patch("/api/v1/notifications/1/read")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Notification marked as read");
      expect(mockNotification.update).toHaveBeenCalledWith({ isRead: true });
    });

    it("should return 404 when notification not found", async () => {
      Notification.findOne.mockResolvedValue(null);

      const token = generateToken(5);
      const res = await request(app)
        .patch("/api/v1/notifications/999/read")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Notification not found");
    });
  });

  describe("POST /notifications/mark-all-read", () => {
    it("should mark all notifications as read", async () => {
      Notification.markAllAsRead.mockResolvedValue([10]); // Returns array with count

      const token = generateToken(5);
      const res = await request(app)
        .post("/api/v1/notifications/mark-all-read")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("All notifications marked as read");
      expect(res.body.updatedCount).toBe(10);
      expect(Notification.markAllAsRead).toHaveBeenCalledWith(5);
    });
  });

  describe("DELETE /notifications/:id", () => {
    it("should delete a notification", async () => {
      const mockNotification = {
        id: 1,
        userId: 5,
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      Notification.findOne.mockResolvedValue(mockNotification);

      const token = generateToken(5);
      const res = await request(app)
        .delete("/api/v1/notifications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Notification deleted");
      expect(mockNotification.destroy).toHaveBeenCalled();
    });

    it("should return 404 when notification not found", async () => {
      Notification.findOne.mockResolvedValue(null);

      const token = generateToken(5);
      const res = await request(app)
        .delete("/api/v1/notifications/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Notification not found");
    });
  });

  describe("POST /notifications/clear-all", () => {
    it("should clear all notifications for user", async () => {
      Notification.destroy.mockResolvedValue(15);

      const token = generateToken(5);
      const res = await request(app)
        .post("/api/v1/notifications/clear-all")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("All notifications cleared");
      expect(Notification.destroy).toHaveBeenCalledWith({
        where: { userId: 5 },
      });
    });
  });

  describe("Client Booked Appointment Notification Flow", () => {
    it("should return client_booked_appointment notification with full data", async () => {
      const mockNotification = {
        id: 1,
        userId: 5,
        type: "client_booked_appointment",
        title: "New Client Appointment",
        body: "John Doe booked a cleaning for Saturday, Feb 15, 2026. Tap to view and assign.",
        data: {
          appointmentId: 100,
          appointmentDate: "2026-02-15",
          clientId: 10,
          clientName: "John Doe",
          homeAddress: "123 Main St, Anytown",
          price: 15000,
        },
        actionRequired: true,
        relatedAppointmentId: 100,
        isRead: false,
        createdAt: new Date("2026-02-14T10:00:00Z"),
      };

      Notification.findOne.mockResolvedValue(mockNotification);

      const token = generateToken(5);
      const res = await request(app)
        .get("/api/v1/notifications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notification.type).toBe("client_booked_appointment");
      expect(res.body.notification.data.appointmentId).toBe(100);
      expect(res.body.notification.data.clientName).toBe("John Doe");
      expect(res.body.notification.data.price).toBe(15000);
      expect(res.body.notification.actionRequired).toBe(true);
    });
  });
});
