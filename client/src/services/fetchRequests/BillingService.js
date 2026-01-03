/**
 * BillingService - Client-side service for billing API calls
 */

import { API_BASE } from "../config";

class BillingService {
  /**
   * Get billing history for the current user
   * @param {string} token - Auth token
   * @param {Object} options - { limit, offset }
   * @returns {Object} { transactions, total, hasMore }
   */
  static async getBillingHistory(token, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append("limit", options.limit);
      if (options.offset) params.append("offset", options.offset);

      const queryStr = params.toString();
      const url = queryStr ? API_BASE + "/billing/history?" + queryStr : API_BASE + "/billing/history";
      const response = await fetch(url, {
        headers: {
          Authorization: "Bearer " + token,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching billing history:", error);
      return { transactions: [], total: 0, error: "Failed to fetch billing history" };
    }
  }

  /**
   * Get billing summary for the current user
   * @param {string} token - Auth token
   * @returns {Object} { summary }
   */
  static async getBillingSummary(token) {
    try {
      const response = await fetch(API_BASE + "/billing/summary", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching billing summary:", error);
      return { summary: null, error: "Failed to fetch billing summary" };
    }
  }

  /**
   * Complete a cleaner-booked appointment with auto-payment
   * @param {string} token - Auth token (cleaner)
   * @param {number} appointmentId - Appointment ID
   * @returns {Object} { success, payment, payouts, error }
   */
  static async completeWithAutoPay(token, appointmentId) {
    try {
      const response = await fetch(API_BASE + "/billing/complete-with-autopay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ appointmentId }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error completing with autopay:", error);
      return { success: false, error: "Failed to complete appointment" };
    }
  }
}

export default BillingService;
