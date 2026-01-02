import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { Checkbox } from "react-native-paper";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const CancellationWarningModal = ({
  visible,
  onClose,
  onConfirm,
  cancellationInfo,
  loading = false,
}) => {
  const [agreed, setAgreed] = useState(false);
  const { pricing } = usePricing();

  const handleClose = () => {
    setAgreed(false);
    onClose();
  };

  const handleConfirm = () => {
    if (agreed) {
      onConfirm();
    }
  };

  if (!cancellationInfo) return null;

  const {
    isWithinPenaltyWindow,
    price,
    estimatedRefund,
    cleanerPayout,
    warningMessage,
    daysUntilAppointment,
    hasCleanerAssigned,
    willChargeCancellationFee,
    cancellationFee,
    hasPaymentMethod,
    // Discount/incentive info
    discountApplied,
    originalPrice,
    refundPercent,
    incentiveCleanerPercent,
    platformKeeps,
  } = cancellationInfo;

  const showCancellationFeeWarning = willChargeCancellationFee && hasPaymentMethod;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={[styles.header, (isWithinPenaltyWindow || showCancellationFeeWarning) ? styles.headerWarning : styles.headerNormal]}>
            <View style={styles.iconContainer}>
              <Icon
                name={(isWithinPenaltyWindow || showCancellationFeeWarning) ? "exclamation-triangle" : "info-circle"}
                size={32}
                color={(isWithinPenaltyWindow || showCancellationFeeWarning) ? colors.warning[600] : colors.primary[600]}
              />
            </View>
            <Text style={styles.headerTitle}>
              {showCancellationFeeWarning ? "Cancellation Fee Required" : isWithinPenaltyWindow ? "Cancellation Warning" : "Cancel Appointment"}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Days until appointment */}
            <View style={styles.infoRow}>
              <Icon name="calendar" size={16} color={colors.text.secondary} />
              <Text style={styles.infoText}>
                {daysUntilAppointment === 0
                  ? "This appointment is today"
                  : daysUntilAppointment === 1
                  ? "This appointment is tomorrow"
                  : `${daysUntilAppointment} days until appointment`}
              </Text>
            </View>

            {/* Warning message */}
            <View style={[styles.messageBox, (isWithinPenaltyWindow || showCancellationFeeWarning) ? styles.messageBoxWarning : styles.messageBoxInfo]}>
              <Text style={[styles.messageText, (isWithinPenaltyWindow || showCancellationFeeWarning) ? styles.messageTextWarning : styles.messageTextInfo]}>
                {warningMessage}
              </Text>
            </View>

            {/* Cancellation fee warning */}
            {showCancellationFeeWarning && (
              <View style={styles.feeWarningContainer}>
                <View style={styles.feeWarningHeader}>
                  <Icon name="credit-card" size={18} color={colors.error[600]} />
                  <Text style={styles.feeWarningTitle}>Card Will Be Charged</Text>
                </View>
                <View style={styles.feeAmountRow}>
                  <Text style={styles.feeLabel}>Cancellation Fee</Text>
                  <Text style={styles.feeAmount}>${cancellationFee}</Text>
                </View>
                <Text style={styles.feeNote}>
                  This fee will be charged to your card on file immediately upon cancellation.
                </Text>
              </View>
            )}

            {/* Financial breakdown for penalty window */}
            {isWithinPenaltyWindow && hasCleanerAssigned && (
              <View style={[styles.breakdownContainer, discountApplied && styles.breakdownContainerIncentive]}>
                {discountApplied && (
                  <View style={styles.incentiveWarningBanner}>
                    <Icon name="exclamation-triangle" size={16} color={colors.warning[700]} />
                    <Text style={styles.incentiveWarningText}>
                      Reduced refund due to discount applied
                    </Text>
                  </View>
                )}

                <Text style={styles.breakdownTitle}>Financial Breakdown</Text>

                {discountApplied && (
                  <>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Original Price (before discount)</Text>
                      <Text style={styles.breakdownValue}>${parseFloat(originalPrice).toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>You Paid (after discount)</Text>
                      <Text style={styles.breakdownValue}>${parseFloat(price).toFixed(2)}</Text>
                    </View>
                  </>
                )}

                {!discountApplied && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Amount Paid</Text>
                    <Text style={styles.breakdownValue}>${parseFloat(price).toFixed(2)}</Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Your Refund ({refundPercent}%)</Text>
                  <Text style={[styles.breakdownValue, styles.refundAmount]}>${estimatedRefund}</Text>
                </View>

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Cleaner Receives</Text>
                  <Text style={styles.breakdownValue}>${cleanerPayout}</Text>
                </View>

                {discountApplied && parseFloat(platformKeeps) > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Platform Keeps</Text>
                    <Text style={styles.breakdownValue}>${platformKeeps}</Text>
                  </View>
                )}

                <View style={styles.breakdownNote}>
                  <Icon name="info-circle" size={12} color={colors.text.tertiary} />
                  <Text style={styles.breakdownNoteText}>
                    {discountApplied
                      ? `Cleaner receives ${incentiveCleanerPercent}% of original price ($${originalPrice})`
                      : `Cleaner receives ${pricing.cancellation.refundPercentage * 100}% minus ${pricing.platform.feePercent * 100}% platform fee`
                    }
                  </Text>
                </View>
              </View>
            )}

            {/* Agreement checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.7}
            >
              <Checkbox
                status={agreed ? "checked" : "unchecked"}
                onPress={() => setAgreed(!agreed)}
                color={colors.primary[600]}
              />
              <Text style={styles.checkboxLabel}>
                {showCancellationFeeWarning
                  ? `I agree to pay the $${cancellationFee} cancellation fee`
                  : isWithinPenaltyWindow && discountApplied
                  ? `I understand I will only receive $${estimatedRefund} back (${refundPercent}% refund due to discount)`
                  : isWithinPenaltyWindow
                  ? "I understand and agree to the cancellation terms"
                  : "I want to cancel this appointment"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Go Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (!agreed || loading) && styles.buttonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!agreed || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <>
                  <Icon name="times-circle" size={16} color={colors.neutral[0]} />
                  <Text style={styles.confirmButtonText}>Cancel Appointment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
    overflow: "hidden",
    ...shadows.xl,
  },
  header: {
    padding: spacing.xl,
    alignItems: "center",
  },
  headerWarning: {
    backgroundColor: colors.warning[50],
  },
  headerNormal: {
    backgroundColor: colors.primary[50],
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
  },
  content: {
    padding: spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  messageBox: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  messageBoxWarning: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  messageBoxInfo: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  messageTextWarning: {
    color: colors.warning[800],
  },
  messageTextInfo: {
    color: colors.primary[800],
  },
  breakdownContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  breakdownContainerIncentive: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  incentiveWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  incentiveWarningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
  },
  breakdownTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  breakdownLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  breakdownValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  refundAmount: {
    color: colors.success[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
  breakdownNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  breakdownNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flex: 1,
  },
  feeWarningContainer: {
    backgroundColor: colors.error[50],
    borderWidth: 2,
    borderColor: colors.error[300],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  feeWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  feeWarningTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[700],
  },
  feeAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  feeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  feeAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
  },
  feeNote: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    fontStyle: "italic",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  confirmButton: {
    backgroundColor: colors.error[500],
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default CancellationWarningModal;
