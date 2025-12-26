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
}

export default HRDashboardService;
