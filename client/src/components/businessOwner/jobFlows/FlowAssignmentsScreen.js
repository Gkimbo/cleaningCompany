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
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import JobFlowService from "../../../services/fetchRequests/JobFlowService";

const AssignFlowModal = ({ visible, flows, clients, token, onClose, onAssigned }) => {
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedHome, setSelectedHome] = useState(null);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [assignmentType, setAssignmentType] = useState("client");
  const [saving, setSaving] = useState(false);

  const resetState = () => {
    setStep(1);
    setSelectedClient(null);
    setSelectedHome(null);
    setSelectedFlow(null);
    setAssignmentType("client");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAssign = async () => {
    if (!selectedFlow) {
      Alert.alert("Error", "Please select a flow");
      return;
    }

    setSaving(true);
    try {
      let result;
      if (assignmentType === "client" && selectedClient) {
        result = await JobFlowService.assignFlowToClient(token, selectedClient.clientUser?.id || selectedClient.id, selectedFlow.id);
      } else if (assignmentType === "home" && selectedHome) {
        result = await JobFlowService.assignFlowToHome(token, selectedHome.id, selectedFlow.id);
      }

      if (result?.success) {
        onAssigned(result.assignment);
        handleClose();
      } else {
        Alert.alert("Error", result?.error || "Failed to assign flow");
      }
    } catch (error) {
      console.error("Error assigning flow:", error);
      Alert.alert("Error", "Failed to assign flow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Pressable style={styles.modalCloseButton} onPress={handleClose}>
            <Icon name="times" size={18} color={colors.text.secondary} />
          </Pressable>
          <Text style={styles.modalTitle}>Assign Flow</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.modalScrollView}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <>
              {/* Assignment Type Selection */}
              <Text style={styles.stepTitle}>Step 1: Choose Assignment Type</Text>
              <Pressable
                style={[
                  styles.typeOption,
                  assignmentType === "client" && styles.typeOptionSelected,
                ]}
                onPress={() => setAssignmentType("client")}
              >
                <View style={styles.typeOptionRadio}>
                  {assignmentType === "client" && <View style={styles.radioInner} />}
                </View>
                <View style={styles.typeOptionContent}>
                  <Text style={styles.typeOptionTitle}>Assign to Client</Text>
                  <Text style={styles.typeOptionDescription}>
                    Flow applies to all homes for this client
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[
                  styles.typeOption,
                  assignmentType === "home" && styles.typeOptionSelected,
                ]}
                onPress={() => setAssignmentType("home")}
              >
                <View style={styles.typeOptionRadio}>
                  {assignmentType === "home" && <View style={styles.radioInner} />}
                </View>
                <View style={styles.typeOptionContent}>
                  <Text style={styles.typeOptionTitle}>Assign to Specific Home</Text>
                  <Text style={styles.typeOptionDescription}>
                    Flow only applies to one specific home
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.nextButton}
                onPress={() => setStep(2)}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <Icon name="chevron-right" size={12} color={colors.neutral[0]} />
              </Pressable>
            </>
          )}

          {step === 2 && (
            <>
              {/* Client/Home Selection */}
              <Pressable style={styles.backStepButton} onPress={() => setStep(1)}>
                <Icon name="chevron-left" size={12} color={colors.primary[600]} />
                <Text style={styles.backStepText}>Back</Text>
              </Pressable>

              <Text style={styles.stepTitle}>
                Step 2: Select {assignmentType === "client" ? "Client" : "Home"}
              </Text>

              {clients.map((client) => {
                const clientName = client.clientName || "Unknown Client";
                const clientHomes = client.homes || (client.home ? [client.home] : []);

                if (assignmentType === "client") {
                  return (
                    <Pressable
                      key={client.id}
                      style={[
                        styles.selectionOption,
                        selectedClient?.id === client.id && styles.selectionOptionSelected,
                      ]}
                      onPress={() => setSelectedClient(client)}
                    >
                      <View style={styles.selectionCheck}>
                        {selectedClient?.id === client.id && (
                          <Icon name="check" size={12} color={colors.primary[600]} />
                        )}
                      </View>
                      <View>
                        <Text style={styles.selectionTitle}>{clientName}</Text>
                        <Text style={styles.selectionSubtitle}>
                          {clientHomes.length > 0
                            ? `${clientHomes.length} home${clientHomes.length !== 1 ? "s" : ""}`
                            : "No address"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                } else {
                  // Show ALL homes for this client
                  if (clientHomes.length === 0) return null;

                  return (
                    <View key={client.id}>
                      <Text style={styles.clientGroupLabel}>{clientName}</Text>
                      {clientHomes.map((home) => (
                        <Pressable
                          key={home.id}
                          style={[
                            styles.selectionOption,
                            selectedHome?.id === home.id && styles.selectionOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedHome(home);
                            setSelectedClient(client);
                          }}
                        >
                          <View style={styles.selectionCheck}>
                            {selectedHome?.id === home.id && (
                              <Icon name="check" size={12} color={colors.primary[600]} />
                            )}
                          </View>
                          <View>
                            <Text style={styles.selectionTitle}>
                              {home.nickName || "Home"}
                            </Text>
                            <Text style={styles.selectionSubtitle}>
                              {home.address?.split(",")[0] || "No address"}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  );
                }
              })}

              <Pressable
                style={[
                  styles.nextButton,
                  !(assignmentType === "client" ? selectedClient : selectedHome) &&
                    styles.nextButtonDisabled,
                ]}
                onPress={() => setStep(3)}
                disabled={!(assignmentType === "client" ? selectedClient : selectedHome)}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <Icon name="chevron-right" size={12} color={colors.neutral[0]} />
              </Pressable>
            </>
          )}

          {step === 3 && (
            <>
              {/* Flow Selection */}
              <Pressable style={styles.backStepButton} onPress={() => setStep(2)}>
                <Icon name="chevron-left" size={12} color={colors.primary[600]} />
                <Text style={styles.backStepText}>Back</Text>
              </Pressable>

              <Text style={styles.stepTitle}>Step 3: Select Flow</Text>

              {flows.map((flow) => (
                <Pressable
                  key={flow.id}
                  style={[
                    styles.selectionOption,
                    selectedFlow?.id === flow.id && styles.selectionOptionSelected,
                  ]}
                  onPress={() => setSelectedFlow(flow)}
                >
                  <View style={styles.selectionCheck}>
                    {selectedFlow?.id === flow.id && (
                      <Icon name="check" size={12} color={colors.primary[600]} />
                    )}
                  </View>
                  <View style={styles.flowOptionContent}>
                    <View style={styles.flowOptionHeader}>
                      <Text style={styles.selectionTitle}>{flow.name}</Text>
                      {flow.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    {flow.description && (
                      <Text style={styles.selectionSubtitle} numberOfLines={2}>
                        {flow.description}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}

              <Pressable
                style={[
                  styles.assignButton,
                  (!selectedFlow || saving) && styles.nextButtonDisabled,
                ]}
                onPress={handleAssign}
                disabled={!selectedFlow || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Icon name="link" size={14} color={colors.neutral[0]} />
                    <Text style={styles.nextButtonText}>Assign Flow</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const FlowAssignmentsScreen = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [flows, setFlows] = useState([]);
  const [clients, setClients] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState(null);

  const token = state?.currentUser?.token;

  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      setError(null);
      const [assignmentsResult, flowsResult] = await Promise.all([
        JobFlowService.getAssignments(token),
        JobFlowService.getFlows(token),
      ]);

      if (assignmentsResult.error) {
        setError(assignmentsResult.error);
      } else {
        setAssignments(assignmentsResult.assignments || []);
        // Clients are now included in the assignments response
        setClients(assignmentsResult.clients || []);
      }

      setFlows(flowsResult.flows || []);
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setError("Failed to load assignments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleRemoveAssignment = (assignment) => {
    const targetName = assignment.clientName || assignment.homeAddress || "this item";

    Alert.alert(
      "Remove Assignment",
      `Are you sure you want to remove the flow assignment from ${targetName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const result = await JobFlowService.removeAssignment(token, assignment.id);
            if (result.success) {
              setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
            } else {
              Alert.alert("Error", result.error || "Failed to remove assignment");
            }
          },
        },
      ]
    );
  };

  const handleAssigned = (newAssignment) => {
    setAssignments((prev) => [newAssignment, ...prev]);
  };

  // Group assignments by flow
  const groupedAssignments = assignments.reduce((groups, assignment) => {
    const flowName = assignment.flowName || "Unknown Flow";
    if (!groups[flowName]) {
      groups[flowName] = [];
    }
    groups[flowName].push(assignment);
    return groups;
  }, {});

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading assignments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={16} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Flow Assignments</Text>
        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Icon name="plus" size={14} color={colors.neutral[0]} />
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
            Assign flows to clients or specific homes. Home-level assignments
            override client-level assignments.
          </Text>
        </View>

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="link" size={40} color={colors.neutral[300]} />
            <Text style={styles.emptyTitle}>No Assignments</Text>
            <Text style={styles.emptySubtitle}>
              Assign job flows to clients or specific homes
            </Text>
            <Pressable
              style={styles.emptyAddButton}
              onPress={() => setModalVisible(true)}
            >
              <Icon name="plus" size={12} color={colors.neutral[0]} />
              <Text style={styles.emptyAddButtonText}>Add Assignment</Text>
            </Pressable>
          </View>
        ) : (
          Object.entries(groupedAssignments).map(([flowName, flowAssignments]) => (
            <View key={flowName} style={styles.flowGroup}>
              <View style={styles.flowGroupHeader}>
                <Icon name="tasks" size={14} color={colors.primary[600]} />
                <Text style={styles.flowGroupTitle}>{flowName}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{flowAssignments.length}</Text>
                </View>
              </View>

              {flowAssignments.map((assignment) => (
                <View key={assignment.id} style={styles.assignmentCard}>
                  <View style={styles.assignmentInfo}>
                    <Icon
                      name={assignment.homeId ? "home" : "user"}
                      size={14}
                      color={colors.neutral[400]}
                    />
                    <View style={styles.assignmentDetails}>
                      <Text style={styles.assignmentTitle}>
                        {assignment.homeId
                          ? assignment.homeNickName || assignment.homeAddress?.split(",")[0]
                          : assignment.clientName}
                      </Text>
                      <Text style={styles.assignmentSubtitle}>
                        {assignment.homeId
                          ? assignment.clientName
                          : `${assignment.homeCount || 0} home(s)`}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveAssignment(assignment)}
                  >
                    <Icon name="times" size={14} color={colors.error[500]} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Assign Modal */}
      <AssignFlowModal
        visible={modalVisible}
        flows={flows}
        clients={clients}
        token={token}
        onClose={() => setModalVisible(false)}
        onAssigned={handleAssigned}
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[600],
    justifyContent: "center",
    alignItems: "center",
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
  },
  emptyAddButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyAddButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  flowGroup: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.sm,
  },
  flowGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  flowGroupTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  assignmentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  assignmentInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
  },
  assignmentDetails: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  assignmentSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.error[50],
  },
  bottomPadding: {
    height: 100,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.primary,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  backStepButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backStepText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  typeOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  typeOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
  },
  typeOptionContent: {
    flex: 1,
  },
  typeOptionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  typeOptionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  selectionOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  selectionOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  selectionCheck: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.primary,
  },
  selectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  selectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  clientGroupLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  flowOptionContent: {
    flex: 1,
  },
  flowOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  defaultBadge: {
    backgroundColor: colors.success[50],
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});

export default FlowAssignmentsScreen;
