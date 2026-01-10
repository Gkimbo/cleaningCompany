import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class AppealService {
  // ==================
  // Helper Methods
  // ==================
  static async fetchWithAuth(url, token, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Request failed" };
      }

      return { success: true, ...data };
    } catch (error) {
      console.error("[AppealService] Request failed:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ==================
  // User Endpoints
  // ==================

  /**
   * Submit a new cancellation appeal
   */
  static async submitAppeal(token, data) {
    return this.fetchWithAuth(`${baseURL}/api/v1/appeals`, token, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get appeal details
   */
  static async getAppeal(token, appealId) {
    return this.fetchWithAuth(`${baseURL}/api/v1/appeals/${appealId}`, token);
  }

  /**
   * Get user's appeal history
   */
  static async getMyAppeals(token) {
    return this.fetchWithAuth(`${baseURL}/api/v1/appeals/my-appeals`, token);
  }

  /**
   * Upload supporting documents to an appeal
   */
  static async uploadDocuments(token, appealId, documents) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/appeals/${appealId}/documents`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ documents }),
      }
    );
  }

  /**
   * Withdraw an appeal
   */
  static async withdrawAppeal(token, appealId) {
    return this.fetchWithAuth(`${baseURL}/api/v1/appeals/${appealId}`, token, {
      method: "DELETE",
    });
  }

  // ==================
  // HR/Owner Endpoints
  // ==================

  /**
   * Get appeals queue for HR/Owner
   */
  static async getAppealsQueue(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.priority) params.append("priority", filters.priority);
    if (filters.assignedTo) params.append("assignedTo", filters.assignedTo);
    if (filters.limit) params.append("limit", filters.limit);
    if (filters.offset) params.append("offset", filters.offset);

    const queryString = params.toString();
    const url = `${baseURL}/api/v1/appeals/queue${queryString ? `?${queryString}` : ""}`;

    return this.fetchWithAuth(url, token);
  }

  /**
   * Get appeal dashboard stats
   */
  static async getAppealsStats(token) {
    return this.fetchWithAuth(`${baseURL}/api/v1/appeals/stats`, token);
  }

  /**
   * Get user's complete appeal history (for HR view)
   */
  static async getUserAppealHistory(token, userId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/appeals/user/${userId}`,
      token
    );
  }

  /**
   * Assign appeal to a reviewer
   */
  static async assignAppeal(token, appealId, assigneeId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/appeals/${appealId}/assign`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({ assigneeId }),
      }
    );
  }

  /**
   * Update appeal status
   */
  static async updateAppealStatus(token, appealId, status, notes = "") {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/appeals/${appealId}/status`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({ status, notes }),
      }
    );
  }

  /**
   * Resolve appeal with decision
   */
  static async resolveAppeal(token, appealId, decision, resolution = {}) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/appeals/${appealId}/resolve`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({ decision, resolution }),
      }
    );
  }

  /**
   * Get SLA breaches
   */
  static async getSLABreaches(token) {
    return this.fetchWithAuth(`${baseURL}/api/v1/appeals/sla-breaches`, token);
  }

  /**
   * Get audit trail for an appeal
   */
  static async getAuditTrail(token, appealId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/appeals/${appealId}/audit`,
      token
    );
  }

  // ==================
  // HR Dashboard Integration
  // ==================

  /**
   * Get appeals overview for HR dashboard
   */
  static async getAppealsOverview(token) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/hr-dashboard/appeals/overview`,
      token
    );
  }

  /**
   * Get SLA summary for HR dashboard
   */
  static async getSLASummary(token) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/hr-dashboard/appeals/sla-summary`,
      token
    );
  }

  /**
   * Get appeals assigned to current HR user
   */
  static async getMyAssignedAppeals(token) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/hr-dashboard/appeals/my-assigned`,
      token
    );
  }
}

export default AppealService;
