import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const RecurringScheduleCard = ({ schedules, onViewAll, onPauseSchedule }) => {
  if (!schedules || schedules.length === 0) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const frequencyText = {
    weekly: "Weekly",
    biweekly: "Every 2 Weeks",
    monthly: "Monthly",
  };

  const getFrequencyColor = (frequency) => {
    switch (frequency) {
      case "weekly":
        return colors.primary[600];
      case "biweekly":
        return colors.secondary[600];
      case "monthly":
        return colors.accent[600];
      default:
        return colors.neutral[500];
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Feather name="repeat" size={16} color={colors.primary[600]} />
          </View>
          <Text style={styles.headerTitle}>Recurring Cleanings</Text>
        </View>
        {onViewAll && schedules.length > 2 && (
          <Pressable onPress={onViewAll}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.content}>
        {schedules.slice(0, 2).map((schedule) => (
          <View key={schedule.id} style={styles.scheduleItem}>
            <View style={styles.scheduleHeader}>
              <View
                style={[
                  styles.frequencyBadge,
                  { backgroundColor: getFrequencyColor(schedule.frequency) + "15" },
                ]}
              >
                <Text
                  style={[
                    styles.frequencyText,
                    { color: getFrequencyColor(schedule.frequency) },
                  ]}
                >
                  {frequencyText[schedule.frequency] || schedule.frequency}
                </Text>
              </View>
              {schedule.isPaused && (
                <View style={styles.pausedBadge}>
                  <Feather name="pause-circle" size={12} color={colors.warning[600]} />
                  <Text style={styles.pausedText}>Paused</Text>
                </View>
              )}
            </View>

            <View style={styles.scheduleDetails}>
              <View style={styles.detailRow}>
                <Feather name="calendar" size={14} color={colors.text.tertiary} />
                <Text style={styles.detailText}>
                  {schedule.dayName}s{schedule.timeWindow ? ` (${schedule.timeWindow})` : ""}
                </Text>
              </View>

              {schedule.home && (
                <View style={styles.detailRow}>
                  <Feather name="home" size={14} color={colors.text.tertiary} />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {schedule.home.nickName || schedule.home.address}
                  </Text>
                </View>
              )}

              {schedule.cleaner && (
                <View style={styles.detailRow}>
                  <Feather name="user" size={14} color={colors.text.tertiary} />
                  <Text style={styles.detailText}>
                    {schedule.cleaner.firstName} {schedule.cleaner.lastName}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Feather name="dollar-sign" size={14} color={colors.text.tertiary} />
                <Text style={styles.detailText}>
                  ${parseFloat(schedule.price).toFixed(2)} per cleaning
                </Text>
              </View>
            </View>

            {!schedule.isPaused && schedule.nextScheduledDate && (
              <View style={styles.nextCleaningContainer}>
                <View style={styles.nextCleaningBadge}>
                  <Feather name="clock" size={12} color={colors.primary[600]} />
                  <Text style={styles.nextCleaningLabel}>Next:</Text>
                  <Text style={styles.nextCleaningDate}>
                    {formatDate(schedule.nextScheduledDate)}
                  </Text>
                </View>
              </View>
            )}

            {schedule.isPaused && schedule.pausedUntil && (
              <View style={styles.pausedUntilContainer}>
                <Text style={styles.pausedUntilText}>
                  Resumes {formatDate(schedule.pausedUntil)}
                </Text>
              </View>
            )}
          </View>
        ))}

        {schedules.length > 2 && (
          <Text style={styles.moreSchedulesText}>
            +{schedules.length - 2} more schedule{schedules.length - 2 > 1 ? "s" : ""}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Feather name="info" size={14} color={colors.text.tertiary} />
          <Text style={styles.footerText}>
            Appointments are created automatically. Your card is charged after each cleaning.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  scheduleItem: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  frequencyBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  frequencyText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  pausedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  pausedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  scheduleDetails: {
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  nextCleaningContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  nextCleaningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  nextCleaningLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  nextCleaningDate: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  pausedUntilContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  pausedUntilText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    fontStyle: "italic",
  },
  moreSchedulesText: {
    textAlign: "center",
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  footer: {
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  footerText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
});

export default RecurringScheduleCard;
