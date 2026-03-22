import HttpClient from "../HttpClient";

class ClientDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    const result = await HttpClient.get(url, { token, useBaseUrl: true });

    if (result.success === false) {
      __DEV__ && console.warn(`[ClientDashboard] ${url} failed:`, result.error);
      return fallback;
    }

    return result;
  }

  static async getDashboardSummary(token) {
    // First sync the bill to ensure accuracy
    await this.syncBill(token);

    return this.fetchWithFallback(
      "/api/v1/user-info",
      token,
      {
        user: {
          homes: [],
          appointments: [],
          bill: {
            cancellationFee: 0,
            appointmentDue: 0,
            totalDue: 0,
            totalPaid: 0,
          },
        },
      }
    );
  }

  static async syncBill(token) {
    const result = await HttpClient.post(
      "/api/v1/user-info/sync-bill",
      {},
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ClientDashboard] Bill sync failed:", result.error);
    }
  }

  static async getMyRequests(token) {
    return this.fetchWithFallback(
      "/api/v1/appointments/my-requests",
      token,
      {
        pendingRequestsEmployee: [],
      }
    );
  }

  static async getPendingRequestsForClient(token) {
    return this.fetchWithFallback(
      "/api/v1/appointments/client-pending-requests",
      token,
      {
        totalCount: 0,
        requestsByHome: [],
      }
    );
  }

  /**
   * Get client's preferred cleaner (if they were invited by a cleaner)
   */
  static async getMyCleanerRelationship(token) {
    return this.fetchWithFallback(
      "/api/v1/cleaner-clients/my-cleaner",
      token,
      { cleaner: null }
    );
  }

  /**
   * Get client's recurring schedules
   */
  static async getMyRecurringSchedules(token) {
    return this.fetchWithFallback(
      "/api/v1/recurring-schedules/my-schedules",
      token,
      { schedules: [] }
    );
  }
}

export default ClientDashboardService;
