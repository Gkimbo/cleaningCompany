import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const CaseOverviewSection = ({ caseData, caseType }) => {
  if (!caseData) return null;

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderPartyCard = (party, label, icon) => {
    if (!party) return null;

    return (
      <View style={styles.partyCard}>
        <View style={styles.partyHeader}>
          <Icon name={icon} size={14} color={colors.primary[600]} />
          <Text style={styles.partyLabel}>{label}</Text>
        </View>
        <View style={styles.partyContent}>
          {party.profileImage ? (
            <Image source={{ uri: party.profileImage }} style={styles.partyAvatar} />
          ) : (
            <View style={styles.partyAvatarPlaceholder}>
              <Icon name="user" size={18} color={colors.neutral[400]} />
            </View>
          )}
          <View style={styles.partyInfo}>
            <Text style={styles.partyName}>{party.name}</Text>
            {party.email && (
              <View style={styles.contactRow}>
                <Icon name="envelope" size={10} color={colors.text.tertiary} />
                <Text style={styles.contactText}>{party.email}</Text>
              </View>
            )}
            {party.phone && (
              <View style={styles.contactRow}>
                <Icon name="phone" size={10} color={colors.text.tertiary} />
                <Text style={styles.contactText}>{party.phone}</Text>
              </View>
            )}
          </View>
        </View>
        {party.scrutinyLevel && party.scrutinyLevel !== "none" && (
          <View style={[styles.scrutinyBadge, party.scrutinyLevel === "high_risk" && styles.scrutinyBadgeHighRisk]}>
            <Icon name="exclamation-triangle" size={10} color={party.scrutinyLevel === "high_risk" ? colors.error[600] : colors.warning[600]} />
            <Text style={[styles.scrutinyText, party.scrutinyLevel === "high_risk" && styles.scrutinyTextHighRisk]}>
              {party.scrutinyLevel === "high_risk" ? "High Risk" : "Under Watch"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Case Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Case Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Category</Text>
            <Text style={styles.summaryValue}>{caseData.category?.replace(/_/g, " ")}</Text>
          </View>
          {caseData.severity && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Severity</Text>
              <View style={[styles.severityBadge, styles[`severity${caseData.severity}`]]}>
                <Text style={styles.severityText}>{caseData.severity}</Text>
              </View>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Submitted</Text>
            <Text style={styles.summaryValue}>{formatDate(caseData.submittedAt)}</Text>
          </View>
          {caseData.assignedTo && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Assigned To</Text>
              <Text style={styles.summaryValue}>{caseData.assignedTo.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>{caseData.description}</Text>
        </View>
      </View>

      {/* Requested Relief (for appeals) */}
      {caseType === "appeal" && caseData.requestedRelief && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requested Relief</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{caseData.requestedRelief}</Text>
          </View>
        </View>
      )}

      {/* Size Discrepancy (for adjustments) */}
      {caseType === "adjustment" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Size Discrepancy</Text>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonLabel}>Original</Text>
              <Text style={styles.comparisonValue}>
                {caseData.originalSize?.numBeds} bed / {caseData.originalSize?.numBaths} bath
              </Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.text.tertiary} />
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonLabel}>Reported</Text>
              <Text style={[styles.comparisonValue, styles.comparisonValueHighlight]}>
                {caseData.reportedSize?.numBeds} bed / {caseData.reportedSize?.numBaths} bath
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Parties */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parties Involved</Text>
        <View style={styles.partiesContainer}>
          {renderPartyCard(caseData.homeowner, "Homeowner", "user")}
          {renderPartyCard(caseData.cleaner, "Cleaner", "star")}
        </View>
      </View>

      {/* Appellant Info (for appeals with scrutiny) */}
      {caseType === "appeal" && caseData.appellant?.appealStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appellant History</Text>
          <View style={styles.historyCard}>
            <View style={styles.historyRow}>
              <View style={styles.historyStat}>
                <Text style={styles.historyStatNumber}>{caseData.appellant.appealStats.total || 0}</Text>
                <Text style={styles.historyStatLabel}>Total Appeals</Text>
              </View>
              <View style={styles.historyStat}>
                <Text style={[styles.historyStatNumber, { color: colors.success[600] }]}>
                  {caseData.appellant.appealStats.approved || 0}
                </Text>
                <Text style={styles.historyStatLabel}>Approved</Text>
              </View>
              <View style={styles.historyStat}>
                <Text style={[styles.historyStatNumber, { color: colors.error[600] }]}>
                  {caseData.appellant.appealStats.denied || 0}
                </Text>
                <Text style={styles.historyStatLabel}>Denied</Text>
              </View>
            </View>
            {caseData.appellant.appealPatterns?.approvalRate !== undefined && (
              <View style={styles.approvalRateRow}>
                <Text style={styles.approvalRateLabel}>Approval Rate</Text>
                <Text style={styles.approvalRateValue}>
                  {caseData.appellant.appealPatterns.approvalRate}%
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Appointment Context */}
      {caseData.appointment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointment Details</Text>
          <View style={styles.appointmentCard}>
            <View style={styles.appointmentRow}>
              <Icon name="calendar" size={14} color={colors.text.tertiary} />
              <Text style={styles.appointmentText}>{formatDate(caseData.appointment.date)}</Text>
            </View>
            {caseData.appointment.home && (
              <View style={styles.appointmentRow}>
                <Icon name="map-marker" size={14} color={colors.text.tertiary} />
                <Text style={styles.appointmentText}>{caseData.appointment.home.address}</Text>
              </View>
            )}
            <View style={styles.appointmentRow}>
              <Icon name="usd" size={14} color={colors.text.tertiary} />
              <Text style={styles.appointmentText}>
                ${((caseData.appointment.price || 0) / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
  },
  severitylow: { backgroundColor: colors.success[100] },
  severitymedium: { backgroundColor: colors.warning[100] },
  severityhigh: { backgroundColor: colors.error[100] },
  severitycritical: { backgroundColor: colors.error[200] },
  severityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  descriptionCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  comparisonCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  comparisonColumn: {
    flex: 1,
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  comparisonValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  comparisonValueHighlight: {
    color: colors.primary[600],
  },
  partiesContainer: {
    gap: spacing.sm,
  },
  partyCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  partyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  partyLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    textTransform: "uppercase",
  },
  partyContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  partyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  partyAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  partyInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  partyName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  contactText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  scrutinyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  scrutinyBadgeHighRisk: {
    backgroundColor: colors.error[100],
  },
  scrutinyText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  scrutinyTextHighRisk: {
    color: colors.error[700],
  },
  historyCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  historyStat: {
    alignItems: "center",
  },
  historyStatNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  historyStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  approvalRateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  approvalRateLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  approvalRateValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  appointmentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  appointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appointmentText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
});

export default CaseOverviewSection;
