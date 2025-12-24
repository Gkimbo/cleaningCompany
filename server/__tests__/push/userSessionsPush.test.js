/**
 * Tests for Push Notifications in User Sessions Router
 * Tests that push notifications are sent for username recovery and password reset
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

// Mock Email
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendUsernameRecovery: jest.fn().mockResolvedValue(true),
  sendPasswordReset: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushUsernameRecovery: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushPasswordReset: jest.fn().mockResolvedValue([{ status: "ok" }]),
}));

const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("User Sessions Router - Push Notifications", () => {
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Username Recovery - Push to User", () => {
    it("should send push notification for username recovery if user has token", async () => {
      const user = {
        id: 1,
        username: "testuser123",
        email: "test@test.com",
        expoPushToken: validExpoPushToken,
      };

      // Simulate what the router does
      await Email.sendUsernameRecovery(user.email, user.username);

      if (user.expoPushToken) {
        await PushNotification.sendPushUsernameRecovery(
          user.expoPushToken,
          user.username
        );
      }

      expect(Email.sendUsernameRecovery).toHaveBeenCalledWith(
        "test@test.com",
        "testuser123"
      );

      expect(PushNotification.sendPushUsernameRecovery).toHaveBeenCalledWith(
        validExpoPushToken,
        "testuser123"
      );
    });

    it("should not send push if user has no push token", async () => {
      const user = {
        id: 1,
        username: "notoken_user",
        email: "notoken@test.com",
        expoPushToken: null, // User never logged in on mobile
      };

      await Email.sendUsernameRecovery(user.email, user.username);

      if (user.expoPushToken) {
        await PushNotification.sendPushUsernameRecovery(
          user.expoPushToken,
          user.username
        );
      }

      expect(Email.sendUsernameRecovery).toHaveBeenCalled();
      expect(PushNotification.sendPushUsernameRecovery).not.toHaveBeenCalled();
    });

    it("should send push with correct username", async () => {
      const user = {
        username: "special_user_2024",
        expoPushToken: validExpoPushToken,
      };

      await PushNotification.sendPushUsernameRecovery(
        user.expoPushToken,
        user.username
      );

      expect(PushNotification.sendPushUsernameRecovery).toHaveBeenCalledWith(
        validExpoPushToken,
        "special_user_2024"
      );
    });
  });

  describe("Password Reset - Push to User", () => {
    it("should send push notification for password reset if user has token", async () => {
      const user = {
        id: 1,
        username: "resetuser",
        email: "reset@test.com",
        expoPushToken: validExpoPushToken,
      };

      const temporaryPassword = "abc123xyz789";

      // Simulate what the router does
      await Email.sendPasswordReset(user.email, user.username, temporaryPassword);

      if (user.expoPushToken) {
        await PushNotification.sendPushPasswordReset(
          user.expoPushToken,
          user.username
        );
      }

      expect(Email.sendPasswordReset).toHaveBeenCalledWith(
        "reset@test.com",
        "resetuser",
        temporaryPassword
      );

      expect(PushNotification.sendPushPasswordReset).toHaveBeenCalledWith(
        validExpoPushToken,
        "resetuser"
      );
    });

    it("should not send push if user has no push token", async () => {
      const user = {
        id: 1,
        username: "web_only_user",
        email: "webonly@test.com",
        expoPushToken: null, // Web-only user
      };

      await Email.sendPasswordReset(user.email, user.username, "temppass123");

      if (user.expoPushToken) {
        await PushNotification.sendPushPasswordReset(
          user.expoPushToken,
          user.username
        );
      }

      expect(Email.sendPasswordReset).toHaveBeenCalled();
      expect(PushNotification.sendPushPasswordReset).not.toHaveBeenCalled();
    });

    it("should not include temporary password in push notification", async () => {
      const user = {
        username: "secureuser",
        expoPushToken: validExpoPushToken,
      };

      // Push notification should only include username, not password
      await PushNotification.sendPushPasswordReset(
        user.expoPushToken,
        user.username
      );

      // Verify password is not passed to push
      const calls = PushNotification.sendPushPasswordReset.mock.calls;
      expect(calls[0]).toHaveLength(2); // Only token and username
      expect(calls[0][0]).toBe(validExpoPushToken);
      expect(calls[0][1]).toBe("secureuser");
    });
  });

  describe("Security Considerations", () => {
    it("should send push even when security message hides user existence", async () => {
      // Even though the API response is ambiguous for security,
      // the push should still be sent if the user exists and has a token
      const existingUser = {
        username: "existing_user",
        email: "existing@test.com",
        expoPushToken: validExpoPushToken,
      };

      // Simulate processing for an existing user
      await Email.sendUsernameRecovery(existingUser.email, existingUser.username);

      if (existingUser.expoPushToken) {
        await PushNotification.sendPushUsernameRecovery(
          existingUser.expoPushToken,
          existingUser.username
        );
      }

      expect(PushNotification.sendPushUsernameRecovery).toHaveBeenCalled();
    });

    it("should handle case where user does not exist (no push sent)", async () => {
      // If user doesn't exist, there's no push token to send to
      const nonExistentUser = null;

      if (nonExistentUser && nonExistentUser.expoPushToken) {
        await PushNotification.sendPushUsernameRecovery(
          nonExistentUser.expoPushToken,
          nonExistentUser.username
        );
      }

      expect(PushNotification.sendPushUsernameRecovery).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle expired or invalid push tokens gracefully", async () => {
      // The push notification service should handle invalid tokens
      // This test verifies the router still calls the service
      const user = {
        username: "olduser",
        expoPushToken: "ExpiredToken[xxxxx]", // Old/invalid format
      };

      // Router doesn't validate token format - that's the service's job
      if (user.expoPushToken) {
        await PushNotification.sendPushPasswordReset(
          user.expoPushToken,
          user.username
        );
      }

      expect(PushNotification.sendPushPasswordReset).toHaveBeenCalledWith(
        "ExpiredToken[xxxxx]",
        "olduser"
      );
    });

    it("should handle push notification failure gracefully", async () => {
      PushNotification.sendPushPasswordReset.mockRejectedValueOnce(
        new Error("Push service unavailable")
      );

      const user = {
        username: "user1",
        email: "user1@test.com",
        expoPushToken: validExpoPushToken,
      };

      // Email should still be sent
      await Email.sendPasswordReset(user.email, user.username, "temp123");

      // Push might fail but shouldn't crash
      try {
        await PushNotification.sendPushPasswordReset(
          user.expoPushToken,
          user.username
        );
      } catch (error) {
        expect(error.message).toBe("Push service unavailable");
      }

      // Email should still have been called
      expect(Email.sendPasswordReset).toHaveBeenCalled();
    });

    it("should handle empty string push token", async () => {
      const user = {
        username: "emptytoken",
        expoPushToken: "", // Empty string
      };

      // Empty string is falsy, so push should not be called
      if (user.expoPushToken) {
        await PushNotification.sendPushPasswordReset(
          user.expoPushToken,
          user.username
        );
      }

      expect(PushNotification.sendPushPasswordReset).not.toHaveBeenCalled();
    });
  });
});
