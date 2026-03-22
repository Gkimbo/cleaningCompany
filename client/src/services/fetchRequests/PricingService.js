import HttpClient from "../HttpClient";

class PricingService {
  /**
   * Get current pricing configuration (public endpoint)
   * Used by all components that need pricing info
   */
  static async getCurrentPricing() {
    const result = await HttpClient.get("/pricing/current", { skipAuth: true });

    if (result.success === false) {
      if (__DEV__) console.warn("[PricingService] getCurrentPricing failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get full pricing configuration with metadata (owner only)
   * Includes audit info and all fields
   */
  static async getFullConfig(token) {
    const result = await HttpClient.get("/pricing/config", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[PricingService] getFullConfig failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Update pricing configuration (owner only)
   * @param {string} token - Auth token
   * @param {object} pricingData - New pricing values
   * @returns {object} { success, message, config } or { success: false, error }
   */
  static async updatePricing(token, pricingData) {
    const result = await HttpClient.put("/pricing/config", pricingData, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to update pricing",
        missingFields: result.details?.missingFields,
      };
    }

    return {
      success: true,
      message: result.message,
      config: result.config,
      formattedPricing: result.formattedPricing,
    };
  }

  /**
   * Get pricing change history (owner only)
   * @param {string} token - Auth token
   * @param {number} limit - Max number of history items to return
   */
  static async getPricingHistory(token, limit = 20) {
    const result = await HttpClient.get(`/pricing/history?limit=${limit}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[PricingService] getPricingHistory failed:", result.error);
      return { count: 0, history: [] };
    }

    return result;
  }
}

export default PricingService;
