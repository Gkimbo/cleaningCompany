import HttpClient from "../HttpClient";

class IncentivesService {
  /**
   * Get current incentive configuration (public endpoint)
   */
  static async getCurrentIncentives() {
    const result = await HttpClient.get("/incentives/current", { skipAuth: true });

    if (result.success === false) {
      if (__DEV__) console.warn("[IncentivesService] getCurrentIncentives failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get full incentive configuration with metadata (owner only)
   */
  static async getFullConfig(token) {
    const result = await HttpClient.get("/incentives/config", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[IncentivesService] getFullConfig failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Update incentive configuration (owner only)
   */
  static async updateIncentives(token, incentiveData) {
    const result = await HttpClient.put("/incentives/config", incentiveData, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to update incentives",
      };
    }

    return {
      success: true,
      message: result.message,
      config: result.config,
      formattedConfig: result.formattedConfig,
    };
  }

  /**
   * Get incentive change history (owner only)
   */
  static async getIncentiveHistory(token, limit = 20) {
    const result = await HttpClient.get(`/incentives/history?limit=${limit}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[IncentivesService] getIncentiveHistory failed:", result.error);
      return { count: 0, history: [] };
    }

    return result;
  }

  /**
   * Check if current user is eligible for cleaner incentives
   */
  static async checkCleanerEligibility(token) {
    const result = await HttpClient.get("/incentives/cleaner-eligibility", { token });

    if (result.success === false) {
      return { eligible: false, remainingCleanings: 0 };
    }

    return result;
  }

  /**
   * Check if current user is eligible for homeowner incentives
   */
  static async checkHomeownerEligibility(token) {
    const result = await HttpClient.get("/incentives/homeowner-eligibility", { token });

    if (result.success === false) {
      return { eligible: false, remainingCleanings: 0 };
    }

    return result;
  }
}

export default IncentivesService;
