import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

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
        totals: { cleaners: 0, homeowners: 0, managers: 0, homes: 0, total: 0 },
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

  static async getServiceAreas(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/service-areas`,
      token,
      {
        config: { enabled: false, cities: [], states: [], zipcodes: [] },
        stats: { totalHomes: 0, homesOutsideArea: 0, homesInArea: 0 },
      }
    );
  }

  static async getAppUsageAnalytics(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/app-usage-analytics`,
      token,
      {
        signups: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          thisYear: 0,
          allTime: 0,
        },
        sessions: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          allTime: 0,
          uniqueVisitorsToday: 0,
          uniqueVisitorsWeek: 0,
          uniqueVisitorsMonth: 0,
        },
        engagement: {
          averageSessionDuration: 0, // in seconds
          averagePagesPerSession: 0,
          bounceRate: 0, // percentage
          returningUserRate: 0, // percentage
        },
        pageViews: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          allTime: 0,
          topPages: [],
        },
        deviceBreakdown: {
          mobile: 0,
          desktop: 0,
          tablet: 0,
        },
        retention: {
          day1: 0,
          day7: 0,
          day30: 0,
        },
      }
    );
  }

  static async getBusinessMetrics(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/business-metrics`,
      token,
      {
        costPerBooking: {
          avgFeeCents: 0,
          totalFeeCents: 0,
          bookingCount: 0,
        },
        repeatBookingRate: {
          rate: 0,
          repeatBookers: 0,
          singleBookers: 0,
          totalHomeowners: 0,
        },
        subscriptionRate: {
          rate: 0,
          frequentBookers: 0,
          regularBookers: 0,
          occasionalBookers: 0,
          totalHomeowners: 0,
        },
        churn: {
          homeownerCancellations: {
            usersWithCancellations: 0,
            totalFeeCents: 0,
          },
          cleanerCancellations: {
            total: 0,
            last30Days: 0,
            last90Days: 0,
          },
        },
        cleanerReliability: {
          overallCompletionRate: 0,
          avgRating: 0,
          totalCompleted: 0,
          totalAssigned: 0,
          cleanerStats: [],
        },
      }
    );
  }

  static async recheckServiceAreas(token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/manager-dashboard/recheck-service-areas`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to recheck service areas" };
      }
      return await response.json();
    } catch (error) {
      console.error("[ManagerDashboard] recheckServiceAreas failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async getSettings(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/manager-dashboard/settings`,
      token,
      {
        email: "",
        notificationEmail: null,
        effectiveNotificationEmail: "",
        notifications: [],
      }
    );
  }

  static async updateNotificationEmail(token, notificationEmail) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/manager-dashboard/settings/notification-email`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notificationEmail }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to update notification email" };
      }
      return await response.json();
    } catch (error) {
      console.error("[ManagerDashboard] updateNotificationEmail failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }
}

export default ManagerDashboardService;
