/**
 * Analytics Router
 * Provides internal analytics endpoints for the owner dashboard
 * Tracks: flow abandonment, job duration, offline usage, disputes, pay overrides
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { User } = require("../../../models");
const AnalyticsService = require("../../../services/AnalyticsService");

const analyticsRouter = express.Router();
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

// Helper to parse date range from query params
const parseDateRange = (req) => {
  const { startDate, endDate } = req.query;

  // Default to last 30 days if not specified
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
};

/**
 * POST /track
 * Record analytics event from frontend
 * Body: { eventType, eventCategory, metadata, sessionId }
 */
analyticsRouter.post("/track", async (req, res) => {
  try {
    const { eventType, eventCategory, metadata = {}, sessionId } = req.body;

    if (!eventType || !eventCategory) {
      return res.status(400).json({ error: "eventType and eventCategory are required" });
    }

    // Try to get userId from auth header if present
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, secretKey);
        userId = decoded.userId;
      } catch (err) {
        // Ignore auth errors for tracking - allow anonymous events
      }
    }

    const event = await AnalyticsService.trackEvent(
      eventType,
      eventCategory,
      userId,
      metadata,
      sessionId
    );

    res.status(201).json({ success: true, eventId: event?.id || null });
  } catch (error) {
    console.error("[Analytics] Track error:", error);
    // Don't fail requests due to analytics errors
    res.status(201).json({ success: true, eventId: null });
  }
});

/**
 * GET /flow-abandonment
 * Get flow abandonment statistics
 * Query: startDate, endDate, flowName (optional)
 */
analyticsRouter.get("/flow-abandonment", verifyOwner, async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const { flowName } = req.query;

    const stats = await AnalyticsService.getFlowAbandonmentStats(
      flowName || null,
      startDate,
      endDate
    );

    res.json({
      period: { startDate, endDate },
      flowName: flowName || "all",
      stats,
    });
  } catch (error) {
    console.error("[Analytics] Flow abandonment error:", error);
    res.status(500).json({ error: "Failed to fetch flow abandonment stats" });
  }
});

/**
 * GET /job-duration
 * Get job duration statistics
 * Query: startDate, endDate
 */
analyticsRouter.get("/job-duration", verifyOwner, async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);

    const stats = await AnalyticsService.getJobDurationStats(startDate, endDate);

    res.json({
      period: { startDate, endDate },
      stats,
    });
  } catch (error) {
    console.error("[Analytics] Job duration error:", error);
    res.status(500).json({ error: "Failed to fetch job duration stats" });
  }
});

/**
 * GET /offline-usage
 * Get offline mode usage statistics
 * Query: startDate, endDate
 */
analyticsRouter.get("/offline-usage", verifyOwner, async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);

    const stats = await AnalyticsService.getOfflineUsageStats(startDate, endDate);

    res.json({
      period: { startDate, endDate },
      stats,
    });
  } catch (error) {
    console.error("[Analytics] Offline usage error:", error);
    res.status(500).json({ error: "Failed to fetch offline usage stats" });
  }
});

/**
 * GET /disputes
 * Get dispute frequency statistics
 * Query: startDate, endDate
 */
analyticsRouter.get("/disputes", verifyOwner, async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);

    const stats = await AnalyticsService.getDisputeStats(startDate, endDate);

    res.json({
      period: { startDate, endDate },
      stats,
    });
  } catch (error) {
    console.error("[Analytics] Disputes error:", error);
    res.status(500).json({ error: "Failed to fetch dispute stats" });
  }
});

/**
 * GET /pay-overrides
 * Get pay override statistics
 * Query: startDate, endDate
 */
analyticsRouter.get("/pay-overrides", verifyOwner, async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);

    const stats = await AnalyticsService.getPayOverrideStats(startDate, endDate);

    res.json({
      period: { startDate, endDate },
      stats,
    });
  } catch (error) {
    console.error("[Analytics] Pay overrides error:", error);
    res.status(500).json({ error: "Failed to fetch pay override stats" });
  }
});

/**
 * GET /dashboard
 * Get combined dashboard data for all analytics metrics
 * Query: startDate, endDate
 */
analyticsRouter.get("/dashboard", verifyOwner, async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);

    const dashboardData = await AnalyticsService.getDashboardStats(startDate, endDate);

    res.json(dashboardData);
  } catch (error) {
    console.error("[Analytics] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

/**
 * GET /trend/:category
 * Get daily trend data for a specific category
 * Params: category (flow_abandonment, job_duration, offline_usage, disputes, pay_override)
 * Query: startDate, endDate
 */
analyticsRouter.get("/trend/:category", verifyOwner, async (req, res) => {
  try {
    const { category } = req.params;
    const validCategories = ["flow_abandonment", "job_duration", "offline_usage", "disputes", "pay_override"];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(", ")}`
      });
    }

    const { startDate, endDate } = parseDateRange(req);

    const trend = await AnalyticsService.getDailyTrend(category, startDate, endDate);

    res.json({
      period: { startDate, endDate },
      category,
      trend,
    });
  } catch (error) {
    console.error("[Analytics] Trend error:", error);
    res.status(500).json({ error: "Failed to fetch trend data" });
  }
});

module.exports = analyticsRouter;
