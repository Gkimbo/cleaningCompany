/**
 * CleanerDropoutModal
 * Shown to homeowners when a cleaner drops out of a multi-cleaner job
 * Presents options: proceed with remaining, wait for replacement, cancel, or reschedule
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const CleanerDropoutModal = ({
  visible,
  appointmentDetails,
  remainingCleaners,
  originalCleaners,
  onProceed,
  onWaitReplacement,
  onReschedule,
  onCancel,
  onClose,
  loading = false,
}) => {
  const [selectedOption, setSelectedOption] = useState(null);

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleConfirm = () => {
    switch (selectedOption) {
      case "proceed":
        onProceed?.();
        break;
      case "wait":
        onWaitReplacement?.();
        break;
      case "reschedule":
        onReschedule?.();
        break;
      case "cancel":
        onCancel?.();
        break;
    }
  };

  const options = [
    {
      id: "proceed",
      icon: "check-circle",
      title: "Proceed with Remaining Cleaner(s)",
      description: `Continue with your ${remainingCleaners} remaining cleaner(s). Your cleaning will still be completed, though it may take a bit longer.`,
      color: colors.success[600],
      bg: colors.success[50],
      recommended: remainingCleaners >= 1,
    },
    {
      id: "wait",
      icon: "clock",
      title: "Wait for Replacement",
      description: "We'll try to find a replacement cleaner. You'll be notified if we find one before your appointment.",
      color: colors.primary[600],
      bg: colors.primary[50],
      recommended: false,
    },
    {
      id: "reschedule",
      icon: "calendar",
      title: "Reschedule Appointment",
      description: "Move your appointment to a different date when a full team is available. No penalties apply.",
      color: colors.warning[600],
      bg: colors.warning[50],
      recommended: false,
    },
    {
      id: "cancel",
      icon: "x-circle",
      title: "Cancel Appointment",
      description: "Cancel this cleaning entirely. Due to the cleaner change, no cancellation fee will be charged.",
      color: colors.error[600],
      bg: colors.error[50],
      recommended: false,
    },
  ];

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
          <Text style={styles.headerTitle}>Cleaner Update</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.neutral[600]} />
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Alert Section */}
          <View style={styles.alertSection}>
            <View style={styles.alertIcon}>
              <Feather name="alert-triangle" size={32} color={colors.warning[600]} />
            </View>
            <Text style={styles.alertTitle}>A Cleaner is No Longer Available</Text>
            <Text style={styles.alertDescription}>
              We're sorry, but one of the cleaners assigned to your upcoming
              appointment is no longer available. Here are your options:
            </Text>
          </View>

          {/* Appointment Info */}
          <View style={styles.appointmentInfo}>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={18} color={colors.primary[600]} />
              <Text style={styles.infoText}>
                {formatDate(appointmentDetails?.date)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="users" size={18} color={colors.primary[600]} />
              <Text style={styles.infoText}>
                {remainingCleaners} of {originalCleaners} cleaners still assigned
              </Text>
            </View>
          </View>

          {/* Options */}
          <View style={styles.optionsSection}>
            {options.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.optionCard,
                  selectedOption === option.id && styles.optionSelected,
                  { borderColor: selectedOption === option.id ? option.color : colors.neutral[200] },
                ]}
                onPress={() => setSelectedOption(option.id)}
              >
                <View
                  style={[styles.optionIconContainer, { backgroundColor: option.bg }]}
                >
                  <Feather name={option.icon} size={22} color={option.color} />
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    {option.recommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    selectedOption === option.id && {
                      borderColor: option.color,
                    },
                  ]}
                >
                  {selectedOption === option.id && (
                    <View
                      style={[styles.radioInner, { backgroundColor: option.color }]}
                    />
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          {/* Reassurance Note */}
          <View style={styles.noteSection}>
            <Feather name="shield" size={18} color={colors.primary[600]} />
            <Text style={styles.noteText}>
              All options are penalty-free due to the cleaner change. We appreciate
              your understanding and flexibility.
            </Text>
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <Pressable
            style={[
              styles.confirmButton,
              !selectedOption && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!selectedOption || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm Selection</Text>
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
  alertSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  alertIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  alertTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.neutral[900],
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  alertDescription: {
    ...typography.base,
    color: colors.neutral[600],
    textAlign: "center",
    lineHeight: 22,
  },
  appointmentInfo: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  infoText: {
    ...typography.base,
    color: colors.neutral[700],
    fontWeight: "500",
  },
  optionsSection: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
    borderWidth: 2,
    ...shadows.sm,
  },
  optionSelected: {
    backgroundColor: colors.primary[50],
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  optionTitle: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  recommendedBadge: {
    backgroundColor: colors.success[500],
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
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  noteSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  noteText: {
    ...typography.sm,
    color: colors.primary[700],
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  confirmButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  confirmButtonText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.white,
  },
});

export default CleanerDropoutModal;
