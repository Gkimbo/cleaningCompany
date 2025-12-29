import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { API_BASE } from "../../services/config";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const baseURL = API_BASE.replace("/api/v1", "");

const Bill = ({ state, dispatch }) => {
  const [failedPayments, setFailedPayments] = useState([]);
  const [upcomingPayable, setUpcomingPayable] = useState([]);
  const [retryingPaymentId, setRetryingPaymentId] = useState(null);
  const [prePayingId, setPrePayingId] = useState(null);
  const [payingCancellationFee, setPayingCancellationFee] = useState(false);
  const [allAppointments, setAllAppointments] = useState([]);
  const navigate = useNavigate();

  const cancellationFee = Math.max(0, state?.bill?.cancellationFee || 0);
  const totalDue = Math.max(0, state?.bill?.totalDue || 0);
  const totalPaid = state?.bill?.totalPaid || 0;

  // Refresh appointments on mount
  useEffect(() => {
    const refreshAppointments = async () => {
      if (!state?.currentUser?.token) return;
      try {
        const response = await fetch(`${baseURL}/api/v1/user-info`, {
          headers: { Authorization: `Bearer ${state.currentUser.token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user?.appointments && dispatch) {
            dispatch({ type: "USER_APPOINTMENTS", payload: data.user.appointments });
          }
          if (data.user?.bill && dispatch) {
            dispatch({ type: "DB_BILL", payload: data.user.bill });
          }
        }
      } catch (err) {
        console.warn("Failed to refresh appointments:", err);
      }
    };
    refreshAppointments();
  }, []);

  useEffect(() => {
    const appointments = state?.appointments || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // All appointments sorted by date
    const sorted = [...appointments].sort((a, b) => new Date(a.date) - new Date(b.date));
    setAllAppointments(sorted);

    // Failed payments - need retry
    const failed = appointments
      .filter(appt => appt.paymentCaptureFailed && !appt.paid)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    setFailedPayments(failed);

    // Upcoming payable - can pre-pay
    const upcoming = appointments
      .filter(appt => {
        const apptDate = new Date(appt.date);
        apptDate.setHours(0, 0, 0, 0);
        return (
          !appt.paid &&
          apptDate > today &&
          appt.hasBeenAssigned &&
          appt.paymentIntentId &&
          !appt.paymentCaptureFailed
        );
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    setUpcomingPayable(upcoming);
  }, [state?.appointments]);

  const handleRetryPayment = async (appointmentId) => {
    setRetryingPaymentId(appointmentId);
    try {
      const response = await fetch(`${API_BASE}/payments/retry-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      Alert.alert("Success", "Payment completed successfully!");
      refreshData();
    } catch (err) {
      Alert.alert("Error", err.message || "Payment failed. Please try again.");
    } finally {
      setRetryingPaymentId(null);
    }
  };

  const handlePrePay = async (appointmentId) => {
    setPrePayingId(appointmentId);
    try {
      const response = await fetch(`${API_BASE}/payments/pre-pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      Alert.alert("Success", "Payment completed!");
      refreshData();
    } catch (err) {
      Alert.alert("Error", err.message || "Payment failed. Please try again.");
    } finally {
      setPrePayingId(null);
    }
  };

  const handlePayCancellationFee = async () => {
    if (cancellationFee <= 0) return;

    setPayingCancellationFee(true);
    const amountCents = Math.round(cancellationFee * 100);

    try {
      const response = await fetch(`${API_BASE}/payments/pay-bill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ amount: amountCents }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment failed");
      }

      if (data.bill && dispatch) {
        dispatch({ type: "DB_BILL", payload: data.bill });
      }

      Alert.alert("Success", "Cancellation fee paid successfully!");
      refreshData();
    } catch (err) {
      Alert.alert("Payment Error", err.message || "Could not process payment");
    } finally {
      setPayingCancellationFee(false);
    }
  };

  const refreshData = async () => {
    if (!state?.currentUser?.token) return;
    try {
      const response = await fetch(`${baseURL}/api/v1/user-info`, {
        headers: { Authorization: `Bearer ${state.currentUser.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user?.appointments && dispatch) {
          dispatch({ type: "USER_APPOINTMENTS", payload: data.user.appointments });
        }
        if (data.user?.bill && dispatch) {
          dispatch({ type: "DB_BILL", payload: data.user.bill });
        }
      }
    } catch (err) {
      console.warn("Failed to refresh data:", err);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Get unpaid future appointments (not failed, not payable yet)
  const unpaidPendingAppointments = allAppointments.filter(appt => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDate = new Date(appt.date);
    apptDate.setHours(0, 0, 0, 0);
    return (
      !appt.paid &&
      apptDate > today &&
      !appt.paymentCaptureFailed &&
      (!appt.hasBeenAssigned || !appt.paymentIntentId)
    );
  });

  // Get paid appointments (future - for showing paid status)
  const paidFutureAppointments = allAppointments.filter(appt => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDate = new Date(appt.date);
    apptDate.setHours(0, 0, 0, 0);
    return appt.paid && apptDate >= today;
  });

  // Get paid past appointments (for payment history)
  const paidPastAppointments = allAppointments.filter(appt => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDate = new Date(appt.date);
    apptDate.setHours(0, 0, 0, 0);
    return appt.paid && apptDate < today;
  }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="chevron-left" size={14} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My Bill</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Amount Due Now</Text>
        <Text style={styles.summaryAmount}>
          ${(cancellationFee).toFixed(2)}
        </Text>
        {totalPaid > 0 && (
          <Text style={styles.summaryPaid}>Total paid to date: ${totalPaid.toFixed(2)}</Text>
        )}
      </View>

      {/* Payment Methods Link */}
      <Pressable style={styles.paymentMethodsCard} onPress={() => navigate("/payment-setup")}>
        <View style={styles.paymentMethodsLeft}>
          <View style={styles.paymentMethodsIcon}>
            <Icon name="credit-card" size={18} color={colors.primary[600]} />
          </View>
          <View>
            <Text style={styles.paymentMethodsTitle}>Payment Methods</Text>
            <Text style={styles.paymentMethodsSubtitle}>Add or manage your cards</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
      </Pressable>

      {/* Cancellation Fees Section */}
      {cancellationFee > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cancellation Fees</Text>
          <View style={styles.feeCard}>
            <View style={styles.feeInfo}>
              <View style={styles.feeIconContainer}>
                <Icon name="exclamation-circle" size={16} color={colors.warning[600]} />
              </View>
              <View style={styles.feeDetails}>
                <Text style={styles.feeLabel}>Outstanding Cancellation Fee</Text>
                <Text style={styles.feeNote}>Due immediately</Text>
              </View>
              <Text style={styles.feeAmount}>${cancellationFee.toFixed(2)}</Text>
            </View>
            <Pressable
              style={[styles.payButton, payingCancellationFee && styles.payButtonDisabled]}
              onPress={handlePayCancellationFee}
              disabled={payingCancellationFee}
            >
              {payingCancellationFee ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Text style={styles.payButtonText}>Pay Now</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Failed Payments Section */}
      {failedPayments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Failed Payments</Text>
          <Text style={styles.sectionSubtitle}>Retry to avoid appointment cancellation</Text>
          {failedPayments.map(appt => (
            <View key={appt.id} style={styles.failedCard}>
              <View style={styles.appointmentRow}>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentDate}>{formatDate(appt.date)}</Text>
                  <Text style={styles.appointmentHome}>
                    {appt.home?.nickName || appt.nickName || "Home"}
                  </Text>
                </View>
                <Text style={styles.appointmentPriceError}>${Number(appt.price).toFixed(2)}</Text>
              </View>
              <Pressable
                style={[styles.retryButton, retryingPaymentId === appt.id && styles.retryButtonDisabled]}
                onPress={() => handleRetryPayment(appt.id)}
                disabled={retryingPaymentId === appt.id}
              >
                {retryingPaymentId === appt.id ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <Text style={styles.retryButtonText}>Retry Payment</Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming Appointments - Can Pay Early */}
      {upcomingPayable.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pay Early</Text>
          <Text style={styles.sectionSubtitle}>
            These appointments can be paid now instead of waiting for auto-charge
          </Text>
          {upcomingPayable.map(appt => (
            <View key={appt.id} style={styles.appointmentCard}>
              <View style={styles.appointmentRow}>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentDate}>{formatDate(appt.date)}</Text>
                  <Text style={styles.appointmentHome}>
                    {appt.home?.nickName || appt.nickName || "Home"}
                  </Text>
                </View>
                <Text style={styles.appointmentPrice}>${Number(appt.price).toFixed(2)}</Text>
              </View>
              <Pressable
                style={[styles.payEarlyButton, prePayingId === appt.id && styles.payEarlyButtonDisabled]}
                onPress={() => handlePrePay(appt.id)}
                disabled={prePayingId === appt.id}
              >
                {prePayingId === appt.id ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  <>
                    <Icon name="credit-card" size={12} color={colors.primary[600]} />
                    <Text style={styles.payEarlyButtonText}>Pay Now</Text>
                  </>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Pending Appointments - Not Yet Payable */}
      {unpaidPendingAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled Appointments</Text>
          <Text style={styles.sectionSubtitle}>
            Payment will be available once a cleaner is assigned
          </Text>
          {unpaidPendingAppointments.map(appt => (
            <View key={appt.id} style={styles.pendingCard}>
              <View style={styles.appointmentRow}>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentDate}>{formatDate(appt.date)}</Text>
                  <Text style={styles.appointmentHome}>
                    {appt.home?.nickName || appt.nickName || "Home"}
                  </Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending</Text>
                </View>
              </View>
              <Text style={styles.pendingPrice}>${Number(appt.price).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Paid Upcoming Appointments */}
      {paidFutureAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paid (Upcoming)</Text>
          {paidFutureAppointments.map(appt => (
            <View key={appt.id} style={styles.paidCard}>
              <View style={styles.appointmentRow}>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentDatePaid}>{formatDate(appt.date)}</Text>
                  <Text style={styles.appointmentHomePaid}>
                    {appt.home?.nickName || appt.nickName || "Home"}
                  </Text>
                </View>
                <View style={styles.paidBadge}>
                  <Icon name="check-circle" size={12} color={colors.success[600]} />
                  <Text style={styles.paidBadgeText}>Paid</Text>
                </View>
              </View>
              <Text style={styles.paidPrice}>${Number(appt.price).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Payment History - Past Paid Appointments */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment History</Text>
        {paidPastAppointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No payment history yet</Text>
          </View>
        ) : (
          <View style={styles.historyCard}>
            {paidPastAppointments.slice(0, 10).map((appt) => (
              <View key={appt.id} style={styles.historyItem}>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyDate}>{formatDate(appt.date)}</Text>
                  <Text style={styles.historyHome}>
                    {appt.home?.nickName || appt.nickName || "Home"}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>${Number(appt.price).toFixed(2)}</Text>
                  <View style={styles.historyPaidBadge}>
                    <Icon name="check" size={10} color={colors.success[600]} />
                  </View>
                </View>
              </View>
            ))}
            {paidPastAppointments.length > 10 && (
              <Text style={styles.moreText}>
                +{paidPastAppointments.length - 10} more past cleanings
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 60,
  },
  summaryCard: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
    color: colors.primary[100],
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  summaryPaid: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[200],
    marginTop: spacing.md,
  },
  paymentMethodsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  paymentMethodsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  paymentMethodsIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  paymentMethodsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  paymentMethodsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  feeCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  feeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  feeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  feeDetails: {
    flex: 1,
  },
  feeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  feeNote: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  feeAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  payButton: {
    backgroundColor: colors.warning[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  payButtonDisabled: {
    backgroundColor: colors.warning[300],
  },
  payButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  failedCard: {
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  appointmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  appointmentHome: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  appointmentPriceError: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
  },
  retryButton: {
    backgroundColor: colors.error[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  retryButtonDisabled: {
    backgroundColor: colors.error[300],
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  appointmentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  appointmentPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  payEarlyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  payEarlyButtonDisabled: {
    opacity: 0.6,
  },
  payEarlyButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  pendingCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pendingBadge: {
    backgroundColor: colors.neutral[200],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  pendingBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  pendingPrice: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  paidCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success[100],
  },
  appointmentDatePaid: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  appointmentHomePaid: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  paidBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  paidPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  moreText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  historyCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  historyHome: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  historyRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  historyAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  historyPaidBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default Bill;
