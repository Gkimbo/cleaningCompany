import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class IncentivesService {
  /**
   * Get current incentive configuration (public endpoint)
   * Used by landing pages to show promotional banners
   */
  static async getCurrentIncentives() {
    try {
      const response = await fetch(`${baseURL}/api/v1/incentives/current`);
      if (!response.ok) {
        console.warn(`[IncentivesService] getCurrentIncentives returned ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("[IncentivesService] getCurrentIncentives failed:", error.message);
      return null;
    }
  }

  /**
   * Get full incentive configuration with metadata (owner only)
   * Includes audit info and all fields
   */
  static async getFullConfig(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/incentives/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[IncentivesService] getFullConfig returned ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("[IncentivesService] getFullConfig failed:", error.message);
      return null;
    }
  }

  /**
   * Update incentive configuration (owner only)
   * @param {string} token - Auth token
   * @param {object} incentiveData - New incentive values
   * @returns {object} { success, message, config } or { success: false, error }
   */
  static async updateIncentives(token, incentiveData) {
    try {
      const response = await fetch(`${baseURL}/api/v1/incentives/config`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(incentiveData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to update incentives",
        };
      }

      return {
        success: true,
        message: data.message,
        config: data.config,
        formattedConfig: data.formattedConfig,
      };
    } catch (error) {
      console.error("[IncentivesService] updateIncentives failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get incentive change history (owner only)
   * @param {string} token - Auth token
   * @param {number} limit - Max number of history items to return
   */
  static async getIncentiveHistory(token, limit = 20) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/incentives/history?limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        console.warn(`[IncentivesService] getIncentiveHistory returned ${response.status}`);
        return { count: 0, history: [] };
      }
      return await response.json();
    } catch (error) {
      console.warn("[IncentivesService] getIncentiveHistory failed:", error.message);
      return { count: 0, history: [] };
    }
  }

  /**
   * Check if current user is eligible for cleaner incentives
   * @param {string} token - Auth token
   */
  static async checkCleanerEligibility(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/incentives/cleaner-eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return { eligible: false, remainingCleanings: 0 };
      }
      return await response.json();
    } catch (error) {
      console.warn("[IncentivesService] checkCleanerEligibility failed:", error.message);
      return { eligible: false, remainingCleanings: 0 };
    }
  }

  /**
   * Check if current user is eligible for homeowner incentives
   * @param {string} token - Auth token
   */
  static async checkHomeownerEligibility(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/incentives/homeowner-eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return { eligible: false, remainingCleanings: 0 };
      }
      return await response.json();
    } catch (error) {
      console.warn("[IncentivesService] checkHomeownerEligibility failed:", error.message);
      return { eligible: false, remainingCleanings: 0 };
    }
  }
}

export default IncentivesService;
