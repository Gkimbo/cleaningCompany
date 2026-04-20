import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import SecureStorage from "../../services/SecureStorage";
import { colors, spacing, radius, typography } from "../../services/styles/theme";

/**
 * RoleToggle - Allows dual-role users (cleaner + homeowner) to switch views
 * Only shown for cleaners who also have homes registered
 */
const RoleToggle = ({ activeRole, dispatch, closeModal, isOffline = false, hasPaymentMethod = false, stripeConnectComplete = false }) => {
  const navigate = useNavigate();
  const [isToggling, setIsToggling] = useState(false);
  const isHomeownerView = activeRole === "homeowner";
  const isDisabled = isToggling || isOffline;

  const handleToggle = async () => {
    // Prevent toggling in offline mode
    if (isOffline) {
      Alert.alert("Offline", "You cannot switch roles while offline.");
      return;
    }
    // Prevent rapid toggling
    if (isToggling) return;
    setIsToggling(true);

    const newRole = isHomeownerView ? "cleaner" : "homeowner";

    try {
      // Persist preference first
      await SecureStorage.setItem("activeRole", newRole);
      // Update state with explicit role (ensures storage and state match)
      dispatch({ type: "SET_ACTIVE_ROLE", payload: newRole });
      // Close modal
      closeModal();

      // If switching to homeowner and no payment method, redirect to payment setup
      if (newRole === "homeowner" && !hasPaymentMethod) {
        navigate("/payment-setup");
      } else if (newRole === "cleaner" && !stripeConnectComplete) {
        // If switching to cleaner and Stripe Connect not complete, redirect to earnings/onboarding
        navigate("/earnings");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Failed to save role preference:", err);
      Alert.alert("Error", "Could not save your preference. Please try again.");
      setIsToggling(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerLabel}>Switch View</Text>
      <View style={styles.toggleTrack}>
        {/* Cleaner Option */}
        <Pressable
          style={[
            styles.toggleOption,
            !isHomeownerView && styles.toggleOptionActive,
          ]}
          onPress={isHomeownerView ? handleToggle : undefined}
          disabled={isDisabled || !isHomeownerView}
        >
          <Feather
            name="briefcase"
            size={16}
            color={!isHomeownerView ? colors.primary[600] : "rgba(255, 255, 255, 0.5)"}
          />
          <Text style={[
            styles.toggleText,
            !isHomeownerView && styles.toggleTextActive,
          ]}>
            Cleaner
          </Text>
        </Pressable>

        {/* Homeowner Option */}
        <Pressable
          style={[
            styles.toggleOption,
            isHomeownerView && styles.toggleOptionActive,
          ]}
          onPress={!isHomeownerView ? handleToggle : undefined}
          disabled={isDisabled || isHomeownerView}
        >
          <Feather
            name="home"
            size={16}
            color={isHomeownerView ? colors.secondary[600] : "rgba(255, 255, 255, 0.5)"}
          />
          <Text style={[
            styles.toggleText,
            isHomeownerView && styles.toggleTextActive,
          ]}>
            Homeowner
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  headerLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: "rgba(255, 255, 255, 0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  toggleTrack: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  toggleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  toggleOptionActive: {
    backgroundColor: colors.neutral[0],
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: "rgba(255, 255, 255, 0.5)",
  },
  toggleTextActive: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default RoleToggle;
