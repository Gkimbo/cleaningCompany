const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

// Mock expo-server-sdk
jest.mock("expo-server-sdk", () => {
  const mockSendPushNotificationsAsync = jest.fn().mockResolvedValue([{ status: "ok" }]);
  const mockChunkPushNotifications = jest.fn((messages) => [messages]);
  const mockIsExpoPushToken = jest.fn((token) => token && token.startsWith("ExponentPushToken["));

  return {
    Expo: jest.fn().mockImplementation(() => ({
      sendPushNotificationsAsync: mockSendPushNotificationsAsync,
      chunkPushNotifications: mockChunkPushNotifications,
    })),
    isExpoPushToken: mockIsExpoPushToken,
  };
});

const { Expo } = require("expo-server-sdk");

describe("PushNotificationClass", () => {
  let mockExpo;
  const validToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
  const invalidToken = "invalid-token";

  beforeEach(() => {
    jest.clearAllMocks();
    mockExpo = new Expo();
  });

  describe("isValidExpoPushToken", () => {
    it("should return true for valid Expo push token", () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      expect(PushNotification.isValidExpoPushToken(validToken)).toBe(true);
    });

    it("should return false for invalid token", () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(false);
      expect(PushNotification.isValidExpoPushToken(invalidToken)).toBe(false);
    });

    it("should return false for null token", () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(false);
      expect(PushNotification.isValidExpoPushToken(null)).toBe(false);
    });
  });

  describe("sendPushNotification", () => {
    it("should send notification with valid token", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      const result = await PushNotification.sendPushNotification(
        validToken,
        "Test Title",
        "Test Body",
        { type: "test" }
      );

      expect(result).toBeDefined();
      expect(mockExpo.chunkPushNotifications).toHaveBeenCalled();
      expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalled();
    });

    it("should return null for invalid token", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(false);
      const result = await PushNotification.sendPushNotification(
        invalidToken,
        "Test Title",
        "Test Body"
      );

      expect(result).toBeNull();
      expect(mockExpo.sendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it("should return null for missing token", async () => {
      const result = await PushNotification.sendPushNotification(
        null,
        "Test Title",
        "Test Body"
      );

      expect(result).toBeNull();
    });

    it("should handle send errors gracefully", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      mockExpo.sendPushNotificationsAsync.mockRejectedValueOnce(new Error("Network error"));

      const result = await PushNotification.sendPushNotification(
        validToken,
        "Test Title",
        "Test Body"
      );

      expect(result).toBeNull();
    });

    it("should include sound in notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushNotification(validToken, "Title", "Body");

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].sound).toBe("default");
    });
  });

  describe("sendPushCancellation", () => {
    const address = { street: "123 Main St", city: "Boston" };

    it("should send cancellation notification with correct title", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushCancellation(
        validToken,
        "John",
        "2025-01-15",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Appointment Cancelled");
    });

    it("should include user name in body", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushCancellation(
        validToken,
        "John",
        "2025-01-15",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("John");
    });

    it("should include address in body", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushCancellation(
        validToken,
        "John",
        "2025-01-15",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("123 Main St");
      expect(chunkCall[0].body).toContain("Boston");
    });

    it("should include appointment_cancelled type in data", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushCancellation(
        validToken,
        "John",
        "2025-01-15",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].data.type).toBe("appointment_cancelled");
    });
  });

  describe("sendPushConfirmation", () => {
    const address = { street: "456 Oak Ave", city: "Cambridge" };

    it("should send confirmation notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushConfirmation(
        validToken,
        "Jane",
        "2025-01-20",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Cleaning Confirmed!");
      expect(chunkCall[0].data.type).toBe("appointment_confirmed");
    });

    it("should include Great news in body", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushConfirmation(
        validToken,
        "Jane",
        "2025-01-20",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("Great news");
    });
  });

  describe("sendPushEmployeeRequest", () => {
    it("should send employee request notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushEmployeeRequest(
        validToken,
        "Homeowner",
        "CleanerName",
        4.5,
        "2025-01-25"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("New Cleaning Request");
      expect(chunkCall[0].data.type).toBe("employee_request");
    });

    it("should include cleaner name and rating", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushEmployeeRequest(
        validToken,
        "Homeowner",
        "CleanerName",
        4.5,
        "2025-01-25"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("CleanerName");
      expect(chunkCall[0].body).toContain("4.5 stars");
    });

    it("should handle No ratings yet", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushEmployeeRequest(
        validToken,
        "Homeowner",
        "NewCleaner",
        "No ratings yet",
        "2025-01-25"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("NewCleaner");
      expect(chunkCall[0].body).not.toContain("stars");
    });
  });

  describe("sendPushRequestApproved", () => {
    const address = { street: "789 Pine St", city: "Somerville" };

    it("should send request approved notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushRequestApproved(
        validToken,
        "CleanerName",
        "HomeownerName",
        "2025-01-30",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Request Approved!");
      expect(chunkCall[0].data.type).toBe("request_approved");
    });

    it("should include Congrats in body", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushRequestApproved(
        validToken,
        "CleanerName",
        "HomeownerName",
        "2025-01-30",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("Congrats");
      expect(chunkCall[0].body).toContain("CleanerName");
      expect(chunkCall[0].body).toContain("HomeownerName");
    });
  });

  describe("sendPushRequestDenied", () => {
    it("should send request denied notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushRequestDenied(
        validToken,
        "CleanerName",
        "2025-02-01"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Request Update");
      expect(chunkCall[0].data.type).toBe("request_denied");
    });

    it("should suggest checking other jobs", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushRequestDenied(
        validToken,
        "CleanerName",
        "2025-02-01"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("other available jobs");
    });
  });

  describe("sendPushRemoveRequest", () => {
    it("should send remove request notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushRemoveRequest(
        validToken,
        "Homeowner",
        "2025-02-05"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Request Withdrawn");
      expect(chunkCall[0].data.type).toBe("request_removed");
    });

    it("should indicate appointment is still open", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushRemoveRequest(
        validToken,
        "Homeowner",
        "2025-02-05"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("still open");
    });
  });

  describe("sendPushNewMessage", () => {
    it("should send new message notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushNewMessage(
        validToken,
        "Recipient",
        "Sender",
        "Hello, this is a test message"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Message from Sender");
      expect(chunkCall[0].data.type).toBe("new_message");
    });

    it("should truncate long messages to 50 characters", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      const longMessage = "A".repeat(100);
      await PushNotification.sendPushNewMessage(
        validToken,
        "Recipient",
        "Sender",
        longMessage
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(chunkCall[0].body).toContain("...");
    });

    it("should not truncate short messages", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      const shortMessage = "Short message";
      await PushNotification.sendPushNewMessage(
        validToken,
        "Recipient",
        "Sender",
        shortMessage
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toBe(shortMessage);
    });
  });

  describe("sendPushBroadcast", () => {
    it("should send broadcast notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushBroadcast(
        validToken,
        "User",
        "Important Update",
        "This is broadcast content"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Important Update");
      expect(chunkCall[0].data.type).toBe("broadcast");
    });

    it("should truncate long content to 100 characters", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      const longContent = "B".repeat(150);
      await PushNotification.sendPushBroadcast(
        validToken,
        "User",
        "Title",
        longContent
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body.length).toBeLessThanOrEqual(103); // 100 + "..."
    });
  });

  describe("sendPushNewApplication", () => {
    it("should send new application notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushNewApplication(
        validToken,
        "John Doe"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("New Cleaner Application");
      expect(chunkCall[0].body).toContain("John Doe");
      expect(chunkCall[0].data.type).toBe("new_application");
    });
  });

  describe("sendPushUnassignedWarning", () => {
    const address = { street: "321 Elm St", city: "Brookline" };

    it("should send unassigned warning notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushUnassignedWarning(
        validToken,
        "User",
        "2025-02-10",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Appointment Reminder");
      expect(chunkCall[0].data.type).toBe("unassigned_warning");
    });

    it("should indicate no cleaner assigned yet", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushUnassignedWarning(
        validToken,
        "User",
        "2025-02-10",
        address
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("no cleaner assigned");
    });
  });

  describe("sendPushUsernameRecovery", () => {
    it("should send username recovery notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushUsernameRecovery(
        validToken,
        "testuser123"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Username Recovery");
      expect(chunkCall[0].body).toContain("testuser123");
      expect(chunkCall[0].data.type).toBe("username_recovery");
    });
  });

  describe("sendPushPasswordReset", () => {
    it("should send password reset notification", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushPasswordReset(
        validToken,
        "testuser"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].title).toBe("Password Reset");
      expect(chunkCall[0].body).toContain("testuser");
      expect(chunkCall[0].data.type).toBe("password_reset");
    });

    it("should mention checking email", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      await PushNotification.sendPushPasswordReset(
        validToken,
        "testuser"
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      expect(chunkCall[0].body).toContain("email");
    });
  });

  describe("Date formatting", () => {
    it("should format dates correctly in notifications", async () => {
      Expo.isExpoPushToken = jest.fn().mockReturnValue(true);
      const testDate = "2025-12-25";
      await PushNotification.sendPushCancellation(
        validToken,
        "User",
        testDate,
        { street: "123 St", city: "Boston" }
      );

      const chunkCall = mockExpo.chunkPushNotifications.mock.calls[0][0];
      // Should contain some form of the date - check for year and day number
      expect(chunkCall[0].body).toMatch(/25.*2025|2025.*25|Dec|December/);
    });
  });
});
