import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const AuditTrailSection = ({ auditTrail, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  if (!auditTrail || auditTrail.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="history" size={48} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Activity</Text>
        <Text style={styles.emptyText}>
          No audit events recorded for this case.
        </Text>
      </View>
    );
  }

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getEventIcon = (eventType) => {
    const iconMap = {
      appeal_submitted: "paper-plane",
      appeal_assigned: "user-plus",
      appeal_status_changed: "refresh",
      appeal_resolved: "gavel",
      appeal_documents_uploaded: "file-text",
      cancellation_initiated: "times-circle",
      cancellation_confirmed: "check-circle",
      refund_initiated: "credit-card",
      refund_completed: "money",
      payout_created: "exchange",
      payout_completed: "check",
      fee_charge_succeeded: "usd",
      fee_charge_failed: "exclamation-triangle",
      notification_sent_email: "envelope",
      notification_sent_push: "bell",
    };
    return iconMap[eventType] || "circle";
  };

  const getEventColor = (eventType) => {
    if (eventType.includes("completed") || eventType.includes("resolved") || eventType.includes("approved")) {
      return colors.success[500];
    }
    if (eventType.includes("failed") || eventType.includes("denied")) {
      return colors.error[500];
    }
    if (eventType.includes("refund") || eventType.includes("payout")) {
      return colors.warning[500];
    }
    return colors.primary[500];
  };

  const formatEventType = (eventType) => {
    return eventType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatEventData = (eventData) => {
    if (!eventData) return null;
    const parts = [];
    if (eventData.amount) {
      parts.push(`$${(eventData.amount / 100).toFixed(2)}`);
    }
    if (eventData.decision) {
      parts.push(`Decision: ${eventData.decision}`);
    }
    if (eventData.reason) {
      parts.push(eventData.reason);
    }
    if (eventData.notes) {
      parts.push(eventData.notes);
    }
    return parts.length > 0 ? parts.join(" - ") : null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Icon name="history" size={18} color={colors.primary[600]} />
        <Text style={styles.headerTitle}>Activity Timeline</Text>
        <View style={styles.eventCount}>
          <Text style={styles.eventCountText}>{auditTrail.length} events</Text>
        </View>
      </View>

      <View style={styles.timelineContainer}>
        {auditTrail.map((event, index) => {
          const eventColor = getEventColor(event.eventType);
          const isLast = index === auditTrail.length - 1;

          return (
            <View key={event.id || index} style={styles.timelineItem}>
              {/* Timeline connector */}
              <View style={styles.timelineConnector}>
                <View style={[styles.timelineDot, { backgroundColor: eventColor }]}>
                  <Icon
                    name={getEventIcon(event.eventType)}
                    size={10}
                    color={colors.neutral[0]}
                  />
                </View>
                {!isLast && <View style={styles.timelineLine} />}
              </View>

              {/* Event content */}
              <View style={styles.eventContent}>
                <View style={styles.eventHeader}>
                  <Text style={[styles.eventType, { color: eventColor }]}>
                    {formatEventType(event.eventType)}
                  </Text>
                  <Text style={styles.eventTime}>{formatDate(event.occurredAt)}</Text>
                </View>

                {event.actor && (
                  <View style={styles.actorRow}>
                    <Icon name="user" size={10} color={colors.text.tertiary} />
                    <Text style={styles.actorText}>
                      {event.actor.name || "System"}
                    </Text>
                    {event.actorType && event.actorType !== "system" && (
                      <View style={styles.actorTypeBadge}>
                        <Text style={styles.actorTypeText}>{event.actorType}</Text>
                      </View>
                    )}
                  </View>
                )}

                {event.isSystemGenerated && !event.actor && (
                  <View style={styles.actorRow}>
                    <Icon name="cog" size={10} color={colors.text.tertiary} />
                    <Text style={styles.actorText}>System</Text>
                  </View>
                )}

                {formatEventData(event.eventData) && (
                  <View style={styles.eventDataContainer}>
                    <Text style={styles.eventDataText}>
                      {formatEventData(event.eventData)}
                    </Text>
                  </View>
                )}

                {event.previousState && event.newState && (
                  <View style={styles.stateChange}>
                    <Text style={styles.stateChangeText}>
                      {event.previousState.status && (
                        <>
                          <Text style={styles.stateValue}>{event.previousState.status}</Text>
                          <Icon name="arrow-right" size={10} color={colors.text.tertiary} />
                          <Text style={[styles.stateValue, { color: eventColor }]}>
                            {event.newState.status}
                          </Text>
                        </>
                      )}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  eventCount: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  eventCountText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  timelineContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  timelineItem: {
    flexDirection: "row",
    gap: spacing.md,
  },
  timelineConnector: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border.light,
    marginTop: -2,
  },
  eventContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  eventType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  eventTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  actorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  actorText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  actorTypeBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  actorTypeText: {
    fontSize: 9,
    color: colors.text.tertiary,
    textTransform: "uppercase",
  },
  eventDataContainer: {
    backgroundColor: colors.neutral[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  eventDataText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  stateChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  stateChangeText: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  stateValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textTransform: "capitalize",
  },
});

export default AuditTrailSection;
