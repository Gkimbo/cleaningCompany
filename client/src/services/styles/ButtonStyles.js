import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, responsive } from "./theme";

const ButtonStyles = StyleSheet.create({
  // Primary button
  primary: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },

  primaryText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Secondary button
  secondary: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.primary[600],
  },

  secondaryText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Ghost button (text only)
  ghost: {
    backgroundColor: "transparent",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },

  ghostText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.base,
  },

  // Danger button
  danger: {
    backgroundColor: colors.error[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },

  dangerText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Success button
  success: {
    backgroundColor: colors.success[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },

  successText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Warning button
  warning: {
    backgroundColor: colors.warning[500],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },

  warningText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Icon button (circular)
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  iconPrimary: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },

  // Small button variant
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },

  smallText: {
    fontSize: typography.fontSize.sm,
  },

  // Large button variant
  large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
  },

  largeText: {
    fontSize: typography.fontSize.lg,
  },

  // Full width button
  fullWidth: {
    width: "100%",
  },

  // Disabled state
  disabled: {
    backgroundColor: colors.neutral[200],
    borderColor: colors.neutral[200],
  },

  disabledText: {
    color: colors.neutral[400],
  },

  // Pressed state
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  // Glass effect button (legacy support)
  glassButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.glass.light,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },

  buttonText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Floating action button
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lg,
  },

  fabText: {
    color: colors.neutral[0],
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
  },
});

export default ButtonStyles;
