import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const FinancialSection = ({ caseData, caseType }) => {
  if (!caseData) return null;

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "$0.00";
    return `$${(amount / 100).toFixed(2)}`;
  };

  const appointment = caseData.appointment;
  const financialImpact = caseData.financialImpact;

  return (
    <View style={styles.container}>
      {/* Original Payment */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Original Payment</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Appointment Price</Text>
            <Text style={styles.value}>{formatCurrency(appointment?.price)}</Text>
          </View>
          {appointment?.paymentStatus && (
            <View style={styles.row}>
              <Text style={styles.label}>Payment Status</Text>
              <View style={[styles.statusBadge, styles[`status_${appointment.paymentStatus}`]]}>
                <Text style={styles.statusText}>{appointment.paymentStatus}</Text>
              </View>
            </View>
          )}
          {appointment?.paymentIntentId && (
            <View style={styles.row}>
              <Text style={styles.label}>Payment ID</Text>
              <Text style={styles.valueSmall}>{appointment.paymentIntentId.slice(0, 20)}...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Financial Impact */}
      {caseType === "appeal" && financialImpact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disputed Amount</Text>
          <View style={styles.card}>
            {financialImpact.originalPenaltyAmount > 0 && (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Icon name="ban" size={12} color={colors.error[500]} />
                  <Text style={styles.label}>Penalty Charged</Text>
                </View>
                <Text style={[styles.value, styles.valueError]}>
                  {formatCurrency(financialImpact.originalPenaltyAmount)}
                </Text>
              </View>
            )}
            {financialImpact.originalRefundWithheld > 0 && (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Icon name="minus-circle" size={12} color={colors.warning[500]} />
                  <Text style={styles.label}>Refund Withheld</Text>
                </View>
                <Text style={[styles.value, styles.valueWarning]}>
                  {formatCurrency(financialImpact.originalRefundWithheld)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Adjustment Impact */}
      {caseType === "adjustment" && financialImpact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Adjustment</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Original Price</Text>
              <Text style={styles.value}>{formatCurrency(financialImpact.originalPrice)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Adjusted Price</Text>
              <Text style={[styles.value, styles.valueHighlight]}>
                {formatCurrency(financialImpact.calculatedNewPrice)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Icon
                  name={financialImpact.priceDifference > 0 ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={financialImpact.priceDifference > 0 ? colors.success[500] : colors.error[500]}
                />
                <Text style={styles.labelBold}>Difference</Text>
              </View>
              <Text style={[
                styles.valueBold,
                financialImpact.priceDifference > 0 ? styles.valueSuccess : styles.valueError,
              ]}>
                {financialImpact.priceDifference > 0 ? "+" : ""}
                {formatCurrency(financialImpact.priceDifference)}
              </Text>
            </View>
            {financialImpact.chargeStatus && (
              <View style={styles.row}>
                <Text style={styles.label}>Charge Status</Text>
                <View style={[styles.statusBadge, styles[`status_${financialImpact.chargeStatus}`]]}>
                  <Text style={styles.statusText}>{financialImpact.chargeStatus}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Cancellation Details */}
      {appointment?.wasCancelled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cancellation Details</Text>
          <View style={styles.card}>
            {appointment.cancellationReason && (
              <View style={styles.row}>
                <Text style={styles.label}>Reason</Text>
                <Text style={styles.value}>{appointment.cancellationReason}</Text>
              </View>
            )}
            {appointment.cancellationFeeCharged > 0 && (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Icon name="usd" size={12} color={colors.error[500]} />
                  <Text style={styles.label}>Fee Charged</Text>
                </View>
                <Text style={[styles.value, styles.valueError]}>
                  {formatCurrency(appointment.cancellationFeeCharged)}
                </Text>
              </View>
            )}
            {appointment.refundAmount > 0 && (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Icon name="undo" size={12} color={colors.success[500]} />
                  <Text style={styles.label}>Refund Issued</Text>
                </View>
                <Text style={[styles.value, styles.valueSuccess]}>
                  {formatCurrency(appointment.refundAmount)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Resolution (if resolved) */}
      {caseData.resolution && Object.keys(caseData.resolution).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resolution Actions</Text>
          <View style={[styles.card, styles.cardSuccess]}>
            {caseData.resolution.refundAmount > 0 && (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Icon name="check-circle" size={12} color={colors.success[600]} />
                  <Text style={[styles.label, styles.labelSuccess]}>Refund Approved</Text>
                </View>
                <Text style={[styles.value, styles.valueSuccess]}>
                  {formatCurrency(caseData.resolution.refundAmount)}
                </Text>
              </View>
            )}
            {caseData.resolution.feeRefunded && (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Icon name="check-circle" size={12} color={colors.success[600]} />
                  <Text style={[styles.label, styles.labelSuccess]}>Fee Reversed</Text>
                </View>
                <Text style={[styles.value, styles.valueSuccess]}>
                  {formatCurrency(caseData.resolution.feeAmount)}
                </Text>
              </View>
            )}
            {caseData.resolution.ratingRemoved && (
              <View style={styles.resolutionItem}>
                <Icon name="check" size={12} color={colors.success[600]} />
                <Text style={styles.resolutionText}>Penalty rating removed</Text>
              </View>
            )}
            {caseData.resolution.accountUnfrozen && (
              <View style={styles.resolutionItem}>
                <Icon name="check" size={12} color={colors.success[600]} />
                <Text style={styles.resolutionText}>Account unfrozen</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Stripe Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Processing</Text>
        <View style={styles.infoCard}>
          <Icon name="info-circle" size={14} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            All financial transactions are processed through Stripe. Refunds typically appear within 5-10 business days.
          </Text>
        </View>
      </View>
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
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardSuccess: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  labelBold: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  labelSuccess: {
    color: colors.success[700],
  },
  value: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  valueBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  valueSmall: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontFamily: "monospace",
  },
  valueHighlight: {
    color: colors.primary[600],
  },
  valueSuccess: {
    color: colors.success[600],
  },
  valueError: {
    color: colors.error[600],
  },
  valueWarning: {
    color: colors.warning[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
  },
  status_succeeded: {
    backgroundColor: colors.success[100],
  },
  status_pending: {
    backgroundColor: colors.warning[100],
  },
  status_failed: {
    backgroundColor: colors.error[100],
  },
  status_waived: {
    backgroundColor: colors.primary[100],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  resolutionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  resolutionText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
});

export default FinancialSection;
