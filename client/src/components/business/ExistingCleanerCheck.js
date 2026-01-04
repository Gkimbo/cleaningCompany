import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const ExistingCleanerCheck = () => {
  const navigate = useNavigate();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigate("/import-business")}
        >
          <Feather name="arrow-left" size={20} color={colors.text.secondary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Feather name="user-check" size={48} color={colors.primary[600]} />
        </View>

        {/* Title and subtitle */}
        <Text style={styles.title}>Already a Kleanr Cleaner?</Text>
        <Text style={styles.subtitle}>
          If you already have a cleaner account with Kleanr, you can upgrade it to a business owner account and keep all your existing data, reviews, and history.
        </Text>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigate("/sign-in?redirect=/upgrade-to-business")}
        >
          <Feather name="log-in" size={20} color={colors.neutral[0]} />
          <Text style={styles.primaryButtonText}>Yes, I Have an Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigate("/business-signup")}
        >
          <Feather name="user-plus" size={20} color={colors.primary[600]} />
          <Text style={styles.secondaryButtonText}>No, Create New Account</Text>
        </TouchableOpacity>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Feather name="info" size={16} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            Upgrading your existing account lets you manage your own clients while still having access to platform jobs.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing["2xl"],
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    width: "100%",
    marginBottom: spacing.md,
    ...shadows.md,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
    marginLeft: spacing.sm,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    width: "100%",
    borderWidth: 2,
    borderColor: colors.primary[600],
    marginBottom: spacing.xl,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    marginLeft: spacing.sm,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
});

export default ExistingCleanerCheck;
