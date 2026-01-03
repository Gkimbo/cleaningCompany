import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

/**
 * SuspiciousReportCard
 *
 * Displays a summary card for a suspicious activity report
 * Used in the reports list view
 */
const SuspiciousReportCard = ({ report, onPress }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "pending":
        return {
          label: "Pending",
          color: colors.warning[600],
          bgColor: colors.warning[50],
          icon: "clock",
        };
      case "reviewed":
        return {
          label: "Reviewed",
          color: colors.primary[600],
          bgColor: colors.primary[50],
          icon: "check",
        };
      case "dismissed":
        return {
          label: "Dismissed",
          color: colors.neutral[500],
          bgColor: colors.neutral[100],
          icon: "x",
        };
      case "action_taken":
        return {
          label: "Action Taken",
          color: colors.error[600],
          bgColor: colors.error[50],
          icon: "alert-circle",
        };
      default:
        return {
          label: status,
          color: colors.neutral[500],
          bgColor: colors.neutral[100],
          icon: "help-circle",
        };
    }
  };

  const getSuspiciousTypeLabel = (type) => {
    switch (type) {
      case "phone_number":
        return "Phone";
      case "email":
        return "Email";
      case "off_platform":
        return "Off-Platform";
      default:
        return type;
    }
  };

  const getAccountStatusBadge = () => {
    if (!report.reportedUser) return null;
    const { accountStatus, warningCount } = report.reportedUser;

    if (accountStatus === "suspended") {
      return (
        <View style={[styles.accountBadge, { backgroundColor: colors.error[100] }]}>
          <Icon name="slash" size={12} color={colors.error[600]} />
          <Text style={[styles.accountBadgeText, { color: colors.error[600] }]}>
            Suspended
          </Text>
        </View>
      );
    }

    if (accountStatus === "warned" && warningCount > 0) {
      return (
        <View style={[styles.accountBadge, { backgroundColor: colors.warning[100] }]}>
          <Icon name="alert-triangle" size={12} color={colors.warning[600]} />
          <Text style={[styles.accountBadgeText, { color: colors.warning[600] }]}>
            {warningCount} warning{warningCount > 1 ? "s" : ""}
          </Text>
        </View>
      );
    }

    return null;
  };

  const statusConfig = getStatusConfig(report.status);
  const isPending = report.status === "pending";

  return (
    <TouchableOpacity
      style={[styles.card, isPending && styles.cardPending]}
      onPress={() => onPress(report)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.iconContainer}>
            <Icon name="alert-triangle" size={20} color={colors.warning[500]} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {report.reporter?.name || "Unknown"}
              <Text style={styles.arrow}> → </Text>
              {report.reportedUser?.name || "Unknown"}
            </Text>
            <Text style={styles.subtitle}>
              {report.reportedUser?.type === "cleaner" ? "Cleaner" : "Client"}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Icon name={statusConfig.icon} size={12} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Message preview */}
        <View style={styles.messagePreview}>
          <Text style={styles.messageText} numberOfLines={2}>
            "{report.messageContent}"
          </Text>
        </View>

        {/* Tags row */}
        <View style={styles.tagsRow}>
          {report.suspiciousContentTypes?.map((type, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{getSuspiciousTypeLabel(type)}</Text>
            </View>
          ))}
        </View>

        {/* Footer row */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            {report.appointmentId && (
              <Text style={styles.appointmentText}>
                Appointment #{report.appointmentId}
              </Text>
            )}
            <Text style={styles.dateText}>{formatDate(report.createdAt)}</Text>
          </View>
          {getAccountStatusBadge()}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardPending: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  cardContent: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warning[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  arrow: {
    color: colors.text.tertiary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  messagePreview: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  messageText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tag: {
    backgroundColor: colors.error[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appointmentText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  accountBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  accountBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
});

export default SuspiciousReportCard;
