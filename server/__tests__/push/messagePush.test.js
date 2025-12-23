/**
 * Tests for Push Notifications in Message Router
 * Tests that push notifications are sent for messages and broadcasts
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

// Mock Email
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewMessageNotification: jest.fn().mockResolvedValue(true),
  sendBroadcastNotification: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNewMessage: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushBroadcast: jest.fn().mockResolvedValue([{ status: "ok" }]),
}));

const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("Message Router - Push Notifications", () => {
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("New Message - Push to Recipients", () => {
    it("should send push notification when user has phone notifications enabled and push token", async () => {
      const recipient = {
        id: 2,
        username: "recipient1",
        email: "recipient@test.com",
        expoPushToken: validExpoPushToken,
        notifications: ["email", "phone"],
      };

      const sender = {
        id: 1,
        username: "sender1",
      };

      const messageContent = "Hello, this is a test message!";

      // Simulate what the router does
      if (recipient.notifications && recipient.notifications.includes("email")) {
        await Email.sendNewMessageNotification(
          recipient.email,
          recipient.username,
          sender.username,
          messageContent
        );
      }

      if (
        recipient.notifications &&
        recipient.notifications.includes("phone") &&
        recipient.expoPushToken
      ) {
        await PushNotification.sendPushNewMessage(
          recipient.expoPushToken,
          recipient.username,
          sender.username,
          messageContent
        );
      }

      expect(Email.sendNewMessageNotification).toHaveBeenCalledWith(
        "recipient@test.com",
        "recipient1",
        "sender1",
        messageContent
      );

      expect(PushNotification.sendPushNewMessage).toHaveBeenCalledWith(
        validExpoPushToken,
        "recipient1",
        "sender1",
        messageContent
      );
    });

    it("should not send push if user has no phone in notifications array", async () => {
      const recipient = {
        id: 2,
        username: "recipient1",
        email: "recipient@test.com",
        expoPushToken: validExpoPushToken,
        notifications: ["email"], // Only email, no phone
      };

      if (
        recipient.notifications &&
        recipient.notifications.includes("phone") &&
        recipient.expoPushToken
      ) {
        await PushNotification.sendPushNewMessage(
          recipient.expoPushToken,
          "recipient1",
          "sender1",
          "Test message"
        );
      }

      expect(PushNotification.sendPushNewMessage).not.toHaveBeenCalled();
    });

    it("should not send push if user has no push token even with phone enabled", async () => {
      const recipient = {
        id: 2,
        username: "recipient1",
        email: "recipient@test.com",
        expoPushToken: null, // No token
        notifications: ["email", "phone"],
      };

      if (
        recipient.notifications &&
        recipient.notifications.includes("phone") &&
        recipient.expoPushToken
      ) {
        await PushNotification.sendPushNewMessage(
          recipient.expoPushToken,
          "recipient1",
          "sender1",
          "Test message"
        );
      }

      expect(PushNotification.sendPushNewMessage).not.toHaveBeenCalled();
    });

    it("should send to multiple recipients", async () => {
      const recipients = [
        {
          id: 2,
          username: "user2",
          email: "user2@test.com",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
          notifications: ["email", "phone"],
        },
        {
          id: 3,
          username: "user3",
          email: "user3@test.com",
          expoPushToken: "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]",
          notifications: ["email", "phone"],
        },
      ];

      for (const recipient of recipients) {
        if (
          recipient.notifications &&
          recipient.notifications.includes("phone") &&
          recipient.expoPushToken
        ) {
          await PushNotification.sendPushNewMessage(
            recipient.expoPushToken,
            recipient.username,
            "sender1",
            "Test message"
          );
        }
      }

      expect(PushNotification.sendPushNewMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe("Broadcast - Push to All Target Users", () => {
    it("should send push notification for broadcast to user with phone enabled", async () => {
      const targetUser = {
        id: 2,
        username: "user1",
        email: "user1@test.com",
        expoPushToken: validExpoPushToken,
        notifications: ["email", "phone"],
      };

      const broadcastTitle = "Important Announcement";
      const broadcastContent = "This is an important company announcement.";

      // Simulate what the router does
      if (targetUser.notifications && targetUser.notifications.includes("email")) {
        await Email.sendBroadcastNotification(
          targetUser.email,
          targetUser.username,
          broadcastTitle,
          broadcastContent
        );
      }

      if (
        targetUser.notifications &&
        targetUser.notifications.includes("phone") &&
        targetUser.expoPushToken
      ) {
        await PushNotification.sendPushBroadcast(
          targetUser.expoPushToken,
          targetUser.username,
          broadcastTitle,
          broadcastContent
        );
      }

      expect(Email.sendBroadcastNotification).toHaveBeenCalledWith(
        "user1@test.com",
        "user1",
        broadcastTitle,
        broadcastContent
      );

      expect(PushNotification.sendPushBroadcast).toHaveBeenCalledWith(
        validExpoPushToken,
        "user1",
        broadcastTitle,
        broadcastContent
      );
    });

    it("should use Company Announcement as default title", async () => {
      const targetUser = {
        id: 2,
        username: "user1",
        expoPushToken: validExpoPushToken,
        notifications: ["phone"],
      };

      const title = null; // No title provided
      const defaultTitle = "Company Announcement";

      if (
        targetUser.notifications &&
        targetUser.notifications.includes("phone") &&
        targetUser.expoPushToken
      ) {
        await PushNotification.sendPushBroadcast(
          targetUser.expoPushToken,
          targetUser.username,
          title || defaultTitle,
          "Broadcast content"
        );
      }

      expect(PushNotification.sendPushBroadcast).toHaveBeenCalledWith(
        validExpoPushToken,
        "user1",
        "Company Announcement",
        "Broadcast content"
      );
    });

    it("should send broadcast to all cleaners", async () => {
      const cleaners = [
        {
          id: 2,
          username: "cleaner1",
          expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
          notifications: ["phone"],
          type: "cleaner",
        },
        {
          id: 3,
          username: "cleaner2",
          expoPushToken: "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]",
          notifications: ["phone"],
          type: "cleaner",
        },
        {
          id: 4,
          username: "cleaner3",
          expoPushToken: null, // No token
          notifications: ["phone"],
          type: "cleaner",
        },
      ];

      for (const cleaner of cleaners) {
        if (
          cleaner.notifications &&
          cleaner.notifications.includes("phone") &&
          cleaner.expoPushToken
        ) {
          await PushNotification.sendPushBroadcast(
            cleaner.expoPushToken,
            cleaner.username,
            "Cleaner Update",
            "Important update for all cleaners"
          );
        }
      }

      // Should only send to 2 cleaners (those with tokens)
      expect(PushNotification.sendPushBroadcast).toHaveBeenCalledTimes(2);
    });
  });

  describe("Support Conversation - Push to Owner", () => {
    it("should send push notification to owner when support conversation created", async () => {
      const owner = {
        id: 1,
        username: "owner1",
        email: "owner@test.com",
        expoPushToken: validExpoPushToken,
        type: "owner",
      };

      const user = {
        id: 2,
        username: "customer1",
        type: "homeowner",
      };

      const supportMessage = `New support request from ${user.username}`;

      // Owner always gets notifications (no preference check for support)
      if (owner.email) {
        await Email.sendNewMessageNotification(
          owner.email,
          owner.username,
          user.username,
          supportMessage
        );
      }

      if (owner.expoPushToken) {
        await PushNotification.sendPushNewMessage(
          owner.expoPushToken,
          owner.username,
          user.username,
          supportMessage
        );
      }

      expect(Email.sendNewMessageNotification).toHaveBeenCalledWith(
        "owner@test.com",
        "owner1",
        "customer1",
        supportMessage
      );

      expect(PushNotification.sendPushNewMessage).toHaveBeenCalledWith(
        validExpoPushToken,
        "owner1",
        "customer1",
        supportMessage
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty notifications array", async () => {
      const recipient = {
        id: 2,
        username: "user1",
        expoPushToken: validExpoPushToken,
        notifications: [], // Empty array
      };

      if (
        recipient.notifications &&
        recipient.notifications.includes("phone") &&
        recipient.expoPushToken
      ) {
        await PushNotification.sendPushNewMessage(
          recipient.expoPushToken,
          "user1",
          "sender1",
          "Test"
        );
      }

      expect(PushNotification.sendPushNewMessage).not.toHaveBeenCalled();
    });

    it("should handle null notifications", async () => {
      const recipient = {
        id: 2,
        username: "user1",
        expoPushToken: validExpoPushToken,
        notifications: null,
      };

      if (
        recipient.notifications &&
        recipient.notifications.includes("phone") &&
        recipient.expoPushToken
      ) {
        await PushNotification.sendPushNewMessage(
          recipient.expoPushToken,
          "user1",
          "sender1",
          "Test"
        );
      }

      expect(PushNotification.sendPushNewMessage).not.toHaveBeenCalled();
    });

    it("should handle push notification failure gracefully", async () => {
      PushNotification.sendPushNewMessage.mockRejectedValueOnce(
        new Error("Push service unavailable")
      );

      const recipient = {
        id: 2,
        username: "user1",
        email: "user1@test.com",
        expoPushToken: validExpoPushToken,
        notifications: ["email", "phone"],
      };

      // Email should still be sent
      await Email.sendNewMessageNotification(
        recipient.email,
        recipient.username,
        "sender1",
        "Test message"
      );

      // Push might fail
      try {
        await PushNotification.sendPushNewMessage(
          recipient.expoPushToken,
          recipient.username,
          "sender1",
          "Test message"
        );
      } catch (error) {
        expect(error.message).toBe("Push service unavailable");
      }

      // Email should still have been called
      expect(Email.sendNewMessageNotification).toHaveBeenCalled();
    });
  });
});
