import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
  },

  header: {
    marginBottom: spacing.md,
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

  // Progress bar styles
  progressContainer: {
    marginBottom: spacing.md,
  },

  progressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  progressBar: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },

  // Room sections scroll view
  roomsScrollView: {
    flex: 1,
    marginBottom: spacing.md,
  },

  // Room section styles
  roomSection: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.sm,
  },

  roomSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.neutral[100],
  },

  roomSectionHeaderComplete: {
    backgroundColor: colors.success[50] || "#f0fdf4",
    borderLeftWidth: 4,
    borderLeftColor: colors.success[600],
  },

  roomSectionHeaderIncomplete: {
    backgroundColor: colors.warning[100],
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[700],
  },

  roomSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  roomSectionStatus: {
    fontSize: typography.fontSize.base,
    marginRight: spacing.sm,
  },

  roomSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },

  photoCountBadge: {
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },

  photoCountText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  expandIcon: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },

  roomSectionContent: {
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  roomPhotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  roomPhotoCard: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadows.sm,
  },

  roomPhotoThumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.neutral[200],
  },

  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[300],
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },

  libraryAddButton: {
    backgroundColor: colors.secondary[50],
    borderColor: colors.secondary[300] || colors.secondary[700],
  },

  addPhotoIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },

  addPhotoText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  roomRequiredText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    marginTop: spacing.sm,
    fontStyle: "italic",
  },

  deleteButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.error[500] || colors.error[700],
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  continueButton: {
    backgroundColor: colors.secondary[500] || colors.secondary[700],
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

  // Legacy styles kept for backward compatibility
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
    color: colors.error[500] || colors.error[700],
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
});

export default styles;
