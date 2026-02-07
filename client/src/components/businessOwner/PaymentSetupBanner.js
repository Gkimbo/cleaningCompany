import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { API_BASE } from "../../services/config";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const PaymentSetupBanner = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    const checkStripeStatus = async () => {
      if (!state?.currentUser?.id) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/stripe-connect/account-status/${state.currentUser.id}`
        );
        const data = await res.json();

        if (res.ok) {
          // Show banner if no account or onboarding not complete
          setNeedsSetup(!data.hasAccount || !data.onboardingComplete);
        }
      } catch (err) {
        console.log("Error checking stripe status:", err);
      } finally {
        setLoading(false);
      }
    };

    checkStripeStatus();
  }, [state?.currentUser?.id]);

  // Don't show anything while loading or if setup is complete
  if (loading || !needsSetup) {
    return null;
  }

  return (
    <Pressable
      style={styles.banner}
      onPress={() => navigate("/payout-setup")}
    >
      <View style={styles.iconContainer}>
        <Icon name="credit-card" size={20} color={colors.warning[600]} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Complete Payment Setup</Text>
        <Text style={styles.subtitle}>
          Set up your payout account to receive payments for completed jobs
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.warning[600]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
    gap: spacing.md,
    ...shadows.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: typography.fontSize.sm * 1.4,
  },
});

export default PaymentSetupBanner;
