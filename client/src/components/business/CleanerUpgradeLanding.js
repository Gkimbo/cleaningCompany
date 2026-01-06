import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const CleanerUpgradeLanding = ({ state }) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();

  // Calculate dynamic percentages from pricing config
  const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.1;
  const keepPercent = Math.round((1 - businessOwnerFee) * 100);
  const feePercent = Math.round(businessOwnerFee * 100);

  // Redirect if already a business owner
  useEffect(() => {
    if (state?.isBusinessOwner) {
      navigate("/my-clients");
    }
  }, [state?.isBusinessOwner, navigate]);

  // Redirect if not logged in
  useEffect(() => {
    if (!state?.currentUser?.token) {
      navigate("/sign-in?redirect=/upgrade-to-business");
    }
  }, [state?.currentUser?.token, navigate]);

  // Redirect if not a cleaner
  useEffect(() => {
    if (state?.account && state.account !== "cleaner") {
      navigate("/");
    }
  }, [state?.account, navigate]);

  const benefits = [
    {
      icon: "users",
      title: "Manage Your Own Clients",
      description: "Invite and manage clients directly through the app",
    },
    {
      icon: "dollar-sign",
      title: `Keep ${keepPercent}% of Earnings`,
      description: `Only a small ${feePercent}% platform fee on client jobs`,
    },
    {
      icon: "repeat",
      title: "Recurring Schedules",
      description: "Set up weekly, bi-weekly, or monthly appointments",
    },
    {
      icon: "send",
      title: "Easy Client Invites",
      description: "Invite clients with one click via email",
    },
    {
      icon: "briefcase",
      title: "Still Work Platform Jobs",
      description: "Keep access to all regular platform appointments",
    },
    {
      icon: "credit-card",
      title: "Automatic Payments",
      description: "Get paid instantly when jobs are completed",
    },
  ];

  const considerations = [
    "You'll need to set your own prices for personal clients",
    "You're responsible for scheduling with your own clients",
    "Platform jobs and personal clients are managed separately",
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.primary[600], colors.primary[700]]}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigate("/")}
          >
            <Feather name="arrow-left" size={20} color={colors.neutral[0]} />
          </TouchableOpacity>

          <View style={styles.badge}>
            <Feather name="trending-up" size={14} color={colors.primary[200]} />
            <Text style={styles.badgeText}>Account Upgrade</Text>
          </View>

          <Text style={styles.title}>Become a Business Owner</Text>
          <Text style={styles.subtitle}>
            Upgrade your cleaner account to manage your own cleaning business
            while still having access to platform jobs.
          </Text>
        </LinearGradient>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>What You'll Get</Text>

          <View style={styles.benefitsGrid}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <Feather
                    name={benefit.icon}
                    size={24}
                    color={colors.primary[600]}
                  />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>
                    {benefit.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Considerations Section */}
        <View style={styles.considerationsSection}>
          <Text style={styles.sectionTitle}>Things to Know</Text>

          <View style={styles.considerationsBox}>
            {considerations.map((item, index) => (
              <View key={index} style={styles.considerationRow}>
                <Feather name="info" size={16} color={colors.warning[600]} />
                <Text style={styles.considerationText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigate("/upgrade-form")}
          >
            <Text style={styles.primaryButtonText}>Upgrade My Account</Text>
            <Feather name="arrow-right" size={20} color={colors.neutral[0]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigate("/")}
          >
            <Text style={styles.secondaryButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing["4xl"],
  },

  // Header
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing["3xl"],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.primary[100],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.neutral[0],
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.primary[100],
    lineHeight: 24,
  },

  // Benefits Section
  benefitsSection: {
    padding: spacing.xl,
    backgroundColor: colors.neutral[0],
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  benefitsGrid: {
    gap: spacing.md,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    ...shadows.sm,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Considerations Section
  considerationsSection: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  considerationsBox: {
    backgroundColor: colors.warning[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  considerationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  considerationText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 20,
  },

  // CTA Section
  ctaSection: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    marginRight: spacing.sm,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
});

export default CleanerUpgradeLanding;
