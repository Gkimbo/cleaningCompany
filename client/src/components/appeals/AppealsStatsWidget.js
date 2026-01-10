import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
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

const AppealsStatsWidget = ({ onNavigateToAppeals }) => {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const result = await AppealService.getAppealsOverview(user.token);
      if (result.success) {
        setStats(result);
      }
    } catch (err) {
      console.error("Failed to fetch appeal stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (onNavigateToAppeals) {
      onNavigateToAppeals();
    } else {
      navigation.navigate("AppealsQueue");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Icon name="gavel" size={18} color={colors.primary[600]} />
          <Text style={styles.title}>Cancellation Appeals</Text>
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

  const pendingCount = (stats.statusCounts?.submitted || 0) +
    (stats.statusCounts?.under_review || 0) +
    (stats.statusCounts?.awaiting_documents || 0);
  const slaBreached = stats.slaBreachCount || 0;
  const urgentCount = stats.priorityCounts?.urgent || 0;

  // Don't show if no appeals at all
  if (pendingCount === 0 && slaBreached === 0) {
    return (
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="gavel" size={18} color={colors.primary[600]} />
            <Text style={styles.title}>Cancellation Appeals</Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
        </View>
        <View style={styles.emptyContent}>
          <Icon name="check-circle" size={24} color={colors.success[500]} />
          <Text style={styles.emptyText}>All caught up! No pending appeals.</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="gavel" size={18} color={colors.primary[600]} />
          <Text style={styles.title}>Cancellation Appeals</Text>
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
            <Icon name="clock-o" size={16} color={colors.primary[600]} />
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
          <Text style={styles.statLabel}>SLA Breached</Text>
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

        {/* Resolved Today */}
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: colors.success[100] }]}>
            <Icon name="check" size={16} color={colors.success[600]} />
          </View>
          <Text style={[styles.statNumber, { color: colors.success[600] }]}>
            {stats.appealsResolvedThisWeek || 0}
          </Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      {/* Alert banner for SLA breaches */}
      {slaBreached > 0 && (
        <View style={styles.alertBanner}>
          <Icon name="exclamation-circle" size={14} color={colors.error[600]} />
          <Text style={styles.alertText}>
            {slaBreached} appeal{slaBreached > 1 ? "s" : ""} past SLA deadline
          </Text>
        </View>
      )}
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
});

export default AppealsStatsWidget;
