import React, { useMemo, useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import { formatCurrency } from "../../../services/formatters";
import { parseLocalDate } from "../../../utils/dateUtils";
import { usePricing } from "../../../context/PricingContext";
import FetchData from "../../../services/fetchRequests/fetchData";

const JobCard = ({ job, home, onPress }) => {
  const appointmentDate = parseLocalDate(job.date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = appointmentDate.toDateString() === today.toDateString();
  const isTomorrow = appointmentDate.toDateString() === tomorrow.toDateString();

  const formatDate = () => {
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return appointmentDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Pressable style={styles.jobCard} onPress={onPress}>
      <View style={styles.jobMain}>
        <View style={styles.jobDateBadge}>
          <Text style={[styles.jobDateText, isToday && styles.todayText]}>
            {formatDate()}
          </Text>
        </View>
        <View style={styles.jobInfo}>
          <Text style={styles.jobLocation} numberOfLines={1}>
            {home?.city || "Loading..."}, {home?.state || ""}
          </Text>
          <Text style={styles.jobDetails}>
            {home?.numBeds || "?"} bed | {home?.numBaths || "?"} bath
          </Text>
        </View>
      </View>
      <View style={styles.jobMeta}>
        {/* Price is stored in dollars in DB, convert to cents for formatCurrency */}
        <Text style={styles.jobPrice}>{formatCurrency((job.price || 0) * 100)}</Text>
        <Icon name="chevron-right" size={12} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

// Request Card Component
const RequestCard = ({ request, onPress, cleanerSharePercent }) => {
  const requestDate = parseLocalDate(request.date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = requestDate.toDateString() === today.toDateString();
  const isTomorrow = requestDate.toDateString() === tomorrow.toDateString();

  const formatDate = () => {
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return requestDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // numBeds and numBaths are at top level from serializer
  const numBeds = request.numBeds || request.home?.numBeds || "?";
  const numBaths = request.numBaths || request.home?.numBaths || "?";

  // Calculate earnings after platform fee
  // Price is stored in dollars in DB, convert to cents for formatCurrency
  const priceInCents = Number(request.price || 0) * 100;
  const earnings = priceInCents * cleanerSharePercent;

  return (
    <Pressable style={styles.requestCard} onPress={onPress}>
      <View style={styles.requestMain}>
        <View style={styles.requestDateBadge}>
          <Text style={styles.requestDateText}>{formatDate()}</Text>
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestLocation} numberOfLines={1}>
            {numBeds} bed | {numBaths} bath
          </Text>
          <Text style={styles.requestDetails}>
            Awaiting homeowner approval
          </Text>
        </View>
      </View>
      <View style={styles.requestMeta}>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>Pending</Text>
        </View>
        <Text style={styles.requestPrice}>{formatCurrency(earnings)}</Text>
      </View>
    </Pressable>
  );
};

const MarketplaceCleanerView = ({ state }) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const appointments = state?.appointments || [];
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Fetch pending requests
  const fetchRequests = useCallback(async () => {
    try {
      const response = await FetchData.get(
        "/api/v1/users/appointments/employee",
        state?.currentUser?.token
      );
      const now = new Date();
      const upcoming = (response?.requested || []).filter(
        (item) => new Date(item.date) >= new Date(now.toDateString())
      );
      setPendingRequests(upcoming);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setPendingRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [state?.currentUser?.token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Calculate stats from state.appointments
  const { myJobs, stats } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Filter to upcoming jobs assigned to this cleaner
    const upcoming = appointments.filter(apt => {
      const aptDate = parseLocalDate(apt.date);
      return aptDate >= now && apt.status !== "completed" && apt.status !== "cancelled";
    });

    // Calculate completed stats
    const completed = appointments.filter(apt => apt.status === "completed");
    const totalEarnings = completed.reduce((sum, apt) => sum + (apt.cleanerPayout || 0), 0);

    return {
      myJobs: upcoming.slice(0, 3), // Show first 3
      stats: {
        jobsCompleted: completed.length,
        totalEarnings,
        upcomingJobs: upcoming.length,
      },
    };
  }, [appointments]);

  return (
    <View style={styles.container}>
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="info-circle" size={16} color={colors.primary[600]} />
        <Text style={styles.infoBannerText}>
          As a business owner, you can also pick up marketplace jobs yourself or assign them to your team.
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.upcomingJobs}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={[styles.statCard, pendingRequests.length > 0 && styles.statCardHighlight]}>
          <Text style={[styles.statValue, pendingRequests.length > 0 && styles.statValueHighlight]}>
            {pendingRequests.length}
          </Text>
          <Text style={[styles.statLabel, pendingRequests.length > 0 && styles.statLabelHighlight]}>
            Pending
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(stats.totalEarnings)}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
      </View>

      {/* Available Jobs Link */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="search" size={16} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>Available Jobs</Text>
          </View>
          <Pressable
            style={styles.viewAllButton}
            onPress={() => navigate("/new-job-choice")}
          >
            <Text style={styles.viewAllText}>Browse</Text>
            <Icon name="chevron-right" size={12} color={colors.primary[600]} />
          </Pressable>
        </View>

        <Pressable
          style={styles.browseCard}
          onPress={() => navigate("/new-job-choice")}
        >
          <View style={styles.browseIconContainer}>
            <Icon name="map-marker" size={24} color={colors.primary[600]} />
          </View>
          <View style={styles.browseContent}>
            <Text style={styles.browseTitle}>Browse Marketplace Jobs</Text>
            <Text style={styles.browseSubtitle}>
              Find available cleaning jobs in your area
            </Text>
          </View>
          <Icon name="arrow-right" size={16} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* My Requests - Pending Approval */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="clock-o" size={16} color={colors.warning[600]} />
            <Text style={styles.sectionTitle}>My Requests</Text>
            {pendingRequests.length > 0 && (
              <View style={styles.pendingCountBadge}>
                <Text style={styles.pendingCountText}>{pendingRequests.length}</Text>
              </View>
            )}
          </View>
          {pendingRequests.length > 0 && (
            <Pressable
              style={styles.viewAllButton}
              onPress={() => navigate("/my-requests")}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Icon name="chevron-right" size={12} color={colors.primary[600]} />
            </Pressable>
          )}
        </View>

        <View style={styles.jobsCard}>
          {loadingRequests ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
            </View>
          ) : pendingRequests.length === 0 ? (
            <View style={styles.emptyRequestState}>
              <Icon name="clock-o" size={24} color={colors.neutral[300]} />
              <Text style={styles.emptyRequestText}>
                No pending requests. Browse jobs to send requests!
              </Text>
            </View>
          ) : (
            <>
              {pendingRequests.slice(0, 2).map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  cleanerSharePercent={cleanerSharePercent}
                  onPress={() => navigate("/my-requests")}
                />
              ))}
              {pendingRequests.length > 2 && (
                <Pressable
                  style={styles.showMoreButton}
                  onPress={() => navigate("/my-requests")}
                >
                  <Text style={styles.showMoreText}>
                    +{pendingRequests.length - 2} more request{pendingRequests.length - 2 > 1 ? "s" : ""}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>

      {/* My Marketplace Jobs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="calendar" size={16} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>My Jobs</Text>
            {myJobs.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{stats.upcomingJobs}</Text>
              </View>
            )}
          </View>
          {myJobs.length > 0 && (
            <Pressable
              style={styles.viewAllButton}
              onPress={() => navigate("/appointments")}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Icon name="chevron-right" size={12} color={colors.primary[600]} />
            </Pressable>
          )}
        </View>

        <View style={styles.jobsCard}>
          {myJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="calendar-o" size={32} color={colors.neutral[300]} />
              <Text style={styles.emptyStateTitle}>No upcoming jobs</Text>
              <Text style={styles.emptyStateText}>
                Pick up jobs from the marketplace to clean yourself
              </Text>
              <Pressable
                style={styles.browseButton}
                onPress={() => navigate("/new-job-choice")}
              >
                <Icon name="search" size={14} color={colors.neutral[0]} />
                <Text style={styles.browseButtonText}>Browse Jobs</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {myJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  home={job.home}
                  onPress={() => navigate(`/details/${job.id}`)}
                />
              ))}
              {stats.upcomingJobs > 3 && (
                <Pressable
                  style={styles.showMoreButton}
                  onPress={() => navigate("/appointments")}
                >
                  <Text style={styles.showMoreText}>
                    +{stats.upcomingJobs - 3} more job{stats.upcomingJobs - 3 > 1 ? "s" : ""}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>

      {/* Self-Assignment Tip */}
      <View style={styles.tipCard}>
        <View style={styles.tipIcon}>
          <Icon name="lightbulb-o" size={20} color={colors.warning[600]} />
        </View>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Assign Yourself to Client Jobs</Text>
          <Text style={styles.tipText}>
            Switch to "Manage Business" mode to assign yourself to your clients' appointments instead of picking up marketplace jobs.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  statCardHighlight: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  statValueHighlight: {
    color: colors.warning[700],
  },
  statLabelHighlight: {
    color: colors.warning[600],
  },
  section: {
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
  countBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
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
  browseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  browseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  browseContent: {
    flex: 1,
  },
  browseTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  browseSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  jobsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: "hidden",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  browseButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  jobMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
  },
  jobDateBadge: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minWidth: 70,
    alignItems: "center",
  },
  jobDateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  todayText: {
    color: colors.primary[600],
  },
  jobInfo: {
    flex: 1,
  },
  jobLocation: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  jobDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  jobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  jobPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  showMoreButton: {
    padding: spacing.md,
    alignItems: "center",
  },
  showMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  tipCard: {
    flexDirection: "row",
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: spacing.xs,
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 20,
  },
  // Request card styles
  pendingCountBadge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  pendingCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  requestMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
  },
  requestDateBadge: {
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minWidth: 70,
    alignItems: "center",
  },
  requestDateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  requestInfo: {
    flex: 1,
  },
  requestLocation: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  requestDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  requestMeta: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  pendingBadge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  pendingBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  requestPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  loadingState: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyRequestState: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyRequestText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
});

export default MarketplaceCleanerView;
