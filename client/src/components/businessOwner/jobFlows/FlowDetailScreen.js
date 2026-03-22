import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import JobFlowService from "../../../services/fetchRequests/JobFlowService";
import CreateEditFlowModal from "./CreateEditFlowModal";
import ChecklistEditor from "./ChecklistEditor";

import useSafeNavigation from "../../../hooks/useSafeNavigation";
const PHOTO_REQUIREMENT_LABELS = {
  required: { label: "Required", icon: "camera", color: colors.primary[600] },
  optional: { label: "Optional", icon: "camera", color: colors.neutral[500] },
  hidden: { label: "Hidden", icon: "eye-slash", color: colors.neutral[400] },
};

const FlowDetailScreen = ({ state }) => {
  const { goBack, navigate } = useSafeNavigation();
  const { flowId } = useParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flow, setFlow] = useState(null);
  const [error, setError] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [checklistEditorVisible, setChecklistEditorVisible] = useState(false);

  const token = state?.currentUser?.token;

  const fetchFlow = useCallback(async () => {
    if (!token || !flowId) return;

    try {
      setError(null);
      const result = await JobFlowService.getFlow(token, parseInt(flowId));

      if (result.error) {
        setError(result.error);
      } else {
        setFlow(result.flow);
      }
    } catch (err) {
      console.error("Error fetching job flow:", err);
      setError("Failed to load job flow");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, flowId]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFlow();
  }, [fetchFlow]);

  const handleEditFlow = () => {
    setEditModalVisible(true);
  };

  const handleFlowSaved = (updatedFlow) => {
    setFlow(updatedFlow);
    setEditModalVisible(false);
  };

  const handleSetDefault = async () => {
    if (flow.isDefault) {
      // Clear default
      const result = await JobFlowService.clearDefaultFlow(token);
      if (result.success) {
        setFlow({ ...flow, isDefault: false });
      } else {
        Alert.alert("Error", result.error || "Failed to clear default");
      }
    } else {
      // Set as default
      const result = await JobFlowService.setDefaultFlow(token, flow.id);
      if (result.success) {
        setFlow({ ...flow, isDefault: true });
      } else {
        Alert.alert("Error", result.error || "Failed to set default");
      }
    }
  };

  const handleDeleteChecklist = () => {
    Alert.alert(
      "Delete Checklist",
      "Are you sure you want to delete the checklist? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await JobFlowService.deleteChecklist(token, flow.id);
            if (result.success) {
              setFlow({ ...flow, checklist: null });
            } else {
              Alert.alert("Error", result.error || "Failed to delete checklist");
            }
          },
        },
      ]
    );
  };

  const handleChecklistSaved = (checklist) => {
    setFlow({ ...flow, checklist });
    setChecklistEditorVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading flow details...</Text>
      </View>
    );
  }

  if (error || !flow) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={40} color={colors.error[400]} />
        <Text style={styles.errorTitle}>Failed to Load</Text>
        <Text style={styles.errorText}>{error || "Job flow not found"}</Text>
        <Pressable style={styles.retryButton} onPress={fetchFlow}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const photoSetting = PHOTO_REQUIREMENT_LABELS[flow.photoRequirement] || PHOTO_REQUIREMENT_LABELS.required;
  const checklistItemCount = flow.checklist?.itemCount || 0;
  const assignmentCount = flow.assignmentCount || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Icon name="arrow-left" size={16} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {flow.name}
        </Text>
        <Pressable style={styles.editButton} onPress={handleEditFlow}>
          <Icon name="pencil" size={14} color={colors.primary[600]} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Flow Info Card */}
        <View style={styles.infoCard}>
          {/* Status Badges */}
          <View style={styles.badgesRow}>
            {flow.isDefault && (
              <View style={styles.defaultBadge}>
                <Icon name="star" size={12} color={colors.success[600]} />
                <Text style={styles.defaultBadgeText}>Default Flow</Text>
              </View>
            )}
            <View style={[styles.photoBadge, { backgroundColor: photoSetting.color + "15" }]}>
              <Icon name={photoSetting.icon} size={12} color={photoSetting.color} />
              <Text style={[styles.photoBadgeText, { color: photoSetting.color }]}>
                Photos: {photoSetting.label}
              </Text>
            </View>
          </View>

          {/* Description */}
          {flow.description && (
            <Text style={styles.description}>{flow.description}</Text>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="check-square-o" size={16} color={colors.text.secondary} />
              <Text style={styles.statValue}>{checklistItemCount}</Text>
              <Text style={styles.statLabel}>Checklist Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Icon name="users" size={16} color={colors.text.secondary} />
              <Text style={styles.statValue}>{assignmentCount}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </View>
          </View>

          {/* Set Default Button */}
          <Pressable style={styles.defaultToggleButton} onPress={handleSetDefault}>
            <Icon
              name={flow.isDefault ? "star" : "star-o"}
              size={16}
              color={flow.isDefault ? colors.success[600] : colors.neutral[500]}
            />
            <Text
              style={[
                styles.defaultToggleText,
                flow.isDefault && styles.defaultToggleTextActive,
              ]}
            >
              {flow.isDefault ? "Remove as Default" : "Set as Default"}
            </Text>
          </Pressable>
        </View>

        {/* Job Notes Section */}
        {flow.jobNotes && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Icon name="sticky-note-o" size={16} color={colors.primary[600]} />
              <Text style={styles.sectionTitle}>Job Notes for Employees</Text>
            </View>
            <Text style={styles.jobNotes}>{flow.jobNotes}</Text>
          </View>
        )}

        {/* Checklist Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="list-alt" size={16} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>Checklist</Text>
          </View>

          {flow.checklist ? (
            <>
              {/* Checklist Preview */}
              <View style={styles.checklistPreview}>
                {flow.checklist.sectionNames?.map((name, index) => (
                  <View key={index} style={styles.sectionPreviewItem}>
                    <Icon name="folder-o" size={12} color={colors.neutral[400]} />
                    <Text style={styles.sectionPreviewText}>{name}</Text>
                  </View>
                ))}
              </View>

              {/* Checklist Actions */}
              <View style={styles.checklistActions}>
                <Pressable
                  style={styles.checklistActionButton}
                  onPress={() => setChecklistEditorVisible(true)}
                >
                  <Icon name="pencil" size={14} color={colors.primary[600]} />
                  <Text style={styles.checklistActionText}>Edit Checklist</Text>
                </Pressable>
                <Pressable
                  style={[styles.checklistActionButton, styles.deleteActionButton]}
                  onPress={handleDeleteChecklist}
                >
                  <Icon name="trash-o" size={14} color={colors.error[600]} />
                  <Text style={styles.deleteActionText}>Delete</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.noChecklistState}>
              <Text style={styles.noChecklistText}>
                No checklist configured. Create one or import from platform.
              </Text>
              <Pressable
                style={styles.createChecklistButton}
                onPress={() => setChecklistEditorVisible(true)}
              >
                <Icon name="plus" size={12} color={colors.neutral[0]} />
                <Text style={styles.createChecklistButtonText}>Create Checklist</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Assignments Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="link" size={16} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>Assignments</Text>
          </View>

          {assignmentCount > 0 ? (
            <>
              <Text style={styles.assignmentSummary}>
                This flow is assigned to {assignmentCount} client
                {assignmentCount !== 1 ? "s" : ""} or home
                {assignmentCount !== 1 ? "s" : ""}.
              </Text>
              <Pressable
                style={styles.viewAssignmentsButton}
                onPress={() => navigate("/job-flows/assignments")}
              >
                <Text style={styles.viewAssignmentsText}>View All Assignments</Text>
                <Icon name="chevron-right" size={12} color={colors.primary[600]} />
              </Pressable>
            </>
          ) : (
            <View style={styles.noAssignmentsState}>
              <Text style={styles.noAssignmentsText}>
                No assignments yet. Assign this flow to clients or specific homes.
              </Text>
              <Pressable
                style={styles.assignButton}
                onPress={() => navigate("/job-flows/assignments")}
              >
                <Icon name="plus" size={12} color={colors.neutral[0]} />
                <Text style={styles.assignButtonText}>Add Assignment</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Flow Modal */}
      <CreateEditFlowModal
        visible={editModalVisible}
        flow={flow}
        token={token}
        onClose={() => setEditModalVisible(false)}
        onSave={handleFlowSaved}
      />

      {/* Checklist Editor Modal */}
      <Modal
        visible={checklistEditorVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setChecklistEditorVisible(false)}
      >
        <ChecklistEditor
          flowId={flow.id}
          token={token}
          initialChecklist={flow.checklist}
          onSave={handleChecklistSaved}
          onClose={() => setChecklistEditorVisible(false)}
        />
      </Modal>
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  retryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.primary,
    paddingTop: spacing["4xl"],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginHorizontal: spacing.md,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  defaultBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  photoBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  photoBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  defaultToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm,
  },
  defaultToggleText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    fontWeight: typography.fontWeight.medium,
  },
  defaultToggleTextActive: {
    color: colors.success[600],
  },
  sectionCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.md,
  },
  checklistPreview: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionPreviewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sectionPreviewText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  checklistActions: {
    flexDirection: "row",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
  },
  checklistActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    gap: spacing.xs,
  },
  checklistActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  deleteActionButton: {
    backgroundColor: colors.error[50],
    flex: 0.5,
  },
  deleteActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[600],
  },
  noChecklistState: {
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  noChecklistText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  createChecklistButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  createChecklistButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  assignmentSummary: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  viewAssignmentsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  viewAssignmentsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  noAssignmentsState: {
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  noAssignmentsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  assignButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  bottomPadding: {
    height: 100,
  },
});

export default FlowDetailScreen;
