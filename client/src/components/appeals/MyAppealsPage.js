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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../context/AuthContext";
import AppealService from "../../services/fetchRequests/AppealService";
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
  approved: {
    label: "Approved",
    color: colors.success[600],
    bgColor: colors.success[50],
    icon: "check-circle",
  },
  partially_approved: {
    label: "Partially Approved",
    color: colors.success[500],
    bgColor: colors.success[50],
    icon: "check",
  },
  denied: {
    label: "Denied",
    color: colors.error[600],
    bgColor: colors.error[50],
    icon: "times-circle",
  },
  escalated: {
    label: "Escalated",
    color: colors.warning[700],
    bgColor: colors.warning[50],
    icon: "arrow-up",
  },
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

const MyAppealsPage = () => {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAppeals = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    }

    try {
      const result = await AppealService.getMyAppeals(user.token);

      if (result.success) {
        setAppeals(result.appeals || []);
        setError(null);
      } else {
        setError(result.error || "Failed to load appeals");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAppeals();
    }, [])
  );

  const handleRefresh = () => {
    fetchAppeals(true);
  };

  const handleAppealPress = (appeal) => {
    navigation.navigate("AppealDetail", { appealId: appeal.id });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    }
    return "Just now";
  };

  const renderAppealCard = ({ item: appeal }) => {
    const statusConfig = STATUS_CONFIG[appeal.status] || STATUS_CONFIG.submitted;
    const isPending = ["submitted", "under_review", "awaiting_documents", "escalated"].includes(
      appeal.status
    );

    return (
      <TouchableOpacity
        style={styles.appealCard}
        onPress={() => handleAppealPress(appeal)}
        activeOpacity={0.7}
      >
        {/* Status Badge */}
        <View
          style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}
        >
          <Icon name={statusConfig.icon} size={12} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Appeal Info */}
        <View style={styles.appealInfo}>
          <Text style={styles.appealCategory}>
            {CATEGORY_LABELS[appeal.category] || appeal.category}
          </Text>
          <Text style={styles.appealDescription} numberOfLines={2}>
            {appeal.description}
          </Text>
        </View>

        {/* Meta Info */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Icon name="calendar" size={12} color={colors.text.tertiary} />
            <Text style={styles.metaText}>{formatDate(appeal.submittedAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="hashtag" size={12} color={colors.text.tertiary} />
            <Text style={styles.metaText}>#{appeal.id}</Text>
          </View>
        </View>

        {/* Timeline indicator for pending appeals */}
        {isPending && appeal.slaDeadline && (
          <View style={styles.slaContainer}>
            <Icon
              name="clock-o"
              size={12}
              color={
                new Date(appeal.slaDeadline) < new Date()
                  ? colors.error[500]
                  : colors.text.tertiary
              }
            />
            <Text
              style={[
                styles.slaText,
                new Date(appeal.slaDeadline) < new Date() && styles.slaOverdue,
              ]}
            >
              {new Date(appeal.slaDeadline) < new Date()
                ? "Response overdue"
                : `Expected response by ${formatDate(appeal.slaDeadline)}`}
            </Text>
          </View>
        )}

        {/* Resolution summary for closed appeals */}
        {appeal.status === "approved" && appeal.resolution && (
          <View style={styles.resolutionContainer}>
            <Icon name="check" size={12} color={colors.success[600]} />
            <Text style={styles.resolutionText}>
              {appeal.resolution.penaltyWaived && "Penalty waived"}
              {appeal.resolution.feeRefunded && appeal.resolution.penaltyWaived && " • "}
              {appeal.resolution.feeRefunded && `$${(appeal.resolution.refundAmount / 100).toFixed(2)} refunded`}
            </Text>
          </View>
        )}

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="file-text-o" size={48} color={colors.text.tertiary} />
      </View>
      <Text style={styles.emptyTitle}>No Appeals Yet</Text>
      <Text style={styles.emptySubtitle}>
        If you need to appeal a cancellation decision, you can do so within 72
        hours of cancelling.
      </Text>
    </View>
  );

  const renderHeader = () => {
    const pendingCount = appeals.filter((a) =>
      ["submitted", "under_review", "awaiting_documents", "escalated"].includes(a.status)
    ).length;
    const approvedCount = appeals.filter((a) =>
      ["approved", "partially_approved"].includes(a.status)
    ).length;
    const deniedCount = appeals.filter((a) => a.status === "denied").length;

    if (appeals.length === 0) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.success[600] }]}>
            {approvedCount}
          </Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.error[600] }]}>
            {deniedCount}
          </Text>
          <Text style={styles.statLabel}>Denied</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading your appeals...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[500]} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchAppeals()}>
          <Icon name="refresh" size={16} color={colors.neutral[0]} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={appeals}
        renderItem={renderAppealCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
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
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },
  appealCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  appealInfo: {
    marginBottom: spacing.sm,
  },
  appealCategory: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  appealDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  metaContainer: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  slaContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  slaText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  slaOverdue: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium,
  },
  resolutionContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  resolutionText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  arrowContainer: {
    position: "absolute",
    right: spacing.lg,
    top: "50%",
    marginTop: -7,
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
    backgroundColor: colors.neutral[100],
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

export default MyAppealsPage;
