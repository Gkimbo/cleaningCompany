import React, { useState, useContext } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { Checkbox } from "react-native-paper";
import { AuthContext } from "../../context/AuthContext";
import AppealService from "../../services/fetchRequests/AppealService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const STATUS_CONFIG = {
  submitted: { label: "Submitted", color: colors.primary[500] },
  under_review: { label: "Under Review", color: colors.warning[600] },
  awaiting_documents: { label: "Awaiting Documents", color: colors.secondary[500] },
  escalated: { label: "Escalated", color: colors.warning[700] },
};

const CATEGORY_LABELS = {
  medical_emergency: "Medical Emergency",
  family_emergency: "Family Emergency",
  natural_disaster: "Natural Disaster",
  property_issue: "Property Issue",
  transportation: "Transportation",
  scheduling_error: "Scheduling Error",
  other: "Other",
};

const DECISION_OPTIONS = [
  {
    value: "approve",
    label: "Approve",
    icon: "check-circle",
    color: colors.success[600],
    description: "Grant the appeal and apply requested relief",
  },
  {
    value: "partial",
    label: "Partial Approve",
    icon: "check",
    color: colors.success[500],
    description: "Approve some but not all requested relief",
  },
  {
    value: "deny",
    label: "Deny",
    icon: "times-circle",
    color: colors.error[600],
    description: "Reject the appeal",
  },
];

const AppealReviewModal = ({ visible, appeal, onClose, onComplete }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState("");

  // Resolution options
  const [waivePenalty, setWaivePenalty] = useState(false);
  const [refundFee, setRefundFee] = useState(false);
  const [unfreezeAccount, setUnfreezeAccount] = useState(false);
  const [removeRating, setRemoveRating] = useState(false);

  const resetForm = () => {
    setDecision(null);
    setNotes("");
    setWaivePenalty(false);
    setRefundFee(false);
    setUnfreezeAccount(false);
    setRemoveRating(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTakeCase = async () => {
    setLoading(true);
    try {
      const result = await AppealService.assignAppeal(
        user.token,
        appeal.id,
        user.id
      );

      if (result.success) {
        Alert.alert("Success", "You have been assigned to this appeal.");
        onComplete?.();
      } else {
        Alert.alert("Error", result.error || "Failed to assign appeal");
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDocuments = async () => {
    setLoading(true);
    try {
      const result = await AppealService.updateAppealStatus(
        user.token,
        appeal.id,
        "awaiting_documents",
        "Additional documentation requested"
      );

      if (result.success) {
        Alert.alert("Success", "User has been notified to provide documents.");
        onComplete?.();
      } else {
        Alert.alert("Error", result.error || "Failed to update status");
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    Alert.prompt(
      "Escalate Appeal",
      "Please provide a reason for escalation:",
      async (reason) => {
        if (!reason || !reason.trim()) {
          Alert.alert("Error", "Please provide a reason for escalation");
          return;
        }

        setLoading(true);
        try {
          const result = await AppealService.updateAppealStatus(
            user.token,
            appeal.id,
            "escalated",
            reason.trim()
          );

          if (result.success) {
            Alert.alert("Success", "Appeal has been escalated.");
            onComplete?.();
          } else {
            Alert.alert("Error", result.error || "Failed to escalate");
          }
        } catch (err) {
          Alert.alert("Error", "An unexpected error occurred");
        } finally {
          setLoading(false);
        }
      },
      "plain-text"
    );
  };

  const handleSubmitDecision = async () => {
    if (!decision) {
      Alert.alert("Error", "Please select a decision");
      return;
    }

    if (!notes.trim()) {
      Alert.alert("Error", "Please provide notes explaining your decision");
      return;
    }

    const resolution = {
      notes: notes.trim(),
      actions: {},
    };

    if (decision !== "deny") {
      if (waivePenalty) resolution.actions.penaltyWaived = true;
      if (refundFee) {
        resolution.actions.feeRefunded = true;
        resolution.actions.refundAmount = appeal.originalPenaltyAmount || 0;
      }
      if (unfreezeAccount) resolution.actions.accountUnfrozen = true;
      if (removeRating) resolution.actions.ratingRemoved = true;
    }

    Alert.alert(
      "Confirm Decision",
      `Are you sure you want to ${decision === "deny" ? "deny" : "approve"} this appeal?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            try {
              const result = await AppealService.resolveAppeal(
                user.token,
                appeal.id,
                decision,
                resolution
              );

              if (result.success) {
                Alert.alert(
                  "Success",
                  `Appeal has been ${decision === "deny" ? "denied" : "approved"}.`,
                  [{ text: "OK", onPress: () => onComplete?.() }]
                );
              } else {
                Alert.alert("Error", result.error || "Failed to resolve appeal");
              }
            } catch (err) {
              Alert.alert("Error", "An unexpected error occurred");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!appeal) return null;

  const statusConfig = STATUS_CONFIG[appeal.status] || STATUS_CONFIG.submitted;
  const isAssignedToMe = appeal.assignedTo === user.id;
  const canReview = isAssignedToMe || !appeal.assignedTo;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="times" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Appeal #{appeal.id}</Text>
            <View style={styles.closeButton} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Status & Assignment */}
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusConfig.color + "20" },
                ]}
              >
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
              {appeal.assignedTo && (
                <View style={styles.assignedBadge}>
                  <Icon name="user" size={12} color={colors.text.tertiary} />
                  <Text style={styles.assignedText}>
                    {isAssignedToMe ? "Assigned to you" : `Assigned to #${appeal.assignedTo}`}
                  </Text>
                </View>
              )}
            </View>

            {/* User Info with Scrutiny */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appellant</Text>
              <View style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Icon name="user" size={20} color={colors.primary[600]} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {appeal.appealer?.firstName} {appeal.appealer?.lastName}
                  </Text>
                  <Text style={styles.userEmail}>{appeal.appealer?.email}</Text>
                </View>
              </View>

              {appeal.appealer?.appealScrutinyLevel &&
                appeal.appealer.appealScrutinyLevel !== "none" && (
                  <View style={styles.scrutinyWarning}>
                    <Icon name="exclamation-triangle" size={14} color={colors.warning[700]} />
                    <View style={styles.scrutinyInfo}>
                      <Text style={styles.scrutinyLabel}>
                        {appeal.appealer.appealScrutinyLevel === "high_risk"
                          ? "High Risk User"
                          : "User Under Watch"}
                      </Text>
                      {appeal.appealer.appealScrutinyReason && (
                        <Text style={styles.scrutinyReason}>
                          {appeal.appealer.appealScrutinyReason}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

              {appeal.appealer?.appealStats && (
                <View style={styles.appealHistory}>
                  <Text style={styles.historyTitle}>Appeal History</Text>
                  <View style={styles.historyStats}>
                    <View style={styles.historyStat}>
                      <Text style={styles.historyNumber}>
                        {appeal.appealer.appealStats.total || 0}
                      </Text>
                      <Text style={styles.historyLabel}>Total</Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Text
                        style={[styles.historyNumber, { color: colors.success[600] }]}
                      >
                        {appeal.appealer.appealStats.approved || 0}
                      </Text>
                      <Text style={styles.historyLabel}>Approved</Text>
                    </View>
                    <View style={styles.historyStat}>
                      <Text
                        style={[styles.historyNumber, { color: colors.error[600] }]}
                      >
                        {appeal.appealer.appealStats.denied || 0}
                      </Text>
                      <Text style={styles.historyLabel}>Denied</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Appeal Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appeal Details</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>
                  {CATEGORY_LABELS[appeal.category] || appeal.category}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Submitted</Text>
                <Text style={styles.detailValue}>
                  {formatDate(appeal.submittedAt)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SLA Deadline</Text>
                <Text
                  style={[
                    styles.detailValue,
                    new Date(appeal.slaDeadline) < new Date() && styles.overdueText,
                  ]}
                >
                  {formatDate(appeal.slaDeadline)}
                </Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Statement</Text>
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>{appeal.description}</Text>
              </View>

              {appeal.requestedRelief && (
                <>
                  <Text style={styles.subLabel}>Requested Relief</Text>
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionText}>
                      {appeal.requestedRelief}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Financial Impact */}
            {(appeal.originalPenaltyAmount || appeal.originalRefundWithheld) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Financial Impact</Text>
                <View style={styles.financialCard}>
                  {appeal.originalPenaltyAmount > 0 && (
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Cancellation Fee</Text>
                      <Text style={styles.financialValue}>
                        ${(appeal.originalPenaltyAmount / 100).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {appeal.originalRefundWithheld > 0 && (
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Refund Withheld</Text>
                      <Text style={styles.financialValue}>
                        ${(appeal.originalRefundWithheld / 100).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Documents */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Supporting Documents</Text>
              {appeal.supportingDocuments && appeal.supportingDocuments.length > 0 ? (
                <View style={styles.documentsContainer}>
                  {appeal.supportingDocuments.map((doc, index) => (
                    <TouchableOpacity key={index} style={styles.documentItem}>
                      <Icon name="file" size={14} color={colors.primary[600]} />
                      <Text style={styles.documentName}>
                        {doc.name || `Document ${index + 1}`}
                      </Text>
                      <Icon name="external-link" size={12} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDocumentsText}>No documents provided</Text>
              )}
            </View>

            {/* Actions Section */}
            {canReview && (
              <View style={styles.section}>
                {/* Take Case button if not assigned */}
                {!appeal.assignedTo && (
                  <TouchableOpacity
                    style={styles.takeButton}
                    onPress={handleTakeCase}
                    disabled={loading}
                  >
                    <Icon name="hand-paper-o" size={16} color={colors.primary[600]} />
                    <Text style={styles.takeButtonText}>Take This Case</Text>
                  </TouchableOpacity>
                )}

                {/* Quick Actions */}
                {(isAssignedToMe || !appeal.assignedTo) && (
                  <View style={styles.quickActions}>
                    <TouchableOpacity
                      style={styles.quickActionButton}
                      onPress={handleRequestDocuments}
                      disabled={loading}
                    >
                      <Icon name="file-text-o" size={14} color={colors.secondary[600]} />
                      <Text style={styles.quickActionText}>Request Docs</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionButton}
                      onPress={handleEscalate}
                      disabled={loading}
                    >
                      <Icon name="arrow-up" size={14} color={colors.warning[600]} />
                      <Text style={styles.quickActionText}>Escalate</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Decision Section */}
                <Text style={styles.sectionTitle}>Make Decision</Text>

                {/* Decision Options */}
                <View style={styles.decisionOptions}>
                  {DECISION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.decisionCard,
                        decision === opt.value && {
                          borderColor: opt.color,
                          backgroundColor: opt.color + "10",
                        },
                      ]}
                      onPress={() => setDecision(opt.value)}
                    >
                      <Icon
                        name={opt.icon}
                        size={24}
                        color={decision === opt.value ? opt.color : colors.text.tertiary}
                      />
                      <Text
                        style={[
                          styles.decisionLabel,
                          decision === opt.value && { color: opt.color },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Resolution Options (for approval) */}
                {decision && decision !== "deny" && (
                  <View style={styles.resolutionOptions}>
                    <Text style={styles.subLabel}>Resolution Actions</Text>

                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setWaivePenalty(!waivePenalty)}
                    >
                      <Checkbox
                        status={waivePenalty ? "checked" : "unchecked"}
                        color={colors.primary[600]}
                      />
                      <Text style={styles.checkboxLabel}>Waive cancellation penalty</Text>
                    </TouchableOpacity>

                    {appeal.originalPenaltyAmount > 0 && (
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setRefundFee(!refundFee)}
                      >
                        <Checkbox
                          status={refundFee ? "checked" : "unchecked"}
                          color={colors.primary[600]}
                        />
                        <Text style={styles.checkboxLabel}>
                          Refund cancellation fee ($
                          {(appeal.originalPenaltyAmount / 100).toFixed(2)})
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setUnfreezeAccount(!unfreezeAccount)}
                    >
                      <Checkbox
                        status={unfreezeAccount ? "checked" : "unchecked"}
                        color={colors.primary[600]}
                      />
                      <Text style={styles.checkboxLabel}>Remove account restrictions</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setRemoveRating(!removeRating)}
                    >
                      <Checkbox
                        status={removeRating ? "checked" : "unchecked"}
                        color={colors.primary[600]}
                      />
                      <Text style={styles.checkboxLabel}>Remove penalty rating impact</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Notes */}
                {decision && (
                  <View style={styles.notesSection}>
                    <Text style={styles.subLabel}>
                      Decision Notes <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Explain your decision..."
                      placeholderTextColor={colors.text.tertiary}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          {canReview && decision && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  decision === "deny"
                    ? { backgroundColor: colors.error[500] }
                    : { backgroundColor: colors.success[500] },
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSubmitDecision}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Icon
                      name={decision === "deny" ? "times" : "check"}
                      size={16}
                      color={colors.neutral[0]}
                    />
                    <Text style={styles.submitButtonText}>
                      {decision === "deny" ? "Deny Appeal" : "Approve Appeal"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "95%",
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  content: {
    padding: spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  assignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  assignedText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  userEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  scrutinyWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  scrutinyInfo: {
    flex: 1,
  },
  scrutinyLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  scrutinyReason: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    marginTop: spacing.xs,
  },
  appealHistory: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  historyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  historyStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  historyStat: {
    alignItems: "center",
  },
  historyNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  historyLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  overdueText: {
    color: colors.error[600],
  },
  descriptionBox: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  subLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  financialCard: {
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  financialLabel: {
    fontSize: typography.fontSize.base,
    color: colors.warning[800],
  },
  financialValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
  },
  documentsContainer: {
    gap: spacing.sm,
  },
  documentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  documentName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  noDocumentsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  takeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  takeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  decisionOptions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  decisionCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.sm,
  },
  decisionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  resolutionOptions: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  notesSection: {
    marginTop: spacing.md,
  },
  required: {
    color: colors.error[500],
  },
  notesInput: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: "top",
  },
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 0.4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default AppealReviewModal;
