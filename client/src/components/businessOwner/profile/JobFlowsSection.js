import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import JobFlowService from "../../../services/fetchRequests/JobFlowService";

const FlowPreviewItem = ({ flow }) => {
  const navigate = useNavigate();

  return (
    <Pressable
      style={styles.flowItem}
      onPress={() => navigate(`/job-flows/${flow.id}`)}
    >
      <View style={styles.flowInfo}>
        <View style={styles.flowNameRow}>
          <Text style={styles.flowName} numberOfLines={1}>{flow.name}</Text>
          {flow.isDefault && (
            <View style={styles.defaultBadge}>
              <Icon name="star" size={8} color={colors.success[600]} />
            </View>
          )}
        </View>
        <Text style={styles.flowMeta}>
          {flow.checklistItemCount || 0} items
        </Text>
      </View>
      <Icon name="chevron-right" size={10} color={colors.neutral[300]} />
    </Pressable>
  );
};

const JobFlowsSection = ({ state }) => {
  const navigate = useNavigate();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFlows = useCallback(async () => {
    if (!state?.currentUser?.token) return;

    try {
      const result = await JobFlowService.getFlows(state.currentUser.token);
      setFlows(result.flows || []);
    } catch (error) {
      console.error("Error fetching job flows:", error);
    } finally {
      setLoading(false);
    }
  }, [state?.currentUser?.token]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Show only first 3 flows in the preview
  const displayedFlows = flows.slice(0, 3);
  const remainingCount = Math.max(0, flows.length - 3);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="tasks" size={16} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>Job Flows</Text>
          {flows.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{flows.length}</Text>
            </View>
          )}
        </View>
        <Pressable
          style={styles.viewAllButton}
          onPress={() => navigate("/job-flows")}
        >
          <Text style={styles.viewAllText}>Manage</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Card */}
      <View style={styles.card}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
          </View>
        ) : flows.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="list-alt" size={28} color={colors.neutral[300]} />
            <Text style={styles.emptyStateText}>No job flows yet</Text>
            <Text style={styles.emptyStateHint}>
              Create custom checklists for your employees
            </Text>
            <Pressable
              style={styles.createButton}
              onPress={() => navigate("/job-flows")}
            >
              <Icon name="plus" size={12} color={colors.neutral[0]} />
              <Text style={styles.createButtonText}>Create Flow</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Flow List */}
            {displayedFlows.map((flow) => (
              <FlowPreviewItem key={flow.id} flow={flow} />
            ))}

            {/* Show More */}
            {remainingCount > 0 && (
              <Pressable
                style={styles.showMoreButton}
                onPress={() => navigate("/job-flows")}
              >
                <Text style={styles.showMoreText}>
                  +{remainingCount} more flow{remainingCount > 1 ? "s" : ""}
                </Text>
              </Pressable>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/job-flows")}
              >
                <Icon name="plus" size={12} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>New Flow</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/job-flows/assignments")}
              >
                <Icon name="link" size={12} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>Assignments</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: "hidden",
  },
  loadingState: {
    padding: spacing["2xl"],
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  emptyStateHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  createButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  flowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  flowInfo: {
    flex: 1,
  },
  flowNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  flowName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  defaultBadge: {
    backgroundColor: colors.success[50],
    padding: 4,
    borderRadius: radius.full,
  },
  flowMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  showMoreButton: {
    padding: spacing.md,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  showMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: "row",
    padding: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
});

export default JobFlowsSection;
