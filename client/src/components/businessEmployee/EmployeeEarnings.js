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
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

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
const EarningRow = ({ job }) => {
  const statusInfo = PAYOUT_STATUS_COLORS[job.status] || PAYOUT_STATUS_COLORS.pending;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.earningRow}>
      <View style={styles.earningDateCol}>
        <Text style={styles.earningDate}>{formatDate(job.date)}</Text>
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

// Main Component
const EmployeeEarnings = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
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
      const result = await BusinessEmployeeService.getEarnings(
        state.currentUser.token,
        startDate,
        endDate
      );

      setEarnings({
        period: result.period || {},
        summary: result.summary || {
          totalEarnings: 0,
          jobCount: 0,
          paidCount: 0,
          pendingCount: 0,
          pendingAmount: 0,
        },
        formatted: result.formatted || {
          totalEarnings: "$0.00",
          pendingAmount: "$0.00",
        },
        jobs: result.jobs || [],
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

  const { summary, formatted, jobs } = earnings;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
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

        {/* Earnings Breakdown */}
        {jobs && jobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earnings History</Text>
            <View style={styles.earningsTable}>
              {jobs.map((job, index) => (
                <EarningRow key={index} job={job} />
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
    width: 60,
  },
  earningDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  earningDetailsCol: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
