import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import useCountdown from "../../hooks/useCountdown";

const PendingBookingCard = ({ booking, onPress, onAccept, onDecline }) => {
  const { timeRemaining, isExpired, isWarning, isUrgent } = useCountdown(booking.expiresAt);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { weekday: "long", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return "Price TBD";
    return `$${parseFloat(price).toFixed(2)}`;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        isExpired && styles.expiredContainer,
      ]}
      onPress={onPress}
    >
      {/* Header with urgency indicator */}
      <View style={styles.header}>
        <View style={styles.urgentBadge}>
          <Feather name="clock" size={14} color={colors.warning[700]} />
          <Text style={styles.urgentText}>
            {isExpired ? "Expired" : "Action Required"}
          </Text>
        </View>
        {timeRemaining && !isExpired && (
          <View style={[
            styles.timerBadge,
            isUrgent && styles.timerBadgeUrgent,
            isWarning && styles.timerBadgeWarning,
          ]}>
            <Text style={styles.timerText}>{timeRemaining}</Text>
          </View>
        )}
      </View>

      {/* Booking Info */}
      <View style={styles.content}>
        <Text style={styles.title}>Booking Request</Text>
        <Text style={styles.businessName}>
          from {booking.cleanerBusiness?.name || "Your Cleaning Service"}
        </Text>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Feather name="calendar" size={16} color={colors.neutral[500]} />
            <Text style={styles.detailText}>{formatDate(booking.date)}</Text>
          </View>
          {booking.timeWindow && (
            <View style={styles.detailItem}>
              <Feather name="clock" size={16} color={colors.neutral[500]} />
              <Text style={styles.detailText}>{booking.timeWindow}</Text>
            </View>
          )}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Quoted Price:</Text>
          <Text style={styles.priceValue}>{formatPrice(booking.price)}</Text>
        </View>

        {booking.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            Note: {booking.notes}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      {!isExpired && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.declineButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onDecline && onDecline(booking);
            }}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onAccept && onAccept(booking);
            }}
          >
            <Feather name="check" size={18} color={colors.neutral[0]} />
            <Text style={styles.acceptButtonText}>Accept Booking</Text>
          </Pressable>
        </View>
      )}

      {isExpired && (
        <View style={styles.expiredMessage}>
          <Text style={styles.expiredText}>
            This booking request has expired
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 2,
    borderColor: colors.warning[400],
    ...shadows.md,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  expiredContainer: {
    borderColor: colors.neutral[300],
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  urgentText: {
    fontSize: typography.sizes.xs,
    fontWeight: "600",
    color: colors.warning[700],
  },
  timerBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  timerBadgeWarning: {
    backgroundColor: colors.warning[500],
  },
  timerBadgeUrgent: {
    backgroundColor: colors.error[500],
  },
  timerText: {
    fontSize: typography.sizes.xs,
    fontWeight: "700",
    color: colors.neutral[0],
  },
  content: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: "700",
    color: colors.neutral[900],
    marginBottom: 2,
  },
  businessName: {
    fontSize: typography.sizes.sm,
    color: colors.neutral[600],
    marginBottom: spacing.sm,
  },
  detailsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral[700],
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  priceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral[600],
  },
  priceValue: {
    fontSize: typography.sizes.lg,
    fontWeight: "700",
    color: colors.success[600],
  },
  notes: {
    fontSize: typography.sizes.sm,
    color: colors.neutral[500],
    fontStyle: "italic",
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.md,
  },
  declineButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  declineButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  acceptButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.success[500],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  acceptButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: "700",
    color: colors.neutral[0],
  },
  expiredMessage: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.md,
    alignItems: "center",
  },
  expiredText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral[500],
  },
});

export default PendingBookingCard;
