/**
 * AnalyticsService
 *
 * Provides methods for tracking and aggregating internal analytics events.
 * Tracks: flow abandonment, job duration, offline usage, disputes, pay overrides
 */

const { AnalyticsEvent, UserAppointments } = require("../models");
const { Op, fn, col, literal } = require("sequelize");

class AnalyticsService {
  // ============================================================================
  // EVENT TRACKING METHODS
  // ============================================================================

  /**
   * Track a generic analytics event
   */
  static async trackEvent(eventType, eventCategory, userId = null, metadata = {}, sessionId = null) {
    try {
      const now = new Date();
      return await AnalyticsEvent.create({
        eventType,
        eventCategory,
        userId,
        sessionId,
        metadata,
        dateOnly: now.toISOString().split("T")[0],
        hourOfDay: now.getHours(),
      });
    } catch (error) {
      console.error("[Analytics] Error tracking event:", error);
      // Don't throw - analytics should never break the main flow
      return null;
    }
  }

  // --- Flow Tracking ---

  static async trackFlowStart(flowName, userId = null, sessionId) {
    return this.trackEvent("flow_started", "flow_abandonment", userId, {
      flowName,
      stepNumber: 0,
      stepName: "start",
    }, sessionId);
  }

  static async trackFlowStep(flowName, stepName, stepNumber, totalSteps, userId = null, sessionId) {
    return this.trackEvent("flow_step_completed", "flow_abandonment", userId, {
      flowName,
      stepName,
      stepNumber,
      totalSteps,
    }, sessionId);
  }

  static async trackFlowAbandon(flowName, lastStepName, lastStepNumber, totalSteps, userId = null, sessionId) {
    return this.trackEvent("flow_abandoned", "flow_abandonment", userId, {
      flowName,
      lastStepName,
      lastStepNumber,
      totalSteps,
      abandonedAt: new Date().toISOString(),
    }, sessionId);
  }

  static async trackFlowComplete(flowName, userId = null, sessionId) {
    return this.trackEvent("flow_completed", "flow_abandonment", userId, {
      flowName,
      completedAt: new Date().toISOString(),
    }, sessionId);
  }

  // --- Job Duration Tracking ---

  static async trackJobStarted(appointmentId, cleanerId) {
    return this.trackEvent("job_started", "job_duration", cleanerId, {
      appointmentId,
      startedAt: new Date().toISOString(),
    });
  }

  static async trackJobCompleted(appointmentId, cleanerId, durationMinutes, jobType = null) {
    return this.trackEvent("job_completed", "job_duration", cleanerId, {
      appointmentId,
      durationMinutes,
      jobType,
      completedAt: new Date().toISOString(),
    });
  }

  // --- Offline Usage Tracking ---

  static async trackOfflineSessionStarted(userId) {
    return this.trackEvent("offline_session_started", "offline_usage", userId, {
      startedAt: new Date().toISOString(),
    });
  }

  static async trackOfflineSessionSynced(userId, syncDurationMs, pendingItemCount) {
    return this.trackEvent("offline_session_synced", "offline_usage", userId, {
      syncDurationMs,
      pendingItemCount,
      syncedAt: new Date().toISOString(),
    });
  }

  // --- Dispute Tracking ---

  static async trackDisputeCreated(disputeType, appointmentId, userId) {
    return this.trackEvent("dispute_created", "disputes", userId, {
      disputeType,
      appointmentId,
      createdAt: new Date().toISOString(),
    });
  }

  static async trackDisputeResolved(disputeType, appointmentId, resolution, userId) {
    return this.trackEvent("dispute_resolved", "disputes", userId, {
      disputeType,
      appointmentId,
      resolution,
      resolvedAt: new Date().toISOString(),
    });
  }

  // --- Pay Override Tracking ---

  static async trackPayOverride(appointmentId, cleanerId, originalAmountCents, newAmountCents, reason, overrideByUserId) {
    return this.trackEvent("pay_override_applied", "pay_override", overrideByUserId, {
      appointmentId,
      cleanerId,
      originalAmountCents,
      newAmountCents,
      adjustmentCents: newAmountCents - originalAmountCents,
      reason,
    });
  }

  // ============================================================================
  // AGGREGATION METHODS
  // ============================================================================

  /**
   * Get flow abandonment statistics
   */
  static async getFlowAbandonmentStats(flowName = null, startDate, endDate) {
    const whereClause = {
      eventCategory: "flow_abandonment",
      dateOnly: { [Op.between]: [startDate, endDate] },
    };

    if (flowName) {
      whereClause.metadata = { flowName };
    }

    // Get all flow events
    const events = await AnalyticsEvent.findAll({
      where: whereClause,
      attributes: ["eventType", "metadata", "sessionId"],
      raw: true,
    });

    // Group by flow name
    const flowStats = {};
    const sessionFlows = {}; // Track each session's progress

    for (const event of events) {
      const name = event.metadata?.flowName || "unknown";
      const sessionId = event.sessionId;

      if (!flowStats[name]) {
        flowStats[name] = {
          started: 0,
          completed: 0,
          abandoned: 0,
          stepDropoffs: {},
        };
      }

      if (!sessionFlows[sessionId]) {
        sessionFlows[sessionId] = { flowName: name, events: [] };
      }
      sessionFlows[sessionId].events.push(event);

      if (event.eventType === "flow_started") {
        flowStats[name].started++;
      } else if (event.eventType === "flow_completed") {
        flowStats[name].completed++;
      } else if (event.eventType === "flow_abandoned") {
        flowStats[name].abandoned++;
        const stepName = event.metadata?.lastStepName || "unknown";
        flowStats[name].stepDropoffs[stepName] = (flowStats[name].stepDropoffs[stepName] || 0) + 1;
      }
    }

    // Calculate rates
    for (const name of Object.keys(flowStats)) {
      const stats = flowStats[name];
      stats.completionRate = stats.started > 0 ? (stats.completed / stats.started * 100).toFixed(1) : 0;
      stats.abandonmentRate = stats.started > 0 ? (stats.abandoned / stats.started * 100).toFixed(1) : 0;
    }

    return flowStats;
  }

  /**
   * Get job duration statistics
   */
  static async getJobDurationStats(startDate, endDate) {
    const events = await AnalyticsEvent.findAll({
      where: {
        eventType: "job_completed",
        eventCategory: "job_duration",
        dateOnly: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["metadata"],
      raw: true,
    });

    const durations = events
      .map(e => e.metadata?.durationMinutes)
      .filter(d => d !== null && d !== undefined && !isNaN(d));

    if (durations.length === 0) {
      return {
        count: 0,
        avgMinutes: 0,
        minMinutes: 0,
        maxMinutes: 0,
        medianMinutes: 0,
        percentile90: 0,
      };
    }

    durations.sort((a, b) => a - b);

    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const median = durations[Math.floor(durations.length / 2)];
    const p90Index = Math.floor(durations.length * 0.9);
    const percentile90 = durations[p90Index] || durations[durations.length - 1];

    return {
      count: durations.length,
      avgMinutes: Math.round(avg),
      minMinutes: durations[0],
      maxMinutes: durations[durations.length - 1],
      medianMinutes: median,
      percentile90: percentile90,
    };
  }

  /**
   * Get offline usage statistics
   */
  static async getOfflineUsageStats(startDate, endDate) {
    const [startedEvents, syncedEvents] = await Promise.all([
      AnalyticsEvent.count({
        where: {
          eventType: "offline_session_started",
          dateOnly: { [Op.between]: [startDate, endDate] },
        },
      }),
      AnalyticsEvent.findAll({
        where: {
          eventType: "offline_session_synced",
          dateOnly: { [Op.between]: [startDate, endDate] },
        },
        attributes: ["metadata"],
        raw: true,
      }),
    ]);

    const syncDurations = syncedEvents
      .map(e => e.metadata?.syncDurationMs)
      .filter(d => d !== null && d !== undefined);

    const itemCounts = syncedEvents
      .map(e => e.metadata?.pendingItemCount)
      .filter(c => c !== null && c !== undefined);

    const avgSyncDuration = syncDurations.length > 0
      ? Math.round(syncDurations.reduce((a, b) => a + b, 0) / syncDurations.length)
      : 0;

    const avgItemCount = itemCounts.length > 0
      ? Math.round(itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length)
      : 0;

    return {
      offlineSessionsStarted: startedEvents,
      offlineSessionsSynced: syncedEvents.length,
      avgSyncDurationMs: avgSyncDuration,
      avgPendingItemCount: avgItemCount,
      syncSuccessRate: startedEvents > 0
        ? ((syncedEvents.length / startedEvents) * 100).toFixed(1)
        : 0,
    };
  }

  /**
   * Get dispute statistics
   */
  static async getDisputeStats(startDate, endDate) {
    const events = await AnalyticsEvent.findAll({
      where: {
        eventCategory: "disputes",
        dateOnly: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["eventType", "metadata"],
      raw: true,
    });

    const created = events.filter(e => e.eventType === "dispute_created");
    const resolved = events.filter(e => e.eventType === "dispute_resolved");

    // Group by dispute type
    const byType = {};
    for (const event of created) {
      const type = event.metadata?.disputeType || "unknown";
      byType[type] = (byType[type] || 0) + 1;
    }

    // Resolution breakdown
    const resolutions = {};
    for (const event of resolved) {
      const resolution = event.metadata?.resolution || "unknown";
      resolutions[resolution] = (resolutions[resolution] || 0) + 1;
    }

    // Get total jobs in period for rate calculation
    const totalJobs = await UserAppointments.count({
      where: {
        date: { [Op.between]: [startDate, endDate] },
        completed: true,
      },
    });

    return {
      totalCreated: created.length,
      totalResolved: resolved.length,
      byType,
      resolutions,
      disputesPer100Jobs: totalJobs > 0
        ? ((created.length / totalJobs) * 100).toFixed(2)
        : 0,
      resolutionRate: created.length > 0
        ? ((resolved.length / created.length) * 100).toFixed(1)
        : 0,
    };
  }

  /**
   * Get pay override statistics
   */
  static async getPayOverrideStats(startDate, endDate) {
    const events = await AnalyticsEvent.findAll({
      where: {
        eventType: "pay_override_applied",
        dateOnly: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["metadata", "createdAt"],
      raw: true,
    });

    const adjustments = events
      .map(e => e.metadata?.adjustmentCents || 0)
      .filter(a => !isNaN(a));

    const totalAdjustmentCents = adjustments.reduce((a, b) => a + b, 0);
    const avgAdjustmentCents = adjustments.length > 0
      ? Math.round(totalAdjustmentCents / adjustments.length)
      : 0;

    // Group by reason
    const byReason = {};
    for (const event of events) {
      const reason = event.metadata?.reason || "unspecified";
      byReason[reason] = (byReason[reason] || 0) + 1;
    }

    // Get total jobs for rate
    const totalJobs = await UserAppointments.count({
      where: {
        date: { [Op.between]: [startDate, endDate] },
        completed: true,
      },
    });

    return {
      totalOverrides: events.length,
      totalAdjustmentCents,
      totalAdjustmentDollars: (totalAdjustmentCents / 100).toFixed(2),
      avgAdjustmentCents,
      avgAdjustmentDollars: (avgAdjustmentCents / 100).toFixed(2),
      byReason,
      overridesPer100Jobs: totalJobs > 0
        ? ((events.length / totalJobs) * 100).toFixed(2)
        : 0,
    };
  }

  /**
   * Get combined dashboard data
   */
  static async getDashboardStats(startDate, endDate) {
    const [flowStats, jobDuration, offlineUsage, disputes, payOverrides] = await Promise.all([
      this.getFlowAbandonmentStats(null, startDate, endDate),
      this.getJobDurationStats(startDate, endDate),
      this.getOfflineUsageStats(startDate, endDate),
      this.getDisputeStats(startDate, endDate),
      this.getPayOverrideStats(startDate, endDate),
    ]);

    return {
      period: { startDate, endDate },
      flowAbandonment: flowStats,
      jobDuration,
      offlineUsage,
      disputes,
      payOverrides,
    };
  }

  // ============================================================================
  // DAILY TREND DATA
  // ============================================================================

  /**
   * Get daily trend for a metric category
   */
  static async getDailyTrend(eventCategory, startDate, endDate) {
    const events = await AnalyticsEvent.findAll({
      where: {
        eventCategory,
        dateOnly: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        "dateOnly",
        [fn("COUNT", col("id")), "count"],
      ],
      group: ["dateOnly"],
      order: [["dateOnly", "ASC"]],
      raw: true,
    });

    return events.map(e => ({
      date: e.dateOnly,
      count: parseInt(e.count, 10),
    }));
  }
}

module.exports = AnalyticsService;
