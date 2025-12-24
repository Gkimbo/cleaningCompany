/**
 * Tests for PushNotificationService
 */

import PushNotificationService from "../../src/services/PushNotificationService";

// Mock expo-device
jest.mock("expo-device", () => ({
  isDevice: true,
}));

// Mock expo-notifications
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
  AndroidImportance: {
    MAX: 5,
  },
}));

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock fetch
global.fetch = jest.fn();

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("PushNotificationService", () => {
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
    PushNotificationService.expoPushToken = null;
    PushNotificationService.notificationListener = null;
    PushNotificationService.responseListener = null;
  });

  describe("registerForPushNotificationsAsync", () => {
    it("should return null if not a physical device", async () => {
      Device.isDevice = false;

      const token = await PushNotificationService.registerForPushNotificationsAsync();

      expect(token).toBeNull();
      Device.isDevice = true; // Reset for other tests
    });

    it("should request permissions if not already granted", async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
      Notifications.requestPermissionsAsync.mockResolvedValue({ status: "granted" });
      Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: validExpoPushToken });

      const token = await PushNotificationService.registerForPushNotificationsAsync();

      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
      expect(token).toBe(validExpoPushToken);
    });

    it("should not request permissions if already granted", async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
      Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: validExpoPushToken });

      const token = await PushNotificationService.registerForPushNotificationsAsync();

      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(token).toBe(validExpoPushToken);
    });

    it("should return null if permissions denied", async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
      Notifications.requestPermissionsAsync.mockResolvedValue({ status: "denied" });

      const token = await PushNotificationService.registerForPushNotificationsAsync();

      expect(token).toBeNull();
    });

    it("should store token in class property", async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
      Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: validExpoPushToken });

      await PushNotificationService.registerForPushNotificationsAsync();

      expect(PushNotificationService.expoPushToken).toBe(validExpoPushToken);
    });

    it("should handle errors gracefully", async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
      Notifications.getExpoPushTokenAsync.mockRejectedValue(new Error("Token error"));

      const token = await PushNotificationService.registerForPushNotificationsAsync();

      expect(token).toBeNull();
    });
  });

  describe("registerTokenWithBackend", () => {
    it("should register token with backend successfully", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Token registered" }),
      });

      const result = await PushNotificationService.registerTokenWithBackend(
        "auth-token",
        validExpoPushToken
      );

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/push-notifications/register-token"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer auth-token",
          }),
          body: JSON.stringify({ expoPushToken: validExpoPushToken }),
        })
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith("expoPushToken", validExpoPushToken);
    });

    it("should return false if no push token provided", async () => {
      const result = await PushNotificationService.registerTokenWithBackend(
        "auth-token",
        null
      );

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should return false on backend error", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Invalid token" }),
      });

      const result = await PushNotificationService.registerTokenWithBackend(
        "auth-token",
        validExpoPushToken
      );

      expect(result).toBe(false);
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));

      const result = await PushNotificationService.registerTokenWithBackend(
        "auth-token",
        validExpoPushToken
      );

      expect(result).toBe(false);
    });
  });

  describe("removeTokenFromBackend", () => {
    it("should remove token from backend successfully", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Token removed" }),
      });

      const result = await PushNotificationService.removeTokenFromBackend("auth-token");

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/push-notifications/remove-token"),
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer auth-token",
          }),
        })
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("expoPushToken");
    });

    it("should return false on backend error", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
      });

      const result = await PushNotificationService.removeTokenFromBackend("auth-token");

      expect(result).toBe(false);
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));

      const result = await PushNotificationService.removeTokenFromBackend("auth-token");

      expect(result).toBe(false);
    });
  });

  describe("setupNotificationListeners", () => {
    it("should set up notification received listener", () => {
      const onReceived = jest.fn();
      const onResponse = jest.fn();

      PushNotificationService.setupNotificationListeners(onReceived, onResponse);

      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
      expect(PushNotificationService.notificationListener).toBeDefined();
    });

    it("should set up notification response listener", () => {
      const onReceived = jest.fn();
      const onResponse = jest.fn();

      PushNotificationService.setupNotificationListeners(onReceived, onResponse);

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
      expect(PushNotificationService.responseListener).toBeDefined();
    });
  });

  describe("removeNotificationListeners", () => {
    it("should remove notification listeners", () => {
      const mockRemove = jest.fn();
      PushNotificationService.notificationListener = { remove: mockRemove };
      PushNotificationService.responseListener = { remove: mockRemove };

      PushNotificationService.removeNotificationListeners();

      expect(Notifications.removeNotificationSubscription).toHaveBeenCalledTimes(2);
      expect(PushNotificationService.notificationListener).toBeNull();
      expect(PushNotificationService.responseListener).toBeNull();
    });

    it("should handle null listeners gracefully", () => {
      PushNotificationService.notificationListener = null;
      PushNotificationService.responseListener = null;

      // Should not throw
      expect(() => {
        PushNotificationService.removeNotificationListeners();
      }).not.toThrow();
    });
  });

  describe("getToken", () => {
    it("should return stored token", () => {
      PushNotificationService.expoPushToken = validExpoPushToken;

      const token = PushNotificationService.getToken();

      expect(token).toBe(validExpoPushToken);
    });

    it("should return null if no token", () => {
      PushNotificationService.expoPushToken = null;

      const token = PushNotificationService.getToken();

      expect(token).toBeNull();
    });
  });

  describe("getPreferences", () => {
    it("should fetch preferences from backend", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          emailNotifications: true,
          pushNotifications: true,
          hasPushToken: true,
        }),
      });

      const preferences = await PushNotificationService.getPreferences("auth-token");

      expect(preferences).toEqual({
        emailNotifications: true,
        pushNotifications: true,
        hasPushToken: true,
      });
    });

    it("should return null on error", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
      });

      const preferences = await PushNotificationService.getPreferences("auth-token");

      expect(preferences).toBeNull();
    });
  });

  describe("updatePreferences", () => {
    it("should update preferences successfully", async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const result = await PushNotificationService.updatePreferences("auth-token", {
        emailNotifications: true,
        pushNotifications: false,
      });

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/push-notifications/preferences"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            emailNotifications: true,
            pushNotifications: false,
          }),
        })
      );
    });

    it("should return false on error", async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const result = await PushNotificationService.updatePreferences("auth-token", {
        emailNotifications: true,
        pushNotifications: true,
      });

      expect(result).toBe(false);
    });
  });
});
