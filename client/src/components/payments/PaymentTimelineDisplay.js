import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

/**
 * Calculate business days range for bank arrival (1-2 business days after transfer)
 * @param {Date|string} transferDate - The date the transfer was initiated
 * @returns {{ earliest: Date, latest: Date }} - Range of expected arrival dates
 */
const calculateBankArrival = (transferDate) => {
  if (!transferDate) return null;

  const date = new Date(transferDate);
  if (isNaN(date.getTime())) return null;

  const addBusinessDays = (startDate, days) => {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        added++;
      }
    }
    return result;
  };

  return {
    earliest: addBusinessDays(date, 1),
    latest: addBusinessDays(date, 2),
  };
};

/**
 * Format a date for display (e.g., "Aug 12")
 */
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Format a date range for display (e.g., "Aug 16-17" or "Aug 16-Aug 17")
 */
const formatDateRange = (earliest, latest) => {
  if (!earliest || !latest) return null;
  const e = new Date(earliest);
  const l = new Date(latest);
  if (isNaN(e.getTime()) || isNaN(l.getTime())) return null;

  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  const lMonth = l.toLocaleDateString("en-US", { month: "short" });
  const eDay = e.getDate();
  const lDay = l.getDate();

  if (eMonth === lMonth) {
    return `${eMonth} ${eDay}-${lDay}`;
  }
  return `${eMonth} ${eDay} - ${lMonth} ${lDay}`;
};

/**
 * PaymentTimelineDisplay - Shows payment timeline for cleaners and homeowners
 *
 * @param {Object} props
 * @param {'cleaner'|'homeowner'} props.viewType - Which view to render
 * @param {Date|string} props.paymentCapturedAt - When homeowner was charged
 * @param {Date|string} props.jobCompletedAt - When job was marked complete
 * @param {Date|string} props.transferInitiatedAt - When Stripe transfer started
 * @param {Date|string} props.payoutCompletedAt - When payout completed (optional)
 * @param {'pending'|'held'|'processing'|'completed'|'failed'} props.payoutStatus
 * @param {boolean} props.compact - Use compact layout for tiles
 */
const PaymentTimelineDisplay = ({
  viewType = "cleaner",
  paymentCapturedAt,
  jobCompletedAt,
  transferInitiatedAt,
  payoutCompletedAt,
  payoutStatus = "pending",
  compact = false,
}) => {
  // Homeowner view: Simple display
  if (viewType === "homeowner") {
    const chargeDate = formatDate(paymentCapturedAt);

    if (!chargeDate) return null;

    return (
      <View style={[styles.homeownerContainer, compact && styles.compact]}>
        <View style={styles.homeownerRow}>
          <View style={styles.checkIcon}>
            <Feather name="check" size={12} color={colors.success[600]} />
          </View>
          <Text style={styles.homeownerText}>Charged on: {chargeDate}</Text>
        </View>
        <Text style={styles.homeownerNote}>Cleaner paid after completion</Text>
      </View>
    );
  }

  // Cleaner view: Full timeline
  const chargeDate = formatDate(paymentCapturedAt);
  const completedDate = formatDate(jobCompletedAt);
  const releasedDate = formatDate(transferInitiatedAt);
  const bankArrival = calculateBankArrival(transferInitiatedAt);
  const arrivalRange = bankArrival
    ? formatDateRange(bankArrival.earliest, bankArrival.latest)
    : null;

  // Determine which steps are complete/active
  const isCharged = !!paymentCapturedAt;
  const isCompleted = !!jobCompletedAt;
  const isReleased = !!transferInitiatedAt;
  const isArrived = payoutStatus === "completed" || !!payoutCompletedAt;
  const isFailed = payoutStatus === "failed";

  // Build timeline steps
  const steps = [];

  if (isCharged) {
    steps.push({
      icon: "credit-card",
      label: `Charged on: ${chargeDate}`,
      sublabel: "Card was charged",
      status: "completed",
    });
  }

  if (isCompleted) {
    steps.push({
      icon: "check-circle",
      label: `Job completed: ${completedDate}`,
      sublabel: "Marked complete",
      status: "completed",
    });
  } else if (isCharged) {
    steps.push({
      icon: "clock",
      label: "Job not yet completed",
      sublabel: "Complete the job to receive payout",
      status: "pending",
    });
  }

  if (isReleased) {
    steps.push({
      icon: "send",
      label: `Payout released: ${releasedDate}`,
      sublabel: "Transfer initiated to your bank",
      status: "completed",
    });
  } else if (isCompleted) {
    steps.push({
      icon: "loader",
      label: "Payout processing...",
      sublabel: "Transfer will be initiated soon",
      status: "processing",
    });
  }

  if (isFailed) {
    steps.push({
      icon: "alert-circle",
      label: "Payout failed",
      sublabel: "Please contact support",
      status: "failed",
    });
  } else if (isArrived) {
    steps.push({
      icon: "check",
      label: "Deposited to bank",
      sublabel: "Funds have arrived",
      status: "completed",
    });
  } else if (isReleased && arrivalRange) {
    steps.push({
      icon: "inbox",
      label: `Arrives in bank: ${arrivalRange}`,
      sublabel: "1-2 business days",
      status: "pending",
    });
  }

  if (steps.length === 0) return null;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepContainer}>
          {/* Connector line */}
          {index < steps.length - 1 && (
            <View
              style={[
                styles.connector,
                step.status === "completed" && styles.connectorCompleted,
              ]}
            />
          )}

          {/* Step indicator */}
          <View
            style={[
              styles.indicator,
              step.status === "completed" && styles.indicatorCompleted,
              step.status === "processing" && styles.indicatorProcessing,
              step.status === "failed" && styles.indicatorFailed,
              step.status === "pending" && styles.indicatorPending,
            ]}
          >
            <Feather
              name={step.icon}
              size={compact ? 10 : 12}
              color={
                step.status === "completed"
                  ? colors.success[600]
                  : step.status === "processing"
                  ? colors.primary[600]
                  : step.status === "failed"
                  ? colors.error[600]
                  : colors.neutral[400]
              }
            />
          </View>

          {/* Step content */}
          <View style={styles.stepContent}>
            <Text
              style={[
                styles.stepLabel,
                compact && styles.stepLabelCompact,
                step.status === "failed" && styles.stepLabelFailed,
              ]}
            >
              {step.label}
            </Text>
            {!compact && (
              <Text style={styles.stepSublabel}>{step.sublabel}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  compact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },

  // Step styles
  stepContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
    position: "relative",
  },
  connector: {
    position: "absolute",
    left: 10,
    top: 22,
    width: 2,
    height: "100%",
    backgroundColor: colors.neutral[200],
    zIndex: 0,
  },
  connectorCompleted: {
    backgroundColor: colors.success[300],
  },
  indicator: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    zIndex: 1,
  },
  indicatorCompleted: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  indicatorProcessing: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  indicatorFailed: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[500],
  },
  indicatorPending: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[300],
    borderStyle: "dashed",
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  stepLabelCompact: {
    fontSize: typography.fontSize.xs,
  },
  stepLabelFailed: {
    color: colors.error[700],
  },
  stepSublabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  // Homeowner view styles
  homeownerContainer: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.success[50],
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  homeownerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  homeownerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[800],
  },
  homeownerNote: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    marginLeft: 26,
  },
});

export default PaymentTimelineDisplay;
