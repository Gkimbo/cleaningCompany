import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const FrozenAccountBanner = ({ reason, onContactSupport }) => {
  const navigate = useNavigate();

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      navigate("/messages");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={styles.iconBackground}>
          <Feather name="alert-circle" size={24} color={colors.error[600]} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Account Frozen</Text>
        <Text style={styles.description}>
          Your account has been temporarily frozen. You have limited access to
          the platform.
        </Text>

        {reason && (
          <View style={styles.reasonRow}>
            <Feather name="info" size={14} color={colors.error[500]} />
            <Text style={styles.reasonText}>Reason: {reason}</Text>
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleContactSupport}
      >
        <Text style={styles.buttonText}>Contact Support</Text>
        <Feather name="message-circle" size={16} color={colors.neutral[0]} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.error[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
    ...shadows.sm,
  },
  iconContainer: {
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  iconBackground: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.error[100],
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[800],
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.error[100],
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  reasonText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    fontStyle: "italic",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  buttonPressed: {
    backgroundColor: colors.error[700],
  },
  buttonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default FrozenAccountBanner;
