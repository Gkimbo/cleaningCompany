/**
 * SoloCompletionOfferModal
 * Displayed when a co-cleaner drops out and remaining cleaner is offered solo completion
 * Shows the full earnings they'll receive if they complete alone
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
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

const SoloCompletionOfferModal = ({
  visible,
  offer,
  onAccept,
  onDecline,
  onClose,
  loading = false,
}) => {
  if (!offer) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (cents) => {
    if (!cents) return "TBD";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatTimeRemaining = (expiresAt) => {
    if (!expiresAt) return "12 hours";
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours} hours`;

    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minutes`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Close Button */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.neutral[600]} />
          </Pressable>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.moneyIcon}>
            <Feather name="dollar-sign" size={40} color={colors.success[600]} />
          </View>
          <Text style={styles.title}>Earn the Full Amount!</Text>
          <Text style={styles.subtitle}>
            Your co-cleaner is no longer available. Complete the job solo and
            receive the full cleaning payment.
          </Text>
        </View>

        {/* Earnings Comparison */}
        <View style={styles.comparisonSection}>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>Your Original Share</Text>
              <Text style={styles.originalAmount}>
                {formatPrice(offer.originalShare)}
              </Text>
            </View>
            <View style={styles.arrowContainer}>
              <Feather name="arrow-right" size={24} color={colors.success[500]} />
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>Solo Completion</Text>
              <Text style={styles.newAmount}>
                {formatPrice(offer.soloEarnings)}
              </Text>
            </View>
          </View>

          <View style={styles.bonusRow}>
            <Feather name="trending-up" size={18} color={colors.success[600]} />
            <Text style={styles.bonusText}>
              +{formatPrice(offer.soloEarnings - offer.originalShare)} more than
              your original share
            </Text>
          </View>
        </View>

        {/* Job Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Job Details</Text>

          <View style={styles.detailRow}>
            <Feather name="calendar" size={18} color={colors.neutral[500]} />
            <Text style={styles.detailText}>{formatDate(offer.appointmentDate)}</Text>
          </View>

          {offer.address && (
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={18} color={colors.neutral[500]} />
              <Text style={styles.detailText}>{offer.address}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Feather name="home" size={18} color={colors.neutral[500]} />
            <Text style={styles.detailText}>
              {offer.numBeds} bed, {offer.numBaths} bath
            </Text>
          </View>

          {offer.estimatedTime && (
            <View style={styles.detailRow}>
              <Feather name="clock" size={18} color={colors.neutral[500]} />
              <Text style={styles.detailText}>
                Estimated {offer.estimatedTime} minutes solo
              </Text>
            </View>
          )}
        </View>

        {/* Timer Warning */}
        <View style={styles.timerWarning}>
          <Feather name="alert-circle" size={18} color={colors.warning[600]} />
          <Text style={styles.timerText}>
            Respond within {formatTimeRemaining(offer.expiresAt)} to accept this offer
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
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
                <Feather name="check" size={20} color={colors.white} />
                <Text style={styles.acceptButtonText}>Accept Solo</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Note */}
        <Text style={styles.note}>
          If you decline, the job may be offered to other cleaners or the homeowner
          will be notified of their options.
        </Text>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  closeButton: {
    padding: spacing.sm,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  moneyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.success[700],
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.base,
    color: colors.neutral[600],
    textAlign: "center",
    lineHeight: 22,
  },
  comparisonSection: {
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.success[200],
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  comparisonItem: {
    flex: 1,
    alignItems: "center",
  },
  comparisonLabel: {
    ...typography.sm,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },
  originalAmount: {
    ...typography.xl,
    fontWeight: "600",
    color: colors.neutral[500],
    textDecorationLine: "line-through",
  },
  newAmount: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.success[700],
  },
  arrowContainer: {
    paddingHorizontal: spacing.sm,
  },
  bonusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  bonusText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.success[700],
  },
  detailsSection: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.lg,
    fontWeight: "600",
    color: colors.neutral[800],
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailText: {
    ...typography.base,
    color: colors.neutral[700],
    flex: 1,
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
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
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
  note: {
    ...typography.sm,
    color: colors.neutral[500],
    textAlign: "center",
    lineHeight: 20,
  },
});

export default SoloCompletionOfferModal;
