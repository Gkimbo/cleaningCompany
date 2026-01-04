/**
 * LargeHomeWarningModal
 * Displays when a cleaner tries to accept a large home job
 * Offers options: accept with multi-cleaner team or solo with acknowledgment
 */

import React, { useState } from "react";
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

const LargeHomeWarningModal = ({
  visible,
  homeDetails,
  recommendedCleaners,
  onAcceptMultiCleaner,
  onAcceptSolo,
  onCancel,
  loading = false,
}) => {
  const [soloAcknowledged, setSoloAcknowledged] = useState(false);

  const handleAcceptSolo = () => {
    if (soloAcknowledged) {
      onAcceptSolo();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.neutral[600]} />
          </Pressable>
        </View>

        {/* Warning Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.warningIcon}>
            <Feather name="alert-triangle" size={40} color={colors.warning[600]} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Large Home Detected</Text>

        {/* Description */}
        <Text style={styles.description}>
          This home is larger than average with {homeDetails?.numBeds || "3+"} bedrooms
          and {homeDetails?.numBaths || "3+"} bathrooms.
        </Text>

        {/* Recommendation Box */}
        <View style={styles.recommendationBox}>
          <View style={styles.recommendationHeader}>
            <Feather name="users" size={20} color={colors.primary[600]} />
            <Text style={styles.recommendationTitle}>Our Recommendation</Text>
          </View>
          <Text style={styles.recommendationText}>
            We recommend {recommendedCleaners || 2} cleaners for this home to ensure
            quality service and timely completion. Each cleaner will be assigned
            specific rooms and earn their proportional share.
          </Text>
        </View>

        {/* Options */}
        <View style={styles.options}>
          {/* Multi-Cleaner Option */}
          <Pressable
            style={[styles.optionCard, styles.recommendedOption]}
            onPress={onAcceptMultiCleaner}
            disabled={loading}
          >
            <View style={styles.optionIcon}>
              <Feather name="users" size={24} color={colors.primary[600]} />
            </View>
            <View style={styles.optionContent}>
              <View style={styles.optionTitleRow}>
                <Text style={styles.optionTitle}>Team Clean</Text>
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>Recommended</Text>
                </View>
              </View>
              <Text style={styles.optionDescription}>
                Join a team of {recommendedCleaners || 2} cleaners. Each cleaner cleans
                assigned rooms and gets proportional pay.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.primary[600]} />
          </Pressable>

          {/* Solo Option */}
          <Pressable
            style={[styles.optionCard, !soloAcknowledged && styles.optionDisabled]}
            onPress={handleAcceptSolo}
            disabled={loading || !soloAcknowledged}
          >
            <View style={styles.optionIcon}>
              <Feather name="user" size={24} color={colors.neutral[600]} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Clean Solo</Text>
              <Text style={styles.optionDescription}>
                Take on this large home by yourself. You'll receive the full payment
                but expect longer cleaning time.
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator color={colors.primary[600]} />
            ) : (
              <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
            )}
          </Pressable>

          {/* Solo Acknowledgment */}
          <Pressable
            style={styles.acknowledgmentRow}
            onPress={() => setSoloAcknowledged(!soloAcknowledged)}
          >
            <View
              style={[
                styles.checkbox,
                soloAcknowledged && styles.checkboxChecked,
              ]}
            >
              {soloAcknowledged && (
                <Feather name="check" size={14} color={colors.white} />
              )}
            </View>
            <Text style={styles.acknowledgmentText}>
              I understand this is a large home and may take longer to clean solo
            </Text>
          </Pressable>
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Feather name="info" size={16} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            With Team Clean, the homeowner pays the same amount but gets faster
            service. Cleaners earn based on their assigned rooms.
          </Text>
        </View>
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
  iconContainer: {
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  warningIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.neutral[900],
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.base,
    color: colors.neutral[600],
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  recommendationBox: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recommendationTitle: {
    ...typography.lg,
    fontWeight: "600",
    color: colors.primary[700],
  },
  recommendationText: {
    ...typography.base,
    color: colors.primary[700],
    lineHeight: 22,
  },
  options: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.neutral[200],
  },
  recommendedOption: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  optionTitle: {
    ...typography.lg,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  recommendedBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  recommendedText: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.white,
  },
  optionDescription: {
    ...typography.sm,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  acknowledgmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  acknowledgmentText: {
    ...typography.sm,
    color: colors.neutral[600],
    flex: 1,
    lineHeight: 20,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: "auto",
    marginBottom: spacing.lg,
  },
  infoText: {
    ...typography.sm,
    color: colors.primary[700],
    flex: 1,
    lineHeight: 20,
  },
});

export default LargeHomeWarningModal;
