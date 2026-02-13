import React, { useState, useMemo } from "react";
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
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";
import { usePricing } from "../../context/PricingContext";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "on_demand", label: "On Demand" },
];

const InviteClientModal = ({ visible, onClose, onSuccess, token }) => {
  const { pricing } = usePricing();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipcode: "",
    beds: "",
    baths: "",
    frequency: "",
    price: "",
    notes: "",
  });

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Calculate platform price based on beds/baths
  const platformPrice = useMemo(() => {
    if (!formData.beds || !formData.baths) return null;
    if (!pricing?.basePrice) return null;

    const numBeds = parseInt(formData.beds) || 1;
    const numBaths = parseFloat(formData.baths) || 1;

    const basePrice = pricing.basePrice || 150;
    const extraBedBathFee = pricing.extraBedBathFee || 50;
    const halfBathFee = pricing.halfBathFee || 25;

    const extraBeds = Math.max(0, numBeds - 1);
    const fullBaths = Math.floor(numBaths);
    const halfBaths = numBaths % 1 >= 0.5 ? 1 : 0;
    const extraFullBaths = Math.max(0, fullBaths - 1);

    return basePrice +
           (extraBeds * extraBedBathFee) +
           (extraFullBaths * extraBedBathFee) +
           (halfBaths * halfBathFee);
  }, [formData.beds, formData.baths, pricing]);

  const handleUsePlatformPrice = () => {
    if (platformPrice) {
      updateField("price", platformPrice.toString());
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    // Step 2 is optional, no required fields
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const clientData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        address: formData.address
          ? {
              address: formData.address.trim(),
              city: formData.city.trim(),
              state: formData.state.trim(),
              zipcode: formData.zipcode.trim(),
            }
          : null,
        beds: formData.beds ? parseInt(formData.beds) : null,
        baths: formData.baths ? parseFloat(formData.baths) : null,
        frequency: formData.frequency || null,
        price: formData.price ? parseFloat(formData.price) : null,
        notes: formData.notes.trim() || null,
      };

      const result = await CleanerClientService.inviteClient(token, clientData);

      if (result.success) {
        Alert.alert(
          "Invitation Sent!",
          `An invitation has been sent to ${formData.name}. They'll receive an email to set up their account.`,
          [{ text: "OK", onPress: () => onSuccess() }]
        );
        resetForm();
      } else {
        Alert.alert("Error", result.error || "Failed to send invitation");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send invitation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipcode: "",
      beds: "",
      baths: "",
      frequency: "",
      price: "",
      notes: "",
    });
    setStep(1);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Feather name="user" size={24} color={colors.primary[600]} />
        </View>
        <Text style={styles.stepTitle}>Client Information</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Enter your client&apos;s contact details to send them an invitation.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="John Smith"
          placeholderTextColor={colors.neutral[400]}
          value={formData.name}
          onChangeText={(v) => updateField("name", v)}
          autoCapitalize="words"
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="john@example.com"
          placeholderTextColor={colors.neutral[400]}
          value={formData.email}
          onChangeText={(v) => updateField("email", v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone Number (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="(555) 123-4567"
          placeholderTextColor={colors.neutral[400]}
          value={formData.phone}
          onChangeText={(v) => updateField("phone", v)}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Feather name="home" size={24} color={colors.primary[600]} />
        </View>
        <Text style={styles.stepTitle}>Home Details</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Add their home information (optional - they can update this later).
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Street Address</Text>
        <TextInput
          style={styles.input}
          placeholder="123 Main St"
          placeholderTextColor={colors.neutral[400]}
          value={formData.address}
          onChangeText={(v) => updateField("address", v)}
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 2 }]}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            placeholderTextColor={colors.neutral[400]}
            value={formData.city}
            onChangeText={(v) => updateField("city", v)}
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>State</Text>
          <TextInput
            style={styles.input}
            placeholder="ST"
            placeholderTextColor={colors.neutral[400]}
            value={formData.state}
            onChangeText={(v) => updateField("state", v.toUpperCase())}
            maxLength={2}
          />
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>ZIP Code</Text>
          <TextInput
            style={styles.input}
            placeholder="12345"
            placeholderTextColor={colors.neutral[400]}
            value={formData.zipcode}
            onChangeText={(v) => updateField("zipcode", v)}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Beds</Text>
          <TextInput
            style={styles.input}
            placeholder="3"
            placeholderTextColor={colors.neutral[400]}
            value={formData.beds}
            onChangeText={(v) => updateField("beds", v)}
            keyboardType="number-pad"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Baths</Text>
          <TextInput
            style={styles.input}
            placeholder="2"
            placeholderTextColor={colors.neutral[400]}
            value={formData.baths}
            onChangeText={(v) => updateField("baths", v)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Feather name="calendar" size={24} color={colors.primary[600]} />
        </View>
        <Text style={styles.stepTitle}>Scheduling & Pricing</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Set their typical cleaning schedule and price (optional).
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Cleaning Frequency</Text>
        <View style={styles.frequencyOptions}>
          {FREQUENCY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.frequencyOption,
                formData.frequency === option.value && styles.frequencyOptionActive,
              ]}
              onPress={() => updateField("frequency", option.value)}
            >
              <Text
                style={[
                  styles.frequencyOptionText,
                  formData.frequency === option.value && styles.frequencyOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Price per Cleaning</Text>

        {/* Platform Price Suggestion */}
        {platformPrice ? (
          <View style={styles.platformPriceSuggestion}>
            <View style={styles.platformPriceInfo}>
              <Feather name="trending-up" size={16} color={colors.primary[600]} />
              <Text style={styles.platformPriceText}>
                Platform suggestion: <Text style={styles.platformPriceAmount}>${platformPrice}</Text>
              </Text>
              <Text style={styles.platformPriceContext}>
                ({formData.beds} bed, {formData.baths} bath)
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.usePlatformButton,
                pressed && styles.usePlatformButtonPressed,
              ]}
              onPress={handleUsePlatformPrice}
            >
              <Text style={styles.usePlatformButtonText}>Use This Price</Text>
            </Pressable>
          </View>
        ) : formData.beds || formData.baths ? null : (
          <View style={styles.platformPriceHint}>
            <Feather name="info" size={14} color={colors.neutral[400]} />
            <Text style={styles.platformPriceHintText}>
              Add beds/baths in Step 2 for price suggestion
            </Text>
          </View>
        )}

        <View style={styles.priceInputContainer}>
          <Text style={styles.pricePrefix}>$</Text>
          <TextInput
            style={[styles.input, styles.priceInput]}
            placeholder="150"
            placeholderTextColor={colors.neutral[400]}
            value={formData.price}
            onChangeText={(v) => updateField("price", v)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes about this client</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any special instructions, key codes, pet information, etc."
          placeholderTextColor={colors.neutral[400]}
          value={formData.notes}
          onChangeText={(v) => updateField("notes", v)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Invitation Summary</Text>
        <View style={styles.summaryRow}>
          <Feather name="user" size={14} color={colors.neutral[400]} />
          <Text style={styles.summaryText}>{formData.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Feather name="mail" size={14} color={colors.neutral[400]} />
          <Text style={styles.summaryText}>{formData.email}</Text>
        </View>
        {formData.address && (
          <View style={styles.summaryRow}>
            <Feather name="home" size={14} color={colors.neutral[400]} />
            <Text style={styles.summaryText}>
              {formData.address}, {formData.city}
            </Text>
          </View>
        )}
        {formData.frequency && (
          <View style={styles.summaryRow}>
            <Feather name="calendar" size={14} color={colors.neutral[400]} />
            <Text style={styles.summaryText}>
              {FREQUENCY_OPTIONS.find((f) => f.value === formData.frequency)?.label}
              {formData.price && ` - $${formData.price}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Client</Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Feather name="x" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={styles.stepDotContainer}>
                <View
                  style={[
                    styles.stepDot,
                    step >= s && styles.stepDotActive,
                    step > s && styles.stepDotComplete,
                  ]}
                >
                  {step > s ? (
                    <Feather name="check" size={12} color={colors.neutral[0]} />
                  ) : (
                    <Text
                      style={[
                        styles.stepDotText,
                        step >= s && styles.stepDotTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  )}
                </View>
                {s < 3 && (
                  <View
                    style={[
                      styles.stepLine,
                      step > s && styles.stepLineActive,
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            {step > 1 && (
              <Pressable
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
                onPress={handleBack}
              >
                <Feather name="arrow-left" size={18} color={colors.text.secondary} />
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                step === 1 && styles.primaryButtonFull,
                pressed && styles.primaryButtonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={step === 3 ? handleSubmit : handleNext}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral[0]} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {step === 3 ? "Send Invitation" : "Continue"}
                  </Text>
                  <Feather
                    name={step === 3 ? "send" : "arrow-right"}
                    size={18}
                    color={colors.neutral[0]}
                  />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    minHeight: "70%",
    maxHeight: "90%",
    ...shadows.xl,
  },

  // Header
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  stepDotContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: colors.primary[600],
  },
  stepDotComplete: {
    backgroundColor: colors.success[500],
  },
  stepDotText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[400],
  },
  stepDotTextActive: {
    color: colors.neutral[0],
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.xs,
    borderRadius: radius.full,
  },
  stepLineActive: {
    backgroundColor: colors.success[500],
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },

  // Step Content
  stepContent: {},
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  // Form
  formGroup: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[500],
    marginTop: spacing.xs,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },

  // Price Input
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  pricePrefix: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  priceInput: {
    flex: 1,
  },

  // Platform Price Suggestion
  platformPriceSuggestion: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  platformPriceInfo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  platformPriceText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
  },
  platformPriceAmount: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  platformPriceContext: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[500],
  },
  usePlatformButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  usePlatformButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  usePlatformButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  platformPriceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  platformPriceHintText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    fontStyle: "italic",
  },

  // Frequency Options
  frequencyOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  frequencyOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  frequencyOptionActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  frequencyOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  frequencyOptionTextActive: {
    color: colors.neutral[0],
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  summaryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },

  // Footer
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.lg,
  },
  backButtonPressed: {
    backgroundColor: colors.neutral[100],
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  primaryButtonFull: {
    flex: 1,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  primaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default InviteClientModal;
