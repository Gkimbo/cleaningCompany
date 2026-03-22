/**
 * ReferralService - Client-side service for referral API calls
 */

import HttpClient from "../HttpClient";

class ReferralService {
  // =====================
  // PUBLIC ENDPOINTS
  // =====================

  /**
   * Validate a referral code during signup
   */
  static async validateCode(code, userType = "homeowner") {
    const result = await HttpClient.get(`/referrals/validate/${encodeURIComponent(code)}?userType=${userType}`, { skipAuth: true });

    if (result.success === false) {
      return { valid: false, error: result.error || "Failed to validate code" };
    }

    return result;
  }

  /**
   * Get current active referral programs for marketing display
   */
  static async getCurrentPrograms() {
    const result = await HttpClient.get("/referrals/current", { skipAuth: true });

    if (result.success === false) {
      if (__DEV__) console.warn("[ReferralService] getCurrentPrograms failed:", result.error);
      return { active: false, programs: [] };
    }

    return result;
  }

  // =====================
  // OWNER ENDPOINTS
  // =====================

  /**
   * Get full referral configuration (owner only)
   */
  static async getFullConfig(token) {
    const result = await HttpClient.get("/referrals/config", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[ReferralService] getFullConfig failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Update referral configuration (owner only)
   */
  static async updateConfig(token, configData) {
    const result = await HttpClient.put("/referrals/config", configData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update configuration" };
    }

    return result;
  }

  /**
   * Get referral config change history (owner only)
   */
  static async getHistory(token, limit = 20) {
    const result = await HttpClient.get(`/referrals/history?limit=${limit}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[ReferralService] getHistory failed:", result.error);
      return { count: 0, history: [] };
    }

    return result;
  }

  /**
   * Get all referrals with filters (owner only)
   */
  static async getAllReferrals(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.programType) params.append("programType", filters.programType);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);

    const url = `/referrals/all${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[ReferralService] getAllReferrals failed:", result.error);
      return { count: 0, referrals: [] };
    }

    return result;
  }

  /**
   * Update referral status (owner only)
   */
  static async updateReferralStatus(token, referralId, status) {
    const result = await HttpClient.patch(`/referrals/${referralId}/status`, { status }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update status" };
    }

    return result;
  }

  // =====================
  // AUTHENTICATED USER ENDPOINTS
  // =====================

  /**
   * Get or generate user's referral code
   */
  static async getMyCode(token) {
    const result = await HttpClient.get("/referrals/my-code", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[ReferralService] getMyCode failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get user's referral history and stats
   */
  static async getMyReferrals(token) {
    const result = await HttpClient.get("/referrals/my-referrals", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[ReferralService] getMyReferrals failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get available referral credits
   */
  static async getMyCredits(token) {
    const result = await HttpClient.get("/referrals/my-credits", { token });

    if (result.success === false) {
      return { availableCredits: 0, availableDollars: "0.00" };
    }

    return result;
  }

  /**
   * Apply referral credits to an appointment
   */
  static async applyCredits(token, appointmentId, amount = null) {
    const body = { appointmentId };
    if (amount !== null) body.amount = amount;

    const result = await HttpClient.post("/referrals/apply-credits", body, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to apply credits" };
    }

    return result;
  }

  /**
   * Log a share action (for analytics)
   */
  static async logShare(token, platform) {
    // Fire and forget - don't await or handle errors
    HttpClient.post("/referrals/share", { platform }, { token }).catch(() => {});
  }
}

export default ReferralService;
