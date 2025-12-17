import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import ManagerDashboardService from "../../services/fetchRequests/ManagerDashboardService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import TaxFormsSection from "../tax/TaxFormsSection";

const { width } = Dimensions.get("window");

// Simple Bar Chart Component
const BarChart = ({ data, maxValue, label, color = colors.primary[500] }) => {
  const chartHeight = 120;
  const barWidth = Math.max(20, (width - 100) / Math.max(data.length, 1) - 8);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartLabel}>{label}</Text>
      <View style={styles.chartArea}>
        <View style={styles.barsContainer}>
          {data.map((item, index) => {
            const barHeight =
              maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
            return (
              <View key={index} style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(barHeight, 2),
                      width: barWidth,
                      backgroundColor: color,
                    },
                  ]}
                />
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

// Stat Card Component
const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  color = colors.primary[500],
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.statCard,
      { borderLeftColor: color },
      pressed && onPress && styles.statCardPressed,
    ]}
  >
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </Pressable>
);

// Section Header Component
const SectionHeader = ({ title, onPress, actionText }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onPress && (
      <Pressable onPress={onPress}>
        <Text style={styles.sectionAction}>{actionText || "View All"}</Text>
      </Pressable>
    )}
  </View>
);

// Period Selector Component
const PeriodSelector = ({ selected, onSelect, options }) => (
  <View style={styles.periodSelector}>
    {options.map((option) => (
      <Pressable
        key={option.value}
        style={[
          styles.periodButton,
          selected === option.value && styles.periodButtonActive,
        ]}
        onPress={() => onSelect(option.value)}
      >
        <Text
          style={[
            styles.periodButtonText,
            selected === option.value && styles.periodButtonTextActive,
          ]}
        >
          {option.label}
        </Text>
      </Pressable>
    ))}
  </View>
);

const ManagerDashboard = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialData, setFinancialData] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [quickStats, setQuickStats] = useState(null);
  const [messagesSummary, setMessagesSummary] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (state.currentUser.token) {
      fetchDashboardData();
    }
  }, [state.currentUser.token]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [financial, users, stats, messages] = await Promise.all([
        ManagerDashboardService.getFinancialSummary(state.currentUser.token),
        ManagerDashboardService.getUserAnalytics(state.currentUser.token),
        ManagerDashboardService.getQuickStats(state.currentUser.token),
        ManagerDashboardService.getMessagesSummary(state.currentUser.token),
      ]);

      // Set data even if some endpoints return fallback values
      setFinancialData(financial);
      setUserAnalytics(users);
      setQuickStats(stats);
      setMessagesSummary(messages);
    } catch (err) {
      console.error("[ManagerDashboard] Error fetching data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchDashboardData(true);
  }, [state.currentUser.token]);

  const formatCurrency = (cents) => {
    if (!cents && cents !== 0) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatCurrencyShort = (cents) => {
    if (!cents && cents !== 0) return "$0";
    const dollars = cents / 100;
    if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
    return `$${dollars.toFixed(0)}`;
  };

  const getActiveUserCount = (type) => {
    if (!userAnalytics?.active) return 0;
    const data = userAnalytics.active[type];
    if (!data) return 0;
    return data[selectedPeriod] || data.allTime || 0;
  };

  const periodOptions = [
    { label: "Day", value: "day" },
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "Year", value: "year" },
    { label: "All", value: "allTime" },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchDashboardData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Prepare chart data
  const monthlyEarningsData = (financialData?.monthly || [])
    .slice(-6)
    .map((m) => ({
      label: new Date(m.month).toLocaleDateString("en-US", { month: "short" }),
      value: m.earningsCents || 0,
    }));

  const maxEarnings = Math.max(...monthlyEarningsData.map((d) => d.value), 1);

  const userGrowthData = (userAnalytics?.growth || []).slice(-6).map((m) => ({
    label: new Date(m.month).toLocaleDateString("en-US", { month: "short" }),
    value: (m.cleaners || 0) + (m.homeowners || 0),
  }));

  const maxUsers = Math.max(...userGrowthData.map((d) => d.value), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary[500]]}
          tintColor={colors.primary[500]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manager Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
      </View>

      {/* Quick Stats Row */}
      <View style={styles.quickStatsRow}>
        <StatCard
          title="Today's Jobs"
          value={quickStats?.todaysAppointments || 0}
          color={colors.primary[500]}
        />
        <StatCard
          title="New Users"
          value={quickStats?.newUsersThisWeek || 0}
          subtitle="This Week"
          color={colors.success[500]}
        />
        <StatCard
          title="Completed"
          value={quickStats?.completedThisWeek || 0}
          subtitle="This Week"
          color={colors.secondary[500]}
        />
      </View>

      {/* Financial Section */}
      <View style={styles.section}>
        <SectionHeader title="Financials" />

        {/* Earnings Cards */}
        <View style={styles.earningsGrid}>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Today</Text>
            <Text style={styles.earningsValue}>
              {formatCurrency(financialData?.current?.todayCents)}
            </Text>
          </View>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>This Week</Text>
            <Text style={styles.earningsValue}>
              {formatCurrency(financialData?.current?.weekCents)}
            </Text>
          </View>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>This Month</Text>
            <Text style={styles.earningsValue}>
              {formatCurrency(financialData?.current?.monthCents)}
            </Text>
          </View>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>This Year</Text>
            <Text style={[styles.earningsValue, styles.earningsValueHighlight]}>
              {formatCurrency(financialData?.current?.yearCents)}
            </Text>
          </View>
        </View>

        {/* Account Balance */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Pending Collection</Text>
              <Text style={styles.balanceValue}>
                {formatCurrency(financialData?.current?.pendingCents)}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View>
              <Text style={styles.balanceLabel}>Net Earnings (YTD)</Text>
              <Text
                style={[styles.balanceValue, { color: colors.success[600] }]}
              >
                {formatCurrency(financialData?.current?.yearNetCents)}
              </Text>
            </View>
          </View>
          <Text style={styles.balanceNote}>
            {financialData?.current?.transactionCount || 0} transactions this
            year
          </Text>
        </View>

        {/* Monthly Earnings Chart */}
        {monthlyEarningsData.length > 0 && (
          <BarChart
            data={monthlyEarningsData}
            maxValue={maxEarnings}
            label="Monthly Platform Earnings"
            color={colors.secondary[500]}
          />
        )}
      </View>

      {/* Messages Section */}
      <View style={styles.section}>
        <SectionHeader
          title="Messages"
          onPress={() => navigate("/messages")}
          actionText="Open Inbox"
        />
        <View style={styles.messagesCard}>
          <View style={styles.messageStats}>
            <View style={styles.messageStat}>
              <Text style={styles.messageStatValue}>
                {messagesSummary?.unreadCount || 0}
              </Text>
              <Text style={styles.messageStatLabel}>Unread</Text>
            </View>
            <View style={styles.messageStatDivider} />
            <View style={styles.messageStat}>
              <Text style={styles.messageStatValue}>
                {messagesSummary?.messagesThisWeek || 0}
              </Text>
              <Text style={styles.messageStatLabel}>This Week</Text>
            </View>
            <View style={styles.messageStatDivider} />
            <View style={styles.messageStat}>
              <Text style={styles.messageStatValue}>
                {messagesSummary?.totalMessages || 0}
              </Text>
              <Text style={styles.messageStatLabel}>Total</Text>
            </View>
          </View>

          {messagesSummary?.unreadCount > 0 && (
            <Pressable
              style={styles.messagesCTA}
              onPress={() => navigate("/messages")}
            >
              <Text style={styles.messagesCTAText}>
                You have {messagesSummary.unreadCount} unread message
                {messagesSummary.unreadCount > 1 ? "s" : ""}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* User Analytics Section */}
      <View style={styles.section}>
        <SectionHeader title="User Activity" />
        <PeriodSelector
          selected={selectedPeriod}
          onSelect={setSelectedPeriod}
          options={periodOptions}
        />

        <View style={styles.analyticsGrid}>
          <View
            style={[
              styles.analyticsCard,
              { borderLeftColor: colors.primary[500] },
            ]}
          >
            <Text style={styles.analyticsValue}>
              {getActiveUserCount("cleaners")}
            </Text>
            <Text style={styles.analyticsLabel}>Active Cleaners</Text>
            <Text style={styles.analyticsTotal}>
              of {userAnalytics?.totals?.cleaners || 0} total
            </Text>
          </View>
          <View
            style={[
              styles.analyticsCard,
              { borderLeftColor: colors.secondary[500] },
            ]}
          >
            <Text style={styles.analyticsValue}>
              {getActiveUserCount("homeowners")}
            </Text>
            <Text style={styles.analyticsLabel}>Active Homeowners</Text>
            <Text style={styles.analyticsTotal}>
              of {userAnalytics?.totals?.homeowners || 0} total
            </Text>
          </View>
          <View
            style={[
              styles.analyticsCard,
              { borderLeftColor: colors.success[500] },
            ]}
          >
            <Text style={styles.analyticsValue}>
              {getActiveUserCount("combined")}
            </Text>
            <Text style={styles.analyticsLabel}>Total Active Users</Text>
            <Text style={styles.analyticsTotal}>
              of {userAnalytics?.totals?.total || 0} total
            </Text>
          </View>
        </View>

        {/* User Growth Chart */}
        {userGrowthData.length > 0 && (
          <BarChart
            data={userGrowthData}
            maxValue={maxUsers}
            label="New User Signups"
            color={colors.primary[500]}
          />
        )}
      </View>

      {/* Platform Overview Section */}
      <View style={styles.section}>
        <SectionHeader title="Platform Overview" />
        <View style={styles.platformOverviewGrid}>
          <View
            style={[
              styles.platformOverviewCard,
              { borderLeftColor: colors.primary[500] },
            ]}
          >
            <Text style={styles.platformOverviewValue}>
              {userAnalytics?.totals?.cleaners || 0}
            </Text>
            <Text style={styles.platformOverviewLabel}>Cleaners</Text>
          </View>
          <View
            style={[
              styles.platformOverviewCard,
              { borderLeftColor: colors.secondary[500] },
            ]}
          >
            <Text style={styles.platformOverviewValue}>
              {userAnalytics?.totals?.homeowners || 0}
            </Text>
            <Text style={styles.platformOverviewLabel}>Homeowners</Text>
          </View>
          <View
            style={[
              styles.platformOverviewCard,
              { borderLeftColor: colors.success[500] },
            ]}
          >
            <Text style={styles.platformOverviewValue}>
              {userAnalytics?.totals?.homes || 0}
            </Text>
            <Text style={styles.platformOverviewLabel}>Homes</Text>
          </View>
        </View>

        {/* Applications Overview */}
        <View style={styles.applicationsSection}>
          <Text style={styles.applicationsSectionTitle}>Applications</Text>
          <View style={styles.applicationsGrid}>
            <View style={styles.applicationCard}>
              <Text style={styles.applicationValue}>
                {userAnalytics?.applications?.total || 0}
              </Text>
              <Text style={styles.applicationLabel}>Total</Text>
            </View>
            <View style={[styles.applicationCard, { backgroundColor: colors.warning[50] }]}>
              <Text style={[styles.applicationValue, { color: colors.warning[700] }]}>
                {userAnalytics?.applications?.pending || 0}
              </Text>
              <Text style={[styles.applicationLabel, { color: colors.warning[600] }]}>Pending</Text>
            </View>
            <View style={[styles.applicationCard, { backgroundColor: colors.success[50] }]}>
              <Text style={[styles.applicationValue, { color: colors.success[700] }]}>
                {userAnalytics?.applications?.approved || 0}
              </Text>
              <Text style={[styles.applicationLabel, { color: colors.success[600] }]}>Approved</Text>
            </View>
            <View style={[styles.applicationCard, { backgroundColor: colors.error[50] }]}>
              <Text style={[styles.applicationValue, { color: colors.error[700] }]}>
                {userAnalytics?.applications?.rejected || 0}
              </Text>
              <Text style={[styles.applicationLabel, { color: colors.error[600] }]}>Rejected</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tax Section */}
      <TaxFormsSection state={state} />

      {/* Footer Spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    paddingTop: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
    padding: spacing.xl,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Platform Overview
  platformOverviewGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  platformOverviewCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    alignItems: "center",
  },
  platformOverviewValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  platformOverviewLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Applications Section
  applicationsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  applicationsSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  applicationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  applicationCard: {
    flex: 1,
    minWidth: 70,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  applicationValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  applicationLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Quick Stats
  quickStatsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  statCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statTitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Section
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionAction: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Earnings Grid
  earningsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  earningsCard: {
    flex: 1,
    minWidth: (width - 80) / 2 - spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  earningsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  earningsValueHighlight: {
    color: colors.secondary[600],
  },

  // Balance Card
  balanceCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.primary[200],
  },
  balanceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    textAlign: "center",
  },
  balanceValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[800],
    textAlign: "center",
    marginTop: 4,
  },
  balanceNote: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    textAlign: "center",
    marginTop: spacing.md,
  },

  // Chart
  chartContainer: {
    marginTop: spacing.md,
  },
  chartLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  chartArea: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 140,
  },
  barWrapper: {
    alignItems: "center",
  },
  bar: {
    borderRadius: radius.sm,
    minHeight: 2,
  },
  barLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Messages
  messagesCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  messageStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  messageStat: {
    alignItems: "center",
    flex: 1,
  },
  messageStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  messageStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  messageStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.light,
  },
  messagesCTA: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  messagesCTAText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },

  // Period Selector
  periodSelector: {
    flexDirection: "row",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: colors.primary[500],
  },
  periodButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  periodButtonTextActive: {
    color: colors.neutral[0],
  },

  // Analytics
  analyticsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  analyticsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  analyticsValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  analyticsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
    marginLeft: spacing.md,
  },
  analyticsTotal: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});

export default ManagerDashboard;
