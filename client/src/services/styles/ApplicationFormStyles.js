import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, responsive } from "./theme";

const ApplicationFormStyles = StyleSheet.create({
  // Main container
  container: {
    padding: spacing.xl,
    paddingTop: spacing["4xl"],
    backgroundColor: colors.neutral[0],
    flexGrow: 1,
    paddingBottom: spacing["4xl"],
  },

  scrollContainer: {
    paddingBottom: spacing["4xl"],
  },

  // Title and description
  title: {
    fontSize: responsive(typography.fontSize.xl, typography.fontSize["2xl"], typography.fontSize["2xl"]),
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: "center",
    color: colors.primary[800],
  },

  description: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xl,
    textAlign: "center",
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Progress bar
  progressContainer: {
    marginBottom: spacing.xl,
    alignItems: "center",
  },

  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },

  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },

  // Section styles
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  sectionDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xl,
  },

  // Labels
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  requiredLabel: {
    color: colors.error[500],
  },

  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 18,
  },

  // Input styles
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: typography.fontSize.base,
    backgroundColor: colors.neutral[0],
    color: colors.text.primary,
  },

  inputFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
    ...shadows.sm,
  },

  textArea: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    color: colors.text.primary,
  },

  // Row layouts for side-by-side inputs
  rowContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  flexHalf: {
    flex: 2,
  },

  flexQuarter: {
    flex: 1,
  },

  flexThreeQuarter: {
    flex: 3,
  },

  // Checkbox styles
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: spacing.sm,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border.default,
    marginRight: spacing.md,
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },

  checkmark: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
  },

  checkboxLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    lineHeight: 20,
  },

  // Upload section
  uploadButton: {
    backgroundColor: colors.secondary[500],
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.sm,
    ...shadows.sm,
  },

  uploadButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },

  idPreview: {
    width: "100%",
    height: 180,
    borderRadius: radius.lg,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[100],
  },

  // Reference card
  referenceCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[400],
  },

  referenceHeader: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.md,
  },

  // Days selector
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  dayChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  dayChipSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },

  dayChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },

  dayChipTextSelected: {
    color: colors.neutral[0],
  },

  // Button styles
  button: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.lg,
    alignItems: "center",
    flex: 1,
    ...shadows.md,
  },

  secondaryButton: {
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.lg,
    alignItems: "center",
    flex: 1,
    borderWidth: 2,
    borderColor: colors.primary[500],
    marginRight: spacing.md,
  },

  secondaryButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  submitButton: {
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.lg,
    alignItems: "center",
    flex: 1,
    ...shadows.md,
  },

  buttonDisabled: {
    backgroundColor: colors.neutral[300],
  },

  buttonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  buttonRow: {
    flexDirection: "row",
    marginTop: spacing.xl,
    gap: spacing.md,
  },

  // Legal text
  legalText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    lineHeight: 18,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  // Error container
  errorContainer: {
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },

  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },

  // Thank you screen
  thankYouContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.background.tertiary,
  },

  thankYouIcon: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },

  thankYouTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
    color: colors.success[700],
    textAlign: "center",
  },

  thankYouMessage: {
    fontSize: typography.fontSize.base,
    textAlign: "center",
    color: colors.text.secondary,
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },

  // Info box
  infoBox: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },

  infoBoxText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },

  // Warning box
  warningBox: {
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },

  warningBoxText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
  },

  // Secure badge
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },

  secureBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
});

export default ApplicationFormStyles;
