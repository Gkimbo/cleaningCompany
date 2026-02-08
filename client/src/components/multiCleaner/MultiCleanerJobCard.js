/**
 * MultiCleanerJobCard
 * Displays a multi-cleaner job opportunity with slots, earnings preview, and room assignments
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
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const MultiCleanerJobCard = ({
  job,
  onViewDetails,
  onAccept,
  onDecline,
  onJoinTeam,
  onBookWithTeam,
  loading = false,
  showActions = true,
  isOffer = false,
  expiresAt = null,
  isBusinessOwner = false,
  hasEmployees = false,
  timeToBeCompleted = null,
}) => {
  // Check if there's a specific time constraint (not "anytime")
  const hasTimeConstraint = timeToBeCompleted &&
    timeToBeCompleted.toLowerCase() !== "anytime";
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (amount) => {
    if (!amount) return "TBD";
    // Prices are stored in dollars
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const formatTime = (dateString) => {
    if (!dateString) return null;
    const now = new Date();
    const expires = new Date(dateString);
    const diff = expires - now;

    if (diff <= 0) return { text: "Expired", urgent: true };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return { text: `${days}d left`, urgent: false };
    }
    if (hours > 0) {
      return { text: `${hours}h ${minutes}m left`, urgent: hours <= 6 };
    }
    return { text: `${minutes}m left`, urgent: true };
  };

  const slotsRemaining = job.totalCleanersRequired - job.cleanersConfirmed;
  const slotsFilled = job.cleanersConfirmed;
  const timeRemaining = expiresAt ? formatTime(expiresAt) : null;

  // Determine badge style based on status
  const getBadgeStyle = () => {
    if (job.status === "filled") {
      return { bg: colors.success[100], text: colors.success[700], label: "Filled" };
    }
    if (slotsRemaining === 1) {
      return { bg: colors.warning[100], text: colors.warning[700], label: "1 Slot Left!" };
    }
    return { bg: colors.primary[100], text: colors.primary[700], label: `${slotsRemaining} Slots Open` };
  };

  const badge = getBadgeStyle();

  return (
    <View style={styles.card}>
      {/* Header Row with Badge */}
      <View style={styles.headerRow}>
        <View style={styles.teamBadge}>
          <Feather name="users" size={14} color={colors.primary[600]} />
          <Text style={styles.teamText}>Team Clean</Text>
        </View>

        <View style={[styles.slotBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.slotText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Date and Location */}
        <View style={styles.infoRow}>
          <Feather name="calendar" size={16} color={colors.neutral[500]} />
          <Text style={styles.dateText}>{formatDate(job.appointmentDate)}</Text>
        </View>

        {job.address && (
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={16} color={colors.neutral[500]} />
            <Text style={styles.addressText} numberOfLines={1}>
              {job.address}
            </Text>
          </View>
        )}

        {/* Distance and Home Size */}
        <View style={styles.detailsRow}>
          {job.numBeds != null && job.numBaths != null && (
            <Text style={styles.detailText}>
              {job.numBeds} bed / {job.numBaths} bath
            </Text>
          )}
          {job.distance != null && (
            <Text style={styles.detailText}>
              {(job.distance * 0.621371).toFixed(1)} mi away
            </Text>
          )}
        </View>

        {/* Cleaners Visualization */}
        <View style={styles.cleanersRow}>
          <View style={styles.cleanerSlots}>
            {Array.from({ length: job.totalCleanersRequired }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.cleanerDot,
                  index < slotsFilled ? styles.filledDot : styles.openDot,
                ]}
              >
                <Feather
                  name="user"
                  size={12}
                  color={index < slotsFilled ? colors.white : colors.neutral[400]}
                />
              </View>
            ))}
          </View>
          <Text style={styles.slotsLabel}>
            {slotsFilled}/{job.totalCleanersRequired} cleaners confirmed
          </Text>
        </View>

        {/* Earnings Preview */}
        <View style={styles.earningsBox}>
          <View style={styles.earningsHeader}>
            <Feather name="dollar-sign" size={18} color={colors.success[600]} />
            <Text style={styles.earningsLabel}>Your Earnings</Text>
          </View>
          <Text style={styles.earningsAmount}>
            {formatPrice(job.perCleanerEarnings || job.earningsOffered)}
          </Text>
          {job.percentOfWork && (
            <Text style={styles.percentText}>({job.percentOfWork}% of job)</Text>
          )}
        </View>

        {/* Time Constraint */}
        {hasTimeConstraint && (
          <View style={styles.timeConstraintRow}>
            <Feather name="clock" size={12} color={colors.warning[600]} />
            <Text style={styles.timeConstraintText}>
              Complete by {timeToBeCompleted}
            </Text>
          </View>
        )}

        {/* Room Assignments Preview */}
        {job.assignedRooms && job.assignedRooms.length > 0 && (
          <View style={styles.roomsSection}>
            <Text style={styles.roomsLabel}>Your Assigned Rooms:</Text>
            <View style={styles.roomTags}>
              {job.assignedRooms.slice(0, 4).map((room, index) => (
                <View key={index} style={styles.roomTag}>
                  <Text style={styles.roomTagText}>{room}</Text>
                </View>
              ))}
              {job.assignedRooms.length > 4 && (
                <View style={styles.roomTag}>
                  <Text style={styles.roomTagText}>+{job.assignedRooms.length - 4} more</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Expiration Timer */}
        {timeRemaining && (
          <View style={[styles.timerRow, timeRemaining.urgent && styles.timerUrgent]}>
            <Feather
              name="clock"
              size={14}
              color={timeRemaining.urgent ? colors.error[600] : colors.warning[600]}
            />
            <Text
              style={[
                styles.timerText,
                timeRemaining.urgent && styles.timerTextUrgent,
              ]}
            >
              {timeRemaining.text}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View style={styles.actions}>
          {isOffer ? (
            <>
              <Pressable
                style={[styles.actionButton, styles.declineButton]}
                onPress={onDecline}
                disabled={loading}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.acceptButton]}
                onPress={onAccept}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Feather name="check" size={18} color={colors.white} />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </>
                )}
              </Pressable>
            </>
          ) : isBusinessOwner && slotsRemaining >= 2 ? (
            // Business owner with multiple slots - show team booking option
            <View style={styles.businessOwnerActions}>
              <Pressable
                style={[styles.actionButton, styles.teamBookButton]}
                onPress={onBookWithTeam}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Feather name="users" size={18} color={colors.white} />
                    <Text style={styles.teamBookButtonText}>Book with Team</Text>
                  </>
                )}
              </Pressable>
              {onJoinTeam && (
                <Pressable
                  style={[styles.actionButton, styles.joinSoloButton]}
                  onPress={onJoinTeam}
                  disabled={loading}
                >
                  <Text style={styles.joinSoloButtonText}>Join Solo</Text>
                </Pressable>
              )}
            </View>
          ) : onJoinTeam ? (
            <Pressable
              style={[styles.actionButton, styles.joinButton]}
              onPress={onJoinTeam}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Feather name="user-plus" size={18} color={colors.white} />
                  <Text style={styles.joinButtonText}>Request to Join Team</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionButton, styles.viewButton]}
              onPress={onViewDetails}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
              <Feather name="chevron-right" size={18} color={colors.primary[600]} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  timeConstraintRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    gap: spacing.xs,
    alignSelf: "center",
  },
  timeConstraintText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.warning[700],
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  teamText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.primary[700],
  },
  slotBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  slotText: {
    ...typography.xs,
    fontWeight: "600",
  },
  content: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dateText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  addressText: {
    ...typography.sm,
    color: colors.neutral[600],
    flex: 1,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  cleanersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  cleanerSlots: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  cleanerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filledDot: {
    backgroundColor: colors.primary[500],
  },
  openDot: {
    backgroundColor: colors.neutral[100],
    borderWidth: 2,
    borderColor: colors.neutral[300],
    borderStyle: "dashed",
  },
  slotsLabel: {
    ...typography.sm,
    color: colors.neutral[600],
  },
  earningsBox: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    alignItems: "center",
  },
  earningsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  earningsLabel: {
    ...typography.sm,
    color: colors.success[700],
    fontWeight: "500",
  },
  earningsAmount: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.success[700],
    marginTop: spacing.xs,
  },
  percentText: {
    ...typography.xs,
    color: colors.success[600],
  },
  roomsSection: {
    marginTop: spacing.sm,
  },
  roomsLabel: {
    ...typography.sm,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  roomTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  roomTag: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  roomTagText: {
    ...typography.xs,
    color: colors.neutral[700],
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  timerUrgent: {
    backgroundColor: colors.error[50],
  },
  timerText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.warning[700],
  },
  timerTextUrgent: {
    color: colors.error[700],
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  viewButton: {
    backgroundColor: colors.primary[50],
  },
  viewButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.primary[600],
  },
  acceptButton: {
    backgroundColor: colors.success[600],
  },
  acceptButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.white,
  },
  declineButton: {
    backgroundColor: colors.neutral[100],
  },
  declineButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  joinButton: {
    backgroundColor: colors.primary[600],
  },
  joinButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.white,
  },
  // Business owner team booking styles
  businessOwnerActions: {
    flex: 1,
    gap: spacing.sm,
  },
  teamBookButton: {
    backgroundColor: colors.secondary[600],
    flex: 0,
  },
  teamBookButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.white,
  },
  joinSoloButton: {
    backgroundColor: colors.neutral[100],
    flex: 0,
  },
  joinSoloButtonText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.neutral[700],
  },
});

export default MultiCleanerJobCard;
