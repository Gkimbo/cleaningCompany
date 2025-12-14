import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, responsive } from "./theme";

const RatingsStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.secondary,
  },

  centeredContent: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },

  tile: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.light,
    minWidth: 200,
  },

  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },

  starIcon: {
    marginHorizontal: 2,
  },

  headerText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },

  ratingText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },

  ratingNumber: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginBottom: spacing.sm,
  },

  descriptionText: {
    textAlign: "center",
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },

  messageText: {
    textAlign: "center",
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },

  tapText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  // Rating breakdown
  breakdownContainer: {
    marginTop: spacing.lg,
    width: "100%",
  },

  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xs,
  },

  breakdownLabel: {
    width: 60,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    marginHorizontal: spacing.sm,
    overflow: "hidden",
  },

  breakdownFill: {
    height: "100%",
    backgroundColor: colors.warning[500],
    borderRadius: radius.full,
  },

  breakdownCount: {
    width: 30,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "right",
  },

  // Review count
  reviewCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    padding: spacing.xl,
  },

  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.md,
  },

  // Interactive star for rating input
  interactiveStar: {
    padding: spacing.xs,
  },

  // Rating input container
  ratingInputContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },

  // Submit button for rating
  submitButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    ...shadows.sm,
  },

  submitButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
});

export default RatingsStyles;
