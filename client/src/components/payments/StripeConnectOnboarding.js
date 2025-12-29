import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { API_BASE } from "../../services/config";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const StripeConnectOnboarding = ({ state, dispatch }) => {
  const [accountStatus, setAccountStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    dobMonth: "",
    dobDay: "",
    dobYear: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    ssnLast4: "",
  });

  const [errors, setErrors] = useState({});

  const fetchAccountStatus = async (showRefreshing = false) => {
    if (!state?.currentUser?.id) {
      console.log("No user ID available");
      return;
    }

    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      console.log("Fetching account status for user:", state.currentUser.id);
      const res = await fetch(
        `${API_BASE}/stripe-connect/account-status/${state.currentUser.id}`
      );
      const data = await res.json();
      console.log("Account status response:", data);

      if (res.ok) {
        setAccountStatus(data);
        // If account exists but not complete, go to step 3 (bank verification)
        if (data.hasAccount && !data.onboardingComplete) {
          setCurrentStep(3);
        }

        if (showRefreshing && data.onboardingComplete) {
          Alert.alert("Success", "Your payment account is now active!");
        }
      } else {
        console.error("Error response:", data);
        if (showRefreshing) {
          Alert.alert("Error", data.error || "Failed to fetch account status");
        }
      }
    } catch (err) {
      console.error("Error fetching account status:", err);
      if (showRefreshing) {
        Alert.alert("Error", "Failed to connect to server. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAccountStatus();
  }, [state?.currentUser?.id]);

  const validateStep1 = () => {
    const newErrors = {};
    const month = parseInt(formData.dobMonth);
    const day = parseInt(formData.dobDay);
    const year = parseInt(formData.dobYear);

    if (!formData.dobMonth || month < 1 || month > 12) {
      newErrors.dobMonth = "Valid month required";
    }
    if (!formData.dobDay || day < 1 || day > 31) {
      newErrors.dobDay = "Valid day required";
    }
    if (!formData.dobYear || year < 1900 || year > new Date().getFullYear() - 18) {
      newErrors.dobYear = "Must be 18 or older";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = "Street address required";
    }
    if (!formData.city.trim()) {
      newErrors.city = "City required";
    }
    if (!formData.state) {
      newErrors.state = "State required";
    }
    if (!formData.postalCode.trim() || !/^\d{5}(-\d{4})?$/.test(formData.postalCode)) {
      newErrors.postalCode = "Valid ZIP code required";
    }
    if (!formData.ssnLast4 || !/^\d{4}$/.test(formData.ssnLast4)) {
      newErrors.ssnLast4 = "Last 4 digits of SSN required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      handleCreateAccount();
    }
  };

  const handleCreateAccount = async () => {
    setIsProcessing(true);
    try {
      const personalInfo = {
        dob: `${formData.dobYear}-${formData.dobMonth.padStart(2, "0")}-${formData.dobDay.padStart(2, "0")}`,
        address: {
          line1: formData.addressLine1,
          line2: formData.addressLine2 || undefined,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        },
        ssn_last_4: formData.ssnLast4,
      };

      const res = await fetch(`${API_BASE}/stripe-connect/create-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.currentUser.token,
          personalInfo,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // If account already exists, just move to step 3
        if (data.code === "ACCOUNT_EXISTS") {
          setCurrentStep(3);
          await fetchAccountStatus();
          return;
        }
        throw new Error(data.error || "Failed to create account");
      }

      // Account created, move to bank account step
      setCurrentStep(3);
      await fetchAccountStatus();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartOnboarding = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.currentUser.token,
          returnUrl: "http://localhost:3000/earnings",
          refreshUrl: "http://localhost:3000/earnings",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate onboarding link");
      }

      // Open Stripe onboarding in browser
      await Linking.openURL(data.url);

      // Refresh status after a delay
      setTimeout(fetchAccountStatus, 3000);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDashboard = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/stripe-connect/dashboard-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: state.currentUser.token }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate dashboard link");
      }

      await Linking.openURL(data.url);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading account status...</Text>
      </View>
    );
  }

  // Already complete - show success state
  if (accountStatus?.onboardingComplete) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.successCard}>
          <View style={styles.successIconContainer}>
            <Icon name="check-circle" size={60} color={colors.success[500]} />
          </View>
          <Text style={styles.successTitle}>You're All Set!</Text>
          <Text style={styles.successText}>
            Your payment account is set up and ready to receive earnings.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How You Get Paid</Text>
          <View style={styles.infoItem}>
            <View style={styles.infoNumberBadge}>
              <Text style={styles.infoNumber}>1</Text>
            </View>
            <Text style={styles.infoItemText}>
              Complete a cleaning job
            </Text>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoNumberBadge}>
              <Text style={styles.infoNumber}>2</Text>
            </View>
            <Text style={styles.infoItemText}>
              Money is deposited directly to your bank (usually 2-3 business days)
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleOpenDashboard}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.primary[600]} />
          ) : (
            <>
              <Icon name="external-link" size={16} color={colors.primary[600]} />
              <Text style={styles.secondaryButtonText}>View Stripe Dashboard</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.refreshButton, isRefreshing && styles.buttonDisabled]}
          onPress={() => fetchAccountStatus(true)}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh Status</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  // Step indicator component
  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepContainer}>
          <View
            style={[
              styles.stepCircle,
              currentStep >= step && styles.stepCircleActive,
              currentStep > step && styles.stepCircleComplete,
            ]}
          >
            {currentStep > step ? (
              <Icon name="check" size={12} color={colors.neutral[0]} />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  currentStep >= step && styles.stepNumberActive,
                ]}
              >
                {step}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              currentStep >= step && styles.stepLabelActive,
            ]}
          >
            {step === 1 ? "Birthday" : step === 2 ? "Address" : "Bank"}
          </Text>
          {step < 3 && (
            <View
              style={[
                styles.stepLine,
                currentStep > step && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  // Render form based on step
  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Icon name="birthday-cake" size={24} color={colors.primary[500]} />
            <Text style={styles.formTitle}>When's your birthday?</Text>
          </View>
          <Text style={styles.formSubtitle}>
            This is required by law to verify your identity for payments.
          </Text>

          <View style={styles.dobContainer}>
            <View style={styles.dobField}>
              <Text style={styles.inputLabel}>Month</Text>
              <TextInput
                style={[styles.input, styles.dobInput, errors.dobMonth && styles.inputError]}
                placeholder="MM"
                keyboardType="number-pad"
                maxLength={2}
                value={formData.dobMonth}
                onChangeText={(v) => setFormData({ ...formData, dobMonth: v })}
              />
              {errors.dobMonth && <Text style={styles.errorText}>{errors.dobMonth}</Text>}
            </View>
            <View style={styles.dobField}>
              <Text style={styles.inputLabel}>Day</Text>
              <TextInput
                style={[styles.input, styles.dobInput, errors.dobDay && styles.inputError]}
                placeholder="DD"
                keyboardType="number-pad"
                maxLength={2}
                value={formData.dobDay}
                onChangeText={(v) => setFormData({ ...formData, dobDay: v })}
              />
              {errors.dobDay && <Text style={styles.errorText}>{errors.dobDay}</Text>}
            </View>
            <View style={styles.dobField}>
              <Text style={styles.inputLabel}>Year</Text>
              <TextInput
                style={[styles.input, styles.dobInput, errors.dobYear && styles.inputError]}
                placeholder="YYYY"
                keyboardType="number-pad"
                maxLength={4}
                value={formData.dobYear}
                onChangeText={(v) => setFormData({ ...formData, dobYear: v })}
              />
              {errors.dobYear && <Text style={styles.errorText}>{errors.dobYear}</Text>}
            </View>
          </View>

          <View style={styles.securityNote}>
            <Icon name="lock" size={14} color={colors.text.tertiary} />
            <Text style={styles.securityNoteText}>
              Your information is encrypted and secure
            </Text>
          </View>
        </View>
      );
    }

    if (currentStep === 2) {
      return (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Icon name="home" size={24} color={colors.primary[500]} />
            <Text style={styles.formTitle}>Your Address</Text>
          </View>
          <Text style={styles.formSubtitle}>
            This must match the address on file with your bank.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Street Address</Text>
            <TextInput
              style={[styles.input, errors.addressLine1 && styles.inputError]}
              placeholder="123 Main St"
              value={formData.addressLine1}
              onChangeText={(v) => setFormData({ ...formData, addressLine1: v })}
            />
            {errors.addressLine1 && <Text style={styles.errorText}>{errors.addressLine1}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Apt, Suite, etc. (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Apt 4B"
              value={formData.addressLine2}
              onChangeText={(v) => setFormData({ ...formData, addressLine2: v })}
            />
          </View>

          <View style={styles.rowGroup}>
            <View style={styles.flexField}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="City"
                value={formData.city}
                onChangeText={(v) => setFormData({ ...formData, city: v })}
              />
              {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
            </View>
            <View style={styles.stateField}>
              <Text style={styles.inputLabel}>State</Text>
              <Pressable
                style={[styles.stateSelector, errors.state && styles.inputError]}
                onPress={() => setShowStateDropdown(!showStateDropdown)}
              >
                <Text style={formData.state ? styles.stateSelectorText : styles.stateSelectorPlaceholder}>
                  {formData.state || "State"}
                </Text>
                <Icon name="chevron-down" size={12} color={colors.text.tertiary} />
              </Pressable>
              {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
              {showStateDropdown && (
                <ScrollView style={styles.stateDropdown}>
                  {US_STATES.map((s) => (
                    <Pressable
                      key={s.value}
                      style={styles.stateOption}
                      onPress={() => {
                        setFormData({ ...formData, state: s.value });
                        setShowStateDropdown(false);
                      }}
                    >
                      <Text style={styles.stateOptionText}>{s.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>

          <View style={styles.rowGroup}>
            <View style={styles.flexField}>
              <Text style={styles.inputLabel}>ZIP Code</Text>
              <TextInput
                style={[styles.input, errors.postalCode && styles.inputError]}
                placeholder="12345"
                keyboardType="number-pad"
                maxLength={10}
                value={formData.postalCode}
                onChangeText={(v) => setFormData({ ...formData, postalCode: v })}
              />
              {errors.postalCode && <Text style={styles.errorText}>{errors.postalCode}</Text>}
            </View>
            <View style={styles.flexField}>
              <Text style={styles.inputLabel}>SSN (last 4 digits)</Text>
              <TextInput
                style={[styles.input, errors.ssnLast4 && styles.inputError]}
                placeholder="1234"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={formData.ssnLast4}
                onChangeText={(v) => setFormData({ ...formData, ssnLast4: v })}
              />
              {errors.ssnLast4 && <Text style={styles.errorText}>{errors.ssnLast4}</Text>}
            </View>
          </View>

          <View style={styles.securityNote}>
            <Icon name="shield" size={14} color={colors.text.tertiary} />
            <Text style={styles.securityNoteText}>
              We only store the last 4 digits of your SSN
            </Text>
          </View>
        </View>
      );
    }

    // Step 3 - Bank account / Pending verification
    const hasPendingRequirements = accountStatus?.requirements?.currentlyDue?.length > 0;
    const detailsSubmitted = accountStatus?.detailsSubmitted;

    return (
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <Icon name="university" size={24} color={colors.primary[500]} />
          <Text style={styles.formTitle}>
            {detailsSubmitted ? "Almost Done!" : "Connect Your Bank"}
          </Text>
        </View>
        <Text style={styles.formSubtitle}>
          {detailsSubmitted
            ? "Your details have been submitted. Complete any remaining requirements to activate your account."
            : "Last step! Connect your bank account to receive direct deposits."}
        </Text>

        {/* Show current status */}
        {accountStatus?.hasAccount && (
          <View style={styles.statusInfo}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Details Submitted:</Text>
              <Icon
                name={detailsSubmitted ? "check-circle" : "times-circle"}
                size={16}
                color={detailsSubmitted ? colors.success[500] : colors.error[500]}
              />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Payouts Enabled:</Text>
              <Icon
                name={accountStatus.payoutsEnabled ? "check-circle" : "times-circle"}
                size={16}
                color={accountStatus.payoutsEnabled ? colors.success[500] : colors.error[500]}
              />
            </View>
            {hasPendingRequirements && (
              <View style={styles.requirementsBox}>
                <Text style={styles.requirementsTitle}>Pending Requirements:</Text>
                {accountStatus.requirements.currentlyDue.map((req, idx) => (
                  <Text key={idx} style={styles.requirementItem}>• {req.replace(/_/g, ' ')}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {!detailsSubmitted && (
          <>
            <View style={styles.bankInfo}>
              <View style={styles.bankInfoItem}>
                <Icon name="check-circle" size={16} color={colors.success[500]} />
                <Text style={styles.bankInfoText}>Secure connection via Stripe</Text>
              </View>
              <View style={styles.bankInfoItem}>
                <Icon name="check-circle" size={16} color={colors.success[500]} />
                <Text style={styles.bankInfoText}>Deposits in 2-3 business days</Text>
              </View>
              <View style={styles.bankInfoItem}>
                <Icon name="check-circle" size={16} color={colors.success[500]} />
                <Text style={styles.bankInfoText}>No fees to receive payments</Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <Icon name="lightbulb-o" size={20} color={colors.warning[600]} />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Have This Ready</Text>
                <Text style={styles.tipText}>
                  Your bank routing number and account number (found on a check or in your bank app)
                </Text>
              </View>
            </View>
          </>
        )}

        <Pressable
          style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleStartOnboarding}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.neutral[0]} />
          ) : (
            <>
              <Icon name="bank" size={16} color={colors.neutral[0]} />
              <Text style={styles.primaryButtonText}>
                {detailsSubmitted ? "Complete Requirements" : "Connect Bank Account"}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.stripeNote}>
          You'll be taken to Stripe to {detailsSubmitted ? "complete verification" : "securely enter your bank details"}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepIndicator />
      {renderStepContent()}

      {currentStep < 3 && (
        <View style={styles.buttonContainer}>
          {currentStep > 1 && (
            <Pressable
              style={styles.backButton}
              onPress={() => setCurrentStep(currentStep - 1)}
            >
              <Icon name="arrow-left" size={16} color={colors.text.secondary} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.primaryButton, styles.continueButton, isProcessing && styles.buttonDisabled]}
            onPress={handleNextStep}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.neutral[0]} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {currentStep === 2 ? "Continue to Bank" : "Continue"}
                </Text>
                <Icon name="arrow-right" size={16} color={colors.neutral[0]} />
              </>
            )}
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.refreshButton, isRefreshing && styles.buttonDisabled]}
        onPress={() => fetchAccountStatus(true)}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.primary[600]} />
        ) : (
          <Text style={styles.refreshButtonText}>Refresh Status</Text>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = {
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: colors.primary[500],
  },
  stepCircleComplete: {
    backgroundColor: colors.success[500],
  },
  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
  },
  stepNumberActive: {
    color: colors.neutral[0],
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
    marginRight: spacing.sm,
  },
  stepLabelActive: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.neutral[200],
    marginRight: spacing.sm,
  },
  stepLineActive: {
    backgroundColor: colors.success[500],
  },

  // Form Card
  formCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  formTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  formSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },

  // Form Fields
  formGroup: {
    marginBottom: spacing.md,
  },
  rowGroup: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  flexField: {
    flex: 1,
  },
  stateField: {
    width: 100,
    position: "relative",
    zIndex: 100,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.error[500],
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[500],
    marginTop: 4,
  },

  // DOB Fields
  dobContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dobField: {
    flex: 1,
  },
  dobInput: {
    textAlign: "center",
  },

  // State Selector
  stateSelector: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stateSelectorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  stateSelectorPlaceholder: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  stateDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    maxHeight: 200,
    ...shadows.lg,
    zIndex: 1000,
  },
  stateOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  stateOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },

  // Security Note
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  securityNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Status Info
  statusInfo: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  requirementsBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  requirementsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.xs,
  },
  requirementItem: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    lineHeight: 18,
  },

  // Bank Info
  bankInfo: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  bankInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bankInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // Tip Card
  tipCard: {
    flexDirection: "row",
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: 2,
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 18,
  },

  stripeNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.md,
  },

  // Buttons
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  continueButton: {
    flex: 1,
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary[500],
    gap: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  backButtonText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.base,
  },
  refreshButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  refreshButtonText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Success State
  successCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.md,
    marginBottom: spacing.lg,
  },
  successIconContainer: {
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
    color: colors.text.primary,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
  },
  infoNumber: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.sm,
  },
  infoItemText: {
    flex: 1,
    color: colors.text.secondary,
    lineHeight: 20,
  },
};

export default StripeConnectOnboarding;
