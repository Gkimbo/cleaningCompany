import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

/**
 * PreferredPerksService - Client-side service for managing preferred cleaner tier configuration (owner only)
 */
class PreferredPerksService {
  /**
   * Get full tier configuration with metadata (owner only)
   * Includes audit info and all fields
   */
  static async getConfig(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/preferred-cleaner/perks-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[PreferredPerksService] getConfig returned ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("[PreferredPerksService] getConfig failed:", error.message);
      return null;
    }
  }

  /**
   * Update tier configuration (owner only)
   * @param {string} token - Auth token
   * @param {object} configData - New tier configuration values
   * @returns {object} { success, config } or { success: false, error }
   */
  static async updateConfig(token, configData) {
    try {
      const response = await fetch(`${baseURL}/api/v1/preferred-cleaner/perks-config`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to update tier configuration",
        };
      }

      return {
        success: true,
        config: data.config,
      };
    } catch (error) {
      console.error("[PreferredPerksService] updateConfig failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get tier configuration change history (owner only)
   * @param {string} token - Auth token
   * @param {number} limit - Max number of history items to return
   */
  static async getHistory(token, limit = 20) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/preferred-cleaner/perks-config/history?limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        console.warn(`[PreferredPerksService] getHistory returned ${response.status}`);
        return { history: [] };
      }
      return await response.json();
    } catch (error) {
      console.warn("[PreferredPerksService] getHistory failed:", error.message);
      return { history: [] };
    }
  }
}

export default PreferredPerksService;
