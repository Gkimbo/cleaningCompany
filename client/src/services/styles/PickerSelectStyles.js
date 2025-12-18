import { StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "./theme";

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    color: colors.text.primary,
    backgroundColor: colors.neutral[0],
    fontSize: typography.fontSize.base,
  },

  inputAndroid: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    color: colors.text.primary,
    backgroundColor: colors.neutral[0],
    fontSize: typography.fontSize.base,
  },

  // Additional styles for picker wrapper
  container: {
    marginBottom: spacing.md,
  },

  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  placeholder: {
    color: colors.text.tertiary,
  },

  iconContainer: {
    position: "absolute",
    right: spacing.md,
    top: "50%",
    transform: [{ translateY: -12 }],
  },

  // Focused state
  inputIOSFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },

  inputAndroidFocused: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },

  // Error state
  inputIOSError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },

  inputAndroidError: {
    borderColor: colors.error[500],
    borderWidth: 2,
  },

  // Disabled state
  inputIOSDisabled: {
    backgroundColor: colors.neutral[100],
    color: colors.text.tertiary,
  },

  inputAndroidDisabled: {
    backgroundColor: colors.neutral[100],
    color: colors.text.tertiary,
  },

  // Modal styles (for iOS picker modal)
  modalViewMiddle: {
    backgroundColor: colors.neutral[100],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },

  modalViewBottom: {
    backgroundColor: colors.neutral[0],
  },

  done: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  doneDepressed: {
    color: colors.primary[400],
  },
});

export default pickerSelectStyles;
