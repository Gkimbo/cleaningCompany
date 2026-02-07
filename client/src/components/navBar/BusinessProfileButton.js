import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import { colors, spacing, radius } from "../../services/styles/theme";

const BusinessProfileButton = ({ closeModal }) => {
  const navigate = useNavigate();

  return (
    <Pressable
      onPress={() => {
        closeModal();
        navigate("/business-owner/profile");
      }}
      style={({ pressed }) => [
        styles.glassButton,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.buttonContent}>
        <Feather name="briefcase" size={18} color={colors.primary[600]} />
        <Text style={styles.buttonText}>My Business</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>New</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  glassButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  badge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: "600",
  },
});

export default BusinessProfileButton;
