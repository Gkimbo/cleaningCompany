/**
 * Tests for notification email routing in manager notifications
 * Verifies that manager.getNotificationEmail() is used instead of manager.email
 */

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  UserApplications: {
    findByPk: jest.fn(),
  },
  sequelize: {
    fn: jest.fn(),
    col: jest.fn(),
    literal: jest.fn(),
  },
}));

// Mock Email class
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewApplicationNotification: jest.fn().mockResolvedValue(true),
  sendAdjustmentNeedsManagerReview: jest.fn().mockResolvedValue(true),
}));

// Mock Push notification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNewApplication: jest.fn().mockResolvedValue(true),
  sendPushAdjustmentNeedsReview: jest.fn().mockResolvedValue(true),
}));

// Mock ApplicationInfoClass
jest.mock("../../services/ApplicationInfoClass", () => ({
  addApplicationToDB: jest.fn(),
}));

const { User } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const ApplicationInfoClass = require("../../services/ApplicationInfoClass");

// Import routers
const applicationRouter = require("../../routes/api/v1/applicationRouter");

// Setup express apps
const appApplication = express();
appApplication.use(express.json());
appApplication.use("/api/v1/applications", applicationRouter);

describe("Notification Email Routing", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";

  // Helper to create mock user with getNotificationEmail method
  const createMockUser = (overrides = {}) => {
    const user = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
      email: "john@example.com",
      notificationEmail: null,
      type: "homeowner",
      notifications: ["email", "phone"],
      expoPushToken: null,
      managerPrivateNotes: null,
      update: jest.fn().mockImplementation(function (data) {
        Object.assign(this, data);
        return Promise.resolve(this);
      }),
      ...overrides,
    };
    user.getNotificationEmail = function () {
      return this.notificationEmail || this.email;
    };
    return user;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Application Router - Manager Notification Email", () => {
    const validApplicationData = {
      firstName: "Test",
      lastName: "Applicant",
      email: "applicant@test.com",
      phone: "555-1234",
      experience: "2 years",
      referenceCheckConsent: true,
    };

    it("should send notification to manager's notificationEmail when set", async () => {
      ApplicationInfoClass.addApplicationToDB.mockResolvedValue({
        id: 1,
        ...validApplicationData,
      });

      const mockManager = createMockUser({
        id: 1,
        type: "manager",
        email: "manager@company.com",
        notificationEmail: "manager-alerts@company.com",
      });
      User.findAll.mockResolvedValue([mockManager]);

      const response = await request(appApplication)
        .post("/api/v1/applications/submitted")
        .send(validApplicationData);

      expect(response.status).toBe(201);
      expect(Email.sendNewApplicationNotification).toHaveBeenCalledWith(
        "manager-alerts@company.com", // Should use notificationEmail
        "Test Applicant",
        "applicant@test.com",
        "2 years"
      );
    });

    it("should send notification to manager's main email when notificationEmail is null", async () => {
      ApplicationInfoClass.addApplicationToDB.mockResolvedValue({
        id: 1,
        ...validApplicationData,
      });

      const mockManager = createMockUser({
        id: 1,
        type: "manager",
        email: "manager@company.com",
        notificationEmail: null, // Not set, should fall back to main email
      });
      User.findAll.mockResolvedValue([mockManager]);

      const response = await request(appApplication)
        .post("/api/v1/applications/submitted")
        .send(validApplicationData);

      expect(response.status).toBe(201);
      expect(Email.sendNewApplicationNotification).toHaveBeenCalledWith(
        "manager@company.com", // Should use main email as fallback
        "Test Applicant",
        "applicant@test.com",
        "2 years"
      );
    });

    it("should send to different notification emails for multiple managers", async () => {
      ApplicationInfoClass.addApplicationToDB.mockResolvedValue({
        id: 1,
        ...validApplicationData,
      });

      const managers = [
        createMockUser({
          id: 1,
          type: "manager",
          email: "manager1@company.com",
          notificationEmail: "alerts1@company.com",
        }),
        createMockUser({
          id: 2,
          type: "manager",
          email: "manager2@company.com",
          notificationEmail: null, // Uses main email
        }),
        createMockUser({
          id: 3,
          type: "manager",
          email: "manager3@company.com",
          notificationEmail: "external@gmail.com",
        }),
      ];
      User.findAll.mockResolvedValue(managers);

      const response = await request(appApplication)
        .post("/api/v1/applications/submitted")
        .send(validApplicationData);

      expect(response.status).toBe(201);
      expect(Email.sendNewApplicationNotification).toHaveBeenCalledTimes(3);

      // Check each call used the correct email
      expect(Email.sendNewApplicationNotification).toHaveBeenNthCalledWith(
        1,
        "alerts1@company.com",
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
      expect(Email.sendNewApplicationNotification).toHaveBeenNthCalledWith(
        2,
        "manager2@company.com",
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
      expect(Email.sendNewApplicationNotification).toHaveBeenNthCalledWith(
        3,
        "external@gmail.com",
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  // Note: Home Size Adjustment notification email routing is tested in
  // homeSizeAdjustment.test.js which has the complete mock setup for that router.
  // The key logic (using manager.getNotificationEmail()) is tested there.

  describe("Edge Cases", () => {
    it("should handle manager with empty string notificationEmail", async () => {
      const mockManager = createMockUser({
        type: "manager",
        email: "manager@company.com",
        notificationEmail: "", // Empty string
      });

      // Empty string is falsy, so getNotificationEmail should return main email
      expect(mockManager.getNotificationEmail()).toBe("manager@company.com");
    });

    it("should handle manager changing notificationEmail", async () => {
      const mockManager = createMockUser({
        type: "manager",
        email: "manager@company.com",
        notificationEmail: "old-alerts@company.com",
      });

      expect(mockManager.getNotificationEmail()).toBe("old-alerts@company.com");

      // Simulate updating notification email
      mockManager.notificationEmail = "new-alerts@company.com";

      expect(mockManager.getNotificationEmail()).toBe("new-alerts@company.com");
    });

    it("should handle manager clearing notificationEmail", async () => {
      const mockManager = createMockUser({
        type: "manager",
        email: "manager@company.com",
        notificationEmail: "alerts@company.com",
      });

      expect(mockManager.getNotificationEmail()).toBe("alerts@company.com");

      // Clear notification email
      mockManager.notificationEmail = null;

      expect(mockManager.getNotificationEmail()).toBe("manager@company.com");
    });
  });
});
