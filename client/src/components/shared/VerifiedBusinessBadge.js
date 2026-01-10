import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

/**
 * VerifiedBusinessBadge - Displays a badge for verified business owners
 *
 * Props:
 * - businessName: string - Name of the business (optional)
 * - yearsInBusiness: number - Years the business has been operating (optional)
 * - clientCount: number - Number of active clients (optional)
 * - size: 'small' | 'medium' | 'large' - Badge size (default: 'medium')
 * - variant: 'badge' | 'card' | 'inline' - Display variant (default: 'badge')
 * - showDetails: boolean - Whether to show expanded details (default: false)
 * - onPress: function - Callback when badge is pressed (optional)
 */
const VerifiedBusinessBadge = ({
  businessName,
  yearsInBusiness,
  clientCount,
  size = "medium",
  variant = "badge",
  showDetails = false,
  onPress,
}) => {
  // Size configurations
  const sizeConfig = {
    small: {
      iconSize: 10,
      fontSize: typography.fontSize.xs,
      paddingH: spacing.xs,
      paddingV: 2,
      gap: 3,
    },
    medium: {
      iconSize: 12,
      fontSize: typography.fontSize.sm,
      paddingH: spacing.sm,
      paddingV: 4,
      gap: 4,
    },
    large: {
      iconSize: 14,
      fontSize: typography.fontSize.base,
      paddingH: spacing.md,
      paddingV: spacing.xs,
      gap: spacing.xs,
    },
  };

  const config = sizeConfig[size];

  // Simple badge variant
  if (variant === "badge") {
    const BadgeContent = (
      <View
        style={[
          styles.badge,
          {
            paddingHorizontal: config.paddingH,
            paddingVertical: config.paddingV,
          },
        ]}
      >
        <Icon name="check-circle" size={config.iconSize} color={colors.success[600]} />
        <Text
          style={[
            styles.badgeText,
            { fontSize: config.fontSize, marginLeft: config.gap },
          ]}
        >
          Verified Business
        </Text>
      </View>
    );

    if (onPress) {
      return <Pressable onPress={onPress}>{BadgeContent}</Pressable>;
    }
    return BadgeContent;
  }

  // Inline variant (for use in lists)
  if (variant === "inline") {
    return (
      <View style={styles.inline}>
        <Icon name="check-circle" size={config.iconSize} color={colors.success[600]} />
        <Text
          style={[
            styles.inlineText,
            { fontSize: config.fontSize, marginLeft: config.gap },
          ]}
        >
          Verified
        </Text>
      </View>
    );
  }

  // Card variant (expanded with details)
  if (variant === "card") {
    const CardContent = (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardBadge}>
            <Icon name="check-circle" size={16} color={colors.success[600]} />
            <Text style={styles.cardBadgeText}>Verified Business</Text>
          </View>
        </View>

        {(businessName || showDetails) && (
          <View style={styles.cardContent}>
            {businessName && (
              <Text style={styles.businessName}>{businessName}</Text>
            )}

            <View style={styles.cardDetails}>
              {yearsInBusiness !== undefined && yearsInBusiness > 0 && (
                <View style={styles.detailItem}>
                  <Icon name="calendar" size={12} color={colors.neutral[500]} />
                  <Text style={styles.detailText}>
                    {yearsInBusiness} {yearsInBusiness === 1 ? "year" : "years"} in business
                  </Text>
                </View>
              )}

              {clientCount !== undefined && clientCount > 0 && (
                <View style={styles.detailItem}>
                  <Icon name="users" size={12} color={colors.neutral[500]} />
                  <Text style={styles.detailText}>
                    Trusted by {clientCount}+ clients
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );

    if (onPress) {
      return <Pressable onPress={onPress}>{CardContent}</Pressable>;
    }
    return CardContent;
  }

  return null;
};

/**
 * VerifiedBadgeSmall - Convenience component for small inline badge
 */
export const VerifiedBadgeSmall = (props) => (
  <VerifiedBusinessBadge size="small" variant="inline" {...props} />
);

/**
 * VerifiedBadgeLarge - Convenience component for large card
 */
export const VerifiedBadgeLarge = (props) => (
  <VerifiedBusinessBadge size="large" variant="card" showDetails {...props} />
);

const styles = StyleSheet.create({
  // Badge variant styles
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  badgeText: {
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Inline variant styles
  inline: {
    flexDirection: "row",
    alignItems: "center",
  },
  inlineText: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Card variant styles
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
    overflow: "hidden",
  },
  cardHeader: {
    backgroundColor: colors.success[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.success[100],
  },
  cardBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
    marginLeft: spacing.xs,
  },
  cardContent: {
    padding: spacing.md,
  },
  businessName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  cardDetails: {
    gap: spacing.xs,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
});

export default VerifiedBusinessBadge;
