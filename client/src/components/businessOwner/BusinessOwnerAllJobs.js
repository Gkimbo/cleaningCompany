import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { formatCurrency } from "../../services/formatters";
import { parseLocalDate } from "../../utils/dateUtils";
import FetchData from "../../services/fetchRequests/fetchData";

// Segmented Control Component
const SegmentedControl = ({ options, selected, onChange }) => (
  <View style={styles.segmentedControl}>
    {options.map((option, index) => (
      <Pressable
        key={option.value}
        style={[
          styles.segment,
          index === 0 && styles.segmentFirst,
          index === options.length - 1 && styles.segmentLast,
          selected === option.value && styles.segmentActive,
        ]}
        onPress={() => onChange(option.value)}
      >
        <Text style={[
          styles.segmentText,
          selected === option.value && styles.segmentTextActive,
        ]}>
          {option.label}
        </Text>
      </Pressable>
    ))}
  </View>
);

// Filter Chip Component
const FilterChip = ({ label, icon, count, isActive, onPress, variant = "default" }) => {
  const getVariantStyles = () => {
    if (!isActive) return {};
    switch (variant) {
      case "warning":
        return { backgroundColor: colors.warning[100], borderColor: colors.warning[400] };
      case "success":
        return { backgroundColor: colors.success[100], borderColor: colors.success[400] };
      case "primary":
        return { backgroundColor: colors.primary[100], borderColor: colors.primary[400] };
      case "secondary":
        return { backgroundColor: colors.secondary[100], borderColor: colors.secondary[400] };
      default:
        return { backgroundColor: colors.neutral[200], borderColor: colors.neutral[400] };
    }
  };

  const getTextColor = () => {
    if (!isActive) return colors.text.secondary;
    switch (variant) {
      case "warning": return colors.warning[700];
      case "success": return colors.success[700];
      case "primary": return colors.primary[700];
      case "secondary": return colors.secondary[700];
      default: return colors.text.primary;
    }
  };

  return (
    <Pressable
      style={[
        styles.filterChip,
        isActive && styles.filterChipActive,
        isActive && getVariantStyles(),
      ]}
      onPress={onPress}
    >
      {icon && (
        <Icon name={icon} size={10} color={getTextColor()} />
      )}
      <Text style={[styles.filterChipText, { color: getTextColor() }]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.filterChipCount, isActive && { backgroundColor: getTextColor() + "20" }]}>
          <Text style={[styles.filterChipCountText, { color: getTextColor() }]}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

// Job Card Component
const JobCard = ({ job, onPress, isFirst, isLast }) => {
  const appointmentDate = parseLocalDate(job.date);
  const today = new Date();
  const isToday = appointmentDate.toDateString() === today.toDateString();
  const isPast = appointmentDate < new Date(today.toDateString());
  const isClient = job.source === "client";

  const formatTime = () => {
    if (!job.time) return "";
    const [hours, minutes] = job.time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.jobCard,
        isFirst && styles.jobCardFirst,
        isLast && styles.jobCardLast,
        pressed && styles.jobCardPressed,
        isPast && styles.jobCardPast,
      ]}
      onPress={onPress}
    >
      {/* Left accent bar */}
      <View style={[
        styles.jobAccent,
        isClient ? styles.jobAccentClient : styles.jobAccentMarketplace,
      ]} />

      <View style={styles.jobContent}>
        {/* Top row: Source + Price */}
        <View style={styles.jobTopRow}>
          <View style={[styles.sourceTag, isClient ? styles.sourceTagClient : styles.sourceTagMarketplace]}>
            <Icon
              name={isClient ? "user" : "globe"}
              size={10}
              color={isClient ? colors.primary[600] : colors.secondary[600]}
            />
            <Text style={[styles.sourceTagText, isClient ? styles.sourceTagTextClient : styles.sourceTagTextMarketplace]}>
              {isClient ? "Client" : "Marketplace"}
            </Text>
          </View>
          <Text style={styles.jobPrice}>{formatCurrency((job.price || 0) * 100)}</Text>
        </View>

        {/* Main content */}
        <View style={styles.jobMainRow}>
          <View style={styles.jobDetails}>
            <Text style={styles.jobClientName} numberOfLines={1}>
              {job.clientName}
            </Text>
            <View style={styles.jobMetaRow}>
              <Icon name="map-marker" size={11} color={colors.text.tertiary} />
              <Text style={styles.jobLocation} numberOfLines={1}>
                {job.city || "Unknown"}, {job.state || ""}
              </Text>
            </View>
            <View style={styles.jobMetaRow}>
              <Icon name="home" size={11} color={colors.text.tertiary} />
              <Text style={styles.jobSpecs}>
                {job.numBeds || "?"} bed  •  {job.numBaths || "?"} bath
              </Text>
            </View>
          </View>

          <View style={styles.jobRight}>
            {/* Time */}
            {job.time && (
              <View style={[styles.timeTag, isToday && styles.timeTagToday]}>
                <Icon name="clock-o" size={11} color={isToday ? colors.primary[600] : colors.text.secondary} />
                <Text style={[styles.timeText, isToday && styles.timeTextToday]}>
                  {formatTime()}
                </Text>
              </View>
            )}

            {/* Assignment status */}
            <View style={[
              styles.assignmentTag,
              job.isAssigned ? styles.assignmentTagAssigned : styles.assignmentTagUnassigned,
            ]}>
              <Icon
                name={job.isAssigned ? "check" : "exclamation"}
                size={10}
                color={job.isAssigned ? colors.success[600] : colors.warning[600]}
              />
              <Text style={[
                styles.assignmentText,
                job.isAssigned ? styles.assignmentTextAssigned : styles.assignmentTextUnassigned,
              ]} numberOfLines={1}>
                {job.isAssigned
                  ? (job.assignedTo?.type === "self" ? "You" : job.assignedTo?.name || "Assigned")
                  : "Unassigned"
                }
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Icon name="chevron-right" size={14} color={colors.neutral[300]} style={styles.jobChevron} />
    </Pressable>
  );
};

// Date Group Header
const DateHeader = ({ date, count, isToday, isTomorrow }) => {
  const formatDateHeader = () => {
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.dateHeader}>
      <View style={styles.dateHeaderLeft}>
        {isToday && <View style={styles.todayDot} />}
        <Text style={[styles.dateHeaderText, isToday && styles.dateHeaderTextToday]}>
          {formatDateHeader()}
        </Text>
      </View>
      <Text style={styles.dateHeaderCount}>{count} job{count !== 1 ? "s" : ""}</Text>
    </View>
  );
};

// Empty State Component
const EmptyState = ({ filter, sourceFilter, assignmentFilter }) => {
  const getMessage = () => {
    if (assignmentFilter === "unassigned") {
      return {
        icon: "check-circle",
        title: "All caught up!",
        subtitle: "No unassigned jobs at the moment",
      };
    }
    if (assignmentFilter === "assigned-to-me") {
      return {
        icon: "calendar-check-o",
        title: "No jobs assigned to you",
        subtitle: "Jobs you're assigned to will appear here",
      };
    }
    if (sourceFilter === "client") {
      return {
        icon: "users",
        title: "No client jobs",
        subtitle: "Jobs from your clients will appear here",
      };
    }
    if (sourceFilter === "marketplace") {
      return {
        icon: "globe",
        title: "No marketplace jobs",
        subtitle: "Jobs from the marketplace will appear here",
      };
    }
    if (filter === "completed") {
      return {
        icon: "check-circle-o",
        title: "No completed jobs",
        subtitle: "Completed jobs will appear here",
      };
    }
    return {
      icon: "calendar-o",
      title: "No jobs found",
      subtitle: "Jobs matching your filters will appear here",
    };
  };

  const { icon, title, subtitle } = getMessage();

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Icon name={icon} size={32} color={colors.primary[400]} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
};

const BusinessOwnerAllJobs = ({ state }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState("upcoming");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  const fetchJobs = useCallback(async () => {
    try {
      const params = timeFilter === "upcoming" ? "?upcoming=true" : "";
      const response = await FetchData.get(
        `/api/v1/business-owner/all-jobs${params}`,
        state?.currentUser?.token
      );
      setJobs(response?.jobs || []);
    } catch (error) {
      console.error("Error fetching all jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state?.currentUser?.token, timeFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  // Apply filters and compute counts
  const { filteredJobs, counts, groupedJobs } = useMemo(() => {
    const timeFiltered = jobs.filter(job => {
      if (timeFilter === "completed") return job.completed;
      if (timeFilter === "upcoming") return !job.completed;
      return true;
    });

    // Counts for filter chips
    const counts = {
      all: timeFiltered.length,
      client: timeFiltered.filter(j => j.source === "client").length,
      marketplace: timeFiltered.filter(j => j.source === "marketplace").length,
      unassigned: timeFiltered.filter(j => !j.isAssigned).length,
      assignedToMe: timeFiltered.filter(j => j.assignedTo?.type === "self").length,
    };

    // Apply source and assignment filters
    const filtered = timeFiltered.filter(job => {
      if (sourceFilter === "client" && job.source !== "client") return false;
      if (sourceFilter === "marketplace" && job.source !== "marketplace") return false;
      if (assignmentFilter === "unassigned" && job.isAssigned) return false;
      if (assignmentFilter === "assigned-to-me" && job.assignedTo?.type !== "self") return false;
      return true;
    });

    // Group by date
    const groups = {};
    filtered.forEach(job => {
      const dateKey = job.date;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(job);
    });

    // Sort groups by date
    const sortedGroups = Object.entries(groups)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, jobs]) => ({ date, jobs }));

    return { filteredJobs: filtered, counts, groupedJobs: sortedGroups };
  }, [jobs, timeFilter, sourceFilter, assignmentFilter]);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={16} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>All Jobs</Text>
          {!loading && (
            <Text style={styles.headerSubtitle}>
              ({filteredJobs.length})
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Time Filter - Segmented Control */}
      <View style={styles.segmentedWrapper}>
        <SegmentedControl
          options={[
            { label: "Upcoming", value: "upcoming" },
            { label: "Completed", value: "completed" },
            { label: "All", value: "all" },
          ]}
          selected={timeFilter}
          onChange={setTimeFilter}
        />
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {/* Source filters */}
        <FilterChip
          label="All"
          count={counts.all}
          isActive={sourceFilter === "all" && assignmentFilter === "all"}
          onPress={() => { setSourceFilter("all"); setAssignmentFilter("all"); }}
        />
        <FilterChip
          label="Client"
          icon="user"
          count={counts.client}
          isActive={sourceFilter === "client"}
          onPress={() => { setSourceFilter("client"); setAssignmentFilter("all"); }}
          variant="primary"
        />
        <FilterChip
          label="Marketplace"
          icon="globe"
          count={counts.marketplace}
          isActive={sourceFilter === "marketplace"}
          onPress={() => { setSourceFilter("marketplace"); setAssignmentFilter("all"); }}
          variant="secondary"
        />

        <View style={styles.filterDivider} />

        {/* Assignment filters */}
        <FilterChip
          label="Unassigned"
          icon="exclamation-circle"
          count={counts.unassigned}
          isActive={assignmentFilter === "unassigned"}
          onPress={() => { setAssignmentFilter("unassigned"); setSourceFilter("all"); }}
          variant="warning"
        />
        <FilterChip
          label="My Jobs"
          icon="user-circle"
          count={counts.assignedToMe}
          isActive={assignmentFilter === "assigned-to-me"}
          onPress={() => { setAssignmentFilter("assigned-to-me"); setSourceFilter("all"); }}
          variant="success"
        />
      </ScrollView>

      {/* Jobs List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading jobs...</Text>
          </View>
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            filter={timeFilter}
            sourceFilter={sourceFilter}
            assignmentFilter={assignmentFilter}
          />
        ) : (
          <View style={styles.jobsContainer}>
            {groupedJobs.map(({ date, jobs: dateJobs }) => {
              const jobDate = parseLocalDate(date);
              const isToday = jobDate.toDateString() === today.toDateString();
              const isTomorrow = jobDate.toDateString() === tomorrow.toDateString();

              return (
                <View key={date} style={styles.dateGroup}>
                  <DateHeader
                    date={jobDate}
                    count={dateJobs.length}
                    isToday={isToday}
                    isTomorrow={isTomorrow}
                  />
                  <View style={styles.dateGroupCards}>
                    {dateJobs.map((job, index) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isFirst={index === 0}
                        isLast={index === dateJobs.length - 1}
                        onPress={() => navigate(`/business-owner/job/${job.id}`)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  headerSpacer: {
    width: 32,
  },

  // Segmented Control
  segmentedWrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.primary,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  segmentFirst: {},
  segmentLast: {},
  segmentActive: {
    backgroundColor: colors.background.primary,
    ...shadows.sm,
  },
  segmentText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  segmentTextActive: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },

  // Filter Chips
  filtersScroll: {
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    maxHeight: 44,
  },
  filtersContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  filterChipActive: {
    borderColor: colors.neutral[300],
  },
  filterChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipCount: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
    minWidth: 18,
    alignItems: "center",
  },
  filterChipCountText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  filterDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border.light,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["3xl"],
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },

  // Jobs Container
  jobsContainer: {
    gap: spacing.xl,
  },

  // Date Group
  dateGroup: {
    gap: spacing.sm,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  dateHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  todayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
  dateHeaderText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  dateHeaderTextToday: {
    color: colors.primary[600],
  },
  dateHeaderCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  dateGroupCards: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },

  // Job Card
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  jobCardFirst: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  jobCardLast: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    borderBottomWidth: 0,
  },
  jobCardPressed: {
    backgroundColor: colors.neutral[50],
  },
  jobCardPast: {
    opacity: 0.6,
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
  jobContent: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.md,
  },
  jobTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sourceTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  sourceTagClient: {
    backgroundColor: colors.primary[50],
  },
  sourceTagMarketplace: {
    backgroundColor: colors.secondary[50],
  },
  sourceTagText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
  },
  sourceTagTextClient: {
    color: colors.primary[600],
  },
  sourceTagTextMarketplace: {
    color: colors.secondary[600],
  },
  jobPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  jobMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  jobDetails: {
    flex: 1,
    gap: 3,
  },
  jobClientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  jobMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  jobLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  jobSpecs: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  jobRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginLeft: spacing.md,
    gap: spacing.sm,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    gap: 4,
  },
  timeTagToday: {
    backgroundColor: colors.primary[50],
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  timeTextToday: {
    color: colors.primary[600],
  },
  assignmentTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: 4,
  },
  assignmentTagAssigned: {
    backgroundColor: colors.success[50],
  },
  assignmentTagUnassigned: {
    backgroundColor: colors.warning[50],
  },
  assignmentText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    maxWidth: 70,
  },
  assignmentTextAssigned: {
    color: colors.success[600],
  },
  assignmentTextUnassigned: {
    color: colors.warning[600],
  },
  jobChevron: {
    marginRight: spacing.md,
  },
});

export default BusinessOwnerAllJobs;
