import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class ITDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[ITDashboard] ${url} returned ${response.status}`);
        return fallback;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[ITDashboard] ${url} failed:`, error.message);
      return fallback;
    }
  }

  static async getQuickStats(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-dashboard/quick-stats`,
      token,
      {
        openDisputes: 0,
        criticalHighPriority: 0,
        resolvedThisWeek: 0,
        slaBreaches: 0,
        disputesByGroup: {},
        myAssigned: 0,
      }
    );
  }

  static async getDisputes(token, filters = {}) {
    const params = new URLSearchParams(filters);
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-dashboard/disputes?${params}`,
      token,
      { disputes: [], total: 0 }
    );
  }

  static async getDispute(token, id) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-dashboard/disputes/${id}`,
      token,
      { dispute: null }
    );
  }

  static async getMyAssigned(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-dashboard/my-assigned`,
      token,
      { disputes: [] }
    );
  }

  static async getITStaff(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-dashboard/it-staff`,
      token,
      { itStaff: [] }
    );
  }

  static async assignDispute(token, disputeId, assigneeId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-dashboard/disputes/${disputeId}/assign`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assigneeId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to assign dispute",
        };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] assignDispute failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async updateStatus(token, disputeId, status) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-dashboard/disputes/${disputeId}/status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to update status",
        };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] updateStatus failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async resolveDispute(token, disputeId, resolution) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-dashboard/disputes/${disputeId}/resolve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resolution),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to resolve dispute",
        };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] resolveDispute failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ==================== IT Support Tools ====================

  /**
   * Search for users by email or username
   */
  static async searchUsers(token, query, type = null) {
    const params = new URLSearchParams({ query });
    if (type) params.append("type", type);

    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-support/search?${params}`,
      token,
      { users: [] }
    );
  }

  /**
   * Get detailed user account info for IT support
   */
  static async getUserDetails(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-support/user/${userId}`,
      token,
      { user: null }
    );
  }

  /**
   * Send password reset email to user
   */
  static async sendPasswordReset(token, userId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-support/user/${userId}/send-password-reset`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to send password reset",
        };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] sendPasswordReset failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Unlock user account (clear failed login attempts)
   */
  static async unlockAccount(token, userId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-support/user/${userId}/unlock`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to unlock account",
        };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] unlockAccount failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ==================== Profile Tools ====================

  /**
   * Get user's full profile
   */
  static async getUserProfile(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-support/user/${userId}/profile`,
      token,
      { profile: null }
    );
  }

  /**
   * Update user contact info
   */
  static async updateUserContact(token, userId, { email, phone }) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-support/user/${userId}/contact`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, phone }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] updateUserContact failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ==================== Billing Tools ====================

  /**
   * Get user's billing info
   */
  static async getUserBilling(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-support/user/${userId}/billing`,
      token,
      { billing: null }
    );
  }

  // ==================== Security Tools ====================

  /**
   * Get user's security info
   */
  static async getUserSecurity(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-support/user/${userId}/security`,
      token,
      { security: null }
    );
  }

  /**
   * Force user logout
   */
  static async forceLogout(token, userId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-support/user/${userId}/force-logout`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] forceLogout failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Temporarily suspend account
   */
  static async suspendAccount(token, userId, { reason, hours }) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-support/user/${userId}/suspend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason, hours }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] suspendAccount failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ==================== Data Tools ====================

  /**
   * Get user data summary
   */
  static async getUserDataSummary(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-support/user/${userId}/data-summary`,
      token,
      { dataSummary: null }
    );
  }

  // ==================== App/Technical Tools ====================

  /**
   * Get user's app info
   */
  static async getUserAppInfo(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/it-support/user/${userId}/app-info`,
      token,
      { appInfo: null }
    );
  }

  /**
   * Clear user's app state
   */
  static async clearAppState(token, userId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/it-support/user/${userId}/clear-app-state`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("[ITDashboard] clearAppState failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }
}

export default ITDashboardService;
