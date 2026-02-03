import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
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
  const [showUpdateBank, setShowUpdateBank] = useState(false);
  const [newBankData, setNewBankData] = useState({
    routingNumber: "",
    accountNumber: "",
    confirmAccountNumber: "",
  });
  const [showNewAccountNumber, setShowNewAccountNumber] = useState(false);

  const [formData, setFormData] = useState({
    dobMonth: "",
    dobDay: "",
    dobYear: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    stripeTermsAccepted: false,
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
    if (!formData.stripeTermsAccepted) {
      newErrors.stripeTermsAccepted = "You must agree to the Stripe Connected Account Agreement";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      handleCompleteSetup();
    }
  };

  const handleCompleteSetup = async () => {
    setIsProcessing(true);
    try {
      const setupData = {
        token: state.currentUser.token,
        personalInfo: {
          dob: `${formData.dobYear}-${formData.dobMonth.padStart(2, "0")}-${formData.dobDay.padStart(2, "0")}`,
          address: {
            line1: formData.addressLine1,
            line2: formData.addressLine2 || undefined,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
          },
        },
        tosAcceptance: {
          accepted: formData.stripeTermsAccepted,
          date: Math.floor(Date.now() / 1000),
        },
      };

      const res = await fetch(`${API_BASE}/stripe-connect/complete-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setupData),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to complete setup");
      }

      // If already complete, just show success
      if (data.onboardingComplete) {
        await fetchAccountStatus(true);
        Alert.alert(
          "Setup Complete!",
          "Your payment account is now active. You can start receiving payments.",
          [{ text: "OK" }]
        );
        return;
      }

      // Open Stripe's hosted onboarding in browser
      if (data.onboardingUrl) {
        Alert.alert(
          "Continue Setup",
          "You'll be redirected to Stripe to verify your identity and add your bank account. This only takes a few minutes.",
          [
            {
              text: "Continue",
              onPress: async () => {
                try {
                  await WebBrowser.openBrowserAsync(data.onboardingUrl);
                  // After returning from browser, refresh status
                  await fetchAccountStatus(true);
                } catch (browserErr) {
                  // Fallback to Linking if WebBrowser fails
                  await Linking.openURL(data.onboardingUrl);
                }
              },
            },
          ]
        );
      }
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

  const handleUpdateBankAccount = async () => {
    // Validate
    const routingDigits = newBankData.routingNumber.replace(/\D/g, "");
    const accountDigits = newBankData.accountNumber.replace(/\D/g, "");

    if (routingDigits.length !== 9) {
      Alert.alert("Error", "Please enter a valid 9-digit routing number");
      return;
    }

    if (accountDigits.length < 4 || accountDigits.length > 17) {
      Alert.alert("Error", "Please enter a valid account number");
      return;
    }

    if (newBankData.accountNumber !== newBankData.confirmAccountNumber) {
      Alert.alert("Error", "Account numbers do not match");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/stripe-connect/update-bank-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.currentUser.token,
          bankAccount: {
            routingNumber: routingDigits,
            accountNumber: accountDigits,
          },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update bank account");
      }

      Alert.alert(
        "Bank Account Updated",
        `Your new bank account ending in ${data.bankAccountLast4} has been added.`,
        [{ text: "OK" }]
      );

      // Reset form and hide it
      setNewBankData({ routingNumber: "", accountNumber: "", confirmAccountNumber: "" });
      setShowUpdateBank(false);
      setShowNewAccountNumber(false);

      // Refresh status
      await fetchAccountStatus(true);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
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
            <Feather name="check-circle" size={60} color={colors.success[500]} />
          </View>
          <Text style={styles.successTitle}>You're All Set!</Text>
          <Text style={styles.successText}>
            Your payment account is set up and ready to receive earnings.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Feather name="dollar-sign" size={20} color={colors.primary[600]} />
            <Text style={styles.infoTitle}>How You Get Paid</Text>
          </View>
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

        {/* Update Bank Account Section */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Feather name="credit-card" size={20} color={colors.primary[600]} />
            <Text style={styles.infoTitle}>Bank Account</Text>
          </View>

          {/* Security Notice */}
          <View style={styles.bankSecurityNotice}>
            <Feather name="shield" size={16} color={colors.success[600]} />
            <Text style={styles.bankSecurityText}>
              Your banking information is sent directly to Stripe and is never stored on our servers.
            </Text>
          </View>

          {!showUpdateBank ? (
            <Pressable
              style={({ pressed }) => [
                styles.updateBankButton,
                pressed && styles.updateBankButtonPressed,
              ]}
              onPress={() => setShowUpdateBank(true)}
            >
              <Feather name="edit-2" size={16} color={colors.primary[600]} />
              <Text style={styles.updateBankButtonText}>Change Bank Account</Text>
            </Pressable>
          ) : (
            <View style={styles.updateBankForm}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Routing Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="9 digits"
                  placeholderTextColor={colors.neutral[400]}
                  keyboardType="number-pad"
                  maxLength={9}
                  value={newBankData.routingNumber}
                  onChangeText={(v) => setNewBankData({ ...newBankData, routingNumber: v.replace(/\D/g, "") })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Account Number</Text>
                <View style={styles.inputWithToggle}>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="Your bank account number"
                    placeholderTextColor={colors.neutral[400]}
                    keyboardType="number-pad"
                    maxLength={17}
                    secureTextEntry={!showNewAccountNumber}
                    value={newBankData.accountNumber}
                    onChangeText={(v) => setNewBankData({ ...newBankData, accountNumber: v.replace(/\D/g, "") })}
                  />
                  <Pressable
                    style={styles.visibilityToggle}
                    onPress={() => setShowNewAccountNumber(!showNewAccountNumber)}
                  >
                    <Feather
                      name={showNewAccountNumber ? "eye-off" : "eye"}
                      size={20}
                      color={colors.neutral[500]}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Confirm Account Number</Text>
                <View style={styles.inputWithToggle}>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="Re-enter account number"
                    placeholderTextColor={colors.neutral[400]}
                    keyboardType="number-pad"
                    maxLength={17}
                    secureTextEntry={!showNewAccountNumber}
                    value={newBankData.confirmAccountNumber}
                    onChangeText={(v) => setNewBankData({ ...newBankData, confirmAccountNumber: v.replace(/\D/g, "") })}
                  />
                  <Pressable
                    style={styles.visibilityToggle}
                    onPress={() => setShowNewAccountNumber(!showNewAccountNumber)}
                  >
                    <Feather
                      name={showNewAccountNumber ? "eye-off" : "eye"}
                      size={20}
                      color={colors.neutral[500]}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.updateBankButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.cancelButtonPressed,
                  ]}
                  onPress={() => {
                    setShowUpdateBank(false);
                    setNewBankData({ routingNumber: "", accountNumber: "", confirmAccountNumber: "" });
                    setShowNewAccountNumber(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.saveButtonPressed,
                    isProcessing && styles.buttonDisabled,
                  ]}
                  onPress={handleUpdateBankAccount}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={colors.neutral[0]} size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
            isProcessing && styles.buttonDisabled,
          ]}
          onPress={handleOpenDashboard}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.primary[600]} />
          ) : (
            <>
              <Feather name="external-link" size={18} color={colors.primary[600]} />
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
            <>
              <Feather name="refresh-cw" size={14} color={colors.primary[600]} />
              <Text style={styles.refreshButtonText}>Refresh Status</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  // Step indicator component
  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2].map((step) => (
        <View key={step} style={styles.stepContainer}>
          <View
            style={[
              styles.stepCircle,
              currentStep >= step && styles.stepCircleActive,
              currentStep > step && styles.stepCircleComplete,
            ]}
          >
            {currentStep > step ? (
              <Feather name="check" size={14} color={colors.neutral[0]} />
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
            {step === 1 ? "Birthday" : "Address"}
          </Text>
          {step < 2 && (
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
            <View style={styles.formIconContainer}>
              <Feather name="gift" size={24} color={colors.primary[600]} />
            </View>
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
                placeholderTextColor={colors.neutral[400]}
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
                placeholderTextColor={colors.neutral[400]}
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
                placeholderTextColor={colors.neutral[400]}
                keyboardType="number-pad"
                maxLength={4}
                value={formData.dobYear}
                onChangeText={(v) => setFormData({ ...formData, dobYear: v })}
              />
              {errors.dobYear && <Text style={styles.errorText}>{errors.dobYear}</Text>}
            </View>
          </View>

          <View style={styles.securityNote}>
            <Feather name="lock" size={14} color={colors.neutral[400]} />
            <Text style={styles.securityNoteText}>
              Your information is encrypted and secure
            </Text>
          </View>
        </View>
      );
    }

    // Step 2 - Address and Stripe consent
    return (
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <View style={styles.formIconContainer}>
            <Feather name="home" size={24} color={colors.primary[600]} />
          </View>
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
            placeholderTextColor={colors.neutral[400]}
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
            placeholderTextColor={colors.neutral[400]}
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
              placeholderTextColor={colors.neutral[400]}
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
              <Feather name="chevron-down" size={14} color={colors.neutral[400]} />
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

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>ZIP Code</Text>
          <TextInput
            style={[styles.input, errors.postalCode && styles.inputError]}
            placeholder="12345"
            placeholderTextColor={colors.neutral[400]}
            keyboardType="number-pad"
            maxLength={10}
            value={formData.postalCode}
            onChangeText={(v) => setFormData({ ...formData, postalCode: v })}
          />
          {errors.postalCode && <Text style={styles.errorText}>{errors.postalCode}</Text>}
        </View>

        {/* Stripe Connected Account Agreement */}
        <View style={styles.stripeConsentContainer}>
          <Pressable
            style={styles.stripeConsentRow}
            onPress={() => setFormData({ ...formData, stripeTermsAccepted: !formData.stripeTermsAccepted })}
          >
            <View style={[
              styles.checkbox,
              formData.stripeTermsAccepted && styles.checkboxChecked,
              errors.stripeTermsAccepted && styles.checkboxError,
            ]}>
              {formData.stripeTermsAccepted && (
                <Feather name="check" size={14} color={colors.neutral[0]} />
              )}
            </View>
            <Text style={styles.stripeConsentText}>
              I agree to the{" "}
              <Text
                style={styles.stripeConsentLink}
                onPress={() => Linking.openURL("https://stripe.com/legal/connect-account")}
              >
                Stripe Connected Account Agreement
              </Text>
              {" "}and authorize Stripe to act as my payment processor.
            </Text>
          </Pressable>
          {errors.stripeTermsAccepted && (
            <Text style={styles.errorText}>{errors.stripeTermsAccepted}</Text>
          )}
        </View>

        <View style={styles.nextStepsInfo}>
          <Feather name="info" size={16} color={colors.primary[600]} />
          <Text style={styles.nextStepsText}>
            After submitting, you'll be taken to Stripe to verify your identity and add your bank account.
          </Text>
        </View>

        <View style={styles.securityNote}>
          <Feather name="lock" size={14} color={colors.neutral[400]} />
          <Text style={styles.securityNoteText}>
            Your information is encrypted and secure
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepIndicator />
      {renderStepContent()}

      <View style={styles.buttonContainer}>
        {currentStep > 1 && (
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Feather name="arrow-left" size={18} color={colors.text.secondary} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            styles.continueButton,
            pressed && styles.primaryButtonPressed,
            isProcessing && styles.buttonDisabled,
          ]}
          onPress={handleNextStep}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.neutral[0]} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {currentStep === 2 ? "Continue to Stripe" : "Continue"}
              </Text>
              <Feather
                name={currentStep === 2 ? "external-link" : "arrow-right"}
                size={18}
                color={colors.neutral[0]}
              />
            </>
          )}
        </Pressable>
      </View>

      <Pressable
        style={[styles.refreshButton, isRefreshing && styles.buttonDisabled]}
        onPress={() => fetchAccountStatus(true)}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.primary[600]} />
        ) : (
          <>
            <Feather name="refresh-cw" size={14} color={colors.primary[600]} />
            <Text style={styles.refreshButtonText}>Refresh Status</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    backgroundColor: colors.neutral[100],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: colors.primary[600],
  },
  stepCircleComplete: {
    backgroundColor: colors.success[500],
  },
  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[400],
  },
  stepNumberActive: {
    color: colors.neutral[0],
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    marginLeft: spacing.xs,
    marginRight: spacing.sm,
  },
  stepLabelActive: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  stepLine: {
    width: 24,
    height: 3,
    backgroundColor: colors.neutral[200],
    marginRight: spacing.sm,
    borderRadius: radius.full,
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
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  formIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
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
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  // Form Fields
  formGroup: {
    marginBottom: spacing.md,
    zIndex: 1,
  },
  rowGroup: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    zIndex: 10,
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
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputWithToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  visibilityToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    color: colors.neutral[400],
  },
  stateDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    maxHeight: 250,
    marginTop: spacing.xs,
    ...shadows.lg,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  stateOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  stateOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },

  // Security Note
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  securityNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    flex: 1,
  },

  // Next Steps Info
  nextStepsInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  nextStepsText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: typography.fontSize.sm * 1.4,
  },

  // Stripe Consent
  stripeConsentContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  stripeConsentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  checkboxError: {
    borderColor: colors.error[500],
  },
  stripeConsentText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: typography.fontSize.sm * 1.5,
  },
  stripeConsentLink: {
    color: colors.primary[600],
    textDecorationLine: "underline",
  },

  // Bank Info
  bankInfo: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  bankInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bankInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },

  // Tip Card
  tipCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
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
    ...shadows.md,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primary[700],
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
    ...shadows.sm,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.primary[50],
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
    borderRadius: radius.lg,
  },
  backButtonPressed: {
    backgroundColor: colors.neutral[100],
  },
  backButtonText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.base,
  },
  refreshButton: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  refreshButtonText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
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
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.success[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
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
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  infoNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
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
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    fontSize: typography.fontSize.sm,
  },

  // Bank Security Notice
  bankSecurityNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  bankSecurityText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    lineHeight: typography.fontSize.sm * 1.4,
  },

  // Update Bank Account
  updateBankButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  updateBankButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  updateBankButtonText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  updateBankForm: {
    marginTop: spacing.sm,
  },
  updateBankButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  cancelButtonPressed: {
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  saveButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
  },
  saveButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  saveButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
});

export default StripeConnectOnboarding;
