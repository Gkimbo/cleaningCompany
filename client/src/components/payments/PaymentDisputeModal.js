import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import PaymentDisputeService from "../../services/fetchRequests/PaymentDisputeService";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const ISSUE_TYPES = [
  {
    value: "missing_payout",
    label: "I didn't get paid",
    description: "I completed the job but haven't received payment",
    icon: "alert-circle",
  },
  {
    value: "wrong_amount",
    label: "Wrong amount",
    description: "I received payment but the amount is incorrect",
    icon: "dollar-sign",
  },
  {
    value: "delayed_payout",
    label: "Payment delayed",
    description: "Payment is taking longer than expected",
    icon: "clock",
  },
];

const PaymentDisputeModal = ({
  visible,
  onClose,
  onSuccess,
  payout,
  appointment,
  token,
}) => {
  const [step, setStep] = useState(1);
  const [issueType, setIssueType] = useState(null);
  const [description, setDescription] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setStep(1);
    setIssueType(null);
    setDescription("");
    setExpectedAmount("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectIssueType = (type) => {
    setIssueType(type);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Required", "Please describe the issue");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = {
        appointmentId: appointment?.id || payout?.appointmentId,
        payoutId: payout?.id || null,
        issueType,
        description: description.trim(),
        expectedAmount: expectedAmount ? Math.round(parseFloat(expectedAmount) * 100) : null,
        receivedAmount: payout?.netAmount || null,
      };

      const result = await PaymentDisputeService.submitDispute(token, data);

      Alert.alert(
        "Dispute Submitted",
        "Your payment issue has been submitted. We'll review it within 48 hours.",
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              onSuccess?.(result);
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to submit dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's the issue?</Text>
      <Text style={styles.stepSubtitle}>Select the type of payment problem you're experiencing</Text>

      <View style={styles.issueTypeList}>
        {ISSUE_TYPES.map((type) => (
          <Pressable
            key={type.value}
            style={({ pressed }) => [
              styles.issueTypeButton,
              pressed && styles.issueTypeButtonPressed,
            ]}
            onPress={() => handleSelectIssueType(type.value)}
          >
            <View style={styles.issueTypeIcon}>
              <Feather name={type.icon} size={24} color={colors.primary[600]} />
            </View>
            <View style={styles.issueTypeContent}>
              <Text style={styles.issueTypeLabel}>{type.label}</Text>
              <Text style={styles.issueTypeDescription}>{type.description}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => {
    const selectedType = ISSUE_TYPES.find((t) => t.value === issueType);

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.stepContainer}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Feather name="arrow-left" size={20} color={colors.primary[600]} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <View style={styles.selectedTypeHeader}>
            <View style={styles.selectedTypeIcon}>
              <Feather name={selectedType?.icon} size={20} color={colors.primary[600]} />
            </View>
            <Text style={styles.selectedTypeLabel}>{selectedType?.label}</Text>
          </View>

          {/* Appointment/Payout Info */}
          {(appointment || payout) && (
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Related Job</Text>
              <Text style={styles.contextValue}>
                {appointment?.date
                  ? new Date(appointment.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  : "N/A"}
              </Text>
              {payout?.netAmount && (
                <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>Amount received:</Text>
                  <Text style={styles.contextAmount}>
                    ${(payout.netAmount / 100).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Expected Amount (for wrong_amount) */}
          {issueType === "wrong_amount" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expected Amount ($)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 75.00"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="decimal-pad"
                value={expectedAmount}
                onChangeText={setExpectedAmount}
              />
            </View>
          )}

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Describe the issue *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Please provide details about the payment issue..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
              pressed && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.neutral[0]} />
            ) : (
              <>
                <Feather name="send" size={18} color={colors.neutral[0]} />
                <Text style={styles.submitButtonText}>Submit Dispute</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.disclaimer}>
            Our team will review your dispute within 48 hours and contact you if we need more information.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Feather name="flag" size={20} color={colors.error[600]} />
            <Text style={styles.headerTitle}>Report Payment Issue</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Feather name="x" size={24} color={colors.neutral[600]} />
          </Pressable>
        </View>

        {/* Content */}
        {step === 1 ? renderStep1() : renderStep2()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  stepContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  issueTypeList: {
    gap: spacing.md,
  },
  issueTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  issueTypeButtonPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  issueTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  issueTypeContent: {
    flex: 1,
  },
  issueTypeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  issueTypeDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  selectedTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  selectedTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTypeLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  contextCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  contextLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  contextValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  contextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  contextAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.md,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  disclaimer: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: typography.fontSize.xs * 1.5,
  },
});

export default PaymentDisputeModal;
