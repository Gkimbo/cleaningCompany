import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { API_BASE } from "../../services/config";
import { usePricing } from "../../context/PricingContext";

const PayoutHistory = ({ state, dispatch }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [payouts, setPayouts] = useState([]);
  const [totals, setTotals] = useState({
    totalPaidDollars: "0.00",
    pendingAmountDollars: "0.00",
    completedCount: 0,
    pendingCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate cleaner's share for a given price
  const calculateCleanerShare = (price, numCleaners = 1) => {
    const gross = parseFloat(price) || 0;
    const perCleaner = gross / numCleaners;
    return perCleaner * cleanerSharePercent;
  };

  // Calculate potential earnings from assigned appointments (not completed)
  const calculatePotentialEarnings = () => {
    const userId = String(state?.currentUser?.id);
    const appointments = state?.appointments || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingAssigned = appointments.filter((appt) => {
      const appointmentDate = new Date(appt.date);
      appointmentDate.setHours(0, 0, 0, 0);
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

        // Separate past and upcoming payouts
        const pastPayouts = allPayouts.filter((payout) => {
          const appointmentDate = new Date(payout.appointmentDate);
          appointmentDate.setHours(0, 0, 0, 0);
          return appointmentDate <= today;
        });

        // Completed payouts from past jobs only
        const completedPayouts = pastPayouts.filter((p) => p.status === "completed");

        // Total paid from completed payouts
        const totalPaidCents = completedPayouts.reduce((sum, p) => sum + (p.netAmount || 0), 0);

        // Calculate potential earnings from appointments (ensures consistency with Overview)
        const potentialEarnings = calculatePotentialEarnings();

        // Only show past payouts in the history list (not upcoming appointments)
        setPayouts(pastPayouts);
        setTotals({
          totalPaidDollars: (totalPaidCents / 100).toFixed(2),
          pendingAmountDollars: potentialEarnings.amount,
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { text: "Pending", color: "#FFC107" },
      held: { text: "Held", color: "#2196F3" },
      processing: { text: "Processing", color: "#9C27B0" },
      completed: { text: "Paid", color: "#4CAF50" },
      failed: { text: "Failed", color: "#F44336" },
    };
    return statusConfig[status] || { text: status, color: "#757575" };
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
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
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.loadingText}>Loading payout history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: "#4CAF50" }]}>
          <Text style={styles.summaryLabel}>Total Paid</Text>
          <Text style={styles.summaryAmount}>${totals.totalPaidDollars}</Text>
          <Text style={styles.summaryCount}>
            {totals.completedCount} payouts
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#2196F3" }]}>
          <Text style={styles.summaryLabel}>Potential Earnings</Text>
          <Text style={styles.summaryAmount}>${totals.pendingAmountDollars}</Text>
          <Text style={styles.summaryCount}>
            {totals.pendingCount} upcoming {totals.pendingCount === 1 ? "job" : "jobs"}
          </Text>
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          Payouts are processed automatically when you mark a job as complete.
        </Text>
      </View>

      {/* Payout History List */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Payout History</Text>

        {payouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No payouts yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Complete jobs to start earning!
            </Text>
          </View>
        ) : (
          payouts.map((payout) => {
            const status = getStatusBadge(payout.status);
            return (
              <View key={payout.id} style={styles.payoutItem}>
                <View style={styles.payoutHeader}>
                  <Text style={styles.payoutDate}>
                    {formatDate(payout.appointmentDate)}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: status.color },
                    ]}
                  >
                    <Text style={styles.statusText}>{status.text}</Text>
                  </View>
                </View>

                <View style={styles.payoutDetails}>
                  <View style={[styles.detailRow, styles.netRow]}>
                    <Text style={styles.netLabel}>Your Earnings:</Text>
                    <Text style={styles.netValue}>
                      {formatCurrency(payout.netAmount)}
                    </Text>
                  </View>
                </View>

                {payout.completedAt && (
                  <Text style={styles.completedDate}>
                    Paid on {formatDate(payout.completedAt)}
                  </Text>
                )}

                {payout.status === "held" && (
                  <Text style={styles.heldNote}>
                    Funds held until job completion
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = {
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#F0F4F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F4F7",
  },
  loadingText: {
    marginTop: 10,
    color: "#757575",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 15,
    padding: 18,
    marginHorizontal: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryAmount: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    marginVertical: 5,
  },
  summaryCount: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  infoBanner: {
    backgroundColor: "#E3F2FD",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  infoBannerText: {
    color: "#1565C0",
    fontSize: 13,
    lineHeight: 18,
  },
  listContainer: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
  },
  emptyState: {
    alignItems: "center",
    padding: 30,
  },
  emptyStateText: {
    color: "#757575",
    fontSize: 16,
    marginBottom: 5,
  },
  emptyStateSubtext: {
    color: "#9E9E9E",
    fontSize: 14,
  },
  payoutItem: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  payoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  payoutDate: {
    fontWeight: "600",
    fontSize: 15,
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  payoutDetails: {
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailLabel: {
    color: "#757575",
    fontSize: 13,
  },
  detailValue: {
    color: "#333",
    fontSize: 13,
  },
  detailValueNegative: {
    color: "#F44336",
    fontSize: 13,
  },
  netRow: {
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingTop: 8,
    marginTop: 6,
  },
  netLabel: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
  netValue: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "700",
  },
  completedDate: {
    marginTop: 10,
    color: "#4CAF50",
    fontSize: 12,
    fontStyle: "italic",
  },
  heldNote: {
    marginTop: 10,
    color: "#2196F3",
    fontSize: 12,
    fontStyle: "italic",
  },
};

export default PayoutHistory;
