import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AppealSubmissionModal } from "../appeals";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const CancellationSuccessModal = ({
  visible,
  onClose,
  cancellationResult,
}) => {
  const [showAppealModal, setShowAppealModal] = useState(false);

  if (!cancellationResult) return null;

  const {
    confirmationId,
    refundAmount,
    cancellationFee,
    appeal,
    financialBreakdown,
    appointmentId,
    wasWithinPenaltyWindow,
  } = cancellationResult;

  const hasFinancialImpact = wasWithinPenaltyWindow || cancellationFee > 0;

  const handleAppealSuccess = (result) => {
    setShowAppealModal(false);
    // Could navigate to appeal detail or just close
  };

  return (
    <>
      <Modal
        visible={visible && !showAppealModal}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Icon name="check-circle" size={48} color={colors.success[500]} />
              </View>
              <Text style={styles.headerTitle}>Appointment Cancelled</Text>
              <Text style={styles.confirmationId}>
                Confirmation: {confirmationId}
              </Text>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Financial Summary */}
              {financialBreakdown?.summary && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Financial Summary</Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Original Amount</Text>
                    <Text style={styles.summaryValue}>
                      ${(financialBreakdown.summary.youOriginallyPaid / 100).toFixed(2)}
                    </Text>
                  </View>

                  {financialBreakdown.summary.youWillReceive > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Refund Amount</Text>
                      <Text style={[styles.summaryValue, styles.refundValue]}>
                        ${(financialBreakdown.summary.youWillReceive / 100).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {financialBreakdown.summary.cancellationFeeCharged > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Cancellation Fee</Text>
                      <Text style={[styles.summaryValue, styles.feeValue]}>
                        ${(financialBreakdown.summary.cancellationFeeCharged / 100).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.summaryRow}>
                    <Text style={styles.totalLabel}>Your Net Cost</Text>
                    <Text style={styles.totalValue}>
                      ${(financialBreakdown.summary.yourNetCost / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Refund Info */}
              {financialBreakdown?.refund?.eligible && (
                <View style={styles.infoCard}>
                  <Icon name="credit-card" size={18} color={colors.primary[600]} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>Refund Processing</Text>
                    <Text style={styles.infoText}>
                      Your refund of ${(financialBreakdown.refund.amount / 100).toFixed(2)} will
                      be returned to your {financialBreakdown.refund.method || "original payment method"}.
                    </Text>
                    <Text style={styles.infoSubtext}>
                      Estimated arrival: {financialBreakdown.refund.estimatedArrival || "3-5 business days"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Appeal Section */}
              {appeal?.available && hasFinancialImpact && (
                <View style={styles.appealCard}>
                  <View style={styles.appealHeader}>
                    <Icon name="gavel" size={20} color={colors.primary[600]} />
                    <Text style={styles.appealTitle}>Appeal Available</Text>
                  </View>

                  <Text style={styles.appealMessage}>{appeal.message}</Text>

                  <View style={styles.appealDeadline}>
                    <Icon name="clock-o" size={14} color={colors.warning[600]} />
                    <Text style={styles.deadlineText}>
                      Deadline: {appeal.deadlineFormatted}
                    </Text>
                  </View>

                  <View style={styles.appealReasons}>
                    <Text style={styles.reasonsTitle}>Valid reasons include:</Text>
                    {appeal.reasons?.slice(0, 4).map((reason, index) => (
                      <View key={index} style={styles.reasonItem}>
                        <Icon name="check" size={12} color={colors.success[500]} />
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.appealButton}
                    onPress={() => setShowAppealModal(true)}
                    activeOpacity={0.8}
                  >
                    <Icon name="paper-plane" size={16} color={colors.neutral[0]} />
                    <Text style={styles.appealButtonText}>Submit an Appeal</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* No Appeal Available */}
              {!hasFinancialImpact && (
                <View style={styles.noAppealCard}>
                  <Icon name="info-circle" size={18} color={colors.primary[600]} />
                  <Text style={styles.noAppealText}>
                    No fees were charged for this cancellation. Your full refund is being processed.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Appeal Submission Modal */}
      <AppealSubmissionModal
        visible={showAppealModal}
        onClose={() => setShowAppealModal(false)}
        onSuccess={handleAppealSuccess}
        appointmentId={appointmentId}
        cancellationInfo={{
          isWithinPenaltyWindow: wasWithinPenaltyWindow,
          willChargeCancellationFee: cancellationFee > 0,
          cancellationFee: cancellationFee ? cancellationFee / 100 : 0,
          estimatedRefund: refundAmount ? refundAmount / 100 : 0,
          price: financialBreakdown?.originalCharges?.totalCharged
            ? financialBreakdown.originalCharges.totalCharged / 100
            : 0,
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    width: "100%",
    maxWidth: 420,
    maxHeight: "90%",
    overflow: "hidden",
    ...shadows.xl,
  },
  header: {
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.success[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.success[100],
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  confirmationId: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontFamily: "monospace",
  },
  content: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  summaryCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  refundValue: {
    color: colors.success[600],
  },
  feeValue: {
    color: colors.error[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 18,
  },
  infoSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.xs,
  },
  appealCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
    marginBottom: spacing.md,
  },
  appealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  appealTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  appealMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  appealDeadline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  deadlineText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  appealReasons: {
    marginBottom: spacing.md,
  },
  reasonsTitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  reasonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  appealButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  appealButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  noAppealCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  noAppealText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  doneButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  doneButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default CancellationSuccessModal;
