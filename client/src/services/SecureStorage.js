/**
 * SecureStorage - Secure token storage wrapper
 *
 * Uses expo-secure-store on native platforms (iOS/Android) for encrypted storage.
 * Falls back to AsyncStorage on web (with console warning).
 *
 * expo-secure-store provides:
 * - iOS: Keychain Services
 * - Android: SharedPreferences encrypted with Android Keystore
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SecureStore = null;
let secureStoreAvailable = false;

// Try to import expo-secure-store (only works on native platforms)
if (Platform.OS !== "web") {
  try {
    SecureStore = require("expo-secure-store");
    secureStoreAvailable = true;
  } catch (error) {
    console.warn("[SecureStorage] expo-secure-store not available, falling back to AsyncStorage");
  }
}

// Keys that should be stored securely
const SECURE_KEYS = ["token", "expoPushToken"];

class SecureStorage {
  /**
   * Check if secure storage is available
   * @returns {boolean}
   */
  static isSecureStorageAvailable() {
    return secureStoreAvailable;
  }

  /**
   * Store a value securely
   * @param {string} key - Storage key
   * @param {string} value - Value to store (must be string)
   * @returns {Promise<void>}
   */
  static async setItem(key, value) {
    if (value === null || value === undefined) {
      return this.removeItem(key);
    }

    // Use SecureStore for sensitive keys on native platforms
    if (secureStoreAvailable && SECURE_KEYS.includes(key)) {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch (error) {
        // SecureStore can fail if value is too large (2KB limit on some devices)
        // Fall back to AsyncStorage
        console.warn(`[SecureStorage] SecureStore failed for ${key}, using AsyncStorage:`, error.message);
      }
    }

    // Fallback to AsyncStorage
    await AsyncStorage.setItem(key, value);
  }

  /**
   * Retrieve a value from secure storage
   * @param {string} key - Storage key
   * @returns {Promise<string|null>}
   */
  static async getItem(key) {
    // Try SecureStore first for sensitive keys
    if (secureStoreAvailable && SECURE_KEYS.includes(key)) {
      try {
        const value = await SecureStore.getItemAsync(key);
        if (value !== null) {
          return value;
        }
        // If not in SecureStore, check AsyncStorage (migration case)
      } catch (error) {
        console.warn(`[SecureStorage] SecureStore read failed for ${key}:`, error.message);
      }
    }

    // Fallback to AsyncStorage
    return AsyncStorage.getItem(key);
  }

  /**
   * Remove a value from storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  static async removeItem(key) {
    // Remove from both stores to ensure cleanup
    const promises = [AsyncStorage.removeItem(key)];

    if (secureStoreAvailable && SECURE_KEYS.includes(key)) {
      promises.push(
        SecureStore.deleteItemAsync(key).catch((error) => {
          // Ignore errors when key doesn't exist
          if (!error.message?.includes("not found")) {
            console.warn(`[SecureStorage] SecureStore delete failed for ${key}:`, error.message);
          }
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Migrate existing tokens from AsyncStorage to SecureStore
   * Call this on app startup to migrate existing users
   * @returns {Promise<void>}
   */
  static async migrateToSecureStorage() {
    if (!secureStoreAvailable) {
      return;
    }

    for (const key of SECURE_KEYS) {
      try {
        // Check if already in SecureStore
        const secureValue = await SecureStore.getItemAsync(key);
        if (secureValue) {
          // Already migrated, remove from AsyncStorage if present
          await AsyncStorage.removeItem(key);
          continue;
        }

        // Check AsyncStorage for existing value
        const asyncValue = await AsyncStorage.getItem(key);
        if (asyncValue) {
          // Migrate to SecureStore
          await SecureStore.setItemAsync(key, asyncValue);
          // Remove from AsyncStorage
          await AsyncStorage.removeItem(key);
        }
      } catch (error) {
        console.warn(`[SecureStorage] Migration failed for ${key}:`, error.message);
      }
    }
  }
}

export default SecureStorage;
