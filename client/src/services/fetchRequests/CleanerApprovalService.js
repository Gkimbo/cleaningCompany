import HttpClient from "../HttpClient";

/**
 * CleanerApprovalService - Client-side service for homeowner approval of cleaners
 * joining multi-cleaner jobs.
 */
class CleanerApprovalService {
  /**
   * Get all pending join requests for the authenticated homeowner
   * @param {string} token - Auth token
   * @returns {Object} { requests: Array }
   */
  static async getPendingRequests(token) {
    const result = await HttpClient.get("/cleaner-approval/pending", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerApproval] getPendingRequests failed:", result.error);
      return { requests: [] };
    }

    return result;
  }

  /**
   * Get pending join requests for a specific appointment
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @returns {Object} { requests: Array }
   */
  static async getRequestsForAppointment(token, appointmentId) {
    const result = await HttpClient.get(`/cleaner-approval/appointment/${appointmentId}`, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerApproval] getRequestsForAppointment failed:", result.error);
      return { requests: [] };
    }

    return result;
  }

  /**
   * Approve a cleaner's request to join
   * @param {string} token - Auth token
   * @param {number} requestId - Join request ID
   * @returns {Object} { success, message, error }
   */
  static async approveRequest(token, requestId) {
    const result = await HttpClient.post(`/cleaner-approval/${requestId}/approve`, {}, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerApproval] approveRequest failed:", result.error);
      return { success: false, error: result.error || "Failed to approve request" };
    }

    return result;
  }

  /**
   * Decline a cleaner's request to join
   * @param {string} token - Auth token
   * @param {number} requestId - Join request ID
   * @param {string} reason - Optional decline reason
   * @returns {Object} { success, message, error }
   */
  static async declineRequest(token, requestId, reason = null) {
    const result = await HttpClient.post(
      `/cleaner-approval/${requestId}/decline`,
      { reason },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerApproval] declineRequest failed:", result.error);
      return { success: false, error: result.error || "Failed to decline request" };
    }

    return result;
  }
}

export default CleanerApprovalService;
