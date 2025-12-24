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

const PricingWarningModal = ({
  visible,
  onClose,
  onConfirm,
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
      setAgreed(false);
    }
  };

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
            <Text style={styles.headerTitle}>Pricing Change Confirmation</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.introText}>
              You are about to update the pricing configuration. Please review:
            </Text>

            {/* Warning points */}
            <View style={styles.warningList}>
              <View style={styles.warningItem}>
                <View style={styles.warningNumber}>
                  <Text style={styles.warningNumberText}>1</Text>
                </View>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>IMMEDIATE EFFECT</Text>
                  <Text style={styles.warningDescription}>
                    New prices will apply to all future bookings immediately.
                  </Text>
                </View>
              </View>

              <View style={styles.warningItem}>
                <View style={styles.warningNumber}>
                  <Text style={styles.warningNumberText}>2</Text>
                </View>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>EXISTING APPOINTMENTS</Text>
                  <Text style={styles.warningDescription}>
                    Already-booked appointments will NOT be affected.
                  </Text>
                </View>
              </View>

              <View style={styles.warningItem}>
                <View style={styles.warningNumber}>
                  <Text style={styles.warningNumberText}>3</Text>
                </View>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>QUOTED PRICES</Text>
                  <Text style={styles.warningDescription}>
                    Any quotes shown to users will update on their next page load.
                  </Text>
                </View>
              </View>

              <View style={styles.warningItem}>
                <View style={styles.warningNumber}>
                  <Text style={styles.warningNumberText}>4</Text>
                </View>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>AUDIT TRAIL</Text>
                  <Text style={styles.warningDescription}>
                    This change will be logged with your owner ID and timestamp.
                  </Text>
                </View>
              </View>
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
                color={colors.primary[600]}
              />
              <Text style={styles.checkboxLabel}>
                I understand and agree to proceed with this pricing update
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
                  <Icon name="check" size={16} color={colors.neutral[0]} />
                  <Text style={styles.confirmButtonText}>I Understand, Save Changes</Text>
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
    maxWidth: 480,
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
  introText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  warningList: {
    marginBottom: spacing.lg,
  },
  warningItem: {
    flexDirection: "row",
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  warningNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
    marginTop: 2,
  },
  warningNumberText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  warningDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
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
    backgroundColor: colors.primary[600],
  },
  confirmButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default PricingWarningModal;
