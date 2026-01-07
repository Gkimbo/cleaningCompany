/**
 * BusinessEmployeeService - Client-side service for business employee API calls
 * Handles invitation acceptance, job management, and earnings
 */

import { API_BASE } from "../config";

class BusinessEmployeeService {
  // =====================
  // INVITATION HANDLING
  // =====================

  /**
   * Validate an invitation token (public - no auth required)
   * @param {string} token - Invitation token
   * @returns {Object} { valid, invitation, error, isExpired, isAlreadyAccepted, isTerminated }
   */
  static async validateInvite(inviteToken) {
    try {
      const response = await fetch(`${API_BASE}/business-employee/invite/${inviteToken}`);
      const result = await response.json();

      if (response.status === 404) {
        return { valid: false, error: "Invalid invitation link" };
      }
      if (response.status === 410) {
        return {
          valid: false,
          error: result.error,
          isExpired: result.isExpired || false,
          isTerminated: result.isTerminated || false,
        };
      }
      if (response.status === 409) {
        return { valid: false, error: result.error, isAlreadyAccepted: true };
      }

      return { valid: true, invitation: result.invitation };
    } catch (error) {
      console.error("[BusinessEmployee] Error validating invite:", error);
      return { valid: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Accept an invitation (requires authenticated user)
   * @param {string} authToken - Auth token
   * @param {string} inviteToken - Invitation token
   * @returns {Object} { success, employee, message, error }
   */
  static async acceptInvite(authToken, inviteToken) {
    try {
      const response = await fetch(`${API_BASE}/business-employee/invite/${inviteToken}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to accept invitation" };
      }

      return { success: true, employee: result.employee, message: result.message };
    } catch (error) {
      console.error("[BusinessEmployee] Error accepting invite:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // =====================
  // JOB MANAGEMENT
  // =====================

  /**
   * Get assigned jobs for the authenticated employee
   * @param {string} token - Auth token
   * @param {Object} filters - { status, upcoming }
   * @returns {Object} { jobs }
   */
  static async getMyJobs(token, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.upcoming) params.append("upcoming", "true");

      const url = `${API_BASE}/business-employee/my-jobs${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessEmployee] Error fetching jobs:", error);
      return { jobs: [] };
    }
  }

  /**
   * Get details for a specific job assignment
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @returns {Object} { job }
   */
  static async getJobDetails(token, assignmentId) {
    try {
      const response = await fetch(`${API_BASE}/business-employee/my-jobs/${assignmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessEmployee] Error fetching job details:", error);
      return null;
    }
  }

  /**
   * Start a job
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @returns {Object} { success, assignment, message, error }
   */
  static async startJob(token, assignmentId) {
    try {
      const response = await fetch(`${API_BASE}/business-employee/my-jobs/${assignmentId}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to start job" };
      }

      return { success: true, assignment: result.assignment, message: result.message };
    } catch (error) {
      console.error("[BusinessEmployee] Error starting job:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Complete a job
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @param {number} hoursWorked - Optional hours worked (for hourly jobs)
   * @returns {Object} { success, assignment, message, error }
   */
  static async completeJob(token, assignmentId, hoursWorked = null) {
    try {
      const body = hoursWorked ? { hoursWorked } : {};
      const response = await fetch(`${API_BASE}/business-employee/my-jobs/${assignmentId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to complete job" };
      }

      return { success: true, assignment: result.assignment, message: result.message };
    } catch (error) {
      console.error("[BusinessEmployee] Error completing job:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // =====================
  // EARNINGS
  // =====================

  /**
   * Get earnings summary for the authenticated employee
   * @param {string} token - Auth token
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} { period, summary, formatted, jobs }
   */
  static async getEarnings(token, startDate = null, endDate = null) {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const url = `${API_BASE}/business-employee/my-earnings${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessEmployee] Error fetching earnings:", error);
      return {
        period: {},
        summary: { totalEarnings: 0, jobCount: 0, paidCount: 0, pendingCount: 0, pendingAmount: 0 },
        formatted: { totalEarnings: "$0.00", pendingAmount: "$0.00" },
      };
    }
  }

  // =====================
  // PROFILE
  // =====================

  /**
   * Get the authenticated employee's profile
   * @param {string} token - Auth token
   * @returns {Object} { profile }
   */
  static async getProfile(token) {
    try {
      const response = await fetch(`${API_BASE}/business-employee/my-profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessEmployee] Error fetching profile:", error);
      return null;
    }
  }

  // =====================
  // STRIPE CONNECT
  // =====================

  /**
   * Get Stripe Connect status for the authenticated employee
   * @param {string} token - Auth token
   * @returns {Object} { paymentMethod, stripeConnectOnboarded, stripeAccountId }
   */
  static async getStripeStatus(token) {
    try {
      const response = await fetch(`${API_BASE}/business-employee/stripe-connect/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessEmployee] Error fetching Stripe status:", error);
      return { paymentMethod: null, stripeConnectOnboarded: false, stripeAccountId: null };
    }
  }

  /**
   * Start Stripe Connect onboarding
   * @param {string} token - Auth token
   * @returns {Object} { success, onboardingUrl, error }
   */
  static async startStripeOnboarding(token) {
    try {
      const response = await fetch(`${API_BASE}/business-employee/stripe-connect/onboard`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to start onboarding" };
      }

      return { success: true, onboardingUrl: result.onboardingUrl };
    } catch (error) {
      console.error("[BusinessEmployee] Error starting Stripe onboarding:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }
}

export default BusinessEmployeeService;
