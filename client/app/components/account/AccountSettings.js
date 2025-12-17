import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import FetchData from "../../services/fetchRequests/fetchData";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const AccountSettings = ({ state, dispatch }) => {
  const [username, setUsername] = useState(state.currentUser.user?.username || "");
  const [email, setEmail] = useState(state.currentUser.user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  const validateUsername = () => {
    const validationErrors = [];
    if (username.length < 4) {
      validationErrors.push("Username must be at least 4 characters.");
    }
    if (username.length > 20) {
      validationErrors.push("Username must be 20 characters or less.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      validationErrors.push("Username can only contain letters, numbers, and underscores.");
    }
    return validationErrors;
  };

  const validatePassword = () => {
    const validationErrors = [];
    if (!currentPassword) {
      validationErrors.push("Current password is required.");
    }
    if (newPassword.length < 6) {
      validationErrors.push("New password must be at least 6 characters.");
    }
    if (newPassword !== confirmPassword) {
      validationErrors.push("New passwords do not match.");
    }
    return validationErrors;
  };

  const validateEmail = () => {
    const validationErrors = [];
    if (!email) {
      validationErrors.push("Email is required.");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      validationErrors.push("Please enter a valid email address.");
    }
    return validationErrors;
  };

  const handleUpdateUsername = async () => {
    setErrors([]);
    setSuccessMessage("");

    const validationErrors = validateUsername();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await FetchData.updateUsername(
        state.currentUser.token,
        username
      );

      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage("Username updated successfully!");
        // Update local state
        dispatch({
          type: "UPDATE_USER",
          payload: { ...state.currentUser.user, username },
        });
      }
    } catch (error) {
      setErrors(["Failed to update username. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setErrors([]);
    setSuccessMessage("");

    const validationErrors = validatePassword();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await FetchData.updatePassword(
        state.currentUser.token,
        currentPassword,
        newPassword
      );

      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setErrors(["Failed to update password. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    setErrors([]);
    setSuccessMessage("");

    const validationErrors = validateEmail();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await FetchData.updateEmail(
        state.currentUser.token,
        email
      );

      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage("Email updated successfully!");
        // Update local state
        dispatch({
          type: "UPDATE_USER",
          payload: { ...state.currentUser.user, email },
        });
      }
    } catch (error) {
      setErrors(["Failed to update email. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Account Settings</Text>
      <Text style={styles.subtitle}>Update your login credentials</Text>

      {/* Success Message */}
      {successMessage !== "" && (
        <View style={styles.successContainer}>
          <Feather name="check-circle" size={20} color={colors.success[600]} />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <View style={styles.errorContainer}>
          {errors.map((error, index) => (
            <View key={index} style={styles.errorRow}>
              <Feather name="alert-circle" size={16} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Username Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Username</Text>
        <Text style={styles.sectionDescription}>
          Your username is used to log into your account.
        </Text>

        <Text style={styles.label}>New Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter new username"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleUpdateUsername}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Updating..." : "Update Username"}
          </Text>
        </Pressable>
      </View>

      {/* Email Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Email</Text>
        <Text style={styles.sectionDescription}>
          Update the email address associated with your account.
        </Text>

        <Text style={styles.label}>New Email Address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter new email address"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Pressable
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleUpdateEmail}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Updating..." : "Update Email"}
          </Text>
        </Pressable>
      </View>

      {/* Password Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <Text style={styles.sectionDescription}>
          For security, you must enter your current password to set a new one.
        </Text>

        <Text style={styles.label}>Current Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={!showCurrentPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowCurrentPassword(!showCurrentPassword)}
          >
            <Feather
              name={showCurrentPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowNewPassword(!showNewPassword)}
          >
            <Feather
              name={showNewPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>

        <Text style={styles.label}>Confirm New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Feather
              name={showConfirmPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>

        <Pressable
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleUpdatePassword}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Updating..." : "Update Password"}
          </Text>
        </Pressable>
      </View>

      {/* Security Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Security Tips</Text>
        <View style={styles.tipRow}>
          <Feather name="shield" size={16} color={colors.primary[500]} />
          <Text style={styles.tipText}>Use a unique password you don't use elsewhere</Text>
        </View>
        <View style={styles.tipRow}>
          <Feather name="lock" size={16} color={colors.primary[500]} />
          <Text style={styles.tipText}>Include numbers and special characters</Text>
        </View>
        <View style={styles.tipRow}>
          <Feather name="key" size={16} color={colors.primary[500]} />
          <Text style={styles.tipText}>Make it at least 8 characters long</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.xl,
    paddingBottom: spacing["4xl"],
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },

  // Success/Error Messages
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  successText: {
    color: colors.success[700],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },

  // Section
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },

  // Form Elements
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: spacing.md,
  },

  // Buttons
  button: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Tips Section
  tipsSection: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  tipsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
  },
});

export default AccountSettings;
