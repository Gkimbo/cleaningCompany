import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../context/AuthContext";
import AppealService from "../../services/fetchRequests/AppealService";
import AppealReviewModal from "./AppealReviewModal";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const STATUS_CONFIG = {
  submitted: {
    label: "Submitted",
    color: colors.primary[500],
    bgColor: colors.primary[50],
    icon: "clock-o",
  },
  under_review: {
    label: "Under Review",
    color: colors.warning[600],
    bgColor: colors.warning[50],
    icon: "eye",
  },
  awaiting_documents: {
    label: "Needs Documents",
    color: colors.secondary[500],
    bgColor: colors.secondary[50],
    icon: "file-text-o",
  },
  escalated: {
    label: "Escalated",
    color: colors.warning[700],
    bgColor: colors.warning[50],
    icon: "arrow-up",
  },
};

const PRIORITY_CONFIG = {
  normal: { label: "Normal", color: colors.text.secondary },
  high: { label: "High", color: colors.warning[600] },
  urgent: { label: "Urgent", color: colors.error[600] },
};

const CATEGORY_LABELS = {
  medical_emergency: "Medical Emergency",
  family_emergency: "Family Emergency",
  natural_disaster: "Natural Disaster",
  property_issue: "Property Issue",
  transportation: "Transportation",
  scheduling_error: "Scheduling Error",
  other: "Other",
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "New" },
  { value: "under_review", label: "In Review" },
  { value: "awaiting_documents", label: "Needs Docs" },
  { value: "escalated", label: "Escalated" },
];

const AppealsQueuePage = () => {
  const { user } = useContext(AuthContext);
  const [appeals, setAppeals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const fetchData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    }

    try {
      const [queueResult, statsResult] = await Promise.all([
        AppealService.getAppealsQueue(user.token, {
          status: filter === "all" ? undefined : filter,
        }),
        AppealService.getAppealsStats(user.token),
      ]);

      if (queueResult.success) {
        setAppeals(queueResult.appeals || []);
      }

      if (statsResult.success) {
        setStats(statsResult);
      }

      setError(null);
    } catch (err) {
      setError("Failed to load appeals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [filter])
  );

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleAppealPress = (appeal) => {
    setSelectedAppeal(appeal);
    setReviewModalVisible(true);
  };

  const handleReviewComplete = () => {
    setReviewModalVisible(false);
    setSelectedAppeal(null);
    fetchData();
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  const getSLAStatus = (slaDeadline) => {
    if (!slaDeadline) return { status: "unknown", text: "No SLA" };

    const now = new Date();
    const deadline = new Date(slaDeadline);
    const diffMs = deadline - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) {
      return { status: "breached", text: "SLA Breached" };
    }
    if (diffHours < 4) {
      return { status: "critical", text: `${diffHours}h left` };
    }
    if (diffHours < 24) {
      return { status: "warning", text: `${diffHours}h left` };
    }
    return { status: "ok", text: `${Math.floor(diffHours / 24)}d left` };
  };

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pendingCount || 0}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.error[600] }]}>
              {stats.slaBreachCount || 0}
            </Text>
            <Text style={styles.statLabel}>SLA Breached</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.warning[600] }]}>
              {stats.urgentCount || 0}
            </Text>
            <Text style={styles.statLabel}>Urgent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.success[600] }]}>
              {stats.resolvedTodayCount || 0}
            </Text>
            <Text style={styles.statLabel}>Resolved Today</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={FILTER_OPTIONS}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === item.value && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(item.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === item.value && styles.filterButtonTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filterList}
      />
    </View>
  );

  const renderAppealCard = ({ item: appeal }) => {
    const statusConfig = STATUS_CONFIG[appeal.status] || STATUS_CONFIG.submitted;
    const priorityConfig = PRIORITY_CONFIG[appeal.priority] || PRIORITY_CONFIG.normal;
    const slaStatus = getSLAStatus(appeal.slaDeadline);

    return (
      <TouchableOpacity
        style={styles.appealCard}
        onPress={() => handleAppealPress(appeal)}
        activeOpacity={0.7}
      >
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.appealId}>#{appeal.id}</Text>
            <View
              style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}
            >
              <Icon name={statusConfig.icon} size={10} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* SLA Indicator */}
          <View
            style={[
              styles.slaBadge,
              slaStatus.status === "breached" && styles.slaBadgeBreached,
              slaStatus.status === "critical" && styles.slaBadgeCritical,
              slaStatus.status === "warning" && styles.slaBadgeWarning,
            ]}
          >
            <Icon
              name="clock-o"
              size={10}
              color={
                slaStatus.status === "breached"
                  ? colors.error[600]
                  : slaStatus.status === "critical"
                  ? colors.error[500]
                  : slaStatus.status === "warning"
                  ? colors.warning[600]
                  : colors.text.tertiary
              }
            />
            <Text
              style={[
                styles.slaText,
                slaStatus.status === "breached" && styles.slaTextBreached,
                slaStatus.status === "critical" && styles.slaTextCritical,
                slaStatus.status === "warning" && styles.slaTextWarning,
              ]}
            >
              {slaStatus.text}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.categoryLabel}>
            {CATEGORY_LABELS[appeal.category] || appeal.category}
          </Text>
          <Text style={styles.descriptionPreview} numberOfLines={2}>
            {appeal.description}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          {/* User Info */}
          <View style={styles.userInfo}>
            <Icon name="user" size={12} color={colors.text.tertiary} />
            <Text style={styles.userName}>
              {appeal.appealer?.firstName} {appeal.appealer?.lastName}
            </Text>
          </View>

          {/* Priority */}
          {appeal.priority !== "normal" && (
            <View style={styles.priorityBadge}>
              <Icon
                name={appeal.priority === "urgent" ? "exclamation" : "flag"}
                size={10}
                color={priorityConfig.color}
              />
              <Text style={[styles.priorityText, { color: priorityConfig.color }]}>
                {priorityConfig.label}
              </Text>
            </View>
          )}

          {/* Time */}
          <Text style={styles.timeAgo}>{formatTimeAgo(appeal.submittedAt)}</Text>
        </View>

        {/* Scrutiny Warning */}
        {appeal.appealer?.appealScrutinyLevel &&
          appeal.appealer.appealScrutinyLevel !== "none" && (
            <View style={styles.scrutinyBanner}>
              <Icon name="eye" size={12} color={colors.warning[700]} />
              <Text style={styles.scrutinyText}>
                User under {appeal.appealer.appealScrutinyLevel.replace("_", " ")} scrutiny
              </Text>
            </View>
          )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="check-circle" size={48} color={colors.success[500]} />
      </View>
      <Text style={styles.emptyTitle}>All Caught Up!</Text>
      <Text style={styles.emptySubtitle}>
        {filter === "all"
          ? "There are no pending appeals to review."
          : `No appeals with "${FILTER_OPTIONS.find((f) => f.value === filter)?.label}" status.`}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading appeals queue...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[500]} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
          <Icon name="refresh" size={16} color={colors.neutral[0]} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderStatsCard()}
      {renderFilters()}

      <FlatList
        data={appeals}
        renderItem={renderAppealCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Review Modal */}
      <AppealReviewModal
        visible={reviewModalVisible}
        appeal={selectedAppeal}
        onClose={() => {
          setReviewModalVisible(false);
          setSelectedAppeal(null);
        }}
        onComplete={handleReviewComplete}
      />
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.secondary,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  statsContainer: {
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  statNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  filterContainer: {
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary[500],
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  filterButtonTextActive: {
    color: colors.neutral[0],
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  appealCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appealId: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  slaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    gap: 4,
  },
  slaBadgeBreached: {
    backgroundColor: colors.error[50],
  },
  slaBadgeCritical: {
    backgroundColor: colors.error[50],
  },
  slaBadgeWarning: {
    backgroundColor: colors.warning[50],
  },
  slaText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  slaTextBreached: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
  },
  slaTextCritical: {
    color: colors.error[500],
    fontWeight: typography.fontWeight.medium,
  },
  slaTextWarning: {
    color: colors.warning[600],
  },
  cardContent: {
    marginBottom: spacing.sm,
  },
  categoryLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  descriptionPreview: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  userName: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priorityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  timeAgo: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: "auto",
  },
  scrutinyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  scrutinyText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    minHeight: 300,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
});

export default AppealsQueuePage;
