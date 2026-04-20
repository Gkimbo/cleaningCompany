import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography } from "../../services/styles/theme";
import { formatCurrency } from "../../services/formatters";

/**
 * LastMinutePriceBreakdown - Displays price with last minute fee indicator
 *
 * @param {string|number} basePrice - The base price before last minute fee (in cents)
 * @param {string|number} lastMinuteFee - The last minute fee amount (in cents)
 * @param {string|number} totalPrice - The final total price (in cents)
 * @param {string} size - Size variant: "sm", "md", "lg" (default: "md")
 */
const LastMinutePriceBreakdown = ({
  basePrice,
  lastMinuteFee,
  totalPrice,
  size = "md",
}) => {
  const feeCents = parseFloat(lastMinuteFee) || 0;
  const totalCents = parseFloat(totalPrice) || 0;

  // If no last minute fee, just show the total
  if (!feeCents || feeCents <= 0) {
    return (
      <Text style={[styles.totalPrice, styles[`totalPrice_${size}`]]}>
        {formatCurrency(totalCents)}
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.totalPrice, styles[`totalPrice_${size}`]]}>
        {formatCurrency(totalCents)}
      </Text>
      <View style={styles.badge}>
        <Icon name="clock-o" size={10} color={colors.warning[700]} />
        <Text style={styles.badgeText}>Incl. {formatCurrency(feeCents)} rush fee</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    gap: 4,
  },
  totalPrice: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  totalPrice_sm: { fontSize: typography.fontSize.sm },
  totalPrice_md: { fontSize: typography.fontSize.base },
  totalPrice_lg: { fontSize: typography.fontSize.lg },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
});

export default LastMinutePriceBreakdown;
