import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../../services/AuthContext";
import ConflictService from "../../../services/fetchRequests/ConflictService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";

const ResolutionActionsPanel = ({
  caseData,
  caseType,
  caseId,
  onRefund,
  onPayout,
  onAddNote,
  onResolveSuccess,
}) => {
  const { user } = useContext(AuthContext);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState({
    refundAmount: 0,
    feeRefunded: false,
    feeAmount: 0,
    ratingRemoved: false,
    accountUnfrozen: false,
  });
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!decision) {
      Alert.alert("Error", "Please select a decision");
      return;
    }

    setResolving(true);
    try {
      const result = await ConflictService.resolveCase(
        user.token,
        caseType,
        caseId,
        decision,
        resolution,
        notes
      );

      if (result.success) {
        setShowResolveModal(false);
        Alert.alert("Success", "Case resolved successfully", [
          { text: "OK", onPress: onResolveSuccess },
        ]);
      } else {
        Alert.alert("Error", result.error || "Failed to resolve case");
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setResolving(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "$0.00";
    return `$${(amount / 100).toFixed(2)}`;
  };

  const maxRefundAmount = caseData?.appointment?.price || 0;

  return (
    <>
      <View style={styles.container}>
        <View style={styles.actionsRow}>
          {/* Quick Actions */}
          <TouchableOpacity style={styles.actionButton} onPress={onAddNote}>
            <Icon name="sticky-note" size={16} color={colors.primary[600]} />
            <Text style={styles.actionButtonText}>Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRefund}
            disabled={!caseData?.homeowner?.stripeCustomerId}
          >
            <Icon name="undo" size={16} color={colors.success[600]} />
            <Text style={styles.actionButtonText}>Refund</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onPayout}
            disabled={!caseData?.cleaner?.stripeAccountId}
          >
            <Icon name="money" size={16} color={colors.warning[600]} />
            <Text style={styles.actionButtonText}>Payout</Text>
          </TouchableOpacity>

          {/* Resolve Button */}
          <TouchableOpacity
            style={styles.resolveButton}
            onPress={() => setShowResolveModal(true)}
          >
            <Icon name="gavel" size={16} color={colors.neutral[0]} />
            <Text style={styles.resolveButtonText}>Resolve</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resolve Modal */}
      <Modal
        visible={showResolveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResolveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Resolve Case</Text>
              <TouchableOpacity onPress={() => setShowResolveModal(false)}>
                <Icon name="times" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Decision Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Decision</Text>
                <View style={styles.decisionButtons}>
                  <TouchableOpacity
                    style={[styles.decisionButton, decision === "approve" && styles.decisionButtonApprove]}
                    onPress={() => setDecision("approve")}
                  >
                    <Icon
                      name="check-circle"
                      size={20}
                      color={decision === "approve" ? colors.neutral[0] : colors.success[500]}
                    />
                    <Text style={[styles.decisionButtonText, decision === "approve" && styles.decisionButtonTextActive]}>
                      Approve
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.decisionButton, decision === "partial" && styles.decisionButtonPartial]}
                    onPress={() => setDecision("partial")}
                  >
                    <Icon
                      name="adjust"
                      size={20}
                      color={decision === "partial" ? colors.neutral[0] : colors.warning[500]}
                    />
                    <Text style={[styles.decisionButtonText, decision === "partial" && styles.decisionButtonTextActive]}>
                      Partial
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.decisionButton, decision === "deny" && styles.decisionButtonDeny]}
                    onPress={() => setDecision("deny")}
                  >
                    <Icon
                      name="times-circle"
                      size={20}
                      color={decision === "deny" ? colors.neutral[0] : colors.error[500]}
                    />
                    <Text style={[styles.decisionButtonText, decision === "deny" && styles.decisionButtonTextActive]}>
                      Deny
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Resolution Actions (for approve/partial) */}
              {(decision === "approve" || decision === "partial") && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Resolution Actions</Text>

                  <View style={styles.resolutionOptions}>
                    {/* Refund Amount */}
                    <View style={styles.resolutionOption}>
                      <View style={styles.resolutionOptionHeader}>
                        <Icon name="undo" size={14} color={colors.success[500]} />
                        <Text style={styles.resolutionOptionLabel}>Refund Amount</Text>
                      </View>
                      <View style={styles.amountInputContainer}>
                        <Text style={styles.currencyPrefix}>$</Text>
                        <TextInput
                          style={styles.amountInput}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.text.tertiary}
                          value={resolution.refundAmount > 0 ? (resolution.refundAmount / 100).toString() : ""}
                          onChangeText={(text) => {
                            const amount = Math.min(parseFloat(text || 0) * 100, maxRefundAmount);
                            setResolution(r => ({ ...r, refundAmount: amount || 0 }));
                          }}
                        />
                        <Text style={styles.amountMax}>Max: {formatCurrency(maxRefundAmount)}</Text>
                      </View>
                    </View>

                    {/* Fee Refund (for appeals) */}
                    {caseType === "appeal" && caseData?.financialImpact?.originalPenaltyAmount > 0 && (
                      <TouchableOpacity
                        style={styles.checkboxOption}
                        onPress={() => setResolution(r => ({
                          ...r,
                          feeRefunded: !r.feeRefunded,
                          feeAmount: !r.feeRefunded ? caseData.financialImpact.originalPenaltyAmount : 0,
                        }))}
                      >
                        <View style={[styles.checkbox, resolution.feeRefunded && styles.checkboxChecked]}>
                          {resolution.feeRefunded && <Icon name="check" size={10} color={colors.neutral[0]} />}
                        </View>
                        <View style={styles.checkboxContent}>
                          <Text style={styles.checkboxLabel}>Reverse Cancellation Fee</Text>
                          <Text style={styles.checkboxSubtext}>
                            {formatCurrency(caseData.financialImpact.originalPenaltyAmount)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Remove Rating */}
                    <TouchableOpacity
                      style={styles.checkboxOption}
                      onPress={() => setResolution(r => ({ ...r, ratingRemoved: !r.ratingRemoved }))}
                    >
                      <View style={[styles.checkbox, resolution.ratingRemoved && styles.checkboxChecked]}>
                        {resolution.ratingRemoved && <Icon name="check" size={10} color={colors.neutral[0]} />}
                      </View>
                      <Text style={styles.checkboxLabel}>Remove Penalty Rating</Text>
                    </TouchableOpacity>

                    {/* Unfreeze Account */}
                    <TouchableOpacity
                      style={styles.checkboxOption}
                      onPress={() => setResolution(r => ({ ...r, accountUnfrozen: !r.accountUnfrozen }))}
                    >
                      <View style={[styles.checkbox, resolution.accountUnfrozen && styles.checkboxChecked]}>
                        {resolution.accountUnfrozen && <Icon name="check" size={10} color={colors.neutral[0]} />}
                      </View>
                      <Text style={styles.checkboxLabel}>Unfreeze Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Resolution Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Explain the decision and any actions taken..."
                  placeholderTextColor={colors.text.tertiary}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowResolveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, !decision && styles.confirmButtonDisabled]}
                onPress={handleResolve}
                disabled={!decision || resolving}
              >
                {resolving ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Icon name="gavel" size={14} color={colors.neutral[0]} />
                    <Text style={styles.confirmButtonText}>Confirm Resolution</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    padding: spacing.md,
    ...shadows.lg,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  resolveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
  },
  resolveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalContent: {
    padding: spacing.lg,
    maxHeight: 500,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  decisionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  decisionButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  decisionButtonApprove: {
    backgroundColor: colors.success[500],
  },
  decisionButtonPartial: {
    backgroundColor: colors.warning[500],
  },
  decisionButtonDeny: {
    backgroundColor: colors.error[500],
  },
  decisionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  decisionButtonTextActive: {
    color: colors.neutral[0],
  },
  resolutionOptions: {
    gap: spacing.md,
  },
  resolutionOption: {
    gap: spacing.xs,
  },
  resolutionOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  resolutionOptionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  amountMax: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  checkboxOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  checkboxSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  notesInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalFooter: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default ResolutionActionsPanel;
