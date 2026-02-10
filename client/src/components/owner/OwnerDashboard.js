import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import OwnerDashboardService from "../../services/fetchRequests/OwnerDashboardService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import TaxFormsSection from "../tax/TaxFormsSection";
import { ConflictsStatsWidget } from "../conflicts";
import { PreviewRoleModal } from "../preview";
import { usePreview } from "../../context/PreviewContext";
import CreateSupportTicketModal from "../conflicts/modals/CreateSupportTicketModal";

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

const OwnerDashboard = ({ state }) => {
  const navigate = useNavigate();
  const { enterPreviewMode, isLoading: previewLoading, error: previewError } = usePreview();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialData, setFinancialData] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [quickStats, setQuickStats] = useState(null);
  const [messagesSummary, setMessagesSummary] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [error, setError] = useState(null);
  const [serviceAreaData, setServiceAreaData] = useState(null);
  const [appUsageData, setAppUsageData] = useState(null);
  const [businessMetrics, setBusinessMetrics] = useState(null);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckResult, setRecheckResult] = useState(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);

  const handleSelectPreviewRole = async (role) => {
    const success = await enterPreviewMode(role);
    if (success) {
      setPreviewModalVisible(false);
    }
  };

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
      const [financial, users, stats, messages, serviceAreas, appUsage, bizMetrics] = await Promise.all([
        OwnerDashboardService.getFinancialSummary(state.currentUser.token),
        OwnerDashboardService.getUserAnalytics(state.currentUser.token),
        OwnerDashboardService.getQuickStats(state.currentUser.token),
        OwnerDashboardService.getMessagesSummary(state.currentUser.token),
        OwnerDashboardService.getServiceAreas(state.currentUser.token),
        OwnerDashboardService.getAppUsageAnalytics(state.currentUser.token),
        OwnerDashboardService.getBusinessMetrics(state.currentUser.token),
      ]);

      // Set data even if some endpoints return fallback values
      setFinancialData(financial);
      setUserAnalytics(users);
      setQuickStats(stats);
      setMessagesSummary(messages);
      setServiceAreaData(serviceAreas);
      setAppUsageData(appUsage);
      setBusinessMetrics(bizMetrics);
    } catch (err) {
      console.error("[OwnerDashboard] Error fetching data:", err);
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

  const handleRecheckServiceAreas = async () => {
    setRecheckLoading(true);
    setRecheckResult(null);
    try {
      const result = await OwnerDashboardService.recheckServiceAreas(state.currentUser.token);
      setRecheckResult(result);
      // Refresh service area data after recheck
      const updatedServiceAreas = await OwnerDashboardService.getServiceAreas(state.currentUser.token);
      setServiceAreaData(updatedServiceAreas);
    } catch (err) {
      setRecheckResult({ success: false, error: "Failed to recheck service areas" });
    } finally {
      setRecheckLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>Owner Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
      </View>

      {/* Preview as Role Section */}
      <Pressable
        style={({ pressed }) => [
          styles.previewAsRoleCard,
          pressed && styles.previewAsRoleCardPressed,
        ]}
        onPress={() => setPreviewModalVisible(true)}
      >
        <View style={styles.previewAsRoleIcon}>
          <Icon name="eye" size={20} color={colors.primary[600]} />
        </View>
        <View style={styles.previewAsRoleContent}>
          <Text style={styles.previewAsRoleTitle}>Preview as Role</Text>
          <Text style={styles.previewAsRoleDescription}>
            Experience the app as a cleaner, homeowner, or employee
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.text.tertiary} />
      </Pressable>

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

      {/* Conflict Resolution Widget */}
      <View style={styles.section}>
        <ConflictsStatsWidget onNavigateToConflicts={() => navigate("/conflicts")} />
      </View>

      {/* Create Support Ticket */}
      <Pressable
        style={({ pressed }) => [
          styles.createTicketCard,
          pressed && styles.createTicketCardPressed,
        ]}
        onPress={() => setShowCreateTicketModal(true)}
      >
        <View style={styles.createTicketIcon}>
          <Icon name="flag" size={20} color={colors.error[600]} />
        </View>
        <View style={styles.createTicketContent}>
          <Text style={styles.createTicketTitle}>Create Support Ticket</Text>
          <Text style={styles.createTicketDescription}>
            Report issues or escalate conflicts
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.text.tertiary} />
      </Pressable>

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

      {/* Business Metrics Section */}
      <View style={styles.section}>
        <SectionHeader title="Business Metrics" />

        {/* Cost Per Booking */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Cost Per Booking</Text>
          <View style={styles.businessMetricRow}>
            <View style={[styles.businessMetricCard, styles.businessMetricCardHighlight]}>
              <Text style={styles.businessMetricLabel}>Avg Platform Fee</Text>
              <Text style={styles.businessMetricValue}>
                {formatCurrency(businessMetrics?.costPerBooking?.avgFeeCents)}
              </Text>
            </View>
            <View style={styles.businessMetricCard}>
              <Text style={styles.businessMetricLabel}>Total Earned</Text>
              <Text style={styles.businessMetricValue}>
                {formatCurrencyShort(businessMetrics?.costPerBooking?.totalFeeCents)}
              </Text>
            </View>
            <View style={styles.businessMetricCard}>
              <Text style={styles.businessMetricLabel}>Bookings</Text>
              <Text style={styles.businessMetricValue}>
                {businessMetrics?.costPerBooking?.bookingCount || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Repeat Booking Rate */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Repeat Booking Rate</Text>
          <View style={styles.businessMetricRow}>
            <View style={[styles.businessMetricCard, styles.businessMetricCardLarge]}>
              <Text style={styles.businessMetricValueLarge}>
                {businessMetrics?.repeatBookingRate?.rate || 0}%
              </Text>
              <Text style={styles.businessMetricLabel}>Repeat Customers</Text>
            </View>
            <View style={styles.businessMetricCardStack}>
              <View style={styles.businessMetricMini}>
                <Text style={styles.businessMetricMiniValue}>
                  {businessMetrics?.repeatBookingRate?.repeatBookers || 0}
                </Text>
                <Text style={styles.businessMetricMiniLabel}>Repeat</Text>
              </View>
              <View style={styles.businessMetricMini}>
                <Text style={styles.businessMetricMiniValue}>
                  {businessMetrics?.repeatBookingRate?.singleBookers || 0}
                </Text>
                <Text style={styles.businessMetricMiniLabel}>Single</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Subscription Rate (Frequent Bookers) */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Customer Loyalty</Text>
          <View style={styles.businessMetricRow}>
            <View style={[styles.loyaltyCard, { backgroundColor: colors.success[50] }]}>
              <Text style={[styles.loyaltyValue, { color: colors.success[700] }]}>
                {businessMetrics?.subscriptionRate?.frequentBookers || 0}
              </Text>
              <Text style={[styles.loyaltyLabel, { color: colors.success[600] }]}>
                Loyal (5+)
              </Text>
            </View>
            <View style={[styles.loyaltyCard, { backgroundColor: colors.primary[50] }]}>
              <Text style={[styles.loyaltyValue, { color: colors.primary[700] }]}>
                {businessMetrics?.subscriptionRate?.regularBookers || 0}
              </Text>
              <Text style={[styles.loyaltyLabel, { color: colors.primary[600] }]}>
                Regular (3-4)
              </Text>
            </View>
            <View style={[styles.loyaltyCard, { backgroundColor: colors.neutral[100] }]}>
              <Text style={styles.loyaltyValue}>
                {businessMetrics?.subscriptionRate?.occasionalBookers || 0}
              </Text>
              <Text style={styles.loyaltyLabel}>
                Occasional (1-2)
              </Text>
            </View>
          </View>
          <View style={styles.loyaltyRateContainer}>
            <Text style={styles.loyaltyRateText}>
              {businessMetrics?.subscriptionRate?.rate || 0}% of customers are loyal (5+ bookings)
            </Text>
          </View>
        </View>

        {/* Churn / Cancellations */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Churn (Cancellations)</Text>
          <View style={styles.churnContainer}>
            <View style={styles.churnSection}>
              <Text style={styles.churnSectionTitle}>Homeowner Cancellations</Text>
              <View style={styles.churnRow}>
                <View style={styles.churnCard}>
                  <Text style={styles.churnValue}>
                    {businessMetrics?.churn?.homeownerCancellations?.usersWithCancellations || 0}
                  </Text>
                  <Text style={styles.churnLabel}>Users w/ Fees</Text>
                </View>
                <View style={styles.churnCard}>
                  <Text style={styles.churnValue}>
                    {formatCurrency(businessMetrics?.churn?.homeownerCancellations?.totalFeeCents)}
                  </Text>
                  <Text style={styles.churnLabel}>Total Fees</Text>
                </View>
              </View>
            </View>
            <View style={[styles.churnSection, { marginTop: spacing.md }]}>
              <Text style={styles.churnSectionTitle}>Cleaner Cancellations (Penalties)</Text>
              <View style={styles.churnRow}>
                <View style={[styles.churnCard, { backgroundColor: colors.error[50] }]}>
                  <Text style={[styles.churnValue, { color: colors.error[700] }]}>
                    {businessMetrics?.churn?.cleanerCancellations?.last30Days || 0}
                  </Text>
                  <Text style={[styles.churnLabel, { color: colors.error[600] }]}>Last 30 Days</Text>
                </View>
                <View style={[styles.churnCard, { backgroundColor: colors.warning[50] }]}>
                  <Text style={[styles.churnValue, { color: colors.warning[700] }]}>
                    {businessMetrics?.churn?.cleanerCancellations?.last90Days || 0}
                  </Text>
                  <Text style={[styles.churnLabel, { color: colors.warning[600] }]}>Last 90 Days</Text>
                </View>
                <View style={styles.churnCard}>
                  <Text style={styles.churnValue}>
                    {businessMetrics?.churn?.cleanerCancellations?.total || 0}
                  </Text>
                  <Text style={styles.churnLabel}>All Time</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Cleaner Reliability */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Cleaner Reliability</Text>
          <View style={styles.reliabilityOverview}>
            <View style={[styles.reliabilityCard, { backgroundColor: colors.success[50] }]}>
              <Text style={[styles.reliabilityValueLarge, { color: colors.success[700] }]}>
                {businessMetrics?.cleanerReliability?.overallCompletionRate || 0}%
              </Text>
              <Text style={[styles.reliabilityLabel, { color: colors.success[600] }]}>
                Completion Rate
              </Text>
            </View>
            <View style={styles.reliabilityCard}>
              <Text style={styles.reliabilityValue}>
                {businessMetrics?.cleanerReliability?.avgRating || 0}
              </Text>
              <Text style={styles.reliabilityLabel}>Avg Rating</Text>
            </View>
            <View style={styles.reliabilityCard}>
              <Text style={styles.reliabilityValue}>
                {businessMetrics?.cleanerReliability?.totalCompleted || 0}
              </Text>
              <Text style={styles.reliabilityLabel}>Completed</Text>
            </View>
          </View>

          {/* Top Cleaners */}
          {businessMetrics?.cleanerReliability?.cleanerStats?.length > 0 && (
            <View style={styles.topCleanersContainer}>
              <Text style={styles.topCleanersTitle}>Top Performers</Text>
              {businessMetrics.cleanerReliability.cleanerStats.slice(0, 5).map((cleaner, index) => (
                <View key={cleaner.id} style={styles.topCleanerRow}>
                  <View style={styles.topCleanerRank}>
                    <Text style={styles.topCleanerRankText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.topCleanerName} numberOfLines={1}>
                    {cleaner.username}
                  </Text>
                  <View style={styles.topCleanerStats}>
                    <Text style={styles.topCleanerStat}>
                      {cleaner.completionRate}%
                    </Text>
                    <Text style={styles.topCleanerStatLabel}>
                      ({cleaner.completed}/{cleaner.assigned})
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* App Usage Analytics Section */}
      <View style={styles.section}>
        <SectionHeader title="App Usage Analytics" />

        {/* Platform Overview */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Platform Overview</Text>
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
          <View style={[styles.applicationsSection, { marginTop: spacing.md }]}>
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

        {/* Signups Overview */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>User Signups</Text>
          <View style={styles.appUsageGrid}>
            <View style={[styles.appUsageCard, styles.appUsageCardHighlight]}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.signups?.allTime || 0}
              </Text>
              <Text style={styles.appUsageLabel}>All Time</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.signups?.thisYear || 0}
              </Text>
              <Text style={styles.appUsageLabel}>This Year</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.signups?.thisMonth || 0}
              </Text>
              <Text style={styles.appUsageLabel}>This Month</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.signups?.thisWeek || 0}
              </Text>
              <Text style={styles.appUsageLabel}>This Week</Text>
            </View>
          </View>
        </View>

        {/* Visits / Sessions */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>App Visits</Text>
          <View style={styles.appUsageGrid}>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.sessions?.allTime || 0}
              </Text>
              <Text style={styles.appUsageLabel}>Total Sessions</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.sessions?.thisMonth || 0}
              </Text>
              <Text style={styles.appUsageLabel}>This Month</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.sessions?.uniqueVisitorsMonth || 0}
              </Text>
              <Text style={styles.appUsageLabel}>Unique Visitors (Month)</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.sessions?.today || 0}
              </Text>
              <Text style={styles.appUsageLabel}>Today</Text>
            </View>
          </View>
        </View>

        {/* Page Views */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Page Views</Text>
          <View style={styles.appUsageGrid}>
            <View style={[styles.appUsageCard, styles.appUsageCardWide]}>
              <Text style={styles.appUsageValueLarge}>
                {appUsageData?.pageViews?.allTime || 0}
              </Text>
              <Text style={styles.appUsageLabel}>Total Page Views</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.pageViews?.thisMonth || 0}
              </Text>
              <Text style={styles.appUsageLabel}>This Month</Text>
            </View>
            <View style={styles.appUsageCard}>
              <Text style={styles.appUsageValue}>
                {appUsageData?.pageViews?.thisWeek || 0}
              </Text>
              <Text style={styles.appUsageLabel}>This Week</Text>
            </View>
          </View>
        </View>

        {/* Engagement Metrics */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Engagement</Text>
          <View style={styles.engagementGrid}>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {appUsageData?.engagement?.totalLogins || 0}
              </Text>
              <Text style={styles.engagementLabel}>Total Logins</Text>
            </View>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {(appUsageData?.engagement?.avgLoginsPerUser || 0).toFixed(1)}
              </Text>
              <Text style={styles.engagementLabel}>Avg Logins/User</Text>
            </View>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {appUsageData?.engagement?.engagementRate || 0}%
              </Text>
              <Text style={styles.engagementLabel}>Engagement Rate</Text>
            </View>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {appUsageData?.engagement?.returningUserRate || 0}%
              </Text>
              <Text style={styles.engagementLabel}>Returning Users</Text>
            </View>
          </View>
          <View style={[styles.engagementGrid, { marginTop: spacing.sm }]}>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {appUsageData?.engagement?.usersWhoLoggedIn || 0}
              </Text>
              <Text style={styles.engagementLabel}>Active Users</Text>
            </View>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {appUsageData?.engagement?.returningUsers || 0}
              </Text>
              <Text style={styles.engagementLabel}>Returning Users</Text>
            </View>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {appUsageData?.engagement?.highlyEngagedUsers || 0}
              </Text>
              <Text style={styles.engagementLabel}>Power Users (5+)</Text>
            </View>
            <View style={styles.engagementCard}>
              <Text style={styles.engagementValue}>
                {appUsageData?.engagement?.powerUserRate || 0}%
              </Text>
              <Text style={styles.engagementLabel}>Power User Rate</Text>
            </View>
          </View>
        </View>

        {/* User Retention */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>User Retention</Text>
          <View style={styles.retentionContainer}>
            <View style={styles.retentionBar}>
              <View style={styles.retentionLabels}>
                <Text style={styles.retentionLabel}>Day 1</Text>
                <Text style={styles.retentionLabel}>Day 7</Text>
                <Text style={styles.retentionLabel}>Day 30</Text>
              </View>
              <View style={styles.retentionBars}>
                <View style={styles.retentionBarTrack}>
                  <View
                    style={[
                      styles.retentionBarFill,
                      {
                        width: `${Math.min(appUsageData?.retention?.day1 || 0, 100)}%`,
                        backgroundColor: colors.success[500],
                      },
                    ]}
                  />
                  <Text style={styles.retentionPercent}>
                    {(appUsageData?.retention?.day1 || 0).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.retentionBarTrack}>
                  <View
                    style={[
                      styles.retentionBarFill,
                      {
                        width: `${Math.min(appUsageData?.retention?.day7 || 0, 100)}%`,
                        backgroundColor: colors.primary[500],
                      },
                    ]}
                  />
                  <Text style={styles.retentionPercent}>
                    {(appUsageData?.retention?.day7 || 0).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.retentionBarTrack}>
                  <View
                    style={[
                      styles.retentionBarFill,
                      {
                        width: `${Math.min(appUsageData?.retention?.day30 || 0, 100)}%`,
                        backgroundColor: colors.secondary[500],
                      },
                    ]}
                  />
                  <Text style={styles.retentionPercent}>
                    {(appUsageData?.retention?.day30 || 0).toFixed(0)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Device Breakdown */}
        <View style={styles.appUsageSubsection}>
          <Text style={styles.appUsageSubtitle}>Device Breakdown</Text>
          <View style={styles.deviceGrid}>
            <View style={[styles.deviceCard, { borderLeftColor: colors.primary[500] }]}>
              <Text style={styles.deviceIcon}>📱</Text>
              <Text style={styles.deviceValue}>
                {appUsageData?.deviceBreakdown?.mobile || 0}%
              </Text>
              <Text style={styles.deviceLabel}>Mobile</Text>
            </View>
            <View style={[styles.deviceCard, { borderLeftColor: colors.secondary[500] }]}>
              <Text style={styles.deviceIcon}>💻</Text>
              <Text style={styles.deviceValue}>
                {appUsageData?.deviceBreakdown?.desktop || 0}%
              </Text>
              <Text style={styles.deviceLabel}>Desktop</Text>
            </View>
            <View style={[styles.deviceCard, { borderLeftColor: colors.success[500] }]}>
              <Text style={styles.deviceIcon}>📲</Text>
              <Text style={styles.deviceValue}>
                {appUsageData?.deviceBreakdown?.tablet || 0}%
              </Text>
              <Text style={styles.deviceLabel}>Tablet</Text>
            </View>
          </View>
        </View>

        {/* Top Pages */}
        {appUsageData?.pageViews?.topPages?.length > 0 && (
          <View style={styles.appUsageSubsection}>
            <Text style={styles.appUsageSubtitle}>Top Pages</Text>
            <View style={styles.topPagesContainer}>
              {appUsageData.pageViews.topPages.slice(0, 5).map((page, index) => (
                <View key={index} style={styles.topPageRow}>
                  <View style={styles.topPageRank}>
                    <Text style={styles.topPageRankText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.topPageName} numberOfLines={1}>
                    {page.name || page.path}
                  </Text>
                  <Text style={styles.topPageViews}>{page.views} views</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Service Area Section */}
      <View style={styles.section}>
        <SectionHeader title="Service Area Management" />

        {/* Current Stats */}
        <View style={styles.serviceAreaStats}>
          <View style={styles.serviceAreaStatCard}>
            <Text style={styles.serviceAreaStatValue}>
              {serviceAreaData?.stats?.totalHomes || 0}
            </Text>
            <Text style={styles.serviceAreaStatLabel}>Total Homes</Text>
          </View>
          <View style={[styles.serviceAreaStatCard, { backgroundColor: colors.success[50] }]}>
            <Text style={[styles.serviceAreaStatValue, { color: colors.success[700] }]}>
              {serviceAreaData?.stats?.homesInArea || 0}
            </Text>
            <Text style={[styles.serviceAreaStatLabel, { color: colors.success[600] }]}>In Service Area</Text>
          </View>
          <View style={[styles.serviceAreaStatCard, { backgroundColor: colors.warning[50] }]}>
            <Text style={[styles.serviceAreaStatValue, { color: colors.warning[700] }]}>
              {serviceAreaData?.stats?.homesOutsideArea || 0}
            </Text>
            <Text style={[styles.serviceAreaStatLabel, { color: colors.warning[600] }]}>Outside Area</Text>
          </View>
        </View>

        {/* Service Area Config Info */}
        {serviceAreaData?.config?.enabled && (
          <View style={styles.serviceAreaConfig}>
            <Text style={styles.serviceAreaConfigTitle}>Current Service Areas</Text>
            {serviceAreaData?.config?.cities?.length > 0 && (
              <Text style={styles.serviceAreaConfigText}>
                Cities: {serviceAreaData.config.cities.join(", ")}
              </Text>
            )}
            {serviceAreaData?.config?.states?.length > 0 && (
              <Text style={styles.serviceAreaConfigText}>
                States: {serviceAreaData.config.states.join(", ")}
              </Text>
            )}
            {serviceAreaData?.config?.zipcodes?.length > 0 && (
              <Text style={styles.serviceAreaConfigText}>
                Zipcodes: {serviceAreaData.config.zipcodes.join(", ")}
              </Text>
            )}
          </View>
        )}

        {/* Recheck Button */}
        <Pressable
          style={[
            styles.recheckButton,
            recheckLoading && styles.recheckButtonDisabled,
          ]}
          onPress={handleRecheckServiceAreas}
          disabled={recheckLoading}
        >
          {recheckLoading ? (
            <ActivityIndicator size="small" color={colors.neutral[0]} />
          ) : (
            <Text style={styles.recheckButtonText}>
              Recheck All Homes Against Service Area
            </Text>
          )}
        </Pressable>

        {/* Recheck Results */}
        {recheckResult && (
          <View style={[
            styles.recheckResult,
            recheckResult.success ? styles.recheckResultSuccess : styles.recheckResultError,
          ]}>
            {recheckResult.success ? (
              <>
                <Text style={styles.recheckResultTitle}>
                  Service Area Check Complete
                </Text>
                <Text style={styles.recheckResultText}>
                  {recheckResult.message}
                </Text>
                {recheckResult.updated > 0 && recheckResult.results && (
                  <View style={styles.recheckResultsList}>
                    {recheckResult.results.map((item, index) => (
                      <Text key={index} style={styles.recheckResultItem}>
                        {item.nickName || "Home"} ({item.city}, {item.state}): {item.previousStatus} → {item.newStatus}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.recheckResultErrorText}>
                {recheckResult.error || "An error occurred"}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Tax Section */}
      <TaxFormsSection state={state} />

      {/* Footer Spacer */}
      <View style={{ height: 40 }} />

      {/* Preview Role Modal */}
      <PreviewRoleModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        onSelectRole={handleSelectPreviewRole}
        isLoading={previewLoading}
        error={previewError}
      />

      {/* Create Support Ticket Modal */}
      <CreateSupportTicketModal
        visible={showCreateTicketModal}
        onClose={() => setShowCreateTicketModal(false)}
        onSuccess={() => {
          setShowCreateTicketModal(false);
          fetchDashboardData(true);
        }}
        token={state.currentUser.token}
      />
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
    marginBottom: spacing.lg,
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

  // Preview as Role Card
  previewAsRoleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  previewAsRoleCardPressed: {
    backgroundColor: colors.primary[50],
    transform: [{ scale: 0.99 }],
  },
  previewAsRoleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  previewAsRoleContent: {
    flex: 1,
  },
  previewAsRoleTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  previewAsRoleDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Create Ticket Card
  createTicketCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.error[100],
  },
  createTicketCardPressed: {
    backgroundColor: colors.error[50],
    transform: [{ scale: 0.99 }],
  },
  createTicketIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.error[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  createTicketContent: {
    flex: 1,
  },
  createTicketTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  createTicketDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
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

  // Service Area Section
  serviceAreaStats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  serviceAreaStatCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  serviceAreaStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  serviceAreaStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
    textAlign: "center",
  },
  serviceAreaConfig: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  serviceAreaConfigTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  serviceAreaConfigText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  recheckButton: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  recheckButtonDisabled: {
    opacity: 0.6,
  },
  recheckButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  recheckResult: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  recheckResultSuccess: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  recheckResultError: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  recheckResultTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },
  recheckResultText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
  },
  recheckResultsList: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  recheckResultItem: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    marginBottom: 4,
  },
  recheckResultErrorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },

  // App Usage Analytics Styles
  appUsageSubsection: {
    marginBottom: spacing.lg,
  },
  appUsageSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  appUsageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  appUsageCard: {
    flex: 1,
    minWidth: (width - 80) / 2 - spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  appUsageCardHighlight: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  appUsageCardWide: {
    minWidth: "100%",
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  appUsageValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  appUsageValueLarge: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  appUsageLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: "center",
  },

  // Engagement Grid
  engagementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  engagementCard: {
    flex: 1,
    minWidth: (width - 80) / 2 - spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[400],
  },
  engagementValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  engagementLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: 4,
    textAlign: "center",
  },

  // Retention Styles
  retentionContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  retentionBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  retentionLabels: {
    width: 60,
    gap: spacing.md,
  },
  retentionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  retentionBars: {
    flex: 1,
    gap: spacing.md,
  },
  retentionBarTrack: {
    height: 24,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  retentionBarFill: {
    height: "100%",
    borderRadius: radius.full,
    minWidth: 2,
  },
  retentionPercent: {
    position: "absolute",
    right: spacing.sm,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  // Device Breakdown
  deviceGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  deviceCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderLeftWidth: 4,
  },
  deviceIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  deviceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  deviceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Top Pages
  topPagesContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  topPageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  topPageRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  topPageRankText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  topPageName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  topPageViews: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },

  // Terms & Conditions
  termsDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  termsButton: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  termsButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Business Metrics Styles
  businessMetricRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  businessMetricCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  businessMetricCardHighlight: {
    backgroundColor: colors.secondary[50],
    borderWidth: 1,
    borderColor: colors.secondary[200],
  },
  businessMetricCardLarge: {
    flex: 2,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  businessMetricCardStack: {
    flex: 1,
    gap: spacing.sm,
  },
  businessMetricLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 4,
    textAlign: "center",
  },
  businessMetricValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  businessMetricValueLarge: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  businessMetricMini: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: "center",
  },
  businessMetricMiniValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  businessMetricMiniLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // Loyalty Styles
  loyaltyCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  loyaltyValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  loyaltyLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: "center",
  },
  loyaltyRateContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.success[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  loyaltyRateText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Churn Styles
  churnContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  churnSection: {},
  churnSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  churnRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  churnCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  churnValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  churnLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
    textAlign: "center",
  },

  // Reliability Styles
  reliabilityOverview: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reliabilityCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  reliabilityValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  reliabilityValueLarge: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
  },
  reliabilityLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: "center",
  },

  // Top Cleaners Styles
  topCleanersContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  topCleanersTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  topCleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  topCleanerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  topCleanerRankText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  topCleanerName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  topCleanerStats: {
    alignItems: "flex-end",
  },
  topCleanerStat: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  topCleanerStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});

export default OwnerDashboard;
