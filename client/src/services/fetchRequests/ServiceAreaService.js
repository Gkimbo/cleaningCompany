/**
 * Service Area Service
 * API calls for managing service area configuration
 */

import HttpClient from "../HttpClient";

class ServiceAreaService {
  /**
   * Get current service area configuration
   * @param {string} token - Auth token
   * @returns {Promise<object>} Config with stats
   */
  static async getConfig(token) {
    const result = await HttpClient.get("/service-areas/config", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[ServiceAreaService] getConfig error:", result.error);
      return { error: result.error || "Failed to fetch service area config" };
    }

    return result;
  }

  /**
   * Update service area configuration
   * @param {string} token - Auth token
   * @param {object} configData - New config values
   * @returns {Promise<object>} Updated config
   */
  static async updateConfig(token, configData) {
    const result = await HttpClient.put("/service-areas/config", configData, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[ServiceAreaService] updateConfig error:", result.error);
      return { error: result.error || "Failed to update service area config" };
    }

    return result;
  }

  /**
   * Get service area config change history
   * @param {string} token - Auth token
   * @param {number} limit - Max records to return
   * @returns {Promise<object>} History list
   */
  static async getHistory(token, limit = 20) {
    const result = await HttpClient.get(
      `/service-areas/history?limit=${limit}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ServiceAreaService] getHistory error:", result.error);
      return { error: result.error || "Failed to fetch history" };
    }

    return result;
  }

  /**
   * Recheck all homes against current service area config
   * @param {string} token - Auth token
   * @returns {Promise<object>} Recheck results
   */
  static async recheckAllHomes(token) {
    const result = await HttpClient.post(
      "/service-areas/recheck-all-homes",
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ServiceAreaService] recheckAllHomes error:", result.error);
      return { error: result.error || "Failed to recheck homes" };
    }

    return result;
  }

  /**
   * Validate a specific address against service area
   * @param {string} token - Auth token
   * @param {object} address - Address to validate
   * @returns {Promise<object>} Validation result
   */
  static async validateAddress(token, address) {
    const result = await HttpClient.post(
      "/service-areas/validate-address",
      address,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ServiceAreaService] validateAddress error:", result.error);
      return { error: result.error || "Failed to validate address" };
    }

    return result;
  }

  /**
   * Get service area statistics
   * @param {string} token - Auth token
   * @returns {Promise<object>} Stats
   */
  static async getStats(token) {
    const result = await HttpClient.get("/service-areas/stats", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[ServiceAreaService] getStats error:", result.error);
      return { error: result.error || "Failed to fetch stats" };
    }

    return result;
  }
}

export default ServiceAreaService;
