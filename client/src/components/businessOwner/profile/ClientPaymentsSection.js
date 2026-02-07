import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import { formatCurrency } from "../../../services/formatters";
import BusinessOwnerService from "../../../services/fetchRequests/BusinessOwnerService";

const PaymentCard = ({ appointment, onMarkPaid, onSendReminder }) => {
  const navigate = useNavigate();

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown date";
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`;
    if (diffDays > 7) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const isOverdue = () => {
    if (!appointment.date) return false;
    const apptDate = new Date(appointment.date);
    const today = new Date();
    return apptDate < today && appointment.paymentStatus !== "paid";
  };

  const clientName = appointment.clientName || "Unknown Client";
  const overdue = isOverdue();

  return (
    <View style={[styles.paymentCard, overdue && styles.paymentCardOverdue]}>
      <View style={styles.paymentMain}>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentClient} numberOfLines={1}>
            {clientName}
          </Text>
          <View style={styles.paymentDetails}>
            <Text style={styles.paymentDate}>{formatDate(appointment.date)}</Text>
            {overdue && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueText}>Overdue</Text>
              </View>
            )}
          </View>
        </View>
        {/* Price is stored in dollars in DB, convert to cents for formatCurrency */}
        <Text style={[styles.paymentAmount, overdue && styles.paymentAmountOverdue]}>
          {formatCurrency((appointment.price || 0) * 100)}
        </Text>
      </View>

      <View style={styles.paymentActions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => onSendReminder(appointment)}
        >
          <Icon name="envelope" size={14} color={colors.primary[600]} />
          <Text style={styles.actionButtonText}>Remind</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.markPaidButton]}
          onPress={() => onMarkPaid(appointment)}
        >
          <Icon name="check" size={14} color={colors.success[600]} />
          <Text style={[styles.actionButtonText, styles.markPaidText]}>Mark Paid</Text>
        </Pressable>
      </View>
    </View>
  );
};

const ClientPaymentsSection = ({ state, onRefresh }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [unpaidAppointments, setUnpaidAppointments] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUnpaidAppointments = useCallback(async () => {
    if (!state?.currentUser?.token) return;

    try {
      const result = await BusinessOwnerService.getClientPayments(state.currentUser.token);
      setUnpaidAppointments(result.unpaidAppointments || []);
    } catch (error) {
      console.error("Error fetching client payments:", error);
    } finally {
      setLoading(false);
    }
  }, [state?.currentUser?.token]);

  useEffect(() => {
    fetchUnpaidAppointments();
  }, [fetchUnpaidAppointments]);

  const handleMarkPaid = async (appointment) => {
    Alert.alert(
      "Mark as Paid",
      `Mark the ${formatCurrency((appointment.price || 0) * 100)} payment from ${appointment.clientName} as paid?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Paid",
          onPress: async () => {
            setActionLoading(true);
            try {
              const result = await BusinessOwnerService.markAppointmentPaid(
                state.currentUser.token,
                appointment.id
              );
              if (result.success) {
                // Remove from list
                setUnpaidAppointments(prev =>
                  prev.filter(a => a.id !== appointment.id)
                );
                if (onRefresh) onRefresh();
              }
            } catch (error) {
              console.error("Error marking paid:", error);
              Alert.alert("Error", "Failed to mark as paid. Please try again.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSendReminder = async (appointment) => {
    Alert.alert(
      "Send Payment Reminder",
      `Send a payment reminder to ${appointment.clientName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setActionLoading(true);
            try {
              const result = await BusinessOwnerService.sendPaymentReminder(
                state.currentUser.token,
                appointment.id
              );
              if (result.success) {
                Alert.alert("Sent", "Payment reminder sent successfully.");
              }
            } catch (error) {
              console.error("Error sending reminder:", error);
              Alert.alert("Error", "Failed to send reminder. Please try again.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Calculate totals
  const totalUnpaid = unpaidAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
  const overdueCount = unpaidAppointments.filter(a => {
    const apptDate = new Date(a.date);
    return apptDate < new Date();
  }).length;

  // Show only first 4 appointments
  const displayedAppointments = unpaidAppointments.slice(0, 4);
  const remainingCount = Math.max(0, unpaidAppointments.length - 4);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="credit-card" size={16} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>Client Payments</Text>
          {unpaidAppointments.length > 0 && (
            <View style={[styles.countBadge, overdueCount > 0 && styles.countBadgeWarning]}>
              <Text style={[styles.countText, overdueCount > 0 && styles.countTextWarning]}>
                {unpaidAppointments.length}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          style={styles.viewAllButton}
          onPress={() => navigate("/business-owner/payroll")}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Payments Card */}
      <View style={styles.paymentsCard}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
          </View>
        ) : unpaidAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check-circle" size={32} color={colors.success[400]} />
            <Text style={styles.emptyStateTitle}>All paid up!</Text>
            <Text style={styles.emptyStateText}>No unpaid appointments</Text>
          </View>
        ) : (
          <>
            {/* Summary Banner */}
            <View style={styles.summaryBanner}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Unpaid Total</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(totalUnpaid)}</Text>
                <Text style={styles.summarySubtext}>
                  {unpaidAppointments.length} appointment{unpaidAppointments.length > 1 ? "s" : ""}
                  {overdueCount > 0 && ` • ${overdueCount} overdue`}
                </Text>
              </View>
            </View>

            {/* Payment List */}
            <View style={styles.paymentList}>
              {displayedAppointments.map((appointment) => (
                <PaymentCard
                  key={appointment.id}
                  appointment={appointment}
                  onMarkPaid={handleMarkPaid}
                  onSendReminder={handleSendReminder}
                />
              ))}
            </View>

            {/* Show More */}
            {remainingCount > 0 && (
              <Pressable
                style={styles.showMoreButton}
                onPress={() => navigate("/business-owner/payroll")}
              >
                <Text style={styles.showMoreText}>
                  +{remainingCount} more appointment{remainingCount > 1 ? "s" : ""}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {actionLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  countBadgeWarning: {
    backgroundColor: colors.warning[100],
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  countTextWarning: {
    color: colors.warning[700],
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  paymentsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: "hidden",
  },
  loadingState: {
    padding: spacing["2xl"],
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.xs,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  summaryBanner: {
    backgroundColor: colors.warning[50],
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[100],
  },
  summaryInfo: {
    gap: spacing.xxs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
  },
  summarySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
  },
  paymentList: {},
  paymentCard: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  paymentCardOverdue: {
    backgroundColor: colors.error[50],
  },
  paymentMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  paymentInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  paymentClient: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  paymentDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  paymentDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  overdueBadge: {
    backgroundColor: colors.error[100],
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  overdueText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
  },
  paymentAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  paymentAmountOverdue: {
    color: colors.error[700],
  },
  paymentActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  markPaidButton: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  markPaidText: {
    color: colors.success[700],
  },
  showMoreButton: {
    padding: spacing.md,
    alignItems: "center",
  },
  showMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ClientPaymentsSection;
