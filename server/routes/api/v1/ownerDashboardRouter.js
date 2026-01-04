/**
 * Owner Dashboard Router
 * Provides analytics and financial data for the owner dashboard
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const {
  User,
  Payment,
  PlatformEarnings,
  OwnerWithdrawal,
  UserAppointments,
  UserHomes,
  UserApplications,
  UserBills,
  UserReviews,
  Message,
  Conversation,
  sequelize,
} = require("../../../models");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const EncryptionService = require("../../../services/EncryptionService");
const {
  businessConfig,
  updateAllHomesServiceAreaStatus,
} = require("../../../config/businessConfig");
const EmailClass = require("../../../services/sendNotifications/EmailClass");

const ownerDashboardRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify owner access
const verifyOwner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.type !== "owner") {
      return res.status(403).json({ error: "Owner access required" });
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
ownerDashboardRouter.get(
  "/financial-summary",
  verifyOwner,
  async (req, res) => {
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
            [
              sequelize.fn("SUM", sequelize.col("platformFeeAmount")),
              "totalEarnings",
            ],
            [
              sequelize.fn("SUM", sequelize.col("netPlatformEarnings")),
              "netEarnings",
            ],
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
            [
              sequelize.fn("DATE_TRUNC", "month", sequelize.col("earnedAt")),
              "month",
            ],
            [
              sequelize.fn("SUM", sequelize.col("platformFeeAmount")),
              "earnings",
            ],
            [sequelize.fn("COUNT", sequelize.col("id")), "transactions"],
          ],
          group: [
            sequelize.fn("DATE_TRUNC", "month", sequelize.col("earnedAt")),
          ],
          order: [
            [
              sequelize.fn("DATE_TRUNC", "month", sequelize.col("earnedAt")),
              "ASC",
            ],
          ],
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
            [
              sequelize.fn("SUM", sequelize.col("platformFeeAmount")),
              "earnings",
            ],
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
            [
              sequelize.fn("SUM", sequelize.col("platformFeeAmount")),
              "earnings",
            ],
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
            [
              sequelize.fn("SUM", sequelize.col("platformFeeAmount")),
              "earnings",
            ],
          ],
          raw: true,
        });

        // Get pending payouts (not yet collected)
        pendingEarnings = await PlatformEarnings.findOne({
          where: { status: "pending" },
          attributes: [
            [
              sequelize.fn("SUM", sequelize.col("platformFeeAmount")),
              "pending",
            ],
          ],
          raw: true,
        });
      } catch (earningsError) {
        console.error(
          "[Owner Dashboard] Earnings query error:",
          earningsError.message
        );
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
      console.error("[Owner Dashboard] Financial summary error:", error);
      res.status(500).json({ error: "Failed to fetch financial summary" });
    }
  }
);

/**
 * GET /user-analytics
 * Get user analytics (cleaners, homeowners, activity)
 */
ownerDashboardRouter.get(
  "/user-analytics",
  verifyOwner,
  async (req, res) => {
    try {
      const now = new Date();

      // Time periods
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);

      // Total counts
      // All cleaners: users with type = "cleaner"
      const totalCleaners = await User.count({
        where: { type: "cleaner" },
      }).catch(() => 0);

      // Cleaners with availability set (have daysWorking configured)
      const cleanersWithAvailability = await User.count({
        where: {
          type: "cleaner",
          daysWorking: { [Op.ne]: null },
        },
      }).catch(() => 0);

      // Homeowners: users who have at least one home registered
      const totalHomes = await UserHomes.count().catch(() => 0);

      // Count distinct homeowners (users who own at least one home)
      const homeownerCountResult = await UserHomes.count({
        distinct: true,
        col: 'userId',
      }).catch(() => 0);
      const totalHomeowners = homeownerCountResult;

      // Registered users (non-cleaner, non-owner) - potential homeowners
      const totalRegisteredUsers = await User.count({
        where: {
          [Op.or]: [{ type: null }, { type: "" }, { type: "homeowner" }],
        },
      }).catch(() => 0);

      // Owners
      const totalOwners = await User.count({
        where: { type: "owner" },
      }).catch(() => 0);

      // Applications
      const totalApplications = await UserApplications.count().catch(() => 0);
      const pendingApplications = await UserApplications.count({
        where: { status: "pending" },
      }).catch(() => 0);
      const approvedApplications = await UserApplications.count({
        where: { status: "approved" },
      }).catch(() => 0);
      const rejectedApplications = await UserApplications.count({
        where: { status: "rejected" },
      }).catch(() => 0);

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
        cleanersDay,
        cleanersWeek,
        cleanersMonth,
        cleanersYear,
        homeownersDay,
        homeownersWeek,
        homeownersMonth,
        homeownersYear,
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
            [
              sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
              "month",
            ],
            "type",
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          ],
          where: {
            createdAt: { [Op.gte]: oneYearAgo },
          },
          group: [
            sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
            "type",
          ],
          order: [
            [
              sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
              "ASC",
            ],
          ],
          raw: true,
        });
      } catch (growthError) {
        console.error(
          "[Owner Dashboard] User growth query error:",
          growthError.message
        );
      }

      // Process growth data by month
      const growthByMonth = {};
      (userGrowth || []).forEach((row) => {
        const monthKey = row.month;
        if (!growthByMonth[monthKey]) {
          growthByMonth[monthKey] = {
            month: monthKey,
            cleaners: 0,
            homeowners: 0,
          };
        }
        if (row.type === "cleaner") {
          growthByMonth[monthKey].cleaners = parseInt(row.count) || 0;
        } else {
          growthByMonth[monthKey].homeowners = parseInt(row.count) || 0;
        }
      });

      res.json({
        totals: {
          // All cleaner accounts
          cleaners: totalCleaners,
          // Cleaners with availability/days set
          cleanersWithAvailability: cleanersWithAvailability,
          // Users who have at least one home registered
          homeowners: totalHomeowners,
          // All registered users (potential homeowners - no cleaner/owner type)
          registeredUsers: totalRegisteredUsers,
          owners: totalOwners,
          // Total homes in the system
          homes: totalHomes,
          // Total users (all cleaners + homeowners with homes + owners)
          total: totalCleaners + totalHomeowners + totalOwners,
        },
        applications: {
          total: totalApplications,
          pending: pendingApplications,
          approved: approvedApplications,
          rejected: rejectedApplications,
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
      console.error("[Owner Dashboard] User analytics error:", error);
      res.status(500).json({ error: "Failed to fetch user analytics" });
    }
  }
);

/**
 * GET /appointments-analytics
 * Get appointment/booking analytics
 */
ownerDashboardRouter.get(
  "/appointments-analytics",
  verifyOwner,
  async (req, res) => {
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
            [
              sequelize.fn("DATE_TRUNC", "month", sequelize.col("date")),
              "month",
            ],
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
            [sequelize.fn("SUM", sequelize.col("price")), "revenue"],
          ],
          where: {
            date: { [Op.gte]: oneYearAgo },
          },
          group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("date"))],
          order: [
            [sequelize.fn("DATE_TRUNC", "month", sequelize.col("date")), "ASC"],
          ],
          raw: true,
        });
      } catch (monthlyError) {
        console.error(
          "[Owner Dashboard] Appointments monthly query error:",
          monthlyError.message
        );
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
      console.error("[Owner Dashboard] Appointments analytics error:", error);
      res.status(500).json({ error: "Failed to fetch appointment analytics" });
    }
  }
);

/**
 * GET /messages-summary
 * Get messages summary for owner
 */
ownerDashboardRouter.get(
  "/messages-summary",
  verifyOwner,
  async (req, res) => {
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
        console.error(
          "[Owner Dashboard] Messages query error:",
          msgError.message
        );
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
      console.error("[Owner Dashboard] Messages summary error:", error);
      res.status(500).json({ error: "Failed to fetch messages summary" });
    }
  }
);

/**
 * GET /quick-stats
 * Get quick overview stats
 */
ownerDashboardRouter.get("/quick-stats", verifyOwner, async (req, res) => {
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
    console.error("[Owner Dashboard] Quick stats error:", error);
    res.status(500).json({ error: "Failed to fetch quick stats" });
  }
});

/**
 * GET /service-areas
 * Get current service area configuration
 */
ownerDashboardRouter.get(
  "/service-areas",
  verifyOwner,
  async (req, res) => {
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
      console.error("[Owner Dashboard] Service areas error:", error);
      res.status(500).json({ error: "Failed to fetch service areas" });
    }
  }
);

/**
 * POST /recheck-service-areas
 * Re-check all homes against current service area configuration
 * Call this after modifying the service area settings
 * Sends email and in-app notifications to homeowners when status changes
 */
ownerDashboardRouter.post(
  "/recheck-service-areas",
  verifyOwner,
  async (req, res) => {
    try {
      const result = await updateAllHomesServiceAreaStatus(
        UserHomes,
        User,
        EmailClass
      );

      res.json({
        success: true,
        message: `Service area check complete. ${result.updated} home(s) updated. Notifications sent to affected homeowners.`,
        ...result,
      });
    } catch (error) {
      console.error("[Owner Dashboard] Recheck service areas error:", error);
      res.status(500).json({ error: "Failed to recheck service areas" });
    }
  }
);

/**
 * GET /app-usage-analytics
 * Get app usage analytics (signups, activity metrics)
 */
ownerDashboardRouter.get(
  "/app-usage-analytics",
  verifyOwner,
  async (req, res) => {
    try {
      const now = new Date();

      // Time periods
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);

      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - 1);

      const yearStart = new Date(now);
      yearStart.setFullYear(yearStart.getFullYear() - 1);

      // Signup counts
      const signupsToday = await User.count({
        where: { createdAt: { [Op.gte]: todayStart } },
      }).catch(() => 0);

      const signupsThisWeek = await User.count({
        where: { createdAt: { [Op.gte]: weekStart } },
      }).catch(() => 0);

      const signupsThisMonth = await User.count({
        where: { createdAt: { [Op.gte]: monthStart } },
      }).catch(() => 0);

      const signupsThisYear = await User.count({
        where: { createdAt: { [Op.gte]: yearStart } },
      }).catch(() => 0);

      const signupsAllTime = await User.count().catch(() => 0);

      // Active users (using lastLogin as proxy for sessions)
      const activeToday = await User.count({
        where: { lastLogin: { [Op.gte]: todayStart } },
      }).catch(() => 0);

      const activeThisWeek = await User.count({
        where: { lastLogin: { [Op.gte]: weekStart } },
      }).catch(() => 0);

      const activeThisMonth = await User.count({
        where: { lastLogin: { [Op.gte]: monthStart } },
      }).catch(() => 0);

      const activeAllTime = await User.count({
        where: { lastLogin: { [Op.ne]: null } },
      }).catch(() => 0);

      // Calculate retention rates
      // Day N retention = % of users who signed up at least N days ago and logged in at least N days after signup
      async function calculateRetention(days) {
        try {
          // Find users who signed up at least N days ago
          const cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - days);

          const usersSignedUp = await User.count({
            where: {
              createdAt: { [Op.lte]: cutoffDate },
            },
          });

          if (usersSignedUp === 0) return 0;

          // Find users who came back at least N days after their signup
          // This uses a raw query to compare lastLogin with createdAt + interval
          const usersRetained = await User.count({
            where: {
              createdAt: { [Op.lte]: cutoffDate },
              lastLogin: { [Op.ne]: null },
              [Op.and]: sequelize.literal(`"lastLogin" >= "createdAt" + interval '${days} days'`),
            },
          });

          return Math.round((usersRetained / usersSignedUp) * 100);
        } catch (err) {
          console.error(`[Owner Dashboard] Retention calculation error for day ${days}:`, err.message);
          return 0;
        }
      }

      const day1Retention = await calculateRetention(1);
      const day7Retention = await calculateRetention(7);
      const day30Retention = await calculateRetention(30);

      // Calculate engagement metrics based on loginCount
      const totalUsers = await User.count().catch(() => 0);

      // Users who have logged in at least once
      const usersWhoLoggedIn = await User.count({
        where: { loginCount: { [Op.gte]: 1 } },
      }).catch(() => 0);

      // Users who have logged in more than once (returning users)
      const returningUsers = await User.count({
        where: { loginCount: { [Op.gte]: 2 } },
      }).catch(() => 0);

      // Highly engaged users (logged in 5+ times)
      const highlyEngagedUsers = await User.count({
        where: { loginCount: { [Op.gte]: 5 } },
      }).catch(() => 0);

      // Calculate average logins per user
      const loginStats = await User.findOne({
        attributes: [
          [sequelize.fn("AVG", sequelize.col("loginCount")), "avgLogins"],
          [sequelize.fn("SUM", sequelize.col("loginCount")), "totalLogins"],
        ],
        raw: true,
      }).catch(() => ({ avgLogins: 0, totalLogins: 0 }));

      const avgLoginsPerUser = parseFloat(loginStats?.avgLogins || 0).toFixed(1);
      const totalLogins = parseInt(loginStats?.totalLogins || 0);

      // Returning user rate: % of users who logged in more than once
      const returningUserRate = usersWhoLoggedIn > 0
        ? Math.round((returningUsers / usersWhoLoggedIn) * 100)
        : 0;

      // Engagement rate: % of all users who have logged in at least once
      const engagementRate = totalUsers > 0
        ? Math.round((usersWhoLoggedIn / totalUsers) * 100)
        : 0;

      // Power user rate: % of users who are highly engaged (5+ logins)
      const powerUserRate = usersWhoLoggedIn > 0
        ? Math.round((highlyEngagedUsers / usersWhoLoggedIn) * 100)
        : 0;

      // Calculate device breakdown from lastDeviceType
      const deviceCounts = await User.findAll({
        where: { lastDeviceType: { [Op.ne]: null } },
        attributes: [
          "lastDeviceType",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: ["lastDeviceType"],
        raw: true,
      }).catch(() => []);

      const totalDevices = deviceCounts.reduce((sum, d) => sum + parseInt(d.count || 0), 0);

      const deviceBreakdown = {
        mobile: 0,
        desktop: 0,
        tablet: 0,
      };

      if (totalDevices > 0) {
        deviceCounts.forEach((d) => {
          const type = d.lastDeviceType;
          const percentage = Math.round((parseInt(d.count) / totalDevices) * 100);
          if (type === "mobile") deviceBreakdown.mobile = percentage;
          else if (type === "desktop") deviceBreakdown.desktop = percentage;
          else if (type === "tablet") deviceBreakdown.tablet = percentage;
        });
      }

      res.json({
        signups: {
          today: signupsToday,
          thisWeek: signupsThisWeek,
          thisMonth: signupsThisMonth,
          thisYear: signupsThisYear,
          allTime: signupsAllTime,
        },
        sessions: {
          today: activeToday,
          thisWeek: activeThisWeek,
          thisMonth: activeThisMonth,
          allTime: activeAllTime,
          uniqueVisitorsToday: activeToday,
          uniqueVisitorsWeek: activeThisWeek,
          uniqueVisitorsMonth: activeThisMonth,
        },
        engagement: {
          totalLogins,
          avgLoginsPerUser: parseFloat(avgLoginsPerUser),
          returningUserRate,
          engagementRate,
          powerUserRate,
          usersWhoLoggedIn,
          returningUsers,
          highlyEngagedUsers,
        },
        pageViews: {
          today: 0, // Would need client-side tracking
          thisWeek: 0,
          thisMonth: 0,
          allTime: 0,
          topPages: [],
        },
        deviceBreakdown,
        retention: {
          day1: day1Retention,
          day7: day7Retention,
          day30: day30Retention,
        },
      });
    } catch (error) {
      console.error("[Owner Dashboard] App usage analytics error:", error);
      res.status(500).json({ error: "Failed to fetch app usage analytics" });
    }
  }
);

/**
 * GET /homes-outside-service-area
 * Get list of homes currently outside the service area
 */
ownerDashboardRouter.get(
  "/homes-outside-service-area",
  verifyOwner,
  async (req, res) => {
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
          owner: h.user
            ? {
                id: h.user.id,
                username: h.user.username,
                email: EncryptionService.decrypt(h.user.email),
              }
            : null,
        })),
      });
    } catch (error) {
      console.error("[Owner Dashboard] Homes outside area error:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch homes outside service area" });
    }
  }
);

/**
 * GET /business-metrics
 * Get key business performance metrics
 * - Cost per booking (average platform fee)
 * - Repeat booking rate
 * - Subscription % of users (frequent bookers)
 * - Churn (cancellations)
 * - Cleaner reliability
 */
ownerDashboardRouter.get(
  "/business-metrics",
  verifyOwner,
  async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

      // ==========================================
      // 1. COST PER BOOKING (Platform fee per appointment)
      // ==========================================
      let costPerBooking = { avgFeeCents: 0, totalFeeCents: 0, bookingCount: 0 };
      try {
        const platformEarningsStats = await PlatformEarnings.findOne({
          attributes: [
            [sequelize.fn("AVG", sequelize.col("platformFeeAmount")), "avgFee"],
            [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "totalFee"],
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          ],
          where: { status: "collected" },
          raw: true,
        });

        costPerBooking = {
          avgFeeCents: Math.round(parseFloat(platformEarningsStats?.avgFee || 0)),
          totalFeeCents: parseInt(platformEarningsStats?.totalFee || 0),
          bookingCount: parseInt(platformEarningsStats?.count || 0),
        };
      } catch (err) {
        console.error("[Business Metrics] Cost per booking error:", err.message);
      }

      // ==========================================
      // 2. REPEAT BOOKING RATE
      // ==========================================
      let repeatBookingRate = { rate: 0, repeatBookers: 0, singleBookers: 0, totalHomeowners: 0 };
      try {
        // Get homeowners with their booking counts
        const bookingCounts = await UserAppointments.findAll({
          attributes: [
            "userId",
            [sequelize.fn("COUNT", sequelize.col("id")), "bookingCount"],
          ],
          group: ["userId"],
          raw: true,
        });

        const totalHomeowners = bookingCounts.length;
        const repeatBookers = bookingCounts.filter((u) => parseInt(u.bookingCount) > 1).length;
        const singleBookers = totalHomeowners - repeatBookers;

        repeatBookingRate = {
          rate: totalHomeowners > 0 ? Math.round((repeatBookers / totalHomeowners) * 100) : 0,
          repeatBookers,
          singleBookers,
          totalHomeowners,
        };
      } catch (err) {
        console.error("[Business Metrics] Repeat booking rate error:", err.message);
      }

      // ==========================================
      // 3. SUBSCRIPTION % (Frequent bookers - 3+ bookings)
      // ==========================================
      let subscriptionRate = { rate: 0, frequentBookers: 0, regularBookers: 0, occasionalBookers: 0 };
      try {
        const bookingCounts = await UserAppointments.findAll({
          attributes: [
            "userId",
            [sequelize.fn("COUNT", sequelize.col("id")), "bookingCount"],
          ],
          group: ["userId"],
          raw: true,
        });

        const totalHomeowners = bookingCounts.length;
        const frequentBookers = bookingCounts.filter((u) => parseInt(u.bookingCount) >= 5).length;
        const regularBookers = bookingCounts.filter((u) => {
          const count = parseInt(u.bookingCount);
          return count >= 3 && count < 5;
        }).length;
        const occasionalBookers = bookingCounts.filter((u) => parseInt(u.bookingCount) < 3).length;

        subscriptionRate = {
          rate: totalHomeowners > 0 ? Math.round((frequentBookers / totalHomeowners) * 100) : 0,
          frequentBookers, // 5+ bookings (loyal customers)
          regularBookers, // 3-4 bookings
          occasionalBookers, // 1-2 bookings
          totalHomeowners,
        };
      } catch (err) {
        console.error("[Business Metrics] Subscription rate error:", err.message);
      }

      // ==========================================
      // 4. CHURN (Cancellations)
      // ==========================================
      let churn = {
        homeownerCancellations: { total: 0, last30Days: 0, totalFeeCents: 0 },
        cleanerCancellations: { total: 0, last30Days: 0, last90Days: 0 },
      };
      try {
        // Track homeowner cancellations via cancellation fees in UserBills
        const billsWithCancellations = await UserBills.findAll({
          where: { cancellationFee: { [Op.gt]: 0 } },
          attributes: [
            [sequelize.fn("SUM", sequelize.col("cancellationFee")), "totalFees"],
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          ],
          raw: true,
        });

        // Track cleaner cancellations via system_cancellation_penalty reviews
        const cleanerCancellationReviews = await UserReviews.count({
          where: { reviewType: "system_cancellation_penalty" },
        }).catch(() => 0);

        const cleanerCancellationsLast30 = await UserReviews.count({
          where: {
            reviewType: "system_cancellation_penalty",
            createdAt: { [Op.gte]: thirtyDaysAgo },
          },
        }).catch(() => 0);

        const cleanerCancellationsLast90 = await UserReviews.count({
          where: {
            reviewType: "system_cancellation_penalty",
            createdAt: { [Op.gte]: ninetyDaysAgo },
          },
        }).catch(() => 0);

        churn = {
          homeownerCancellations: {
            usersWithCancellations: parseInt(billsWithCancellations?.[0]?.count || 0),
            // cancellationFee is stored in dollars, convert to cents for frontend
            totalFeeCents: parseInt(billsWithCancellations?.[0]?.totalFees || 0) * 100,
          },
          cleanerCancellations: {
            total: cleanerCancellationReviews,
            last30Days: cleanerCancellationsLast30,
            last90Days: cleanerCancellationsLast90,
          },
        };
      } catch (err) {
        console.error("[Business Metrics] Churn error:", err.message);
      }

      // ==========================================
      // 5. CLEANER RELIABILITY
      // ==========================================
      let cleanerReliability = {
        overallCompletionRate: 0,
        avgRating: 0,
        totalCompleted: 0,
        totalAssigned: 0,
        cleanerStats: [],
      };
      try {
        // Get all cleaners
        const cleaners = await User.findAll({
          where: { type: "cleaner" },
          attributes: ["id", "username", "cleanerRating"],
        });

        // Get completed appointments count
        const totalCompleted = await UserAppointments.count({
          where: { completed: true },
        });

        // Get assigned appointments (past date or completed)
        const totalAssigned = await UserAppointments.count({
          where: {
            hasBeenAssigned: true,
            [Op.or]: [
              { completed: true },
              { date: { [Op.lt]: now.toISOString().split("T")[0] } },
            ],
          },
        });

        // Calculate completion rate
        const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

        // Get average cleaner rating
        const avgRatingResult = await User.findOne({
          where: { type: "cleaner", cleanerRating: { [Op.gt]: 0 } },
          attributes: [[sequelize.fn("AVG", sequelize.col("cleanerRating")), "avgRating"]],
          raw: true,
        });

        // Get per-cleaner stats (top performers)
        const cleanerStatsPromises = cleaners.slice(0, 20).map(async (cleaner) => {
          const completedByThisCleaner = await UserAppointments.count({
            where: {
              completed: true,
              employeesAssigned: { [Op.contains]: [cleaner.id.toString()] },
            },
          }).catch(() => 0);

          const assignedToThisCleaner = await UserAppointments.count({
            where: {
              hasBeenAssigned: true,
              employeesAssigned: { [Op.contains]: [cleaner.id.toString()] },
              [Op.or]: [
                { completed: true },
                { date: { [Op.lt]: now.toISOString().split("T")[0] } },
              ],
            },
          }).catch(() => 0);

          return {
            id: cleaner.id,
            username: cleaner.username,
            rating: parseFloat(cleaner.cleanerRating) || 0,
            completed: completedByThisCleaner,
            assigned: assignedToThisCleaner,
            completionRate: assignedToThisCleaner > 0
              ? Math.round((completedByThisCleaner / assignedToThisCleaner) * 100)
              : 100,
          };
        });

        const cleanerStats = await Promise.all(cleanerStatsPromises);

        cleanerReliability = {
          overallCompletionRate: completionRate,
          avgRating: parseFloat(parseFloat(avgRatingResult?.avgRating || 0).toFixed(2)),
          totalCompleted,
          totalAssigned,
          cleanerStats: cleanerStats.sort((a, b) => b.completionRate - a.completionRate),
        };
      } catch (err) {
        console.error("[Business Metrics] Cleaner reliability error:", err.message);
      }

      res.json({
        costPerBooking,
        repeatBookingRate,
        subscriptionRate,
        churn,
        cleanerReliability,
      });
    } catch (error) {
      console.error("[Owner Dashboard] Business metrics error:", error);
      res.status(500).json({ error: "Failed to fetch business metrics" });
    }
  }
);

/**
 * GET /settings
 * Get owner's current settings including notification email
 */
ownerDashboardRouter.get("/settings", verifyOwner, async (req, res) => {
  try {
    const owner = req.user;

    res.json({
      email: EncryptionService.decrypt(owner.email),
      notificationEmail: owner.notificationEmail ? EncryptionService.decrypt(owner.notificationEmail) : null,
      effectiveNotificationEmail: owner.getNotificationEmail(),
      notifications: owner.notifications || [],
    });
  } catch (error) {
    console.error("[Owner Dashboard] Settings fetch error:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

/**
 * PUT /settings/notification-email
 * Update the email address for receiving owner notifications
 */
ownerDashboardRouter.put(
  "/settings/notification-email",
  verifyOwner,
  async (req, res) => {
    try {
      const { notificationEmail } = req.body;

      // Validate email format if provided
      if (notificationEmail && notificationEmail.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(notificationEmail.trim())) {
          return res.status(400).json({ error: "Invalid email format" });
        }
      }

      // Update the notification email (null clears it, falling back to main email)
      await req.user.update({
        notificationEmail: notificationEmail?.trim() || null,
      });

      res.json({
        success: true,
        message: notificationEmail?.trim()
          ? "Notification email updated successfully"
          : "Notification email cleared - using main email",
        notificationEmail: req.user.notificationEmail,
        effectiveNotificationEmail: req.user.getNotificationEmail(),
      });
    } catch (error) {
      console.error("[Owner Dashboard] Update notification email error:", error);
      res.status(500).json({ error: "Failed to update notification email" });
    }
  }
);

/**
 * GET /stripe-balance
 * Get current Stripe account balance
 */
ownerDashboardRouter.get("/stripe-balance", verifyOwner, async (req, res) => {
  console.log("[Stripe Balance] Request received");
  try {
    // Get Stripe balance
    console.log("[Stripe Balance] Fetching from Stripe...");
    const balance = await stripe.balance.retrieve();
    console.log("[Stripe Balance] Stripe response:", JSON.stringify(balance));

    // Get total withdrawn this year
    const currentYear = new Date().getFullYear();
    const withdrawnStats = await OwnerWithdrawal.getTotalWithdrawn({ taxYear: currentYear });

    // Get pending withdrawals
    const pendingWithdrawals = await OwnerWithdrawal.findAll({
      where: {
        status: ["pending", "processing"],
      },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalPending"],
        [sequelize.fn("COUNT", sequelize.col("id")), "pendingCount"],
      ],
      raw: true,
    });

    const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const pendingBalance = balance.pending.reduce((sum, b) => sum + b.amount, 0);
    const pendingWithdrawalAmount = parseInt(pendingWithdrawals[0]?.totalPending) || 0;

    console.log("[Stripe Balance] Available:", availableBalance, "cents, Pending:", pendingBalance, "cents");

    res.json({
      available: {
        cents: availableBalance,
        dollars: (availableBalance / 100).toFixed(2),
      },
      pending: {
        cents: pendingBalance,
        dollars: (pendingBalance / 100).toFixed(2),
      },
      pendingWithdrawals: {
        cents: pendingWithdrawalAmount,
        dollars: (pendingWithdrawalAmount / 100).toFixed(2),
        count: parseInt(pendingWithdrawals[0]?.pendingCount) || 0,
      },
      withdrawableBalance: {
        cents: availableBalance - pendingWithdrawalAmount,
        dollars: ((availableBalance - pendingWithdrawalAmount) / 100).toFixed(2),
      },
      withdrawnThisYear: withdrawnStats,
      currency: "usd",
    });
  } catch (error) {
    console.error("[Owner Dashboard] Get Stripe balance error:", error);
    res.status(500).json({ error: "Failed to retrieve balance" });
  }
});

/**
 * GET /withdrawals
 * Get withdrawal history
 */
ownerDashboardRouter.get("/withdrawals", verifyOwner, async (req, res) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;

    const history = await OwnerWithdrawal.getHistory({
      limit: parseInt(limit),
      offset: parseInt(offset),
      status,
    });

    // Format the withdrawals
    const formattedWithdrawals = history.withdrawals.map((w) => ({
      id: w.id,
      transactionId: w.transactionId,
      amount: {
        cents: w.amount,
        dollars: (w.amount / 100).toFixed(2),
      },
      status: w.status,
      bankAccountLast4: w.bankAccountLast4,
      bankName: w.bankName,
      requestedAt: w.requestedAt,
      processedAt: w.processedAt,
      completedAt: w.completedAt,
      estimatedArrival: w.estimatedArrival,
      failureReason: w.failureReason,
      description: w.description,
    }));

    res.json({
      withdrawals: formattedWithdrawals,
      total: history.total,
      limit: history.limit,
      offset: history.offset,
    });
  } catch (error) {
    console.error("[Owner Dashboard] Get withdrawals error:", error);
    res.status(500).json({ error: "Failed to retrieve withdrawal history" });
  }
});

/**
 * POST /withdraw
 * Initiate a withdrawal to bank account
 */
ownerDashboardRouter.post("/withdraw", verifyOwner, async (req, res) => {
  try {
    const { amount, description } = req.body;

    // Validate amount
    if (!amount || amount < 100) {
      return res.status(400).json({ error: "Minimum withdrawal amount is $1.00" });
    }

    // Get current balance
    const balance = await stripe.balance.retrieve();
    const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0);

    // Check for pending withdrawals
    const pendingWithdrawals = await OwnerWithdrawal.findAll({
      where: {
        status: ["pending", "processing"],
      },
      attributes: [[sequelize.fn("SUM", sequelize.col("amount")), "totalPending"]],
      raw: true,
    });
    const pendingAmount = parseInt(pendingWithdrawals[0]?.totalPending) || 0;
    const withdrawableBalance = availableBalance - pendingAmount;

    if (amount > withdrawableBalance) {
      return res.status(400).json({
        error: "Insufficient balance",
        available: {
          cents: withdrawableBalance,
          dollars: (withdrawableBalance / 100).toFixed(2),
        },
        requested: {
          cents: amount,
          dollars: (amount / 100).toFixed(2),
        },
      });
    }

    // Create withdrawal record
    const withdrawal = await OwnerWithdrawal.create({
      transactionId: OwnerWithdrawal.generateTransactionId(),
      amount,
      status: "pending",
      description: description || `Withdrawal of $${(amount / 100).toFixed(2)}`,
      requestedAt: new Date(),
    });

    // Create Stripe payout
    try {
      const payout = await stripe.payouts.create({
        amount,
        currency: "usd",
        description: `Platform withdrawal - ${withdrawal.transactionId}`,
        metadata: {
          withdrawalId: withdrawal.id,
          transactionId: withdrawal.transactionId,
        },
      });

      // Update withdrawal with Stripe payout info
      await withdrawal.update({
        stripePayoutId: payout.id,
        status: "processing",
        processedAt: new Date(),
        estimatedArrival: payout.arrival_date
          ? new Date(payout.arrival_date * 1000)
          : null,
        bankAccountLast4: payout.destination
          ? String(payout.destination).slice(-4)
          : null,
      });

      res.json({
        success: true,
        withdrawal: {
          id: withdrawal.id,
          transactionId: withdrawal.transactionId,
          amount: {
            cents: amount,
            dollars: (amount / 100).toFixed(2),
          },
          status: "processing",
          stripePayoutId: payout.id,
          estimatedArrival: payout.arrival_date
            ? new Date(payout.arrival_date * 1000)
            : null,
        },
        message: `Withdrawal of $${(amount / 100).toFixed(2)} initiated successfully`,
      });
    } catch (stripeError) {
      // If Stripe payout fails, update withdrawal record
      await withdrawal.update({
        status: "failed",
        failureReason: stripeError.message,
      });

      console.error("[Owner Dashboard] Stripe payout error:", stripeError);
      res.status(400).json({
        error: "Failed to create payout",
        details: stripeError.message,
      });
    }
  } catch (error) {
    console.error("[Owner Dashboard] Withdraw error:", error);
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
});

/**
 * POST /webhook/payout
 * Handle Stripe payout webhooks (for updating withdrawal status)
 * Note: This should be called from your main Stripe webhook handler
 */
ownerDashboardRouter.handlePayoutWebhook = async (event) => {
  try {
    const payout = event.data.object;
    const withdrawalId = payout.metadata?.withdrawalId;

    if (!withdrawalId) {
      // Not a platform withdrawal, ignore
      return;
    }

    const withdrawal = await OwnerWithdrawal.findByPk(withdrawalId);
    if (!withdrawal) {
      console.error(`[Owner Dashboard] Withdrawal not found: ${withdrawalId}`);
      return;
    }

    switch (event.type) {
      case "payout.paid":
        await withdrawal.update({
          status: "completed",
          completedAt: new Date(),
        });
        break;

      case "payout.failed":
        await withdrawal.update({
          status: "failed",
          failureReason: payout.failure_message || "Payout failed",
        });
        break;

      case "payout.canceled":
        await withdrawal.update({
          status: "canceled",
          failureReason: "Payout was canceled",
        });
        break;
    }
  } catch (error) {
    console.error("[Owner Dashboard] Payout webhook error:", error);
  }
};

module.exports = ownerDashboardRouter;
