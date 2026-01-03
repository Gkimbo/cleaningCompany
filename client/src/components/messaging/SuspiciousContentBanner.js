import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import MessageService from "../../services/fetchRequests/MessageClass";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

/**
 * SuspiciousContentBanner
 *
 * Displays a warning banner above messages that contain suspicious content
 * such as phone numbers, email addresses, or off-platform deal attempts.
 *
 * Only shown to the recipient of the message (not the sender).
 * Includes a Report button to flag the activity to HR/Owner.
 */
const SuspiciousContentBanner = ({
  suspiciousContentTypes = [],
  messageId,
  token,
  onReported,
}) => {
  const [isReporting, setIsReporting] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  // Generate appropriate warning text based on detected types
  const getWarningText = () => {
    if (suspiciousContentTypes.length === 0) {
      return "This message may contain suspicious content.";
    }

    const hasPhone = suspiciousContentTypes.includes("phone_number");
    const hasEmail = suspiciousContentTypes.includes("email");
    const hasOffPlatform = suspiciousContentTypes.includes("off_platform");

    if (hasOffPlatform) {
      return "This message may contain an attempt to communicate or transact off the app.";
    }

    if (hasPhone || hasEmail) {
      return "This message may contain contact information.";
    }

    return "This message may contain suspicious content.";
  };

  const handleReport = async () => {
    if (!messageId || !token) {
      Alert.alert("Error", "Unable to report this message. Please try again.");
      return;
    }

    Alert.alert(
      "Report Suspicious Activity",
      "Are you sure you want to report this message? Our team will review this activity and take appropriate action.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            setIsReporting(true);
            try {
              const result = await MessageService.reportSuspiciousActivity(messageId, token);

              if (result.alreadyReported) {
                Alert.alert(
                  "Already Reported",
                  "You have already reported this message. Our team is reviewing it."
                );
                setHasReported(true);
              } else if (result.error) {
                Alert.alert("Error", result.error);
              } else if (result.success) {
                Alert.alert(
                  "Report Submitted",
                  "Thank you for reporting this activity. Our team has been notified and will review it shortly. We take these reports seriously and will take appropriate action.",
                  [{ text: "OK" }]
                );
                setHasReported(true);
                if (onReported) {
                  onReported(messageId);
                }
              }
            } catch (error) {
              Alert.alert("Error", "Failed to submit report. Please try again.");
            } finally {
              setIsReporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="alert-triangle" size={16} color={colors.warning[600]} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Caution</Text>
        <Text style={styles.message}>{getWarningText()}</Text>
        <Text style={styles.advice}>
          Keep all communication and payments on the platform for your protection.
        </Text>

        {/* Report button */}
        {messageId && token && !hasReported && (
          <TouchableOpacity
            style={styles.reportButton}
            onPress={handleReport}
            disabled={isReporting}
          >
            {isReporting ? (
              <ActivityIndicator size="small" color={colors.error[600]} />
            ) : (
              <>
                <Icon name="flag" size={14} color={colors.error[600]} />
                <Text style={styles.reportButtonText}>Report this activity</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Already reported indicator */}
        {hasReported && (
          <View style={styles.reportedIndicator}>
            <Icon name="check-circle" size={14} color={colors.success[600]} />
            <Text style={styles.reportedText}>Reported to our team</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconContainer: {
    paddingTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: 2,
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  advice: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    fontStyle: "italic",
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  reportButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[600],
  },
  reportedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  reportedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
  },
});

export default SuspiciousContentBanner;
