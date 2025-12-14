import { Dimensions, Platform } from "react-native";

const { width, height } = Dimensions.get("window");

// Breakpoints for responsive design
export const breakpoints = {
  xs: 0,
  sm: 400,
  md: 600,
  lg: 900,
  xl: 1200,
};

// Screen size helpers
export const screen = {
  width,
  height,
  isSmall: width < breakpoints.sm,
  isMedium: width >= breakpoints.sm && width < breakpoints.md,
  isLarge: width >= breakpoints.md && width < breakpoints.lg,
  isXLarge: width >= breakpoints.lg,
  isTablet: width >= breakpoints.md,
  isDesktop: width >= breakpoints.lg,
};

// Modern color palette - Teal & Coral complementary theme
export const colors = {
  // Primary brand colors - Teal/Emerald (fresh, clean, professional)
  primary: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
  },

  // Secondary/accent colors - Coral/Orange (warm, inviting, action-oriented)
  secondary: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
  },

  // Success/green - Emerald
  success: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
  },

  // Warning/amber
  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },

  // Error/red - Rose
  error: {
    50: "#fff1f2",
    100: "#ffe4e6",
    200: "#fecdd3",
    300: "#fda4af",
    400: "#fb7185",
    500: "#f43f5e",
    600: "#e11d48",
    700: "#be123c",
    800: "#9f1239",
    900: "#881337",
  },

  // Neutral/slate - Warm gray tones
  neutral: {
    0: "#ffffff",
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },

  // Semantic colors
  background: {
    primary: "#ffffff",
    secondary: "#f8fafc",
    tertiary: "#f0fdfa", // Light teal tint
    dark: "#134e4a",
    gradient: {
      start: "#0d9488",
      end: "#14b8a6",
    },
  },

  text: {
    primary: "#0f172a",
    secondary: "#475569",
    tertiary: "#94a3b8",
    inverse: "#ffffff",
    link: "#0d9488",
    accent: "#ea580c",
  },

  border: {
    light: "#e2e8f0",
    default: "#cbd5e1",
    dark: "#94a3b8",
    accent: "#99f6e4",
  },

  // Glass effect colors
  glass: {
    light: "rgba(255, 255, 255, 0.9)",
    medium: "rgba(255, 255, 255, 0.7)",
    dark: "rgba(0, 0, 0, 0.4)",
    overlay: "rgba(15, 23, 42, 0.6)",
    primaryTint: "rgba(20, 184, 166, 0.1)",
    secondaryTint: "rgba(249, 115, 22, 0.1)",
  },
};

// Spacing scale (4px base)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
};

// Border radius
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  full: 9999,
};

// Typography
export const typography = {
  // Font sizes - responsive
  fontSize: {
    xs: screen.isSmall ? 10 : 12,
    sm: screen.isSmall ? 12 : 14,
    base: screen.isSmall ? 14 : 16,
    lg: screen.isSmall ? 16 : 18,
    xl: screen.isSmall ? 18 : 20,
    "2xl": screen.isSmall ? 20 : 24,
    "3xl": screen.isSmall ? 24 : 30,
    "4xl": screen.isSmall ? 28 : 36,
  },

  // Font weights
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Shadows
export const shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

// Common component styles
export const components = {
  // Card styles
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },

  cardGlass: {
    backgroundColor: colors.glass.light,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
  },

  // Button base styles
  button: {
    primary: {
      backgroundColor: colors.primary[600],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.md,
    },
    secondary: {
      backgroundColor: colors.neutral[100],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    ghost: {
      backgroundColor: "transparent",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    danger: {
      backgroundColor: colors.error[600],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.md,
    },
  },

  buttonText: {
    primary: {
      color: colors.neutral[0],
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
    },
    secondary: {
      color: colors.text.primary,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
    },
    ghost: {
      color: colors.primary[600],
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
    },
    danger: {
      color: colors.neutral[0],
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
    },
  },

  // Input styles
  input: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },

  inputFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },

  inputError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },

  // Badge styles
  badge: {
    primary: {
      backgroundColor: colors.primary[100],
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
    },
    success: {
      backgroundColor: colors.success[100],
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
    },
    warning: {
      backgroundColor: colors.warning[100],
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
    },
    error: {
      backgroundColor: colors.error[100],
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
    },
  },

  badgeText: {
    primary: {
      color: colors.primary[700],
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    success: {
      color: colors.success[700],
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    warning: {
      color: colors.warning[700],
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    error: {
      color: colors.error[700],
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
  },
};

// Layout helpers
export const layout = {
  // Container widths
  container: {
    width: screen.isSmall ? "100%" : screen.isMedium ? "95%" : "90%",
    maxWidth: 1200,
    alignSelf: "center",
  },

  // Flex shortcuts
  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  column: {
    flexDirection: "column",
  },

  columnCenter: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  center: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Screen padding
  screenPadding: {
    paddingHorizontal: screen.isSmall ? spacing.lg : spacing.xl,
    paddingTop: Platform.OS === "ios" ? spacing["4xl"] : spacing.xl,
    paddingBottom: spacing["3xl"],
  },
};

// Responsive helper function
export const responsive = (small, medium, large) => {
  if (screen.isSmall) return small;
  if (screen.isMedium || screen.isLarge) return medium;
  return large;
};

// Get responsive font size
export const getFontSize = (base) => {
  const scale = screen.isSmall ? 0.85 : screen.isMedium ? 0.95 : 1;
  return Math.round(base * scale);
};

// Get responsive spacing
export const getSpacing = (base) => {
  const scale = screen.isSmall ? 0.8 : screen.isMedium ? 0.9 : 1;
  return Math.round(base * scale);
};

// Export default theme object
const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  components,
  layout,
  screen,
  breakpoints,
  responsive,
  getFontSize,
  getSpacing,
};

export default theme;
