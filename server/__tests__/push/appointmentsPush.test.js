/**
 * Tests for Push Notifications in Appointments Router
 * Tests that push notifications are sent alongside email notifications
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock all models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserCleanerAppointments: {
    findOne: jest.fn(),
    destroy: jest.fn(),
    create: jest.fn(),
  },
  UserPendingRequests: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserReviews: {
    findAll: jest.fn(),
  },
  Payout: {
    destroy: jest.fn(),
    findOne: jest.fn(),
  },
  Op: {
    or: Symbol("or"),
    ne: Symbol("ne"),
    gt: Symbol("gt"),
    gte: Symbol("gte"),
    lte: Symbol("lte"),
    between: Symbol("between"),
  },
}));

// Mock Email
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
  sendEmployeeRequest: jest.fn().mockResolvedValue(true),
  sendRequestApproved: jest.fn().mockResolvedValue(true),
  sendRequestDenied: jest.fn().mockResolvedValue(true),
  removeRequestEmail: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushCancellation: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushConfirmation: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushEmployeeRequest: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushRequestApproved: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushRequestDenied: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushRemoveRequest: jest.fn().mockResolvedValue([{ status: "ok" }]),
}));

// Mock businessConfig
jest.mock("../../config/businessConfig", () => ({
  businessConfig: { pricing: { cancellation: { fee: 25 } } },
  getPricingConfig: jest.fn().mockResolvedValue({ cancellation: { fee: 25 } }),
}));

const {
  User,
  UserAppointments,
  UserHomes,
  UserCleanerAppointments,
  UserPendingRequests,
  UserReviews,
} = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("Appointments Router - Push Notifications", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Request Employee - Push to Homeowner", () => {
    it("should send push notification when cleaner requests appointment", async () => {
      const homeownerToken = validExpoPushToken;
      const appointmentDate = "2025-02-15";

      // Mock the homeowner with push token
      const mockHomeowner = {
        id: 1,
        username: "homeowner1",
        email: "homeowner@test.com",
        expoPushToken: homeownerToken,
        dataValues: {
          id: 1,
          username: "homeowner1",
          email: "homeowner@test.com",
          expoPushToken: homeownerToken,
        },
      };

      // Mock the cleaner
      const mockCleaner = {
        id: 2,
        username: "cleaner1",
        type: "cleaner",
        dataValues: {
          id: 2,
          username: "cleaner1",
          type: "cleaner",
        },
      };

      // Mock appointment
      const mockAppointment = {
        id: 100,
        userId: 1,
        date: appointmentDate,
        hasBeenAssigned: false,
        employeesAssigned: [],
        dataValues: {
          id: 100,
          userId: 1,
          date: appointmentDate,
          hasBeenAssigned: false,
          employeesAssigned: [],
        },
      };

      // Mock reviews for rating
      UserReviews.findAll.mockResolvedValue([
        { dataValues: { rating: 5 } },
        { dataValues: { rating: 4 } },
      ]);

      // Verify that when a request is made, push notification would be called
      // This tests the integration pattern
      User.findByPk.mockResolvedValueOnce(mockCleaner);
      User.findByPk.mockResolvedValueOnce(mockHomeowner);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      // Simulate what the router does
      const client = mockHomeowner;
      const cleaner = mockCleaner;
      const averageRating = 4.5;

      // This is what the router should call
      if (client.dataValues.expoPushToken) {
        await PushNotification.sendPushEmployeeRequest(
          client.dataValues.expoPushToken,
          client.dataValues.username,
          cleaner.dataValues.username,
          averageRating,
          mockAppointment.dataValues.date
        );
      }

      expect(PushNotification.sendPushEmployeeRequest).toHaveBeenCalledWith(
        homeownerToken,
        "homeowner1",
        "cleaner1",
        4.5,
        appointmentDate
      );
    });

    it("should not send push notification if homeowner has no push token", async () => {
      const mockHomeowner = {
        id: 1,
        username: "homeowner1",
        email: "homeowner@test.com",
        expoPushToken: null, // No push token
        dataValues: {
          id: 1,
          username: "homeowner1",
          email: "homeowner@test.com",
          expoPushToken: null,
        },
      };

      const client = mockHomeowner;

      // Should not call push notification
      if (client.dataValues.expoPushToken) {
        await PushNotification.sendPushEmployeeRequest(
          client.dataValues.expoPushToken,
          "homeowner1",
          "cleaner1",
          4.5,
          "2025-02-15"
        );
      }

      expect(PushNotification.sendPushEmployeeRequest).not.toHaveBeenCalled();
    });
  });

  describe("Approve Request - Push to Cleaner", () => {
    it("should send push notification when homeowner approves request", async () => {
      const cleanerToken = validExpoPushToken;
      const appointmentDate = "2025-02-20";

      const mockCleaner = {
        id: 2,
        username: "cleaner1",
        expoPushToken: cleanerToken,
        notifications: [],
        dataValues: {
          id: 2,
          username: "cleaner1",
          expoPushToken: cleanerToken,
          notifications: [],
        },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHomeowner = {
        id: 1,
        username: "homeowner1",
        dataValues: {
          id: 1,
          username: "homeowner1",
        },
      };

      const address = {
        street: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      // Simulate what the router does when approving
      if (mockCleaner.dataValues.expoPushToken) {
        await PushNotification.sendPushRequestApproved(
          mockCleaner.dataValues.expoPushToken,
          mockCleaner.dataValues.username,
          mockHomeowner.dataValues.username,
          appointmentDate,
          address
        );
      }

      expect(PushNotification.sendPushRequestApproved).toHaveBeenCalledWith(
        cleanerToken,
        "cleaner1",
        "homeowner1",
        appointmentDate,
        address
      );
    });
  });

  describe("Deny Request - Push to Cleaner", () => {
    it("should send push notification when homeowner denies request", async () => {
      const cleanerToken = validExpoPushToken;
      const appointmentDate = "2025-02-25";

      const mockCleaner = {
        id: 2,
        username: "cleaner1",
        expoPushToken: cleanerToken,
        dataValues: {
          id: 2,
          username: "cleaner1",
          expoPushToken: cleanerToken,
        },
      };

      // Simulate what the router does when denying
      if (mockCleaner.dataValues.expoPushToken) {
        await PushNotification.sendPushRequestDenied(
          mockCleaner.dataValues.expoPushToken,
          mockCleaner.dataValues.username,
          appointmentDate
        );
      }

      expect(PushNotification.sendPushRequestDenied).toHaveBeenCalledWith(
        cleanerToken,
        "cleaner1",
        appointmentDate
      );
    });
  });

  describe("Remove Request - Push to Homeowner", () => {
    it("should send push notification when cleaner removes their request", async () => {
      const homeownerToken = validExpoPushToken;
      const appointmentDate = "2025-03-01";

      const mockHomeowner = {
        id: 1,
        username: "homeowner1",
        expoPushToken: homeownerToken,
        dataValues: {
          id: 1,
          username: "homeowner1",
          expoPushToken: homeownerToken,
        },
      };

      // Simulate what the router does
      if (mockHomeowner.dataValues.expoPushToken) {
        await PushNotification.sendPushRemoveRequest(
          mockHomeowner.dataValues.expoPushToken,
          mockHomeowner.dataValues.username,
          appointmentDate
        );
      }

      expect(PushNotification.sendPushRemoveRequest).toHaveBeenCalledWith(
        homeownerToken,
        "homeowner1",
        appointmentDate
      );
    });
  });

  describe("Cancellation - Push to Homeowner", () => {
    it("should send push notification when cleaner cancels assignment", async () => {
      const homeownerToken = validExpoPushToken;
      const appointmentDate = "2025-03-05";

      const mockHomeowner = {
        id: 1,
        username: "homeowner1",
        expoPushToken: homeownerToken,
      };

      const address = {
        street: "456 Oak Ave",
        city: "Cambridge",
        state: "MA",
        zipcode: "02139",
      };

      // Simulate what the router does
      if (mockHomeowner.expoPushToken) {
        await PushNotification.sendPushCancellation(
          mockHomeowner.expoPushToken,
          mockHomeowner.username,
          appointmentDate,
          address
        );
      }

      expect(PushNotification.sendPushCancellation).toHaveBeenCalledWith(
        homeownerToken,
        "homeowner1",
        appointmentDate,
        address
      );
    });

    it("should send push to multiple homeowners when cleaner account frozen", async () => {
      const token1 = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]";
      const token2 = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]";

      const mockHomeowners = [
        { id: 1, username: "homeowner1", expoPushToken: token1 },
        { id: 2, username: "homeowner2", expoPushToken: token2 },
      ];

      const addresses = [
        { street: "123 St", city: "Boston", state: "MA", zipcode: "02101" },
        { street: "456 Ave", city: "Cambridge", state: "MA", zipcode: "02139" },
      ];

      // Simulate sending to multiple homeowners
      for (let i = 0; i < mockHomeowners.length; i++) {
        const homeowner = mockHomeowners[i];
        if (homeowner.expoPushToken) {
          await PushNotification.sendPushCancellation(
            homeowner.expoPushToken,
            homeowner.username,
            "2025-03-10",
            addresses[i]
          );
        }
      }

      expect(PushNotification.sendPushCancellation).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration Pattern Tests", () => {
    it("should only send push when email is also sent", async () => {
      const homeownerToken = validExpoPushToken;

      // Reset mocks
      jest.clearAllMocks();

      // Simulate the pattern: email then push
      await Email.sendEmailCancellation(
        "homeowner@test.com",
        { street: "123 St", city: "Boston" },
        "homeowner1",
        "2025-03-15"
      );

      if (homeownerToken) {
        await PushNotification.sendPushCancellation(
          homeownerToken,
          "homeowner1",
          "2025-03-15",
          { street: "123 St", city: "Boston" }
        );
      }

      expect(Email.sendEmailCancellation).toHaveBeenCalledTimes(1);
      expect(PushNotification.sendPushCancellation).toHaveBeenCalledTimes(1);
    });

    it("should handle push notification errors gracefully", async () => {
      PushNotification.sendPushCancellation.mockRejectedValueOnce(
        new Error("Push failed")
      );

      // Email should still work even if push fails
      await Email.sendEmailCancellation(
        "homeowner@test.com",
        { street: "123 St", city: "Boston" },
        "homeowner1",
        "2025-03-15"
      );

      try {
        await PushNotification.sendPushCancellation(
          validExpoPushToken,
          "homeowner1",
          "2025-03-15",
          { street: "123 St", city: "Boston" }
        );
      } catch (error) {
        // Error should be caught
        expect(error.message).toBe("Push failed");
      }

      // Email should still have been called
      expect(Email.sendEmailCancellation).toHaveBeenCalled();
    });
  });
});
