import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { usePricing, calculateBasePrice } from "../../context/PricingContext";

const MyCleanerCard = ({ cleaner, relationship, home, onMessage, onViewProfile }) => {
  const { pricing } = usePricing();

  if (!cleaner) return null;

  // Calculate platform price for comparison
  const getPlatformPrice = () => {
    if (!home || !pricing) return null;
    return calculateBasePrice(pricing, home.numBeds, home.numBaths);
  };

  const platformPrice = getPlatformPrice();
  const cleanerPrice = relationship?.defaultPrice;
  const savings = platformPrice && cleanerPrice ? platformPrice - cleanerPrice : null;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const frequencyText = {
    weekly: "Weekly",
    biweekly: "Every 2 Weeks",
    monthly: "Monthly",
    on_demand: "On Demand",
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="user-check" size={16} color={colors.primary[600]} />
        </View>
        <Text style={styles.headerTitle}>Your Cleaner</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.cleanerInfo}>
          {cleaner.profilePhoto ? (
            <Image
              source={{ uri: cleaner.profilePhoto }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {cleaner.firstName?.charAt(0) || "C"}
              </Text>
            </View>
          )}

          <View style={styles.nameContainer}>
            <Text style={styles.cleanerName}>
              {cleaner.firstName} {cleaner.lastName}
            </Text>
            {cleaner.averageRating && (
              <View style={styles.ratingContainer}>
                <Feather name="star" size={12} color={colors.warning[500]} />
                <Text style={styles.ratingText}>
                  {cleaner.averageRating} ({cleaner.totalReviews} reviews)
                </Text>
              </View>
            )}
            {relationship?.since && (
              <Text style={styles.sinceText}>
                Client since {formatDate(relationship.since)}
              </Text>
            )}
          </View>
        </View>

        {/* Pricing Section */}
        {cleanerPrice && (
          <View style={styles.pricingSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Your Rate</Text>
              <Text style={styles.priceValue}>${cleanerPrice}/cleaning</Text>
            </View>
            {savings > 0 && (
              <View style={styles.savingsRow}>
                <Feather name="check-circle" size={14} color={colors.success[600]} />
                <Text style={styles.savingsText}>
                  Save ${savings} vs platform rate
                </Text>
              </View>
            )}
          </View>
        )}

        {relationship && (
          <View style={styles.relationshipInfo}>
            {relationship.defaultFrequency && (
              <View style={styles.infoPill}>
                <Feather name="repeat" size={12} color={colors.primary[600]} />
                <Text style={styles.infoPillText}>
                  {frequencyText[relationship.defaultFrequency] || relationship.defaultFrequency}
                </Text>
              </View>
            )}
            {relationship.autoPayEnabled && (
              <View style={[styles.infoPill, styles.autoPayPill]}>
                <Feather name="credit-card" size={12} color={colors.success[600]} />
                <Text style={[styles.infoPillText, styles.autoPayText]}>
                  Auto-Pay On
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.actions}>
          {onMessage && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={onMessage}
            >
              <Feather name="message-circle" size={16} color={colors.primary[600]} />
              <Text style={styles.actionButtonText}>Message</Text>
            </Pressable>
          )}
          {onViewProfile && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonSecondary,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={onViewProfile}
            >
              <Feather name="user" size={16} color={colors.text.secondary} />
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                View Profile
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  content: {
    padding: spacing.lg,
  },
  cleanerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  nameContainer: {
    flex: 1,
  },
  cleanerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  sinceText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  pricingSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  priceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  savingsText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  relationshipInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  infoPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  autoPayPill: {
    backgroundColor: colors.success[50],
  },
  autoPayText: {
    color: colors.success[700],
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  actionButtonSecondary: {
    backgroundColor: colors.neutral[100],
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  actionButtonTextSecondary: {
    color: colors.text.secondary,
  },
});

export default MyCleanerCard;
