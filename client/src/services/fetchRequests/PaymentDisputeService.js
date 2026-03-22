import HttpClient from "../HttpClient";

class PaymentDisputeService {
  /**
   * Submit a new payment dispute
   */
  static async submitDispute(token, data) {
    const result = await HttpClient.post("/payment-disputes", data, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[PaymentDisputeService] submitDispute failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to submit dispute",
      };
    }

    return result;
  }

  /**
   * Get cleaner's own payment disputes
   */
  static async getMyDisputes(token) {
    const result = await HttpClient.get("/payment-disputes/my-disputes", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[PaymentDisputeService] getMyDisputes failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to fetch disputes",
      };
    }

    return result;
  }

  /**
   * Get a specific payment dispute
   */
  static async getDispute(token, disputeId) {
    const result = await HttpClient.get(`/payment-disputes/${disputeId}`, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[PaymentDisputeService] getDispute failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to fetch dispute",
      };
    }

    return result;
  }
}

export default PaymentDisputeService;
