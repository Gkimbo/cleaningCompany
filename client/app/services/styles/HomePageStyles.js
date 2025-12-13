import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const homePageStyles = StyleSheet.create({
  // Container with subtle gradient-like background
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.tertiary,
  },

  // Screen wrapper
  screenWrapper: {
    paddingTop: responsive(spacing["3xl"], spacing["2xl"], spacing.xl),
    paddingHorizontal: responsive(spacing.lg, spacing.xl, spacing["2xl"]),
    paddingBottom: spacing["3xl"],
    backgroundColor: colors.background.tertiary,
  },

  // Hero section for welcome area
  heroSection: {
    backgroundColor: colors.primary[600],
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing["2xl"],
    marginBottom: spacing.xl,
    borderBottomLeftRadius: radius["2xl"],
    borderBottomRightRadius: radius["2xl"],
  },

  heroTitle: {
    fontSize: responsive(typography.fontSize.xl, typography.fontSize["2xl"], typography.fontSize["3xl"]),
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    marginBottom: spacing.sm,
  },

  heroSubtitle: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
    color: colors.primary[100],
  },

  // Titles
  title: {
    alignSelf: "center",
    fontSize: responsive(typography.fontSize.lg, typography.fontSize.xl, typography.fontSize["2xl"]),
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
    color: colors.primary[800],
    letterSpacing: 0.3,
  },

  smallTitle: {
    alignSelf: "center",
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.lg, typography.fontSize.xl),
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
    color: colors.primary[700],
  },

  // Section header with accent
  sectionHeader: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },

  sectionHeaderAccent: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.secondary[600],
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },

  // Information text
  information: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Home tiles - enhanced with accent border
  homeTileContainer: {
    alignSelf: "center",
    marginVertical: spacing.md,
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    ...shadows.lg,
    width: responsive("100%", "90%", "80%"),
    maxWidth: 600,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },

  homeTileContainerHighlight: {
    alignSelf: "center",
    marginVertical: spacing.md,
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary[50],
    borderRadius: radius["2xl"],
    ...shadows.lg,
    width: responsive("100%", "90%", "80%"),
    maxWidth: 600,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary[500],
  },

  homeTileTitle: {
    fontSize: responsive(typography.fontSize.base, typography.fontSize.lg, typography.fontSize.xl),
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  homeTileAddress: {
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.sm, typography.fontSize.base),
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  homeTileSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },

  // Card styles
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  cardHighlight: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },

  cardAccent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderTopWidth: 3,
    borderTopColor: colors.secondary[500],
  },

  // Primary CTA button - coral accent for action
  primaryButton: {
    alignSelf: "center",
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    marginVertical: spacing.md,
    ...shadows.md,
    minWidth: responsive(140, 160, 180),
  },

  primaryButtonText: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    textAlign: "center",
  },

  // Secondary button - teal outline
  secondaryButton: {
    alignSelf: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    marginVertical: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary[500],
    ...shadows.sm,
  },

  secondaryButtonText: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    textAlign: "center",
  },

  // Tertiary button - teal filled
  tertiaryButton: {
    alignSelf: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    marginVertical: spacing.md,
    ...shadows.md,
    minWidth: responsive(140, 160, 180),
  },

  tertiaryButtonText: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
    textAlign: "center",
  },

  // Legacy button styles (for compatibility)
  AddHomeButton: {
    alignSelf: "center",
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    marginVertical: spacing.lg,
    ...shadows.md,
  },

  AddHomeButtonText: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    textAlign: "center",
  },

  backButtonForm: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
    minWidth: responsive(120, 140, 160),
  },

  backButtonContainerList: {
    width: responsive("30%", "20%", "15%"),
    marginLeft: spacing.xl,
    marginVertical: spacing.md,
  },

  buttonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
    textAlign: "center",
  },

  bookButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.secondary[500],
    borderRadius: radius.lg,
    ...shadows.md,
    alignItems: "center",
    justifyContent: "center",
  },

  bookButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },

  // Appointment card with status accent
  appointmentCard: {
    alignSelf: "center",
    marginVertical: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
    width: "100%",
    maxWidth: 500,
  },

  appointmentCardUpcoming: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },

  appointmentCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },

  appointmentCardComplete: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success[500],
  },

  appointmentCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },

  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },

  appointmentDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  appointmentPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.secondary[600],
  },

  appointmentStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    textAlign: "center",
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  appointmentStatusComplete: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    textAlign: "center",
    fontWeight: typography.fontWeight.semibold,
  },

  appointmentStatusPending: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    textAlign: "center",
    fontWeight: typography.fontWeight.semibold,
  },

  appointmentContact: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  // Divider with accent option
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.lg,
  },

  dividerAccent: {
    height: 2,
    backgroundColor: colors.primary[200],
    marginVertical: spacing.lg,
    borderRadius: radius.full,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },

  emptyStateIcon: {
    marginBottom: spacing.lg,
    opacity: 0.5,
  },

  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: "center",
  },

  emptyStateButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },

  // Badge styles
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },

  badgePrimary: {
    backgroundColor: colors.primary[100],
  },

  badgeSecondary: {
    backgroundColor: colors.secondary[100],
  },

  badgeSuccess: {
    backgroundColor: colors.success[100],
  },

  badgeWarning: {
    backgroundColor: colors.warning[100],
  },

  badgeError: {
    backgroundColor: colors.error[100],
  },

  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  badgeTextPrimary: {
    color: colors.primary[700],
  },

  badgeTextSecondary: {
    color: colors.secondary[700],
  },

  badgeTextSuccess: {
    color: colors.success[700],
  },

  badgeTextWarning: {
    color: colors.warning[700],
  },

  badgeTextError: {
    color: colors.error[700],
  },

  // Stats/metrics section
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginVertical: spacing.md,
    ...shadows.sm,
  },

  statItem: {
    alignItems: "center",
  },

  statValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },

  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Quick action buttons
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: spacing.md,
    gap: spacing.md,
  },

  quickActionButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  quickActionIcon: {
    marginBottom: spacing.sm,
  },

  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textAlign: "center",
  },
});

export default homePageStyles;
