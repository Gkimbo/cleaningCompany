import HttpClient from "../HttpClient";

class HRDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    const result = await HttpClient.get(url, { token, useBaseUrl: true });

    if (result.success === false) {
      __DEV__ && console.warn(`[HRDashboard] ${url} failed:`, result.error);
      return fallback;
    }

    return result;
  }

  static async getPendingDisputes(token) {
    return this.fetchWithFallback(
      "/api/v1/hr-dashboard/disputes/pending",
      token,
      { disputes: [] }
    );
  }

  static async getDispute(token, id) {
    return this.fetchWithFallback(
      `/api/v1/hr-dashboard/disputes/${id}`,
      token,
      { dispute: null }
    );
  }

  static async getSupportConversations(token) {
    return this.fetchWithFallback(
      "/api/v1/hr-dashboard/support-conversations",
      token,
      { conversations: [] }
    );
  }

  static async getQuickStats(token) {
    return this.fetchWithFallback(
      "/api/v1/hr-dashboard/quick-stats",
      token,
      {
        pendingDisputes: 0,
        supportConversations: 0,
        disputesResolvedThisWeek: 0,
      }
    );
  }

  // Use existing home-size-adjustment endpoints for dispute resolution
  // since HR now has access via verifyHROrOwner middleware
  static async resolveDispute(token, disputeId, data) {
    const result = await HttpClient.post(
      `/api/v1/home-size-adjustment/${disputeId}/owner-resolve`,
      data,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] resolveDispute failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to resolve dispute",
      };
    }

    return {
      success: true,
      ...result,
    };
  }

  // ============================================================================
  // HR SUPPORT TOOLS
  // ============================================================================

  /**
   * Search users
   */
  static async searchUsers(token, query, type = null) {
    const params = new URLSearchParams({ query });
    if (type) params.append("type", type);
    return this.fetchWithFallback(
      `/api/v1/hr-support/search?${params}`,
      token,
      { users: [] }
    );
  }

  /**
   * Get user profile with history
   */
  static async getUserProfile(token, userId) {
    return this.fetchWithFallback(
      `/api/v1/hr-support/user/${userId}/profile`,
      token,
      { profile: null }
    );
  }

  /**
   * Update user notes
   */
  static async updateUserNotes(token, userId, notes) {
    const result = await HttpClient.patch(
      `/api/v1/hr-support/user/${userId}/notes`,
      { notes },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] updateUserNotes failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Get home details with history
   */
  static async getHomeDetails(token, homeId) {
    return this.fetchWithFallback(
      `/api/v1/hr-support/home/${homeId}/details`,
      token,
      { home: null }
    );
  }

  /**
   * Update home size
   */
  static async updateHomeSize(token, homeId, data) {
    const result = await HttpClient.patch(
      `/api/v1/hr-support/home/${homeId}/size`,
      data,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] updateHomeSize failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Get cleaner claim history
   */
  static async getCleanerClaimHistory(token, cleanerId) {
    return this.fetchWithFallback(
      `/api/v1/hr-support/cleaner/${cleanerId}/claim-history`,
      token,
      { cleaner: null, stats: {}, claims: [] }
    );
  }

  /**
   * Mark false claim on user
   */
  static async markFalseClaim(token, userId, type, reason, disputeId = null) {
    const result = await HttpClient.post(
      `/api/v1/hr-support/user/${userId}/mark-false-claim`,
      { type, reason, disputeId },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] markFalseClaim failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Get user cancellation history
   */
  static async getCancellationHistory(token, userId) {
    return this.fetchWithFallback(
      `/api/v1/hr-support/user/${userId}/cancellation-history`,
      token,
      { user: null, cancelledAppointments: [], appeals: [] }
    );
  }

  /**
   * Get appointment details
   */
  static async getAppointmentDetails(token, appointmentId) {
    return this.fetchWithFallback(
      `/api/v1/hr-support/appointment/${appointmentId}/details`,
      token,
      { appointment: null }
    );
  }

  /**
   * Waive penalty for user
   */
  static async waivePenalty(token, userId, penaltyType, reason, appointmentId = null) {
    const result = await HttpClient.post(
      `/api/v1/hr-support/user/${userId}/waive-penalty`,
      { penaltyType, reason, appointmentId },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] waivePenalty failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Reset all penalties for user
   */
  static async resetPenalties(token, userId, reason) {
    const result = await HttpClient.post(
      `/api/v1/hr-support/user/${userId}/reset-penalties`,
      { reason },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] resetPenalties failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Send notification to user
   */
  static async sendNotification(token, userId, title, body, options = {}) {
    const result = await HttpClient.post(
      `/api/v1/hr-support/user/${userId}/send-notification`,
      { title, body, ...options },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] sendNotification failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Issue credit to user
   */
  static async issueCredit(token, userId, amount, reason, appointmentId = null) {
    const result = await HttpClient.post(
      `/api/v1/hr-support/user/${userId}/issue-credit`,
      { amount, reason, appointmentId },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] issueCredit failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Get HR staff list
   */
  static async getHRStaff(token) {
    return this.fetchWithFallback(
      "/api/v1/hr-support/hr-staff",
      token,
      { hrStaff: [] }
    );
  }

  /**
   * Assign appeal to HR staff
   */
  static async assignAppeal(token, appealId, assigneeId) {
    const result = await HttpClient.post(
      `/api/v1/hr-support/appeal/${appealId}/assign`,
      { assigneeId },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] assignAppeal failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }

  /**
   * Resolve appeal
   */
  static async resolveAppeal(token, appealId, data) {
    const result = await HttpClient.post(
      `/api/v1/hr-support/appeal/${appealId}/resolve`,
      data,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[HRDashboard] resolveAppeal failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  }
}

export default HRDashboardService;
