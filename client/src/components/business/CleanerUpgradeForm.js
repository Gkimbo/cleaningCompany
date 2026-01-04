import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import FetchData from "../../services/fetchRequests/fetchData";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const CleanerUpgradeForm = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!state?.currentUser?.token) {
      navigate("/sign-in?redirect=/upgrade-to-business");
    }
  }, [state?.currentUser?.token, navigate]);

  // Redirect if already a business owner
  useEffect(() => {
    if (state?.isBusinessOwner) {
      navigate("/my-clients");
    }
  }, [state?.isBusinessOwner, navigate]);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await FetchData.upgradeToBusinessOwner(
        state.currentUser.token,
        businessName.trim() || null,
        yearsInBusiness ? parseInt(yearsInBusiness, 10) : null
      );

      if (response.error) {
        setError(response.error);
        setIsLoading(false);
        return;
      }

      // Update global state
      dispatch({
        type: "SET_BUSINESS_OWNER_INFO",
        payload: {
          isBusinessOwner: true,
          businessName: businessName.trim() || null,
          yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness, 10) : null,
        },
      });

      setSuccess(true);

      // Navigate to My Clients page after short delay
      setTimeout(() => {
        navigate("/my-clients");
      }, 1500);
    } catch (err) {
      setError("Failed to upgrade account. Please try again.");
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={64} color={colors.success[500]} />
          </View>
          <Text style={styles.successTitle}>Upgrade Complete!</Text>
          <Text style={styles.successSubtitle}>
            Your account has been upgraded to a business owner account.
          </Text>
          <Text style={styles.successNote}>Redirecting to My Clients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigate("/upgrade-to-business")}
            >
              <Feather name="arrow-left" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={styles.headerIcon}>
              <Feather name="briefcase" size={32} color={colors.primary[600]} />
            </View>
            <Text style={styles.title}>Complete Your Upgrade</Text>
            <Text style={styles.subtitle}>
              Add some details about your business (optional)
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={18} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g., Sparkle Clean Services"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="words"
                editable={!isLoading}
              />
              <Text style={styles.helperText}>
                Optional - This will be shown to your clients
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Years in Business</Text>
              <TextInput
                style={styles.input}
                value={yearsInBusiness}
                onChangeText={(text) => setYearsInBusiness(text.replace(/[^0-9]/g, ""))}
                placeholder="e.g., 5"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="numeric"
                maxLength={2}
                editable={!isLoading}
              />
              <Text style={styles.helperText}>
                Optional - Helps build client trust
              </Text>
            </View>
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Feather name="info" size={18} color={colors.primary[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>What happens next?</Text>
              <Text style={styles.infoText}>
                After upgrading, you'll have access to the "My Clients" page where you can invite and manage your own clients. You'll still be able to work regular platform jobs as usual.
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleUpgrade}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral[0]} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Complete Upgrade</Text>
                  <Feather name="check" size={20} color={colors.neutral[0]} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigate("/upgrade-to-business")}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing["4xl"],
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    padding: spacing.sm,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
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
    textAlign: "center",
  },

  // Error
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    marginLeft: spacing.sm,
    flex: 1,
  },

  // Form
  form: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
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
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Info Box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    marginBottom: spacing.xl,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  infoTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },

  // Buttons
  buttonContainer: {
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    marginRight: spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },

  // Success State
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  successNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
});

export default CleanerUpgradeForm;
