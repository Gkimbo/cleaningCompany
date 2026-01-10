import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
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

const RefundModal = ({ visible, onClose, onSuccess, caseData, caseType, caseId }) => {
  const { user } = useContext(AuthContext);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const maxRefundAmount = caseData?.appointment?.price || 0;
  const homeowner = caseData?.homeowner;

  const handleSubmit = async () => {
    const amountCents = Math.round(parseFloat(amount || 0) * 100);

    if (!amountCents || amountCents <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (amountCents > maxRefundAmount) {
      Alert.alert("Error", `Amount cannot exceed $${(maxRefundAmount / 100).toFixed(2)}`);
      return;
    }

    if (!reason.trim()) {
      Alert.alert("Error", "Please provide a reason for the refund");
      return;
    }

    setProcessing(true);
    try {
      const result = await ConflictService.processRefund(
        user.token,
        caseType,
        caseId,
        amountCents,
        reason.trim()
      );

      if (result.success) {
        Alert.alert("Success", `Refund of $${(amountCents / 100).toFixed(2)} processed successfully`, [
          { text: "OK", onPress: () => { setAmount(""); setReason(""); onSuccess?.(); } },
        ]);
      } else {
        Alert.alert("Error", result.error || "Failed to process refund");
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const setPresetAmount = (percentage) => {
    const presetAmount = (maxRefundAmount * percentage / 100) / 100;
    setAmount(presetAmount.toFixed(2));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Icon name="undo" size={24} color={colors.success[500]} />
            </View>
            <Text style={styles.title}>Process Refund</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="times" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Recipient Info */}
            {homeowner && (
              <View style={styles.recipientCard}>
                <Text style={styles.recipientLabel}>Refund To</Text>
                <Text style={styles.recipientName}>{homeowner.name}</Text>
                {homeowner.email && (
                  <Text style={styles.recipientEmail}>{homeowner.email}</Text>
                )}
              </View>
            )}

            {/* Amount Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Refund Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.text.tertiary}
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <Text style={styles.maxAmount}>
                Maximum: ${(maxRefundAmount / 100).toFixed(2)}
              </Text>

              {/* Preset Buttons */}
              <View style={styles.presetButtons}>
                {[25, 50, 75, 100].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={styles.presetButton}
                    onPress={() => setPresetAmount(pct)}
                  >
                    <Text style={styles.presetButtonText}>{pct}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reason */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Reason</Text>
              <TextInput
                style={styles.reasonInput}
                multiline
                numberOfLines={3}
                placeholder="Explain the reason for this refund..."
                placeholderTextColor={colors.text.tertiary}
                value={reason}
                onChangeText={setReason}
              />
            </View>

            {/* Warning */}
            <View style={styles.warningCard}>
              <Icon name="exclamation-triangle" size={14} color={colors.warning[600]} />
              <Text style={styles.warningText}>
                This action cannot be undone. The refund will be processed immediately through Stripe.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, processing && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <>
                  <Icon name="check" size={14} color={colors.neutral[0]} />
                  <Text style={styles.submitButtonText}>Process Refund</Text>
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
  container: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    overflow: "hidden",
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  recipientCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  recipientLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  recipientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  recipientEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  maxAmount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "right",
  },
  presetButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  presetButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
  },
  presetButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  reasonInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 18,
  },
  footer: {
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
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.success[500],
    borderRadius: radius.lg,
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default RefundModal;
