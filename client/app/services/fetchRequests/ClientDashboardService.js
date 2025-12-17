const baseURL = "http://localhost:3000";

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

  static async getMyRequests(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/appointments/my-requests`,
      token,
      {
        pendingRequestsEmployee: [],
      }
    );
  }
}

export default ClientDashboardService;
