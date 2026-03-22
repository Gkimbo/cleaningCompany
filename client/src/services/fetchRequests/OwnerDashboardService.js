import HttpClient from "../HttpClient";

class OwnerDashboardService {
  static async fetchWithFallback(url, token, fallback = {}) {
    const result = await HttpClient.get(url, { token, useBaseUrl: true });

    if (result.success === false) {
      __DEV__ && console.warn(`[OwnerDashboard] ${url} failed:`, result.error);
      return fallback;
    }

    return result;
  }

  static async getFinancialSummary(token) {
    return this.fetchWithFallback(
      "/api/v1/owner-dashboard/financial-summary",
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
      "/api/v1/owner-dashboard/user-analytics",
      token,
      {
        totals: { cleaners: 0, homeowners: 0, owners: 0, homes: 0, total: 0 },
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
      "/api/v1/owner-dashboard/appointments-analytics",
      token,
      {
        totals: { total: 0, completed: 0, upcoming: 0 },
        monthly: [],
      }
    );
  }

  static async getMessagesSummary(token) {
    return this.fetchWithFallback(
      "/api/v1/owner-dashboard/messages-summary",
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
      "/api/v1/owner-dashboard/quick-stats",
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
      "/api/v1/owner-dashboard/service-areas",
      token,
      {
        config: { enabled: false, cities: [], states: [], zipcodes: [] },
        stats: { totalHomes: 0, homesOutsideArea: 0, homesInArea: 0 },
      }
    );
  }

  static async getAppUsageAnalytics(token) {
    return this.fetchWithFallback(
      "/api/v1/owner-dashboard/app-usage-analytics",
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
      "/api/v1/owner-dashboard/business-metrics",
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
    const result = await HttpClient.post(
      "/api/v1/owner-dashboard/recheck-service-areas",
      {},
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[OwnerDashboard] recheckServiceAreas failed:", result.error);
      return { success: false, error: result.error || "Failed to recheck service areas" };
    }

    return result;
  }

  static async getSettings(token) {
    return this.fetchWithFallback(
      "/api/v1/owner-dashboard/settings",
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
    const result = await HttpClient.put(
      "/api/v1/owner-dashboard/settings/notification-email",
      { notificationEmail },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[OwnerDashboard] updateNotificationEmail failed:", result.error);
      return { success: false, error: result.error || "Failed to update notification email" };
    }

    return result;
  }

  // ============ Withdrawal Methods ============

  static async getStripeBalance(token) {
    return this.fetchWithFallback(
      "/api/v1/owner-dashboard/stripe-balance",
      token,
      {
        available: { cents: 0, dollars: "0.00" },
        pending: { cents: 0, dollars: "0.00" },
        pendingWithdrawals: { cents: 0, dollars: "0.00", count: 0 },
        withdrawableBalance: { cents: 0, dollars: "0.00" },
        withdrawnThisYear: {
          totalWithdrawnCents: 0,
          totalWithdrawnDollars: "0.00",
          withdrawalCount: 0,
        },
        currency: "usd",
      }
    );
  }

  static async getWithdrawals(token, options = {}) {
    const { limit = 20, offset = 0, status } = options;
    const params = new URLSearchParams({ limit, offset });
    if (status) params.append("status", status);

    return this.fetchWithFallback(
      `/api/v1/owner-dashboard/withdrawals?${params}`,
      token,
      {
        withdrawals: [],
        total: 0,
        limit: 20,
        offset: 0,
      }
    );
  }

  static async createWithdrawal(token, amountCents, description = "") {
    const result = await HttpClient.post(
      "/api/v1/owner-dashboard/withdraw",
      { amount: amountCents, description },
      { token, useBaseUrl: true }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[OwnerDashboard] createWithdrawal failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to create withdrawal",
        details: result.details,
        available: result.available,
        requested: result.requested,
      };
    }

    return {
      success: true,
      ...result,
    };
  }
}

export default OwnerDashboardService;
