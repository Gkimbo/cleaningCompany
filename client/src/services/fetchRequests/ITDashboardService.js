import HttpClient from "../HttpClient";

class ITDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    const result = await HttpClient.get(url, { token, useBaseUrl: true });

    if (result.success === false) {
      __DEV__ && console.warn(`[ITDashboard] ${url} failed:`, result.error);
      return fallback;
    }

    return result;
  }

  static async getQuickStats(token) {
    return this.fetchWithFallback(
      "/api/v1/it-dashboard/quick-stats",
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
      `/api/v1/it-dashboard/disputes?${params}`,
      token,
      { disputes: [], total: 0 }
    );
  }

  static async getDispute(token, id) {
    return this.fetchWithFallback(
      `/api/v1/it-dashboard/disputes/${id}`,
      token,
      { dispute: null }
    );
  }

  static async getMyAssigned(token) {
    return this.fetchWithFallback(
      "/api/v1/it-dashboard/my-assigned",
      token,
      { disputes: [] }
    );
  }

  static async getITStaff(token) {
    return this.fetchWithFallback(
      "/api/v1/it-dashboard/it-staff",
      token,
      { itStaff: [] }
    );
  }

  static async assignDispute(token, disputeId, assigneeId) {
    const result = await HttpClient.post(
      `/api/v1/it-dashboard/disputes/${disputeId}/assign`,
      { assigneeId },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] assignDispute failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to assign dispute",
      };
    }

    return { success: true, ...result };
  }

  static async updateStatus(token, disputeId, status) {
    const result = await HttpClient.post(
      `/api/v1/it-dashboard/disputes/${disputeId}/status`,
      { status },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] updateStatus failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to update status",
      };
    }

    return { success: true, ...result };
  }

  static async resolveDispute(token, disputeId, resolution) {
    const result = await HttpClient.post(
      `/api/v1/it-dashboard/disputes/${disputeId}/resolve`,
      resolution,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] resolveDispute failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to resolve dispute",
      };
    }

    return { success: true, ...result };
  }

  // ==================== IT Support Tools ====================

  /**
   * Search for users by email or username
   */
  static async searchUsers(token, query, type = null) {
    const params = new URLSearchParams({ query });
    if (type) params.append("type", type);

    return this.fetchWithFallback(
      `/api/v1/it-support/search?${params}`,
      token,
      { users: [] }
    );
  }

  /**
   * Get detailed user account info for IT support
   */
  static async getUserDetails(token, userId) {
    return this.fetchWithFallback(
      `/api/v1/it-support/user/${userId}`,
      token,
      { user: null }
    );
  }

  /**
   * Send password reset email to user
   */
  static async sendPasswordReset(token, userId) {
    const result = await HttpClient.post(
      `/api/v1/it-support/user/${userId}/send-password-reset`,
      {},
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] sendPasswordReset failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to send password reset",
      };
    }

    return { success: true, ...result };
  }

  /**
   * Unlock user account (clear failed login attempts)
   */
  static async unlockAccount(token, userId) {
    const result = await HttpClient.post(
      `/api/v1/it-support/user/${userId}/unlock`,
      {},
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] unlockAccount failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to unlock account",
      };
    }

    return { success: true, ...result };
  }

  // ==================== Profile Tools ====================

  /**
   * Get user's full profile
   */
  static async getUserProfile(token, userId) {
    return this.fetchWithFallback(
      `/api/v1/it-support/user/${userId}/profile`,
      token,
      { profile: null }
    );
  }

  /**
   * Update user contact info
   */
  static async updateUserContact(token, userId, { email, phone }) {
    const result = await HttpClient.patch(
      `/api/v1/it-support/user/${userId}/contact`,
      { email, phone },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] updateUserContact failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  // ==================== Billing Tools ====================

  /**
   * Get user's billing info
   */
  static async getUserBilling(token, userId) {
    return this.fetchWithFallback(
      `/api/v1/it-support/user/${userId}/billing`,
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
      `/api/v1/it-support/user/${userId}/security`,
      token,
      { security: null }
    );
  }

  /**
   * Force user logout
   */
  static async forceLogout(token, userId) {
    const result = await HttpClient.post(
      `/api/v1/it-support/user/${userId}/force-logout`,
      {},
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] forceLogout failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Temporarily suspend account
   */
  static async suspendAccount(token, userId, { reason, hours }) {
    const result = await HttpClient.post(
      `/api/v1/it-support/user/${userId}/suspend`,
      { reason, hours },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] suspendAccount failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  // ==================== Data Tools ====================

  /**
   * Get user data summary
   */
  static async getUserDataSummary(token, userId) {
    return this.fetchWithFallback(
      `/api/v1/it-support/user/${userId}/data-summary`,
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
      `/api/v1/it-support/user/${userId}/app-info`,
      token,
      { appInfo: null }
    );
  }

  /**
   * Clear user's app state
   */
  static async clearAppState(token, userId) {
    const result = await HttpClient.post(
      `/api/v1/it-support/user/${userId}/clear-app-state`,
      {},
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDashboard] clearAppState failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }
}

export default ITDashboardService;
