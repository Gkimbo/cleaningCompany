import React, { useState, useEffect } from "react";
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
import ConflictService from "../../../services/fetchRequests/ConflictService";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";

const CATEGORIES = [
  {
    value: "account_issue",
    label: "Account Issue",
    description: "Login, profile, or account access problems",
    icon: "user",
  },
  {
    value: "behavior_concern",
    label: "Behavior Concern",
    description: "Conduct or professionalism issues",
    icon: "alert-triangle",
  },
  {
    value: "service_complaint",
    label: "Service Complaint",
    description: "Quality of service or job-related issues",
    icon: "star",
  },
  {
    value: "billing_question",
    label: "Billing Question",
    description: "Payment, pricing, or invoice inquiries",
    icon: "credit-card",
  },
  {
    value: "technical_issue",
    label: "Technical Issue",
    description: "App bugs, crashes, or functionality problems",
    icon: "smartphone",
  },
  {
    value: "policy_violation",
    label: "Policy Violation",
    description: "Terms of service or policy breaches",
    icon: "shield-off",
  },
  {
    value: "other",
    label: "Other",
    description: "Issues that don't fit other categories",
    icon: "more-horizontal",
  },
];

const PRIORITIES = [
  { value: "normal", label: "Normal", color: colors.neutral[500] },
  { value: "high", label: "High", color: colors.warning[500] },
  { value: "urgent", label: "Urgent", color: colors.error[500] },
];

const CreateSupportTicketModal = ({
  visible,
  onClose,
  onSuccess,
  conversationId,
  conversationTitle,
  subjectUser,
  token,
}) => {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setStep(1);
    setCategory(null);
    setDescription("");
    setPriority("normal");
    setIsSubmitting(false);
  };

  // Reset form when modal is closed
  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectCategory = (cat) => {
    setCategory(cat);
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
      const ticketData = {
        category,
        description: description.trim(),
        priority,
        conversationId: conversationId || null,
        subjectUserId: subjectUser?.id || null,
        subjectType: subjectUser?.type || null,
      };

      const result = await ConflictService.createSupportTicket(token, ticketData);

      if (!result.success) {
        throw new Error(result.error || "Failed to create ticket");
      }

      Alert.alert(
        "Ticket Created",
        `Support ticket ${result.ticket.caseNumber} has been created and added to the resolution queue.`,
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              onSuccess?.(result.ticket);
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to create support ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Category</Text>
      <Text style={styles.stepSubtitle}>What type of issue is this?</Text>

      <View style={styles.categoryList}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.value}
            style={({ pressed }) => [
              styles.categoryButton,
              pressed && styles.categoryButtonPressed,
            ]}
            onPress={() => handleSelectCategory(cat.value)}
          >
            <View style={styles.categoryIcon}>
              <Feather name={cat.icon} size={22} color={colors.primary[600]} />
            </View>
            <View style={styles.categoryContent}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.categoryDescription}>{cat.description}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => {
    const selectedCategory = CATEGORIES.find((c) => c.value === category);

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

          <View style={styles.selectedCategoryHeader}>
            <View style={styles.selectedCategoryIcon}>
              <Feather name={selectedCategory?.icon} size={20} color={colors.primary[600]} />
            </View>
            <Text style={styles.selectedCategoryLabel}>{selectedCategory?.label}</Text>
          </View>

          {/* Context from conversation */}
          {(conversationId || subjectUser) && (
            <View style={styles.contextCard}>
              {conversationTitle && (
                <>
                  <Text style={styles.contextLabel}>From Conversation</Text>
                  <Text style={styles.contextValue}>{conversationTitle}</Text>
                </>
              )}
              {subjectUser && (
                <View style={[styles.contextRow, conversationTitle && { marginTop: spacing.sm }]}>
                  <Text style={styles.contextLabel}>Subject:</Text>
                  <Text style={styles.contextValue}>
                    {subjectUser.name} ({subjectUser.type})
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Priority */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.priorityContainer}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p.value}
                  style={[
                    styles.priorityButton,
                    priority === p.value && styles.priorityButtonActive,
                    priority === p.value && { borderColor: p.color },
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: p.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.priorityLabel,
                      priority === p.value && { color: p.color, fontWeight: typography.fontWeight.semibold },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={5}
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
                <Feather name="flag" size={18} color={colors.neutral[0]} />
                <Text style={styles.submitButtonText}>Create Ticket</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.disclaimer}>
            This ticket will be added to the Conflict Resolution queue for review.
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
            <Feather name="flag" size={20} color={colors.warning[600]} />
            <Text style={styles.headerTitle}>Create Support Ticket</Text>
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
  categoryList: {
    gap: spacing.sm,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  categoryButtonPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: typography.fontSize.xs,
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
  selectedCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  selectedCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCategoryLabel: {
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
    alignItems: "center",
    gap: spacing.xs,
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
  priorityContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  priorityButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.xs,
  },
  priorityButtonActive: {
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
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
    backgroundColor: colors.warning[600],
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

export default CreateSupportTicketModal;
