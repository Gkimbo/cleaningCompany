import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import { formatCurrency } from "../../../services/formatters";

const StatCard = ({ icon, value, label, color, onPress }) => (
  <Pressable style={styles.statCard} onPress={onPress}>
    <View style={[styles.statIconContainer, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Pressable>
);

const DashboardOverview = ({ data, payrollOwed, pendingPayoutsCount, state }) => {
  const navigate = useNavigate();

  // Extract data from dashboard response
  const todaysJobs = data?.todaysAppointments || [];
  const weeklyRevenue = data?.weeklyRevenue || 0;
  const monthlyRevenue = data?.monthlyRevenue || 0;
  const unpaidAppointments = data?.unpaidAppointments || 0;
  const totalClients = data?.totalClients || 0;

  // Count jobs by status
  const assignedJobs = todaysJobs.filter(j => j.status === "assigned" || j.status === "scheduled").length;
  const startedJobs = todaysJobs.filter(j => j.status === "started").length;
  const completedJobs = todaysJobs.filter(j => j.status === "completed").length;
  const unassignedJobs = todaysJobs.filter(j => !j.assignedEmployee && j.status !== "completed").length;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="line-chart" size={16} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>Overview</Text>
        </View>
        <Pressable
          style={styles.viewAllButton}
          onPress={() => navigate("/business-owner/dashboard")}
        >
          <Text style={styles.viewAllText}>Full Dashboard</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="dollar"
          value={formatCurrency(monthlyRevenue)}
          label="This Month"
          color={colors.success[600]}
          onPress={() => navigate("/business-owner/financials")}
        />
        <StatCard
          icon="credit-card"
          value={formatCurrency(payrollOwed)}
          label={`${pendingPayoutsCount} Pending`}
          color={colors.warning[600]}
          onPress={() => navigate("/business-owner/payroll")}
        />
        <StatCard
          icon="clock-o"
          value="View"
          label="Timesheet"
          color={colors.secondary[600]}
          onPress={() => navigate("/business-owner/timesheet")}
        />
        <StatCard
          icon="users"
          value={totalClients}
          label="Clients"
          color={colors.primary[600]}
          onPress={() => navigate("/my-clients")}
        />
      </View>

      {/* Today's Jobs Summary */}
      <View style={styles.todaysJobsCard}>
        <View style={styles.todaysJobsHeader}>
          <Text style={styles.todaysJobsTitle}>Today's Jobs</Text>
          <Text style={styles.todaysJobsCount}>{todaysJobs.length} scheduled</Text>
        </View>

        {todaysJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="calendar-o" size={24} color={colors.neutral[300]} />
            <Text style={styles.emptyStateText}>No jobs scheduled for today</Text>
          </View>
        ) : (
          <>
            {/* Job Status Summary */}
            <View style={styles.jobStatusRow}>
              {unassignedJobs > 0 && (
                <View style={[styles.statusBadge, styles.statusUnassigned]}>
                  <Icon name="exclamation-triangle" size={12} color={colors.error[600]} />
                  <Text style={[styles.statusText, { color: colors.error[600] }]}>
                    {unassignedJobs} Unassigned
                  </Text>
                </View>
              )}
              {assignedJobs > 0 && (
                <View style={[styles.statusBadge, styles.statusAssigned]}>
                  <Icon name="check" size={12} color={colors.primary[600]} />
                  <Text style={[styles.statusText, { color: colors.primary[600] }]}>
                    {assignedJobs} Assigned
                  </Text>
                </View>
              )}
              {startedJobs > 0 && (
                <View style={[styles.statusBadge, styles.statusStarted]}>
                  <Icon name="play" size={12} color={colors.warning[600]} />
                  <Text style={[styles.statusText, { color: colors.warning[600] }]}>
                    {startedJobs} In Progress
                  </Text>
                </View>
              )}
              {completedJobs > 0 && (
                <View style={[styles.statusBadge, styles.statusCompleted]}>
                  <Icon name="check-circle" size={12} color={colors.success[600]} />
                  <Text style={[styles.statusText, { color: colors.success[600] }]}>
                    {completedJobs} Complete
                  </Text>
                </View>
              )}
            </View>

            {/* Action Alert */}
            {unassignedJobs > 0 && (
              <Pressable
                style={styles.alertBanner}
                onPress={() => navigate("/business-owner/assign")}
              >
                <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
                <Text style={styles.alertText}>
                  {unassignedJobs} job{unassignedJobs > 1 ? "s" : ""} need{unassignedJobs === 1 ? "s" : ""} assignment
                </Text>
                <Icon name="chevron-right" size={12} color={colors.error[600]} />
              </Pressable>
            )}
          </>
        )}

        {/* View Calendar Link */}
        <Pressable
          style={styles.viewCalendarButton}
          onPress={() => navigate("/business-owner/calendar")}
        >
          <Icon name="calendar" size={14} color={colors.primary[600]} />
          <Text style={styles.viewCalendarText}>View Calendar</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
  },
  todaysJobsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  todaysJobsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  todaysJobsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  todaysJobsCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  jobStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  statusUnassigned: {
    backgroundColor: colors.error[50],
  },
  statusAssigned: {
    backgroundColor: colors.primary[50],
  },
  statusStarted: {
    backgroundColor: colors.warning[50],
  },
  statusCompleted: {
    backgroundColor: colors.success[50],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  alertText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    fontWeight: typography.fontWeight.medium,
  },
  viewCalendarButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.sm,
  },
  viewCalendarText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
});

export default DashboardOverview;
