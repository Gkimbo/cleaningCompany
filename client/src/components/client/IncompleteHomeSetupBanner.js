import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const IncompleteHomeSetupBanner = ({ home, onComplete }) => {
  if (!home) return null;

  const displayAddress = home.address
    ? `${home.address}${home.city ? `, ${home.city}` : ""}`
    : home.nickName || "Your home";

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={styles.iconBackground}>
          <Feather name="home" size={24} color={colors.warning[600]} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Complete Your Home Setup</Text>
        <Text style={styles.description}>
          Finish setting up "{displayAddress}" to enable booking and all features.
        </Text>

        <View style={styles.infoRow}>
          <Feather name="info" size={14} color={colors.neutral[500]} />
          <Text style={styles.infoText}>
            We need access information and linen preferences
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={onComplete}
      >
        <Text style={styles.buttonText}>Complete Setup</Text>
        <Feather name="arrow-right" size={16} color={colors.neutral[0]} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
    ...shadows.sm,
  },
  iconContainer: {
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  iconBackground: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  buttonPressed: {
    backgroundColor: colors.warning[700],
  },
  buttonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default IncompleteHomeSetupBanner;
