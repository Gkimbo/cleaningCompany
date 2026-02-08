import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Metric Card Component
const MetricCard = ({ icon, label, value, subValue, change, color = colors.primary[600] }) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIcon, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
    {subValue && <Text style={styles.metricSubValue}>{subValue}</Text>}
    {change !== undefined && (
      <View style={[styles.changeTag, change >= 0 ? styles.changePositive : styles.changeNegative]}>
        <Icon name={change >= 0 ? "arrow-up" : "arrow-down"} size={10} color={change >= 0 ? colors.success[700] : colors.error[700]} />
        <Text style={[styles.changeText, change >= 0 ? styles.changeTextPositive : styles.changeTextNegative]}>
          {Math.abs(change)}%
        </Text>
      </View>
    )}
  </View>
);

// Premium Lock Overlay
const PremiumLock = ({ onPress, cleaningsNeeded }) => (
  <Pressable style={styles.premiumLock} onPress={onPress}>
    <View style={styles.premiumLockContent}>
      <Icon name="lock" size={24} color={colors.neutral[400]} />
      <Text style={styles.premiumLockTitle}>Premium Feature</Text>
      <Text style={styles.premiumLockText}>
        {cleaningsNeeded > 0
          ? `Complete ${cleaningsNeeded} more jobs this month to unlock`
          : "Available for high-volume businesses (50+ jobs/month)"}
      </Text>
    </View>
  </Pressable>
);

// Employee Performance Row
const EmployeeRow = ({ employee, rank }) => (
  <View style={styles.employeeRow}>
    <View style={styles.employeeRank}>
      <Text style={styles.employeeRankText}>{rank}</Text>
    </View>
    <View style={styles.employeeInfo}>
      <Text style={styles.employeeName}>{employee.name}</Text>
      <Text style={styles.employeeStats}>
        {employee.jobsCompleted} jobs | {employee.totalRevenueFormatted}
      </Text>
    </View>
    <View style={styles.employeeMetrics}>
      {employee.avgRating && (
        <View style={styles.ratingBadge}>
          <Icon name="star" size={12} color={colors.warning[500]} />
          <Text style={styles.ratingText}>{employee.avgRating.toFixed(1)}</Text>
        </View>
      )}
      <Text style={styles.completionRate}>{employee.completionRate}%</Text>
    </View>
  </View>
);

// Client Row
const ClientRow = ({ client, isAtRisk }) => (
  <View style={[styles.clientRow, isAtRisk && styles.clientRowAtRisk]}>
    <View style={styles.clientInfo}>
      <Text style={styles.clientName}>{client.name}</Text>
      <Text style={styles.clientStats}>
        {client.bookingCount} bookings | {client.totalRevenueFormatted}
      </Text>
    </View>
    {isAtRisk && (
      <View style={styles.atRiskBadge}>
        <Icon name="exclamation-triangle" size={12} color={colors.warning[600]} />
        <Text style={styles.atRiskText}>At Risk</Text>
      </View>
    )}
  </View>
);

// Enhanced Revenue Chart Component
const RevenueChart = ({ data, maxBars = 6 }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Icon name="bar-chart" size={32} color={colors.neutral[300]} />
        <Text style={styles.emptyChartText}>No revenue data yet</Text>
      </View>
    );
  }

  const displayData = data.slice(-maxBars);
  const maxValue = Math.max(...displayData.map((d) => d.revenue || 0));
  const totalRevenue = displayData.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const avgRevenue = displayData.length > 0 ? totalRevenue / displayData.length : 0;

  // Find highest and lowest months
  const sortedByRevenue = [...displayData].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const highestMonth = sortedByRevenue[0];
  const lowestMonth = sortedByRevenue[sortedByRevenue.length - 1];

  return (
    <View style={styles.revenueChartContainer}>
      {/* Summary Stats */}
      <View style={styles.chartSummary}>
        <View style={styles.chartSummaryItem}>
          <Text style={styles.chartSummaryLabel}>Total</Text>
          <Text style={styles.chartSummaryValue}>${(totalRevenue / 100).toLocaleString()}</Text>
        </View>
        <View style={styles.chartSummaryDivider} />
        <View style={styles.chartSummaryItem}>
          <Text style={styles.chartSummaryLabel}>Average</Text>
          <Text style={styles.chartSummaryValue}>${(avgRevenue / 100).toLocaleString()}</Text>
        </View>
        <View style={styles.chartSummaryDivider} />
        <View style={styles.chartSummaryItem}>
          <Text style={styles.chartSummaryLabel}>Peak</Text>
          <Text style={[styles.chartSummaryValue, styles.chartSummaryPeak]}>
            ${((highestMonth?.revenue || 0) / 100).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Bar Chart */}
      <View style={styles.chartBarsContainer}>
        {displayData.map((item, index) => {
          const barHeight = maxValue > 0 ? ((item.revenue || 0) / maxValue) * 100 : 0;
          const isHighest = item === highestMonth && displayData.length > 1;
          const isLowest = item === lowestMonth && displayData.length > 1 && lowestMonth !== highestMonth;
          const isCurrentMonth = index === displayData.length - 1;

          return (
            <View key={index} style={styles.chartBarWrapper}>
              <View style={styles.chartBarValue}>
                <Text style={[styles.chartBarValueText, isHighest && styles.chartBarValueHighlight]}>
                  ${((item.revenue || 0) / 100).toLocaleString()}
                </Text>
              </View>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${barHeight}%`,
                    },
                    isHighest && styles.chartBarHighest,
                    isLowest && styles.chartBarLowest,
                    isCurrentMonth && !isHighest && !isLowest && styles.chartBarCurrent,
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, isCurrentMonth && styles.chartLabelCurrent]} numberOfLines={1}>
                {item.period?.split(" ")[0] || ""}
              </Text>
              {item.bookings > 0 && (
                <Text style={styles.chartBookings}>{item.bookings} jobs</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.chartLegendRow}>
        <View style={styles.chartLegendItem}>
          <View style={[styles.chartLegendDot, styles.chartLegendDotHighest]} />
          <Text style={styles.chartLegendText}>Best month</Text>
        </View>
        <View style={styles.chartLegendItem}>
          <View style={[styles.chartLegendDot, styles.chartLegendDotCurrent]} />
          <Text style={styles.chartLegendText}>Current</Text>
        </View>
      </View>
    </View>
  );
};

// Section Header
const SectionHeader = ({ title, icon, isPremium, isLocked }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <Icon name={icon} size={16} color={colors.primary[600]} style={styles.sectionIcon} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {isPremium && (
        <View style={[styles.premiumBadge, isLocked && styles.premiumBadgeLocked]}>
          <Icon name={isLocked ? "lock" : "star"} size={10} color={isLocked ? colors.neutral[500] : colors.warning[500]} />
          <Text style={[styles.premiumBadgeText, isLocked && styles.premiumBadgeTextLocked]}>
            {isLocked ? "Locked" : "Premium"}
          </Text>
        </View>
      )}
    </View>
  </View>
);

// Main Analytics Dashboard Component
const BusinessAnalyticsDashboard = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth");

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await BusinessOwnerService.getAllAnalytics(state.currentUser.token, {
        months: 6,
      });
      setAnalytics(result);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = useCallback(() => {
    fetchAnalytics(true);
  }, [state.currentUser.token]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  const { access, overview, employees, clients, financials, trends } = analytics || {};
  const isPremium = access?.tier === "premium";
  const cleaningsNeeded = access?.qualification?.cleaningsNeeded || 0;

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Analytics</Text>
        <View style={[styles.tierBadge, isPremium ? styles.tierPremium : styles.tierStandard]}>
          <Icon name={isPremium ? "diamond" : "bar-chart"} size={12} color={isPremium ? colors.warning[600] : colors.neutral[600]} />
          <Text style={[styles.tierText, isPremium ? styles.tierTextPremium : styles.tierTextStandard]}>
            {isPremium ? "Premium" : "Standard"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

      {/* Tier Progress (if not premium) */}
      {!isPremium && (
        <View style={styles.tierProgress}>
          <Text style={styles.tierProgressText}>
            {access?.qualification?.currentCleanings || 0} / {access?.qualification?.threshold || 50} jobs this month
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(((access?.qualification?.currentCleanings || 0) / (access?.qualification?.threshold || 50)) * 100, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.tierProgressHint}>
            Complete {cleaningsNeeded} more jobs to unlock premium analytics
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => fetchAnalytics()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Overview Metrics */}
      <View style={styles.section}>
        <SectionHeader title="Overview" icon="dashboard" />
        <View style={styles.metricsGrid}>
          <MetricCard
            icon="calendar-check-o"
            label="Bookings This Month"
            value={overview?.bookings?.thisMonth || 0}
            change={overview?.bookings?.changePercent}
            color={colors.primary[600]}
          />
          <MetricCard
            icon="dollar"
            label="Revenue This Month"
            value={overview?.revenue?.thisMonthFormatted || "$0"}
            change={overview?.revenue?.changePercent}
            color={colors.success[600]}
          />
          <MetricCard
            icon="bar-chart"
            label="Avg Job Value"
            value={overview?.averageJobValueFormatted || "$0"}
            color={colors.secondary[600]}
          />
          <MetricCard
            icon="users"
            label="Active Employees"
            value={overview?.activeEmployees || 0}
            subValue={`${overview?.activeClients || 0} clients`}
            color={colors.primary[600]}
          />
        </View>
      </View>

      {/* Financial Summary */}
      <View style={styles.section}>
        <SectionHeader title="Financial Summary" icon="pie-chart" />

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {[
            { key: "thisWeek", label: "Week" },
            { key: "thisMonth", label: "Month" },
            { key: "lastMonth", label: "Last Mo" },
            { key: "allTime", label: "All" },
          ].map((period) => (
            <Pressable
              key={period.key}
              style={[
                styles.periodOption,
                selectedPeriod === period.key && styles.periodOptionSelected,
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text
                style={[
                  styles.periodOptionText,
                  selectedPeriod === period.key && styles.periodOptionTextSelected,
                ]}
              >
                {period.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <View style={[styles.quickStatCard, styles.quickStatProfit]}>
            <Icon name="line-chart" size={16} color={colors.success[600]} />
            <Text style={styles.quickStatValue}>
              {financials?.periods?.[selectedPeriod]?.netProfitFormatted || "$0"}
            </Text>
            <Text style={styles.quickStatLabel}>Net Profit</Text>
          </View>
          <View style={[styles.quickStatCard, styles.quickStatJobs]}>
            <Icon name="check-circle" size={16} color={colors.primary[600]} />
            <Text style={styles.quickStatValue}>
              {financials?.periods?.[selectedPeriod]?.jobCount || 0}
            </Text>
            <Text style={styles.quickStatLabel}>Jobs Done</Text>
          </View>
          <View style={[styles.quickStatCard, styles.quickStatMargin]}>
            <Icon name="percent" size={16} color={colors.warning[600]} />
            <Text style={styles.quickStatValue}>
              {financials?.periods?.[selectedPeriod]?.profitMargin || 0}%
            </Text>
            <Text style={styles.quickStatLabel}>Margin</Text>
          </View>
        </View>

        {/* Completed Revenue Breakdown */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIconBadge, styles.cardIconSuccess]}>
                <Icon name="check" size={12} color={colors.success[600]} />
              </View>
              <Text style={styles.cardTitle}>Completed</Text>
            </View>
            <View style={styles.jobCountBadge}>
              <Text style={styles.jobCountText}>{financials?.periods?.[selectedPeriod]?.jobCount || 0} jobs</Text>
            </View>
          </View>

          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <Icon name="dollar" size={12} color={colors.text.tertiary} />
                <Text style={styles.breakdownLabel}>Gross Revenue</Text>
              </View>
              <Text style={styles.breakdownValue}>
                {financials?.periods?.[selectedPeriod]?.grossRevenueFormatted || "$0.00"}
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <Icon name="minus-circle" size={12} color={colors.error[400]} />
                <Text style={styles.breakdownLabel}>Platform Fee ({financials?.feeTier?.feePercent || 0}%)</Text>
              </View>
              <Text style={[styles.breakdownValue, styles.breakdownNegative]}>
                -{financials?.periods?.[selectedPeriod]?.platformFeesFormatted || "$0.00"}
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <Icon name="users" size={12} color={colors.error[400]} />
                <Text style={styles.breakdownLabel}>Employee Payroll</Text>
              </View>
              <Text style={[styles.breakdownValue, styles.breakdownNegative]}>
                -{financials?.periods?.[selectedPeriod]?.totalPayrollFormatted || "$0.00"}
              </Text>
            </View>
          </View>

          <View style={styles.profitResultContainer}>
            <View style={styles.profitResultRow}>
              <Text style={styles.profitResultLabel}>Your Profit</Text>
              <Text
                style={[
                  styles.profitResultValue,
                  (financials?.periods?.[selectedPeriod]?.netProfit || 0) >= 0
                    ? styles.profitPositive
                    : styles.profitNegative,
                ]}
              >
                {financials?.periods?.[selectedPeriod]?.netProfitFormatted || "$0.00"}
              </Text>
            </View>
            {(financials?.periods?.[selectedPeriod]?.profitMargin || 0) > 0 && (
              <View style={styles.marginIndicator}>
                <View
                  style={[
                    styles.marginBar,
                    { width: `${Math.min(financials?.periods?.[selectedPeriod]?.profitMargin || 0, 100)}%` }
                  ]}
                />
                <Text style={styles.marginText}>
                  {financials?.periods?.[selectedPeriod]?.profitMargin}% margin
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Upcoming Jobs */}
        <View style={[styles.sectionCard, styles.upcomingCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIconBadge, styles.cardIconPending]}>
                <Icon name="clock-o" size={12} color={colors.primary[600]} />
              </View>
              <Text style={styles.cardTitle}>Upcoming</Text>
            </View>
            <View style={[styles.jobCountBadge, styles.jobCountPending]}>
              <Text style={[styles.jobCountText, styles.jobCountTextPending]}>
                {financials?.pending?.jobCount || 0} scheduled
              </Text>
            </View>
          </View>

          {(financials?.pending?.jobCount || 0) > 0 ? (
            <>
              <View style={styles.breakdownContainer}>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="dollar" size={12} color={colors.text.tertiary} />
                    <Text style={styles.breakdownLabel}>Expected Revenue</Text>
                  </View>
                  <Text style={[styles.breakdownValue, styles.breakdownPending]}>
                    {financials?.pending?.grossRevenueFormatted || "$0.00"}
                  </Text>
                </View>

                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="minus-circle" size={12} color={colors.primary[400]} />
                    <Text style={styles.breakdownLabel}>Est. Platform Fee</Text>
                  </View>
                  <Text style={[styles.breakdownValue, styles.breakdownPendingNeg]}>
                    -{financials?.pending?.platformFeesFormatted || "$0.00"}
                  </Text>
                </View>

                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="users" size={12} color={colors.primary[400]} />
                    <Text style={styles.breakdownLabel}>Est. Payroll</Text>
                  </View>
                  <Text style={[styles.breakdownValue, styles.breakdownPendingNeg]}>
                    -{financials?.pending?.totalPayrollFormatted || "$0.00"}
                  </Text>
                </View>
              </View>

              <View style={[styles.profitResultContainer, styles.profitResultPending]}>
                <View style={styles.profitResultRow}>
                  <Text style={styles.profitResultLabel}>Expected Profit</Text>
                  <Text style={[styles.profitResultValue, styles.profitPending]}>
                    {financials?.pending?.netProfitFormatted || "$0.00"}
                  </Text>
                </View>
                {(financials?.pending?.profitMargin || 0) > 0 && (
                  <Text style={styles.expectedMarginText}>
                    Est. {financials?.pending?.profitMargin}% margin
                  </Text>
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyUpcoming}>
              <Icon name="calendar-o" size={24} color={colors.neutral[300]} />
              <Text style={styles.emptyUpcomingText}>No upcoming jobs scheduled</Text>
            </View>
          )}
        </View>

        {/* Payment Status Grid */}
        <View style={styles.paymentStatusGrid}>
          {/* Payroll Status */}
          <View style={[styles.statusCard, styles.statusCardLeft]}>
            <View style={styles.statusCardHeader}>
              <Icon name="users" size={14} color={colors.primary[600]} />
              <Text style={styles.statusCardTitle}>Payroll</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotSuccess]} />
              <Text style={styles.statusLabel}>Paid</Text>
              <Text style={[styles.statusValue, styles.statusValueSuccess]}>
                {financials?.payrollStatus?.paidFormatted || "$0"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotWarning]} />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={[styles.statusValue, styles.statusValueWarning]}>
                {financials?.payrollStatus?.pendingFormatted || "$0"}
              </Text>
            </View>
          </View>

          {/* Client Payments */}
          <View style={[styles.statusCard, styles.statusCardRight]}>
            <View style={styles.statusCardHeader}>
              <Icon name="credit-card" size={14} color={colors.success[600]} />
              <Text style={styles.statusCardTitle}>Payments</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotSuccess]} />
              <Text style={styles.statusLabel}>Collected</Text>
              <Text style={[styles.statusValue, styles.statusValueSuccess]}>
                {financials?.clientPayments?.collectedFormatted || "$0"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotWarning]} />
              <Text style={styles.statusLabel}>Outstanding</Text>
              <Text style={[styles.statusValue, styles.statusValueWarning]}>
                {financials?.clientPayments?.outstandingFormatted || "$0"}
              </Text>
            </View>
          </View>
        </View>

        {/* Fee Tier Card */}
        <View style={styles.feeTierCard}>
          <View style={styles.feeTierContent}>
            <View style={styles.feeTierMain}>
              <View style={[
                styles.tierBadgeSmall,
                financials?.feeTier?.current === "large_business" ? styles.tierBadgePremium : styles.tierBadgeStandard
              ]}>
                <Icon
                  name={financials?.feeTier?.current === "large_business" ? "star" : "briefcase"}
                  size={10}
                  color={financials?.feeTier?.current === "large_business" ? colors.warning[600] : colors.primary[600]}
                />
                <Text style={[
                  styles.tierBadgeText,
                  financials?.feeTier?.current === "large_business" ? styles.tierBadgeTextPremium : styles.tierBadgeTextStandard
                ]}>
                  {financials?.feeTier?.current === "large_business" ? "Large Business" : "Business Owner"}
                </Text>
              </View>
              <Text style={styles.feeRateText}>{financials?.feeTier?.feePercent || 0}% platform fee</Text>
            </View>
            {financials?.feeTier?.cleaningsToQualify > 0 && (
              <View style={styles.feeTierProgressContainer}>
                <View style={styles.tierProgressBar}>
                  <View
                    style={[
                      styles.tierProgressFill,
                      {
                        width: `${Math.min(
                          ((50 - (financials?.feeTier?.cleaningsToQualify || 0)) / 50) * 100,
                          100
                        )}%`
                      }
                    ]}
                  />
                </View>
                <Text style={styles.tierProgressText}>
                  {financials?.feeTier?.cleaningsToQualify} more jobs to unlock 7% rate
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Revenue Trend */}
      <View style={styles.section}>
        <SectionHeader title="Revenue Trend" icon="line-chart" />
        <View style={styles.revenueChartCard}>
          <RevenueChart data={trends?.data || []} maxBars={6} />
        </View>
      </View>

      {/* Employee Performance (Premium) */}
      <View style={styles.section}>
        <SectionHeader title="Top Performers" icon="trophy" isPremium isLocked={!isPremium} />
        <View style={styles.sectionCard}>
          {!isPremium ? (
            <PremiumLock cleaningsNeeded={cleaningsNeeded} />
          ) : employees?.employees?.length > 0 ? (
            employees.employees.slice(0, 5).map((emp, index) => (
              <EmployeeRow key={emp.employeeId} employee={emp} rank={index + 1} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No employee data available</Text>
            </View>
          )}
        </View>
      </View>

      {/* Client Insights (Premium) */}
      <View style={styles.section}>
        <SectionHeader title="Client Insights" icon="users" isPremium isLocked={!isPremium} />
        <View style={styles.sectionCard}>
          {!isPremium ? (
            <PremiumLock cleaningsNeeded={cleaningsNeeded} />
          ) : (
            <>
              <View style={styles.clientMetrics}>
                <View style={styles.clientMetric}>
                  <Text style={styles.clientMetricValue}>{clients?.totalClients || 0}</Text>
                  <Text style={styles.clientMetricLabel}>Total Clients</Text>
                </View>
                <View style={styles.clientMetric}>
                  <Text style={styles.clientMetricValue}>{clients?.newClientsThisMonth || 0}</Text>
                  <Text style={styles.clientMetricLabel}>New This Month</Text>
                </View>
                <View style={styles.clientMetric}>
                  <Text style={styles.clientMetricValue}>{clients?.metrics?.retentionRate || 0}%</Text>
                  <Text style={styles.clientMetricLabel}>Retention Rate</Text>
                </View>
              </View>

              {clients?.atRiskClients?.length > 0 && (
                <View style={styles.atRiskSection}>
                  <Text style={styles.atRiskTitle}>At-Risk Clients ({clients.atRiskCount})</Text>
                  {clients.atRiskClients.slice(0, 3).map((client) => (
                    <ClientRow key={client.clientId} client={client} isAtRisk />
                  ))}
                </View>
              )}

              {clients?.topClients?.length > 0 && (
                <View style={styles.topClientsSection}>
                  <Text style={styles.topClientsTitle}>Top Clients</Text>
                  {clients.topClients.slice(0, 3).map((client) => (
                    <ClientRow key={client.clientId} client={client} />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  scrollView: {
    flex: 1,
  },
  tierPremium: {
    backgroundColor: colors.warning[100],
  },
  tierStandard: {
    backgroundColor: colors.neutral[100],
  },
  tierText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  tierTextPremium: {
    color: colors.warning[700],
  },
  tierTextStandard: {
    color: colors.neutral[600],
  },
  tierProgress: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  tierProgressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  tierProgressHint: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.error[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error[600],
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  retryText: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  premiumBadgeLocked: {
    backgroundColor: colors.neutral[100],
  },
  premiumBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    marginLeft: 4,
  },
  premiumBadgeTextLocked: {
    color: colors.neutral[500],
  },
  sectionCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  metricLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  metricSubValue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  changeTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  changePositive: {
    backgroundColor: colors.success[100],
  },
  changeNegative: {
    backgroundColor: colors.error[100],
  },
  changeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 2,
  },
  changeTextPositive: {
    color: colors.success[700],
  },
  changeTextNegative: {
    color: colors.error[700],
  },
  premiumLock: {
    padding: spacing.xl,
    alignItems: "center",
  },
  premiumLockContent: {
    alignItems: "center",
  },
  premiumLockTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  premiumLockText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 250,
  },
  chartContainer: {
    height: 120,
    marginTop: spacing.sm,
  },
  chartBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: "center",
  },
  chartBar: {
    width: "100%",
    backgroundColor: colors.primary[400],
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  chartCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  chartLegend: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  chartLegendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  // Enhanced Revenue Chart Styles
  revenueChartCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  revenueChartContainer: {
    gap: spacing.lg,
  },
  emptyChart: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyChartText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  chartSummary: {
    flexDirection: "row",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  chartSummaryItem: {
    flex: 1,
    alignItems: "center",
  },
  chartSummaryDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.xs,
  },
  chartSummaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  chartSummaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  chartSummaryPeak: {
    color: colors.success[600],
  },
  chartBarsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: spacing.xs,
  },
  chartBarTrack: {
    flex: 1,
    height: 100,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBarValue: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  chartBarValueText: {
    fontSize: 9,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  chartBarValueHighlight: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
  },
  chartBarHighest: {
    backgroundColor: colors.success[500],
  },
  chartBarLowest: {
    backgroundColor: colors.neutral[300],
  },
  chartBarCurrent: {
    backgroundColor: colors.primary[500],
  },
  chartLabelCurrent: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  chartBookings: {
    fontSize: 8,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  chartLegendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  chartLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chartLegendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  chartLegendDotHighest: {
    backgroundColor: colors.success[500],
  },
  chartLegendDotCurrent: {
    backgroundColor: colors.primary[500],
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  employeeRank: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeRankText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  employeeStats: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeeMetrics: {
    alignItems: "flex-end",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  ratingText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.semibold,
    marginLeft: 2,
  },
  completionRate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  clientMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.lg,
  },
  clientMetric: {
    alignItems: "center",
  },
  clientMetricValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  clientMetricLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  atRiskSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  atRiskTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.sm,
  },
  topClientsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  topClientsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  clientRowAtRisk: {
    backgroundColor: colors.warning[50],
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  clientStats: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  atRiskBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  atRiskText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    marginLeft: 4,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  financialLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  financialValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  financialLabelBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  financialValueBold: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  financialPositive: {
    color: colors.success[600],
  },
  financialNegative: {
    color: colors.error[600],
  },
  financialDivider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.sm,
  },
  profitMargin: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    alignItems: "center",
  },
  profitMarginText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  periodOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    alignItems: "center",
  },
  periodOptionSelected: {
    backgroundColor: colors.primary[600],
  },
  periodOptionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  periodOptionTextSelected: {
    color: colors.neutral[0],
  },
  financialSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pendingCard: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  financialPending: {
    color: colors.primary[600],
  },
  financialWarning: {
    color: colors.warning[600],
  },
  countText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.normal,
  },
  // Quick Stats Row
  quickStatsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  quickStatProfit: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success[500],
  },
  quickStatJobs: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  quickStatMargin: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  quickStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  quickStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Card Header
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardIconBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  cardIconSuccess: {
    backgroundColor: colors.success[100],
  },
  cardIconPending: {
    backgroundColor: colors.primary[100],
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobCountBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  jobCountPending: {
    backgroundColor: colors.primary[100],
  },
  jobCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  jobCountTextPending: {
    color: colors.primary[700],
  },
  // Breakdown
  breakdownContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  breakdownLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  breakdownValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  breakdownNegative: {
    color: colors.error[600],
  },
  breakdownPending: {
    color: colors.primary[600],
  },
  breakdownPendingNeg: {
    color: colors.primary[400],
  },
  // Profit Result
  profitResultContainer: {
    backgroundColor: colors.success[50],
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  profitResultPending: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  profitResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profitResultLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  profitResultValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  profitPositive: {
    color: colors.success[600],
  },
  profitNegative: {
    color: colors.error[600],
  },
  profitPending: {
    color: colors.primary[600],
  },
  marginIndicator: {
    marginTop: spacing.sm,
  },
  marginBar: {
    height: 4,
    backgroundColor: colors.success[400],
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  marginText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
  },
  expectedMarginText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.xs,
    textAlign: "right",
  },
  // Upcoming Card
  upcomingCard: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
  },
  emptyUpcoming: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyUpcomingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  // Payment Status Grid
  paymentStatusGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  statusCardLeft: {
    marginRight: spacing.xs,
  },
  statusCardRight: {
    marginLeft: spacing.xs,
  },
  statusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  statusCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  statusDotSuccess: {
    backgroundColor: colors.success[500],
  },
  statusDotWarning: {
    backgroundColor: colors.warning[500],
  },
  statusLabel: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  statusValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  statusValueSuccess: {
    color: colors.success[600],
  },
  statusValueWarning: {
    color: colors.warning[600],
  },
  // Fee Tier Card
  feeTierCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  feeTierContent: {
    gap: spacing.sm,
  },
  feeTierMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  tierBadgeStandard: {
    backgroundColor: colors.primary[100],
  },
  tierBadgePremium: {
    backgroundColor: colors.warning[100],
  },
  tierBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  tierBadgeTextStandard: {
    color: colors.primary[700],
  },
  tierBadgeTextPremium: {
    color: colors.warning[700],
  },
  feeRateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  feeTierProgressContainer: {
    gap: spacing.xs,
  },
  tierProgressBar: {
    height: 6,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
  },
  tierProgressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  tierProgressText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default BusinessAnalyticsDashboard;
