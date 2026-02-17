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
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import JobFlowService from "../../../services/fetchRequests/JobFlowService";
import JobFlowListItem from "./JobFlowListItem";
import CreateEditFlowModal from "./CreateEditFlowModal";

import useSafeNavigation from "../../../hooks/useSafeNavigation";
const JobFlowsList = ({ state }) => {
  const { goBack, navigate } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flows, setFlows] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [error, setError] = useState(null);

  const token = state?.currentUser?.token;

  const fetchFlows = useCallback(async () => {
    if (!token) return;

    try {
      setError(null);
      const status = showArchived ? "archived" : "active";
      const result = await JobFlowService.getFlows(token, { status });

      if (result.error) {
        setError(result.error);
      } else {
        setFlows(result.flows || []);
      }
    } catch (err) {
      console.error("Error fetching job flows:", err);
      setError("Failed to load job flows");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, showArchived]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFlows();
  }, [fetchFlows]);

  const handleCreateFlow = () => {
    setEditingFlow(null);
    setModalVisible(true);
  };

  const handleEditFlow = (flow) => {
    setEditingFlow(flow);
    setModalVisible(true);
  };

  const handleFlowPress = (flow) => {
    navigate(`/job-flows/${flow.id}`);
  };

  const handleSetDefault = async (flow) => {
    const result = await JobFlowService.setDefaultFlow(token, flow.id);

    if (result.success) {
      setFlows((prev) =>
        prev.map((f) => ({
          ...f,
          isDefault: f.id === flow.id,
        }))
      );
    } else {
      Alert.alert("Error", result.error || "Failed to set default flow");
    }
  };

  const handleArchiveFlow = (flow) => {
    const action = showArchived ? "restore" : "archive";
    const title = showArchived ? "Restore Flow" : "Archive Flow";
    const message = showArchived
      ? `Are you sure you want to restore "${flow.name}"?`
      : `Are you sure you want to archive "${flow.name}"? It can be restored later.`;

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: showArchived ? "Restore" : "Archive",
        style: showArchived ? "default" : "destructive",
        onPress: async () => {
          if (showArchived) {
            // Restore by updating status
            const result = await JobFlowService.updateFlow(token, flow.id, {
              status: "active",
            });
            if (result.success) {
              setFlows((prev) => prev.filter((f) => f.id !== flow.id));
            } else {
              Alert.alert("Error", result.error || "Failed to restore flow");
            }
          } else {
            // Archive
            const result = await JobFlowService.deleteFlow(token, flow.id, false);
            if (result.success) {
              setFlows((prev) => prev.filter((f) => f.id !== flow.id));
            } else {
              Alert.alert("Error", result.error || "Failed to archive flow");
            }
          }
        },
      },
    ]);
  };

  const handleDeleteFlow = (flow) => {
    Alert.alert(
      "Delete Flow Permanently",
      `Are you sure you want to permanently delete "${flow.name}"?\n\nThis action cannot be undone. If this flow is being used by any appointments, it cannot be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            const result = await JobFlowService.deleteFlow(token, flow.id, true);
            if (result.success) {
              setFlows((prev) => prev.filter((f) => f.id !== flow.id));
              Alert.alert("Success", "Job flow deleted permanently");
            } else {
              Alert.alert(
                "Cannot Delete",
                result.error || "Failed to delete flow. It may be in use by appointments."
              );
            }
          },
        },
      ]
    );
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingFlow(null);
  };

  const handleFlowSaved = (savedFlow) => {
    if (editingFlow) {
      // Update existing flow
      setFlows((prev) =>
        prev.map((f) => (f.id === savedFlow.id ? savedFlow : f))
      );
    } else {
      // Add new flow
      setFlows((prev) => [savedFlow, ...prev]);
    }
    handleModalClose();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading job flows...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Icon name="arrow-left" size={16} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Job Flows</Text>
        <Pressable style={styles.createButton} onPress={handleCreateFlow}>
          <Icon name="plus" size={14} color={colors.neutral[0]} />
        </Pressable>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, !showArchived && styles.tabActive]}
          onPress={() => setShowArchived(false)}
        >
          <Text style={[styles.tabText, !showArchived && styles.tabTextActive]}>
            Active
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, showArchived && styles.tabActive]}
          onPress={() => setShowArchived(true)}
        >
          <Text style={[styles.tabText, showArchived && styles.tabTextActive]}>
            Archived
          </Text>
        </Pressable>
      </View>

      {/* Content */}
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
        {error && (
          <View style={styles.errorBanner}>
            <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="info-circle" size={16} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            Job flows define the checklist and photo requirements for your employees
            when completing jobs. Assign flows to specific clients or homes.
          </Text>
        </View>

        {/* Flows List */}
        {flows.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon
              name={showArchived ? "archive" : "tasks"}
              size={40}
              color={colors.neutral[300]}
            />
            <Text style={styles.emptyTitle}>
              {showArchived ? "No Archived Flows" : "No Job Flows Yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showArchived
                ? "Archived flows will appear here"
                : "Create a job flow to customize checklists and photo requirements"}
            </Text>
            {!showArchived && (
              <Pressable style={styles.emptyCreateButton} onPress={handleCreateFlow}>
                <Icon name="plus" size={12} color={colors.neutral[0]} />
                <Text style={styles.emptyCreateButtonText}>Create Job Flow</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.listCard}>
            {flows.map((flow) => (
              <JobFlowListItem
                key={flow.id}
                flow={flow}
                onPress={handleFlowPress}
                onSetDefault={!showArchived ? handleSetDefault : undefined}
                onEdit={!showArchived ? handleEditFlow : undefined}
                onArchive={handleArchiveFlow}
                onDelete={handleDeleteFlow}
              />
            ))}
          </View>
        )}

        {/* Quick Actions */}
        {!showArchived && flows.length > 0 && (
          <View style={styles.quickActionsCard}>
            <Pressable
              style={styles.quickActionButton}
              onPress={() => navigate("/job-flows/assignments")}
            >
              <View style={styles.quickActionIcon}>
                <Icon name="link" size={16} color={colors.primary[600]} />
              </View>
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>Manage Assignments</Text>
                <Text style={styles.quickActionSubtitle}>
                  Assign flows to clients or specific homes
                </Text>
              </View>
              <Icon name="chevron-right" size={12} color={colors.neutral[300]} />
            </Pressable>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <CreateEditFlowModal
        visible={modalVisible}
        flow={editingFlow}
        token={token}
        onClose={handleModalClose}
        onSave={handleFlowSaved}
      />
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[600],
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  tabActive: {
    backgroundColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.neutral[0],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyCreateButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  listCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.sm,
  },
  quickActionsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  quickActionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  bottomPadding: {
    height: 100,
  },
});

export default JobFlowsList;
