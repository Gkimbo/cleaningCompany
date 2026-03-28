import HttpClient from "../HttpClient";

/**
 * ConflictService
 *
 * Frontend API service for the Conflict Resolution Center.
 * Handles both appeals and adjustment disputes.
 */
class ConflictService {
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
    if (filters.includeResolved) params.append("includeResolved", "true");

    const queryString = params.toString();
    const url = `/api/v1/conflicts/queue${queryString ? `?${queryString}` : ""}`;

    const result = await HttpClient.get(url, { token, useBaseUrl: true });

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getQueue failed:", result.error);
    }

    return result;
  }

  /**
   * Get queue statistics
   */
  static async getStats(token) {
    const result = await HttpClient.get("/api/v1/conflicts/stats", { token, useBaseUrl: true });

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getStats failed:", result.error);
    }

    return result;
  }

  // ==================
  // Case Details
  // ==================

  /**
   * Get full case details
   */
  static async getCase(token, caseType, caseId) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/${caseType}/${caseId}`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getCase failed:", result.error);
    }

    return result;
  }

  /**
   * Get appointment photos for a case
   */
  static async getPhotos(token, caseType, caseId) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/${caseType}/${caseId}/photos`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getPhotos failed:", result.error);
    }

    return result;
  }

  /**
   * Get appointment checklist for a case
   */
  static async getChecklist(token, caseType, caseId) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/${caseType}/${caseId}/checklist`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getChecklist failed:", result.error);
    }

    return result;
  }

  /**
   * Get appointment messages for a case
   */
  static async getMessages(token, caseType, caseId) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/${caseType}/${caseId}/messages`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getMessages failed:", result.error);
    }

    return result;
  }

  /**
   * Get audit trail for a case
   */
  static async getAuditTrail(token, caseType, caseId) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/${caseType}/${caseId}/audit`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getAuditTrail failed:", result.error);
    }

    return result;
  }

  // ==================
  // Actions
  // ==================

  /**
   * Process refund to homeowner
   */
  static async processRefund(token, caseType, caseId, amount, reason) {
    const result = await HttpClient.post(
      `/api/v1/conflicts/${caseType}/${caseId}/refund`,
      { amount, reason },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] processRefund failed:", result.error);
    }

    return result;
  }

  /**
   * Process payout to cleaner
   */
  static async processPayout(token, caseType, caseId, amount, reason) {
    const result = await HttpClient.post(
      `/api/v1/conflicts/${caseType}/${caseId}/payout`,
      { amount, reason },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] processPayout failed:", result.error);
    }

    return result;
  }

  /**
   * Add a reviewer note
   */
  static async addNote(token, caseType, caseId, note) {
    const result = await HttpClient.post(
      `/api/v1/conflicts/${caseType}/${caseId}/note`,
      { note },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] addNote failed:", result.error);
    }

    return result;
  }

  /**
   * Resolve a case
   */
  static async resolveCase(token, caseType, caseId, decision, resolution, notes) {
    const result = await HttpClient.post(
      `/api/v1/conflicts/${caseType}/${caseId}/resolve`,
      { decision, resolution, notes },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] resolveCase failed:", result.error);
    }

    return result;
  }

  /**
   * Assign case to a reviewer
   */
  static async assignCase(token, caseType, caseId, assigneeId) {
    const result = await HttpClient.post(
      `/api/v1/conflicts/${caseType}/${caseId}/assign`,
      { assigneeId },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] assignCase failed:", result.error);
    }

    return result;
  }

  // ==================
  // Support Tickets
  // ==================

  /**
   * Create a new support ticket
   */
  static async createSupportTicket(token, ticketData) {
    const result = await HttpClient.post(
      "/api/v1/conflicts/support/create",
      ticketData,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] createSupportTicket failed:", result.error);
    }

    return result;
  }

  /**
   * Get linked conversation messages for a support ticket
   */
  static async getLinkedConversation(token, ticketId) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/support/${ticketId}/conversation`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getLinkedConversation failed:", result.error);
    }

    return result;
  }

  // ==================
  // Lookup & Search
  // ==================

  /**
   * Get refund info for a case (original amount, already refunded, max refundable)
   */
  static async getRefundInfo(token, caseType, caseId) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/${caseType}/${caseId}/refund-info`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getRefundInfo failed:", result.error);
    }

    return result;
  }

  /**
   * Quick lookup by case number (APL-xxx, ADJ-xxx, PD-xxx, ST-xxx)
   */
  static async lookupByNumber(token, caseNumber) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/lookup/${encodeURIComponent(caseNumber)}`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] lookupByNumber failed:", result.error);
    }

    return result;
  }

  /**
   * Get all cases for a specific user
   */
  static async getUserCases(token, userId, includeResolved = false) {
    const params = new URLSearchParams();
    if (includeResolved) params.append("includeResolved", "true");

    const queryString = params.toString();
    const url = `/api/v1/conflicts/user/${userId}/cases${queryString ? `?${queryString}` : ""}`;

    const result = await HttpClient.get(url, { token, useBaseUrl: true });

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] getUserCases failed:", result.error);
    }

    return result;
  }

  /**
   * Search for a user and get their cases (by email, phone, or ID)
   */
  static async searchUserCases(token, query) {
    const result = await HttpClient.get(
      `/api/v1/conflicts/user/search?query=${encodeURIComponent(query)}`,
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ConflictService] searchUserCases failed:", result.error);
    }

    return result;
  }
}

export default ConflictService;
