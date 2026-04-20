import HttpClient from "../HttpClient";

class GuestNotLeftService {
  // ==================
  // Cleaner Endpoints
  // ==================

  /**
   * Report tenant still present at property
   */
  static async reportTenantPresent(token, appointmentId, gpsData = {}, notes = null) {
    const result = await HttpClient.post(
      "/guest-not-left/report",
      {
        appointmentId,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        notes,
      },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] reportTenantPresent failed:", result.error);
    }

    return result;
  }

  /**
   * Cleaner will wait on-site
   */
  static async cleanerWillWait(token, reportId) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/wait`,
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] cleanerWillWait failed:", result.error);
    }

    return result;
  }

  /**
   * Cleaner will return later
   */
  static async cleanerWillReturn(token, reportId, estimatedReturnTime = null) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/will-return`,
      { estimatedReturnTime },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] cleanerWillReturn failed:", result.error);
    }

    return result;
  }

  /**
   * Cleaner cancels - no penalty
   */
  static async cleanerCancel(token, reportId) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/cancel`,
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] cleanerCancel failed:", result.error);
    }

    return result;
  }

  /**
   * Cleaner has returned to property
   */
  static async cleanerReturned(token, reportId, gpsData = {}) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/returned`,
      {
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
      },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] cleanerReturned failed:", result.error);
    }

    return result;
  }

  /**
   * Cleaner proceeding with job (tenant left)
   */
  static async cleanerProceed(token, reportId) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/proceed`,
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] cleanerProceed failed:", result.error);
    }

    return result;
  }

  // ==================
  // Homeowner Endpoints
  // ==================

  /**
   * Homeowner: tenant is leaving (resolved)
   */
  static async homeownerResolved(token, reportId, note = null) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/resolved`,
      { note },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] homeownerResolved failed:", result.error);
    }

    return result;
  }

  /**
   * Homeowner: need more time
   */
  static async homeownerNeedsTime(token, reportId, additionalMinutes, note = null) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/need-time`,
      { additionalMinutes, note },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] homeownerNeedsTime failed:", result.error);
    }

    return result;
  }

  /**
   * Homeowner: cannot resolve today
   */
  static async homeownerCannotResolve(token, reportId) {
    const result = await HttpClient.post(
      `/guest-not-left/${reportId}/cannot-resolve`,
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] homeownerCannotResolve failed:", result.error);
    }

    return result;
  }

  // ==================
  // Query Endpoints
  // ==================

  /**
   * Get active report for an appointment
   */
  static async getActiveReport(token, appointmentId) {
    const result = await HttpClient.get(
      `/guest-not-left/active/${appointmentId}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] getActiveReport failed:", result.error);
    }

    return result;
  }

  /**
   * Get pending reports for homeowner
   */
  static async getPendingReports(token) {
    const result = await HttpClient.get(
      "/guest-not-left/pending",
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] getPendingReports failed:", result.error);
    }

    return result;
  }

  /**
   * Get report details by ID
   */
  static async getReport(token, reportId) {
    const result = await HttpClient.get(
      `/guest-not-left/${reportId}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[GuestNotLeftService] getReport failed:", result.error);
    }

    return result;
  }
}

export default GuestNotLeftService;
