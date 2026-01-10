import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const ChecklistReviewSection = ({ checklist, appointment, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading checklist...</Text>
      </View>
    );
  }

  const checklistData = checklist?.checklistData || appointment?.completionChecklistData || {};
  const completionNotes = checklist?.completionNotes || appointment?.completionNotes;

  const checklistItems = Object.entries(checklistData);

  if (checklistItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="list-alt" size={48} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Checklist Data</Text>
        <Text style={styles.emptyText}>
          No completion checklist was recorded for this appointment.
        </Text>
      </View>
    );
  }

  const completedCount = checklistItems.filter(([_, data]) => data?.completed).length;
  const totalCount = checklistItems.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Icon name="check-square" size={20} color={colors.primary[600]} />
          <Text style={styles.summaryTitle}>Completion Summary</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${completionPercentage}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedCount} of {totalCount} tasks ({completionPercentage}%)
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Icon name="check" size={14} color={colors.success[500]} />
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.stat}>
            <Icon name="times" size={14} color={colors.error[500]} />
            <Text style={styles.statNumber}>{totalCount - completedCount}</Text>
            <Text style={styles.statLabel}>Incomplete</Text>
          </View>
        </View>
      </View>

      {/* Checklist Items */}
      <View style={styles.checklistCard}>
        <Text style={styles.sectionTitle}>Task Details</Text>

        {checklistItems.map(([taskName, taskData], index) => {
          const isCompleted = taskData?.completed;
          const timestamp = taskData?.completedAt || taskData?.timestamp;
          const notes = taskData?.notes;

          return (
            <View
              key={taskName}
              style={[
                styles.checklistItem,
                index !== checklistItems.length - 1 && styles.checklistItemBorder,
              ]}
            >
              <View style={styles.checklistItemHeader}>
                <View
                  style={[
                    styles.checkbox,
                    isCompleted ? styles.checkboxCompleted : styles.checkboxIncomplete,
                  ]}
                >
                  <Icon
                    name={isCompleted ? "check" : "times"}
                    size={10}
                    color={isCompleted ? colors.neutral[0] : colors.error[500]}
                  />
                </View>
                <View style={styles.checklistItemContent}>
                  <Text
                    style={[
                      styles.taskName,
                      !isCompleted && styles.taskNameIncomplete,
                    ]}
                  >
                    {taskName.replace(/_/g, " ")}
                  </Text>
                  {timestamp && (
                    <View style={styles.timestampRow}>
                      <Icon name="clock-o" size={10} color={colors.text.tertiary} />
                      <Text style={styles.timestampText}>
                        {formatTimestamp(timestamp)}
                      </Text>
                    </View>
                  )}
                </View>
                {isCompleted && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>Done</Text>
                  </View>
                )}
              </View>
              {notes && (
                <View style={styles.taskNotes}>
                  <Icon name="comment" size={10} color={colors.text.tertiary} />
                  <Text style={styles.taskNotesText}>{notes}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Completion Notes */}
      {completionNotes && (
        <View style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <Icon name="sticky-note" size={16} color={colors.primary[600]} />
            <Text style={styles.notesTitle}>Cleaner Notes</Text>
          </View>
          <Text style={styles.notesText}>{completionNotes}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.success[500],
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
  },
  stat: {
    alignItems: "center",
    gap: spacing.xs,
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
  checklistCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  checklistItem: {
    paddingVertical: spacing.sm,
  },
  checklistItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  checklistItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxCompleted: {
    backgroundColor: colors.success[500],
  },
  checkboxIncomplete: {
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.error[300],
  },
  checklistItemContent: {
    flex: 1,
  },
  taskName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  taskNameIncomplete: {
    color: colors.text.tertiary,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  timestampText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  completedBadge: {
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  completedBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  taskNotes: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: 28,
    backgroundColor: colors.neutral[50],
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  taskNotesText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  notesCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  notesTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
});

export default ChecklistReviewSection;
