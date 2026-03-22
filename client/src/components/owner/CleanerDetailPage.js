import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import CleanerManagementService from "../../services/fetchRequests/CleanerManagementService";
import MessageService from "../../services/fetchRequests/MessageClass";
import useSafeNavigation from "../../hooks/useSafeNavigation";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Format currency helper
const formatCurrency = (cents) => {
  if (!cents && cents !== 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
};

const CleanerDetailPage = ({ state }) => {
  const { cleanerId } = useParams();
  const { goBack, navigate } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaner, setCleaner] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCleanerDetails();
  }, [cleanerId]);

  const fetchCleanerDetails = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await CleanerManagementService.getCleanerDetails(
        state.currentUser.token,
        cleanerId
      );

      if (result.success) {
        setCleaner(result.cleaner);
        setMetrics(result.metrics);
        setEarnings(result.earnings);
      } else {
        setError(result.error || "Failed to load cleaner details");
      }
    } catch (err) {
      console.error("Error fetching cleaner details:", err);
      setError("Failed to load cleaner details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSendMessage = async () => {
    try {
      const result = await MessageService.createOwnerDirectConversation(
        cleanerId,
        state.currentUser.token
      );

      if (result.conversation) {
        navigate(`/messages/${result.conversation.id}`);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error("Error creating conversation:", err);
      setError("Failed to start conversation");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={goBack}>
            <Icon name="arrow-left" size={18} color={colors.neutral[700]} />
          </Pressable>
          <Text style={styles.headerTitle}>Cleaner Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !cleaner) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={goBack}>
            <Icon name="arrow-left" size={18} color={colors.neutral[700]} />
          </Pressable>
          <Text style={styles.headerTitle}>Cleaner Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
          <Text style={styles.errorText}>{error || "Cleaner not found"}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchCleanerDetails()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Icon name="arrow-left" size={18} color={colors.neutral[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>Cleaner Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCleanerDetails(true)}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View
            style={[
              styles.avatar,
              cleaner.accountFrozen && styles.avatarFrozen,
            ]}
          >
            <Text style={styles.avatarText}>
              {(
                (cleaner.firstName && cleaner.firstName[0]) ||
                (cleaner.username && cleaner.username[0]) ||
                "C"
              ).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.cleanerName}>
            {cleaner.firstName} {cleaner.lastName}
          </Text>
          <Text style={styles.cleanerUsername}>@{cleaner.username}</Text>

          {/* Status Badges */}
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.statusBadge,
                cleaner.accountFrozen
                  ? styles.statusBadgeFrozen
                  : styles.statusBadgeActive,
              ]}
            >
              <Icon
                name={cleaner.accountFrozen ? "ban" : "check-circle"}
                size={12}
                color={
                  cleaner.accountFrozen
                    ? colors.error[700]
                    : colors.success[700]
                }
              />
              <Text
                style={[
                  styles.statusText,
                  cleaner.accountFrozen
                    ? styles.statusTextFrozen
                    : styles.statusTextActive,
                ]}
              >
                {cleaner.accountFrozen ? "Frozen" : "Active"}
              </Text>
            </View>
            {cleaner.warningCount > 0 && (
              <View style={styles.warningBadge}>
                <Icon
                  name="exclamation-triangle"
                  size={12}
                  color={colors.warning[700]}
                />
                <Text style={styles.warningBadgeText}>
                  {cleaner.warningCount} Warning
                  {cleaner.warningCount > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Icon name="briefcase" size={24} color={colors.primary[500]} />
            <Text style={styles.statValue}>
              {metrics?.totalJobsCompleted || 0}
            </Text>
            <Text style={styles.statLabel}>Jobs Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="star" size={24} color={colors.warning[500]} />
            <Text style={styles.statValue}>
              {metrics?.averageRating
                ? metrics.averageRating.toFixed(1)
                : "N/A"}
            </Text>
            <Text style={styles.statLabel}>
              Avg Rating ({metrics?.totalReviews || 0})
            </Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="check-circle" size={24} color={colors.success[500]} />
            <Text style={styles.statValue}>
              {metrics?.reliabilityScore !== null
                ? `${metrics.reliabilityScore}%`
                : "N/A"}
            </Text>
            <Text style={styles.statLabel}>Reliability</Text>
          </View>
        </View>

        {/* Earnings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings Summary</Text>
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>Total Earnings</Text>
                <Text style={styles.earningsValue}>
                  {formatCurrency(earnings?.totalEarnings)}
                </Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>This Month</Text>
                <Text style={styles.earningsValue}>
                  {formatCurrency(earnings?.earningsThisMonth)}
                </Text>
              </View>
            </View>
            <View style={styles.earningsFooter}>
              <Text style={styles.earningsAvgLabel}>Average Per Job:</Text>
              <Text style={styles.earningsAvgValue}>
                {formatCurrency(earnings?.averagePerJob)}
              </Text>
            </View>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Icon name="envelope" size={16} color={colors.neutral[500]} />
              <Text style={styles.infoText}>{cleaner.email}</Text>
            </View>
            {cleaner.phone && (
              <View style={styles.infoRow}>
                <Icon name="phone" size={16} color={colors.neutral[500]} />
                <Text style={styles.infoText}>{cleaner.phone}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Icon name="calendar" size={16} color={colors.neutral[500]} />
              <Text style={styles.infoText}>
                Joined {formatDate(cleaner.createdAt)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="clock-o" size={16} color={colors.neutral[500]} />
              <Text style={styles.infoText}>
                Last login: {formatDate(cleaner.lastLogin)}
              </Text>
            </View>
          </View>
        </View>

        {/* Availability */}
        {cleaner.daysWorking && cleaner.daysWorking.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.availabilityCard}>
              <View style={styles.daysRow}>
                {cleaner.daysWorking.map((day) => (
                  <View key={day} style={styles.dayBadge}>
                    <Text style={styles.dayText}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Frozen Reason */}
        {cleaner.accountFrozen && cleaner.accountFrozenReason && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Status</Text>
            <View style={styles.frozenCard}>
              <Icon name="snowflake-o" size={20} color={colors.error[600]} />
              <View style={styles.frozenContent}>
                <Text style={styles.frozenTitle}>Account Frozen</Text>
                <Text style={styles.frozenReason}>
                  {cleaner.accountFrozenReason}
                </Text>
                <Text style={styles.frozenDate}>
                  Frozen on {formatDate(cleaner.accountFrozenAt)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Button */}
        <Pressable style={styles.messageBtn} onPress={handleSendMessage}>
          <Icon name="comment" size={18} color={colors.neutral[0]} />
          <Text style={styles.messageBtnText}>Send Message</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.md,
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary[600],
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  profileHeader: {
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarFrozen: {
    backgroundColor: colors.error[100],
  },
  avatarText: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  cleanerName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  cleanerUsername: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[500],
    marginBottom: spacing.md,
  },
  badgesRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  statusBadgeActive: {
    backgroundColor: colors.success[100],
  },
  statusBadgeFrozen: {
    backgroundColor: colors.error[100],
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statusTextActive: {
    color: colors.success[700],
  },
  statusTextFrozen: {
    color: colors.error[700],
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
  },
  warningBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  earningsCard: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[100],
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.md,
  },
  earningsItem: {
    alignItems: "center",
    flex: 1,
  },
  earningsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },
  earningsValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[800],
  },
  earningsDivider: {
    width: 1,
    backgroundColor: colors.success[200],
  },
  earningsFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  earningsAvgLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  earningsAvgValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[800],
  },
  infoCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  infoText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[700],
    flex: 1,
  },
  availabilityCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dayBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  frozenCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  frozenContent: {
    flex: 1,
  },
  frozenTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
    marginBottom: spacing.xs,
  },
  frozenReason: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    fontStyle: "italic",
    marginBottom: spacing.xs,
  },
  frozenDate: {
    fontSize: typography.fontSize.xs,
    color: colors.error[500],
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  messageBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
});

export default CleanerDetailPage;
