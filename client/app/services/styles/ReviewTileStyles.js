import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography } from "./theme";

const ReviewTileStyles = StyleSheet.create({
  tile: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginVertical: spacing.sm,
  },

  tilePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },

  reviewerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  dateText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },

  ratingText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  starsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },

  starIcon: {
    marginHorizontal: 1,
  },

  commentText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginBottom: spacing.md,
    lineHeight: 20,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },

  footerText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  tapText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },

  // Verified badge
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },

  verifiedText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Response section
  responseContainer: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[400],
  },

  responseHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },

  responseText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Helpful section
  helpfulContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  helpfulButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    gap: spacing.xs,
  },

  helpfulButtonActive: {
    backgroundColor: colors.primary[100],
  },

  helpfulText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  helpfulTextActive: {
    color: colors.primary[700],
  },

  helpfulCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Service tag
  serviceTag: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },

  serviceTagText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
});

export default ReviewTileStyles;
