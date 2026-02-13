import { API_BASE } from "../config";

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
    try {
      const response = await fetch(`${API_BASE}/cleaner-approval/pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        console.warn(`[CleanerApproval] Failed to fetch: ${response.status}`);
        return { requests: [] };
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      return { requests: [] };
    }
  }

  /**
   * Get pending join requests for a specific appointment
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @returns {Object} { requests: Array }
   */
  static async getRequestsForAppointment(token, appointmentId) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-approval/appointment/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        console.warn(`[CleanerApproval] Failed to fetch: ${response.status}`);
        return { requests: [] };
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching appointment requests:", error);
      return { requests: [] };
    }
  }

  /**
   * Approve a cleaner's request to join
   * @param {string} token - Auth token
   * @param {number} requestId - Join request ID
   * @returns {Object} { success, message, error }
   */
  static async approveRequest(token, requestId) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-approval/${requestId}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error approving request:", error);
      return { success: false, error: "Failed to approve request" };
    }
  }

  /**
   * Decline a cleaner's request to join
   * @param {string} token - Auth token
   * @param {number} requestId - Join request ID
   * @param {string} reason - Optional decline reason
   * @returns {Object} { success, message, error }
   */
  static async declineRequest(token, requestId, reason = null) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-approval/${requestId}/decline`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error declining request:", error);
      return { success: false, error: "Failed to decline request" };
    }
  }
}

export default CleanerApprovalService;
