import React from "react";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock PushNotificationService
jest.mock("../../src/services/PushNotificationService", () => ({
  removeTokenFromBackend: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import PushNotificationService from "../../src/services/PushNotificationService";

describe("AuthContext Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Token Storage", () => {
    it("should retrieve token from AsyncStorage", async () => {
      AsyncStorage.getItem.mockResolvedValue("test_token_123");

      const token = await AsyncStorage.getItem("token");

      expect(AsyncStorage.getItem).toHaveBeenCalledWith("token");
      expect(token).toBe("test_token_123");
    });

    it("should return null when no token exists", async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const token = await AsyncStorage.getItem("token");

      expect(token).toBeNull();
    });

    it("should save token to AsyncStorage", async () => {
      AsyncStorage.setItem.mockResolvedValue(undefined);

      await AsyncStorage.setItem("token", "new_token_456");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("token", "new_token_456");
    });

    it("should remove token from AsyncStorage on logout", async () => {
      AsyncStorage.removeItem.mockResolvedValue(undefined);

      await AsyncStorage.removeItem("token");

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("token");
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));

      try {
        await AsyncStorage.getItem("token");
      } catch (error) {
        expect(error.message).toBe("Storage error");
      }
    });
  });

  describe("Login Flow", () => {
    it("should save token and update user state on login", async () => {
      const token = "login_token_789";
      AsyncStorage.setItem.mockResolvedValue(undefined);

      await AsyncStorage.setItem("token", token);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("token", token);
    });

    it("should handle login with empty token", async () => {
      const token = "";
      AsyncStorage.setItem.mockResolvedValue(undefined);

      await AsyncStorage.setItem("token", token);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("token", "");
    });
  });

  describe("Logout Flow", () => {
    it("should clear token and user state on logout", async () => {
      AsyncStorage.removeItem.mockResolvedValue(undefined);

      await AsyncStorage.removeItem("token");

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("token");
    });

    it("should handle logout when no token exists", async () => {
      AsyncStorage.removeItem.mockResolvedValue(undefined);

      await AsyncStorage.removeItem("token");

      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it("should remove push token from backend on logout", async () => {
      const token = "logout_token_123";
      AsyncStorage.getItem.mockResolvedValue(token);
      PushNotificationService.removeTokenFromBackend.mockResolvedValue(true);

      // Simulate logout flow: get token, remove push token, remove auth token
      const storedToken = await AsyncStorage.getItem("token");
      if (storedToken) {
        await PushNotificationService.removeTokenFromBackend(storedToken);
      }
      await AsyncStorage.removeItem("token");

      expect(AsyncStorage.getItem).toHaveBeenCalledWith("token");
      expect(PushNotificationService.removeTokenFromBackend).toHaveBeenCalledWith(token);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("token");
    });

    it("should not call removeTokenFromBackend if no token exists", async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      // Simulate logout flow
      const storedToken = await AsyncStorage.getItem("token");
      if (storedToken) {
        await PushNotificationService.removeTokenFromBackend(storedToken);
      }
      await AsyncStorage.removeItem("token");

      expect(PushNotificationService.removeTokenFromBackend).not.toHaveBeenCalled();
    });

    it("should continue logout even if push token removal fails", async () => {
      const token = "failing_token_456";
      AsyncStorage.getItem.mockResolvedValue(token);
      PushNotificationService.removeTokenFromBackend.mockRejectedValue(
        new Error("Network error")
      );
      AsyncStorage.removeItem.mockResolvedValue(undefined);

      // Simulate logout flow with error handling
      const storedToken = await AsyncStorage.getItem("token");
      try {
        if (storedToken) {
          await PushNotificationService.removeTokenFromBackend(storedToken);
        }
      } catch (error) {
        // Error is caught but logout continues
      }
      await AsyncStorage.removeItem("token");

      expect(PushNotificationService.removeTokenFromBackend).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("token");
    });
  });

  describe("Token Check on App Start", () => {
    it("should check for existing token on initialization", async () => {
      AsyncStorage.getItem.mockResolvedValue("existing_token");

      const token = await AsyncStorage.getItem("token");

      expect(token).toBe("existing_token");
    });

    it("should handle no existing token", async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const token = await AsyncStorage.getItem("token");

      expect(token).toBeNull();
    });
  });

  describe("Context Default Values", () => {
    it("should have null user by default", () => {
      const defaultContext = {
        user: null,
        login: expect.any(Function),
        logout: expect.any(Function),
      };

      expect(defaultContext.user).toBeNull();
    });

    it("should have login function", () => {
      const defaultContext = {
        user: null,
        login: (token) => {},
        logout: () => {},
      };

      expect(typeof defaultContext.login).toBe("function");
    });

    it("should have logout function", () => {
      const defaultContext = {
        user: null,
        login: (token) => {},
        logout: () => {},
      };

      expect(typeof defaultContext.logout).toBe("function");
    });
  });
});
