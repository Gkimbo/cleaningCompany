import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, responsive } from "./theme";

const ApplicationListStyles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: spacing["4xl"],
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.secondary,
  },

  header: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: "center",
    marginBottom: spacing.lg,
    color: colors.text.primary,
  },

  listContainer: {
    paddingBottom: spacing["2xl"],
  },

  card: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderRadius: radius.xl,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },

  name: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },

  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
    color: colors.text.secondary,
  },

  value: {
    fontWeight: typography.fontWeight.normal,
    color: colors.text.primary,
  },

  message: {
    marginTop: spacing.sm,
    fontStyle: "italic",
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },

  noData: {
    textAlign: "center",
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing["3xl"],
  },

  // Status badges
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },

  statusPending: {
    backgroundColor: colors.warning[100],
  },

  statusApproved: {
    backgroundColor: colors.success[100],
  },

  statusRejected: {
    backgroundColor: colors.error[100],
  },

  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  statusTextPending: {
    color: colors.warning[700],
  },

  statusTextApproved: {
    color: colors.success[700],
  },

  statusTextRejected: {
    color: colors.error[700],
  },

  // Action buttons
  actionContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  approveButton: {
    backgroundColor: colors.success[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...shadows.sm,
  },

  rejectButton: {
    backgroundColor: colors.error[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...shadows.sm,
  },

  actionButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing["4xl"],
  },

  emptyIcon: {
    marginBottom: spacing.lg,
  },

  emptyText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.tertiary,
    textAlign: "center",
  },

  // Filter/Search
  searchContainer: {
    flexDirection: "row",
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },

  searchInput: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  filterButton: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.light,
  },
});

export default ApplicationListStyles;
