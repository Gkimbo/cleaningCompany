import { Platform, StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const UserFormStyles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
    paddingVertical: spacing["2xl"],
    paddingHorizontal: responsive(spacing.lg, spacing["3xl"], spacing["4xl"]),
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    alignSelf: "center",
    width: responsive("95%", "85%", "60%"),
    maxWidth: 700,
    ...shadows.lg,
  },

  // Screen wrapper for full page forms
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    paddingTop: spacing["3xl"],
    paddingHorizontal: spacing.lg,
  },

  // Title styles
  title: {
    fontSize: responsive(typography.fontSize.xl, typography.fontSize["2xl"], typography.fontSize["3xl"]),
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },

  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  smallTitle: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.base),
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // Input field label
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  // Standard input
  input: {
    width: "100%",
    backgroundColor: colors.neutral[0],
    marginBottom: spacing.lg,
  },

  inputFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
    ...shadows.sm,
  },

  inputError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },

  inputDisabled: {
    backgroundColor: colors.neutral[100],
    color: colors.text.tertiary,
  },

  // Code/OTP input
  codeInput: {
    height: 52,
    width: "100%",
    backgroundColor: colors.neutral[0],
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.lg,
    letterSpacing: 8,
    textAlign: "center",
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  // Textarea
  textarea: {
    minHeight: 120,
    width: "100%",
    backgroundColor: colors.neutral[0],
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlignVertical: "top",
  },

  // Radio/Checkbox container
  radioButtonContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignSelf: "stretch",
    width: "100%",
  },

  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },

  radioLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },

  // Input with icon wrapper
  inputSurround: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    width: "100%",
  },

  inputIcon: {
    marginRight: spacing.sm,
  },

  // Primary button
  button: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },

  buttonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  buttonDisabled: {
    backgroundColor: colors.neutral[300],
  },

  // Secondary button
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    width: "100%",
    alignItems: "center",
  },

  secondaryButtonText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Link button
  linkButton: {
    marginTop: spacing.lg,
    alignItems: "center",
  },

  linkButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // Error message
  error: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
    textAlign: "center",
    marginTop: spacing.sm,
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
    alignSelf: "stretch",
    width: "100%",
  },

  // Success message
  success: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
    textAlign: "center",
    marginTop: spacing.sm,
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
    alignSelf: "stretch",
    width: "100%",
  },

  // Helper text
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },

  // Divider with text
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },

  dividerText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginHorizontal: spacing.md,
  },

  // Row layout for inline inputs
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },

  halfWidth: {
    flex: 1,
  },

  // Error container and text (used by auth forms)
  errorContainer: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default UserFormStyles;
