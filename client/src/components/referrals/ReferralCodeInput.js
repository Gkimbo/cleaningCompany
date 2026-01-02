import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";
import ReferralService from "../../services/fetchRequests/ReferralService";

/**
 * ReferralCodeInput - An input component for entering referral codes
 * Shows validation status and reward information
 *
 * @param {string} value - Current input value
 * @param {function} onChangeText - Called when text changes
 * @param {function} onValidation - Called with validation result { valid, referrer, rewards, error }
 * @param {string} userType - Type of user being referred ('homeowner' or 'cleaner')
 * @param {string} placeholder - Input placeholder text
 */
const ReferralCodeInput = ({
  value,
  onChangeText,
  onValidation,
  userType = "homeowner",
  placeholder = "Enter referral code (optional)",
}) => {
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [debounceTimer, setDebounceTimer] = useState(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Reset validation if input is empty
    if (!value || value.trim().length === 0) {
      setValidationResult(null);
      onValidation && onValidation(null);
      return;
    }

    // Only validate if code is at least 4 characters
    if (value.trim().length < 4) {
      setValidationResult(null);
      onValidation && onValidation(null);
      return;
    }

    // Debounce validation
    const timer = setTimeout(() => {
      validateCode(value.trim());
    }, 500);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [value]);

  const validateCode = async (code) => {
    setValidating(true);
    try {
      const result = await ReferralService.validateCode(code, userType);
      setValidationResult(result);
      onValidation && onValidation(result);
    } catch (error) {
      const errorResult = {
        valid: false,
        error: "Unable to validate code. Please check your connection and try again.",
        errorCode: "NETWORK_ERROR"
      };
      setValidationResult(errorResult);
      onValidation && onValidation(errorResult);
    } finally {
      setValidating(false);
    }
  };

  // Get appropriate icon based on error type
  const getErrorIcon = (errorCode) => {
    switch (errorCode) {
      case "CODE_NOT_FOUND":
      case "INVALID_FORMAT":
        return "question-circle"; // Code doesn't exist or wrong format
      case "ACCOUNT_FROZEN":
        return "ban"; // Account suspended
      case "PROGRAM_INACTIVE":
      case "PROGRAM_TYPE_DISABLED":
        return "pause-circle"; // Program not active
      case "MONTHLY_LIMIT_REACHED":
        return "calendar-times-o"; // Limit reached
      case "INVALID_COMBINATION":
        return "exchange"; // Wrong user type combination
      case "NETWORK_ERROR":
        return "wifi"; // Connection issue
      default:
        return "exclamation-circle";
    }
  };

  const getInputStyle = () => {
    if (!validationResult) return styles.inputDefault;
    return validationResult.valid ? styles.inputValid : styles.inputInvalid;
  };

  const formatReward = (cents) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Referral Code</Text>
      <View style={[styles.inputWrapper, getInputStyle()]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) => onChangeText(text.toUpperCase())}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <View style={styles.inputStatus}>
          {validating && (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          )}
          {!validating && validationResult?.valid && (
            <Icon name="check-circle" size={20} color={colors.success[500]} />
          )}
          {!validating && validationResult && !validationResult.valid && value.length >= 4 && (
            <Icon name="times-circle" size={20} color={colors.error[500]} />
          )}
        </View>
      </View>

      {/* Success message with referrer info */}
      {validationResult?.valid && (
        <View style={styles.successMessage}>
          <Icon name="gift" size={14} color={colors.success[600]} />
          <Text style={styles.successText}>
            Referred by {validationResult.referrer?.firstName || "a friend"}
            {validationResult.rewards?.referredReward > 0 && (
              <Text style={styles.rewardHighlight}>
                {" - You'll get "}
                {formatReward(validationResult.rewards.referredReward)} credit!
              </Text>
            )}
          </Text>
        </View>
      )}

      {/* Error message */}
      {validationResult && !validationResult.valid && value.length >= 4 && (
        <View style={styles.errorMessage}>
          <Icon
            name={getErrorIcon(validationResult.errorCode)}
            size={14}
            color={colors.error[600]}
          />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorText}>
              {validationResult.error || "Invalid referral code"}
            </Text>
            {validationResult.errorCode === "CODE_NOT_FOUND" && (
              <Text style={styles.errorHint}>
                Double-check the code or ask your referrer for the correct one.
              </Text>
            )}
            {validationResult.errorCode === "ACCOUNT_FROZEN" && (
              <Text style={styles.errorHint}>
                You can still sign up without a referral code.
              </Text>
            )}
            {validationResult.errorCode === "MONTHLY_LIMIT_REACHED" && (
              <Text style={styles.errorHint}>
                Try a different referral code or sign up without one.
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Help text */}
      {!validationResult && (
        <Text style={styles.helpText}>
          Have a referral code? Enter it above for bonus rewards!
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  inputDefault: {
    borderColor: colors.border.light,
  },
  inputValid: {
    borderColor: colors.success[400],
    backgroundColor: colors.success[50],
  },
  inputInvalid: {
    borderColor: colors.error[400],
    backgroundColor: colors.error[50],
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    letterSpacing: 1,
  },
  inputStatus: {
    paddingRight: spacing.md,
    width: 36,
    alignItems: "center",
  },
  successMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  successText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  rewardHighlight: {
    fontWeight: typography.fontWeight.semibold,
  },
  errorMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },
  errorHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
    fontStyle: "italic",
  },
  helpText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
});

export default ReferralCodeInput;
