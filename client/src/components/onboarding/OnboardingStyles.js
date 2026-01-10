import { StyleSheet, Platform } from "react-native";
import { colors, spacing, radius, shadows, typography, screen } from "../../services/styles/theme";

const OnboardingStyles = StyleSheet.create({
  // Main containers
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  scrollContainer: {
    flexGrow: 1,
    paddingBottom: spacing["4xl"],
  },

  contentContainer: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: Platform.OS === "ios" ? spacing["4xl"] : spacing.xl,
  },

  // Header styles
  header: {
    alignItems: "center",
    marginBottom: spacing["2xl"],
  },

  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    ...shadows.lg,
  },

  logoText: {
    fontSize: 32,
    color: colors.neutral[0],
  },

  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing["2xl"],
    paddingHorizontal: spacing.lg,
  },

  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.neutral[300],
  },

  stepDotActive: {
    backgroundColor: colors.primary[500],
    width: 24,
  },

  stepDotCompleted: {
    backgroundColor: colors.success[500],
  },

  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.neutral[300],
    marginHorizontal: spacing.xs,
  },

  stepLineActive: {
    backgroundColor: colors.primary[500],
  },

  // Form card
  formCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    ...shadows.lg,
  },

  formSection: {
    marginBottom: spacing.xl,
  },

  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.md,
  },

  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },

  // Input styles
  inputGroup: {
    marginBottom: spacing.lg,
  },

  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  inputRequired: {
    color: colors.error[500],
  },

  inputHelper: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  input: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },

  inputFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },

  inputError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },

  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  // Row layouts
  inputRow: {
    flexDirection: "row",
    gap: spacing.md,
  },

  inputHalf: {
    flex: 1,
  },

  inputThird: {
    flex: 1,
  },

  // Choice buttons (radio replacement)
  choiceGroup: {
    gap: spacing.sm,
  },

  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  choiceButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.border.light,
    minWidth: 100,
    alignItems: "center",
  },

  choiceButtonSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },

  choiceButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },

  choiceButtonTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },

  choiceButtonFull: {
    flex: 1,
  },

  // Toggle cards
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  toggleCardActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },

  toggleCardContent: {
    flex: 1,
    marginRight: spacing.md,
  },

  toggleCardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  toggleCardDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[300],
    padding: 2,
    justifyContent: "center",
  },

  toggleSwitchActive: {
    backgroundColor: colors.primary[500],
  },

  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },

  toggleKnobActive: {
    alignSelf: "flex-end",
  },

  // Price display
  priceCard: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.success[200],
  },

  priceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },

  priceAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },

  priceNote: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: spacing.xs,
  },

  // Error display
  errorContainer: {
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },

  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },

  // Success display
  successContainer: {
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },

  successText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },

  // Buttons
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },

  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary[500],
  },

  secondaryButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  skipButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },

  skipButtonText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },

  buttonDisabled: {
    backgroundColor: colors.neutral[300],
  },

  // Info boxes
  infoBox: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },

  infoBoxText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },

  // Password container and toggle
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
  },

  passwordContainerFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },

  passwordContainerError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },

  eyeButton: {
    padding: spacing.md,
  },

  // Password strength
  passwordStrength: {
    marginTop: spacing.sm,
  },

  strengthBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    marginBottom: spacing.xs,
    overflow: "hidden",
  },

  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },

  strengthWeak: {
    backgroundColor: colors.error[500],
    width: "25%",
  },

  strengthFair: {
    backgroundColor: colors.warning[500],
    width: "50%",
  },

  strengthGood: {
    backgroundColor: colors.success[400],
    width: "75%",
  },

  strengthStrong: {
    backgroundColor: colors.success[600],
    width: "100%",
  },

  strengthText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Welcome screen specific
  welcomeContainer: {
    flex: 1,
    backgroundColor: colors.primary[600],
    padding: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },

  welcomeTitle: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    textAlign: "center",
    marginBottom: spacing.md,
  },

  welcomeSubtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[100],
    textAlign: "center",
    marginBottom: spacing["3xl"],
    lineHeight: 28,
  },

  featureList: {
    marginBottom: spacing["3xl"],
    width: "100%",
  },

  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },

  featureIconText: {
    fontSize: 24,
    color: colors.neutral[0],
  },

  featureText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.neutral[0],
    lineHeight: 22,
  },

  welcomeButton: {
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.lg,
    ...shadows.lg,
    marginBottom: spacing.md,
    width: "100%",
    alignItems: "center",
  },

  welcomeButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  welcomeSecondaryButton: {
    paddingVertical: spacing.md,
  },

  welcomeSecondaryButtonText: {
    color: colors.primary[100],
    fontSize: typography.fontSize.base,
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
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
});

export default OnboardingStyles;
