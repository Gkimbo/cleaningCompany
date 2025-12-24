import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PushNotificationService from "./PushNotificationService";
import { AuthContext } from "./AuthContext";

const PushNotificationContext = createContext({
  expoPushToken: null,
  isRegistered: false,
  lastNotification: null,
  registerForPushNotifications: async () => {},
  unregisterPushNotifications: async () => {},
});

const PushNotificationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);

  // Handle incoming notifications
  const handleNotificationReceived = useCallback((notification) => {
    setLastNotification(notification);
  }, []);

  // Handle notification taps
  const handleNotificationResponse = useCallback((response) => {
    const data = response.notification.request.content.data;
    console.log("[Push] User tapped notification:", data);
    // Handle navigation based on notification type
    // This can be extended to navigate to specific screens
  }, []);

  // Register for push notifications when user logs in
  const registerForPushNotifications = useCallback(async () => {
    if (!user?.token) {
      console.log("[Push] No user token, skipping registration");
      return;
    }

    try {
      // Get the Expo push token
      const token = await PushNotificationService.registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
        // Register with backend
        const success = await PushNotificationService.registerTokenWithBackend(
          user.token,
          token
        );
        setIsRegistered(success);
      }
    } catch (error) {
      console.error("[Push] Error during registration:", error);
    }
  }, [user?.token]);

  // Unregister push notifications (on logout)
  const unregisterPushNotifications = useCallback(async () => {
    if (!user?.token) return;

    try {
      await PushNotificationService.removeTokenFromBackend(user.token);
      setExpoPushToken(null);
      setIsRegistered(false);
    } catch (error) {
      console.error("[Push] Error during unregistration:", error);
    }
  }, [user?.token]);

  // Set up listeners when component mounts
  useEffect(() => {
    PushNotificationService.setupNotificationListeners(
      handleNotificationReceived,
      handleNotificationResponse
    );

    return () => {
      PushNotificationService.removeNotificationListeners();
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  // Register when user logs in
  useEffect(() => {
    if (user?.token) {
      registerForPushNotifications();
    }
  }, [user?.token, registerForPushNotifications]);

  return (
    <PushNotificationContext.Provider
      value={{
        expoPushToken,
        isRegistered,
        lastNotification,
        registerForPushNotifications,
        unregisterPushNotifications,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
};

// Custom hook for easy access
const usePushNotifications = () => {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error("usePushNotifications must be used within a PushNotificationProvider");
  }
  return context;
};

export { PushNotificationContext, PushNotificationProvider, usePushNotifications };
