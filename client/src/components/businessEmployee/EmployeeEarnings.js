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
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessEmployeeService from "../../services/fetchRequests/BusinessEmployeeService";
import OfflineBusinessEmployeeService from "../../services/offline/OfflineBusinessEmployeeService";
import useSafeNavigation from "../../hooks/useSafeNavigation";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { toLocalDateString } from "../../services/formatters";

// Payout Status Colors
const PAYOUT_STATUS_COLORS = {
  pending: { bg: colors.warning[100], text: colors.warning[700], label: "Pending" },
  processing: { bg: colors.primary[100], text: colors.primary[700], label: "Processing" },
  paid: { bg: colors.success[100], text: colors.success[700], label: "Paid" },
  paid_outside_platform: { bg: colors.success[100], text: colors.success[700], label: "Paid" },
};

// Stats Card Component
const StatsCard = ({ icon, label, value, subValue, color }) => (
  <View style={styles.statsCard}>
    <View style={[styles.statsIcon, { backgroundColor: color + "20" }]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statsValue}>{value}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
    {subValue && <Text style={styles.statsSubValue}>{subValue}</Text>}
  </View>
);

// Earning Row Component
const EarningRow = ({ job, payConfig }) => {
  const statusInfo = PAYOUT_STATUS_COLORS[job.status] || PAYOUT_STATUS_COLORS.pending;

  const formatDate = (dateStr) => {
    // Use noon to avoid timezone edge cases when parsing YYYY-MM-DD strings
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Build pay breakdown string based on pay type
  const getPayBreakdown = () => {
    if (!payConfig) return null;

    if (payConfig.payType === "hourly" && job.hoursWorked && payConfig.hourlyRate) {
      const hourlyRate = payConfig.hourlyRate / 100;
      return `${job.hoursWorked} hrs @ $${hourlyRate.toFixed(2)}/hr`;
    } else if (payConfig.payType === "percentage" && payConfig.percentRate && job.payAmount) {
      // For percentage, calculate the original job price from pay amount
      const originalPrice = (job.payAmount / 100) / (payConfig.percentRate / 100);
      return `${payConfig.percentRate.toFixed(0)}% of $${originalPrice.toFixed(0)}`;
    } else if (payConfig.payType === "per_job" && payConfig.jobRate) {
      return `Flat rate`;
    }
    return null;
  };

  const breakdown = getPayBreakdown();

  return (
    <View style={styles.earningRow}>
      <View style={styles.earningDateCol}>
        <Text style={styles.earningDate}>{formatDate(job.date)}</Text>
        {breakdown && (
          <Text style={styles.earningBreakdown}>{breakdown}</Text>
        )}
      </View>
      <View style={styles.earningDetailsCol}>
        <Text style={styles.earningAmount}>{job.formattedPay}</Text>
        <View style={[styles.earningStatusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.earningStatusText, { color: statusInfo.text }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Period Selector Component
const PeriodSelector = ({ selected, onSelect }) => {
  const periods = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "Quarter" },
    { value: "year", label: "Year" },
  ];

  return (
    <View style={styles.periodSelector}>
      {periods.map((period) => (
        <Pressable
          key={period.value}
          style={[
            styles.periodOption,
            selected === period.value && styles.periodOptionActive,
          ]}
          onPress={() => onSelect(period.value)}
        >
          <Text
            style={[
              styles.periodOptionText,
              selected === period.value && styles.periodOptionTextActive,
            ]}
          >
            {period.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

// Pay Rate Card Component
const PayRateCard = ({ profile }) => {
  if (!profile?.formattedPayRate) return null;

  const getPayTypeLabel = () => {
    switch (profile.payType) {
      case "hourly":
        return "Hourly Rate";
      case "per_job":
        return "Per Job Rate";
      case "percentage":
        return "Commission Rate";
      default:
        return "Pay Rate";
    }
  };

  const getPayTypeIcon = () => {
    switch (profile.payType) {
      case "hourly":
        return "clock-o";
      case "per_job":
        return "briefcase";
      case "percentage":
        return "percent";
      default:
        return "dollar";
    }
  };

  return (
    <View style={styles.payRateCard}>
      <View style={styles.payRateIconContainer}>
        <Icon name={getPayTypeIcon()} size={18} color={colors.primary[600]} />
      </View>
      <View style={styles.payRateInfo}>
        <Text style={styles.payRateLabel}>{getPayTypeLabel()}</Text>
        <Text style={styles.payRateValue}>{profile.formattedPayRate}</Text>
      </View>
    </View>
  );
};

// Upcoming Job Row Component
const UpcomingJobRow = ({ job, onPress }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const getEstimatedDuration = () => {
    const home = job.appointment?.home;
    if (!home) return "~2 hrs";
    const beds = parseInt(home.numBeds) || 2;
    const baths = parseInt(home.numBaths) || 1;
    const hours = Math.ceil((1 + beds * 0.25 + baths * 0.5) * 2) / 2;
    return `~${hours} hr${hours !== 1 ? "s" : ""}`;
  };

  const payAmount = (job.payAmount || 0) / 100;

  return (
    <Pressable style={styles.upcomingJobRow} onPress={onPress}>
      <View style={styles.upcomingJobDate}>
        <Text style={styles.upcomingJobDateText}>{formatDate(job.appointment?.date)}</Text>
        <Text style={styles.upcomingJobDuration}>{getEstimatedDuration()}</Text>
      </View>
      <View style={styles.upcomingJobInfo}>
        <Text style={styles.upcomingJobAddress} numberOfLines={1}>
          {job.appointment?.home?.address || "Address TBD"}
        </Text>
        {job.appointment?.home?.numBeds && (
          <Text style={styles.upcomingJobMeta}>
            {job.appointment.home.numBeds}bd · {job.appointment.home.numBaths}ba
          </Text>
        )}
      </View>
      <View style={styles.upcomingJobPay}>
        <Text style={styles.upcomingJobPayAmount}>${payAmount.toFixed(0)}</Text>
        {job.isEstimate && <Text style={styles.upcomingJobPayEst}>est</Text>}
      </View>
    </Pressable>
  );
};

// Main Component
const EmployeeEarnings = ({ state }) => {
  const { goBack, navigate } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [upcomingJobs, setUpcomingJobs] = useState([]);
  const [upcomingTotal, setUpcomingTotal] = useState(0);
  const [earnings, setEarnings] = useState({
    period: {},
    summary: {
      totalEarnings: 0,
      jobCount: 0,
      paidCount: 0,
      pendingCount: 0,
      pendingAmount: 0,
    },
    formatted: {
      totalEarnings: "$0.00",
      pendingAmount: "$0.00",
    },
    jobs: [],
    payConfig: null,
  });
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("month");

  const getPeriodDates = (selectedPeriod) => {
    const now = new Date();
    let startDate, endDate;

    switch (selectedPeriod) {
      case "week":
        // Start of current week (Sunday)
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = now;
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = now;
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    return {
      startDate: toLocalDateString(startDate),
      endDate: toLocalDateString(endDate),
    };
  };

  const fetchProfile = async () => {
    try {
      const result = await BusinessEmployeeService.getProfile(state.currentUser.token);
      if (result?.profile) {
        setProfile(result.profile);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const fetchUpcomingJobs = async () => {
    try {
      const result = await OfflineBusinessEmployeeService.getMyJobs(
        state.currentUser.token,
        { upcoming: true }
      );
      const jobs = result.jobs || [];
      // Filter to only assigned (not started/completed) jobs
      const assignedJobs = jobs.filter(j => j.status === "assigned");
      setUpcomingJobs(assignedJobs);

      // Calculate total upcoming earnings
      const total = assignedJobs.reduce((sum, job) => sum + (job.payAmount || 0), 0);
      setUpcomingTotal(total);
    } catch (err) {
      console.error("Error fetching upcoming jobs:", err);
    }
  };

  const fetchEarnings = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { startDate, endDate } = getPeriodDates(period);
      const [earningsResult] = await Promise.all([
        BusinessEmployeeService.getEarnings(
          state.currentUser.token,
          startDate,
          endDate
        ),
        !profile ? fetchProfile() : Promise.resolve(),
        fetchUpcomingJobs(),
      ]);

      setEarnings({
        period: earningsResult.period || {},
        summary: earningsResult.summary || {
          totalEarnings: 0,
          jobCount: 0,
          paidCount: 0,
          pendingCount: 0,
          pendingAmount: 0,
        },
        formatted: earningsResult.formatted || {
          totalEarnings: "$0.00",
          pendingAmount: "$0.00",
        },
        jobs: earningsResult.jobs || [],
        payConfig: earningsResult.payConfig || null,
      });
    } catch (err) {
      console.error("Error fetching earnings:", err);
      setError("Failed to load earnings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [period]);

  const onRefresh = useCallback(() => {
    fetchEarnings(true);
  }, [state.currentUser.token, period]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  const { summary, formatted, jobs, payConfig } = earnings;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>My Earnings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Period Selector */}
      <PeriodSelector selected={period} onSelect={handlePeriodChange} />

      {error && (
        <View style={styles.errorMessage}>
          <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorMessageText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Total Earnings Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Earnings</Text>
          <Text style={styles.totalAmount}>{formatted.totalEarnings}</Text>
          <Text style={styles.totalPeriod}>
            {period === "week" && "This Week"}
            {period === "month" && "This Month"}
            {period === "quarter" && "This Quarter"}
            {period === "year" && "This Year"}
          </Text>
        </View>

        {/* Pay Rate Card */}
        <PayRateCard profile={profile} />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatsCard
            icon="briefcase"
            label="Jobs Completed"
            value={summary.jobCount}
            color={colors.primary[600]}
          />
          <StatsCard
            icon="check-circle"
            label="Payments Received"
            value={summary.paidCount}
            color={colors.success[600]}
          />
        </View>

        {/* Pending Earnings Alert */}
        {summary.pendingCount > 0 && (
          <View style={styles.pendingCard}>
            <Icon name="clock-o" size={20} color={colors.warning[700]} />
            <View style={styles.pendingInfo}>
              <Text style={styles.pendingTitle}>
                {summary.pendingCount} Payment{summary.pendingCount > 1 ? "s" : ""} Pending
              </Text>
              <Text style={styles.pendingAmount}>{formatted.pendingAmount}</Text>
            </View>
          </View>
        )}

        {/* Upcoming Earnings Section */}
        {upcomingJobs.length > 0 && (
          <View style={styles.upcomingSection}>
            <View style={styles.upcomingSectionHeader}>
              <View style={styles.upcomingTitleRow}>
                <Icon name="calendar-check-o" size={18} color={colors.success[600]} />
                <Text style={styles.upcomingSectionTitle}>Upcoming Earnings</Text>
              </View>
              <View style={styles.upcomingTotalBadge}>
                <Text style={styles.upcomingTotalText}>
                  ${(upcomingTotal / 100).toFixed(0)}
                </Text>
              </View>
            </View>
            <Text style={styles.upcomingSubtitle}>
              {upcomingJobs.length} job{upcomingJobs.length !== 1 ? "s" : ""} scheduled
            </Text>
            <View style={styles.upcomingJobsList}>
              {upcomingJobs.slice(0, 5).map((job) => (
                <UpcomingJobRow
                  key={job.id}
                  job={job}
                  onPress={() => navigate(`/employee/jobs/${job.id}`)}
                />
              ))}
              {upcomingJobs.length > 5 && (
                <Pressable
                  style={styles.viewAllButton}
                  onPress={() => navigate("/employee/jobs")}
                >
                  <Text style={styles.viewAllButtonText}>
                    View all {upcomingJobs.length} jobs
                  </Text>
                  <Icon name="chevron-right" size={12} color={colors.primary[600]} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Earnings Breakdown */}
        {jobs && jobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earnings History</Text>
            <View style={styles.earningsTable}>
              {jobs.map((job, index) => (
                <EarningRow key={index} job={job} payConfig={payConfig} />
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {(!jobs || jobs.length === 0) && summary.jobCount === 0 && (
          <View style={styles.emptyState}>
            <Icon name="dollar" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyStateTitle}>No Earnings Yet</Text>
            <Text style={styles.emptyStateText}>
              Complete jobs to start earning
            </Text>
            <Pressable
              style={styles.viewJobsButton}
              onPress={() => navigate("/employee/jobs")}
            >
              <Text style={styles.viewJobsButtonText}>View My Jobs</Text>
            </Pressable>
          </View>
        )}

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <Icon name="info-circle" size={16} color={colors.primary[600]} />
          <Text style={styles.paymentInfoText}>
            Payment schedule and method are set by your employer. Contact them for
            questions about pending payments.
          </Text>
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
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  periodSelector: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  periodOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  periodOptionActive: {
    backgroundColor: colors.primary[600],
  },
  periodOptionText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  periodOptionTextActive: {
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  totalCard: {
    backgroundColor: colors.primary[600],
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    ...shadows.lg,
  },
  totalLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[100],
    marginBottom: spacing.xs,
  },
  totalAmount: {
    fontSize: typography.fontSize["4xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  totalPeriod: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[200],
    marginTop: spacing.xs,
  },
  payRateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
    ...shadows.sm,
  },
  payRateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  payRateInfo: {
    flex: 1,
  },
  payRateLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  payRateValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  statsCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  statsIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statsValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
    textAlign: "center",
  },
  statsSubValue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  pendingInfo: {
    marginLeft: spacing.md,
  },
  pendingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
  },
  pendingAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    marginTop: 2,
  },
  upcomingSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
    ...shadows.sm,
  },
  upcomingSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upcomingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  upcomingSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  upcomingTotalBadge: {
    backgroundColor: colors.success[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  upcomingTotalText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  upcomingSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    marginLeft: spacing.xl + spacing.sm,
  },
  upcomingJobsList: {
    marginTop: spacing.md,
  },
  upcomingJobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  upcomingJobDate: {
    width: 70,
    alignItems: "center",
  },
  upcomingJobDateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  upcomingJobDuration: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  upcomingJobInfo: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  upcomingJobAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  upcomingJobMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  upcomingJobPay: {
    alignItems: "flex-end",
  },
  upcomingJobPayAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  upcomingJobPayEst: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.xs,
  },
  viewAllButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  earningsTable: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.sm,
  },
  earningRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  earningDateCol: {
    flex: 1,
  },
  earningDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  earningBreakdown: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  earningDetailsCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  earningAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  earningStatusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  earningStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
    paddingHorizontal: spacing.lg,
  },
  emptyStateTitle: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyStateText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  viewJobsButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  viewJobsButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  paymentInfo: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  paymentInfoText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  errorMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error[600],
  },
  errorMessageText: {
    marginLeft: spacing.sm,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default EmployeeEarnings;
