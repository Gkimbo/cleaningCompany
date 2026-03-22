import HttpClient from "../HttpClient";

/**
 * PreferredPerksService - Client-side service for managing preferred cleaner tier configuration (owner only)
 */
class PreferredPerksService {
  /**
   * Get full tier configuration with metadata (owner only)
   * Includes audit info and all fields
   */
  static async getConfig(token) {
    const result = await HttpClient.get("/preferred-cleaner/perks-config", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredPerksService] getConfig failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Update tier configuration (owner only)
   * @param {string} token - Auth token
   * @param {object} configData - New tier configuration values
   * @returns {object} { success, config } or { success: false, error }
   */
  static async updateConfig(token, configData) {
    const result = await HttpClient.put("/preferred-cleaner/perks-config", configData, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredPerksService] updateConfig failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to update tier configuration",
      };
    }

    return {
      success: true,
      config: result.config,
    };
  }

  /**
   * Get tier configuration change history (owner only)
   * @param {string} token - Auth token
   * @param {number} limit - Max number of history items to return
   */
  static async getHistory(token, limit = 20) {
    const result = await HttpClient.get(
      `/preferred-cleaner/perks-config/history?limit=${limit}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[PreferredPerksService] getHistory failed:", result.error);
      return { history: [] };
    }

    return result;
  }
}

export default PreferredPerksService;
