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

const LargeHomeWarningModal = ({
  visible,
  onClose,
  onConfirm,
  bookingInfo,
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

  if (!bookingInfo) return null;

  const {
    homeInfo = {},
    isLargeHome,
    soloAllowed = true, // Default to true for backwards compatibility
    multiCleanerRequired = false,
    recommendedCleaners = 2,
    hasTimeConstraint,
    acknowledgmentMessage,
  } = bookingInfo;

  const { numBeds, numBaths, timeToBeCompleted, cleanersNeeded } = homeInfo;

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
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon
                name="exclamation-triangle"
                size={32}
                color={colors.warning[600]}
              />
            </View>
            <Text style={styles.headerTitle}>Large Home Detected</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Home size info */}
            <View style={styles.infoRow}>
              <Icon name="home" size={16} color={colors.text.secondary} />
              <Text style={styles.infoText}>
                {numBeds} bedrooms, {numBaths} bathrooms
              </Text>
            </View>

            {/* Recommended cleaners */}
            <View style={styles.infoRow}>
              <Icon name="users" size={16} color={colors.primary[500]} />
              <Text style={[styles.infoText, styles.recommendedText]}>
                Recommended: {recommendedCleaners} cleaners
              </Text>
            </View>

            {/* Time constraint */}
            {hasTimeConstraint && (
              <View style={styles.infoRow}>
                <Icon name="clock-o" size={16} color={colors.warning[500]} />
                <Text style={[styles.infoText, styles.timeWarning]}>
                  Must be completed between {timeToBeCompleted}
                </Text>
              </View>
            )}

            {/* Warning message box */}
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>Clean Solo?</Text>
              <Text style={styles.messageText}>
                This is a larger home that we recommend having {recommendedCleaners} cleaners for.
              </Text>
              <Text style={styles.messageText}>
                You can still choose to clean this home by yourself, but it may take longer than usual.
              </Text>
              {hasTimeConstraint && (
                <Text style={[styles.messageText, styles.timeConstraintText]}>
                  Note: With the time constraint ({timeToBeCompleted}), completing this job alone may be challenging.
                </Text>
              )}
            </View>

            {/* Agreement checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.7}
            >
              <Checkbox
                status={agreed ? "checked" : "unchecked"}
                onPress={() => setAgreed(!agreed)}
                color={colors.warning[600]}
              />
              <Text style={styles.checkboxLabel}>
                {acknowledgmentMessage || `I understand this home is larger than average and may take longer to clean solo. I choose to clean it by myself.`}
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
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
                  <Icon name="user" size={16} color={colors.neutral[0]} />
                  <Text style={styles.confirmButtonText}>Clean Solo</Text>
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
    backgroundColor: colors.warning[50],
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
  timeWarning: {
    color: colors.warning[600],
    fontWeight: typography.fontWeight.medium,
  },
  recommendedText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  messageBox: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  messageTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: spacing.sm,
  },
  messageText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  messageBold: {
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
  },
  timeConstraintText: {
    marginTop: spacing.sm,
    fontStyle: "italic",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
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
    backgroundColor: colors.neutral[200],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  confirmButton: {
    backgroundColor: colors.warning[500],
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

export default LargeHomeWarningModal;
