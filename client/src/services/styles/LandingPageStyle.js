import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const LandingPageStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[600],
  },

  header: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: spacing["3xl"],
  },

  footer: {
    flex: 3,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    paddingVertical: spacing["3xl"],
    paddingHorizontal: responsive(spacing.xl, spacing["3xl"], spacing["4xl"]),
    width: "100%",
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
    marginBottom: spacing.lg,
    textAlign: "center",
  },

  text: {
    color: colors.text.secondary,
    marginTop: spacing.xl,
    textAlign: "center",
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
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    ...shadows.md,
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
    fontWeight: typography.fontWeight.semibold,
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

  // Auth screens (SignIn/SignUp)
  authContainer: {
    flex: 1,
    backgroundColor: colors.primary[600],
  },

  authScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing["3xl"],
  },

  authCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
    ...shadows.xl,
  },

  authTitle: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  authSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },

  authFooter: {
    marginTop: spacing["2xl"],
    alignItems: "center",
  },

  authFooterText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },

  authLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  authLinkText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
});

export default LandingPageStyles;
