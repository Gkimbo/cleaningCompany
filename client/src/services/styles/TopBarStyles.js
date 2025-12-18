import { Platform, StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const topBarStyles = StyleSheet.create({
  // Main container - sticky header with teal accent
  container: {
    position: Platform.OS === "web" ? "fixed" : "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.neutral[0],
    ...shadows.md,
  },

  // Gradient-like top accent bar
  accentBar: {
    height: 3,
    backgroundColor: colors.primary[500],
  },

  // Safe area wrapper
  safeArea: {
    backgroundColor: colors.neutral[0],
  },

  // Header content wrapper
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsive(spacing.lg, spacing.xl, spacing["2xl"]),
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  // Alternative: Teal header background
  headerContentTeal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsive(spacing.lg, spacing.xl, spacing["2xl"]),
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[600],
  },

  // Logo/Brand section
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  logo: {
    width: 36,
    height: 36,
    marginRight: spacing.sm,
    borderRadius: radius.md,
  },

  brandText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },

  brandTextLight: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },

  // Navigation section
  navContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  // Title (for page headers)
  title: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
  },

  titleLight: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.lg),
  },

  pageTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
    textAlign: "center",
  },

  pageTitleLight: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    flex: 1,
    textAlign: "center",
  },

  // Navigation buttons
  navButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  navButtonActive: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[300],
  },

  navButtonLight: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[500],
    borderWidth: 1,
    borderColor: colors.primary[400],
  },

  navButtonLightActive: {
    backgroundColor: colors.neutral[0],
    borderColor: colors.neutral[0],
  },

  navButtonText: {
    color: colors.text.secondary,
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.sm, typography.fontSize.base),
    fontWeight: typography.fontWeight.medium,
  },

  navButtonTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },

  navButtonTextLight: {
    color: colors.primary[100],
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.sm, typography.fontSize.base),
    fontWeight: typography.fontWeight.medium,
  },

  navButtonTextLightActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },

  // Icon button (hamburger, back, etc.)
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  iconButtonLight: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary[400],
  },

  iconButtonPressed: {
    backgroundColor: colors.neutral[100],
  },

  iconButtonLightPressed: {
    backgroundColor: colors.primary[400],
  },

  // Primary action button - coral accent
  primaryButton: {
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...shadows.sm,
  },

  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  // Secondary action button - teal
  secondaryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...shadows.sm,
  },

  secondaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Outline button
  outlineButton: {
    backgroundColor: "transparent",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },

  outlineButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  outlineButtonLight: {
    backgroundColor: "transparent",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.neutral[0],
  },

  outlineButtonLightText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Sign out button
  signOutButton: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  signOutButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Dropdown menu (for mobile)
  menuDropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    left: 0,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    ...shadows.lg,
    paddingVertical: spacing.sm,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },

  menuItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },

  menuItemActive: {
    backgroundColor: colors.primary[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },

  menuItemTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },

  menuDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.lg,
  },

  // Badge (for notifications) - coral accent
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.secondary[500],
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderWidth: 2,
    borderColor: colors.neutral[0],
  },

  badgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },

  badgeError: {
    backgroundColor: colors.error[500],
  },

  // Desktop sidebar (for larger screens)
  sidebar: {
    width: 280,
    backgroundColor: colors.neutral[0],
    borderRightWidth: 1,
    borderRightColor: colors.border.light,
    paddingTop: spacing.xl,
  },

  sidebarHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },

  sidebarItemActive: {
    backgroundColor: colors.primary[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },

  sidebarItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginLeft: spacing.md,
  },

  sidebarItemTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },

  sidebarItemIcon: {
    width: 24,
    alignItems: "center",
  },

  // Sidebar section header
  sidebarSection: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },

  sidebarSectionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Breadcrumb
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  breadcrumbText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },

  breadcrumbSeparator: {
    marginHorizontal: spacing.sm,
    color: colors.text.tertiary,
  },

  breadcrumbCurrent: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },

  // User avatar/profile
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary[200],
  },

  userAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },

  userAvatarLight: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[400],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary[300],
  },

  userAvatarLightText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },

  // Search bar
  searchContainer: {
    flex: 1,
    maxWidth: 400,
    marginHorizontal: spacing.lg,
  },

  searchInput: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  searchInputLight: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.primary[400],
  },

  searchInputPlaceholder: {
    color: colors.text.tertiary,
  },

  searchInputPlaceholderLight: {
    color: colors.primary[200],
  },
});

export default topBarStyles;
