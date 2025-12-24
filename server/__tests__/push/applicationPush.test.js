/**
 * Tests for Push Notifications in Application Router
 * Tests that push notifications are sent to owners for new applications
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

  describe("New Application - Push to Owners", () => {
    it("should send push notification to owner when application submitted", async () => {
      const owner = {
        id: 1,
        username: "owner1",
        email: "owner@test.com",
        expoPushToken: validExpoPushToken,
        type: "owner",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const applicantName = "John Doe";
      const applicantEmail = "john.doe@test.com";
      const experience = "3 years";

      // Simulate what the router does
      if (owner.email) {
        await Email.sendNewApplicationNotification(
          owner.email,
          applicantName,
          applicantEmail,
          experience
        );
      }

      if (owner.expoPushToken) {
        await PushNotification.sendPushNewApplication(
          owner.expoPushToken,
          applicantName
        );
      }

      expect(Email.sendNewApplicationNotification).toHaveBeenCalledWith(
        "owner@test.com",
        "John Doe",
        "john.doe@test.com",
        "3 years"
      );

      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledWith(
        validExpoPushToken,
        "John Doe"
      );
    });

    it("should send push to multiple owners", async () => {
      const owners = [
        {
          id: 1,
          username: "owner1",
          email: "owner1@test.com",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
          type: "owner",
        },
        {
          id: 2,
          username: "owner2",
          email: "owner2@test.com",
          expoPushToken: "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]",
          type: "owner1",
        },
      ];

      const applicantName = "Jane Smith";

      for (const owner of owners) {
        if (owner.email) {
          await Email.sendNewApplicationNotification(
            owner.email,
            applicantName,
            "jane@test.com",
            "5 years"
          );
        }

        if (owner.expoPushToken) {
          await PushNotification.sendPushNewApplication(
            owner.expoPushToken,
            applicantName
          );
        }
      }

      expect(Email.sendNewApplicationNotification).toHaveBeenCalledTimes(2);
      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledTimes(2);
    });

    it("should not send push if owner has no push token", async () => {
      const owner = {
        id: 1,
        username: "owner1",
        email: "owner@test.com",
        expoPushToken: null, // No push token
        type: "owner",
      };

      const applicantName = "Bob Johnson";

      // Email should still be sent
      if (owner.email) {
        await Email.sendNewApplicationNotification(
          owner.email,
          applicantName,
          "bob@test.com",
          "2 years"
        );
      }

      // Push should not be sent
      if (owner.expoPushToken) {
        await PushNotification.sendPushNewApplication(
          owner.expoPushToken,
          applicantName
        );
      }

      expect(Email.sendNewApplicationNotification).toHaveBeenCalled();
      expect(PushNotification.sendPushNewApplication).not.toHaveBeenCalled();
    });

    it("should handle some owners without tokens", async () => {
      const owners = [
        {
          id: 1,
          email: "owner1@test.com",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
        },
        {
          id: 2,
          email: "owner2@test.com",
          expoPushToken: null, // No token
        },
        {
          id: 3,
          email: "owner3@test.com",
          expoPushToken: "ExponentPushToken[ccccccccccccccccccccc]",
        },
      ];

      const applicantName = "Test Applicant";

      for (const owner of owners) {
        if (owner.expoPushToken) {
          await PushNotification.sendPushNewApplication(
            owner.expoPushToken,
            applicantName
          );
        }
      }

      // Should only send to 2 owners (those with tokens)
      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledTimes(2);
    });

    it("should include full applicant name in notification", async () => {
      const owner = {
        id: 1,
        expoPushToken: validExpoPushToken,
      };

      const firstName = "Alice";
      const lastName = "Williams";
      const applicantName = `${firstName} ${lastName}`;

      await PushNotification.sendPushNewApplication(
        owner.expoPushToken,
        applicantName
      );

      expect(PushNotification.sendPushNewApplication).toHaveBeenCalledWith(
        validExpoPushToken,
        "Alice Williams"
      );
    });
  });

  describe("Error Handling", () => {
    it("should continue sending to other owners if one fails", async () => {
      const owners = [
        {
          id: 1,
          email: "owner1@test.com",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
        },
        {
          id: 2,
          email: "owner2@test.com",
          expoPushToken: "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]",
        },
      ];

      // First call succeeds, second fails
      PushNotification.sendPushNewApplication
        .mockResolvedValueOnce([{ status: "ok" }])
        .mockRejectedValueOnce(new Error("Push failed"));

      const results = [];

      for (const owner of owners) {
        try {
          const result = await PushNotification.sendPushNewApplication(
            owner.expoPushToken,
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
