/**
 * Manager Dashboard Router
 * Provides analytics and financial data for the manager dashboard
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const {
  User,
  Payment,
  PlatformEarnings,
  UserAppointments,
  UserHomes,
  Message,
  Conversation,
  sequelize,
} = require("../../../models");
const {
  businessConfig,
  updateAllHomesServiceAreaStatus,
} = require("../../../config/businessConfig");
const EmailClass = require("../../../services/sendNotifications/EmailClass");

const managerDashboardRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify manager access
const verifyManager = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.type !== "manager1") {
      return res.status(403).json({ error: "Manager access required" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * GET /financial-summary
 * Get platform financial summary
 */
managerDashboardRouter.get("/financial-summary", verifyManager, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let yearlyEarnings = null;
    let monthlyEarnings = [];
    let todayEarnings = null;
    let weekEarnings = null;
    let monthEarnings = null;
    let pendingEarnings = null;

    try {
      // Get yearly earnings
      yearlyEarnings = await PlatformEarnings.findOne({
        where: {
          taxYear: currentYear,
          status: "collected",
        },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "totalEarnings"],
          [sequelize.fn("SUM", sequelize.col("netPlatformEarnings")), "netEarnings"],
          [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
        ],
        raw: true,
      });

      // Get monthly earnings for the chart (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);

      monthlyEarnings = await PlatformEarnings.findAll({
        where: {
          earnedAt: { [Op.gte]: twelveMonthsAgo },
          status: "collected",
        },
        attributes: [
          [sequelize.fn("DATE_TRUNC", "month", sequelize.col("earnedAt")), "month"],
          [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "earnings"],
          [sequelize.fn("COUNT", sequelize.col("id")), "transactions"],
        ],
        group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("earnedAt"))],
        order: [[sequelize.fn("DATE_TRUNC", "month", sequelize.col("earnedAt")), "ASC"]],
        raw: true,
      });

      // Get today's earnings
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      todayEarnings = await PlatformEarnings.findOne({
        where: {
          earnedAt: { [Op.gte]: todayStart },
          status: "collected",
        },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "earnings"],
        ],
        raw: true,
      });

      // Get this week's earnings
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      weekEarnings = await PlatformEarnings.findOne({
        where: {
          earnedAt: { [Op.gte]: weekStart },
          status: "collected",
        },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "earnings"],
        ],
        raw: true,
      });

      // Get this month's earnings
      const monthStart = new Date(currentYear, currentMonth - 1, 1);

      monthEarnings = await PlatformEarnings.findOne({
        where: {
          earnedAt: { [Op.gte]: monthStart },
          status: "collected",
        },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "earnings"],
        ],
        raw: true,
      });

      // Get pending payouts (not yet collected)
      pendingEarnings = await PlatformEarnings.findOne({
        where: { status: "pending" },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "pending"],
        ],
        raw: true,
      });
    } catch (earningsError) {
      console.error("[Manager Dashboard] Earnings query error:", earningsError.message);
      // Continue with defaults if PlatformEarnings table has issues
    }

    res.json({
      current: {
        todayCents: parseInt(todayEarnings?.earnings) || 0,
        weekCents: parseInt(weekEarnings?.earnings) || 0,
        monthCents: parseInt(monthEarnings?.earnings) || 0,
        yearCents: parseInt(yearlyEarnings?.totalEarnings) || 0,
        yearNetCents: parseInt(yearlyEarnings?.netEarnings) || 0,
        pendingCents: parseInt(pendingEarnings?.pending) || 0,
        transactionCount: parseInt(yearlyEarnings?.transactionCount) || 0,
      },
      monthly: (monthlyEarnings || []).map((m) => ({
        month: m.month,
        earningsCents: parseInt(m.earnings) || 0,
        transactions: parseInt(m.transactions) || 0,
      })),
    });
  } catch (error) {
    console.error("[Manager Dashboard] Financial summary error:", error);
    res.status(500).json({ error: "Failed to fetch financial summary" });
  }
});

/**
 * GET /user-analytics
 * Get user analytics (cleaners, homeowners, activity)
 */
managerDashboardRouter.get("/user-analytics", verifyManager, async (req, res) => {
  try {
    const now = new Date();

    // Time periods
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);

    // Total counts
    const totalCleaners = await User.count({ where: { type: "cleaner" } }).catch(() => 0);
    const totalHomeowners = await User.count({
      where: {
        [Op.or]: [{ type: null }, { type: "" }, { type: "homeowner" }],
      },
    }).catch(() => 0);
    const totalManagers = await User.count({ where: { type: "manager1" } }).catch(() => 0);
    const totalHomes = await UserHomes.count().catch(() => 0);

    // Active users (logged in within time period)
    const getActiveUsers = async (since, userType) => {
      try {
        if (userType === "homeowner") {
          return await User.count({
            where: {
              lastLogin: { [Op.gte]: since },
              [Op.or]: [{ type: null }, { type: "" }, { type: "homeowner" }],
            },
          });
        }
        return await User.count({
          where: {
            lastLogin: { [Op.gte]: since },
            type: userType,
          },
        });
      } catch {
        return 0;
      }
    };

    // Get active counts for each period
    const [
      cleanersDay, cleanersWeek, cleanersMonth, cleanersYear,
      homeownersDay, homeownersWeek, homeownersMonth, homeownersYear,
    ] = await Promise.all([
      getActiveUsers(oneDayAgo, "cleaner"),
      getActiveUsers(oneWeekAgo, "cleaner"),
      getActiveUsers(oneMonthAgo, "cleaner"),
      getActiveUsers(oneYearAgo, "cleaner"),
      getActiveUsers(oneDayAgo, "homeowner"),
      getActiveUsers(oneWeekAgo, "homeowner"),
      getActiveUsers(oneMonthAgo, "homeowner"),
      getActiveUsers(oneYearAgo, "homeowner"),
    ]);

    // New user signups over time (for chart)
    let userGrowth = [];
    try {
      userGrowth = await User.findAll({
        attributes: [
          [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")), "month"],
          "type",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: {
          createdAt: { [Op.gte]: oneYearAgo },
        },
        group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")), "type"],
        order: [[sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")), "ASC"]],
        raw: true,
      });
    } catch (growthError) {
      console.error("[Manager Dashboard] User growth query error:", growthError.message);
    }

    // Process growth data by month
    const growthByMonth = {};
    (userGrowth || []).forEach((row) => {
      const monthKey = row.month;
      if (!growthByMonth[monthKey]) {
        growthByMonth[monthKey] = { month: monthKey, cleaners: 0, homeowners: 0 };
      }
      if (row.type === "cleaner") {
        growthByMonth[monthKey].cleaners = parseInt(row.count) || 0;
      } else {
        growthByMonth[monthKey].homeowners = parseInt(row.count) || 0;
      }
    });

    res.json({
      totals: {
        cleaners: totalCleaners,
        homeowners: totalHomeowners,
        managers: totalManagers,
        homes: totalHomes,
        total: totalCleaners + totalHomeowners + totalManagers,
      },
      active: {
        cleaners: {
          day: cleanersDay,
          week: cleanersWeek,
          month: cleanersMonth,
          year: cleanersYear,
          allTime: totalCleaners,
        },
        homeowners: {
          day: homeownersDay,
          week: homeownersWeek,
          month: homeownersMonth,
          year: homeownersYear,
          allTime: totalHomeowners,
        },
        combined: {
          day: cleanersDay + homeownersDay,
          week: cleanersWeek + homeownersWeek,
          month: cleanersMonth + homeownersMonth,
          year: cleanersYear + homeownersYear,
          allTime: totalCleaners + totalHomeowners,
        },
      },
      growth: Object.values(growthByMonth),
    });
  } catch (error) {
    console.error("[Manager Dashboard] User analytics error:", error);
    res.status(500).json({ error: "Failed to fetch user analytics" });
  }
});

/**
 * GET /appointments-analytics
 * Get appointment/booking analytics
 */
managerDashboardRouter.get("/appointments-analytics", verifyManager, async (req, res) => {
  try {
    const now = new Date();
    const oneYearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);

    // Total appointments
    const totalAppointments = await UserAppointments.count().catch(() => 0);
    const completedAppointments = await UserAppointments.count({
      where: { completed: true },
    }).catch(() => 0);
    const upcomingAppointments = await UserAppointments.count({
      where: {
        completed: false,
        date: { [Op.gte]: now },
      },
    }).catch(() => 0);

    // Appointments by month (for chart)
    let appointmentsByMonth = [];
    try {
      appointmentsByMonth = await UserAppointments.findAll({
        attributes: [
          [sequelize.fn("DATE_TRUNC", "month", sequelize.col("date")), "month"],
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("price")), "revenue"],
        ],
        where: {
          date: { [Op.gte]: oneYearAgo },
        },
        group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("date"))],
        order: [[sequelize.fn("DATE_TRUNC", "month", sequelize.col("date")), "ASC"]],
        raw: true,
      });
    } catch (monthlyError) {
      console.error("[Manager Dashboard] Appointments monthly query error:", monthlyError.message);
    }

    res.json({
      totals: {
        total: totalAppointments,
        completed: completedAppointments,
        upcoming: upcomingAppointments,
      },
      monthly: (appointmentsByMonth || []).map((m) => ({
        month: m.month,
        count: parseInt(m.count) || 0,
        revenueCents: parseInt(m.revenue) * 100 || 0,
      })),
    });
  } catch (error) {
    console.error("[Manager Dashboard] Appointments analytics error:", error);
    res.status(500).json({ error: "Failed to fetch appointment analytics" });
  }
});

/**
 * GET /messages-summary
 * Get messages summary for manager
 */
managerDashboardRouter.get("/messages-summary", verifyManager, async (req, res) => {
  try {
    // Get recent conversations
    let conversations = [];
    let totalMessages = 0;
    let messagesThisWeek = 0;

    try {
      conversations = await Conversation.findAll({
        include: [
          {
            model: Message,
            as: "messages",
            limit: 1,
            order: [["createdAt", "DESC"]],
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 10,
      });

      // Get total message count
      totalMessages = await Message.count();

      // Get messages this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      messagesThisWeek = await Message.count({
        where: {
          createdAt: { [Op.gte]: weekStart },
        },
      });
    } catch (msgError) {
      console.error("[Manager Dashboard] Messages query error:", msgError.message);
      // Continue with defaults if messages table has issues
    }

    // Count support conversations as "unread" proxy
    const supportConversations = await Conversation.count({
      where: { conversationType: "support" },
    }).catch(() => 0);

    res.json({
      unreadCount: supportConversations,
      totalMessages,
      messagesThisWeek,
      recentConversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.conversationType,
        updatedAt: c.updatedAt,
        lastMessage: c.messages?.[0]?.content?.substring(0, 100),
      })),
    });
  } catch (error) {
    console.error("[Manager Dashboard] Messages summary error:", error);
    res.status(500).json({ error: "Failed to fetch messages summary" });
  }
});

/**
 * GET /quick-stats
 * Get quick overview stats
 */
managerDashboardRouter.get("/quick-stats", verifyManager, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Today's appointments
    const todaysAppointments = await UserAppointments.count({
      where: {
        date: {
          [Op.gte]: todayStart,
          [Op.lt]: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    }).catch(() => 0);

    // Pending payments
    const pendingPayments = await Payment.count({
      where: { status: "pending" },
    }).catch(() => 0);

    // New users this week
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.count({
      where: {
        createdAt: { [Op.gte]: weekAgo },
      },
    }).catch(() => 0);

    // Completed cleanings this week
    const completedThisWeek = await UserAppointments.count({
      where: {
        completed: true,
        date: { [Op.gte]: weekAgo },
      },
    }).catch(() => 0);

    res.json({
      todaysAppointments,
      pendingPayments,
      newUsersThisWeek,
      completedThisWeek,
    });
  } catch (error) {
    console.error("[Manager Dashboard] Quick stats error:", error);
    res.status(500).json({ error: "Failed to fetch quick stats" });
  }
});

/**
 * GET /service-areas
 * Get current service area configuration
 */
managerDashboardRouter.get("/service-areas", verifyManager, async (req, res) => {
  try {
    // Get count of homes outside service area
    const homesOutsideArea = await UserHomes.count({
      where: { outsideServiceArea: true },
    }).catch(() => 0);

    const totalHomes = await UserHomes.count().catch(() => 0);

    res.json({
      config: businessConfig.serviceAreas,
      stats: {
        totalHomes,
        homesOutsideArea,
        homesInArea: totalHomes - homesOutsideArea,
      },
    });
  } catch (error) {
    console.error("[Manager Dashboard] Service areas error:", error);
    res.status(500).json({ error: "Failed to fetch service areas" });
  }
});

/**
 * POST /recheck-service-areas
 * Re-check all homes against current service area configuration
 * Call this after modifying the service area settings
 * Sends email and in-app notifications to homeowners when status changes
 */
managerDashboardRouter.post("/recheck-service-areas", verifyManager, async (req, res) => {
  try {
    const result = await updateAllHomesServiceAreaStatus(UserHomes, User, EmailClass);

    res.json({
      success: true,
      message: `Service area check complete. ${result.updated} home(s) updated. Notifications sent to affected homeowners.`,
      ...result,
    });
  } catch (error) {
    console.error("[Manager Dashboard] Recheck service areas error:", error);
    res.status(500).json({ error: "Failed to recheck service areas" });
  }
});

/**
 * GET /homes-outside-service-area
 * Get list of homes currently outside the service area
 */
managerDashboardRouter.get("/homes-outside-service-area", verifyManager, async (req, res) => {
  try {
    const homes = await UserHomes.findAll({
      where: { outsideServiceArea: true },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email"],
        },
      ],
      attributes: ["id", "nickName", "address", "city", "state", "zipcode"],
    });

    res.json({
      count: homes.length,
      homes: homes.map((h) => ({
        id: h.id,
        nickName: h.nickName,
        address: h.address,
        city: h.city,
        state: h.state,
        zipcode: h.zipcode,
        owner: h.user ? {
          id: h.user.id,
          username: h.user.username,
          email: h.user.email,
        } : null,
      })),
    });
  } catch (error) {
    console.error("[Manager Dashboard] Homes outside area error:", error);
    res.status(500).json({ error: "Failed to fetch homes outside service area" });
  }
});

module.exports = managerDashboardRouter;
