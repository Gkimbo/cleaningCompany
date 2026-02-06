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
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const CleanerCancellationWarningModal = ({
  visible,
  onClose,
  onConfirm,
  cancellationInfo,
  loading = false,
}) => {
  const [agreed, setAgreed] = useState(false);

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
    warningMessage,
    daysUntilAppointment,
    recentCancellationPenalties = 0,
    willResultInFreeze = false,
    requiresAcknowledgment = false,
    acknowledgmentMessage,
  } = cancellationInfo;

  const remainingBeforeFreeze = Math.max(0, 2 - recentCancellationPenalties);

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
          <View style={[
            styles.header,
            willResultInFreeze
              ? styles.headerDanger
              : isWithinPenaltyWindow
              ? styles.headerWarning
              : styles.headerNormal
          ]}>
            <View style={styles.iconContainer}>
              <Icon
                name={willResultInFreeze ? "ban" : isWithinPenaltyWindow ? "exclamation-triangle" : "info-circle"}
                size={32}
                color={
                  willResultInFreeze
                    ? colors.error[600]
                    : isWithinPenaltyWindow
                    ? colors.warning[600]
                    : colors.primary[600]
                }
              />
            </View>
            <Text style={styles.headerTitle}>
              {willResultInFreeze
                ? "Account Will Be Frozen"
                : isWithinPenaltyWindow
                ? "Cancellation Penalty"
                : "Cancel Job"}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Days until appointment */}
            <View style={styles.infoRow}>
              <Icon name="calendar" size={16} color={colors.text.secondary} />
              <Text style={styles.infoText}>
                {daysUntilAppointment === 0
                  ? "This job is today"
                  : daysUntilAppointment === 1
                  ? "This job is tomorrow"
                  : `${daysUntilAppointment} days until job`}
              </Text>
            </View>

            {/* Warning message */}
            <View style={[
              styles.messageBox,
              willResultInFreeze
                ? styles.messageBoxDanger
                : isWithinPenaltyWindow
                ? styles.messageBoxWarning
                : styles.messageBoxInfo
            ]}>
              <Text style={[
                styles.messageText,
                willResultInFreeze
                  ? styles.messageTextDanger
                  : isWithinPenaltyWindow
                  ? styles.messageTextWarning
                  : styles.messageTextInfo
              ]}>
                {warningMessage}
              </Text>
            </View>

            {/* Penalty details for within window */}
            {isWithinPenaltyWindow && (
              <View style={styles.penaltyContainer}>
                <Text style={styles.penaltyTitle}>What happens if you cancel:</Text>

                {/* 1-star rating */}
                <View style={styles.penaltyItem}>
                  <View style={styles.penaltyIconContainer}>
                    <Icon name="star" size={16} color={colors.warning[500]} />
                  </View>
                  <View style={styles.penaltyTextContainer}>
                    <Text style={styles.penaltyItemTitle}>1-Star Rating</Text>
                    <Text style={styles.penaltyItemDescription}>
                      An automatic 1-star review will be added with "Last minute cancellation"
                    </Text>
                  </View>
                </View>

                {/* Current status */}
                <View style={styles.penaltyItem}>
                  <View style={[
                    styles.penaltyIconContainer,
                    willResultInFreeze && styles.penaltyIconDanger
                  ]}>
                    <Icon
                      name="history"
                      size={16}
                      color={willResultInFreeze ? colors.error[500] : colors.text.secondary}
                    />
                  </View>
                  <View style={styles.penaltyTextContainer}>
                    <Text style={styles.penaltyItemTitle}>
                      {recentCancellationPenalties} of 3 Penalties Used
                    </Text>
                    <Text style={styles.penaltyItemDescription}>
                      {willResultInFreeze
                        ? "This cancellation will freeze your account!"
                        : `${remainingBeforeFreeze} more ${remainingBeforeFreeze === 1 ? "penalty" : "penalties"} before account freeze`}
                    </Text>
                  </View>
                </View>

                {/* Account freeze warning */}
                {willResultInFreeze && (
                  <View style={styles.freezeWarning}>
                    <Icon name="lock" size={20} color={colors.error[600]} />
                    <Text style={styles.freezeWarningText}>
                      Your account will be frozen immediately after this cancellation. You will not be able to accept new jobs until you contact support.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Agreement checkbox */}
            {!agreed && (
              <View style={styles.consentHeader}>
                <Icon name="hand-pointer-o" size={16} color={willResultInFreeze ? colors.error[600] : colors.warning[600]} />
                <Text style={[styles.consentHeaderText, willResultInFreeze && styles.consentHeaderTextDanger]}>
                  Tap below to confirm cancellation
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.checkboxContainer,
                agreed && styles.checkboxContainerChecked,
                willResultInFreeze && styles.checkboxContainerDanger,
                willResultInFreeze && agreed && styles.checkboxContainerDangerChecked
              ]}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.8}
            >
              <View style={[
                styles.customCheckbox,
                agreed && styles.customCheckboxChecked,
                willResultInFreeze && styles.customCheckboxDanger,
                willResultInFreeze && agreed && styles.customCheckboxDangerChecked
              ]}>
                {agreed && (
                  <Icon name="check" size={18} color={colors.neutral[0]} />
                )}
              </View>
              <Text style={[
                styles.checkboxLabel,
                agreed && styles.checkboxLabelChecked,
                willResultInFreeze && styles.checkboxLabelDanger
              ]}>
                {acknowledgmentMessage
                  ? acknowledgmentMessage
                  : willResultInFreeze
                  ? "I understand my account will be frozen"
                  : isWithinPenaltyWindow
                  ? "I understand and accept the 1-star penalty"
                  : "I want to cancel this job"}
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
              <Text style={styles.cancelButtonText}>Keep Job</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                willResultInFreeze ? styles.confirmButtonDanger : styles.confirmButton,
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
                  <Text style={styles.confirmButtonText}>Cancel Job</Text>
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
  headerDanger: {
    backgroundColor: colors.error[50],
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
  messageBoxDanger: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
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
  messageTextDanger: {
    color: colors.error[800],
  },
  messageTextWarning: {
    color: colors.warning[800],
  },
  messageTextInfo: {
    color: colors.primary[800],
  },
  penaltyContainer: {
    marginBottom: spacing.lg,
  },
  penaltyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  penaltyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  penaltyIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
  },
  penaltyIconDanger: {
    backgroundColor: colors.error[100],
  },
  penaltyTextContainer: {
    flex: 1,
  },
  penaltyItemTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  penaltyItemDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  freezeWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.error[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
    marginTop: spacing.sm,
  },
  freezeWarningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[800],
    lineHeight: 20,
    fontWeight: typography.fontWeight.medium,
  },
  consentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  consentHeaderText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[600],
  },
  consentHeaderTextDanger: {
    color: colors.error[600],
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary[400],
    gap: spacing.md,
    ...shadows.md,
  },
  checkboxContainerChecked: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  checkboxContainerDanger: {
    borderColor: colors.error[400],
  },
  checkboxContainerDangerChecked: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[600],
  },
  customCheckbox: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary[400],
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
  },
  customCheckboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  customCheckboxDanger: {
    borderColor: colors.error[400],
  },
  customCheckboxDangerChecked: {
    backgroundColor: colors.error[600],
    borderColor: colors.error[600],
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    lineHeight: 22,
  },
  checkboxLabelChecked: {
    fontWeight: typography.fontWeight.semibold,
  },
  checkboxLabelDanger: {
    color: colors.error[800],
    fontWeight: typography.fontWeight.semibold,
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
    backgroundColor: colors.success[500],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  confirmButton: {
    backgroundColor: colors.warning[500],
  },
  confirmButtonDanger: {
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

export default CleanerCancellationWarningModal;
