import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const LandingPageStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary[600],
  },

  header: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
    marginTop: responsive("30%", "15%", "10%"),
  },

  footer: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
    width: screen.height * 0.45,
    ...shadows.lg,
  },

  logo: {
    width: screen.height * 0.28,
    height: screen.height * 0.28,
    borderRadius: radius["3xl"],
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    marginLeft: "auto",
    marginRight: "auto",
  },

  logoReg: {
    width: screen.height * 0.28 * 0.3,
    height: screen.height * 0.28 * 0.3,
    borderRadius: radius.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    marginLeft: "auto",
    marginRight: "auto",
  },

  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    alignSelf: "center",
  },

  text: {
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    alignSelf: "center",
    fontSize: typography.fontSize.base,
  },

  button: {
    alignItems: "flex-end",
    marginTop: spacing.xl,
  },

  paragraph: {
    marginTop: spacing["3xl"],
    marginBottom: spacing["3xl"],
    textAlign: "justify",
    color: colors.text.primary,
    alignSelf: "center",
    fontSize: typography.fontSize.base,
    lineHeight: 24,
  },

  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },

  signIn: {
    width: 150,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.full,
    flexDirection: "row",
    backgroundColor: colors.primary[600],
    ...shadows.md,
  },

  textSign: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },

  // Additional styles for enhanced landing page
  heroSection: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
  },

  featureCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginVertical: spacing.md,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  featureTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  featureDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  ctaButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    alignItems: "center",
    ...shadows.md,
  },

  ctaButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  secondaryCtaButton: {
    backgroundColor: "transparent",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.neutral[0],
  },

  secondaryCtaButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
});

export default LandingPageStyles;
