import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

/**
 * Compact job card used during reorder mode
 * Shows minimal info with drag handle
 */
const CompactJobCard = ({
  appointment,
  home,
  payout,
  drag,
  isActive,
  index,
}) => {
  // Format time window for display
  const formatTimeWindow = (timeToBeCompleted) => {
    if (!timeToBeCompleted || timeToBeCompleted.toLowerCase() === "anytime") {
      return "Anytime";
    }
    // Extract just the start time (e.g., "10am-3pm" -> "10am")
    const parts = timeToBeCompleted.split("-");
    return parts[0]?.trim() || timeToBeCompleted;
  };

  // Get address display
  const getAddress = () => {
    if (home?.address) {
      // Truncate long addresses
      const addr = home.address;
      return addr.length > 25 ? addr.substring(0, 25) + "..." : addr;
    }
    return "Loading...";
  };

  return (
    <TouchableOpacity
      onLongPress={drag}
      delayLongPress={150}
      disabled={isActive}
      activeOpacity={0.9}
      style={[
        styles.container,
        isActive && styles.containerActive,
      ]}
    >
      {/* Drag Handle */}
      <View style={styles.dragHandle}>
        <Icon name="bars" size={16} color={isActive ? colors.primary[600] : colors.neutral[400]} />
      </View>

      {/* Job Number */}
      <View style={styles.indexBadge}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>

      {/* Job Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.addressText} numberOfLines={1}>
          {getAddress()}
        </Text>
        <View style={styles.detailsRow}>
          <Icon name="clock-o" size={10} color={colors.neutral[500]} />
          <Text style={styles.timeText}>
            {formatTimeWindow(appointment.timeToBeCompleted)}
          </Text>
          {home?.numBeds && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.detailText}>
                {home.numBeds}bd {home.numBaths}ba
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Payout */}
      <View style={styles.payoutContainer}>
        <Text style={styles.payoutText}>${payout.toFixed(0)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  containerActive: {
    ...shadows.lg,
    borderColor: colors.primary[400],
    backgroundColor: colors.primary[50],
    transform: [{ scale: 1.02 }],
  },
  dragHandle: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  indexText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  infoContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  addressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[600],
  },
  separator: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  detailText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  payoutContainer: {
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  payoutText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
});

export default CompactJobCard;
