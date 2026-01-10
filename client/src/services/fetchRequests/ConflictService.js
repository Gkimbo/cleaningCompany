import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

/**
 * ConflictService
 *
 * Frontend API service for the Conflict Resolution Center.
 * Handles both appeals and adjustment disputes.
 */
class ConflictService {
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
      console.error("[ConflictService] Request failed:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ==================
  // Queue & Stats
  // ==================

  /**
   * Get unified conflict queue
   */
  static async getQueue(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.caseType) params.append("caseType", filters.caseType);
    if (filters.status) params.append("status", filters.status);
    if (filters.priority) params.append("priority", filters.priority);
    if (filters.assignedTo) params.append("assignedTo", filters.assignedTo);
    if (filters.search) params.append("search", filters.search);
    if (filters.limit) params.append("limit", filters.limit);
    if (filters.offset) params.append("offset", filters.offset);

    const queryString = params.toString();
    const url = `${baseURL}/api/v1/conflicts/queue${queryString ? `?${queryString}` : ""}`;

    return this.fetchWithAuth(url, token);
  }

  /**
   * Get queue statistics
   */
  static async getStats(token) {
    return this.fetchWithAuth(`${baseURL}/api/v1/conflicts/stats`, token);
  }

  // ==================
  // Case Details
  // ==================

  /**
   * Get full case details
   */
  static async getCase(token, caseType, caseId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}`,
      token
    );
  }

  /**
   * Get appointment photos for a case
   */
  static async getPhotos(token, caseType, caseId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/photos`,
      token
    );
  }

  /**
   * Get appointment checklist for a case
   */
  static async getChecklist(token, caseType, caseId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/checklist`,
      token
    );
  }

  /**
   * Get appointment messages for a case
   */
  static async getMessages(token, caseType, caseId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/messages`,
      token
    );
  }

  /**
   * Get audit trail for a case
   */
  static async getAuditTrail(token, caseType, caseId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/audit`,
      token
    );
  }

  // ==================
  // Actions
  // ==================

  /**
   * Process refund to homeowner
   */
  static async processRefund(token, caseType, caseId, amount, reason) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/refund`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      }
    );
  }

  /**
   * Process payout to cleaner
   */
  static async processPayout(token, caseType, caseId, amount, reason) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/payout`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      }
    );
  }

  /**
   * Add a reviewer note
   */
  static async addNote(token, caseType, caseId, note) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/note`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ note }),
      }
    );
  }

  /**
   * Resolve a case
   */
  static async resolveCase(token, caseType, caseId, decision, resolution, notes) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/resolve`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ decision, resolution, notes }),
      }
    );
  }

  /**
   * Assign case to a reviewer
   */
  static async assignCase(token, caseType, caseId, assigneeId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/conflicts/${caseType}/${caseId}/assign`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ assigneeId }),
      }
    );
  }
}

export default ConflictService;
