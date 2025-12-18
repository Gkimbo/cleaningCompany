import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
  },

  header: {
    marginBottom: spacing.xl,
  },

  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  roomSelector: {
    marginBottom: spacing.lg,
  },

  roomLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  roomScrollView: {
    flexGrow: 0,
  },

  roomChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  roomChipSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },

  roomChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  roomChipTextSelected: {
    color: colors.neutral[0],
  },

  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },

  captureButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },

  captureButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  libraryButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary[500],
  },

  libraryButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  uploadingContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },

  uploadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  photosContainer: {
    flex: 1,
    marginBottom: spacing.lg,
  },

  photosHeader: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  requiredText: {
    color: colors.error[500],
    fontWeight: typography.fontWeight.normal,
  },

  photosScrollView: {
    flexGrow: 0,
  },

  photoCard: {
    width: 140,
    marginRight: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    overflow: "hidden",
    ...shadows.sm,
  },

  photoThumbnail: {
    width: "100%",
    height: 105,
    backgroundColor: colors.neutral[200],
  },

  photoRoom: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    textAlign: "center",
    backgroundColor: colors.neutral[50],
  },

  deleteButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.error[500],
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
  },

  noPhotosContainer: {
    width: 200,
    height: 120,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border.default,
  },

  noPhotosText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  noPhotosSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  continueButton: {
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },

  continueButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },

  continueButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default styles;
