import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class PricingService {
  /**
   * Get current pricing configuration (public endpoint)
   * Used by all components that need pricing info
   */
  static async getCurrentPricing() {
    try {
      const response = await fetch(`${baseURL}/api/v1/pricing/current`);
      if (!response.ok) {
        console.warn(`[PricingService] getCurrentPricing returned ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("[PricingService] getCurrentPricing failed:", error.message);
      return null;
    }
  }

  /**
   * Get full pricing configuration with metadata (manager only)
   * Includes audit info and all fields
   */
  static async getFullConfig(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/pricing/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[PricingService] getFullConfig returned ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("[PricingService] getFullConfig failed:", error.message);
      return null;
    }
  }

  /**
   * Update pricing configuration (manager only)
   * @param {string} token - Auth token
   * @param {object} pricingData - New pricing values
   * @returns {object} { success, message, config } or { success: false, error }
   */
  static async updatePricing(token, pricingData) {
    try {
      const response = await fetch(`${baseURL}/api/v1/pricing/config`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pricingData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to update pricing",
          missingFields: data.missingFields,
        };
      }

      return {
        success: true,
        message: data.message,
        config: data.config,
        formattedPricing: data.formattedPricing,
      };
    } catch (error) {
      console.error("[PricingService] updatePricing failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get pricing change history (manager only)
   * @param {string} token - Auth token
   * @param {number} limit - Max number of history items to return
   */
  static async getPricingHistory(token, limit = 20) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/pricing/history?limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        console.warn(`[PricingService] getPricingHistory returned ${response.status}`);
        return { count: 0, history: [] };
      }
      return await response.json();
    } catch (error) {
      console.warn("[PricingService] getPricingHistory failed:", error.message);
      return { count: 0, history: [] };
    }
  }
}

export default PricingService;
