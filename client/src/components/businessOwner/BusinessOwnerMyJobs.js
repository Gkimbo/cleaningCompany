import React, { useState, useEffect, useCallback } from "react";
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

const JobCard = ({ job, onPress }) => {
  const appointmentDate = parseLocalDate(job.date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = appointmentDate.toDateString() === today.toDateString();
  const isTomorrow = appointmentDate.toDateString() === tomorrow.toDateString();
  const isPast = appointmentDate < new Date(today.toDateString());

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
    <Pressable
      style={({ pressed }) => [
        styles.jobCard,
        pressed && styles.jobCardPressed,
        isPast && styles.jobCardPast,
      ]}
      onPress={onPress}
    >
      <View style={styles.jobMain}>
        <View style={[
          styles.jobDateBadge,
          isToday && styles.todayBadge,
          isPast && styles.pastBadge,
        ]}>
          <Text style={[
            styles.jobDateText,
            isToday && styles.todayText,
            isPast && styles.pastText,
          ]}>
            {formatDate()}
          </Text>
        </View>
        <View style={styles.jobInfo}>
          <Text style={styles.jobLocation} numberOfLines={1}>
            {job.city || "Unknown"}, {job.state || ""}
          </Text>
          <Text style={styles.jobDetails}>
            {job.numBeds || "?"} bed | {job.numBaths || "?"} bath
          </Text>
          {job.isAssigned && (
            <View style={styles.assignedBadge}>
              <Icon name="user" size={10} color={colors.success[600]} />
              <Text style={styles.assignedText}>
                {job.assignedTo?.type === "self" ? "You" : job.assignedTo?.name || "Assigned"}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.jobMeta}>
        <Text style={styles.jobPrice}>{formatCurrency((job.price || 0) * 100)}</Text>
        <Icon name="chevron-right" size={12} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

const BusinessOwnerMyJobs = ({ state }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("upcoming"); // "upcoming", "all", "completed"

  const fetchJobs = useCallback(async () => {
    try {
      const params = filter === "upcoming" ? "?upcoming=true" : "";
      const response = await FetchData.get(
        `/api/v1/business-owner/my-jobs${params}`,
        state?.currentUser?.token
      );
      setJobs(response?.jobs || []);
    } catch (error) {
      console.error("Error fetching marketplace jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state?.currentUser?.token, filter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  const filteredJobs = jobs.filter(job => {
    if (filter === "completed") return job.completed;
    if (filter === "upcoming") return !job.completed;
    return true;
  });

  const upcomingCount = jobs.filter(j => !j.completed).length;
  const completedCount = jobs.filter(j => j.completed).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Marketplace Jobs</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <Pressable
          style={[styles.filterTab, filter === "upcoming" && styles.filterTabActive]}
          onPress={() => setFilter("upcoming")}
        >
          <Text style={[styles.filterText, filter === "upcoming" && styles.filterTextActive]}>
            Upcoming ({upcomingCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, filter === "completed" && styles.filterTabActive]}
          onPress={() => setFilter("completed")}
        >
          <Text style={[styles.filterText, filter === "completed" && styles.filterTextActive]}>
            Completed ({completedCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
            All ({jobs.length})
          </Text>
        </Pressable>
      </View>

      {/* Jobs List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading jobs...</Text>
          </View>
        ) : filteredJobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="calendar-o" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyTitle}>
              {filter === "upcoming" ? "No upcoming jobs" :
               filter === "completed" ? "No completed jobs" : "No jobs yet"}
            </Text>
            <Text style={styles.emptyText}>
              Pick up jobs from the marketplace to see them here
            </Text>
            <Pressable
              style={styles.browseButton}
              onPress={() => navigate("/new-job-choice")}
            >
              <Icon name="search" size={14} color={colors.neutral[0]} />
              <Text style={styles.browseButtonText}>Browse Marketplace</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPress={() => navigate(`/business-owner/job/${job.id}`)}
              />
            ))}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
  },
  filterTabActive: {
    backgroundColor: colors.primary[600],
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.neutral[0],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  browseButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  jobsList: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: "hidden",
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  jobCardPressed: {
    backgroundColor: colors.neutral[50],
  },
  jobCardPast: {
    opacity: 0.7,
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
    minWidth: 80,
    alignItems: "center",
  },
  todayBadge: {
    backgroundColor: colors.primary[50],
  },
  pastBadge: {
    backgroundColor: colors.neutral[50],
  },
  jobDateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  todayText: {
    color: colors.primary[600],
  },
  pastText: {
    color: colors.text.tertiary,
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
  assignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  assignedText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
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
});

export default BusinessOwnerMyJobs;
