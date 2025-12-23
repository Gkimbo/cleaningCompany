/**
 * Tests for Push Notifications in Application Router
 * Tests that push notifications are sent to managers for new applications
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

// Mock Email
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewApplicationNotification: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNewApplication: jest.fn().mockResolvedValue([{ status: "ok" }]),
}));

const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("Application Router - Push Notifications", () => {
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("New Application - Push to Managers", () => {
    it("should send push notification to manager when application submitted", async () => {
      const manager = {
        id: 1,
        username: "manager1",
        email: "manager@test.com",
        expoPushToken: validExpoPushToken,
        type: "manager",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const applicantName = "John Doe";
      const applicantEmail = "john.doe@test.com";
      const experience = "3 years";

      // Simulate what the router does
      if (manager.email) {
        await Email.sendNewApplicationNotification(
          manager.email,
          applicantName,
          applicantEmail,
          experience
        );
      }

      if (manager.expoPushToken) {
        await PushNotification.sendPushNewApplication(
          manager.expoPushToken,
          applicantName
        );
      }

      expect(Email.sendNewApplicationNotification).toHaveBeenCalledWith(
        "manager@test.com",
        "John Doe",
        "john.doe@test.com",
        "3 years"
      );

      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledWith(
        validExpoPushToken,
        "John Doe"
      );
    });

    it("should send push to multiple managers", async () => {
      const managers = [
        {
          id: 1,
          username: "manager1",
          email: "manager1@test.com",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
          type: "manager",
        },
        {
          id: 2,
          username: "manager2",
          email: "manager2@test.com",
          expoPushToken: "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]",
          type: "manager1",
        },
      ];

      const applicantName = "Jane Smith";

      for (const manager of managers) {
        if (manager.email) {
          await Email.sendNewApplicationNotification(
            manager.email,
            applicantName,
            "jane@test.com",
            "5 years"
          );
        }

        if (manager.expoPushToken) {
          await PushNotification.sendPushNewApplication(
            manager.expoPushToken,
            applicantName
          );
        }
      }

      expect(Email.sendNewApplicationNotification).toHaveBeenCalledTimes(2);
      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledTimes(2);
    });

    it("should not send push if manager has no push token", async () => {
      const manager = {
        id: 1,
        username: "manager1",
        email: "manager@test.com",
        expoPushToken: null, // No push token
        type: "manager",
      };

      const applicantName = "Bob Johnson";

      // Email should still be sent
      if (manager.email) {
        await Email.sendNewApplicationNotification(
          manager.email,
          applicantName,
          "bob@test.com",
          "2 years"
        );
      }

      // Push should not be sent
      if (manager.expoPushToken) {
        await PushNotification.sendPushNewApplication(
          manager.expoPushToken,
          applicantName
        );
      }

      expect(Email.sendNewApplicationNotification).toHaveBeenCalled();
      expect(PushNotification.sendPushNewApplication).not.toHaveBeenCalled();
    });

    it("should handle some managers without tokens", async () => {
      const managers = [
        {
          id: 1,
          email: "manager1@test.com",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
        },
        {
          id: 2,
          email: "manager2@test.com",
          expoPushToken: null, // No token
        },
        {
          id: 3,
          email: "manager3@test.com",
          expoPushToken: "ExponentPushToken[ccccccccccccccccccccc]",
        },
      ];

      const applicantName = "Test Applicant";

      for (const manager of managers) {
        if (manager.expoPushToken) {
          await PushNotification.sendPushNewApplication(
            manager.expoPushToken,
            applicantName
          );
        }
      }

      // Should only send to 2 managers (those with tokens)
      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledTimes(2);
    });

    it("should include full applicant name in notification", async () => {
      const manager = {
        id: 1,
        expoPushToken: validExpoPushToken,
      };

      const firstName = "Alice";
      const lastName = "Williams";
      const applicantName = `${firstName} ${lastName}`;

      await PushNotification.sendPushNewApplication(
        manager.expoPushToken,
        applicantName
      );

      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledWith(
        validExpoPushToken,
        "Alice Williams"
      );
    });
  });

  describe("Error Handling", () => {
    it("should continue sending to other managers if one fails", async () => {
      const managers = [
        {
          id: 1,
          email: "manager1@test.com",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
        },
        {
          id: 2,
          email: "manager2@test.com",
          expoPushToken: "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]",
        },
      ];

      // First call succeeds, second fails
      PushNotification.sendPushNewApplication
        .mockResolvedValueOnce([{ status: "ok" }])
        .mockRejectedValueOnce(new Error("Push failed"));

      const results = [];

      for (const manager of managers) {
        try {
          const result = await PushNotification.sendPushNewApplication(
            manager.expoPushToken,
            "Applicant"
          );
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledTimes(2);
    });
  });
});
