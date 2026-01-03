import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class SuspiciousReportsService {
  static async fetchWithFallback(url, token, fallback = {}) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[SuspiciousReports] ${url} returned ${response.status}`);
        return fallback;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[SuspiciousReports] ${url} failed:`, error.message);
      return fallback;
    }
  }

  /**
   * Get all suspicious activity reports with optional filters
   * @param {string} token - Auth token
   * @param {Object} filters - Optional filters { status, search, page, limit }
   */
  static async getReports(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    if (filters.page) params.append("page", filters.page);
    if (filters.limit) params.append("limit", filters.limit);

    const queryString = params.toString();
    const url = `${baseURL}/api/v1/suspicious-reports${queryString ? `?${queryString}` : ""}`;

    return this.fetchWithFallback(url, token, {
      reports: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });
  }

  /**
   * Get quick stats for dashboard display
   */
  static async getStats(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/suspicious-reports/stats`,
      token,
      {
        pending: 0,
        reviewed: 0,
        dismissed: 0,
        actionTaken: 0,
        resolvedThisWeek: 0,
        warnedUsers: 0,
        suspendedUsers: 0,
      }
    );
  }

  /**
   * Get a specific report with full details
   */
  static async getReportById(token, id) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/suspicious-reports/${id}`,
      token,
      { report: null }
    );
  }

  /**
   * Get all reports for a specific user (as reported)
   */
  static async getUserHistory(token, userId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/suspicious-reports/user/${userId}/history`,
      token,
      { user: null, reports: [] }
    );
  }

  /**
   * Take action on a report
   * @param {string} token - Auth token
   * @param {number} id - Report ID
   * @param {string} action - Action to take: 'dismiss', 'reviewed', 'warn', 'suspend', 'clear_flags'
   * @param {string} notes - Notes for the action (required for warn/suspend)
   */
  static async takeAction(token, id, action, notes = "") {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/suspicious-reports/${id}/action`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, notes }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to take action",
        };
      }

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error("[SuspiciousReports] takeAction failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }
}

export default SuspiciousReportsService;
