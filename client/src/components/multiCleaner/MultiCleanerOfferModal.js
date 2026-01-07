/**
 * MultiCleanerOfferModal
 * Modal for accepting/declining a multi-cleaner job offer
 * Shows detailed room assignments and earnings breakdown
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const MultiCleanerOfferModal = ({
  visible,
  offer,
  onAccept,
  onDecline,
  onClose,
  loading = false,
}) => {
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const { pricing } = usePricing();

  // Get multi-cleaner platform fee (default 13%)
  const multiCleanerFeePercent = (pricing?.platform?.multiCleanerPlatformFeePercent || 0.13) * 100;

  if (!offer) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPrice = (cents) => {
    if (!cents) return "TBD";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes} minutes remaining`;
  };

  const handleDecline = () => {
    if (showDeclineReason) {
      onDecline(declineReason);
      setShowDeclineReason(false);
      setDeclineReason("");
    } else {
      setShowDeclineReason(true);
    }
  };

  const handleAccept = () => {
    onAccept();
  };

  const getRoomIcon = (roomType) => {
    switch (roomType?.toLowerCase()) {
      case "bedroom":
        return "moon";
      case "bathroom":
        return "droplet";
      case "kitchen":
        return "coffee";
      case "living_room":
        return "tv";
      case "dining_room":
        return "grid";
      default:
        return "square";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Multi-Cleaner Job Offer</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.neutral[600]} />
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Team Badge */}
          <View style={styles.teamSection}>
            <View style={styles.teamBadge}>
              <Feather name="users" size={20} color={colors.primary[600]} />
              <Text style={styles.teamText}>Team Cleaning Job</Text>
            </View>
            <Text style={styles.teamDescription}>
              You'll be cleaning this home with {offer.totalCleanersRequired - 1} other cleaner(s).
              Each cleaner is assigned specific rooms.
            </Text>
          </View>

          {/* Job Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Details</Text>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="calendar" size={18} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(offer.appointmentDate)}</Text>
              </View>
            </View>

            {offer.address && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Feather name="map-pin" size={18} color={colors.primary[600]} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{offer.address}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="clock" size={18} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Estimated Time</Text>
                <Text style={styles.detailValue}>
                  {offer.estimatedMinutes ? `${offer.estimatedMinutes} minutes` : "Based on room assignments"}
                </Text>
              </View>
            </View>
          </View>

          {/* Earnings Section */}
          <View style={styles.earningsSection}>
            <View style={styles.earningsHeader}>
              <Feather name="dollar-sign" size={24} color={colors.success[600]} />
              <Text style={styles.earningsTitle}>Your Earnings</Text>
            </View>
            <Text style={styles.earningsAmount}>
              {formatPrice(offer.earningsOffered)}
            </Text>
            {offer.percentOfWork && (
              <Text style={styles.percentText}>
                ({offer.percentOfWork}% of total job based on room assignments)
              </Text>
            )}
            <View style={styles.earningsBreakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total Job Value</Text>
                <Text style={styles.breakdownValue}>{formatPrice(offer.totalJobPrice)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Platform Fee ({multiCleanerFeePercent}%)</Text>
                <Text style={styles.breakdownValue}>-{formatPrice(offer.platformFee)}</Text>
              </View>
              <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                <Text style={styles.breakdownTotalLabel}>Your Share</Text>
                <Text style={styles.breakdownTotalValue}>{formatPrice(offer.earningsOffered)}</Text>
              </View>
            </View>
          </View>

          {/* Room Assignments */}
          {offer.roomAssignments && offer.roomAssignments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Assigned Rooms</Text>
              <Text style={styles.sectionSubtitle}>
                You'll be responsible for cleaning these rooms:
              </Text>

              <View style={styles.roomsList}>
                {offer.roomAssignments.map((room, index) => (
                  <View key={index} style={styles.roomCard}>
                    <View style={styles.roomIcon}>
                      <Feather
                        name={getRoomIcon(room.roomType)}
                        size={20}
                        color={colors.primary[600]}
                      />
                    </View>
                    <View style={styles.roomDetails}>
                      <Text style={styles.roomName}>{room.displayLabel || room.roomLabel}</Text>
                      {room.estimatedMinutes && (
                        <Text style={styles.roomTime}>~{room.estimatedMinutes} min</Text>
                      )}
                    </View>
                    {room.earningsShare && (
                      <Text style={styles.roomEarnings}>
                        {formatPrice(room.earningsShare)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Timer Warning */}
          {offer.expiresAt && (
            <View style={styles.timerWarning}>
              <Feather name="alert-circle" size={18} color={colors.warning[600]} />
              <Text style={styles.timerText}>
                {formatTimeRemaining(offer.expiresAt)}
              </Text>
            </View>
          )}

          {/* Decline Reason Input */}
          {showDeclineReason && (
            <View style={styles.declineSection}>
              <Text style={styles.declineLabel}>Why are you declining? (optional)</Text>
              <TextInput
                style={styles.declineInput}
                placeholder="e.g., Schedule conflict, too far, etc."
                value={declineReason}
                onChangeText={setDeclineReason}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.neutral[400]}
              />
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, styles.declineButton]}
            onPress={handleDecline}
            disabled={loading}
          >
            <Text style={styles.declineButtonText}>
              {showDeclineReason ? "Submit Decline" : "Decline"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAccept}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Feather name="check" size={20} color={colors.white} />
                <Text style={styles.acceptButtonText}>Accept Job</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.neutral[900],
  },
  closeButton: {
    padding: spacing.sm,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  teamSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  teamText: {
    ...typography.lg,
    fontWeight: "600",
    color: colors.primary[700],
  },
  teamDescription: {
    ...typography.base,
    color: colors.neutral[600],
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 22,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    ...typography.sm,
    color: colors.neutral[600],
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...typography.xs,
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[800],
    marginTop: 2,
  },
  earningsSection: {
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.success[200],
  },
  earningsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  earningsTitle: {
    ...typography.lg,
    fontWeight: "600",
    color: colors.success[700],
  },
  earningsAmount: {
    ...typography["3xl"],
    fontWeight: "700",
    color: colors.success[700],
    marginTop: spacing.sm,
  },
  percentText: {
    ...typography.sm,
    color: colors.success[600],
    marginTop: spacing.xs,
  },
  earningsBreakdown: {
    width: "100%",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  breakdownLabel: {
    ...typography.sm,
    color: colors.success[700],
  },
  breakdownValue: {
    ...typography.sm,
    color: colors.success[700],
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.success[300],
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  breakdownTotalLabel: {
    ...typography.base,
    fontWeight: "700",
    color: colors.success[800],
  },
  breakdownTotalValue: {
    ...typography.base,
    fontWeight: "700",
    color: colors.success[800],
  },
  roomsList: {
    gap: spacing.sm,
  },
  roomCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  roomDetails: {
    flex: 1,
  },
  roomName: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  roomTime: {
    ...typography.sm,
    color: colors.neutral[500],
    marginTop: 2,
  },
  roomEarnings: {
    ...typography.base,
    fontWeight: "700",
    color: colors.success[600],
  },
  timerWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning[100],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timerText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.warning[700],
  },
  declineSection: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  declineLabel: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  declineInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...typography.base,
    color: colors.neutral[800],
    minHeight: 80,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  declineButton: {
    backgroundColor: colors.neutral[200],
  },
  declineButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  acceptButton: {
    backgroundColor: colors.success[600],
  },
  acceptButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.white,
  },
});

export default MultiCleanerOfferModal;
