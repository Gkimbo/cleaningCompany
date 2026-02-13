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

// Job tile component with improved styling
const JobTile = ({ job, onPress }) => {
  const isClient = job.source === "client";
  const isUnassigned = !job.assignedEmployee;

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.jobTile, pressed && styles.jobTilePressed]}
      onPress={onPress}
    >
      {/* Left accent */}
      <View style={[styles.jobAccent, isClient ? styles.jobAccentClient : styles.jobAccentMarketplace]} />

      <View style={styles.jobTileContent}>
        {/* Main row */}
        <View style={styles.jobTileMain}>
          {/* Left side: client info */}
          <View style={styles.jobTileLeft}>
            <View style={styles.jobTileHeader}>
              <View style={[styles.sourceTag, isClient ? styles.sourceTagClient : styles.sourceTagMarketplace]}>
                <Icon name={isClient ? "user" : "globe"} size={9} color={isClient ? colors.primary[600] : colors.secondary[600]} />
                <Text style={[styles.sourceTagText, isClient ? styles.sourceTagTextClient : styles.sourceTagTextMarketplace]}>
                  {isClient ? "Client" : "Marketplace"}
                </Text>
              </View>
              {isUnassigned && (
                <View style={styles.urgentTag}>
                  <Icon name="exclamation" size={8} color={colors.warning[600]} />
                </View>
              )}
            </View>
            <Text style={styles.jobClientName} numberOfLines={1}>{job.clientName}</Text>
          </View>

          {/* Right side: time & status */}
          <View style={styles.jobTileRight}>
            {job.startTime && (
              <Text style={styles.jobTime}>{formatTime(job.startTime)}</Text>
            )}
            <View style={[styles.statusPill, isUnassigned ? styles.statusPillUnassigned : styles.statusPillAssigned]}>
              <Icon
                name={isUnassigned ? "user-plus" : "check"}
                size={9}
                color={isUnassigned ? colors.warning[600] : colors.success[600]}
              />
              <Text style={[styles.statusPillText, isUnassigned ? styles.statusTextUnassigned : styles.statusTextAssigned]}>
                {isUnassigned
                  ? "Needs Assignment"
                  : (job.assignedEmployee?.firstName === "You" ? "You" : job.assignedEmployee?.firstName || "Assigned")
                }
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.jobChevronContainer}>
        <Icon name="chevron-right" size={12} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

// Jobs section component with improved header
const JobsSection = ({ title, subtitle, icon, jobs, emptyMessage, emptyIcon, navigate, showAlert = false, accentColor }) => {
  const unassignedCount = jobs.filter(j => !j.assignedEmployee && j.status !== "completed").length;
  const clientCount = jobs.filter(j => j.source === "client").length;
  const marketplaceCount = jobs.filter(j => j.source === "marketplace").length;

  return (
    <View style={styles.jobsSection}>
      {/* Section Header */}
      <View style={styles.jobsSectionHeader}>
        <View style={styles.jobsSectionLeft}>
          <View style={[styles.sectionIconContainer, { backgroundColor: accentColor + "15" }]}>
            <Icon name={icon} size={14} color={accentColor} />
          </View>
          <View>
            <Text style={styles.jobsSectionTitle}>{title}</Text>
            {subtitle && <Text style={styles.jobsSectionSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        <View style={styles.jobsSectionRight}>
          {jobs.length > 0 ? (
            <View style={styles.jobCounts}>
              {clientCount > 0 && (
                <View style={styles.countBadgeClient}>
                  <Icon name="user" size={8} color={colors.primary[600]} />
                  <Text style={styles.countBadgeTextClient}>{clientCount}</Text>
                </View>
              )}
              {marketplaceCount > 0 && (
                <View style={styles.countBadgeMarketplace}>
                  <Icon name="globe" size={8} color={colors.secondary[600]} />
                  <Text style={styles.countBadgeTextMarketplace}>{marketplaceCount}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noJobsText}>No jobs</Text>
          )}
        </View>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Icon name={emptyIcon || "calendar-check-o"} size={20} color={colors.neutral[300]} />
          </View>
          <Text style={styles.emptyStateText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.jobTilesContainer}>
          {/* Unassigned alert */}
          {showAlert && unassignedCount > 0 && (
            <Pressable
              style={styles.alertBanner}
              onPress={() => navigate("/business-owner/assign")}
            >
              <View style={styles.alertIconContainer}>
                <Icon name="exclamation-circle" size={14} color={colors.warning[600]} />
              </View>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Action Required</Text>
                <Text style={styles.alertText}>
                  {unassignedCount} job{unassignedCount !== 1 ? "s" : ""} need{unassignedCount === 1 ? "s" : ""} to be assigned
                </Text>
              </View>
              <Icon name="chevron-right" size={12} color={colors.warning[500]} />
            </Pressable>
          )}

          {/* Job tiles */}
          <View style={styles.jobTilesList}>
            {jobs.slice(0, 4).map((job, index) => (
              <JobTile
                key={job.id}
                job={job}
                onPress={() => navigate(`/business-owner/job/${job.id}`)}
              />
            ))}
          </View>

          {/* View more */}
          {jobs.length > 4 && (
            <Pressable
              style={styles.viewMoreButton}
              onPress={() => navigate("/business-owner/all-jobs")}
            >
              <Text style={styles.viewMoreText}>View {jobs.length - 4} more job{jobs.length - 4 !== 1 ? "s" : ""}</Text>
              <Icon name="arrow-right" size={10} color={colors.primary[600]} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const DashboardOverview = ({ data, payrollOwed, pendingPayoutsCount, state }) => {
  const navigate = useNavigate();

  // Extract data from dashboard response
  const todaysJobs = data?.todaysAppointments || [];
  const tomorrowsJobs = data?.tomorrowsAppointments || [];
  const monthlyRevenue = data?.monthlyRevenue || 0;
  const totalClients = data?.totalClients || 0;

  // Format today's date
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDateSubtitle = (date) => {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };

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

      {/* Jobs Card */}
      <View style={styles.jobsCard}>
        {/* Today's Jobs */}
        <JobsSection
          title="Today"
          subtitle={formatDateSubtitle(today)}
          icon="sun-o"
          jobs={todaysJobs}
          emptyMessage="No jobs scheduled"
          emptyIcon="check-circle"
          navigate={navigate}
          showAlert={true}
          accentColor={colors.primary[600]}
        />

        {/* Divider */}
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
        </View>

        {/* Tomorrow's Jobs */}
        <JobsSection
          title="Tomorrow"
          subtitle={formatDateSubtitle(tomorrow)}
          icon="calendar"
          jobs={tomorrowsJobs}
          emptyMessage="No jobs scheduled"
          emptyIcon="calendar-check-o"
          navigate={navigate}
          showAlert={false}
          accentColor={colors.secondary[600]}
        />

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => navigate("/business-owner/calendar")}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.primary[50] }]}>
              <Icon name="calendar" size={14} color={colors.primary[600]} />
            </View>
            <Text style={[styles.actionButtonText, { color: colors.primary[600] }]}>Calendar</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable
            style={styles.actionButton}
            onPress={() => navigate("/business-owner/all-jobs")}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.secondary[50] }]}>
              <Icon name="list" size={14} color={colors.secondary[600]} />
            </View>
            <Text style={[styles.actionButtonText, { color: colors.secondary[600] }]}>All Jobs</Text>
          </Pressable>
        </View>
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

  // Jobs Card
  jobsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.md,
    overflow: "hidden",
  },

  // Jobs Section
  jobsSection: {
    padding: spacing.md,
  },
  jobsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  jobsSectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  jobsSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  jobsSectionSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  jobsSectionRight: {
    alignItems: "flex-end",
  },
  jobCounts: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  noJobsText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  countBadgeClient: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  countBadgeTextClient: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  countBadgeMarketplace: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondary[50],
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  countBadgeTextMarketplace: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.secondary[600],
  },

  // Divider
  sectionDivider: {
    paddingHorizontal: spacing.md,
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.border.light,
  },

  // Empty State
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.background.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },

  // Alert Banner
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.sm,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  alertIconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  alertText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
  },

  // Job Tiles
  jobTilesContainer: {
    gap: spacing.sm,
  },
  jobTilesList: {
    gap: spacing.xs,
  },
  jobTile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  jobTilePressed: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[300],
  },
  jobAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  jobAccentClient: {
    backgroundColor: colors.primary[500],
  },
  jobAccentMarketplace: {
    backgroundColor: colors.secondary[500],
  },
  jobTileContent: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  jobTileMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  jobTileLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  jobTileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 4,
  },
  sourceTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    gap: 3,
  },
  sourceTagClient: {
    backgroundColor: colors.primary[100],
  },
  sourceTagMarketplace: {
    backgroundColor: colors.secondary[100],
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  sourceTagTextClient: {
    color: colors.primary[700],
  },
  sourceTagTextMarketplace: {
    color: colors.secondary[700],
  },
  urgentTag: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
  },
  jobClientName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobTileRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  jobTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.bold,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    gap: 4,
  },
  statusPillAssigned: {
    backgroundColor: colors.success[50],
  },
  statusPillUnassigned: {
    backgroundColor: colors.warning[50],
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
  },
  statusTextAssigned: {
    color: colors.success[700],
  },
  statusTextUnassigned: {
    color: colors.warning[700],
  },
  jobChevronContainer: {
    paddingRight: spacing.md,
  },

  // View More
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  viewMoreText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.neutral[50],
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  actionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default DashboardOverview;
