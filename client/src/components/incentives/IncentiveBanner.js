import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

/**
 * IncentiveBanner - Displays promotional incentive banners on landing pages
 *
 * @param {string} type - "cleaner" or "homeowner" to style appropriately
 * @param {string} message - The promotional message to display
 * @param {string} icon - Feather icon name (default: "gift")
 */
const IncentiveBanner = ({ type = "cleaner", message, icon = "gift" }) => {
  const isCleaner = type === "cleaner";

  return (
    <View style={[styles.banner, isCleaner ? styles.cleanerBanner : styles.homeownerBanner]}>
      <View style={[styles.iconContainer, isCleaner ? styles.cleanerIcon : styles.homeownerIcon]}>
        <Feather
          name={icon}
          size={20}
          color={isCleaner ? colors.success[700] : colors.secondary[700]}
        />
      </View>
      <Text style={[styles.bannerText, isCleaner ? styles.cleanerText : styles.homeownerText]}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  cleanerBanner: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  homeownerBanner: {
    backgroundColor: colors.secondary[50],
    borderColor: colors.secondary[200],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cleanerIcon: {
    backgroundColor: colors.success[100],
  },
  homeownerIcon: {
    backgroundColor: colors.secondary[100],
  },
  bannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 20,
  },
  cleanerText: {
    color: colors.success[700],
  },
  homeownerText: {
    color: colors.secondary[700],
  },
});

export default IncentiveBanner;
