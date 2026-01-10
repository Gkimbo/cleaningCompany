import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { TextInput } from "react-native-paper";
import { Feather } from "@expo/vector-icons";
import FetchData from "../../services/fetchRequests/fetchData";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

const MODES = {
  OPTIONS: "options",
  FORGOT_USERNAME: "forgot-username",
  FORGOT_PASSWORD: "forgot-password",
  SUCCESS: "success",
};

/**
 * AlreadyAcceptedCard - Displayed when an invitation has already been accepted
 * Provides options to sign in or recover username/password
 *
 * @param {string} email - Email from the invitation (pre-filled for recovery)
 * @param {function} onSignIn - Callback when Sign In is pressed
 * @param {function} onClose - Callback to close/dismiss the card
 * @param {string} invitationType - 'client' or 'employee'
 */
const AlreadyAcceptedCard = ({
  email: initialEmail = "",
  onSignIn,
  onClose,
  invitationType = "client",
}) => {
  const [mode, setMode] = useState(MODES.OPTIONS);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const validateEmail = () => {
    if (!email) {
      setError("Please enter your email address");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const handleForgotUsername = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    setError("");

    try {
      const response = await FetchData.forgotUsername(email);
      if (response.error) {
        setError(response.error);
      } else {
        setSuccessMessage(
          response.message || "Check your email for your username."
        );
        setMode(MODES.SUCCESS);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    setError("");

    try {
      const response = await FetchData.forgotPassword(email);
      if (response.error) {
        setError(response.error);
      } else {
        setSuccessMessage(
          response.message ||
            "Check your email for a temporary password."
        );
        setMode(MODES.SUCCESS);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setMode(MODES.OPTIONS);
    setError("");
    setSuccessMessage("");
  };

  const getMessage = () => {
    if (invitationType === "employee") {
      return "This invitation has already been accepted. Your employee account is ready!";
    }
    return "This invitation has already been accepted. Your account is ready!";
  };

  // Options view - main state showing Sign In and recovery options
  const renderOptions = () => (
    <>
      <View style={styles.iconContainer}>
        <View style={styles.successIcon}>
          <Feather name="check-circle" size={40} color={colors.success[600]} />
        </View>
      </View>

      <Text style={styles.title}>Already Registered</Text>
      <Text style={styles.message}>{getMessage()}</Text>

      {initialEmail && (
        <View style={styles.emailDisplay}>
          <Feather name="mail" size={16} color={colors.text.secondary} />
          <Text style={styles.emailText}>{initialEmail}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onSignIn}>
        <Feather name="log-in" size={18} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.primaryButtonText}>Sign In</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Need help signing in?</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.recoveryButton}
        onPress={() => setMode(MODES.FORGOT_USERNAME)}
      >
        <Feather name="user" size={16} color={colors.primary[600]} />
        <Text style={styles.recoveryButtonText}>Forgot Username?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.recoveryButton}
        onPress={() => setMode(MODES.FORGOT_PASSWORD)}
      >
        <Feather name="lock" size={16} color={colors.primary[600]} />
        <Text style={styles.recoveryButtonText}>Forgot Password?</Text>
      </TouchableOpacity>
    </>
  );

  // Username recovery view
  const renderForgotUsername = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Feather name="arrow-left" size={20} color={colors.text.primary} />
      </TouchableOpacity>

      <Text style={styles.title}>Recover Username</Text>
      <Text style={styles.message}>
        Enter your email address and we'll send you your username.
      </Text>

      {error !== "" && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        mode="outlined"
        label="Email Address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError("");
        }}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        outlineColor={colors.border.default}
        activeOutlineColor={colors.primary[600]}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleForgotUsername}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Send Username</Text>
        )}
      </TouchableOpacity>
    </>
  );

  // Password recovery view
  const renderForgotPassword = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Feather name="arrow-left" size={20} color={colors.text.primary} />
      </TouchableOpacity>

      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.message}>
        Enter your email address and we'll send you a temporary password.
      </Text>

      {error !== "" && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        mode="outlined"
        label="Email Address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError("");
        }}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        outlineColor={colors.border.default}
        activeOutlineColor={colors.primary[600]}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleForgotPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Reset Password</Text>
        )}
      </TouchableOpacity>
    </>
  );

  // Success view after recovery request
  const renderSuccess = () => (
    <>
      <View style={styles.iconContainer}>
        <View style={styles.successIcon}>
          <Feather name="mail" size={40} color={colors.success[600]} />
        </View>
      </View>

      <Text style={styles.title}>Check Your Email</Text>
      <Text style={styles.message}>{successMessage}</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onSignIn}>
        <Feather name="log-in" size={18} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.primaryButtonText}>Sign In</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={handleBack}>
        <Text style={styles.linkButtonText}>Back to options</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        )}

        {mode === MODES.OPTIONS && renderOptions()}
        {mode === MODES.FORGOT_USERNAME && renderForgotUsername()}
        {mode === MODES.FORGOT_PASSWORD && renderForgotPassword()}
        {mode === MODES.SUCCESS && renderSuccess()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.neutral[0],
    padding: spacing.xl,
    borderRadius: radius.xl,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    padding: spacing.xs,
    zIndex: 1,
  },
  backButton: {
    marginBottom: spacing.md,
    alignSelf: "flex-start",
    padding: spacing.xs,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success[50],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  emailDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  emailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dividerText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginHorizontal: spacing.sm,
  },
  recoveryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  recoveryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  input: {
    backgroundColor: colors.neutral[0],
    marginBottom: spacing.md,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  linkButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    textDecorationLine: "underline",
  },
});

export default AlreadyAcceptedCard;
