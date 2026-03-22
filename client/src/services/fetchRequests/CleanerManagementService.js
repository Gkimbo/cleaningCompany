import HttpClient from "../HttpClient";

class CleanerManagementService {
  /**
   * Get all cleaners with their frozen status
   * @param {string} token - Auth token
   * @param {string} status - Filter: "all", "active", or "frozen"
   */
  static async getCleaners(token, status = "all") {
    const result = await HttpClient.get(
      `/owner-dashboard/cleaners?status=${status}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerManagement] getCleaners failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to fetch cleaners",
      };
    }

    return { success: true, cleaners: result.cleaners || [] };
  }

  /**
   * Freeze a cleaner account
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner to freeze
   * @param {string} reason - Reason for freezing (required, min 5 chars)
   */
  static async freezeCleaner(token, cleanerId, reason) {
    const result = await HttpClient.post(
      `/owner-dashboard/cleaners/${cleanerId}/freeze`,
      { reason },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerManagement] freezeCleaner failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to freeze cleaner",
      };
    }

    return { success: true, cleaner: result.cleaner, message: result.message };
  }

  /**
   * Unfreeze a cleaner account
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner to unfreeze
   */
  static async unfreezeCleaner(token, cleanerId) {
    const result = await HttpClient.post(
      `/owner-dashboard/cleaners/${cleanerId}/unfreeze`,
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerManagement] unfreezeCleaner failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to unfreeze cleaner",
      };
    }

    return { success: true, cleaner: result.cleaner, message: result.message };
  }

  /**
   * Get detailed cleaner profile with metrics and earnings
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner
   */
  static async getCleanerDetails(token, cleanerId) {
    const result = await HttpClient.get(
      `/owner-dashboard/cleaners/${cleanerId}/details`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerManagement] getCleanerDetails failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to fetch cleaner details",
      };
    }

    return {
      success: true,
      cleaner: result.cleaner,
      metrics: result.metrics,
      earnings: result.earnings,
    };
  }

  /**
   * Get cleaner job history with pagination
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner
   * @param {object} options - { page, limit, status }
   */
  static async getCleanerJobHistory(token, cleanerId, options = {}) {
    const { page = 1, limit = 20, status = "all" } = options;
    const params = new URLSearchParams({ page, limit, status });

    const result = await HttpClient.get(
      `/owner-dashboard/cleaners/${cleanerId}/job-history?${params}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerManagement] getCleanerJobHistory failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to fetch job history",
      };
    }

    return {
      success: true,
      jobs: result.jobs,
      pagination: result.pagination,
    };
  }

  /**
   * Issue a warning to a cleaner
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner
   * @param {string} reason - Reason for the warning (min 10 chars)
   * @param {string} severity - "minor" or "major"
   */
  static async issueWarning(token, cleanerId, reason, severity = "minor") {
    const result = await HttpClient.post(
      `/owner-dashboard/cleaners/${cleanerId}/warning`,
      { reason, severity },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[CleanerManagement] issueWarning failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to issue warning",
      };
    }

    return {
      success: true,
      warningCount: result.warningCount,
      message: result.message,
    };
  }
}

export default CleanerManagementService;
