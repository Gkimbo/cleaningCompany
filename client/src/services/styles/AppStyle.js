import { StyleSheet } from "react-native";
import { colors, layout, spacing } from "./theme";

const appStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  scrollContent: {
    flexGrow: 1,
    ...layout.screenPadding,
  },

  loadingContainer: {
    flex: 1,
    ...layout.center,
    backgroundColor: colors.background.secondary,
  },

  loadingText: {
    marginTop: spacing.lg,
    fontSize: 16,
    color: colors.text.secondary,
  },

  errorContainer: {
    flex: 1,
    ...layout.center,
    backgroundColor: colors.background.secondary,
    padding: spacing.xl,
  },

  errorText: {
    fontSize: 16,
    color: colors.error[600],
    textAlign: "center",
  },
});

export default appStyles;
