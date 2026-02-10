import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography } from "../../../services/styles/theme";

const PHOTO_REQUIREMENT_LABELS = {
  required: { label: "Photos Required", icon: "camera", color: colors.primary[600] },
  optional: { label: "Photos Optional", icon: "camera", color: colors.neutral[400] },
  hidden: { label: "No Photos", icon: "eye-slash", color: colors.neutral[400] },
};

const JobFlowListItem = ({
  flow,
  onPress,
  onSetDefault,
  onEdit,
  onArchive,
  onDelete,
}) => {
  const photoSetting = PHOTO_REQUIREMENT_LABELS[flow.photoRequirement] || PHOTO_REQUIREMENT_LABELS.required;
  const checklistItemCount = flow.checklistItemCount || 0;
  const assignmentCount = flow.assignmentCount || 0;

  return (
    <Pressable style={styles.container} onPress={() => onPress?.(flow)}>
      <View style={styles.mainContent}>
        {/* Flow Name and Default Badge */}
        <View style={styles.headerRow}>
          <Text style={styles.flowName} numberOfLines={1}>
            {flow.name}
          </Text>
          {flow.isDefault && (
            <View style={styles.defaultBadge}>
              <Icon name="star" size={10} color={colors.success[600]} />
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {flow.description && (
          <Text style={styles.description} numberOfLines={2}>
            {flow.description}
          </Text>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Photo Requirement */}
          <View style={styles.statItem}>
            <Icon name={photoSetting.icon} size={12} color={photoSetting.color} />
            <Text style={[styles.statText, { color: photoSetting.color }]}>
              {photoSetting.label}
            </Text>
          </View>

          {/* Checklist Count */}
          <View style={styles.statItem}>
            <Icon name="check-square-o" size={12} color={colors.text.secondary} />
            <Text style={styles.statText}>
              {checklistItemCount} item{checklistItemCount !== 1 ? "s" : ""}
            </Text>
          </View>

          {/* Assignment Count */}
          <View style={styles.statItem}>
            <Icon name="users" size={12} color={colors.text.secondary} />
            <Text style={styles.statText}>
              {assignmentCount} assignment{assignmentCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsColumn}>
        {!flow.isDefault && onSetDefault && (
          <Pressable
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onSetDefault(flow);
            }}
            hitSlop={8}
          >
            <Icon name="star-o" size={16} color={colors.warning[500]} />
          </Pressable>
        )}
        {onEdit && (
          <Pressable
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onEdit(flow);
            }}
            hitSlop={8}
          >
            <Icon name="pencil" size={16} color={colors.primary[600]} />
          </Pressable>
        )}
        {onArchive && (
          <Pressable
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onArchive(flow);
            }}
            hitSlop={8}
          >
            <Icon name="archive" size={16} color={colors.neutral[400]} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(flow);
            }}
            hitSlop={8}
          >
            <Icon name="trash" size={16} color={colors.error[500]} />
          </Pressable>
        )}
        <Icon name="chevron-right" size={12} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  mainContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  flowName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flexShrink: 1,
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    gap: 3,
  },
  defaultBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[600],
  },
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  actionsColumn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
});

export default JobFlowListItem;
