import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../../services/styles/theme";
import useCountdown from "../../hooks/useCountdown";

const NotificationCard = ({ notification, onPress, onMarkRead, onRebook }) => {
  // Use countdown hook for live updates on expiring notifications
  const { timeRemaining, isExpired, isWarning, isUrgent } = useCountdown(notification.expiresAt);

  const getIcon = () => {
    switch (notification.type) {
      case "pending_booking":
        return { name: "calendar", color: colors.warning[500] };
      case "booking_accepted":
        return { name: "check-circle", color: colors.success[500] };
      case "booking_declined":
        return { name: "x-circle", color: colors.error[500] };
      case "booking_expired":
        return { name: "clock", color: colors.neutral[500] };
      case "business_owner_declined":
        return { name: "alert-circle", color: colors.warning[500] };
      case "client_booked":
        return { name: "calendar", color: colors.primary[500] };
      case "client_opened_to_marketplace":
        return { name: "shopping-bag", color: colors.primary[500] };
      case "client_cancelled_after_decline":
        return { name: "x-circle", color: colors.error[500] };
      default:
        return { name: "bell", color: colors.primary[500] };
    }
  };

  const icon = getIcon();
  const isUnread = !notification.isRead;

  // Format time ago
  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Check if this notification type can be rebooked
  const canRebook =
    (notification.type === "booking_expired" || notification.type === "booking_declined") &&
    notification.data?.appointmentId &&
    (notification.data?.rebookingAttempts || 0) < 3;

  // Get expiration display text
  const getExpirationText = () => {
    if (!notification.expiresAt) return null;
    if (isExpired) return "Expired";
    return timeRemaining;
  };

  const expirationText = getExpirationText();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isUnread && styles.unreadContainer,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
        <Feather name={icon.name} size={20} color={icon.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isUnread && styles.unreadTitle]} numberOfLines={1}>
            {notification.title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.time}>{getTimeAgo(notification.createdAt)}</Text>
          {expirationText && (
            <View
              style={[
                styles.expiresContainer,
                isWarning && styles.expiresContainerWarning,
                isUrgent && styles.expiresContainerUrgent,
                isExpired && styles.expiresContainerExpired,
              ]}
            >
              <Feather
                name="clock"
                size={12}
                color={
                  isExpired ? colors.neutral[600] :
                  isUrgent ? colors.error[600] :
                  isWarning ? colors.warning[600] :
                  colors.primary[600]
                }
              />
              <Text
                style={[
                  styles.expiresText,
                  isWarning && styles.expiresTextWarning,
                  isUrgent && styles.expiresTextUrgent,
                  isExpired && styles.expiresTextExpired,
                ]}
              >
                {expirationText}
              </Text>
            </View>
          )}
        </View>

        {notification.actionRequired && (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>Action Required</Text>
          </View>
        )}

        {/* Rebook button for expired/declined notifications */}
        {canRebook && onRebook && (
          <Pressable
            style={({ pressed }) => [
              styles.rebookButton,
              pressed && styles.rebookButtonPressed,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onRebook(notification);
            }}
          >
            <Feather name="refresh-cw" size={14} color={colors.neutral[0]} />
            <Text style={styles.rebookButtonText}>Rebook</Text>
          </Pressable>
        )}
      </View>

      <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  unreadContainer: {
    backgroundColor: colors.primary[50],
  },
  pressed: {
    backgroundColor: colors.neutral[100],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: "500",
    color: colors.neutral[700],
    flex: 1,
  },
  unreadTitle: {
    fontWeight: "600",
    color: colors.neutral[900],
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
    marginLeft: spacing.sm,
  },
  body: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  time: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  expiresContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  expiresContainerWarning: {
    backgroundColor: colors.warning[50],
  },
  expiresContainerUrgent: {
    backgroundColor: colors.error[50],
  },
  expiresContainerExpired: {
    backgroundColor: colors.neutral[100],
  },
  expiresText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: "500",
  },
  expiresTextWarning: {
    color: colors.warning[600],
  },
  expiresTextUrgent: {
    color: colors.error[600],
  },
  expiresTextExpired: {
    color: colors.neutral[600],
  },
  rebookButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  rebookButtonPressed: {
    opacity: 0.8,
  },
  rebookButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.neutral[0],
  },
  actionBadge: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  actionBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: "600",
  },
});

export default NotificationCard;
