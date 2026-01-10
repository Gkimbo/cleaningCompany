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

// Simple Bar Chart Component
const SimpleBarChart = ({ data, valueKey = "revenue", maxBars = 6 }) => {
  if (!data || data.length === 0) return null;

  const displayData = data.slice(-maxBars);
  const maxValue = Math.max(...displayData.map((d) => d[valueKey] || 0));

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {displayData.map((item, index) => (
          <View key={index} style={styles.chartBarWrapper}>
            <View
              style={[
                styles.chartBar,
                {
                  height: maxValue > 0 ? (item[valueKey] / maxValue) * 100 : 0,
                },
              ]}
            />
            <Text style={styles.chartLabel} numberOfLines={1}>
              {item.period?.split(" ")[0] || ""}
            </Text>
          </View>
        ))}
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
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Business Analytics</Text>
          <View style={[styles.tierBadge, isPremium ? styles.tierPremium : styles.tierStandard]}>
            <Icon name={isPremium ? "diamond" : "bar-chart"} size={12} color={isPremium ? colors.warning[600] : colors.neutral[600]} />
            <Text style={[styles.tierText, isPremium ? styles.tierTextPremium : styles.tierTextStandard]}>
              {isPremium ? "Premium" : "Standard"}
            </Text>
          </View>
        </View>
      </View>

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

      {/* Revenue Trend */}
      <View style={styles.section}>
        <SectionHeader title="Revenue Trend" icon="line-chart" />
        <View style={styles.chartCard}>
          <SimpleBarChart data={trends?.data || []} valueKey="revenue" maxBars={6} />
          {trends?.data?.length > 0 && (
            <View style={styles.chartLegend}>
              <Text style={styles.chartLegendText}>Last {trends.data.length} months</Text>
            </View>
          )}
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

      {/* Financial Summary (Premium) */}
      <View style={styles.section}>
        <SectionHeader title="Financial Summary" icon="pie-chart" isPremium isLocked={!isPremium} />
        <View style={styles.sectionCard}>
          {!isPremium ? (
            <PremiumLock cleaningsNeeded={cleaningsNeeded} />
          ) : (
            <>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Gross Revenue</Text>
                <Text style={styles.financialValue}>{financials?.summary?.grossRevenueFormatted || "$0"}</Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Platform Fees ({financials?.summary?.platformFeePercent || 0}%)</Text>
                <Text style={[styles.financialValue, styles.financialNegative]}>
                  -{financials?.summary?.platformFeesFormatted || "$0"}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Payroll</Text>
                <Text style={[styles.financialValue, styles.financialNegative]}>
                  -{financials?.summary?.totalPayrollFormatted || "$0"}
                </Text>
              </View>
              <View style={styles.financialDivider} />
              <View style={styles.financialRow}>
                <Text style={styles.financialLabelBold}>Net Profit</Text>
                <Text
                  style={[
                    styles.financialValueBold,
                    (financials?.summary?.netProfit || 0) >= 0 ? styles.financialPositive : styles.financialNegative,
                  ]}
                >
                  {financials?.summary?.netProfitFormatted || "$0"}
                </Text>
              </View>
              <View style={styles.profitMargin}>
                <Text style={styles.profitMarginText}>
                  Profit Margin: {financials?.summary?.profitMargin || 0}%
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.background.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
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
    marginLeft: 4,
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
    marginHorizontal: 4,
  },
  chartBar: {
    width: "80%",
    backgroundColor: colors.primary[500],
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
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
