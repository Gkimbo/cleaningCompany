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
  ConversationParticipant,
  sequelize,
} = require("../../../models");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const EncryptionService = require("../../../services/EncryptionService");
const {
  businessConfig,
  updateAllHomesServiceAreaStatus,
} = require("../../../config/businessConfig");
const EmailClass = require("../../../services/sendNotifications/EmailClass");
const NotificationService = require("../../../services/NotificationService");

const ownerDashboardRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Helper to safely decrypt a field with error handling
const safeDecrypt = (value) => {
  if (!value) return null;
  try {
    return EncryptionService.decrypt(value);
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return "[encrypted]";
  }
};

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

      // Total counts - exclude demo accounts
      const demoFilter = { isDemoAccount: { [Op.ne]: true } };

      // All cleaners: users with type = "cleaner"
      const totalCleaners = await User.count({
        where: { type: "cleaner", ...demoFilter },
      }).catch(() => 0);

      // Cleaners with availability set (have daysWorking configured)
      const cleanersWithAvailability = await User.count({
        where: {
          type: "cleaner",
          daysWorking: { [Op.ne]: null },
          ...demoFilter,
        },
      }).catch(() => 0);

      // Homeowners: users who have at least one home registered
      const totalHomes = await UserHomes.count({
        include: [{
          model: User,
          as: "user",
          where: demoFilter,
          required: true,
          attributes: [],
        }],
      }).catch(() => 0);

      // Count distinct homeowners (users who own at least one home) - excluding demo
      const homeownerCountResult = await UserHomes.count({
        distinct: true,
        col: 'userId',
        include: [{
          model: User,
          as: "user",
          where: demoFilter,
          required: true,
          attributes: [],
        }],
      }).catch(() => 0);
      const totalHomeowners = homeownerCountResult;

      // Registered users (non-cleaner, non-owner) - potential homeowners
      const totalRegisteredUsers = await User.count({
        where: {
          [Op.or]: [{ type: null }, { type: "" }, { type: "homeowner" }],
          ...demoFilter,
        },
      }).catch(() => 0);

      // Owners - don't filter demo for owners (real platform owners)
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

      // Active users (logged in within time period) - exclude demo accounts
      const getActiveUsers = async (since, userType) => {
        try {
          if (userType === "homeowner") {
            return await User.count({
              where: {
                lastLogin: { [Op.gte]: since },
                [Op.or]: [{ type: null }, { type: "" }, { type: "homeowner" }],
                ...demoFilter,
              },
            });
          }
          return await User.count({
            where: {
              lastLogin: { [Op.gte]: since },
              type: userType,
              ...demoFilter,
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

      // New user signups over time (for chart) - exclude demo accounts
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
            isDemoAccount: { [Op.ne]: true },
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

      // Total appointments - exclude demo appointments
      const demoApptFilter = { isDemoAppointment: { [Op.ne]: true } };
      const totalAppointments = await UserAppointments.count({
        where: demoApptFilter,
      }).catch(() => 0);
      const completedAppointments = await UserAppointments.count({
        where: { completed: true, ...demoApptFilter },
      }).catch(() => 0);
      const upcomingAppointments = await UserAppointments.count({
        where: {
          completed: false,
          date: { [Op.gte]: now },
          ...demoApptFilter,
        },
      }).catch(() => 0);

      // Appointments by month (for chart) - exclude demo appointments
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
            ...demoApptFilter,
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
          revenueCents: Math.round(parseFloat(m.revenue || 0) * 100),
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

      // Calculate actual unread message count for the owner
      let unreadCount = 0;
      try {
        const participations = await ConversationParticipant.findAll({
          where: { userId: req.user.id },
        });

        for (const p of participations) {
          const count = await Message.count({
            where: {
              conversationId: p.conversationId,
              createdAt: { [Op.gt]: p.lastReadAt || new Date(0) },
              senderId: { [Op.ne]: req.user.id },
            },
          });
          unreadCount += count;
        }
      } catch (unreadError) {
        console.error("[Owner Dashboard] Unread count error:", unreadError.message);
      }

      res.json({
        unreadCount,
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

    // Today's appointments - exclude demo appointments
    const todaysAppointments = await UserAppointments.count({
      where: {
        date: {
          [Op.gte]: todayStart,
          [Op.lt]: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
        },
        isDemoAppointment: { [Op.ne]: true },
      },
    }).catch(() => 0);

    // Pending payments
    const pendingPayments = await Payment.count({
      where: { status: "pending" },
    }).catch(() => 0);

    // New users this week - exclude demo accounts
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.count({
      where: {
        createdAt: { [Op.gte]: weekAgo },
        isDemoAccount: { [Op.ne]: true },
      },
    }).catch(() => 0);

    // Completed cleanings this week - exclude demo appointments
    const completedThisWeek = await UserAppointments.count({
      where: {
        completed: true,
        date: { [Op.gte]: weekAgo },
        isDemoAppointment: { [Op.ne]: true },
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
      // Filter to exclude demo homes (homes owned by demo accounts)
      const demoFilter = {
        model: User,
        as: "user",
        where: { isDemoAccount: { [Op.ne]: true } },
        required: true,
        attributes: [],
      };

      // Get count of homes outside service area - exclude demo homes
      const homesOutsideArea = await UserHomes.count({
        where: { outsideServiceArea: true },
        include: [demoFilter],
      }).catch(() => 0);

      const totalHomes = await UserHomes.count({
        include: [demoFilter],
      }).catch(() => 0);

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

      // Signup counts - exclude demo accounts
      const demoFilter = { isDemoAccount: { [Op.ne]: true } };

      const signupsToday = await User.count({
        where: { createdAt: { [Op.gte]: todayStart }, ...demoFilter },
      }).catch(() => 0);

      const signupsThisWeek = await User.count({
        where: { createdAt: { [Op.gte]: weekStart }, ...demoFilter },
      }).catch(() => 0);

      const signupsThisMonth = await User.count({
        where: { createdAt: { [Op.gte]: monthStart }, ...demoFilter },
      }).catch(() => 0);

      const signupsThisYear = await User.count({
        where: { createdAt: { [Op.gte]: yearStart }, ...demoFilter },
      }).catch(() => 0);

      const signupsAllTime = await User.count({
        where: demoFilter,
      }).catch(() => 0);

      // Active users (using lastLogin as proxy for sessions) - exclude demo accounts
      const activeToday = await User.count({
        where: { lastLogin: { [Op.gte]: todayStart }, ...demoFilter },
      }).catch(() => 0);

      const activeThisWeek = await User.count({
        where: { lastLogin: { [Op.gte]: weekStart }, ...demoFilter },
      }).catch(() => 0);

      const activeThisMonth = await User.count({
        where: { lastLogin: { [Op.gte]: monthStart }, ...demoFilter },
      }).catch(() => 0);

      const activeAllTime = await User.count({
        where: { lastLogin: { [Op.ne]: null }, ...demoFilter },
      }).catch(() => 0);

      // Calculate retention rates - exclude demo accounts
      // Day N retention = % of users who signed up at least N days ago and logged in at least N days after signup
      async function calculateRetention(days) {
        try {
          // Find users who signed up at least N days ago
          const cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - days);

          const usersSignedUp = await User.count({
            where: {
              createdAt: { [Op.lte]: cutoffDate },
              ...demoFilter,
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
              ...demoFilter,
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

      // Calculate engagement metrics based on loginCount - exclude demo accounts
      const totalUsers = await User.count({
        where: demoFilter,
      }).catch(() => 0);

      // Users who have logged in at least once
      const usersWhoLoggedIn = await User.count({
        where: { loginCount: { [Op.gte]: 1 }, ...demoFilter },
      }).catch(() => 0);

      // Users who have logged in more than once (returning users)
      const returningUsers = await User.count({
        where: { loginCount: { [Op.gte]: 2 }, ...demoFilter },
      }).catch(() => 0);

      // Highly engaged users (logged in 5+ times)
      const highlyEngagedUsers = await User.count({
        where: { loginCount: { [Op.gte]: 5 }, ...demoFilter },
      }).catch(() => 0);

      // Calculate average logins per user
      const loginStats = await User.findOne({
        attributes: [
          [sequelize.fn("AVG", sequelize.col("loginCount")), "avgLogins"],
          [sequelize.fn("SUM", sequelize.col("loginCount")), "totalLogins"],
        ],
        where: demoFilter,
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

      // Calculate device breakdown from lastDeviceType - exclude demo accounts
      const deviceCounts = await User.findAll({
        where: { lastDeviceType: { [Op.ne]: null }, ...demoFilter },
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
      // Exclude demo homes (homes owned by demo accounts)
      const homes = await UserHomes.findAll({
        where: { outsideServiceArea: true },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email"],
            where: { isDemoAccount: { [Op.ne]: true } },
            required: true,
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
                email: safeDecrypt(h.user.email),
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
      // 2. REPEAT BOOKING RATE - exclude demo appointments
      // ==========================================
      let repeatBookingRate = { rate: 0, repeatBookers: 0, singleBookers: 0, totalHomeowners: 0 };
      try {
        // Get homeowners with their booking counts
        const bookingCounts = await UserAppointments.findAll({
          attributes: [
            "userId",
            [sequelize.fn("COUNT", sequelize.col("id")), "bookingCount"],
          ],
          where: { isDemoAppointment: { [Op.ne]: true } },
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
      // 3. SUBSCRIPTION % (Frequent bookers - 3+ bookings) - exclude demo appointments
      // ==========================================
      let subscriptionRate = { rate: 0, frequentBookers: 0, regularBookers: 0, occasionalBookers: 0 };
      try {
        const bookingCounts = await UserAppointments.findAll({
          attributes: [
            "userId",
            [sequelize.fn("COUNT", sequelize.col("id")), "bookingCount"],
          ],
          where: { isDemoAppointment: { [Op.ne]: true } },
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
        // Get all cleaners - exclude demo accounts
        const cleaners = await User.findAll({
          where: { type: "cleaner", isDemoAccount: { [Op.ne]: true } },
          attributes: ["id", "username", "cleanerRating"],
        });

        // Get completed appointments count - exclude demo appointments
        const totalCompleted = await UserAppointments.count({
          where: { completed: true, isDemoAppointment: { [Op.ne]: true } },
        });

        // Get assigned appointments (past date or completed) - exclude demo appointments
        const totalAssigned = await UserAppointments.count({
          where: {
            hasBeenAssigned: true,
            isDemoAppointment: { [Op.ne]: true },
            [Op.or]: [
              { completed: true },
              { date: { [Op.lt]: now.toISOString().split("T")[0] } },
            ],
          },
        });

        // Calculate completion rate
        const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

        // Get average cleaner rating - exclude demo accounts
        const avgRatingResult = await User.findOne({
          where: { type: "cleaner", cleanerRating: { [Op.gt]: 0 }, isDemoAccount: { [Op.ne]: true } },
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
      email: safeDecrypt(owner.email),
      notificationEmail: safeDecrypt(owner.notificationEmail),
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

// =====================
// PRIORITY PERKS CONFIG ENDPOINTS
// =====================

const { PreferredPerksConfig } = require("../../../models");
const PreferredPerksConfigSerializer = require("../../../serializers/PreferredPerksConfigSerializer");

/**
 * GET /priority-perks/config
 * Get current Priority Perks configuration
 */
ownerDashboardRouter.get("/priority-perks/config", verifyOwner, async (req, res) => {
  try {
    let config = await PreferredPerksConfig.findOne();

    // Create default config if none exists
    if (!config) {
      config = await PreferredPerksConfig.create({});
    }

    // Use serializer for consistent formatting
    res.json({
      config: PreferredPerksConfigSerializer.serializeForForm(config),
      updatedAt: config.updatedAt,
    });
  } catch (err) {
    console.error("Error fetching priority perks config:", err);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

/**
 * PUT /priority-perks/config
 * Update Priority Perks configuration
 */
ownerDashboardRouter.put("/priority-perks/config", verifyOwner, async (req, res) => {
  try {
    const { bronze, silver, gold, platinum, backupCleanerTimeoutHours, platformMaxDailyJobs, platformMaxConcurrentJobs } = req.body;

    let config = await PreferredPerksConfig.findOne();
    if (!config) {
      config = await PreferredPerksConfig.create({});
    }

    const updates = {};

    // Bronze tier
    if (bronze) {
      if (bronze.minHomes !== undefined) updates.bronzeMinHomes = bronze.minHomes;
      if (bronze.maxHomes !== undefined) updates.bronzeMaxHomes = bronze.maxHomes;
      if (bronze.bonusPercent !== undefined) updates.bronzeBonusPercent = bronze.bonusPercent;
    }

    // Silver tier
    if (silver) {
      if (silver.minHomes !== undefined) updates.silverMinHomes = silver.minHomes;
      if (silver.maxHomes !== undefined) updates.silverMaxHomes = silver.maxHomes;
      if (silver.bonusPercent !== undefined) updates.silverBonusPercent = silver.bonusPercent;
    }

    // Gold tier
    if (gold) {
      if (gold.minHomes !== undefined) updates.goldMinHomes = gold.minHomes;
      if (gold.maxHomes !== undefined) updates.goldMaxHomes = gold.maxHomes;
      if (gold.bonusPercent !== undefined) updates.goldBonusPercent = gold.bonusPercent;
      if (gold.fasterPayouts !== undefined) updates.goldFasterPayouts = gold.fasterPayouts;
      if (gold.payoutHours !== undefined) updates.goldPayoutHours = gold.payoutHours;
    }

    // Platinum tier
    if (platinum) {
      if (platinum.minHomes !== undefined) updates.platinumMinHomes = platinum.minHomes;
      if (platinum.bonusPercent !== undefined) updates.platinumBonusPercent = platinum.bonusPercent;
      if (platinum.fasterPayouts !== undefined) updates.platinumFasterPayouts = platinum.fasterPayouts;
      if (platinum.payoutHours !== undefined) updates.platinumPayoutHours = platinum.payoutHours;
      if (platinum.earlyAccess !== undefined) updates.platinumEarlyAccess = platinum.earlyAccess;
    }

    // Other settings
    if (backupCleanerTimeoutHours !== undefined) updates.backupCleanerTimeoutHours = backupCleanerTimeoutHours;
    if (platformMaxDailyJobs !== undefined) updates.platformMaxDailyJobs = platformMaxDailyJobs;
    if (platformMaxConcurrentJobs !== undefined) updates.platformMaxConcurrentJobs = platformMaxConcurrentJobs;

    updates.updatedBy = req.user.id;

    // Capture previous values for history
    const previousValues = config.toJSON();
    delete previousValues.id;
    delete previousValues.createdAt;
    delete previousValues.updatedAt;

    await config.update(updates);

    // Record history
    try {
      const { PreferredPerksConfigHistory } = require("../../../models");
      if (PreferredPerksConfigHistory) {
        // Calculate what actually changed
        const changes = {};
        for (const [key, newValue] of Object.entries(updates)) {
          if (key === "updatedBy") continue;
          const oldValue = previousValues[key];
          if (oldValue !== newValue) {
            changes[key] = { old: oldValue, new: newValue };
          }
        }

        if (Object.keys(changes).length > 0) {
          const newValues = config.toJSON();
          delete newValues.id;
          delete newValues.createdAt;
          delete newValues.updatedAt;

          await PreferredPerksConfigHistory.create({
            configId: config.id,
            changedBy: req.user.id,
            changeType: "update",
            changes,
            previousValues,
            newValues,
          });
        }
      }
    } catch (histErr) {
      console.error("Error recording config history:", histErr);
      // Don't fail the request, just log the error
    }

    console.log(`[OwnerDashboard] Priority Perks config updated by user ${req.user.id}`);

    res.json({
      success: true,
      message: "Configuration updated successfully",
    });
  } catch (err) {
    console.error("Error updating priority perks config:", err);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

/**
 * GET /priority-perks/history
 * Get Priority Perks configuration change history
 */
ownerDashboardRouter.get("/priority-perks/history", verifyOwner, async (req, res) => {
  try {
    const { PreferredPerksConfigHistory, User } = require("../../../models");

    if (!PreferredPerksConfigHistory) {
      return res.json({ history: [], message: "History tracking not available" });
    }

    const { limit = 50, offset = 0 } = req.query;

    const history = await PreferredPerksConfigHistory.findAll({
      include: [{
        model: User,
        as: "changer",
        attributes: ["id", "firstName", "lastName", "username"],
      }],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    const formattedHistory = history.map((entry) => ({
      id: entry.id,
      changedAt: entry.createdAt,
      changeType: entry.changeType,
      changedBy: entry.changer
        ? {
            id: entry.changer.id,
            name: `${safeDecrypt(entry.changer.firstName) || ""} ${safeDecrypt(entry.changer.lastName) || ""}`.trim() || entry.changer.username,
          }
        : null,
      changes: entry.changes,
      summary: formatChangeSummary(entry.changes),
    }));

    res.json({ history: formattedHistory });
  } catch (err) {
    console.error("Error fetching priority perks history:", err);
    res.status(500).json({ error: "Failed to fetch configuration history" });
  }
});

/**
 * Format a change summary for display
 */
function formatChangeSummary(changes) {
  const summaries = [];
  const fieldLabels = {
    bronzeMinHomes: "Bronze Min Homes",
    bronzeMaxHomes: "Bronze Max Homes",
    bronzeBonusPercent: "Bronze Bonus %",
    silverMinHomes: "Silver Min Homes",
    silverMaxHomes: "Silver Max Homes",
    silverBonusPercent: "Silver Bonus %",
    goldMinHomes: "Gold Min Homes",
    goldMaxHomes: "Gold Max Homes",
    goldBonusPercent: "Gold Bonus %",
    goldFasterPayouts: "Gold Faster Payouts",
    goldPayoutHours: "Gold Payout Hours",
    platinumMinHomes: "Platinum Min Homes",
    platinumBonusPercent: "Platinum Bonus %",
    platinumFasterPayouts: "Platinum Faster Payouts",
    platinumPayoutHours: "Platinum Payout Hours",
    platinumEarlyAccess: "Platinum Early Access",
    backupCleanerTimeoutHours: "Backup Timeout Hours",
    platformMaxDailyJobs: "Max Daily Jobs",
    platformMaxConcurrentJobs: "Max Concurrent Jobs",
  };

  for (const [field, change] of Object.entries(changes)) {
    const label = fieldLabels[field] || field;
    summaries.push(`${label}: ${change.old} → ${change.new}`);
  }

  return summaries;
}

// =====================
// CLEANER MANAGEMENT ENDPOINTS
// =====================

/**
 * GET /cleaners
 * Get all cleaners with their frozen status (owner only)
 */
ownerDashboardRouter.get("/cleaners", verifyOwner, async (req, res) => {
  try {
    const { status } = req.query; // "all", "active", "frozen"

    const where = { type: "cleaner", isDemoAccount: { [Op.ne]: true } };

    if (status === "frozen") {
      where.accountFrozen = true;
    } else if (status === "active") {
      where.accountFrozen = { [Op.ne]: true };
    }

    const cleaners = await User.findAll({
      where,
      attributes: [
        "id",
        "username",
        "firstName",
        "lastName",
        "email",
        "phone",
        "accountFrozen",
        "accountFrozenAt",
        "accountFrozenReason",
        "createdAt",
        "lastLogin",
        "daysWorking",
        "warningCount",
      ],
      order: [["createdAt", "DESC"]],
    });

    // Fetch metrics for all cleaners in parallel
    const cleanerIds = cleaners.map((c) => c.id);
    const cleanerUsernames = cleaners.map((c) => c.username);

    // Get job counts and earnings for each cleaner
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [jobMetrics, reviewMetrics] = await Promise.all([
      // Job metrics - completed jobs
      sequelize.query(
        `SELECT
          ua."employeesAssigned",
          COUNT(*) as total_jobs,
          SUM(CASE WHEN ua."completed" = true THEN 1 ELSE 0 END) as completed_jobs,
          SUM(CASE WHEN ua."completed" = true THEN CAST(ua."price" AS INTEGER) ELSE 0 END) as total_earnings,
          SUM(CASE WHEN ua."completed" = true AND ua."createdAt" >= :startOfMonth THEN CAST(ua."price" AS INTEGER) ELSE 0 END) as monthly_earnings
        FROM "UserAppointments" ua
        WHERE ua."hasBeenAssigned" = true
        GROUP BY ua."employeesAssigned"`,
        {
          replacements: { startOfMonth },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      // Review metrics - average rating per cleaner
      UserReviews.findAll({
        where: {
          userId: { [Op.in]: cleanerIds },
          reviewType: "homeowner_to_cleaner",
        },
        attributes: [
          "userId",
          [sequelize.fn("AVG", sequelize.col("review")), "avgRating"],
          [sequelize.fn("COUNT", sequelize.col("id")), "reviewCount"],
        ],
        group: ["userId"],
        raw: true,
      }),
    ]);

    // Build lookup maps
    const reviewMap = {};
    reviewMetrics.forEach((r) => {
      reviewMap[r.userId] = {
        avgRating: parseFloat(r.avgRating) || 0,
        reviewCount: parseInt(r.reviewCount) || 0,
      };
    });

    // Calculate job metrics per cleaner (from employeesAssigned array)
    const jobMap = {};
    cleanerUsernames.forEach((username) => {
      jobMap[username] = {
        totalJobs: 0,
        completedJobs: 0,
        totalEarnings: 0,
        monthlyEarnings: 0,
      };
    });
    jobMetrics.forEach((row) => {
      const assigned = row.employeesAssigned || [];
      assigned.forEach((username) => {
        if (jobMap[username]) {
          jobMap[username].totalJobs += parseInt(row.total_jobs) || 0;
          jobMap[username].completedJobs += parseInt(row.completed_jobs) || 0;
          // Split earnings among assigned cleaners
          const share = assigned.length > 0 ? 1 / assigned.length : 1;
          jobMap[username].totalEarnings +=
            Math.round((parseInt(row.total_earnings) || 0) * share);
          jobMap[username].monthlyEarnings +=
            Math.round((parseInt(row.monthly_earnings) || 0) * share);
        }
      });
    });

    const serializedCleaners = cleaners.map((c) => {
      const reviews = reviewMap[c.id] || { avgRating: 0, reviewCount: 0 };
      const jobs = jobMap[c.username] || {
        totalJobs: 0,
        completedJobs: 0,
        totalEarnings: 0,
        monthlyEarnings: 0,
      };
      const reliabilityScore =
        jobs.totalJobs > 0
          ? Math.round((jobs.completedJobs / jobs.totalJobs) * 100)
          : null;

      return {
        id: c.id,
        username: c.username,
        firstName: safeDecrypt(c.firstName),
        lastName: safeDecrypt(c.lastName),
        email: safeDecrypt(c.email),
        phone: safeDecrypt(c.phone),
        accountFrozen: c.accountFrozen || false,
        accountFrozenAt: c.accountFrozenAt,
        accountFrozenReason: c.accountFrozenReason,
        createdAt: c.createdAt,
        lastLogin: c.lastLogin,
        hasAvailability: c.daysWorking && c.daysWorking.length > 0,
        warningCount: c.warningCount || 0,
        // Performance metrics
        jobsCompleted: jobs.completedJobs,
        avgRating: reviews.avgRating,
        reviewCount: reviews.reviewCount,
        reliabilityScore,
        // Earnings
        totalEarnings: jobs.totalEarnings,
        monthlyEarnings: jobs.monthlyEarnings,
      };
    });

    return res.status(200).json({ cleaners: serializedCleaners });
  } catch (error) {
    console.error("[Owner Dashboard] Error fetching cleaners:", error);
    return res.status(500).json({ error: "Failed to fetch cleaners" });
  }
});

/**
 * POST /cleaners/:cleanerId/freeze
 * Freeze a cleaner account (owner only)
 */
ownerDashboardRouter.post(
  "/cleaners/:cleanerId/freeze",
  verifyOwner,
  async (req, res) => {
    try {
      const { cleanerId } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length < 5) {
        return res
          .status(400)
          .json({ error: "A reason is required (at least 5 characters)" });
      }

      const cleaner = await User.findByPk(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ error: "Cleaner not found" });
      }

      if (cleaner.type !== "cleaner") {
        return res.status(400).json({ error: "User is not a cleaner" });
      }

      if (cleaner.accountFrozen) {
        return res.status(400).json({ error: "Account is already frozen" });
      }

      await cleaner.update({
        accountFrozen: true,
        accountFrozenAt: new Date(),
        accountFrozenReason: reason.trim(),
        accountStatusUpdatedById: req.user.id,
      });

      // Send notification to cleaner
      const io = req.app.get("io");
      try {
        await NotificationService.notifyUser({
          userId: parseInt(cleanerId),
          type: "account_frozen",
          title: "Account Frozen",
          message:
            "Your account has been frozen. Please contact support for assistance.",
          data: {
            frozenAt: new Date().toISOString(),
            reason: reason.trim(),
          },
          io,
        });
      } catch (notifyErr) {
        console.error(
          "[Owner Dashboard] Error sending freeze notification:",
          notifyErr
        );
      }

      console.log(
        `[Owner Dashboard] Cleaner ${cleanerId} frozen by owner ${req.user.id}. Reason: ${reason}`
      );

      return res.status(200).json({
        success: true,
        message: "Cleaner account frozen successfully",
        cleaner: {
          id: cleaner.id,
          accountFrozen: true,
          accountFrozenAt: cleaner.accountFrozenAt,
          accountFrozenReason: cleaner.accountFrozenReason,
        },
      });
    } catch (error) {
      console.error("[Owner Dashboard] Error freezing cleaner:", error);
      return res.status(500).json({ error: "Failed to freeze cleaner account" });
    }
  }
);

/**
 * POST /cleaners/:cleanerId/unfreeze
 * Unfreeze a cleaner account (owner only)
 */
ownerDashboardRouter.post(
  "/cleaners/:cleanerId/unfreeze",
  verifyOwner,
  async (req, res) => {
    try {
      const { cleanerId } = req.params;

      const cleaner = await User.findByPk(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ error: "Cleaner not found" });
      }

      if (cleaner.type !== "cleaner") {
        return res.status(400).json({ error: "User is not a cleaner" });
      }

      if (!cleaner.accountFrozen) {
        return res.status(400).json({ error: "Account is not frozen" });
      }

      await cleaner.update({
        accountFrozen: false,
        accountFrozenAt: null,
        accountFrozenReason: null,
        accountStatusUpdatedById: req.user.id,
      });

      // Send notification to cleaner
      const io = req.app.get("io");
      try {
        await NotificationService.notifyUser({
          userId: parseInt(cleanerId),
          type: "account_unfrozen",
          title: "Account Restored",
          message:
            "Your account has been restored. You now have full access to the platform.",
          data: {
            unfrozenAt: new Date().toISOString(),
          },
          io,
        });
      } catch (notifyErr) {
        console.error(
          "[Owner Dashboard] Error sending unfreeze notification:",
          notifyErr
        );
      }

      console.log(
        `[Owner Dashboard] Cleaner ${cleanerId} unfrozen by owner ${req.user.id}`
      );

      return res.status(200).json({
        success: true,
        message: "Cleaner account unfrozen successfully",
        cleaner: {
          id: cleaner.id,
          accountFrozen: false,
        },
      });
    } catch (error) {
      console.error("[Owner Dashboard] Error unfreezing cleaner:", error);
      return res
        .status(500)
        .json({ error: "Failed to unfreeze cleaner account" });
    }
  }
);

/**
 * GET /cleaners/:cleanerId/details
 * Get detailed cleaner profile with metrics and earnings (owner only)
 */
ownerDashboardRouter.get(
  "/cleaners/:cleanerId/details",
  verifyOwner,
  async (req, res) => {
    try {
      const { cleanerId } = req.params;

      const cleaner = await User.findByPk(cleanerId, {
        attributes: [
          "id",
          "username",
          "firstName",
          "lastName",
          "email",
          "phone",
          "accountFrozen",
          "accountFrozenAt",
          "accountFrozenReason",
          "createdAt",
          "lastLogin",
          "daysWorking",
          "warningCount",
        ],
      });

      if (!cleaner) {
        return res.status(404).json({ error: "Cleaner not found" });
      }

      if (cleaner.type && cleaner.type !== "cleaner") {
        return res.status(400).json({ error: "User is not a cleaner" });
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all appointments where this cleaner was assigned
      const appointments = await UserAppointments.findAll({
        where: {
          employeesAssigned: { [Op.contains]: [cleaner.username] },
        },
        attributes: ["id", "completed", "price", "date", "createdAt"],
      });

      // Calculate metrics
      const totalJobs = appointments.length;
      const completedJobs = appointments.filter((a) => a.completed).length;
      const reliabilityScore =
        totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : null;

      // Calculate earnings
      let totalEarnings = 0;
      let monthlyEarnings = 0;
      appointments.forEach((a) => {
        if (a.completed) {
          const price = parseInt(a.price) || 0;
          totalEarnings += price;
          if (new Date(a.createdAt) >= startOfMonth) {
            monthlyEarnings += price;
          }
        }
      });
      const avgPerJob = completedJobs > 0 ? Math.round(totalEarnings / completedJobs) : 0;

      // Get reviews
      const reviews = await UserReviews.findAll({
        where: {
          userId: cleanerId,
          reviewType: "homeowner_to_cleaner",
        },
        attributes: ["review"],
      });

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.review, 0) / reviews.length
          : 0;

      return res.status(200).json({
        cleaner: {
          id: cleaner.id,
          username: cleaner.username,
          firstName: safeDecrypt(cleaner.firstName),
          lastName: safeDecrypt(cleaner.lastName),
          email: safeDecrypt(cleaner.email),
          phone: safeDecrypt(cleaner.phone),
          accountFrozen: cleaner.accountFrozen || false,
          accountFrozenAt: cleaner.accountFrozenAt,
          accountFrozenReason: cleaner.accountFrozenReason,
          warningCount: cleaner.warningCount || 0,
          createdAt: cleaner.createdAt,
          lastLogin: cleaner.lastLogin,
          daysWorking: cleaner.daysWorking || [],
        },
        metrics: {
          totalJobsCompleted: completedJobs,
          totalJobsAssigned: totalJobs,
          averageRating: Math.round(avgRating * 10) / 10,
          reliabilityScore,
          totalReviews: reviews.length,
        },
        earnings: {
          totalEarnings,
          earningsThisMonth: monthlyEarnings,
          averagePerJob: avgPerJob,
        },
      });
    } catch (error) {
      console.error("[Owner Dashboard] Error fetching cleaner details:", error);
      return res.status(500).json({ error: "Failed to fetch cleaner details" });
    }
  }
);

/**
 * GET /cleaners/:cleanerId/job-history
 * Get paginated job history for a cleaner (owner only)
 */
ownerDashboardRouter.get(
  "/cleaners/:cleanerId/job-history",
  verifyOwner,
  async (req, res) => {
    try {
      const { cleanerId } = req.params;
      const { page = 1, limit = 20, status = "all" } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const cleaner = await User.findByPk(cleanerId, {
        attributes: ["id", "username"],
      });

      if (!cleaner) {
        return res.status(404).json({ error: "Cleaner not found" });
      }

      // Build where clause
      const where = {
        employeesAssigned: { [Op.contains]: [cleaner.username] },
      };

      if (status === "completed") {
        where.completed = true;
      } else if (status === "cancelled") {
        where.completed = false;
      }

      const { count, rows: appointments } = await UserAppointments.findAndCountAll({
        where,
        include: [
          {
            model: UserHomes,
            as: "home",
            attributes: ["address", "city", "state"],
          },
        ],
        order: [["date", "DESC"]],
        limit: parseInt(limit),
        offset,
      });

      // Get reviews for these appointments
      const appointmentIds = appointments.map((a) => a.id);
      const reviews = await UserReviews.findAll({
        where: {
          appointmentId: { [Op.in]: appointmentIds },
          reviewType: "homeowner_to_cleaner",
        },
        attributes: ["appointmentId", "review"],
      });

      const reviewMap = {};
      reviews.forEach((r) => {
        reviewMap[r.appointmentId] = r.review;
      });

      const jobs = appointments.map((a) => ({
        id: a.id,
        date: a.date,
        homeAddress: a.home ? safeDecrypt(a.home.address) : null,
        homeCity: a.home ? a.home.city : null,
        homeState: a.home ? a.home.state : null,
        status: a.completed ? "completed" : "incomplete",
        price: parseInt(a.price) || 0,
        rating: reviewMap[a.id] || null,
      }));

      return res.status(200).json({
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("[Owner Dashboard] Error fetching job history:", error);
      return res.status(500).json({ error: "Failed to fetch job history" });
    }
  }
);

/**
 * POST /cleaners/:cleanerId/warning
 * Issue a formal warning to a cleaner (owner only)
 */
ownerDashboardRouter.post(
  "/cleaners/:cleanerId/warning",
  verifyOwner,
  async (req, res) => {
    try {
      const { cleanerId } = req.params;
      const { reason, severity = "minor" } = req.body;

      if (!reason || reason.trim().length < 10) {
        return res
          .status(400)
          .json({ error: "A reason is required (at least 10 characters)" });
      }

      if (!["minor", "major"].includes(severity)) {
        return res
          .status(400)
          .json({ error: "Severity must be 'minor' or 'major'" });
      }

      const cleaner = await User.findByPk(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ error: "Cleaner not found" });
      }

      if (cleaner.type !== "cleaner") {
        return res.status(400).json({ error: "User is not a cleaner" });
      }

      const newWarningCount = (cleaner.warningCount || 0) + 1;

      await cleaner.update({
        warningCount: newWarningCount,
      });

      // Send notification to cleaner
      const io = req.app.get("io");
      try {
        await NotificationService.notifyUser({
          userId: parseInt(cleanerId),
          type: "warning_issued",
          title: `${severity === "major" ? "Major" : "Minor"} Warning Issued`,
          message: `You have received a ${severity} warning: ${reason.trim()}`,
          data: {
            warningCount: newWarningCount,
            severity,
            reason: reason.trim(),
            issuedAt: new Date().toISOString(),
          },
          io,
        });
      } catch (notifyErr) {
        console.error(
          "[Owner Dashboard] Error sending warning notification:",
          notifyErr
        );
      }

      console.log(
        `[Owner Dashboard] Warning issued to cleaner ${cleanerId} by owner ${req.user.id}. Severity: ${severity}. Reason: ${reason}`
      );

      return res.status(200).json({
        success: true,
        message: "Warning issued successfully",
        warningCount: newWarningCount,
      });
    } catch (error) {
      console.error("[Owner Dashboard] Error issuing warning:", error);
      return res.status(500).json({ error: "Failed to issue warning" });
    }
  }
);

module.exports = ownerDashboardRouter;
