/**
 * Service Area Service
 * API calls for managing service area configuration
 */

import { API_BASE } from "../config";

class ServiceAreaService {
  /**
   * Get current service area configuration
   * @param {string} token - Auth token
   * @returns {Promise<object>} Config with stats
   */
  static async getConfig(token) {
    try {
      const response = await fetch(`${API_BASE}/service-areas/config`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || "Failed to fetch service area config" };
      }

      return await response.json();
    } catch (error) {
      console.error("[ServiceAreaService] getConfig error:", error);
      return { error: "Network error fetching service area config" };
    }
  }

  /**
   * Update service area configuration
   * @param {string} token - Auth token
   * @param {object} configData - New config values
   * @returns {Promise<object>} Updated config
   */
  static async updateConfig(token, configData) {
    try {
      const response = await fetch(`${API_BASE}/service-areas/config`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || "Failed to update service area config" };
      }

      return await response.json();
    } catch (error) {
      console.error("[ServiceAreaService] updateConfig error:", error);
      return { error: "Network error updating service area config" };
    }
  }

  /**
   * Get service area config change history
   * @param {string} token - Auth token
   * @param {number} limit - Max records to return
   * @returns {Promise<object>} History list
   */
  static async getHistory(token, limit = 20) {
    try {
      const response = await fetch(
        `${API_BASE}/service-areas/history?limit=${limit}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || "Failed to fetch history" };
      }

      return await response.json();
    } catch (error) {
      console.error("[ServiceAreaService] getHistory error:", error);
      return { error: "Network error fetching history" };
    }
  }

  /**
   * Recheck all homes against current service area config
   * @param {string} token - Auth token
   * @returns {Promise<object>} Recheck results
   */
  static async recheckAllHomes(token) {
    try {
      const response = await fetch(
        `${API_BASE}/service-areas/recheck-all-homes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || "Failed to recheck homes" };
      }

      return await response.json();
    } catch (error) {
      console.error("[ServiceAreaService] recheckAllHomes error:", error);
      return { error: "Network error rechecking homes" };
    }
  }

  /**
   * Validate a specific address against service area
   * @param {string} token - Auth token
   * @param {object} address - Address to validate
   * @returns {Promise<object>} Validation result
   */
  static async validateAddress(token, address) {
    try {
      const response = await fetch(
        `${API_BASE}/service-areas/validate-address`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(address),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || "Failed to validate address" };
      }

      return await response.json();
    } catch (error) {
      console.error("[ServiceAreaService] validateAddress error:", error);
      return { error: "Network error validating address" };
    }
  }

  /**
   * Get service area statistics
   * @param {string} token - Auth token
   * @returns {Promise<object>} Stats
   */
  static async getStats(token) {
    try {
      const response = await fetch(`${API_BASE}/service-areas/stats`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error || "Failed to fetch stats" };
      }

      return await response.json();
    } catch (error) {
      console.error("[ServiceAreaService] getStats error:", error);
      return { error: "Network error fetching stats" };
    }
  }
}

export default ServiceAreaService;
