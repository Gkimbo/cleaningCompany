import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  cancelButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  headerSpacer: {
    width: 60,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },

  stepCircleActive: {
    backgroundColor: colors.primary[500],
  },

  stepCircleCompleted: {
    backgroundColor: colors.success[500],
  },

  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
  },

  stepNumberActive: {
    color: colors.neutral[0],
  },

  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },

  stepLabelActive: {
    color: colors.primary[700],
  },

  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.sm,
  },

  stepLineActive: {
    backgroundColor: colors.success[500],
  },

  // Cleaning Step
  cleaningContainer: {
    flex: 1,
    padding: spacing.lg,
  },

  cleaningHeader: {
    marginBottom: spacing.xl,
  },

  cleaningTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },

  cleaningSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  jobDetailsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },

  jobDetailsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  jobDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  jobDetailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  jobDetailValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },

  reminderBadge: {
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },

  reminderText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    fontWeight: typography.fontWeight.medium,
  },

  specialNotesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  specialNotesLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  specialNotesText: {
    fontSize: typography.fontSize.sm,
    color: colors.secondary[700],
    fontStyle: "italic",
    lineHeight: 20,
  },

  photoStatusCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },

  photoStatusTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[800],
    marginBottom: spacing.sm,
  },

  photoStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  photoStatusLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
  },

  photoStatusValue: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.semibold,
  },

  finishedButton: {
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },

  finishedButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  // Review Step
  reviewContainer: {
    flex: 1,
    padding: spacing.lg,
  },

  reviewHeader: {
    marginBottom: spacing.xl,
  },

  reviewTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },

  reviewSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  photosReviewSection: {
    marginBottom: spacing.xl,
  },

  photosReviewTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  photosReviewScroll: {
    flexGrow: 0,
  },

  reviewPhotoCard: {
    width: 120,
    marginRight: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },

  reviewPhotoImage: {
    width: "100%",
    height: 90,
    backgroundColor: colors.neutral[200],
  },

  reviewPhotoRoom: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },

  payoutCard: {
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.success[200],
  },

  payoutTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },

  payoutAmount: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },

  payoutNote: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: spacing.xs,
  },

  completeButton: {
    backgroundColor: colors.success[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadows.md,
  },

  completeButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  addMorePhotosButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },

  addMorePhotosText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // Skip button for business owners
  skipButton: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  skipButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // No photos placeholder for business owners
  noPhotosPlaceholder: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },

  noPhotosText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    fontStyle: "italic",
  },

  // Pass verification badges
  naPassesBadge: {
    backgroundColor: colors.success[50] || "#f0fdf4",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success[600],
  },

  naPassesText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  naPassesTextPending: {
    color: colors.warning[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default styles;
