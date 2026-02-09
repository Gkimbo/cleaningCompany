import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import GuestNotLeftService from "../../services/fetchRequests/GuestNotLeftService";

const TenantPresentAlertCard = ({ report, token, onResolved, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [additionalMinutes, setAdditionalMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [countdown, setCountdown] = useState(null);

  // Countdown timer
  useEffect(() => {
    if (report?.responseDeadline) {
      const deadlineTime = new Date(report.responseDeadline).getTime();

      const updateCountdown = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((deadlineTime - now) / 1000));
        setCountdown(remaining);
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);

      return () => clearInterval(interval);
    }
  }, [report?.responseDeadline]);

  const formatCountdown = (seconds) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleResolved = async () => {
    Alert.alert(
      "Confirm Resolution",
      "Has the tenant left or are they leaving now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, They're Leaving",
          onPress: async () => {
            setLoading(true);
            try {
              const result = await GuestNotLeftService.homeownerResolved(
                token,
                report.id,
                note || null
              );
              if (result.success) {
                onResolved && onResolved();
                onRefresh && onRefresh();
              } else {
                Alert.alert("Error", result.error || "Failed to update");
              }
            } catch (_err) {
              Alert.alert("Error", "An unexpected error occurred");
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  const handleNeedTime = async () => {
    const mins = parseInt(additionalMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 60) {
      Alert.alert("Invalid Time", "Please enter a time between 1 and 60 minutes");
      return;
    }

    setLoading(true);
    try {
      const result = await GuestNotLeftService.homeownerNeedsTime(
        token,
        report.id,
        mins,
        note || null
      );
      if (result.success) {
        Alert.alert(
          "Cleaner Notified",
          `The cleaner has been notified that you need ${mins} more minutes.`
        );
        onRefresh && onRefresh();
      } else {
        Alert.alert("Error", result.error || "Failed to update");
      }
    } catch (_err) {
      Alert.alert("Error", "An unexpected error occurred");
    }
    setLoading(false);
    setShowTimeInput(false);
  };

  const handleCannotResolve = async () => {
    Alert.alert(
      "Cancel Today's Cleaning?",
      "If the tenant cannot leave, the appointment will be cancelled with no charge to you.",
      [
        { text: "Go Back", style: "cancel" },
        {
          text: "Cancel Cleaning",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const result = await GuestNotLeftService.homeownerCannotResolve(
                token,
                report.id
              );
              if (result.success) {
                Alert.alert(
                  "Cleaning Cancelled",
                  "The appointment has been cancelled. No charges have been applied."
                );
                onResolved && onResolved();
                onRefresh && onRefresh();
              } else {
                Alert.alert("Error", result.error || "Failed to cancel");
              }
            } catch (_err) {
              Alert.alert("Error", "An unexpected error occurred");
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  if (!report) return null;

  const isUrgent = countdown !== null && countdown < 10 * 60; // Less than 10 minutes

  return (
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>
      {/* Header */}
      <View style={[styles.header, isUrgent && styles.headerUrgent]}>
        <View style={styles.headerIcon}>
          <Icon
            name="exclamation-triangle"
            size={20}
            color={isUrgent ? colors.error[600] : colors.warning[600]}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, isUrgent && styles.headerTitleUrgent]}>
            Action Required: Tenant Still Present
          </Text>
          <Text style={styles.headerSubtitle}>
            Your cleaner has arrived but cannot start
          </Text>
        </View>
      </View>

      {/* Countdown */}
      <View style={[styles.countdownSection, isUrgent && styles.countdownSectionUrgent]}>
        <Text style={styles.countdownLabel}>Time to respond</Text>
        <Text style={[styles.countdownValue, isUrgent && styles.countdownValueUrgent]}>
          {formatCountdown(countdown)}
        </Text>
        <View style={styles.countdownProgress}>
          <View
            style={[
              styles.countdownProgressBar,
              { width: `${(countdown / (30 * 60)) * 100}%` },
              isUrgent && styles.countdownProgressBarUrgent,
            ]}
          />
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Icon name="user" size={14} color={colors.text.secondary} />
          <Text style={styles.detailText}>
            Cleaner: {report.reporter?.firstName || "Your cleaner"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="map-marker" size={14} color={colors.text.secondary} />
          <Text style={styles.detailText}>
            {report.appointment?.address || "Your property"}
          </Text>
        </View>
        {report.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Cleaner note:</Text>
            <Text style={styles.notesText}>&ldquo;{report.notes}&rdquo;</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      {!showTimeInput ? (
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, styles.resolvedButton]}
            onPress={handleResolved}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <>
                <Icon name="check" size={16} color={colors.neutral[0]} />
                <Text style={styles.resolvedButtonText}>Tenant Leaving</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.timeButton]}
            onPress={() => setShowTimeInput(true)}
            disabled={loading}
          >
            <Icon name="clock-o" size={16} color={colors.primary[700]} />
            <Text style={styles.timeButtonText}>Need More Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCannotResolve}
            disabled={loading}
          >
            <Icon name="times" size={16} color={colors.error[700]} />
            <Text style={styles.cancelButtonText}>Cannot Resolve</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timeInputSection}>
          <Text style={styles.timeInputLabel}>How many more minutes do you need?</Text>
          <View style={styles.timeInputRow}>
            <TextInput
              style={styles.timeInput}
              value={additionalMinutes}
              onChangeText={setAdditionalMinutes}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="30"
              placeholderTextColor={colors.text.tertiary}
            />
            <Text style={styles.timeInputUnit}>minutes (max 60)</Text>
          </View>

          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note to cleaner..."
            placeholderTextColor={colors.text.tertiary}
          />

          <View style={styles.timeInputButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.timeInputCancel]}
              onPress={() => setShowTimeInput(false)}
            >
              <Text style={styles.timeInputCancelText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.timeInputConfirm]}
              onPress={handleNeedTime}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Text style={styles.timeInputConfirmText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoSection}>
        <Icon name="info-circle" size={12} color={colors.text.tertiary} />
        <Text style={styles.infoText}>
          If you cannot resolve this, the cleaning will be cancelled with no charge.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.warning[300],
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.lg,
  },
  containerUrgent: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[300],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.warning[100],
    gap: spacing.md,
  },
  headerUrgent: {
    backgroundColor: colors.error[100],
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warning[200],
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
  },
  headerTitleUrgent: {
    color: colors.error[800],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    marginTop: 2,
  },
  countdownSection: {
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.warning[100],
  },
  countdownSectionUrgent: {
    backgroundColor: colors.error[100],
  },
  countdownLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  countdownValue: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
    marginBottom: spacing.sm,
  },
  countdownValueUrgent: {
    color: colors.error[700],
  },
  countdownProgress: {
    width: "100%",
    height: 6,
    backgroundColor: colors.warning[200],
    borderRadius: 3,
    overflow: "hidden",
  },
  countdownProgressBar: {
    height: "100%",
    backgroundColor: colors.warning[500],
    borderRadius: 3,
  },
  countdownProgressBarUrgent: {
    backgroundColor: colors.error[500],
  },
  detailsSection: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  notesBox: {
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  notesLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontStyle: "italic",
  },
  actionsSection: {
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  resolvedButton: {
    backgroundColor: colors.success[500],
  },
  resolvedButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  timeButton: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  timeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  cancelButton: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
  },
  timeInputSection: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  timeInputLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  timeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  timeInput: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    padding: spacing.md,
    width: 80,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: "center",
    color: colors.text.primary,
  },
  timeInputUnit: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  noteInput: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  timeInputButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  timeInputCancel: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  timeInputCancelText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  timeInputConfirm: {
    flex: 2,
    backgroundColor: colors.primary[500],
  },
  timeInputConfirmText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flex: 1,
  },
});

export default TenantPresentAlertCard;
