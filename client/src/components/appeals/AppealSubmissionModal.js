import React, { useState, useContext } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../context/AuthContext";
import AppealService from "../../services/fetchRequests/AppealService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const APPEAL_CATEGORIES = [
  {
    value: "medical_emergency",
    label: "Medical Emergency",
    icon: "medkit",
    description: "You or a family member had a medical emergency",
  },
  {
    value: "family_emergency",
    label: "Family Emergency",
    icon: "users",
    description: "Death, serious illness, or urgent family matter",
  },
  {
    value: "natural_disaster",
    label: "Natural Disaster",
    icon: "bolt",
    description: "Weather event, power outage, or natural disaster",
  },
  {
    value: "property_issue",
    label: "Property Issue",
    icon: "home",
    description: "Property damage, flooding, or access issues",
  },
  {
    value: "transportation",
    label: "Transportation",
    icon: "car",
    description: "Vehicle breakdown or transportation emergency",
  },
  {
    value: "scheduling_error",
    label: "Scheduling Error",
    icon: "calendar",
    description: "System error or booking mistake",
  },
  {
    value: "other",
    label: "Other",
    icon: "question-circle",
    description: "Other circumstances beyond your control",
  },
];

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low", color: colors.success[500] },
  { value: "medium", label: "Medium", color: colors.warning[500] },
  { value: "high", label: "High", color: colors.secondary[500] },
  { value: "critical", label: "Critical", color: colors.error[500] },
];

const AppealSubmissionModal = ({
  visible,
  onClose,
  onSuccess,
  appointmentId,
  cancellationInfo,
}) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: category, 2: details, 3: confirm
  const [category, setCategory] = useState(null);
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [requestedRelief, setRequestedRelief] = useState("");
  const [error, setError] = useState(null);

  const resetForm = () => {
    setStep(1);
    setCategory(null);
    setSeverity("medium");
    setDescription("");
    setRequestedRelief("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!category || !description.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await AppealService.submitAppeal(user.token, {
        appointmentId,
        category,
        severity,
        description: description.trim(),
        requestedRelief: requestedRelief.trim() || undefined,
        contestingItems: {
          penalty: cancellationInfo?.isWithinPenaltyWindow,
          fee: cancellationInfo?.willChargeCancellationFee,
          refund: cancellationInfo?.estimatedRefund > 0,
        },
      });

      if (result.success) {
        onSuccess?.(result);
        handleClose();
      } else {
        setError(result.error || "Failed to submit appeal");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return category !== null;
    if (step === 2) return description.trim().length >= 20;
    return true;
  };

  const renderCategorySelection = () => (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>What happened?</Text>
      <Text style={styles.stepSubtitle}>
        Select the category that best describes your situation
      </Text>

      <View style={styles.categoriesContainer}>
        {APPEAL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[
              styles.categoryCard,
              category === cat.value && styles.categoryCardSelected,
            ]}
            onPress={() => setCategory(cat.value)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.categoryIcon,
                category === cat.value && styles.categoryIconSelected,
              ]}
            >
              <Icon
                name={cat.icon}
                size={24}
                color={
                  category === cat.value
                    ? colors.neutral[0]
                    : colors.primary[600]
                }
              />
            </View>
            <View style={styles.categoryText}>
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.value && styles.categoryLabelSelected,
                ]}
              >
                {cat.label}
              </Text>
              <Text style={styles.categoryDescription}>{cat.description}</Text>
            </View>
            {category === cat.value && (
              <Icon name="check-circle" size={20} color={colors.primary[600]} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderDetailsForm = () => (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Tell us more</Text>
      <Text style={styles.stepSubtitle}>
        Provide details about your situation to help us review your appeal
      </Text>

      {/* Severity Selection */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>How urgent is this?</Text>
        <View style={styles.severityContainer}>
          {SEVERITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.severityButton,
                severity === opt.value && {
                  backgroundColor: opt.color,
                  borderColor: opt.color,
                },
              ]}
              onPress={() => setSeverity(opt.value)}
            >
              <Text
                style={[
                  styles.severityLabel,
                  severity === opt.value && styles.severityLabelSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Description */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Describe what happened <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textArea, styles.input]}
          value={description}
          onChangeText={setDescription}
          placeholder="Please explain the circumstances that led to the cancellation..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <Text style={styles.characterCount}>
          {description.length}/500 (minimum 20 characters)
        </Text>
      </View>

      {/* Requested Relief */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>What are you requesting? (Optional)</Text>
        <TextInput
          style={[styles.textArea, styles.input, { minHeight: 80 }]}
          value={requestedRelief}
          onChangeText={setRequestedRelief}
          placeholder="E.g., Full refund of cancellation fee, waive penalty..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Icon name="lightbulb-o" size={20} color={colors.primary[600]} />
        <Text style={styles.infoText}>
          Supporting documents (medical notes, photos, etc.) can be uploaded
          after submission to strengthen your appeal.
        </Text>
      </View>
    </ScrollView>
  );

  const renderConfirmation = () => {
    const selectedCategory = APPEAL_CATEGORIES.find((c) => c.value === category);
    const selectedSeverity = SEVERITY_OPTIONS.find((s) => s.value === severity);

    return (
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Review your appeal</Text>
        <Text style={styles.stepSubtitle}>
          Please confirm the details below before submitting
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Category</Text>
            <View style={styles.summaryValueContainer}>
              <Icon
                name={selectedCategory?.icon}
                size={16}
                color={colors.primary[600]}
              />
              <Text style={styles.summaryValue}>{selectedCategory?.label}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Urgency</Text>
            <View
              style={[
                styles.severityBadge,
                { backgroundColor: selectedSeverity?.color },
              ]}
            >
              <Text style={styles.severityBadgeText}>
                {selectedSeverity?.label}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summarySection}>
            <Text style={styles.summaryLabel}>Description</Text>
            <Text style={styles.summaryDescription}>{description}</Text>
          </View>

          {requestedRelief.trim() && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summarySection}>
                <Text style={styles.summaryLabel}>Requested Relief</Text>
                <Text style={styles.summaryDescription}>{requestedRelief}</Text>
              </View>
            </>
          )}
        </View>

        {/* Financial Impact */}
        {cancellationInfo && (
          <View style={styles.impactCard}>
            <Text style={styles.impactTitle}>Financial Impact</Text>
            {cancellationInfo.willChargeCancellationFee && (
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Cancellation Fee</Text>
                <Text style={styles.impactValue}>
                  ${cancellationInfo.cancellationFee}
                </Text>
              </View>
            )}
            {cancellationInfo.isWithinPenaltyWindow && (
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Refund Withheld</Text>
                <Text style={styles.impactValue}>
                  ${(cancellationInfo.price - cancellationInfo.estimatedRefund).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* SLA Notice */}
        <View style={styles.slaNotice}>
          <Icon name="clock-o" size={18} color={colors.primary[600]} />
          <Text style={styles.slaText}>
            Our team will review your appeal within 48 hours. You'll receive a
            notification once a decision is made.
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="times" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Submit Appeal</Text>
            <View style={styles.closeButton} />
          </View>

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    s <= step && styles.progressDotActive,
                    s < step && styles.progressDotComplete,
                  ]}
                >
                  {s < step ? (
                    <Icon name="check" size={10} color={colors.neutral[0]} />
                  ) : (
                    <Text
                      style={[
                        styles.progressNumber,
                        s <= step && styles.progressNumberActive,
                      ]}
                    >
                      {s}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.progressLabel,
                    s <= step && styles.progressLabelActive,
                  ]}
                >
                  {s === 1 ? "Category" : s === 2 ? "Details" : "Confirm"}
                </Text>
                {s < 3 && (
                  <View
                    style={[
                      styles.progressLine,
                      s < step && styles.progressLineActive,
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {step === 1 && renderCategorySelection()}
            {step === 2 && renderDetailsForm()}
            {step === 3 && renderConfirmation()}
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {step > 1 && (
              <TouchableOpacity
                style={[styles.button, styles.backButton]}
                onPress={() => setStep(step - 1)}
                disabled={loading}
              >
                <Icon name="arrow-left" size={16} color={colors.text.secondary} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            {step < 3 ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.nextButton,
                  !canProceed() && styles.buttonDisabled,
                ]}
                onPress={() => setStep(step + 1)}
                disabled={!canProceed()}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Icon name="arrow-right" size={16} color={colors.neutral[0]} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Icon name="paper-plane" size={16} color={colors.neutral[0]} />
                    <Text style={styles.submitButtonText}>Submit Appeal</Text>
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
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "90%",
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.neutral[50],
  },
  progressStep: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    backgroundColor: colors.primary[500],
  },
  progressDotComplete: {
    backgroundColor: colors.success[500],
  },
  progressNumber: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
  },
  progressNumberActive: {
    color: colors.neutral[0],
  },
  progressLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  progressLabelActive: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  progressLine: {
    width: 30,
    height: 2,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.sm,
  },
  progressLineActive: {
    backgroundColor: colors.success[500],
  },
  content: {
    flex: 1,
    minHeight: 300,
  },
  scrollContent: {
    padding: spacing.lg,
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
  categoriesContainer: {
    gap: spacing.sm,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
    gap: spacing.md,
  },
  categoryCardSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIconSelected: {
    backgroundColor: colors.primary[500],
  },
  categoryText: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  categoryLabelSelected: {
    color: colors.primary[700],
  },
  categoryDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error[500],
  },
  severityContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  severityButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: "center",
  },
  severityLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  severityLabelSelected: {
    color: colors.neutral[0],
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  characterCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  summaryValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.md,
  },
  summarySection: {
    gap: spacing.xs,
  },
  summaryDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  severityBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  severityBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  impactCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  impactTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.md,
  },
  impactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  impactLabel: {
    fontSize: typography.fontSize.base,
    color: colors.warning[800],
  },
  impactValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
  },
  slaNotice: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  slaText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
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
  backButton: {
    backgroundColor: colors.neutral[100],
    flex: 0.4,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  nextButton: {
    backgroundColor: colors.primary[500],
  },
  nextButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  submitButton: {
    backgroundColor: colors.success[500],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default AppealSubmissionModal;
