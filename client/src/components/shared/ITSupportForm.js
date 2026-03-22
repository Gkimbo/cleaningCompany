import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import ITDisputeService from "../../services/fetchRequests/ITDisputeService";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

const ITSupportForm = ({ visible, onClose, token, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submittedDispute, setSubmittedDispute] = useState(null);

  const categoryGroups = ITDisputeService.getCategoryGroups();
  const priorityOptions = ITDisputeService.getPriorityOptions();

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setStep(1);
      setSelectedGroup(null);
      setSelectedCategory(null);
      setPriority("normal");
      setDescription("");
      setError(null);
      setSubmittedDispute(null);
    }
  }, [visible]);

  const handleGroupSelect = (groupKey) => {
    setSelectedGroup(groupKey);
    setSelectedCategory(null);
    setStep(2);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("Please describe your issue");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get device info
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
      };

      const result = await ITDisputeService.submitDispute(token, {
        category: selectedCategory.value,
        description: description.trim(),
        priority,
        deviceInfo, // Send as object, not stringified
        platform: Platform.OS,
      });

      if (result.success) {
        setSubmittedDispute(result.dispute);
        setStep(4); // Success step
        if (onSuccess) {
          onSuccess(result.dispute);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to submit dispute. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedGroup(null);
    setSelectedCategory(null);
    setPriority("normal");
    setDescription("");
    setError(null);
    setSubmittedDispute(null);
    onClose();
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What type of issue?</Text>
      <Text style={styles.stepSubtitle}>Select a category to get started</Text>

      <View style={styles.categoryGroups}>
        {Object.entries(categoryGroups).map(([key, group]) => (
          <Pressable
            key={key}
            style={styles.categoryGroupCard}
            onPress={() => handleGroupSelect(key)}
          >
            <View style={styles.categoryGroupIcon}>
              <Icon name={group.icon} size={24} color={colors.primary[600]} />
            </View>
            <Text style={styles.categoryGroupLabel}>{group.label}</Text>
            <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => {
    const group = categoryGroups[selectedGroup];

    return (
      <View style={styles.stepContent}>
        <Pressable style={styles.backLink} onPress={() => setStep(1)}>
          <Icon name="chevron-left" size={12} color={colors.primary[600]} />
          <Text style={styles.backLinkText}>Back</Text>
        </Pressable>

        <Text style={styles.stepTitle}>{group.label}</Text>
        <Text style={styles.stepSubtitle}>Select the specific issue</Text>

        <View style={styles.categoryList}>
          {group.categories.map((category) => (
            <Pressable
              key={category.value}
              style={styles.categoryItem}
              onPress={() => handleCategorySelect(category)}
            >
              <Text style={styles.categoryItemLabel}>{category.label}</Text>
              <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Pressable style={styles.backLink} onPress={() => setStep(2)}>
        <Icon name="chevron-left" size={12} color={colors.primary[600]} />
        <Text style={styles.backLinkText}>Back</Text>
      </Pressable>

      <View style={styles.selectedInfo}>
        <Text style={styles.selectedLabel}>Issue Type:</Text>
        <Text style={styles.selectedValue}>{selectedCategory.label}</Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Describe your issue *</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Please provide details about your issue..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Priority</Text>
        <View style={styles.priorityOptions}>
          {priorityOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.priorityOption,
                priority === option.value && styles.priorityOptionSelected,
              ]}
              onPress={() => setPriority(option.value)}
            >
              <Text
                style={[
                  styles.priorityOptionLabel,
                  priority === option.value && styles.priorityOptionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.priorityOptionDesc}>{option.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={colors.neutral[0]} />
        ) : (
          <>
            <Icon name="paper-plane" size={16} color={colors.neutral[0]} />
            <Text style={styles.submitButtonText}>Submit Issue</Text>
          </>
        )}
      </Pressable>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );

  const renderStep4 = () => (
    <View style={styles.successContent}>
      <View style={styles.successIcon}>
        <Icon name="check-circle" size={64} color={colors.success[500]} />
      </View>
      <Text style={styles.successTitle}>Issue Submitted!</Text>
      <Text style={styles.successMessage}>
        Your issue has been submitted to our IT team. We'll get back to you as soon as possible.
      </Text>

      {submittedDispute && (
        <View style={styles.caseInfo}>
          <Text style={styles.caseLabel}>Case Number</Text>
          <Text style={styles.caseNumber}>{submittedDispute.caseNumber}</Text>
        </View>
      )}

      <Pressable style={styles.closeButton} onPress={handleClose}>
        <Text style={styles.closeButtonText}>Done</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Icon name="headphones" size={20} color={colors.primary[600]} />
              <Text style={styles.modalTitle}>IT Support</Text>
            </View>
            <Pressable style={styles.headerClose} onPress={handleClose}>
              <Icon name="times" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    minHeight: "50%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerClose: {
    padding: spacing.sm,
  },
  stepContent: {
    padding: spacing.lg,
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  categoryGroups: {
    gap: spacing.md,
  },
  categoryGroupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  categoryGroupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  categoryGroupLabel: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  categoryList: {
    gap: spacing.sm,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  categoryItemLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  selectedInfo: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  selectedLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  selectedValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  descriptionInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    minHeight: 120,
  },
  priorityOptions: {
    gap: spacing.sm,
  },
  priorityOption: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  priorityOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  priorityOptionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  priorityOptionLabelSelected: {
    color: colors.primary[700],
  },
  priorityOptionDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  submitButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  caseInfo: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.xl,
    width: "100%",
  },
  caseLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  caseNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  closeButton: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  closeButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default ITSupportForm;
