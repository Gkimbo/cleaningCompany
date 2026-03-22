import HttpClient from "../HttpClient";

class SuspiciousReportsService {
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
    const url = `/suspicious-reports${queryString ? `?${queryString}` : ""}`;

    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      __DEV__ && console.warn(`[SuspiciousReports] getReports failed:`, result.error);
      return {
        reports: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
    }

    return result;
  }

  /**
   * Get quick stats for dashboard display
   */
  static async getStats(token) {
    const result = await HttpClient.get("/suspicious-reports/stats", { token });

    if (result.success === false) {
      __DEV__ && console.warn(`[SuspiciousReports] getStats failed:`, result.error);
      return {
        pending: 0,
        reviewed: 0,
        dismissed: 0,
        actionTaken: 0,
        resolvedThisWeek: 0,
        warnedUsers: 0,
        suspendedUsers: 0,
      };
    }

    return result;
  }

  /**
   * Get a specific report with full details
   */
  static async getReportById(token, id) {
    const result = await HttpClient.get(`/suspicious-reports/${id}`, { token });

    if (result.success === false) {
      __DEV__ && console.warn(`[SuspiciousReports] getReportById failed:`, result.error);
      return { report: null };
    }

    return result;
  }

  /**
   * Get all reports for a specific user (as reported)
   */
  static async getUserHistory(token, userId) {
    const result = await HttpClient.get(`/suspicious-reports/user/${userId}/history`, { token });

    if (result.success === false) {
      __DEV__ && console.warn(`[SuspiciousReports] getUserHistory failed:`, result.error);
      return { user: null, reports: [] };
    }

    return result;
  }

  /**
   * Take action on a report
   * @param {string} token - Auth token
   * @param {number} id - Report ID
   * @param {string} action - Action to take: 'dismiss', 'reviewed', 'warn', 'suspend', 'clear_flags'
   * @param {string} notes - Notes for the action (required for warn/suspend)
   */
  static async takeAction(token, id, action, notes = "") {
    const result = await HttpClient.post(
      `/suspicious-reports/${id}/action`,
      { action, notes },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn(`[SuspiciousReports] takeAction failed:`, result.error);
      return {
        success: false,
        error: result.error || "Failed to take action",
      };
    }

    return {
      success: true,
      ...result,
    };
  }
}

export default SuspiciousReportsService;
