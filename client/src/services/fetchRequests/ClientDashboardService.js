import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class ClientDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[ClientDashboard] ${url} returned ${response.status}`);
        return fallback;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[ClientDashboard] ${url} failed:`, error.message);
      return fallback;
    }
  }

  static async getDashboardSummary(token) {
    // First sync the bill to ensure accuracy
    await this.syncBill(token);

    return this.fetchWithFallback(
      `${baseURL}/api/v1/user-info`,
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
    try {
      await fetch(`${baseURL}/api/v1/user-info/sync-bill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.warn("[ClientDashboard] Bill sync failed:", error.message);
    }
  }

  static async getMyRequests(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/appointments/my-requests`,
      token,
      {
        pendingRequestsEmployee: [],
      }
    );
  }

  static async getPendingRequestsForClient(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/appointments/client-pending-requests`,
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
      `${baseURL}/api/v1/cleaner-clients/my-cleaner`,
      token,
      { cleaner: null }
    );
  }

  /**
   * Get client's recurring schedules
   */
  static async getMyRecurringSchedules(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/recurring-schedules/my-schedules`,
      token,
      { schedules: [] }
    );
  }
}

export default ClientDashboardService;
