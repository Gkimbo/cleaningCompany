/**
 * Tests for PushNotificationContext
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { Text, View } from "react-native";
import {
  PushNotificationProvider,
  PushNotificationContext,
  usePushNotifications,
} from "../../src/services/PushNotificationContext";
import { AuthContext } from "../../src/services/AuthContext";
import PushNotificationService from "../../src/services/PushNotificationService";

// Mock PushNotificationService
jest.mock("../../src/services/PushNotificationService", () => ({
  registerForPushNotificationsAsync: jest.fn(),
  registerTokenWithBackend: jest.fn(),
  removeTokenFromBackend: jest.fn(),
  setupNotificationListeners: jest.fn(),
  removeNotificationListeners: jest.fn(),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe("PushNotificationContext", () => {
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
    PushNotificationService.registerForPushNotificationsAsync.mockResolvedValue(null);
    PushNotificationService.registerTokenWithBackend.mockResolvedValue(false);
    PushNotificationService.removeTokenFromBackend.mockResolvedValue(true);
  });

  // Helper component to test context values
  const TestConsumer = () => {
    const context = React.useContext(PushNotificationContext);
    return (
      <View>
        <Text testID="expoPushToken">{context.expoPushToken || "null"}</Text>
        <Text testID="isRegistered">{context.isRegistered ? "true" : "false"}</Text>
      </View>
    );
  };

  // Wrapper with both Auth and Push providers
  const TestWrapper = ({ children, user = null }) => (
    <AuthContext.Provider value={{ user, login: jest.fn(), logout: jest.fn() }}>
      <PushNotificationProvider>{children}</PushNotificationProvider>
    </AuthContext.Provider>
  );

  describe("Provider", () => {
    it("should render children", () => {
      const { getByText } = render(
        <TestWrapper>
          <Text>Test Child</Text>
        </TestWrapper>
      );

      expect(getByText("Test Child")).toBeTruthy();
    });

    it("should provide initial context values", () => {
      const { getByTestId } = render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(getByTestId("expoPushToken").props.children).toBe("null");
      expect(getByTestId("isRegistered").props.children).toBe("false");
    });

    it("should set up notification listeners on mount", async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(PushNotificationService.setupNotificationListeners).toHaveBeenCalled();
      });
    });

    it("should remove notification listeners on unmount", async () => {
      const { unmount } = render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      unmount();

      expect(PushNotificationService.removeNotificationListeners).toHaveBeenCalled();
    });
  });

  describe("Registration", () => {
    it("should register for push notifications when user logs in", async () => {
      PushNotificationService.registerForPushNotificationsAsync.mockResolvedValue(
        validExpoPushToken
      );
      PushNotificationService.registerTokenWithBackend.mockResolvedValue(true);

      const { getByTestId } = render(
        <TestWrapper user={{ token: "auth-token" }}>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(PushNotificationService.registerForPushNotificationsAsync).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(PushNotificationService.registerTokenWithBackend).toHaveBeenCalledWith(
          "auth-token",
          validExpoPushToken
        );
      });
    });

    it("should not register if no user token", async () => {
      render(
        <TestWrapper user={null}>
          <TestConsumer />
        </TestWrapper>
      );

      // Wait a bit to ensure async operations would have completed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(PushNotificationService.registerForPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it("should update state when registration succeeds", async () => {
      PushNotificationService.registerForPushNotificationsAsync.mockResolvedValue(
        validExpoPushToken
      );
      PushNotificationService.registerTokenWithBackend.mockResolvedValue(true);

      const { getByTestId } = render(
        <TestWrapper user={{ token: "auth-token" }}>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByTestId("expoPushToken").props.children).toBe(validExpoPushToken);
      });

      await waitFor(() => {
        expect(getByTestId("isRegistered").props.children).toBe("true");
      });
    });

    it("should handle registration failure gracefully", async () => {
      PushNotificationService.registerForPushNotificationsAsync.mockResolvedValue(null);

      const { getByTestId } = render(
        <TestWrapper user={{ token: "auth-token" }}>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(PushNotificationService.registerForPushNotificationsAsync).toHaveBeenCalled();
      });

      // Should remain in initial state
      expect(getByTestId("expoPushToken").props.children).toBe("null");
      expect(getByTestId("isRegistered").props.children).toBe("false");
    });
  });

  describe("usePushNotifications hook", () => {
    const HookTestComponent = () => {
      const { expoPushToken, isRegistered, lastNotification } = usePushNotifications();
      return (
        <View>
          <Text testID="hookToken">{expoPushToken || "null"}</Text>
          <Text testID="hookRegistered">{isRegistered ? "true" : "false"}</Text>
          <Text testID="hookNotification">{lastNotification ? "has-notification" : "null"}</Text>
        </View>
      );
    };

    it("should provide context values via hook", () => {
      const { getByTestId } = render(
        <TestWrapper>
          <HookTestComponent />
        </TestWrapper>
      );

      expect(getByTestId("hookToken").props.children).toBe("null");
      expect(getByTestId("hookRegistered").props.children).toBe("false");
      expect(getByTestId("hookNotification").props.children).toBe("null");
    });

    it("should return default values when used outside provider", () => {
      // The context provides default values, so it won't throw
      // This test verifies the default values are returned
      const { getByTestId } = render(
        <AuthContext.Provider value={{ user: null, login: jest.fn(), logout: jest.fn() }}>
          <HookTestComponent />
        </AuthContext.Provider>
      );

      // Default values from context
      expect(getByTestId("hookToken").props.children).toBe("null");
      expect(getByTestId("hookRegistered").props.children).toBe("false");
      expect(getByTestId("hookNotification").props.children).toBe("null");
    });
  });

  describe("Notification handling", () => {
    it("should pass callbacks to setupNotificationListeners", async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(PushNotificationService.setupNotificationListeners).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Function)
        );
      });
    });
  });
});
