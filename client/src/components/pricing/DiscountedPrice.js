import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../services/styles/theme";

/**
 * DiscountedPrice - Displays a crossed-off original price with discounted price in green
 *
 * @param {string|number} originalPrice - The original price before discount
 * @param {string|number} discountedPrice - The final price after discount
 * @param {boolean} showOriginal - Whether to show the original price (default: true)
 * @param {string} size - Size variant: "sm", "md", "lg" (default: "md")
 */
const DiscountedPrice = ({
  originalPrice,
  discountedPrice,
  showOriginal = true,
  size = "md",
}) => {
  // Parse prices to ensure they're numbers
  const original = parseFloat(originalPrice);
  const discounted = parseFloat(discountedPrice);

  // If no discount was actually applied, just show the price normally
  if (!originalPrice || original === discounted) {
    return (
      <Text style={[styles.price, styles[`price_${size}`]]}>
        ${discounted.toFixed(2)}
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {showOriginal && (
        <Text style={[styles.originalPrice, styles[`originalPrice_${size}`]]}>
          ${original.toFixed(2)}
        </Text>
      )}
      <Text style={[styles.discountedPrice, styles[`discountedPrice_${size}`]]}>
        ${discounted.toFixed(2)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  price: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  price_sm: {
    fontSize: typography.fontSize.sm,
  },
  price_md: {
    fontSize: typography.fontSize.base,
  },
  price_lg: {
    fontSize: typography.fontSize.lg,
  },
  originalPrice: {
    color: colors.text.tertiary,
    textDecorationLine: "line-through",
    fontWeight: typography.fontWeight.medium,
  },
  originalPrice_sm: {
    fontSize: typography.fontSize.xs,
  },
  originalPrice_md: {
    fontSize: typography.fontSize.sm,
  },
  originalPrice_lg: {
    fontSize: typography.fontSize.base,
  },
  discountedPrice: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
  },
  discountedPrice_sm: {
    fontSize: typography.fontSize.sm,
  },
  discountedPrice_md: {
    fontSize: typography.fontSize.base,
  },
  discountedPrice_lg: {
    fontSize: typography.fontSize.lg,
  },
});

export default DiscountedPrice;
