import React, { useState, useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { AuthContext } from "../../services/AuthContext";
import { API_BASE } from "../../services/config";
import AnalyticsService from "../../services/AnalyticsService";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const baseURL = API_BASE.replace("/api/v1", "");

const BusinessSignupWizard = ({ dispatch }) => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    yearsInBusiness: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isCompletedRef = useRef(false);

  const STEP_NAMES = ["account_info", "business_info"];
  const TOTAL_STEPS = 2;

  // Track flow start and abandonment
  useEffect(() => {
    AnalyticsService.trackFlowStart("business_signup");
    return () => {
      if (!isCompletedRef.current) {
        AnalyticsService.trackFlowAbandon(
          "business_signup",
          STEP_NAMES[step - 1],
          step,
          TOTAL_STEPS
        );
      }
    };
  }, []);

  // Track step changes
  useEffect(() => {
    if (step > 1) {
      AnalyticsService.trackFlowStep(
        "business_signup",
        STEP_NAMES[step - 1],
        step,
        TOTAL_STEPS
      );
    }
  }, [step]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
    return phoneRegex.test(phone);
  };

  const formatPhoneNumber = (text) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // Limit to 10 digits
    const limited = cleaned.slice(0, 10);

    // Format as 555-555-5555
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

  const getPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;
    return strength;
  };

  const getStrengthLabel = (strength) => {
    switch (strength) {
      case 0:
      case 1:
        return { label: "Weak", style: styles.strengthWeak };
      case 2:
        return { label: "Fair", style: styles.strengthFair };
      case 3:
        return { label: "Good", style: styles.strengthGood };
      case 4:
        return { label: "Strong", style: styles.strengthStrong };
      default:
        return { label: "", style: {} };
    }
  };

  const validateStep1 = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.username) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 4) {
      newErrors.username = "Username must be at least 4 characters";
    } else if (formData.username.length > 12) {
      newErrors.username = "Username must be 12 characters or less";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (getPasswordStrength(formData.password) < 3) {
      newErrors.password =
        "Password needs uppercase, lowercase, numbers, and special characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      // Create a business owner account
      const response = await fetch(baseURL + "/api/v1/users/business-owner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          password: formData.password,
          email: formData.email,
          phone: formData.phone,
          businessName: formData.businessName,
          yearsInBusiness: formData.yearsInBusiness,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ submit: "An account already has this email" });
        } else if (response.status === 410) {
          setErrors({ submit: "Username already exists" });
        } else {
          setErrors({ submit: responseData.error || "Failed to create account" });
        }
        return;
      }

      // Track signup completion
      isCompletedRef.current = true;
      AnalyticsService.trackFlowComplete("business_signup");

      // Login and set user state
      dispatch({ type: "CURRENT_USER", payload: responseData.token });
      dispatch({ type: "USER_ACCOUNT", payload: "cleaner" });
      dispatch({
        type: "SET_BUSINESS_OWNER_INFO",
        payload: {
          isBusinessOwner: true,
          businessName: formData.businessName || null,
          yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : null,
        },
      });
      login(responseData.token);

      // Navigate to my clients page to start adding clients
      navigate("/my-clients");
    } catch (error) {
      console.error("Error creating business account:", error);
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthInfo = getStrengthLabel(passwordStrength);

  const renderStep1 = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Feather name="user" size={24} color={colors.primary[600]} />
        </View>
        <Text style={styles.stepTitle}>Your Information</Text>
        <Text style={styles.stepSubtitle}>
          Tell us about yourself so we can set up your business account
        </Text>
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.inputLabel}>
            First Name <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "firstName" && styles.inputFocused,
              errors.firstName && styles.inputError,
            ]}
            placeholder="First name"
            placeholderTextColor="#94a3b8"
            value={formData.firstName}
            onChangeText={(text) =>
              setFormData({ ...formData, firstName: text })
            }
            onFocus={() => setFocusedField("firstName")}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="words"
          />
          {errors.firstName && (
            <Text style={styles.errorText}>{errors.firstName}</Text>
          )}
        </View>

        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.inputLabel}>
            Last Name <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "lastName" && styles.inputFocused,
              errors.lastName && styles.inputError,
            ]}
            placeholder="Last name"
            placeholderTextColor="#94a3b8"
            value={formData.lastName}
            onChangeText={(text) =>
              setFormData({ ...formData, lastName: text })
            }
            onFocus={() => setFocusedField("lastName")}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="words"
          />
          {errors.lastName && (
            <Text style={styles.errorText}>{errors.lastName}</Text>
          )}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Email <Text style={styles.inputRequired}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "email" && styles.inputFocused,
            errors.email && styles.inputError,
          ]}
          placeholder="your@email.com"
          placeholderTextColor="#94a3b8"
          value={formData.email}
          onChangeText={(text) =>
            setFormData({ ...formData, email: text })
          }
          onFocus={() => setFocusedField("email")}
          onBlur={() => setFocusedField(null)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errors.email && (
          <Text style={styles.errorText}>{errors.email}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone Number</Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "phone" && styles.inputFocused,
            errors.phone && styles.inputError,
          ]}
          placeholder="555-555-5555"
          placeholderTextColor="#94a3b8"
          value={formData.phone}
          onChangeText={(text) =>
            setFormData({ ...formData, phone: formatPhoneNumber(text) })
          }
          onFocus={() => setFocusedField("phone")}
          onBlur={() => setFocusedField(null)}
          keyboardType="phone-pad"
          maxLength={12}
        />
        {errors.phone && (
          <Text style={styles.errorText}>{errors.phone}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Name</Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "businessName" && styles.inputFocused,
          ]}
          placeholder="e.g., Sparkle Clean Services"
          placeholderTextColor="#94a3b8"
          value={formData.businessName}
          onChangeText={(text) =>
            setFormData({ ...formData, businessName: text })
          }
          onFocus={() => setFocusedField("businessName")}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="words"
        />
        <Text style={styles.helperText}>
          Optional - shown to your clients
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Years in Business</Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "yearsInBusiness" && styles.inputFocused,
          ]}
          placeholder="e.g., 5"
          placeholderTextColor="#94a3b8"
          value={formData.yearsInBusiness}
          onChangeText={(text) =>
            setFormData({ ...formData, yearsInBusiness: text })
          }
          onFocus={() => setFocusedField("yearsInBusiness")}
          onBlur={() => setFocusedField(null)}
          keyboardType="numeric"
        />
        <Text style={styles.helperText}>
          Optional - helps build trust with clients
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleNext}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
        <Feather name="arrow-right" size={20} color={colors.neutral[0]} />
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Feather name="lock" size={24} color={colors.primary[600]} />
        </View>
        <Text style={styles.stepTitle}>Create Your Login</Text>
        <Text style={styles.stepSubtitle}>
          Choose a username and password to secure your account
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Username <Text style={styles.inputRequired}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "username" && styles.inputFocused,
            errors.username && styles.inputError,
          ]}
          placeholder="Choose a username"
          placeholderTextColor="#94a3b8"
          value={formData.username}
          onChangeText={(text) =>
            setFormData({ ...formData, username: text })
          }
          onFocus={() => setFocusedField("username")}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helperText}>4-12 characters</Text>
        {errors.username && (
          <Text style={styles.errorText}>{errors.username}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Password <Text style={styles.inputRequired}>*</Text>
        </Text>
        <View
          style={[
            styles.passwordContainer,
            focusedField === "password" && styles.passwordContainerFocused,
            errors.password && styles.passwordContainerError,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            placeholder="Create a strong password"
            placeholderTextColor="#94a3b8"
            value={formData.password}
            onChangeText={(text) =>
              setFormData({ ...formData, password: text })
            }
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            textContentType="oneTimeCode"
            autoComplete="off"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
        {formData.password && (
          <View style={styles.passwordStrength}>
            <View style={styles.strengthBar}>
              <View style={[styles.strengthFill, strengthInfo.style]} />
            </View>
            <Text style={styles.strengthText}>
              Password strength: {strengthInfo.label}
            </Text>
          </View>
        )}
        {errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Confirm Password <Text style={styles.inputRequired}>*</Text>
        </Text>
        <View
          style={[
            styles.passwordContainer,
            focusedField === "confirmPassword" && styles.passwordContainerFocused,
            errors.confirmPassword && styles.passwordContainerError,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm your password"
            placeholderTextColor="#94a3b8"
            value={formData.confirmPassword}
            onChangeText={(text) =>
              setFormData({ ...formData, confirmPassword: text })
            }
            onFocus={() => setFocusedField("confirmPassword")}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showConfirmPassword}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            textContentType="oneTimeCode"
            autoComplete="off"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Feather
              name={showConfirmPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
        {errors.confirmPassword && (
          <Text style={styles.errorText}>{errors.confirmPassword}</Text>
        )}
      </View>

      {errors.submit && (
        <View style={styles.submitErrorContainer}>
          <Text style={styles.submitErrorText}>{errors.submit}</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleBack}
        >
          <Feather name="arrow-left" size={20} color={colors.primary[600]} />
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.buttonFlex,
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
            <Text style={[styles.progressLabel, step >= 1 && styles.progressLabelActive]}>
              Info
            </Text>
          </View>
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
            <Text style={[styles.progressLabel, step >= 2 && styles.progressLabelActive]}>
              Account
            </Text>
          </View>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </View>

        {/* Sign In Link */}
        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => navigate("/sign-in")}
        >
          <Text style={styles.signInLinkText}>
            Already have an account? Sign In
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },

  // Progress Indicator
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  progressStep: {
    alignItems: "center",
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing.xs,
  },
  progressDotActive: {
    backgroundColor: colors.primary[600],
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.neutral[300],
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  progressLineActive: {
    backgroundColor: colors.primary[600],
  },
  progressLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  progressLabelActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },

  // Form Card
  formCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    ...shadows.lg,
  },

  // Step Header
  stepHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  stepIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
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
    textAlign: "center",
    lineHeight: 20,
  },

  // Inputs
  inputRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  inputRequired: {
    color: colors.error[500],
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    marginTop: spacing.xs,
  },

  // Password container and toggle
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
  },
  passwordContainerFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  passwordContainerError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: spacing.md,
  },

  // Password Strength
  passwordStrength: {
    marginTop: spacing.sm,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    marginBottom: spacing.xs,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthWeak: {
    backgroundColor: colors.error[500],
    width: "25%",
  },
  strengthFair: {
    backgroundColor: colors.warning[500],
    width: "50%",
  },
  strengthGood: {
    backgroundColor: colors.success[400],
    width: "75%",
  },
  strengthStrong: {
    backgroundColor: colors.success[600],
    width: "100%",
  },
  strengthText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Buttons
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  buttonFlex: {
    flex: 1,
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
  },
  secondaryButton: {
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary[500],
    marginTop: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.neutral[400],
  },

  // Error Display
  submitErrorContainer: {
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  submitErrorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },

  // Sign In Link
  signInLink: {
    alignItems: "center",
    marginTop: spacing.xl,
  },
  signInLinkText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
  },
});

export default BusinessSignupWizard;
