import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import SecureStorage from "../../services/SecureStorage";
import { colors, spacing, radius, typography } from "../../services/styles/theme";

/**
 * RoleToggle - Allows dual-role users (cleaner + homeowner) to switch views
 * Only shown for cleaners who also have homes registered
 */
const RoleToggle = ({ activeRole, dispatch, closeModal }) => {
  const navigate = useNavigate();
  const isHomeownerView = activeRole === "homeowner";

  const handleToggle = async () => {
    const newRole = isHomeownerView ? "cleaner" : "homeowner";
    // Persist preference
    await SecureStorage.setItem("activeRole", newRole);
    // Update state
    dispatch({ type: "TOGGLE_ROLE" });
    // Close modal and navigate home to refresh dashboard
    closeModal();
    navigate("/");
  };

  return (
    <View style={styles.container}>
      <View style={styles.roleInfo}>
        <View style={[styles.iconContainer, isHomeownerView ? styles.homeownerIcon : styles.cleanerIcon]}>
          <Feather
            name={isHomeownerView ? "home" : "briefcase"}
            size={20}
            color={isHomeownerView ? colors.secondary[600] : colors.primary[600]}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.label}>Viewing as</Text>
          <Text style={styles.roleName}>
            {isHomeownerView ? "Homeowner" : "Cleaner"}
          </Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.switchButton,
          pressed && styles.switchButtonPressed,
        ]}
        onPress={handleToggle}
      >
        <Feather name="repeat" size={16} color={colors.neutral[0]} />
        <Text style={styles.switchText}>Switch</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  roleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  homeownerIcon: {
    backgroundColor: colors.secondary[100],
  },
  cleanerIcon: {
    backgroundColor: colors.primary[100],
  },
  textContainer: {
    gap: 2,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255, 255, 255, 0.6)",
  },
  roleName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  switchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  switchButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  switchText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
});

export default RoleToggle;
