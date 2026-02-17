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
import Icon from "react-native-vector-icons/FontAwesome5";
import OwnerDashboardService from "../../services/fetchRequests/OwnerDashboardService";
import { shadows } from "../../services/styles/theme";
import TaxFormsSection from "../tax/TaxFormsSection";
import { ConflictsStatsWidget } from "../conflicts";
import { PreviewRoleModal } from "../preview";
import { usePreview } from "../../context/PreviewContext";
import CreateSupportTicketModal from "../conflicts/modals/CreateSupportTicketModal";

const { width: screenWidth } = Dimensions.get("window");

// Modern Stat Card with icon and trend
const StatCard = ({ title, value, icon, color, trend, trendUp, subtitle }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <View style={styles.statCardHeader}>
      <View style={[styles.statIconWrap, { backgroundColor: color + "15" }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trendUp ? "#DCFCE7" : "#FEE2E2" }]}>
          <Icon name={trendUp ? "arrow-up" : "arrow-down"} size={8} color={trendUp ? "#16A34A" : "#DC2626"} />
          <Text style={[styles.trendText, { color: trendUp ? "#16A34A" : "#DC2626" }]}>{trend}</Text>
        </View>
      )}
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

// Action Button
const ActionButton = ({ icon, label, color, onPress, badge }) => (
  <Pressable
    style={({ pressed }) => [
      styles.actionBtn,
      pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
    ]}
    onPress={onPress}
  >
    <View style={[styles.actionBtnIcon, { backgroundColor: color }]}>
      <Icon name={icon} size={18} color="#fff" />
      {badge > 0 && (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.actionBtnLabel}>{label}</Text>
  </Pressable>
);

// Section Header
const SectionHeader = ({ title, icon, color, onPress, actionText }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      {icon && (
        <View style={[styles.sectionIconWrap, { backgroundColor: (color || "#6366F1") + "15" }]}>
          <Icon name={icon} size={14} color={color || "#6366F1"} />
        </View>
      )}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {onPress && (
      <Pressable onPress={onPress} style={styles.sectionActionBtn}>
        <Text style={styles.sectionAction}>{actionText || "View All"}</Text>
        <Icon name="chevron-right" size={10} color="#6366F1" />
      </Pressable>
    )}
  </View>
);

// Period Pill
const PeriodPill = ({ label, isActive, onPress }) => (
  <Pressable
    style={[styles.periodPill, isActive && styles.periodPillActive]}
    onPress={onPress}
  >
    <Text style={[styles.periodPillText, isActive && styles.periodPillTextActive]}>
      {label}
    </Text>
  </Pressable>
);

// Metric Card
const MetricCard = ({ title, value, icon, color, size = "normal" }) => (
  <View style={[
    styles.metricCard,
    size === "large" && styles.metricCardLarge,
    { borderLeftColor: color || "#E5E7EB" }
  ]}>
    {icon && (
      <View style={[styles.metricIconWrap, { backgroundColor: (color || "#6366F1") + "15" }]}>
        <Icon name={icon} size={14} color={color || "#6366F1"} />
      </View>
    )}
    <Text style={[styles.metricValue, size === "large" && styles.metricValueLarge]}>
      {value}
    </Text>
    <Text style={styles.metricLabel}>{title}</Text>
  </View>
);

// Info Row
const InfoRow = ({ icon, label, value, color }) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoRowIcon, { backgroundColor: (color || "#6366F1") + "15" }]}>
      <Icon name={icon} size={12} color={color || "#6366F1"} />
    </View>
    <Text style={styles.infoRowLabel}>{label}</Text>
    <Text style={styles.infoRowValue}>{value}</Text>
  </View>
);

// Progress Bar
const ProgressBar = ({ label, value, color, maxValue = 100 }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarHeader}>
        <Text style={styles.progressBarLabel}>{label}</Text>
        <Text style={[styles.progressBarValue, { color }]}>{value}%</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

// Bar Chart
const BarChart = ({ data, label, color = "#6366F1" }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartHeight = 100;
  const barWidth = Math.max(20, (screenWidth - 120) / Math.max(data.length, 1) - 10);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartLabel}>{label}</Text>
      <View style={styles.chartArea}>
        <View style={styles.barsContainer}>
          {data.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
            return (
              <View key={index} style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(barHeight, 4),
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
  const [activeSection, setActiveSection] = useState("overview");

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

  const handleRecheckServiceAreas = async () => {
    setRecheckLoading(true);
    setRecheckResult(null);
    try {
      const result = await OwnerDashboardService.recheckServiceAreas(state.currentUser.token);
      setRecheckResult(result);
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
      <View style={styles.loadingWrap}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading Dashboard</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.errorCard}>
          <Icon name="exclamation-triangle" size={32} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchDashboardData()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Prepare chart data
  const monthlyEarningsData = (financialData?.monthly || [])
    .slice(-6)
    .map((m) => ({
      label: new Date(m.month).toLocaleDateString("en-US", { month: "short" }),
      value: (m.earningsCents || 0) / 100,
    }));

  const userGrowthData = (userAnalytics?.growth || []).slice(-6).map((m) => ({
    label: new Date(m.month).toLocaleDateString("en-US", { month: "short" }),
    value: (m.cleaners || 0) + (m.homeowners || 0),
  }));

  const periodOptions = [
    { label: "Day", value: "day" },
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "Year", value: "year" },
    { label: "All", value: "allTime" },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.heroGreeting}>Platform Owner</Text>
            <Text style={styles.heroTitle}>Dashboard</Text>
            <Text style={styles.heroDate}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <Icon name="crown" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsWrap}>
          <ActionButton
            icon="eye"
            label="Preview"
            color="#6366F1"
            onPress={() => setPreviewModalVisible(true)}
          />
          <ActionButton
            icon="envelope"
            label="Messages"
            color="#8B5CF6"
            badge={messagesSummary?.unreadCount || 0}
            onPress={() => navigate("/messages")}
          />
          <ActionButton
            icon="gavel"
            label="Conflicts"
            color="#F59E0B"
            onPress={() => navigate("/conflicts")}
          />
          <ActionButton
            icon="flag"
            label="Ticket"
            color="#EF4444"
            onPress={() => setShowCreateTicketModal(true)}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsWrap}>
          <Text style={styles.sectionLabel}>Today's Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Today's Jobs"
              value={quickStats?.todaysAppointments || 0}
              icon="calendar-check"
              color="#6366F1"
            />
            <StatCard
              title="Completed"
              value={quickStats?.completedThisWeek || 0}
              icon="check-circle"
              color="#10B981"
              subtitle="This Week"
            />
            <StatCard
              title="New Users"
              value={quickStats?.newUsersThisWeek || 0}
              icon="user-plus"
              color="#8B5CF6"
              subtitle="This Week"
            />
            <StatCard
              title="Today's Revenue"
              value={formatCurrencyShort(financialData?.current?.todayCents)}
              icon="dollar-sign"
              color="#F59E0B"
            />
          </View>
        </View>

        {/* Section Tabs */}
        <View style={styles.sectionTabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
            {[
              { key: "overview", label: "Overview", icon: "chart-pie" },
              { key: "users", label: "Users", icon: "users" },
              { key: "business", label: "Business", icon: "briefcase" },
              { key: "app", label: "App Usage", icon: "mobile-alt" },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.sectionTab, activeSection === tab.key && styles.sectionTabActive]}
                onPress={() => setActiveSection(tab.key)}
              >
                <Icon
                  name={tab.icon}
                  size={14}
                  color={activeSection === tab.key ? "#fff" : "#6366F1"}
                />
                <Text style={[styles.sectionTabText, activeSection === tab.key && styles.sectionTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <>
            {/* Financial Summary */}
            <View style={styles.card}>
              <SectionHeader title="Financial Summary" icon="chart-line" color="#10B981" />

              <View style={styles.earningsGrid}>
                <View style={[styles.earningsCard, styles.earningsCardPrimary]}>
                  <Text style={styles.earningsLabel}>This Month</Text>
                  <Text style={styles.earningsValueLarge}>
                    {formatCurrency(financialData?.current?.monthCents)}
                  </Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>This Week</Text>
                  <Text style={styles.earningsValue}>
                    {formatCurrency(financialData?.current?.weekCents)}
                  </Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>This Year</Text>
                  <Text style={styles.earningsValue}>
                    {formatCurrencyShort(financialData?.current?.yearCents)}
                  </Text>
                </View>
              </View>

              <View style={styles.balanceBanner}>
                <View style={styles.balanceItem}>
                  <Icon name="clock" size={14} color="#F59E0B" />
                  <View style={styles.balanceContent}>
                    <Text style={styles.balanceLabel}>Pending</Text>
                    <Text style={styles.balanceValue}>
                      {formatCurrency(financialData?.current?.pendingCents)}
                    </Text>
                  </View>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceItem}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <View style={styles.balanceContent}>
                    <Text style={styles.balanceLabel}>Net YTD</Text>
                    <Text style={[styles.balanceValue, { color: "#10B981" }]}>
                      {formatCurrency(financialData?.current?.yearNetCents)}
                    </Text>
                  </View>
                </View>
              </View>

              {monthlyEarningsData.length > 0 && (
                <BarChart
                  data={monthlyEarningsData}
                  label="Monthly Earnings"
                  color="#10B981"
                />
              )}
            </View>

            {/* Messages Summary */}
            <View style={styles.card}>
              <SectionHeader
                title="Messages"
                icon="envelope"
                color="#8B5CF6"
                onPress={() => navigate("/messages")}
                actionText="Open Inbox"
              />
              <View style={styles.messagesGrid}>
                <View style={[styles.messageCard, messagesSummary?.unreadCount > 0 && styles.messageCardAlert]}>
                  <Text style={[styles.messageValue, messagesSummary?.unreadCount > 0 && { color: "#EF4444" }]}>
                    {messagesSummary?.unreadCount || 0}
                  </Text>
                  <Text style={styles.messageLabel}>Unread</Text>
                </View>
                <View style={styles.messageCard}>
                  <Text style={styles.messageValue}>{messagesSummary?.messagesThisWeek || 0}</Text>
                  <Text style={styles.messageLabel}>This Week</Text>
                </View>
                <View style={styles.messageCard}>
                  <Text style={styles.messageValue}>{messagesSummary?.totalMessages || 0}</Text>
                  <Text style={styles.messageLabel}>Total</Text>
                </View>
              </View>
            </View>

            {/* Conflict Resolution Widget */}
            <View style={styles.card}>
              <ConflictsStatsWidget onNavigateToConflicts={() => navigate("/conflicts")} />
            </View>

            {/* Service Areas */}
            <View style={styles.card}>
              <SectionHeader
                title="Service Areas"
                icon="map-marker-alt"
                color="#EF4444"
                onPress={() => navigate("/owner/service-areas")}
                actionText="Manage"
              />
              <View style={styles.serviceAreaGrid}>
                <MetricCard
                  title="Total Homes"
                  value={serviceAreaData?.stats?.totalHomes || 0}
                  icon="home"
                  color="#6366F1"
                />
                <MetricCard
                  title="In Service"
                  value={serviceAreaData?.stats?.homesInArea || 0}
                  icon="check"
                  color="#10B981"
                />
                <MetricCard
                  title="Outside"
                  value={serviceAreaData?.stats?.homesOutsideArea || 0}
                  icon="times"
                  color="#F59E0B"
                />
              </View>

              {serviceAreaData?.config?.enabled && (
                <View style={styles.serviceAreaInfo}>
                  {serviceAreaData?.config?.cities?.length > 0 && (
                    <InfoRow
                      icon="city"
                      label="Cities"
                      value={serviceAreaData.config.cities.join(", ")}
                      color="#6366F1"
                    />
                  )}
                  {serviceAreaData?.config?.states?.length > 0 && (
                    <InfoRow
                      icon="map"
                      label="States"
                      value={serviceAreaData.config.states.join(", ")}
                      color="#8B5CF6"
                    />
                  )}
                </View>
              )}

              <Pressable
                style={[styles.recheckBtn, recheckLoading && { opacity: 0.6 }]}
                onPress={handleRecheckServiceAreas}
                disabled={recheckLoading}
              >
                {recheckLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="sync" size={14} color="#fff" />
                    <Text style={styles.recheckBtnText}>Recheck All Homes</Text>
                  </>
                )}
              </Pressable>

              {recheckResult && (
                <View style={[
                  styles.recheckResult,
                  recheckResult.success ? styles.recheckResultSuccess : styles.recheckResultError
                ]}>
                  <Icon
                    name={recheckResult.success ? "check-circle" : "exclamation-circle"}
                    size={16}
                    color={recheckResult.success ? "#10B981" : "#EF4444"}
                  />
                  <Text style={[
                    styles.recheckResultText,
                    { color: recheckResult.success ? "#065F46" : "#DC2626" }
                  ]}>
                    {recheckResult.success ? recheckResult.message : recheckResult.error}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Users Section */}
        {activeSection === "users" && (
          <>
            <View style={styles.card}>
              <SectionHeader title="User Activity" icon="users" color="#6366F1" />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
                {periodOptions.map((opt) => (
                  <PeriodPill
                    key={opt.value}
                    label={opt.label}
                    isActive={selectedPeriod === opt.value}
                    onPress={() => setSelectedPeriod(opt.value)}
                  />
                ))}
              </ScrollView>

              <View style={styles.userStatsGrid}>
                <View style={[styles.userStatCard, { borderLeftColor: "#6366F1" }]}>
                  <Text style={styles.userStatValue}>{getActiveUserCount("cleaners")}</Text>
                  <Text style={styles.userStatLabel}>Active Cleaners</Text>
                  <Text style={styles.userStatTotal}>of {userAnalytics?.totals?.cleaners || 0}</Text>
                </View>
                <View style={[styles.userStatCard, { borderLeftColor: "#8B5CF6" }]}>
                  <Text style={styles.userStatValue}>{getActiveUserCount("homeowners")}</Text>
                  <Text style={styles.userStatLabel}>Active Homeowners</Text>
                  <Text style={styles.userStatTotal}>of {userAnalytics?.totals?.homeowners || 0}</Text>
                </View>
                <View style={[styles.userStatCard, { borderLeftColor: "#10B981" }]}>
                  <Text style={styles.userStatValue}>{getActiveUserCount("combined")}</Text>
                  <Text style={styles.userStatLabel}>Total Active</Text>
                  <Text style={styles.userStatTotal}>of {userAnalytics?.totals?.total || 0}</Text>
                </View>
              </View>

              {userGrowthData.length > 0 && (
                <BarChart data={userGrowthData} label="New User Signups" color="#6366F1" />
              )}
            </View>

            <View style={styles.card}>
              <SectionHeader title="Platform Overview" icon="layer-group" color="#8B5CF6" />
              <View style={styles.platformGrid}>
                <MetricCard title="Cleaners" value={userAnalytics?.totals?.cleaners || 0} icon="broom" color="#6366F1" />
                <MetricCard title="Homeowners" value={userAnalytics?.totals?.homeowners || 0} icon="home" color="#8B5CF6" />
                <MetricCard title="Homes" value={userAnalytics?.totals?.homes || 0} icon="building" color="#10B981" />
              </View>

              <View style={styles.applicationsSection}>
                <Text style={styles.subsectionTitle}>Applications</Text>
                <View style={styles.applicationsGrid}>
                  <View style={styles.appCard}>
                    <Text style={styles.appValue}>{userAnalytics?.applications?.total || 0}</Text>
                    <Text style={styles.appLabel}>Total</Text>
                  </View>
                  <View style={[styles.appCard, { backgroundColor: "#FEF3C7" }]}>
                    <Text style={[styles.appValue, { color: "#D97706" }]}>
                      {userAnalytics?.applications?.pending || 0}
                    </Text>
                    <Text style={[styles.appLabel, { color: "#92400E" }]}>Pending</Text>
                  </View>
                  <View style={[styles.appCard, { backgroundColor: "#DCFCE7" }]}>
                    <Text style={[styles.appValue, { color: "#059669" }]}>
                      {userAnalytics?.applications?.approved || 0}
                    </Text>
                    <Text style={[styles.appLabel, { color: "#065F46" }]}>Approved</Text>
                  </View>
                  <View style={[styles.appCard, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.appValue, { color: "#DC2626" }]}>
                      {userAnalytics?.applications?.rejected || 0}
                    </Text>
                    <Text style={[styles.appLabel, { color: "#991B1B" }]}>Rejected</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Business Section */}
        {activeSection === "business" && (
          <>
            <View style={styles.card}>
              <SectionHeader title="Cost Per Booking" icon="calculator" color="#F59E0B" />
              <View style={styles.businessGrid}>
                <View style={[styles.businessCard, styles.businessCardHighlight]}>
                  <Text style={styles.businessLabel}>Avg Platform Fee</Text>
                  <Text style={styles.businessValueLarge}>
                    {formatCurrency(businessMetrics?.costPerBooking?.avgFeeCents)}
                  </Text>
                </View>
                <View style={styles.businessCard}>
                  <Text style={styles.businessLabel}>Total Earned</Text>
                  <Text style={styles.businessValue}>
                    {formatCurrencyShort(businessMetrics?.costPerBooking?.totalFeeCents)}
                  </Text>
                </View>
                <View style={styles.businessCard}>
                  <Text style={styles.businessLabel}>Bookings</Text>
                  <Text style={styles.businessValue}>
                    {businessMetrics?.costPerBooking?.bookingCount || 0}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Customer Loyalty" icon="heart" color="#EF4444" />
              <View style={styles.loyaltyGrid}>
                <View style={[styles.loyaltyCard, { backgroundColor: "#DCFCE7" }]}>
                  <Text style={[styles.loyaltyValue, { color: "#059669" }]}>
                    {businessMetrics?.subscriptionRate?.frequentBookers || 0}
                  </Text>
                  <Text style={[styles.loyaltyLabel, { color: "#065F46" }]}>Loyal (5+)</Text>
                </View>
                <View style={[styles.loyaltyCard, { backgroundColor: "#EEF2FF" }]}>
                  <Text style={[styles.loyaltyValue, { color: "#4F46E5" }]}>
                    {businessMetrics?.subscriptionRate?.regularBookers || 0}
                  </Text>
                  <Text style={[styles.loyaltyLabel, { color: "#3730A3" }]}>Regular (3-4)</Text>
                </View>
                <View style={[styles.loyaltyCard, { backgroundColor: "#F3F4F6" }]}>
                  <Text style={styles.loyaltyValue}>
                    {businessMetrics?.subscriptionRate?.occasionalBookers || 0}
                  </Text>
                  <Text style={styles.loyaltyLabel}>Occasional</Text>
                </View>
              </View>
              <View style={styles.loyaltyBanner}>
                <Icon name="award" size={16} color="#059669" />
                <Text style={styles.loyaltyBannerText}>
                  {businessMetrics?.subscriptionRate?.rate || 0}% of customers are loyal (5+ bookings)
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Repeat Booking Rate" icon="redo" color="#8B5CF6" />
              <View style={styles.repeatGrid}>
                <View style={[styles.repeatCardLarge, { backgroundColor: "#EEF2FF" }]}>
                  <Text style={[styles.repeatValueLarge, { color: "#4F46E5" }]}>
                    {businessMetrics?.repeatBookingRate?.rate || 0}%
                  </Text>
                  <Text style={[styles.repeatLabel, { color: "#3730A3" }]}>Repeat Customers</Text>
                </View>
                <View style={styles.repeatStack}>
                  <View style={styles.repeatCard}>
                    <Text style={styles.repeatValue}>
                      {businessMetrics?.repeatBookingRate?.repeatBookers || 0}
                    </Text>
                    <Text style={styles.repeatLabel}>Repeat</Text>
                  </View>
                  <View style={styles.repeatCard}>
                    <Text style={styles.repeatValue}>
                      {businessMetrics?.repeatBookingRate?.singleBookers || 0}
                    </Text>
                    <Text style={styles.repeatLabel}>Single</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Cancellations & Churn" icon="ban" color="#EF4444" />

              <Text style={styles.subsectionTitle}>Homeowner Cancellations</Text>
              <View style={styles.churnGrid}>
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

              <Text style={[styles.subsectionTitle, { marginTop: 16 }]}>Cleaner Penalties</Text>
              <View style={styles.churnGrid}>
                <View style={[styles.churnCard, { backgroundColor: "#FEE2E2" }]}>
                  <Text style={[styles.churnValue, { color: "#DC2626" }]}>
                    {businessMetrics?.churn?.cleanerCancellations?.last30Days || 0}
                  </Text>
                  <Text style={[styles.churnLabel, { color: "#991B1B" }]}>Last 30 Days</Text>
                </View>
                <View style={[styles.churnCard, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[styles.churnValue, { color: "#D97706" }]}>
                    {businessMetrics?.churn?.cleanerCancellations?.last90Days || 0}
                  </Text>
                  <Text style={[styles.churnLabel, { color: "#92400E" }]}>Last 90 Days</Text>
                </View>
                <View style={styles.churnCard}>
                  <Text style={styles.churnValue}>
                    {businessMetrics?.churn?.cleanerCancellations?.total || 0}
                  </Text>
                  <Text style={styles.churnLabel}>All Time</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Cleaner Reliability" icon="user-check" color="#10B981" />
              <View style={styles.reliabilityGrid}>
                <View style={[styles.reliabilityCardLarge, { backgroundColor: "#DCFCE7" }]}>
                  <Text style={[styles.reliabilityValueLarge, { color: "#059669" }]}>
                    {businessMetrics?.cleanerReliability?.overallCompletionRate || 0}%
                  </Text>
                  <Text style={[styles.reliabilityLabel, { color: "#065F46" }]}>Completion Rate</Text>
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

              {businessMetrics?.cleanerReliability?.cleanerStats?.length > 0 && (
                <View style={styles.topPerformers}>
                  <Text style={styles.subsectionTitle}>Top Performers</Text>
                  {businessMetrics.cleanerReliability.cleanerStats.slice(0, 5).map((cleaner, index) => (
                    <View key={cleaner.id} style={styles.performerRow}>
                      <View style={styles.performerRank}>
                        <Text style={styles.performerRankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.performerName} numberOfLines={1}>{cleaner.username}</Text>
                      <View style={styles.performerStats}>
                        <Text style={styles.performerRate}>{cleaner.completionRate}%</Text>
                        <Text style={styles.performerCount}>({cleaner.completed}/{cleaner.assigned})</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* App Usage Section */}
        {activeSection === "app" && (
          <>
            <View style={styles.card}>
              <SectionHeader title="User Signups" icon="user-plus" color="#6366F1" />
              <View style={styles.signupGrid}>
                <View style={[styles.signupCard, styles.signupCardHighlight]}>
                  <Text style={styles.signupValueLarge}>{appUsageData?.signups?.allTime || 0}</Text>
                  <Text style={styles.signupLabel}>All Time</Text>
                </View>
                <View style={styles.signupCard}>
                  <Text style={styles.signupValue}>{appUsageData?.signups?.thisYear || 0}</Text>
                  <Text style={styles.signupLabel}>This Year</Text>
                </View>
                <View style={styles.signupCard}>
                  <Text style={styles.signupValue}>{appUsageData?.signups?.thisMonth || 0}</Text>
                  <Text style={styles.signupLabel}>This Month</Text>
                </View>
                <View style={styles.signupCard}>
                  <Text style={styles.signupValue}>{appUsageData?.signups?.thisWeek || 0}</Text>
                  <Text style={styles.signupLabel}>This Week</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="App Sessions" icon="clock" color="#8B5CF6" />
              <View style={styles.sessionGrid}>
                <MetricCard title="Total Sessions" value={appUsageData?.sessions?.allTime || 0} icon="history" color="#8B5CF6" />
                <MetricCard title="This Month" value={appUsageData?.sessions?.thisMonth || 0} icon="calendar" color="#6366F1" />
                <MetricCard title="Unique (Month)" value={appUsageData?.sessions?.uniqueVisitorsMonth || 0} icon="users" color="#10B981" />
                <MetricCard title="Today" value={appUsageData?.sessions?.today || 0} icon="sun" color="#F59E0B" />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Engagement" icon="chart-bar" color="#10B981" />
              <View style={styles.engagementGrid}>
                <View style={styles.engagementCard}>
                  <Text style={styles.engagementValue}>{appUsageData?.engagement?.totalLogins || 0}</Text>
                  <Text style={styles.engagementLabel}>Total Logins</Text>
                </View>
                <View style={styles.engagementCard}>
                  <Text style={styles.engagementValue}>
                    {(appUsageData?.engagement?.avgLoginsPerUser || 0).toFixed(1)}
                  </Text>
                  <Text style={styles.engagementLabel}>Avg Logins/User</Text>
                </View>
                <View style={styles.engagementCard}>
                  <Text style={styles.engagementValue}>{appUsageData?.engagement?.engagementRate || 0}%</Text>
                  <Text style={styles.engagementLabel}>Engagement Rate</Text>
                </View>
                <View style={styles.engagementCard}>
                  <Text style={styles.engagementValue}>{appUsageData?.engagement?.returningUserRate || 0}%</Text>
                  <Text style={styles.engagementLabel}>Returning Users</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="User Retention" icon="user-clock" color="#EF4444" />
              <View style={styles.retentionContainer}>
                <ProgressBar label="Day 1" value={appUsageData?.retention?.day1 || 0} color="#10B981" />
                <ProgressBar label="Day 7" value={appUsageData?.retention?.day7 || 0} color="#6366F1" />
                <ProgressBar label="Day 30" value={appUsageData?.retention?.day30 || 0} color="#8B5CF6" />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Device Breakdown" icon="mobile-alt" color="#F59E0B" />
              <View style={styles.deviceGrid}>
                <View style={[styles.deviceCard, { borderLeftColor: "#6366F1" }]}>
                  <Icon name="mobile-alt" size={24} color="#6366F1" />
                  <Text style={styles.deviceValue}>{appUsageData?.deviceBreakdown?.mobile || 0}%</Text>
                  <Text style={styles.deviceLabel}>Mobile</Text>
                </View>
                <View style={[styles.deviceCard, { borderLeftColor: "#8B5CF6" }]}>
                  <Icon name="laptop" size={24} color="#8B5CF6" />
                  <Text style={styles.deviceValue}>{appUsageData?.deviceBreakdown?.desktop || 0}%</Text>
                  <Text style={styles.deviceLabel}>Desktop</Text>
                </View>
                <View style={[styles.deviceCard, { borderLeftColor: "#10B981" }]}>
                  <Icon name="tablet-alt" size={24} color="#10B981" />
                  <Text style={styles.deviceValue}>{appUsageData?.deviceBreakdown?.tablet || 0}%</Text>
                  <Text style={styles.deviceLabel}>Tablet</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Tax Section */}
        <TaxFormsSection state={state} />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <PreviewRoleModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        onSelectRole={handleSelectPreviewRole}
        isLoading={previewLoading}
        error={previewError}
      />

      <CreateSupportTicketModal
        visible={showCreateTicketModal}
        onClose={() => setShowCreateTicketModal(false)}
        onSuccess={() => {
          setShowCreateTicketModal(false);
          fetchDashboardData(true);
        }}
        token={state.currentUser.token}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollView: {
    flex: 1,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: "#fff",
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    ...shadows.lg,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  errorCard: {
    backgroundColor: "#fff",
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    ...shadows.lg,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#DC2626",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Hero Header
  hero: {
    backgroundColor: "#6366F1",
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroContent: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginTop: 4,
  },
  heroDate: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Actions
  actionsWrap: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    marginTop: -16,
    marginHorizontal: 16,
    borderRadius: 16,
    ...shadows.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
  },
  actionBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  actionBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  actionBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  actionBtnLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Stats
  statsWrap: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: (screenWidth - 44) / 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    ...shadows.sm,
  },
  statCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 10,
    color: "#D1D5DB",
    marginTop: 2,
  },

  // Section Tabs
  sectionTabsWrap: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTabs: {
    gap: 8,
    paddingRight: 16,
  },
  sectionTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  sectionTabActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6366F1",
  },
  sectionTabTextActive: {
    color: "#fff",
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    ...shadows.sm,
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  sectionActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionAction: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "500",
  },

  // Earnings
  earningsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  earningsCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  earningsCardPrimary: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  earningsLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  earningsValueLarge: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4F46E5",
  },

  // Balance Banner
  balanceBanner: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  balanceItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  balanceContent: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 2,
  },
  balanceDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 14,
  },

  // Chart
  chartContainer: {
    marginTop: 8,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
  },
  chartArea: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 110,
  },
  barWrapper: {
    alignItems: "center",
  },
  bar: {
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 6,
  },

  // Messages
  messagesGrid: {
    flexDirection: "row",
    gap: 10,
  },
  messageCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  messageCardAlert: {
    backgroundColor: "#FEE2E2",
  },
  messageValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  messageLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },

  // Service Area
  serviceAreaGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  serviceAreaInfo: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  recheckBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  recheckBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  recheckResult: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 10,
  },
  recheckResultSuccess: {
    backgroundColor: "#DCFCE7",
  },
  recheckResultError: {
    backgroundColor: "#FEE2E2",
  },
  recheckResultText: {
    flex: 1,
    fontSize: 13,
  },

  // Metric Card
  metricCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderLeftWidth: 3,
  },
  metricCardLarge: {
    flex: 2,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  metricValueLarge: {
    fontSize: 28,
  },
  metricLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },

  // Info Row
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  infoRowLabel: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
  },
  infoRowValue: {
    fontSize: 12,
    color: "#1F2937",
    fontWeight: "500",
    flex: 2,
  },

  // Period Pills
  periodScroll: {
    marginBottom: 16,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  periodPillActive: {
    backgroundColor: "#6366F1",
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  periodPillTextActive: {
    color: "#fff",
  },

  // User Stats
  userStatsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  userStatCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userStatValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
  },
  userStatLabel: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
    marginLeft: 12,
  },
  userStatTotal: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  // Platform Grid
  platformGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  // Applications
  applicationsSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
  },
  applicationsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  appCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  appValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  appLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // Business Grid
  businessGrid: {
    flexDirection: "row",
    gap: 10,
  },
  businessCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  businessCardHighlight: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  businessLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  businessValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  businessValueLarge: {
    fontSize: 22,
    fontWeight: "700",
    color: "#D97706",
  },

  // Loyalty
  loyaltyGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  loyaltyCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  loyaltyValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },
  loyaltyLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  loyaltyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  loyaltyBannerText: {
    fontSize: 12,
    color: "#065F46",
    fontWeight: "500",
  },

  // Repeat
  repeatGrid: {
    flexDirection: "row",
    gap: 10,
  },
  repeatCardLarge: {
    flex: 2,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatValueLarge: {
    fontSize: 32,
    fontWeight: "700",
  },
  repeatStack: {
    flex: 1,
    gap: 10,
  },
  repeatCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  repeatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  repeatLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // Churn
  churnGrid: {
    flexDirection: "row",
    gap: 10,
  },
  churnCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  churnValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  churnLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
    textAlign: "center",
  },

  // Reliability
  reliabilityGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  reliabilityCardLarge: {
    flex: 2,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reliabilityCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  reliabilityValueLarge: {
    fontSize: 28,
    fontWeight: "700",
  },
  reliabilityValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  reliabilityLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },

  // Top Performers
  topPerformers: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
  },
  performerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  performerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  performerRankText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4F46E5",
  },
  performerName: {
    flex: 1,
    fontSize: 13,
    color: "#1F2937",
  },
  performerStats: {
    alignItems: "flex-end",
  },
  performerRate: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  performerCount: {
    fontSize: 10,
    color: "#9CA3AF",
  },

  // Signups
  signupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  signupCard: {
    flex: 1,
    minWidth: (screenWidth - 80) / 2 - 5,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  signupCardHighlight: {
    minWidth: "100%",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  signupValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  signupValueLarge: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4F46E5",
  },
  signupLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },

  // Sessions
  sessionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  // Engagement
  engagementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  engagementCard: {
    flex: 1,
    minWidth: (screenWidth - 80) / 2 - 5,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: "#6366F1",
  },
  engagementValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4F46E5",
  },
  engagementLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },

  // Retention
  retentionContainer: {
    gap: 12,
  },
  progressBarContainer: {
    marginBottom: 4,
  },
  progressBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressBarLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  progressBarValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },

  // Devices
  deviceGrid: {
    flexDirection: "row",
    gap: 10,
  },
  deviceCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderLeftWidth: 4,
  },
  deviceValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 8,
  },
  deviceLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
});

export default OwnerDashboard;
