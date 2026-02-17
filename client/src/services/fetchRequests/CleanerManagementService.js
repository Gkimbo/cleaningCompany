import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class CleanerManagementService {
  /**
   * Get all cleaners with their frozen status
   * @param {string} token - Auth token
   * @param {string} status - Filter: "all", "active", or "frozen"
   */
  static async getCleaners(token, status = "all") {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/owner-dashboard/cleaners?status=${status}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || "Failed to fetch cleaners",
        };
      }

      const data = await response.json();
      return { success: true, cleaners: data.cleaners || [] };
    } catch (error) {
      console.error("[CleanerManagement] getCleaners failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Freeze a cleaner account
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner to freeze
   * @param {string} reason - Reason for freezing (required, min 5 chars)
   */
  static async freezeCleaner(token, cleanerId, reason) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/owner-dashboard/cleaners/${cleanerId}/freeze`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to freeze cleaner",
        };
      }

      return { success: true, cleaner: data.cleaner, message: data.message };
    } catch (error) {
      console.error("[CleanerManagement] freezeCleaner failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Unfreeze a cleaner account
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner to unfreeze
   */
  static async unfreezeCleaner(token, cleanerId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/owner-dashboard/cleaners/${cleanerId}/unfreeze`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to unfreeze cleaner",
        };
      }

      return { success: true, cleaner: data.cleaner, message: data.message };
    } catch (error) {
      console.error(
        "[CleanerManagement] unfreezeCleaner failed:",
        error.message
      );
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get detailed cleaner profile with metrics and earnings
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner
   */
  static async getCleanerDetails(token, cleanerId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/owner-dashboard/cleaners/${cleanerId}/details`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || "Failed to fetch cleaner details",
        };
      }

      const data = await response.json();
      return {
        success: true,
        cleaner: data.cleaner,
        metrics: data.metrics,
        earnings: data.earnings,
      };
    } catch (error) {
      console.error(
        "[CleanerManagement] getCleanerDetails failed:",
        error.message
      );
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get cleaner job history with pagination
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner
   * @param {object} options - { page, limit, status }
   */
  static async getCleanerJobHistory(token, cleanerId, options = {}) {
    try {
      const { page = 1, limit = 20, status = "all" } = options;
      const params = new URLSearchParams({ page, limit, status });

      const response = await fetch(
        `${baseURL}/api/v1/owner-dashboard/cleaners/${cleanerId}/job-history?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || "Failed to fetch job history",
        };
      }

      const data = await response.json();
      return {
        success: true,
        jobs: data.jobs,
        pagination: data.pagination,
      };
    } catch (error) {
      console.error(
        "[CleanerManagement] getCleanerJobHistory failed:",
        error.message
      );
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Issue a warning to a cleaner
   * @param {string} token - Auth token
   * @param {number} cleanerId - ID of the cleaner
   * @param {string} reason - Reason for the warning (min 10 chars)
   * @param {string} severity - "minor" or "major"
   */
  static async issueWarning(token, cleanerId, reason, severity = "minor") {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/owner-dashboard/cleaners/${cleanerId}/warning`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason, severity }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to issue warning",
        };
      }

      return {
        success: true,
        warningCount: data.warningCount,
        message: data.message,
      };
    } catch (error) {
      console.error("[CleanerManagement] issueWarning failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }
}

export default CleanerManagementService;
