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

const PayoutModal = ({ visible, onClose, onSuccess, caseData, caseType, caseId }) => {
  const { user } = useContext(AuthContext);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const cleaner = caseData?.cleaner;
  const hasStripeAccount = !!cleaner?.stripeAccountId;

  const handleSubmit = async () => {
    const amountCents = Math.round(parseFloat(amount || 0) * 100);

    if (!amountCents || amountCents <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (!reason.trim()) {
      Alert.alert("Error", "Please provide a reason for the payout");
      return;
    }

    setProcessing(true);
    try {
      const result = await ConflictService.processPayout(
        user.token,
        caseType,
        caseId,
        amountCents,
        reason.trim()
      );

      if (result.success) {
        Alert.alert("Success", `Payout of $${(amountCents / 100).toFixed(2)} sent successfully`, [
          { text: "OK", onPress: () => { setAmount(""); setReason(""); onSuccess?.(); } },
        ]);
      } else {
        Alert.alert("Error", result.error || "Failed to process payout");
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setProcessing(false);
    }
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
              <Icon name="money" size={24} color={colors.warning[500]} />
            </View>
            <Text style={styles.title}>Send Payout</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="times" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Recipient Info */}
            {cleaner && (
              <View style={styles.recipientCard}>
                <Text style={styles.recipientLabel}>Payout To</Text>
                <Text style={styles.recipientName}>{cleaner.name}</Text>
                {cleaner.email && (
                  <Text style={styles.recipientEmail}>{cleaner.email}</Text>
                )}
                <View style={[styles.stripeStatus, hasStripeAccount ? styles.stripeConnected : styles.stripeNotConnected]}>
                  <Icon
                    name={hasStripeAccount ? "check-circle" : "exclamation-circle"}
                    size={12}
                    color={hasStripeAccount ? colors.success[600] : colors.error[600]}
                  />
                  <Text style={[styles.stripeStatusText, hasStripeAccount ? styles.stripeConnectedText : styles.stripeNotConnectedText]}>
                    {hasStripeAccount ? "Stripe Connected" : "No Stripe Account"}
                  </Text>
                </View>
              </View>
            )}

            {!hasStripeAccount && (
              <View style={styles.errorCard}>
                <Icon name="exclamation-triangle" size={18} color={colors.error[500]} />
                <View style={styles.errorContent}>
                  <Text style={styles.errorTitle}>Cannot Process Payout</Text>
                  <Text style={styles.errorText}>
                    This cleaner does not have a Stripe Connect account set up. They must connect their bank account before receiving payouts.
                  </Text>
                </View>
              </View>
            )}

            {hasStripeAccount && (
              <>
                {/* Amount Input */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Payout Amount</Text>
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
                </View>

                {/* Reason */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Reason</Text>
                  <TextInput
                    style={styles.reasonInput}
                    multiline
                    numberOfLines={3}
                    placeholder="Explain the reason for this payout..."
                    placeholderTextColor={colors.text.tertiary}
                    value={reason}
                    onChangeText={setReason}
                  />
                </View>

                {/* Info */}
                <View style={styles.infoCard}>
                  <Icon name="info-circle" size={14} color={colors.primary[600]} />
                  <Text style={styles.infoText}>
                    The payout will be transferred directly to the cleaner's connected bank account via Stripe.
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            {hasStripeAccount && (
              <TouchableOpacity
                style={[styles.submitButton, processing && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Icon name="paper-plane" size={14} color={colors.neutral[0]} />
                    <Text style={styles.submitButtonText}>Send Payout</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
    backgroundColor: colors.warning[100],
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
  stripeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  stripeConnected: {
    backgroundColor: colors.success[100],
  },
  stripeNotConnected: {
    backgroundColor: colors.error[100],
  },
  stripeStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  stripeConnectedText: {
    color: colors.success[700],
  },
  stripeNotConnectedText: {
    color: colors.error[700],
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    lineHeight: 18,
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
  reasonInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
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
    backgroundColor: colors.warning[500],
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

export default PayoutModal;
