import HttpClient from "../HttpClient";

class AppealService {
  // ==================
  // User Endpoints
  // ==================

  /**
   * Submit a new cancellation appeal
   */
  static async submitAppeal(token, data) {
    const result = await HttpClient.post("/appeals", data, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] submitAppeal failed:", result.error);
    }

    return result;
  }

  /**
   * Get appeal details
   */
  static async getAppeal(token, appealId) {
    const result = await HttpClient.get(`/appeals/${appealId}`, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getAppeal failed:", result.error);
    }

    return result;
  }

  /**
   * Get user's appeal history
   */
  static async getMyAppeals(token) {
    const result = await HttpClient.get("/appeals/my-appeals", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getMyAppeals failed:", result.error);
    }

    return result;
  }

  /**
   * Upload supporting documents to an appeal
   */
  static async uploadDocuments(token, appealId, documents) {
    const result = await HttpClient.post(
      `/appeals/${appealId}/documents`,
      { documents },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] uploadDocuments failed:", result.error);
    }

    return result;
  }

  /**
   * Withdraw an appeal
   */
  static async withdrawAppeal(token, appealId) {
    const result = await HttpClient.delete(`/appeals/${appealId}`, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] withdrawAppeal failed:", result.error);
    }

    return result;
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
    const url = `/appeals/queue${queryString ? `?${queryString}` : ""}`;

    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getAppealsQueue failed:", result.error);
    }

    return result;
  }

  /**
   * Get appeal dashboard stats
   */
  static async getAppealsStats(token) {
    const result = await HttpClient.get("/appeals/stats", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getAppealsStats failed:", result.error);
    }

    return result;
  }

  /**
   * Get user's complete appeal history (for HR view)
   */
  static async getUserAppealHistory(token, userId) {
    const result = await HttpClient.get(`/appeals/user/${userId}`, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getUserAppealHistory failed:", result.error);
    }

    return result;
  }

  /**
   * Assign appeal to a reviewer
   */
  static async assignAppeal(token, appealId, assigneeId) {
    const result = await HttpClient.put(
      `/appeals/${appealId}/assign`,
      { assigneeId },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] assignAppeal failed:", result.error);
    }

    return result;
  }

  /**
   * Update appeal status
   */
  static async updateAppealStatus(token, appealId, status, notes = "") {
    const result = await HttpClient.put(
      `/appeals/${appealId}/status`,
      { status, notes },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] updateAppealStatus failed:", result.error);
    }

    return result;
  }

  /**
   * Resolve appeal with decision
   */
  static async resolveAppeal(token, appealId, decision, resolution = {}) {
    const result = await HttpClient.put(
      `/appeals/${appealId}/resolve`,
      { decision, resolution },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] resolveAppeal failed:", result.error);
    }

    return result;
  }

  /**
   * Get SLA breaches
   */
  static async getSLABreaches(token) {
    const result = await HttpClient.get("/appeals/sla-breaches", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getSLABreaches failed:", result.error);
    }

    return result;
  }

  /**
   * Get audit trail for an appeal
   */
  static async getAuditTrail(token, appealId) {
    const result = await HttpClient.get(`/appeals/${appealId}/audit`, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getAuditTrail failed:", result.error);
    }

    return result;
  }

  // ==================
  // HR Dashboard Integration
  // ==================

  /**
   * Get appeals overview for HR dashboard
   */
  static async getAppealsOverview(token) {
    const result = await HttpClient.get("/hr-dashboard/appeals/overview", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getAppealsOverview failed:", result.error);
    }

    return result;
  }

  /**
   * Get SLA summary for HR dashboard
   */
  static async getSLASummary(token) {
    const result = await HttpClient.get("/hr-dashboard/appeals/sla-summary", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getSLASummary failed:", result.error);
    }

    return result;
  }

  /**
   * Get appeals assigned to current HR user
   */
  static async getMyAssignedAppeals(token) {
    const result = await HttpClient.get("/hr-dashboard/appeals/my-assigned", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[AppealService] getMyAssignedAppeals failed:", result.error);
    }

    return result;
  }
}

export default AppealService;
