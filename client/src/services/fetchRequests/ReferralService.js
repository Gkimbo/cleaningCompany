/**
 * ReferralService - Client-side service for referral API calls
 */

import { API_BASE } from "../config";

class ReferralService {
  // =====================
  // PUBLIC ENDPOINTS
  // =====================

  /**
   * Validate a referral code during signup
   * @param {string} code - Referral code to validate
   * @param {string} userType - Type of user being referred ('homeowner' or 'cleaner')
   * @returns {Object} { valid, referrer, programType, rewards, error }
   */
  static async validateCode(code, userType = "homeowner") {
    try {
      const response = await fetch(
        `${API_BASE}/referrals/validate/${encodeURIComponent(code)}?userType=${userType}`
      );
      return await response.json();
    } catch (error) {
      console.error("Error validating referral code:", error);
      return { valid: false, error: "Failed to validate code" };
    }
  }

  /**
   * Get current active referral programs for marketing display
   * @returns {Object} { active, programs }
   */
  static async getCurrentPrograms() {
    try {
      const response = await fetch(`${API_BASE}/referrals/current`);
      return await response.json();
    } catch (error) {
      console.error("Error fetching current programs:", error);
      return { active: false, programs: [] };
    }
  }

  // =====================
  // OWNER ENDPOINTS
  // =====================

  /**
   * Get full referral configuration (owner only)
   * @param {string} token - Auth token
   * @returns {Object} Configuration data
   */
  static async getFullConfig(token) {
    try {
      const response = await fetch(`${API_BASE}/referrals/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching referral config:", error);
      return null;
    }
  }

  /**
   * Update referral configuration (owner only)
   * @param {string} token - Auth token
   * @param {Object} configData - New configuration
   * @returns {Object} { success, config, error }
   */
  static async updateConfig(token, configData) {
    try {
      const response = await fetch(`${API_BASE}/referrals/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(configData),
      });
      return await response.json();
    } catch (error) {
      console.error("Error updating referral config:", error);
      return { success: false, error: "Failed to update configuration" };
    }
  }

  /**
   * Get referral config change history (owner only)
   * @param {string} token - Auth token
   * @param {number} limit - Max records to return
   * @returns {Object} { count, history }
   */
  static async getHistory(token, limit = 20) {
    try {
      const response = await fetch(`${API_BASE}/referrals/history?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching referral history:", error);
      return { count: 0, history: [] };
    }
  }

  /**
   * Get all referrals with filters (owner only)
   * @param {string} token - Auth token
   * @param {Object} filters - { status, programType, startDate, endDate }
   * @returns {Object} { count, referrals }
   */
  static async getAllReferrals(token, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.programType) params.append("programType", filters.programType);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(`${API_BASE}/referrals/all?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching all referrals:", error);
      return { count: 0, referrals: [] };
    }
  }

  /**
   * Update referral status (owner only)
   * @param {string} token - Auth token
   * @param {number} referralId - Referral ID
   * @param {string} status - New status
   * @returns {Object} { success, referral, error }
   */
  static async updateReferralStatus(token, referralId, status) {
    try {
      const response = await fetch(`${API_BASE}/referrals/${referralId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error updating referral status:", error);
      return { success: false, error: "Failed to update status" };
    }
  }

  // =====================
  // AUTHENTICATED USER ENDPOINTS
  // =====================

  /**
   * Get or generate user's referral code
   * @param {string} token - Auth token
   * @returns {Object} { referralCode, shareMessage, programs }
   */
  static async getMyCode(token) {
    try {
      const response = await fetch(`${API_BASE}/referrals/my-code`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error getting my referral code:", error);
      return null;
    }
  }

  /**
   * Get user's referral history and stats
   * @param {string} token - Auth token
   * @returns {Object} { referralCode, availableCredits, stats, referrals }
   */
  static async getMyReferrals(token) {
    try {
      const response = await fetch(`${API_BASE}/referrals/my-referrals`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error getting my referrals:", error);
      return null;
    }
  }

  /**
   * Get available referral credits
   * @param {string} token - Auth token
   * @returns {Object} { availableCredits, availableDollars }
   */
  static async getMyCredits(token) {
    try {
      const response = await fetch(`${API_BASE}/referrals/my-credits`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error getting my credits:", error);
      return { availableCredits: 0, availableDollars: "0.00" };
    }
  }

  /**
   * Apply referral credits to an appointment
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @param {number} amount - Amount in cents (optional, applies max if not specified)
   * @returns {Object} { success, amountApplied, remainingCredits, newPrice, error }
   */
  static async applyCredits(token, appointmentId, amount = null) {
    try {
      const body = { appointmentId };
      if (amount !== null) body.amount = amount;

      const response = await fetch(`${API_BASE}/referrals/apply-credits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch (error) {
      console.error("Error applying credits:", error);
      return { success: false, error: "Failed to apply credits" };
    }
  }

  /**
   * Log a share action (for analytics)
   * @param {string} token - Auth token
   * @param {string} platform - Share platform ('copy', 'sms', 'email', 'social')
   */
  static async logShare(token, platform) {
    try {
      await fetch(`${API_BASE}/referrals/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ platform }),
      });
    } catch (error) {
      // Silent fail for analytics
      console.error("Error logging share:", error);
    }
  }
}

export default ReferralService;
