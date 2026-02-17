import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class HRDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[HRDashboard] ${url} returned ${response.status}`);
        return fallback;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[HRDashboard] ${url} failed:`, error.message);
      return fallback;
    }
  }

  static async getPendingDisputes(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-dashboard/disputes/pending`,
      token,
      { disputes: [] }
    );
  }

  static async getDispute(token, id) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-dashboard/disputes/${id}`,
      token,
      { dispute: null }
    );
  }

  static async getSupportConversations(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-dashboard/support-conversations`,
      token,
      { conversations: [] }
    );
  }

  static async getQuickStats(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-dashboard/quick-stats`,
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
    try {
      const response = await fetch(
        `${baseURL}/api/v1/home-size-adjustment/${disputeId}/owner-resolve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to resolve dispute",
        };
      }

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error("[HRDashboard] resolveDispute failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
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
      `${baseURL}/api/v1/hr-support/search?${params}`,
      token,
      { users: [] }
    );
  }

  /**
   * Get user profile with history
   */
  static async getUserProfile(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-support/user/${userId}/profile`,
      token,
      { profile: null }
    );
  }

  /**
   * Update user notes
   */
  static async updateUserNotes(token, userId, notes) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/user/${userId}/notes`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes }),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Get home details with history
   */
  static async getHomeDetails(token, homeId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-support/home/${homeId}/details`,
      token,
      { home: null }
    );
  }

  /**
   * Update home size
   */
  static async updateHomeSize(token, homeId, data) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/home/${homeId}/size`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Get cleaner claim history
   */
  static async getCleanerClaimHistory(token, cleanerId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-support/cleaner/${cleanerId}/claim-history`,
      token,
      { cleaner: null, stats: {}, claims: [] }
    );
  }

  /**
   * Mark false claim on user
   */
  static async markFalseClaim(token, userId, type, reason, disputeId = null) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/user/${userId}/mark-false-claim`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type, reason, disputeId }),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Get user cancellation history
   */
  static async getCancellationHistory(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-support/user/${userId}/cancellation-history`,
      token,
      { user: null, cancelledAppointments: [], appeals: [] }
    );
  }

  /**
   * Get appointment details
   */
  static async getAppointmentDetails(token, appointmentId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-support/appointment/${appointmentId}/details`,
      token,
      { appointment: null }
    );
  }

  /**
   * Waive penalty for user
   */
  static async waivePenalty(token, userId, penaltyType, reason, appointmentId = null) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/user/${userId}/waive-penalty`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ penaltyType, reason, appointmentId }),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Reset all penalties for user
   */
  static async resetPenalties(token, userId, reason) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/user/${userId}/reset-penalties`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Send notification to user
   */
  static async sendNotification(token, userId, title, body, options = {}) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/user/${userId}/send-notification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title, body, ...options }),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Issue credit to user
   */
  static async issueCredit(token, userId, amount, reason, appointmentId = null) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/user/${userId}/issue-credit`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount, reason, appointmentId }),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Get HR staff list
   */
  static async getHRStaff(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/hr-support/hr-staff`,
      token,
      { hrStaff: [] }
    );
  }

  /**
   * Assign appeal to HR staff
   */
  static async assignAppeal(token, appealId, assigneeId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/appeal/${appealId}/assign`,
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
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  /**
   * Resolve appeal
   */
  static async resolveAppeal(token, appealId, data) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/hr-support/appeal/${appealId}/resolve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );
      const result = await response.json();
      return response.ok ? { success: true, ...result } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }
}

export default HRDashboardService;
