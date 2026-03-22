/**
 * BillingService - Client-side service for billing API calls
 */

import HttpClient from "../HttpClient";

class BillingService {
  /**
   * Get billing history for the current user
   * @param {string} token - Auth token
   * @param {Object} options - { limit, offset }
   * @returns {Object} { transactions, total, hasMore }
   */
  static async getBillingHistory(token, options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit);
    if (options.offset) params.append("offset", options.offset);

    const queryStr = params.toString();
    const url = queryStr ? `/billing/history?${queryStr}` : "/billing/history";

    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BillingService] getBillingHistory failed:", result.error);
      return { transactions: [], total: 0, error: result.error || "Failed to fetch billing history" };
    }

    return result;
  }

  /**
   * Get billing summary for the current user
   * @param {string} token - Auth token
   * @returns {Object} { summary }
   */
  static async getBillingSummary(token) {
    const result = await HttpClient.get("/billing/summary", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BillingService] getBillingSummary failed:", result.error);
      return { summary: null, error: result.error || "Failed to fetch billing summary" };
    }

    return result;
  }

  /**
   * Complete a cleaner-booked appointment with auto-payment
   * @param {string} token - Auth token (cleaner)
   * @param {number} appointmentId - Appointment ID
   * @returns {Object} { success, payment, payouts, error }
   */
  static async completeWithAutoPay(token, appointmentId) {
    const result = await HttpClient.post("/billing/complete-with-autopay", { appointmentId }, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BillingService] completeWithAutoPay failed:", result.error);
      return { success: false, error: result.error || "Failed to complete appointment" };
    }

    return result;
  }
}

export default BillingService;
