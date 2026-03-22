import HttpClient from "../HttpClient";

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
    const result = await HttpClient.get(
      `/preferred-cleaner/homes/${homeId}/preferred-cleaners`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] getPreferredCleaners failed:", result.error);
      return { preferredCleaners: [], usePreferredCleaners: false };
    }

    return result;
  }

  /**
   * Remove a cleaner from the preferred list
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Object} { success, message, error }
   */
  static async removePreferredCleaner(token, homeId, cleanerId) {
    const result = await HttpClient.delete(
      `/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] removePreferredCleaner failed:", result.error);
    }

    return result;
  }

  /**
   * Toggle usePreferredCleaners for a home
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {boolean} usePreferredCleaners - New value
   * @returns {Object} { success, usePreferredCleaners, message, error }
   */
  static async updatePreferredSettings(token, homeId, usePreferredCleaners) {
    const result = await HttpClient.patch(
      `/preferred-cleaner/homes/${homeId}/preferred-settings`,
      { usePreferredCleaners },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] updatePreferredSettings failed:", result.error);
    }

    return result;
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
    const body = { preferenceLevel };
    if (priority !== undefined) body.priority = priority;

    const result = await HttpClient.patch(
      `/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/preference`,
      body,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] updatePreferenceLevel failed:", result.error);
    }

    return result;
  }

  /**
   * Check if a cleaner is preferred for a home
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Object} { isPreferred }
   */
  static async isCleanerPreferred(token, homeId, cleanerId) {
    const result = await HttpClient.get(
      `/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] isCleanerPreferred failed:", result.error);
      return { isPreferred: false };
    }

    return result;
  }

  /**
   * Check if a cleaner is eligible to be set as preferred for a home
   * Returns false for business cleaners (their own clients)
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Object} { canSetAsPreferred, reason }
   */
  static async checkPreferredEligibility(token, homeId, cleanerId) {
    const result = await HttpClient.get(
      `/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/preferred-eligibility`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] checkPreferredEligibility failed:", result.error);
      // Default to allowing if check fails (don't block feature due to API error)
      return { canSetAsPreferred: true, reason: null };
    }

    return result;
  }

  /**
   * Get stats for a specific cleaner at a specific home
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Object} Stats including totalBookings, avgDurationMinutes, avgReviewScore, etc.
   */
  static async getCleanerStats(token, homeId, cleanerId) {
    const result = await HttpClient.get(
      `/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/stats`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] getCleanerStats failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get all homes where the cleaner has preferred status (for cleaner filter)
   * @param {string} token - Auth token
   * @returns {Object} { preferredHomes, homeIds }
   */
  static async getMyPreferredHomes(token) {
    const result = await HttpClient.get(
      "/preferred-cleaner/my-preferred-homes",
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] getMyPreferredHomes failed:", result.error);
      return { preferredHomes: [], homeIds: [] };
    }

    return result;
  }

  /**
   * Get cleaner's current perk status and tier
   * @param {string} token - Auth token
   * @returns {Object} Perk status including tier, bonusPercent, benefits, etc.
   */
  static async getMyPerkStatus(token) {
    const result = await HttpClient.get(
      "/preferred-cleaner/my-perk-status",
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] getMyPerkStatus failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get all tier levels and their benefits (for displaying tier info)
   * @param {string} token - Auth token
   * @returns {Object} { tiers: [...] }
   */
  static async getTierInfo(token) {
    const result = await HttpClient.get(
      "/preferred-cleaner/perk-tier-info",
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredCleanerService] getTierInfo failed:", result.error);
      return { tiers: [] };
    }

    return result;
  }
}

export default PreferredCleanerService;
