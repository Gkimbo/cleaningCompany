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
   * Update preference level for a cleaner (preferred or favorite)
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @param {string} preferenceLevel - 'preferred' or 'favorite'
   * @param {number} priority - Priority ordering (optional)
   * @returns {Object} Result with updated preferenceLevel and priority
   */
  static async updatePreferenceLevel(token, homeId, cleanerId, preferenceLevel, priority) {
    try {
      const body = { preferenceLevel };
      if (priority !== undefined) body.priority = priority;

      const response = await fetch(
        `${API_BASE}/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/preference`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || "Failed to update preference level" };
      }
      return await response.json();
    } catch (error) {
      console.error("Error updating preference level:", error);
      return { success: false, error: error.message };
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

  /**
   * Get stats for a specific cleaner at a specific home
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Object} Stats including totalBookings, avgDurationMinutes, avgReviewScore, etc.
   */
  static async getCleanerStats(token, homeId, cleanerId) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        console.warn(`[PreferredCleaner] Failed to fetch stats: ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching cleaner stats:", error);
      return null;
    }
  }

  /**
   * Get all homes where the cleaner has preferred status (for cleaner filter)
   * @param {string} token - Auth token
   * @returns {Object} { preferredHomes, homeIds }
   */
  static async getMyPreferredHomes(token) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/my-preferred-homes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        console.warn(`[PreferredCleaner] Failed to fetch my preferred homes: ${response.status}`);
        return { preferredHomes: [], homeIds: [] };
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching my preferred homes:", error);
      return { preferredHomes: [], homeIds: [] };
    }
  }

  /**
   * Get cleaner's current perk status and tier
   * @param {string} token - Auth token
   * @returns {Object} Perk status including tier, bonusPercent, benefits, etc.
   */
  static async getMyPerkStatus(token) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/my-perk-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        console.warn(`[PreferredCleaner] Failed to fetch perk status: ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching perk status:", error);
      return null;
    }
  }

  /**
   * Get all tier levels and their benefits (for displaying tier info)
   * @param {string} token - Auth token
   * @returns {Object} { tiers: [...] }
   */
  static async getTierInfo(token) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/perk-tier-info`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        console.warn(`[PreferredCleaner] Failed to fetch tier info: ${response.status}`);
        return { tiers: [] };
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching tier info:", error);
      return { tiers: [] };
    }
  }
}

export default PreferredCleanerService;
