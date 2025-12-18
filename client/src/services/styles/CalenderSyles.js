import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const calenderStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: "center",
    padding: spacing.md,
    width: responsive("100%", "80%", "50%"),
  },

  datesContainer: {
    width: screen.width,
    marginTop: responsive("-10%", "0.5%", "0.5%"),
    marginBottom: "3%",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.lg, typography.fontSize.lg),
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
    color: colors.text.primary,
  },

  selectedDatesContainer: {
    flexWrap: "wrap",
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    marginHorizontal: responsive("1%", "3%", "3%"),
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  selectedDatesText: {
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.base, typography.fontSize.base),
    color: colors.text.primary,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.glass.dark,
  },

  modalContent: {
    backgroundColor: colors.neutral[0],
    padding: spacing.xl,
    borderRadius: radius.xl,
    ...shadows.xl,
    width: "80%",
    maxWidth: 400,
  },

  modalText: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.lg,
    textAlign: "center",
    color: colors.text.primary,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: spacing.md,
  },

  deleteButton: {
    backgroundColor: colors.error[600],
    borderRadius: radius.lg,
    padding: spacing.lg,
    flex: 1,
    alignItems: "center",
    ...shadows.sm,
  },

  deleteButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  keepButton: {
    backgroundColor: colors.success[600],
    borderRadius: radius.lg,
    padding: spacing.lg,
    flex: 1,
    alignItems: "center",
    ...shadows.sm,
  },

  keepButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Calendar day styles
  dayContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },

  daySelected: {
    backgroundColor: colors.primary[600],
  },

  dayToday: {
    borderWidth: 2,
    borderColor: colors.primary[400],
  },

  dayText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },

  dayTextSelected: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
  },

  dayTextDisabled: {
    color: colors.text.tertiary,
  },

  // Week header
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  weekDayText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    width: 40,
    textAlign: "center",
  },

  // Month navigation
  monthNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },

  monthText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  navButton: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
});

export default calenderStyles;
