import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class GuestNotLeftService {
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
      console.error("[GuestNotLeftService] Request failed:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // ==================
  // Cleaner Endpoints
  // ==================

  /**
   * Report tenant still present at property
   */
  static async reportTenantPresent(token, appointmentId, gpsData = {}, notes = null) {
    return this.fetchWithAuth(`${baseURL}/api/v1/guest-not-left/report`, token, {
      method: "POST",
      body: JSON.stringify({
        appointmentId,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        notes,
      }),
    });
  }

  /**
   * Cleaner will wait on-site
   */
  static async cleanerWillWait(token, reportId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/wait`,
      token,
      { method: "POST" }
    );
  }

  /**
   * Cleaner will return later
   */
  static async cleanerWillReturn(token, reportId, estimatedReturnTime = null) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/will-return`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ estimatedReturnTime }),
      }
    );
  }

  /**
   * Cleaner cancels - no penalty
   */
  static async cleanerCancel(token, reportId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/cancel`,
      token,
      { method: "POST" }
    );
  }

  /**
   * Cleaner has returned to property
   */
  static async cleanerReturned(token, reportId, gpsData = {}) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/returned`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          latitude: gpsData.latitude,
          longitude: gpsData.longitude,
        }),
      }
    );
  }

  /**
   * Cleaner proceeding with job (tenant left)
   */
  static async cleanerProceed(token, reportId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/proceed`,
      token,
      { method: "POST" }
    );
  }

  // ==================
  // Homeowner Endpoints
  // ==================

  /**
   * Homeowner: tenant is leaving (resolved)
   */
  static async homeownerResolved(token, reportId, note = null) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/resolved`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ note }),
      }
    );
  }

  /**
   * Homeowner: need more time
   */
  static async homeownerNeedsTime(token, reportId, additionalMinutes, note = null) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/need-time`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ additionalMinutes, note }),
      }
    );
  }

  /**
   * Homeowner: cannot resolve today
   */
  static async homeownerCannotResolve(token, reportId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}/cannot-resolve`,
      token,
      { method: "POST" }
    );
  }

  // ==================
  // Query Endpoints
  // ==================

  /**
   * Get active report for an appointment
   */
  static async getActiveReport(token, appointmentId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/active/${appointmentId}`,
      token
    );
  }

  /**
   * Get pending reports for homeowner
   */
  static async getPendingReports(token) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/pending`,
      token
    );
  }

  /**
   * Get report details by ID
   */
  static async getReport(token, reportId) {
    return this.fetchWithAuth(
      `${baseURL}/api/v1/guest-not-left/${reportId}`,
      token
    );
  }
}

export default GuestNotLeftService;
