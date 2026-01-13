import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import AnalyticsService from "../../services/AnalyticsService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const { width } = Dimensions.get("window");

const InternalAnalytics = ({ authToken }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dateRange, setDateRange] = useState("30d");

  const getDateRange = (range) => {
    const end = new Date();
    let start;
    switch (range) {
      case "7d":
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const { startDate, endDate } = getDateRange(dateRange);
      const data = await AnalyticsService.fetchDashboardStats(authToken, startDate, endDate);
      setDashboardData(data);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderDateRangeSelector = () => (
    <View style={styles.dateRangeContainer}>
      {["7d", "30d", "90d"].map((range) => (
        <TouchableOpacity
          key={range}
          style={[
            styles.dateRangeButton,
            dateRange === range && styles.dateRangeButtonActive,
          ]}
          onPress={() => setDateRange(range)}
        >
          <Text
            style={[
              styles.dateRangeText,
              dateRange === range && styles.dateRangeTextActive,
            ]}
          >
            {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMetricCard = (title, value, subtitle, icon, color = colors.primary[500]) => (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconContainer, { backgroundColor: color + "20" }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderFlowAbandonmentSection = () => {
    const flowStats = dashboardData?.flowAbandonment || {};
    const flows = Object.keys(flowStats);

    if (flows.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>No flow data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Flow Abandonment</Text>
        {flows.map((flowName) => {
          const stats = flowStats[flowName];
          return (
            <View key={flowName} style={styles.flowRow}>
              <Text style={styles.flowName}>{flowName.replace(/_/g, " ")}</Text>
              <View style={styles.flowStats}>
                <Text style={styles.flowStat}>
                  Started: {stats.started}
                </Text>
                <Text style={[styles.flowStat, { color: colors.semantic.success }]}>
                  Completed: {stats.completed} ({stats.completionRate}%)
                </Text>
                <Text style={[styles.flowStat, { color: colors.semantic.error }]}>
                  Abandoned: {stats.abandoned} ({stats.abandonmentRate}%)
                </Text>
              </View>
              {Object.keys(stats.stepDropoffs || {}).length > 0 && (
                <View style={styles.dropoffsContainer}>
                  <Text style={styles.dropoffsTitle}>Drop-off points:</Text>
                  {Object.entries(stats.stepDropoffs).map(([step, count]) => (
                    <Text key={step} style={styles.dropoffItem}>
                      {step}: {count}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderJobDurationSection = () => {
    const stats = dashboardData?.jobDuration || {};

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Duration</Text>
        <View style={styles.metricsRow}>
          {renderMetricCard("Jobs Completed", stats.count || 0, null, "check-circle", colors.semantic.success)}
          {renderMetricCard("Avg Duration", `${stats.avgMinutes || 0} min`, null, "clock-o", colors.primary[500])}
          {renderMetricCard("90th Percentile", `${stats.percentile90 || 0} min`, null, "bar-chart", colors.semantic.warning)}
        </View>
        <View style={styles.durationDetails}>
          <Text style={styles.detailText}>Min: {stats.minMinutes || 0} min</Text>
          <Text style={styles.detailText}>Median: {stats.medianMinutes || 0} min</Text>
          <Text style={styles.detailText}>Max: {stats.maxMinutes || 0} min</Text>
        </View>
      </View>
    );
  };

  const renderOfflineUsageSection = () => {
    const stats = dashboardData?.offlineUsage || {};

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Offline Usage</Text>
        <View style={styles.metricsRow}>
          {renderMetricCard("Sessions Started", stats.offlineSessionsStarted || 0, null, "wifi", colors.neutral[500])}
          {renderMetricCard("Sessions Synced", stats.offlineSessionsSynced || 0, null, "refresh", colors.semantic.success)}
          {renderMetricCard("Sync Rate", `${stats.syncSuccessRate || 0}%`, null, "signal", colors.primary[500])}
        </View>
        <View style={styles.durationDetails}>
          <Text style={styles.detailText}>Avg Sync Time: {stats.avgSyncDurationMs || 0} ms</Text>
          <Text style={styles.detailText}>Avg Items Synced: {stats.avgPendingItemCount || 0}</Text>
        </View>
      </View>
    );
  };

  const renderDisputesSection = () => {
    const stats = dashboardData?.disputes || {};

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disputes</Text>
        <View style={styles.metricsRow}>
          {renderMetricCard("Total Created", stats.totalCreated || 0, null, "exclamation-triangle", colors.semantic.warning)}
          {renderMetricCard("Total Resolved", stats.totalResolved || 0, null, "check", colors.semantic.success)}
          {renderMetricCard("Per 100 Jobs", stats.disputesPer100Jobs || "0.00", null, "percent", colors.semantic.info)}
        </View>
        {Object.keys(stats.byType || {}).length > 0 && (
          <View style={styles.breakdownContainer}>
            <Text style={styles.breakdownTitle}>By Type:</Text>
            {Object.entries(stats.byType).map(([type, count]) => (
              <Text key={type} style={styles.breakdownItem}>
                {type}: {count}
              </Text>
            ))}
          </View>
        )}
        {Object.keys(stats.resolutions || {}).length > 0 && (
          <View style={styles.breakdownContainer}>
            <Text style={styles.breakdownTitle}>Resolutions:</Text>
            {Object.entries(stats.resolutions).map(([resolution, count]) => (
              <Text key={resolution} style={styles.breakdownItem}>
                {resolution}: {count}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPayOverridesSection = () => {
    const stats = dashboardData?.payOverrides || {};

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pay Overrides</Text>
        <View style={styles.metricsRow}>
          {renderMetricCard("Total Overrides", stats.totalOverrides || 0, null, "edit", colors.semantic.warning)}
          {renderMetricCard("Total Adjustment", `$${stats.totalAdjustmentDollars || "0.00"}`, null, "dollar", colors.primary[500])}
          {renderMetricCard("Per 100 Jobs", stats.overridesPer100Jobs || "0.00", null, "percent", colors.semantic.info)}
        </View>
        <View style={styles.durationDetails}>
          <Text style={styles.detailText}>Avg Adjustment: ${stats.avgAdjustmentDollars || "0.00"}</Text>
        </View>
        {Object.keys(stats.byReason || {}).length > 0 && (
          <View style={styles.breakdownContainer}>
            <Text style={styles.breakdownTitle}>By Reason:</Text>
            {Object.entries(stats.byReason).map(([reason, count]) => (
              <Text key={reason} style={styles.breakdownItem}>
                {reason}: {count}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={40} color={colors.semantic.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Internal Analytics</Text>
        <Text style={styles.headerSubtitle}>
          {dashboardData?.period?.startDate} to {dashboardData?.period?.endDate}
        </Text>
      </View>

      {renderDateRangeSelector()}
      {renderFlowAbandonmentSection()}
      {renderJobDurationSection()}
      {renderOfflineUsageSection()}
      {renderDisputesSection()}
      {renderPayOverridesSection()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    color: colors.neutral[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    color: colors.semantic.error,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[500],
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  dateRangeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  dateRangeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  dateRangeButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  dateRangeText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  dateRangeTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  emptySection: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    color: colors.neutral[500],
    fontSize: typography.fontSize.md,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: (width - spacing.md * 4) / 3,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
  },
  metricTitle: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[600],
    textAlign: "center",
    marginTop: spacing.xs,
  },
  metricSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    textAlign: "center",
  },
  flowRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    paddingVertical: spacing.sm,
  },
  flowName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[900],
    textTransform: "capitalize",
    marginBottom: spacing.xs,
  },
  flowStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  flowStat: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  dropoffsContainer: {
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
  },
  dropoffsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
  },
  dropoffItem: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    paddingLeft: spacing.sm,
  },
  durationDetails: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  breakdownContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  breakdownTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  breakdownItem: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    paddingLeft: spacing.sm,
  },
});

export default InternalAnalytics;
