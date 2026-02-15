import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../services/AuthContext";
import ConflictService from "../../services/fetchRequests/ConflictService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const ConflictsStatsWidget = ({ onNavigateToConflicts }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const result = await ConflictService.getStats(user.token);
      if (result.success) {
        setStats(result);
      }
    } catch (err) {
      console.error("Failed to fetch conflict stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (onNavigateToConflicts) {
      onNavigateToConflicts();
    } else {
      navigate("/conflicts");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Icon name="balance-scale" size={18} color={colors.primary[600]} />
          <Text style={styles.title}>Conflict Resolution</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  if (!stats) {
    return null;
  }

  const pendingCount = stats.totalPending || 0;
  const slaBreached = stats.slaBreachCount || 0;
  const urgentCount = stats.appeals?.urgent || 0;

  // Don't show if no conflicts at all
  if (pendingCount === 0 && slaBreached === 0) {
    return (
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="balance-scale" size={18} color={colors.primary[600]} />
            <Text style={styles.title}>Conflict Resolution</Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
        </View>
        <View style={styles.emptyContent}>
          <Icon name="check-circle" size={24} color={colors.success[500]} />
          <Text style={styles.emptyText}>All caught up! No pending conflicts.</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="balance-scale" size={18} color={colors.primary[600]} />
          <Text style={styles.title}>Conflict Resolution</Text>
        </View>
        <View style={styles.headerRight}>
          {slaBreached > 0 && (
            <View style={styles.alertBadge}>
              <Icon name="exclamation" size={10} color={colors.neutral[0]} />
            </View>
          )}
          <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
        </View>
      </View>

      <View style={styles.statsRow}>
        {/* Pending */}
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary[100] }]}>
            <Icon name="folder-open" size={16} color={colors.primary[600]} />
          </View>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>

        {/* SLA Breached */}
        <View style={styles.statItem}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: slaBreached > 0 ? colors.error[100] : colors.neutral[100] },
            ]}
          >
            <Icon
              name="exclamation-triangle"
              size={16}
              color={slaBreached > 0 ? colors.error[600] : colors.text.tertiary}
            />
          </View>
          <Text
            style={[
              styles.statNumber,
              slaBreached > 0 && { color: colors.error[600] },
            ]}
          >
            {slaBreached}
          </Text>
          <Text style={styles.statLabel}>SLA Breach</Text>
        </View>

        {/* Urgent */}
        <View style={styles.statItem}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: urgentCount > 0 ? colors.warning[100] : colors.neutral[100] },
            ]}
          >
            <Icon
              name="flag"
              size={16}
              color={urgentCount > 0 ? colors.warning[600] : colors.text.tertiary}
            />
          </View>
          <Text
            style={[
              styles.statNumber,
              urgentCount > 0 && { color: colors.warning[600] },
            ]}
          >
            {urgentCount}
          </Text>
          <Text style={styles.statLabel}>Urgent</Text>
        </View>

        {/* Resolved This Week */}
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: colors.success[100] }]}>
            <Icon name="check" size={16} color={colors.success[600]} />
          </View>
          <Text style={[styles.statNumber, { color: colors.success[600] }]}>
            {stats.appeals?.resolvedThisWeek || 0}
          </Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      {/* Alert banner for SLA breaches */}
      {slaBreached > 0 && (
        <View style={styles.alertBanner}>
          <Icon name="exclamation-circle" size={14} color={colors.error[600]} />
          <Text style={styles.alertText}>
            {slaBreached} case{slaBreached > 1 ? "s" : ""} past SLA deadline
          </Text>
        </View>
      )}

      {/* Type Breakdown */}
      <View style={styles.typeBreakdown}>
        <View style={styles.typeItem}>
          <View style={[styles.typeDot, { backgroundColor: colors.primary[500] }]} />
          <Text style={styles.typeLabel}>Appeals</Text>
          <Text style={styles.typeCount}>{stats.appeals?.pending || 0}</Text>
        </View>
        <View style={styles.typeItem}>
          <View style={[styles.typeDot, { backgroundColor: colors.warning[500] }]} />
          <Text style={styles.typeLabel}>Adjustments</Text>
          <Text style={styles.typeCount}>{stats.adjustments?.pending || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  alertBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error[500],
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  emptyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  alertText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    fontWeight: typography.fontWeight.medium,
  },
  typeBreakdown: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  typeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  typeCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
});

export default ConflictsStatsWidget;
