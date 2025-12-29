import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./config";

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  static expoPushToken = null;
  static notificationListener = null;
  static responseListener = null;

  /**
   * Register for push notifications and get the Expo push token
   * @returns {Promise<string|null>} The Expo push token or null if failed
   */
  static async registerForPushNotificationsAsync() {
    let token = null;

    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log("[Push] Must use physical device for push notifications");
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Permission not granted for push notifications");
      return null;
    }

    try {
      // Get the Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "your-project-id", // Optional: Add your Expo project ID
      });
      token = tokenData.data;
      this.expoPushToken = token;
      console.log("[Push] Expo push token:", token);
    } catch (error) {
      console.error("[Push] Error getting push token:", error);
      return null;
    }

    // Android requires a notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0d9488",
      });
    }

    return token;
  }

  /**
   * Register the push token with the backend
   * @param {string} token - The user's auth token
   * @param {string} expoPushToken - The Expo push token
   * @returns {Promise<boolean>} Success status
   */
  static async registerTokenWithBackend(authToken, expoPushToken) {
    if (!expoPushToken) {
      console.log("[Push] No push token to register");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/push-notifications/register-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ expoPushToken }),
      });

      if (response.ok) {
        console.log("[Push] Token registered with backend");
        await AsyncStorage.setItem("expoPushToken", expoPushToken);
        return true;
      } else {
        const error = await response.json();
        console.error("[Push] Failed to register token:", error);
        return false;
      }
    } catch (error) {
      console.error("[Push] Error registering token:", error);
      return false;
    }
  }

  /**
   * Remove the push token from the backend (on logout)
   * @param {string} authToken - The user's auth token
   * @returns {Promise<boolean>} Success status
   */
  static async removeTokenFromBackend(authToken) {
    try {
      const response = await fetch(`${API_BASE}/push-notifications/remove-token`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        console.log("[Push] Token removed from backend");
        await AsyncStorage.removeItem("expoPushToken");
        return true;
      } else {
        console.error("[Push] Failed to remove token");
        return false;
      }
    } catch (error) {
      console.error("[Push] Error removing token:", error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   * @param {Function} onNotificationReceived - Callback when notification is received
   * @param {Function} onNotificationResponse - Callback when user taps notification
   */
  static setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // Listen for notifications when app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[Push] Notification received:", notification);
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      }
    );

    // Listen for notification responses (user taps on notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("[Push] Notification response:", response);
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      }
    );
  }

  /**
   * Remove notification listeners (on unmount)
   */
  static removeNotificationListeners() {
    // removeNotificationSubscription is not available on web
    if (Platform.OS === "web") {
      this.notificationListener = null;
      this.responseListener = null;
      return;
    }

    if (this.notificationListener && Notifications.removeNotificationSubscription) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener && Notifications.removeNotificationSubscription) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  /**
   * Get the current Expo push token
   * @returns {string|null} The current push token
   */
  static getToken() {
    return this.expoPushToken;
  }

  /**
   * Get notification preferences from the backend
   * @param {string} authToken - The user's auth token
   * @returns {Promise<Object|null>} Preferences object or null
   */
  static async getPreferences(authToken) {
    try {
      const response = await fetch(`${API_BASE}/push-notifications/preferences`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error("[Push] Error getting preferences:", error);
      return null;
    }
  }

  /**
   * Update notification preferences on the backend
   * @param {string} authToken - The user's auth token
   * @param {Object} preferences - { emailNotifications, pushNotifications }
   * @returns {Promise<boolean>} Success status
   */
  static async updatePreferences(authToken, preferences) {
    try {
      const response = await fetch(`${API_BASE}/push-notifications/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(preferences),
      });

      return response.ok;
    } catch (error) {
      console.error("[Push] Error updating preferences:", error);
      return false;
    }
  }
}

export default PushNotificationService;
