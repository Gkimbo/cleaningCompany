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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const isUpcoming = new Date(job.appointment?.date) >= new Date().setHours(0, 0, 0, 0);
  const isToday =
    new Date(job.appointment?.date).toDateString() === new Date().toDateString();

  return (
    <Pressable style={styles.jobCard} onPress={onViewDetails}>
      {isToday && (
        <View style={styles.todayBanner}>
          <Icon name="calendar-check-o" size={12} color="#fff" />
          <Text style={styles.todayBannerText}>Today</Text>
        </View>
      )}

      <View style={styles.jobCardHeader}>
        <View style={styles.jobDateBadge}>
          <Text style={styles.jobDateDay}>
            {new Date(job.appointment?.date).getDate()}
          </Text>
          <Text style={styles.jobDateMonth}>
            {new Date(job.appointment?.date).toLocaleDateString("en-US", {
              month: "short",
            })}
          </Text>
        </View>

        <View style={styles.jobInfo}>
          {job.appointment?.home?.address && (
            <Text style={styles.jobAddress}>{job.appointment.home.address}</Text>
          )}
          <Text style={styles.jobTime}>
            {formatTime(job.appointment?.startTime)} - {job.appointment?.duration || "2"} hours
          </Text>
          {job.appointment?.home && (
            <Text style={styles.jobHomeInfo}>
              {job.appointment.home.numBeds} bed, {job.appointment.home.numBaths} bath
            </Text>
          )}
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.text }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Client info (if allowed) */}
      {job.appointment?.user && (
        <View style={styles.clientInfo}>
          <Icon name="user" size={14} color={colors.neutral[400]} />
          <Text style={styles.clientName}>
            {job.appointment.user.firstName} {job.appointment.user.lastName?.[0]}.
          </Text>
        </View>
      )}

      {/* Pay info (if allowed) */}
      {job.payAmount !== undefined && (
        <View style={styles.payInfo}>
          <Text style={styles.payLabel}>Your Pay:</Text>
          <Text style={styles.payAmount}>
            ${(job.payAmount / 100).toFixed(2)}
            {job.payType === "hourly" && "/hr"}
          </Text>
        </View>
      )}

      {/* Actions for upcoming jobs */}
      {isUpcoming && job.status === "assigned" && (
        <View style={styles.jobActions}>
          <Pressable
            style={[styles.startButton, isStarting && styles.buttonDisabled]}
            onPress={onStart}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="play" size={14} color="#fff" />
                <Text style={styles.startButtonText}>Start Job</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Complete button for in-progress jobs */}
      {job.status === "started" && (
        <View style={styles.jobActions}>
          <View style={styles.inProgressInfo}>
            <Icon name="clock-o" size={14} color={colors.warning[600]} />
            <Text style={styles.inProgressText}>
              Started at {job.startedAt ? new Date(job.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
            </Text>
          </View>
          <Pressable
            style={[styles.completeButton, isCompleting && styles.buttonDisabled]}
            onPress={onComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check" size={14} color="#fff" />
                <Text style={styles.completeButtonText}>Complete Job</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
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
        <Pressable
          style={styles.earningsButton}
          onPress={() => navigate("/employee/earnings")}
        >
          <Icon name="dollar" size={16} color={colors.success[600]} />
          <Text style={styles.earningsButtonText}>Earnings</Text>
        </Pressable>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  jobCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  todayBanner: {
    position: "absolute",
    top: 0,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  todayBannerText: {
    marginLeft: spacing.xs,
    color: "#fff",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  jobCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  jobDateBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  jobDateDay: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  jobDateMonth: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    textTransform: "uppercase",
  },
  jobInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  jobAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobTime: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  jobHomeInfo: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  clientInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  clientName: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  payInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    backgroundColor: colors.success[50],
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  payLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  payAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  jobActions: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  startButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  completeButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inProgressInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  inProgressText: {
    marginLeft: spacing.sm,
    color: colors.warning[700],
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
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
  successMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
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
