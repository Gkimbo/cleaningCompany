import { API_BASE } from "../config";

class PaymentDisputeService {
  /**
   * Submit a new payment dispute
   */
  static async submitDispute(token, data) {
    const response = await fetch(`${API_BASE}/payment-disputes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to submit dispute");
    }

    return result;
  }

  /**
   * Get cleaner's own payment disputes
   */
  static async getMyDisputes(token) {
    const response = await fetch(`${API_BASE}/payment-disputes/my-disputes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch disputes");
    }

    return result;
  }

  /**
   * Get a specific payment dispute
   */
  static async getDispute(token, disputeId) {
    const response = await fetch(`${API_BASE}/payment-disputes/${disputeId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch dispute");
    }

    return result;
  }
}

export default PaymentDisputeService;
