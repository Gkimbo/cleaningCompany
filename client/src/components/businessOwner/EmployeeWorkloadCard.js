import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

/**
 * Get workload status info based on percentage
 * @param {number} percent - Workload percentage relative to team average
 * @returns {Object} { color, label, icon }
 */
const getWorkloadStatus = (percent) => {
  if (percent > 100) {
    return {
      color: colors.error[500],
      bgColor: colors.error[50],
      label: "High workload",
      icon: "fire",
    };
  } else if (percent >= 80) {
    return {
      color: colors.warning[600],
      bgColor: colors.warning[50],
      label: "About average",
      icon: null,
    };
  } else if (percent >= 40) {
    return {
      color: colors.success[600],
      bgColor: colors.success[50],
      label: "Good for more jobs",
      icon: "plus-circle",
    };
  } else {
    return {
      color: colors.neutral[400],
      bgColor: colors.neutral[100],
      label: "Under-utilized",
      icon: "exclamation-circle",
    };
  }
};

/**
 * Format employment duration for display
 * @param {number} days - Employment days
 * @param {number} weeks - Employment weeks
 * @returns {string} Formatted duration string
 */
const formatEmploymentDuration = (days, weeks) => {
  if (days < 7) {
    return `${days} day${days !== 1 ? "s" : ""}`;
  } else if (weeks < 5) {
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  } else {
    const months = Math.floor(weeks / 4);
    return `${months} month${months !== 1 ? "s" : ""}`;
  }
};

const EmployeeWorkloadCard = ({
  employee,
  onPress,
  onAssignJob,
  hasUnassignedJobs,
}) => {
  const workloadStatus = getWorkloadStatus(employee.workloadPercent);
  const progressWidth = Math.min(100, employee.workloadPercent);

  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(employee)}
    >
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(employee.firstName?.[0] || "E").toUpperCase()}
            </Text>
          </View>
          {employee.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>
            {employee.firstName} {employee.lastName?.[0]}.
          </Text>
          <Text style={styles.employedDuration}>
            Employed: {formatEmploymentDuration(employee.employmentDays, employee.employmentWeeks)}
          </Text>
        </View>
        {hasUnassignedJobs && (
          <Pressable
            style={styles.assignButton}
            onPress={(e) => {
              e.stopPropagation();
              onAssignJob(employee);
            }}
          >
            <Icon name="plus" size={12} color="#fff" />
            <Text style={styles.assignButtonText}>Assign</Text>
          </Pressable>
        )}
      </View>

      {/* Workload Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressWidth}%`,
                backgroundColor: workloadStatus.color,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: workloadStatus.color }]}>
          {employee.workloadPercent}%
        </Text>
      </View>

      {/* Status Message */}
      {employee.workloadPercent !== 0 && (
        <View style={[styles.statusContainer, { backgroundColor: workloadStatus.bgColor }]}>
          {workloadStatus.icon && (
            <Icon name={workloadStatus.icon} size={12} color={workloadStatus.color} />
          )}
          <Text style={[styles.statusText, { color: workloadStatus.color }]}>
            {workloadStatus.label}
          </Text>
        </View>
      )}

      {/* Hours Grid */}
      <View style={styles.hoursGrid}>
        <View style={styles.hoursItem}>
          <Text style={styles.hoursValue}>{employee.hours.thisWeek}h</Text>
          <Text style={styles.hoursLabel}>Week</Text>
        </View>
        <View style={styles.hoursDivider} />
        <View style={styles.hoursItem}>
          <Text style={styles.hoursValue}>{employee.hours.thisMonth}h</Text>
          <Text style={styles.hoursLabel}>Month</Text>
        </View>
        <View style={styles.hoursDivider} />
        <View style={styles.hoursItem}>
          <Text style={styles.hoursValue}>{employee.hours.allTime}h</Text>
          <Text style={styles.hoursLabel}>Total</Text>
        </View>
      </View>

      {/* Average Hours */}
      <View style={styles.avgContainer}>
        <Icon name="line-chart" size={12} color={colors.text.tertiary} />
        <Text style={styles.avgText}>
          Avg: {employee.avgHoursPerWeek}h/week
        </Text>
        <Text style={styles.jobsText}>
          {employee.jobs.allTime} job{employee.jobs.allTime !== 1 ? "s" : ""} total
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  newBadge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    backgroundColor: colors.success[500],
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  newBadgeText: {
    fontSize: 8,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    letterSpacing: 0.5,
  },
  nameContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  employedDuration: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  assignButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: "#fff",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.full,
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    width: 40,
    textAlign: "right",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  hoursGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  hoursItem: {
    alignItems: "center",
    flex: 1,
  },
  hoursValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  hoursLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  hoursDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.light,
  },
  avgContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm,
  },
  avgText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  jobsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
});

export default EmployeeWorkloadCard;
