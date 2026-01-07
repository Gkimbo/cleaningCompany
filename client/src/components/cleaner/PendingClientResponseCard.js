/**
 * PendingClientResponseCard
 * Shows booking requests sent TO clients that are awaiting their response
 * Includes countdown timer for 48-hour expiration window
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import useCountdown from "../../hooks/useCountdown";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const PendingClientResponseCard = ({
  appointment,
  onMessage,
  onRebook,
  onCancel,
  loading,
}) => {
  const { timeRemaining, isExpired, isWarning, isUrgent } = useCountdown(
    appointment.expiresAt
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (price) => {
    if (!price) return "TBD";
    return `$${parseFloat(price).toFixed(2)}`;
  };

  // Determine the card status
  const getStatus = () => {
    if (appointment.clientResponse === "declined") {
      return { label: "Client Declined", type: "declined" };
    }
    if (isExpired) {
      return { label: "Expired", type: "expired" };
    }
    return { label: "Pending Response", type: "pending" };
  };

  const status = getStatus();
  const showRebookButton =
    status.type === "declined" ||
    status.type === "expired" ||
    appointment.clientResponse === "declined";

  // Check if rebooking is available (max 3 attempts)
  const canRebook = (appointment.rebookingAttempts || 0) < 3;

  return (
    <View
      style={[
        styles.card,
        status.type === "declined" && styles.declinedCard,
        status.type === "expired" && styles.expiredCard,
      ]}
    >
      {/* Status Badge Row */}
      <View style={styles.badgeRow}>
        <View
          style={[
            styles.statusBadge,
            status.type === "pending" && styles.pendingBadge,
            status.type === "declined" && styles.declinedBadge,
            status.type === "expired" && styles.expiredBadge,
          ]}
        >
          <Feather
            name={
              status.type === "pending"
                ? "clock"
                : status.type === "declined"
                ? "x-circle"
                : "alert-circle"
            }
            size={12}
            color={
              status.type === "pending"
                ? colors.warning[700]
                : status.type === "declined"
                ? colors.error[700]
                : colors.neutral[600]
            }
          />
          <Text
            style={[
              styles.statusText,
              status.type === "declined" && styles.declinedStatusText,
              status.type === "expired" && styles.expiredStatusText,
            ]}
          >
            {status.label}
          </Text>
        </View>

        {/* Countdown Timer */}
        {timeRemaining && status.type === "pending" && (
          <View
            style={[
              styles.timerBadge,
              isWarning && styles.timerBadgeWarning,
              isUrgent && styles.timerBadgeUrgent,
            ]}
          >
            <Feather name="clock" size={12} color={colors.neutral[0]} />
            <Text style={styles.timerText}>{timeRemaining}</Text>
          </View>
        )}
      </View>

      {/* Client and Home Info */}
      <View style={styles.header}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>
            {appointment.client?.name || "Client"}
          </Text>
          <Text style={styles.homeAddress} numberOfLines={1}>
            {appointment.home?.address || appointment.Home?.address || "Home"}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.messageButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onMessage && onMessage(appointment.client?.id)}
        >
          <Feather name="message-circle" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Appointment Details */}
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Feather name="calendar" size={14} color={colors.neutral[500]} />
          <Text style={styles.detailText}>{formatDate(appointment.date)}</Text>
        </View>
        {appointment.timeWindow && (
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={colors.neutral[500]} />
            <Text style={styles.detailText}>
              {appointment.timeWindow === "anytime"
                ? "Anytime"
                : appointment.timeWindow}
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Feather name="dollar-sign" size={14} color={colors.success[600]} />
          <Text style={[styles.detailText, styles.priceText]}>
            {formatPrice(appointment.price)}
          </Text>
        </View>
      </View>

      {/* Decline Reason (if declined) */}
      {appointment.clientResponse === "declined" && appointment.declineReason && (
        <View style={styles.declineReasonContainer}>
          <Text style={styles.declineReasonLabel}>Reason:</Text>
          <Text style={styles.declineReasonText}>{appointment.declineReason}</Text>
        </View>
      )}

      {/* Client's Suggested Dates (if provided) */}
      {appointment.clientResponse === "declined" &&
        appointment.clientSuggestedDates?.length > 0 && (
          <View style={styles.suggestedDatesContainer}>
            <Text style={styles.suggestedDatesLabel}>Client suggested:</Text>
            <View style={styles.suggestedDatesList}>
              {appointment.clientSuggestedDates.map((date, index) => (
                <View key={index} style={styles.suggestedDateChip}>
                  <Text style={styles.suggestedDateText}>
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

      {/* Action Buttons */}
      {showRebookButton && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={() => onCancel && onCancel(appointment)}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          {canRebook && (
            <Pressable
              style={({ pressed }) => [
                styles.rebookButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={() => onRebook && onRebook(appointment)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color={colors.neutral[0]} />
                  <Text style={styles.rebookButtonText}>Rebook</Text>
                </>
              )}
            </Pressable>
          )}
          {!canRebook && (
            <View style={styles.maxAttemptsNote}>
              <Text style={styles.maxAttemptsText}>
                Max rebooking attempts reached
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  declinedCard: {
    borderLeftColor: colors.error[500],
    backgroundColor: colors.error[50],
  },
  expiredCard: {
    borderLeftColor: colors.neutral[400],
    backgroundColor: colors.neutral[100],
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
  },
  pendingBadge: {
    backgroundColor: colors.warning[100],
  },
  declinedBadge: {
    backgroundColor: colors.error[100],
  },
  expiredBadge: {
    backgroundColor: colors.neutral[200],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.warning[700],
  },
  declinedStatusText: {
    color: colors.error[700],
  },
  expiredStatusText: {
    color: colors.neutral[600],
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary[500],
  },
  timerBadgeWarning: {
    backgroundColor: colors.warning[500],
  },
  timerBadgeUrgent: {
    backgroundColor: colors.error[500],
  },
  timerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "700",
    color: colors.neutral[0],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  clientInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  clientName: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[900],
  },
  homeAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    marginTop: 2,
  },
  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  priceText: {
    fontWeight: "700",
    color: colors.success[600],
  },
  declineReasonContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
  },
  declineReasonLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.error[700],
    marginBottom: 2,
  },
  declineReasonText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[800],
  },
  suggestedDatesContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },
  suggestedDatesLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  suggestedDatesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  suggestedDateChip: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  suggestedDateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "500",
    color: colors.primary[700],
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  rebookButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  rebookButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "700",
    color: colors.neutral[0],
  },
  maxAttemptsNote: {
    flex: 2,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  maxAttemptsText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    fontStyle: "italic",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default PendingClientResponseCard;
