import { StyleSheet, Platform } from "react-native";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  backButtonIcon: {
    fontSize: 18,
    color: colors.primary[600],
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  headerButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  headerButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  // Status Banner
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  statusBannerDraft: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[200],
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    backgroundColor: colors.success[600],
  },
  statusBadgeDraft: {
    backgroundColor: colors.warning[600],
  },
  statusBadgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[800],
  },
  statusTitleDraft: {
    color: colors.warning[800],
  },
  statusMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: 2,
  },
  statusMetaDraft: {
    color: colors.warning[600],
  },

  // Mode Tabs
  modeTabs: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
  },
  modeTabActive: {
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  modeTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  modeTabTextActive: {
    color: colors.primary[600],
  },

  // Toolbar
  toolbar: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  toolbarButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toolbarButtonActive: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[300],
  },
  toolbarButtonDisabled: {
    opacity: 0.4,
  },
  toolbarButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  toolbarButtonTextActive: {
    color: colors.primary[700],
  },
  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.xs,
  },

  // Section Card
  sectionCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionDragHandle: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  sectionDragHandleText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.tertiary,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  sectionIconText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  sectionTitleInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    padding: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  sectionActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  sectionActionButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  sectionActionButtonText: {
    fontSize: typography.fontSize.sm,
  },
  sectionContent: {
    padding: spacing.sm,
  },

  // Checklist Item Row
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  itemRowSelected: {
    borderColor: colors.primary[400],
    backgroundColor: colors.primary[50],
  },
  itemDragHandle: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  itemDragHandleText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  itemBullet: {
    width: 24,
    alignItems: "center",
    marginRight: spacing.xs,
  },
  itemBulletText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.tertiary,
  },
  itemContentInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    padding: spacing.sm,
    minHeight: 36,
  },
  itemContentInputBold: {
    fontWeight: typography.fontWeight.bold,
  },
  itemContentInputItalic: {
    fontStyle: "italic",
  },
  itemDeleteButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    marginLeft: spacing.xs,
  },
  itemDeleteButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[500],
  },

  // Pro Tip Styles
  proTipContainer: {
    marginLeft: 52, // Align with content (drag handle + bullet)
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  proTipBox: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  proTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  proTipIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  proTipLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  proTipText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
  },
  proTipInput: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
    padding: 0,
    minHeight: 40,
  },
  proTipContainerPreview: {
    marginLeft: 24, // Align with bullet
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  proTipActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
  },
  proTipDeleteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  proTipDeleteButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium,
  },
  addProTipButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 52,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.warning[300],
  },
  addProTipButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },

  // Add Item Button
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
    marginTop: spacing.sm,
  },
  addItemButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },

  // Add Section Button
  addSectionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
    marginBottom: spacing.lg,
  },
  addSectionButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary[600],
    ...shadows.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  saveButtonIcon: {
    fontSize: 16,
  },
  publishButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  publishButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  publishButtonIcon: {
    fontSize: 16,
  },

  // Version History
  historySection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  historySectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  historyList: {
    gap: spacing.md,
  },
  historyItem: {
    flexDirection: "row",
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  historyItemFirst: {
    backgroundColor: colors.primary[50],
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderRadius: radius.lg,
    borderBottomWidth: 0,
  },
  historyItemLeft: {
    marginRight: spacing.md,
  },
  historyVersionBadge: {
    backgroundColor: colors.neutral[200],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 40,
    alignItems: "center",
  },
  historyVersionBadgeCurrent: {
    backgroundColor: colors.primary[600],
  },
  historyVersionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  historyVersionTextCurrent: {
    color: colors.neutral[0],
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  historyItemMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  historyItemStats: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  historyRevertButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.sm,
  },
  historyRevertButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Loading/Empty States
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["4xl"],
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    padding: spacing["4xl"],
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  emptyStateHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: "center",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    textAlign: "center",
    lineHeight: 22,
  },
  modalStats: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  modalStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  modalStatLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  modalStatValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  modalCancelButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.success[600],
    alignItems: "center",
  },
  modalConfirmButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },

  // Auto-save indicator
  autoSaveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  autoSaveText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  autoSaveTextSaving: {
    color: colors.warning[600],
  },
  autoSaveTextSaved: {
    color: colors.success[600],
  },

  // Seed Button
  seedButton: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  seedButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  // Template Button
  templateButton: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  templateButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
  },

  // History Button styling
  historyButton: {
    backgroundColor: colors.neutral[0],
    borderColor: colors.neutral[300],
  },

  // Modal Content (for inline modals)
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    width: "100%",
    maxWidth: 420,
    ...shadows.xl,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  modalCancelButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  modalConfirmButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  modalDangerButton: {
    backgroundColor: colors.error[600],
  },

  // Warning Box
  warningBox: {
    backgroundColor: colors.error[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
    borderLeftWidth: 4,
    borderLeftColor: colors.error[500],
  },
  warningText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[800],
    marginBottom: spacing.xs,
  },
  warningSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    lineHeight: 20,
  },

  // Template Stats Box
  templateStatsBox: {
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  templateStatsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[800],
    marginBottom: spacing.sm,
  },
  templateStatItem: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginBottom: 6,
    paddingLeft: spacing.sm,
  },
});

export default styles;
