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
import OfflineBusinessEmployeeService from "../../services/offline/OfflineBusinessEmployeeService";
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

  const jobDate = job.appointment?.date ? new Date(job.appointment.date + "T12:00:00") : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = job.appointment?.date && jobDate.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = jobDate.toDateString() === tomorrow.toDateString();

  const getDayLabel = () => {
    if (isToday) return "Today";
    if (isTomorrow) return "Tmrw";
    return jobDate.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getEstimatedDuration = () => {
    const home = job.appointment?.home;
    if (!home) return "2 hrs";
    const beds = parseInt(home.numBeds) || 2;
    const baths = parseInt(home.numBaths) || 1;
    const hours = Math.ceil((1 + beds * 0.25 + baths * 0.5) * 2) / 2;
    return `${hours} hr${hours !== 1 ? "s" : ""}`;
  };

  const payAmount = (job.payAmount || 0) / 100;
  const home = job.appointment?.home;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.jobCard,
        isToday && job.status === "assigned" && styles.jobCardToday,
        job.status === "started" && styles.jobCardInProgress,
        job.status === "completed" && styles.jobCardCompleted,
        pressed && styles.jobCardPressed,
      ]}
      onPress={onViewDetails}
    >
      {/* Left Section - Date */}
      <View style={[
        styles.dateColumn,
        isToday && styles.dateColumnToday,
        job.status === "started" && styles.dateColumnInProgress,
        job.status === "completed" && styles.dateColumnCompleted,
      ]}>
        <Text style={[
          styles.dateWeekday,
          (isToday || job.status === "started") && styles.dateTextLight,
          job.status === "completed" && styles.dateTextCompleted,
        ]}>
          {getDayLabel()}
        </Text>
        <Text style={[
          styles.dateDay,
          (isToday || job.status === "started") && styles.dateTextLight,
          job.status === "completed" && styles.dateTextCompleted,
        ]}>
          {jobDate.getDate()}
        </Text>
        <Text style={[
          styles.dateMonth,
          (isToday || job.status === "started") && styles.dateTextLightSub,
          job.status === "completed" && styles.dateTextCompletedSub,
        ]}>
          {jobDate.toLocaleDateString("en-US", { month: "short" })}
        </Text>
      </View>

      {/* Main Content */}
      <View style={styles.jobCardContent}>
        {/* Header Row - Status & Pay */}
        <View style={styles.jobHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.text }]} />
            <Text style={[styles.statusText, { color: statusInfo.text }]}>
              {statusInfo.label}
            </Text>
          </View>

          <View style={styles.paySection}>
            <Text style={styles.payAmount}>${payAmount.toFixed(0)}</Text>
            {job.isEstimate && <Text style={styles.payEstimate}>est</Text>}
          </View>
        </View>

        {/* Address */}
        <Text style={styles.addressText} numberOfLines={1}>
          {home?.address || home?.generalArea || "Address pending"}
        </Text>

        {/* Client Name */}
        {job.appointment?.user?.firstName && (
          <Text style={styles.clientName}>
            {job.appointment.user.firstName}
            {job.appointment.user.lastName ? ` ${job.appointment.user.lastName[0]}.` : ""}
          </Text>
        )}

        {/* Meta Tags Row */}
        <View style={styles.metaRow}>
          {home?.numBeds && (
            <View style={styles.metaTag}>
              <Icon name="home" size={10} color={colors.primary[600]} />
              <Text style={styles.metaTagText}>
                {home.numBeds}bd · {home.numBaths}ba
              </Text>
            </View>
          )}
          <View style={styles.metaTag}>
            <Icon name="clock-o" size={10} color={colors.primary[600]} />
            <Text style={styles.metaTagText}>~{getEstimatedDuration()}</Text>
          </View>
          {job.payBreakdown && (
            <View style={[styles.metaTag, styles.metaTagPay]}>
              <Text style={styles.metaTagTextPay}>{job.payBreakdown}</Text>
            </View>
          )}
        </View>

        {/* Start Job Button - ONLY for today's assigned jobs */}
        {isToday && job.status === "assigned" && (
          <Pressable
            style={({ pressed }) => [
              styles.startButton,
              isStarting && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={(e) => { e.stopPropagation(); onStart(); }}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="play-circle" size={16} color="#fff" />
                <Text style={styles.startButtonText}>Start Job</Text>
              </>
            )}
          </Pressable>
        )}

        {/* In Progress Actions */}
        {job.status === "started" && (
          <View style={styles.inProgressSection}>
            <View style={styles.inProgressInfo}>
              <View style={styles.pulsingDot} />
              <Text style={styles.inProgressTimerText}>
                Started {job.startedAt ? new Date(job.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.completeButton,
                isCompleting && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={(e) => { e.stopPropagation(); onComplete(); }}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Completed Info */}
        {job.status === "completed" && job.completedAt && (
          <View style={styles.completedInfo}>
            <Icon name="check-circle" size={12} color={colors.success[500]} />
            <Text style={styles.completedInfoText}>
              Completed {new Date(job.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </View>
        )}
      </View>

      {/* Chevron */}
      <View style={styles.chevronContainer}>
        <Icon name="chevron-right" size={12} color={colors.neutral[400]} />
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

      const result = await OfflineBusinessEmployeeService.getMyJobs(state.currentUser.token, filters);
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
      const result = await OfflineBusinessEmployeeService.startJob(state.currentUser.token, job.id);

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
              const result = await OfflineBusinessEmployeeService.completeJob(
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
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.md,
  },
  jobCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  jobCardToday: {
    borderWidth: 2,
    borderColor: colors.primary[400],
  },
  jobCardInProgress: {
    borderWidth: 2,
    borderColor: colors.warning[400],
  },
  jobCardCompleted: {
    opacity: 0.85,
  },

  // Date Column
  dateColumn: {
    width: 64,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
  },
  dateColumnToday: {
    backgroundColor: colors.primary[600],
  },
  dateColumnInProgress: {
    backgroundColor: colors.warning[500],
  },
  dateColumnCompleted: {
    backgroundColor: colors.success[100],
  },
  dateWeekday: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 28,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginTop: -2,
  },
  dateTextLight: {
    color: "#fff",
  },
  dateTextLightSub: {
    color: "rgba(255,255,255,0.85)",
  },
  dateTextCompleted: {
    color: colors.success[700],
  },
  dateTextCompletedSub: {
    color: colors.success[600],
  },

  // Main Content
  jobCardContent: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.md,
  },
  chevronContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 32,
    backgroundColor: colors.neutral[50],
  },

  // Header Row
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  paySection: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  payAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  payEstimate: {
    fontSize: 9,
    color: colors.success[500],
    marginLeft: 2,
    fontStyle: "italic",
  },

  // Address
  addressText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: 2,
  },

  // Client Name
  clientName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  // Meta Tags
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  metaTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  metaTagText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  metaTagPay: {
    backgroundColor: colors.success[50],
  },
  metaTagTextPay: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
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
    borderRadius: radius.lg,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  startButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.sm,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // In Progress Section
  inProgressSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
  },
  inProgressInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning[500],
    marginRight: spacing.xs,
  },
  inProgressTimerText: {
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
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  completeButtonText: {
    marginLeft: spacing.xs,
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.sm,
  },

  // Completed Info
  completedInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  completedInfoText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
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
