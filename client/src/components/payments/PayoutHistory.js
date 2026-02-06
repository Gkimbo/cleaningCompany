import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { API_BASE } from "../../services/config";
import { usePricing } from "../../context/PricingContext";
import PaymentTimelineDisplay from "./PaymentTimelineDisplay";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
} from "../../services/styles/theme";

const PayoutHistory = ({ state, dispatch }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [payouts, setPayouts] = useState([]);
  const [totals, setTotals] = useState({
    totalPaidDollars: "0.00",
    pendingAmountDollars: "0.00",
    totalBonusDollars: "0.00",
    completedCount: 0,
    pendingCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const calculateCleanerShare = (price, numCleaners = 1) => {
    const gross = parseFloat(price) || 0;
    const perCleaner = gross / numCleaners;
    return perCleaner * cleanerSharePercent;
  };

  const calculatePotentialEarnings = () => {
    const userId = String(state?.currentUser?.id);
    const appointments = state?.appointments || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingAssigned = appointments.filter((appt) => {
      const appointmentDate = new Date(appt.date + "T00:00:00");
      return (
        appointmentDate > today &&
        !appt.completed &&
        appt.employeesAssigned &&
        appt.employeesAssigned.includes(userId)
      );
    });

    const total = upcomingAssigned.reduce((sum, appt) => {
      const numCleaners = appt.employeesAssigned?.length || 1;
      return sum + calculateCleanerShare(appt.price, numCleaners);
    }, 0);

    return {
      amount: total.toFixed(2),
      count: upcomingAssigned.length,
    };
  };

  const fetchPayouts = async () => {
    if (!state?.currentUser?.id) return;
    try {
      const res = await fetch(
        `${API_BASE}/stripe-connect/payouts/${state.currentUser.id}`
      );
      const data = await res.json();
      if (res.ok) {
        const allPayouts = data.payouts || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastPayouts = allPayouts.filter((payout) => {
          const dateStr =
            payout.appointmentDate?.length === 10
              ? payout.appointmentDate + "T00:00:00"
              : payout.appointmentDate;
          const appointmentDate = new Date(dateStr);
          return appointmentDate <= today;
        });

        const completedPayouts = pastPayouts.filter(
          (p) => p.status === "completed"
        );
        const totalPaidCents = completedPayouts.reduce(
          (sum, p) => sum + (p.netAmount || 0),
          0
        );
        const totalBonusCents = completedPayouts.reduce(
          (sum, p) => sum + (p.preferredBonusApplied ? (p.preferredBonusAmount || 0) : 0),
          0
        );
        const potentialEarnings = calculatePotentialEarnings();

        setPayouts(pastPayouts);
        setTotals({
          totalPaidDollars: (totalPaidCents / 100).toFixed(2),
          pendingAmountDollars: potentialEarnings.amount,
          totalBonusDollars: (totalBonusCents / 100).toFixed(2),
          completedCount: completedPayouts.length,
          pendingCount: potentialEarnings.count,
        });
      }
    } catch (err) {
      console.error("Error fetching payouts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPayouts();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPayouts();
  }, [state?.currentUser?.id, state?.appointments, pricing]);

  const getStatusStyle = (status) => {
    const statusConfig = {
      pending: { text: "Pending", type: "warning" },
      held: { text: "Held", type: "primary" },
      processing: { text: "Processing", type: "primary" },
      completed: { text: "Paid", type: "success" },
      failed: { text: "Failed", type: "error" },
    };
    return statusConfig[status] || { text: status, type: "neutral" };
  };

  const getTierStyle = (tier) => {
    const tierConfig = {
      bronze: { label: "Bronze", color: "#CD7F32", bgColor: "#FDF5E6" },
      silver: { label: "Silver", color: "#757575", bgColor: "#F5F5F5" },
      gold: { label: "Gold", color: "#D4AF37", bgColor: "#FFFACD" },
      platinum: { label: "Platinum", color: "#6B7280", bgColor: "#E5E7EB" },
    };
    return tierConfig[tier] || null;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const dateStr =
      dateString.length === 10 ? dateString + "T00:00:00" : dateString;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading payout history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary[600]}
        />
      }
    >
      {/* Summary Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.totalPaidCard]}>
          <View style={styles.statHeader}>
            <Feather name="check-circle" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
          <Text style={styles.statAmount}>${totals.totalPaidDollars}</Text>
          <Text style={styles.statSubtext}>
            {totals.completedCount} {totals.completedCount === 1 ? "payout" : "payouts"}
          </Text>
        </View>
        <View style={[styles.statCard, styles.potentialCard]}>
          <View style={styles.statHeader}>
            <Feather name="trending-up" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={styles.statLabel}>Potential</Text>
          </View>
          <Text style={styles.statAmount}>${totals.pendingAmountDollars}</Text>
          <Text style={styles.statSubtext}>
            {totals.pendingCount} upcoming {totals.pendingCount === 1 ? "job" : "jobs"}
          </Text>
        </View>
      </View>

      {/* Tier Bonus Banner */}
      {parseFloat(totals.totalBonusDollars) > 0 && (
        <View style={styles.bonusBanner}>
          <View style={styles.bonusBannerIconContainer}>
            <Feather name="award" size={20} color={colors.success[600]} />
          </View>
          <View style={styles.bonusBannerContent}>
            <Text style={styles.bonusBannerTitle}>Tier Bonuses Earned</Text>
            <Text style={styles.bonusBannerAmount}>${totals.totalBonusDollars}</Text>
            <Text style={styles.bonusBannerSubtext}>
              Extra earnings from your preferred tier status
            </Text>
          </View>
        </View>
      )}

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Feather
          name="info"
          size={18}
          color={colors.primary[700]}
          style={styles.infoBannerIcon}
        />
        <Text style={styles.infoBannerText}>
          Payouts are processed automatically when you mark a job as complete.
        </Text>
      </View>

      {/* Payout History List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Payout History</Text>
          {payouts.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{payouts.length}</Text>
            </View>
          )}
        </View>

        {payouts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Feather name="inbox" size={40} color={colors.neutral[400]} />
            </View>
            <Text style={styles.emptyStateText}>No payouts yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Complete jobs to start earning!
            </Text>
          </View>
        ) : (
          payouts.map((payout) => {
            const status = getStatusStyle(payout.status);
            const tierStyle = payout.cleanerTierAtPayout ? getTierStyle(payout.cleanerTierAtPayout) : null;
            const hasBonus = payout.preferredBonusApplied && payout.preferredBonusAmount > 0;
            const baseAmount = hasBonus ? payout.netAmount - payout.preferredBonusAmount : payout.netAmount;
            return (
              <View key={payout.id} style={styles.payoutItem}>
                <View style={styles.payoutHeader}>
                  <View style={styles.payoutDateRow}>
                    <Feather
                      name="calendar"
                      size={14}
                      color={colors.neutral[500]}
                      style={styles.payoutDateIcon}
                    />
                    <Text style={styles.payoutDate}>
                      {formatDate(payout.appointmentDate)}
                    </Text>
                  </View>
                  <View style={styles.badgeRow}>
                    {tierStyle && (
                      <View style={[styles.tierBadge, { backgroundColor: tierStyle.bgColor }]}>
                        <Feather name="award" size={10} color={tierStyle.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.tierBadgeText, { color: tierStyle.color }]}>
                          {tierStyle.label}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.statusBadge, styles[`statusBadge_${status.type}`]]}>
                      <Text style={[styles.statusText, styles[`statusText_${status.type}`]]}>
                        {status.text}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.payoutDetails}>
                  {hasBonus ? (
                    <>
                      <View style={styles.earningsBreakdown}>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Base Pay</Text>
                          <Text style={styles.breakdownValue}>{formatCurrency(baseAmount)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <View style={styles.bonusLabelRow}>
                            <Feather name="trending-up" size={12} color={colors.success[600]} style={{ marginRight: 4 }} />
                            <Text style={styles.bonusLabel}>
                              Tier Bonus ({payout.preferredBonusPercent}%)
                            </Text>
                          </View>
                          <Text style={styles.bonusValue}>+{formatCurrency(payout.preferredBonusAmount)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                          <Text style={styles.totalLabel}>Total</Text>
                          <Text style={styles.earningsValue}>{formatCurrency(payout.netAmount)}</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <View style={styles.earningsRow}>
                      <Text style={styles.earningsLabel}>Your Earnings</Text>
                      <Text style={styles.earningsValue}>
                        {formatCurrency(payout.netAmount)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Payment Timeline */}
                {payout.paymentCapturedAt && (
                  <PaymentTimelineDisplay
                    viewType="cleaner"
                    paymentCapturedAt={payout.paymentCapturedAt}
                    jobCompletedAt={payout.jobCompletedAt}
                    transferInitiatedAt={payout.transferInitiatedAt}
                    payoutCompletedAt={payout.completedAt}
                    payoutStatus={payout.status}
                    compact={false}
                  />
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    backgroundColor: colors.neutral[100],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  totalPaidCard: {
    backgroundColor: colors.success[600],
  },
  potentialCard: {
    backgroundColor: colors.primary[600],
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  statAmount: {
    color: colors.neutral[0],
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: typography.fontSize.xs,
  },

  // Bonus Banner
  bonusBanner: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  bonusBannerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  bonusBannerContent: {
    flex: 1,
  },
  bonusBannerTitle: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  bonusBannerAmount: {
    color: colors.success[700],
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  bonusBannerSubtext: {
    color: colors.success[600],
    fontSize: typography.fontSize.xs,
  },

  // Info Banner
  infoBanner: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  infoBannerIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  infoBannerText: {
    flex: 1,
    color: colors.primary[700],
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  // List Container
  listContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  listTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.primary[100],
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  countBadgeText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    padding: spacing["3xl"],
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyStateText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    color: colors.neutral[400],
    fontSize: typography.fontSize.sm,
  },

  // Payout Item
  payoutItem: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  payoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  payoutDateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  payoutDateIcon: {
    marginRight: spacing.xs,
  },
  payoutDate: {
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },

  // Badge Row
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  tierBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  // Status Badges
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusBadge_success: {
    backgroundColor: colors.success[100],
  },
  statusBadge_warning: {
    backgroundColor: colors.warning[100],
  },
  statusBadge_primary: {
    backgroundColor: colors.primary[100],
  },
  statusBadge_error: {
    backgroundColor: colors.error[100],
  },
  statusBadge_neutral: {
    backgroundColor: colors.neutral[200],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  statusText_success: {
    color: colors.success[700],
  },
  statusText_warning: {
    color: colors.warning[700],
  },
  statusText_primary: {
    color: colors.primary[700],
  },
  statusText_error: {
    color: colors.error[700],
  },
  statusText_neutral: {
    color: colors.neutral[600],
  },

  // Payout Details
  payoutDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.md,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  earningsLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  earningsValue: {
    color: colors.success[600],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  // Earnings Breakdown (with bonus)
  earningsBreakdown: {
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  breakdownValue: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  bonusLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bonusLabel: {
    color: colors.success[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  bonusValue: {
    color: colors.success[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    marginTop: spacing.xs,
  },
  totalLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Paid Date
  paidDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  paidDateIcon: {
    marginRight: spacing.xs,
  },
  paidDateText: {
    color: colors.success[600],
    fontSize: typography.fontSize.xs,
  },

  // Held Note
  heldNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  heldNoteIcon: {
    marginRight: spacing.xs,
  },
  heldNoteText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.xs,
  },
});

export default PayoutHistory;
