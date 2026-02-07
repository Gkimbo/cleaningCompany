import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
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

// Job Status Colors
const STATUS_COLORS = {
  assigned: { bg: colors.primary[100], text: colors.primary[700], label: "Assigned" },
  started: { bg: colors.warning[100], text: colors.warning[700], label: "In Progress" },
  completed: { bg: colors.success[100], text: colors.success[700], label: "Completed" },
  cancelled: { bg: colors.neutral[200], text: colors.neutral[600], label: "Cancelled" },
  no_show: { bg: colors.error[100], text: colors.error[700], label: "No Show" },
};

// Job Card Component
const JobCard = ({ job, onStart, onComplete, onViewDetails, isStarting, isCompleting }) => {
  const statusInfo = STATUS_COLORS[job.status] || STATUS_COLORS.assigned;

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const jobDate = new Date(job.appointment?.date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = jobDate.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = jobDate.toDateString() === tomorrow.toDateString();

  const getDayLabel = () => {
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return jobDate.toLocaleDateString("en-US", { weekday: "short" });
  };

  // Determine card accent color based on status and timing
  const getAccentColor = () => {
    if (job.status === "started") return colors.warning[500];
    if (job.status === "completed") return colors.success[500];
    if (isToday) return colors.primary[600];
    return colors.neutral[300];
  };

  return (
    <Pressable
      style={[
        styles.jobCard,
        isToday && job.status === "assigned" && styles.jobCardToday,
        job.status === "started" && styles.jobCardInProgress,
      ]}
      onPress={onViewDetails}
    >
      {/* Accent strip */}
      <View style={[styles.cardAccent, { backgroundColor: getAccentColor() }]} />

      <View style={styles.jobCardContent}>
        {/* Top Row: Date & Status */}
        <View style={styles.jobTopRow}>
          <View style={styles.dateSection}>
            <View style={[
              styles.dateBadge,
              isToday && styles.dateBadgeToday,
              job.status === "started" && styles.dateBadgeInProgress,
            ]}>
              <Text style={[
                styles.dateDay,
                isToday && styles.dateDayToday,
                job.status === "started" && styles.dateDayInProgress,
              ]}>
                {jobDate.getDate()}
              </Text>
              <Text style={[
                styles.dateMonth,
                isToday && styles.dateMonthToday,
                job.status === "started" && styles.dateMonthInProgress,
              ]}>
                {jobDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.dayLabelContainer}>
              <Text style={[
                styles.dayLabel,
                isToday && styles.dayLabelToday,
              ]}>
                {getDayLabel()}
              </Text>
              {job.appointment?.timeToBeCompleted && (
                <Text style={styles.timeLabel}>
                  Completed by {job.appointment.timeToBeCompleted}h
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.text }]} />
            <Text style={[styles.statusText, { color: statusInfo.text }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Address & Home Info */}
        <View style={styles.locationSection}>
          <View style={styles.locationIcon}>
            <Icon name="map-marker" size={16} color={colors.primary[500]} />
          </View>
          <View style={styles.locationDetails}>
            {job.appointment?.home?.address ? (
              <Text style={styles.addressText} numberOfLines={2}>
                {job.appointment.home.address}
              </Text>
            ) : job.appointment?.home?.generalArea ? (
              <Text style={styles.addressText}>
                {job.appointment.home.generalArea}
                {job.appointment.home.addressRestricted && (
                  <Text style={styles.restrictedNote}> (Full address available day-of)</Text>
                )}
              </Text>
            ) : (
              <Text style={styles.addressText}>Address pending</Text>
            )}
            {job.appointment?.home && (
              <View style={styles.homeStats}>
                <View style={styles.homeStat}>
                  <Icon name="bed" size={12} color={colors.neutral[400]} />
                  <Text style={styles.homeStatText}>{job.appointment.home.numBeds} bed</Text>
                </View>
                <View style={styles.homeStat}>
                  <Icon name="bath" size={12} color={colors.neutral[400]} />
                  <Text style={styles.homeStatText}>{job.appointment.home.numBaths} bath</Text>
                </View>
                {job.appointment?.duration && (
                  <View style={styles.homeStat}>
                    <Icon name="clock-o" size={12} color={colors.neutral[400]} />
                    <Text style={styles.homeStatText}>{job.appointment.duration}h</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Client & Pay Row */}
        <View style={styles.detailsRow}>
          {job.appointment?.user && (
            <View style={styles.clientChip}>
              <Icon name="user" size={12} color={colors.neutral[500]} />
              <Text style={styles.clientChipText}>
                {job.appointment.user.firstName} {job.appointment.user.lastName?.[0]}.
              </Text>
            </View>
          )}

          {job.payAmount !== undefined && job.payAmount > 0 && (
            <View style={styles.payChip}>
              <Icon name="dollar" size={12} color={colors.success[600]} />
              <Text style={styles.payChipText}>
                {(job.payAmount / 100).toFixed(0)}
                {job.payType === "hourly" && "/hr"}
              </Text>
            </View>
          )}
        </View>

        {/* Start Job Button - ONLY for today's assigned jobs */}
        {isToday && job.status === "assigned" && (
          <Pressable
            style={[styles.startButton, isStarting && styles.buttonDisabled]}
            onPress={(e) => { e.stopPropagation(); onStart(); }}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="play-circle" size={18} color="#fff" />
                <Text style={styles.startButtonText}>Start Job</Text>
              </>
            )}
          </Pressable>
        )}

        {/* In Progress Actions */}
        {job.status === "started" && (
          <View style={styles.inProgressSection}>
            <View style={styles.inProgressTimer}>
              <Icon name="clock-o" size={14} color={colors.warning[600]} />
              <Text style={styles.inProgressTimerText}>
                Started {job.startedAt ? new Date(job.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
              </Text>
            </View>
            <Pressable
              style={[styles.completeButton, isCompleting && styles.buttonDisabled]}
              onPress={(e) => { e.stopPropagation(); onComplete(); }}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check-circle" size={18} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Chevron for details */}
      <View style={styles.chevronContainer}>
        <Icon name="chevron-right" size={14} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

// Main Component
const EmployeeJobList = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [startingJobId, setStartingJobId] = useState(null);
  const [completingJobId, setCompletingJobId] = useState(null);

  // Filter states
  const [filter, setFilter] = useState("upcoming"); // 'upcoming' | 'all' | 'completed'

  const fetchJobs = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const filters = {};
      if (filter === "upcoming") {
        filters.upcoming = true;
      } else if (filter === "completed") {
        filters.status = "completed";
      }

      const result = await BusinessEmployeeService.getMyJobs(state.currentUser.token, filters);
      setJobs(result.jobs || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  const onRefresh = useCallback(() => {
    fetchJobs(true);
  }, [state.currentUser.token, filter]);

  const handleStartJob = async (job) => {
    setStartingJobId(job.id);
    setError(null);
    setSuccess(null);

    try {
      const result = await BusinessEmployeeService.startJob(state.currentUser.token, job.id);

      if (result.success) {
        setSuccess("Job started! Good luck!");
        fetchJobs();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to start job. Please try again.");
    } finally {
      setStartingJobId(null);
    }
  };

  const handleCompleteJob = async (job) => {
    Alert.alert(
      "Complete Job",
      "Are you sure you want to mark this job as complete?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            setCompletingJobId(job.id);
            setError(null);
            setSuccess(null);

            try {
              const result = await BusinessEmployeeService.completeJob(
                state.currentUser.token,
                job.id
              );

              if (result.success) {
                setSuccess("Job completed! Great work!");
                fetchJobs();
              } else {
                setError(result.error);
              }
            } catch (err) {
              setError("Failed to complete job. Please try again.");
            } finally {
              setCompletingJobId(null);
            }
          },
        },
      ]
    );
  };

  const handleViewDetails = (job) => {
    navigate(`/employee/jobs/${job.id}`);
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Count in-progress jobs
  const inProgressCount = jobs.filter((j) => j.status === "started").length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading your jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <View style={styles.headerButtons}>
          <Pressable
            style={styles.calendarButton}
            onPress={() => navigate("/employee/profile", { state: { from: "jobs" } })}
          >
            <Icon name="calendar" size={16} color={colors.primary[600]} />
          </Pressable>
          <Pressable
            style={styles.earningsButton}
            onPress={() => navigate("/employee/earnings")}
          >
            <Icon name="dollar" size={16} color={colors.success[600]} />
            <Text style={styles.earningsButtonText}>Earnings</Text>
          </Pressable>
        </View>
      </View>

      {/* In-Progress Banner */}
      {inProgressCount > 0 && (
        <View style={styles.inProgressBanner}>
          <Icon name="clock-o" size={16} color={colors.warning[700]} />
          <Text style={styles.inProgressBannerText}>
            {inProgressCount} job{inProgressCount > 1 ? "s" : ""} in progress
          </Text>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filterRow}>
        {[
          { value: "upcoming", label: "Upcoming" },
          { value: "all", label: "All" },
          { value: "completed", label: "Completed" },
        ].map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.value && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Messages */}
      {error && (
        <View style={styles.errorMessage}>
          <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorMessageText}>{error}</Text>
        </View>
      )}
      {success && (
        <View style={styles.successMessage}>
          <Icon name="check-circle" size={16} color={colors.success[600]} />
          <Text style={styles.successMessageText}>{success}</Text>
        </View>
      )}

      {/* Job List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon
              name={filter === "completed" ? "check-circle" : "calendar-o"}
              size={48}
              color={colors.neutral[300]}
            />
            <Text style={styles.emptyStateTitle}>
              {filter === "completed" ? "No Completed Jobs" : "No Upcoming Jobs"}
            </Text>
            <Text style={styles.emptyStateText}>
              {filter === "completed"
                ? "Your completed jobs will appear here"
                : "New job assignments will appear here"}
            </Text>
          </View>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStart={() => handleStartJob(job)}
              onComplete={() => handleCompleteJob(job)}
              onViewDetails={() => handleViewDetails(job)}
              isStarting={startingJobId === job.id}
              isCompleting={completingJobId === job.id}
            />
          ))
        )}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  earningsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  earningsButtonText: {
    marginLeft: spacing.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  inProgressBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  inProgressBannerText: {
    marginLeft: spacing.sm,
    color: colors.warning[800],
    fontWeight: typography.fontWeight.medium,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  filterChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },

  // Job Card Styles
  jobCard: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.sm,
  },
  jobCardToday: {
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50] + "30",
  },
  jobCardInProgress: {
    borderWidth: 1,
    borderColor: colors.warning[300],
    backgroundColor: colors.warning[50] + "40",
  },
  cardAccent: {
    width: 4,
  },
  jobCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  chevronContainer: {
    justifyContent: "center",
    paddingRight: spacing.md,
  },

  // Top Row
  jobTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  dateSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  dateBadgeToday: {
    backgroundColor: colors.primary[600],
  },
  dateBadgeInProgress: {
    backgroundColor: colors.warning[500],
  },
  dateDay: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 22,
  },
  dateDayToday: {
    color: "#fff",
  },
  dateDayInProgress: {
    color: "#fff",
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: -2,
  },
  dateMonthToday: {
    color: "rgba(255,255,255,0.9)",
  },
  dateMonthInProgress: {
    color: "rgba(255,255,255,0.9)",
  },
  dayLabelContainer: {
    marginLeft: spacing.sm,
  },
  dayLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  dayLabelToday: {
    color: colors.primary[700],
  },
  timeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 1,
  },

  // Status Badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
  },

  // Location Section
  locationSection: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  locationIcon: {
    width: 24,
    alignItems: "center",
    paddingTop: 2,
  },
  locationDetails: {
    flex: 1,
  },
  addressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    lineHeight: 20,
  },
  restrictedNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  homeStats: {
    flexDirection: "row",
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  homeStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  homeStatText: {
    marginLeft: 4,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Details Row (Client & Pay)
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  clientChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  clientChipText: {
    marginLeft: 4,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  payChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  payChipText: {
    marginLeft: 4,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },

  // Action Buttons
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  startButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  inProgressSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  inProgressTimer: {
    flexDirection: "row",
    alignItems: "center",
  },
  inProgressTimerText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    ...shadows.sm,
  },
  completeButtonText: {
    marginLeft: spacing.xs,
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
    paddingHorizontal: spacing.lg,
  },
  emptyStateTitle: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyStateText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },

  // Messages
  errorMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.md,
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
  successMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success[600],
  },
  successMessageText: {
    marginLeft: spacing.sm,
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default EmployeeJobList;
