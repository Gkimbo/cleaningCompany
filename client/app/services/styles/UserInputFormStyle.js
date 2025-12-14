import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const UserFormStyles = StyleSheet.create({
  // === Containers ===
  container: {
    marginTop: spacing["3xl"],
    marginHorizontal: spacing.lg,
  },

  container2: {
    marginBottom: 140,
  },

  formSurround: {
    paddingHorizontal: responsive("5%", "15%", "20%"),
  },

  // === Inputs & Fields ===
  inputSurround: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: radius.lg,
    backgroundColor: colors.glass.light,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    marginHorizontal: responsive("0.5%", "15%", "25%"),
    ...shadows.sm,
  },

  input: {
    flex: 1,
    borderWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors.glass.light,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginHorizontal: responsive("0.5%", "10%", "20%"),
  },

  codeInput: {
    alignSelf: "center",
    borderWidth: 0,
    backgroundColor: colors.glass.light,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.md,
    width: responsive("80%", "40%", "20%"),
    textAlign: "center",
    letterSpacing: 8,
    color: colors.text.primary,
  },

  modeInput: {
    marginBottom: spacing.xl,
  },

  checkbox: {
    marginBottom: spacing.md,
  },

  commuteContainer: {
    marginTop: spacing.md,
  },

  // === Text & Titles ===
  title: {
    fontSize: responsive(typography.fontSize.base, typography.fontSize.xl, typography.fontSize["2xl"]),
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
    textAlign: "center",
    color: colors.text.primary,
  },

  subtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
    textAlign: "center",
    color: colors.primary[700],
  },

  smallTitle: {
    marginBottom: spacing.xs,
    textAlign: "center",
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.base, typography.fontSize.lg),
  },

  // === Numeric Input (Miles etc.) ===
  milesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  unitInput: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  // === Buttons ===
  button: {
    alignSelf: "center",
    textAlign: "center",
    marginTop: spacing.md,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary[600],
    width: responsive("80%", "40%", "20%"),
    ...shadows.md,
  },

  buttonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
    textAlign: "center",
  },

  // === Status Messages ===
  error: {
    color: colors.error[600],
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.sm, typography.fontSize.sm),
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },

  changeNotification: {
    color: colors.success[600],
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.sm, typography.fontSize.sm),
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },

  // === Radio Buttons & Pickers ===
  radioButtonContainer: {
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: radius.lg,
    backgroundColor: colors.glass.light,
    marginBottom: spacing.lg,
    width: responsive("80%", "40%", "25%"),
    ...shadows.sm,
  },

  pickerContainer: {
    marginBottom: spacing.lg,
  },
});

export default UserFormStyles;
