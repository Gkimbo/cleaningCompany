/**
 * BusinessEmployeeService - Client-side service for business employee API calls
 * Handles invitation acceptance, job management, and earnings
 */

import HttpClient from "../HttpClient";

class BusinessEmployeeService {
  // =====================
  // INVITATION HANDLING
  // =====================

  /**
   * Validate an invitation token (public - no auth required)
   */
  static async validateInvite(inviteToken) {
    const result = await HttpClient.get(`/business-employee/invite/${inviteToken}`, { skipAuth: true });

    if (result.status === 404) {
      return { valid: false, error: "Invalid invitation link" };
    }
    if (result.status === 410) {
      return {
        valid: false,
        error: result.error,
        isExpired: result.isExpired || false,
        isTerminated: result.isTerminated || false,
      };
    }
    if (result.status === 409) {
      return { valid: false, error: result.error, isAlreadyAccepted: true, email: result.email };
    }

    if (result.success === false) {
      return { valid: false, error: result.error || "Network error. Please try again." };
    }

    return { valid: true, invitation: result.invitation };
  }

  /**
   * Accept an invitation (requires authenticated user)
   */
  static async acceptInvite(authToken, inviteToken) {
    const result = await HttpClient.post(`/business-employee/invite/${inviteToken}/accept`, {}, { token: authToken });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to accept invitation" };
    }

    return { success: true, employee: result.employee, message: result.message };
  }

  /**
   * Accept an invitation and create account in one step (for new employees)
   */
  static async acceptInviteWithSignup(inviteToken, userData) {
    const result = await HttpClient.post(`/business-employee/invite/${inviteToken}/accept-with-signup`, userData, { skipAuth: true });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to accept invitation" };
    }

    return { success: true, token: result.token, employee: result.employee };
  }

  /**
   * Decline an invitation
   */
  static async declineInvite(inviteToken) {
    const result = await HttpClient.post(`/business-employee/invite/${inviteToken}/decline`, {}, { skipAuth: true });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to decline invitation" };
    }

    return { success: true };
  }

  // =====================
  // JOB MANAGEMENT
  // =====================

  /**
   * Get assigned jobs for the authenticated employee
   */
  static async getMyJobs(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.upcoming) params.append("upcoming", "true");

    const url = `/business-employee/my-jobs${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessEmployee] getMyJobs failed:", result.error);
      return { jobs: [] };
    }

    return result;
  }

  /**
   * Get details for a specific job assignment
   */
  static async getJobDetails(token, assignmentId) {
    const result = await HttpClient.get(`/business-employee/my-jobs/${assignmentId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessEmployee] getJobDetails failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get job flow settings for an assignment
   */
  static async getJobFlow(token, assignmentId) {
    const result = await HttpClient.get(`/business-employee/my-jobs/${assignmentId}/flow`, { token });

    if (result.success === false) {
      return null;
    }

    return result;
  }

  /**
   * Get checklist for a job assignment
   */
  static async getChecklist(token, assignmentId) {
    const result = await HttpClient.get(`/business-employee/my-jobs/${assignmentId}/checklist`, { token });

    if (result.success === false) {
      return null;
    }

    return result;
  }

  /**
   * Update checklist item progress
   */
  static async updateChecklistItem(token, assignmentId, sectionId, itemId, status) {
    const result = await HttpClient.put(
      `/business-employee/my-jobs/${assignmentId}/checklist`,
      { sectionId, itemId, status },
      { token }
    );

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update checklist" };
    }

    return { success: true, ...result };
  }

  /**
   * Bulk update checklist progress (for offline sync)
   */
  static async bulkUpdateChecklist(token, assignmentId, updates) {
    const result = await HttpClient.put(
      `/business-employee/my-jobs/${assignmentId}/checklist/bulk`,
      { updates },
      { token }
    );

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update checklist" };
    }

    return { success: true, ...result };
  }

  /**
   * Start a job
   */
  static async startJob(token, assignmentId) {
    const result = await HttpClient.post(`/business-employee/my-jobs/${assignmentId}/start`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to start job" };
    }

    return { success: true, assignment: result.assignment, message: result.message };
  }

  /**
   * Complete a job
   */
  static async completeJob(token, assignmentId, hoursWorked = null) {
    const body = hoursWorked ? { hoursWorked } : {};
    const result = await HttpClient.post(`/business-employee/my-jobs/${assignmentId}/complete`, body, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to complete job" };
    }

    return { success: true, assignment: result.assignment, message: result.message };
  }

  // =====================
  // EARNINGS
  // =====================

  /**
   * Get earnings summary for the authenticated employee
   */
  static async getEarnings(token, startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const url = `/business-employee/my-earnings${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessEmployee] getEarnings failed:", result.error);
      return {
        period: {},
        summary: { totalEarnings: 0, jobCount: 0, paidCount: 0, pendingCount: 0, pendingAmount: 0 },
        formatted: { totalEarnings: "$0.00", pendingAmount: "$0.00" },
      };
    }

    return result;
  }

  /**
   * Get pending bi-weekly payout earnings for the authenticated employee
   */
  static async getPendingEarnings(token) {
    const result = await HttpClient.get("/business-employee/pending-earnings", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessEmployee] getPendingEarnings failed:", result.error);
      return {
        pendingAmount: 0,
        nextPayoutDate: null,
        payouts: [],
        formatted: { pendingAmount: "$0.00" },
      };
    }

    return result;
  }

  // =====================
  // PROFILE
  // =====================

  /**
   * Get the authenticated employee's profile
   */
  static async getProfile(token) {
    const result = await HttpClient.get("/business-employee/my-profile", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessEmployee] getProfile failed:", result.error);
      return null;
    }

    return result;
  }

  // =====================
  // STRIPE CONNECT
  // =====================

  /**
   * Get Stripe Connect status for the authenticated employee
   */
  static async getStripeStatus(token) {
    const result = await HttpClient.get("/business-employee/stripe-connect/status", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessEmployee] getStripeStatus failed:", result.error);
      return { paymentMethod: null, stripeConnectOnboarded: false, stripeAccountId: null };
    }

    return result;
  }

  /**
   * Start Stripe Connect onboarding
   */
  static async startStripeOnboarding(token) {
    const result = await HttpClient.post("/business-employee/stripe-connect/onboard", {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to start onboarding" };
    }

    return { success: true, onboardingUrl: result.onboardingUrl };
  }
}

export default BusinessEmployeeService;
