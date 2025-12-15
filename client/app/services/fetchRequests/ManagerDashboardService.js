const baseURL = "http://localhost:3000";

class ManagerDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[ManagerDashboard] ${url} returned ${response.status}`);
        return fallback;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[ManagerDashboard] ${url} failed:`, error.message);
      return fallback;
    }
  }

  static async getFinancialSummary(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/financial-summary`,
      token,
      {
        current: {
          todayCents: 0,
          weekCents: 0,
          monthCents: 0,
          yearCents: 0,
          yearNetCents: 0,
          pendingCents: 0,
          transactionCount: 0,
        },
        monthly: [],
      }
    );
  }

  static async getUserAnalytics(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/user-analytics`,
      token,
      {
        totals: { cleaners: 0, homeowners: 0, managers: 0, total: 0 },
        active: {
          cleaners: { day: 0, week: 0, month: 0, year: 0, allTime: 0 },
          homeowners: { day: 0, week: 0, month: 0, year: 0, allTime: 0 },
          combined: { day: 0, week: 0, month: 0, year: 0, allTime: 0 },
        },
        growth: [],
      }
    );
  }

  static async getAppointmentsAnalytics(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/appointments-analytics`,
      token,
      {
        totals: { total: 0, completed: 0, upcoming: 0 },
        monthly: [],
      }
    );
  }

  static async getMessagesSummary(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/messages-summary`,
      token,
      {
        unreadCount: 0,
        totalMessages: 0,
        messagesThisWeek: 0,
        recentConversations: [],
      }
    );
  }

  static async getQuickStats(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/quick-stats`,
      token,
      {
        todaysAppointments: 0,
        pendingPayments: 0,
        newUsersThisWeek: 0,
        completedThisWeek: 0,
      }
    );
  }
}

export default ManagerDashboardService;
