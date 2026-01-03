import { API_BASE } from "../config";

/**
 * PreferredCleanerService - Client-side service for preferred cleaner management
 */
class PreferredCleanerService {
  /**
   * Get all preferred cleaners for a home
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @returns {Object} { preferredCleaners, usePreferredCleaners }
   */
  static async getPreferredCleaners(token, homeId) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/homes/${homeId}/preferred-cleaners`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        console.warn(`[PreferredCleaner] Failed to fetch: ${response.status}`);
        return { preferredCleaners: [], usePreferredCleaners: true };
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching preferred cleaners:", error);
      return { preferredCleaners: [], usePreferredCleaners: true };
    }
  }

  /**
   * Remove a cleaner from the preferred list
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Object} { success, message, error }
   */
  static async removePreferredCleaner(token, homeId, cleanerId) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error removing preferred cleaner:", error);
      return { success: false, error: "Failed to remove cleaner" };
    }
  }

  /**
   * Toggle usePreferredCleaners for a home
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {boolean} usePreferredCleaners - New value
   * @returns {Object} { success, usePreferredCleaners, message, error }
   */
  static async updatePreferredSettings(token, homeId, usePreferredCleaners) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/homes/${homeId}/preferred-settings`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ usePreferredCleaners }),
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error updating preferred settings:", error);
      return { success: false, error: "Failed to update settings" };
    }
  }

  /**
   * Check if a cleaner is preferred for a home
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Object} { isPreferred }
   */
  static async isCleanerPreferred(token, homeId, cleanerId) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        return { isPreferred: false };
      }
      return await response.json();
    } catch (error) {
      console.error("Error checking preferred status:", error);
      return { isPreferred: false };
    }
  }
}

export default PreferredCleanerService;
