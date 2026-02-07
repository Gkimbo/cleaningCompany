import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const BusinessOwnerModeToggle = ({ mode, onModeChange }) => {
  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.toggleButton,
          mode === "business" && styles.toggleButtonActive,
        ]}
        onPress={() => onModeChange("business")}
      >
        <Icon
          name="briefcase"
          size={16}
          color={mode === "business" ? colors.neutral[0] : colors.text.secondary}
        />
        <Text
          style={[
            styles.toggleText,
            mode === "business" && styles.toggleTextActive,
          ]}
        >
          Manage Business
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.toggleButton,
          mode === "cleaner" && styles.toggleButtonActive,
        ]}
        onPress={() => onModeChange("cleaner")}
      >
        <Icon
          name="magic"
          size={16}
          color={mode === "cleaner" ? colors.neutral[0] : colors.text.secondary}
        />
        <Text
          style={[
            styles.toggleText,
            mode === "cleaner" && styles.toggleTextActive,
          ]}
        >
          Clean Jobs
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.xl,
    padding: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary[600],
    ...shadows.md,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  toggleTextActive: {
    color: colors.neutral[0],
  },
});

export default BusinessOwnerModeToggle;
