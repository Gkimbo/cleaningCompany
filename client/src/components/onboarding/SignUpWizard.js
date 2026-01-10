import React, { useState, useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import AnalyticsService from "../../services/AnalyticsService";
import styles from "./OnboardingStyles";
import { colors } from "../../services/styles/theme";

const SignUpWizard = ({ dispatch }) => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isCompletedRef = useRef(false);

  // Track signup flow start and abandonment
  useEffect(() => {
    AnalyticsService.trackFlowStart("user_signup");
    return () => {
      if (!isCompletedRef.current) {
        AnalyticsService.trackFlowAbandon("user_signup", "signup_form", 1, 1);
      }
    };
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

  const validateForm = () => {
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

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await FetchData.makeNewUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        userName: formData.username,
        password: formData.password,
        email: formData.email,
      });

      if (
        response === "An account already has this email" ||
        response === "Username already exists"
      ) {
        setErrors({ submit: response });
      } else {
        // Track signup completion
        isCompletedRef.current = true;
        AnalyticsService.trackFlowComplete("user_signup");

        dispatch({ type: "CURRENT_USER", payload: response.token });
        login(response.token);
        navigate("/setup-home");
      }
    } catch (error) {
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthInfo = getStrengthLabel(passwordStrength);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>🏠</Text>
            </View>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>
              Join thousands of homeowners who trust us for their cleaning needs
            </Text>
          </View>

          <View style={styles.formCard}>
            {errors.submit && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.submit}</Text>
              </View>
            )}

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
                  <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
                    {errors.firstName}
                  </Text>
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
                  <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
                    {errors.lastName}
                  </Text>
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
                <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
                  {errors.email}
                </Text>
              )}
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
              <Text style={styles.inputHelper}>4-12 characters</Text>
              {errors.username && (
                <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
                  {errors.username}
                </Text>
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
                <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
                  {errors.password}
                </Text>
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
                <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
                  {errors.confirmPassword}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? "Creating Account..." : "Create Account"}
              </Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigate("/sign-in")}
            >
              <Text style={styles.secondaryButtonText}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignUpWizard;
