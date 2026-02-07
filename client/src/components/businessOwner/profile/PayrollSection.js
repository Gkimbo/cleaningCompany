import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import { formatCurrency } from "../../../services/formatters";

const PayoutItem = ({ payout, onMarkPaid }) => {
  const navigate = useNavigate();

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown date";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const employeeName = payout.employee
    ? `${payout.employee.firstName} ${payout.employee.lastName}`
    : "Unknown Employee";

  const clientName = payout.clientName || "Client";

  return (
    <View style={styles.payoutItem}>
      <View style={styles.payoutMain}>
        <Text style={styles.payoutEmployee} numberOfLines={1}>
          {employeeName}
        </Text>
        <View style={styles.payoutDetails}>
          <Text style={styles.payoutClient} numberOfLines={1}>
            {clientName}
          </Text>
          <Text style={styles.payoutDot}></Text>
          <Text style={styles.payoutDate}>{formatDate(payout.completedAt)}</Text>
        </View>
      </View>
      <View style={styles.payoutActions}>
        <Text style={styles.payoutAmount}>{formatCurrency(payout.payAmount || 0)}</Text>
        <Pressable
          style={styles.markPaidButton}
          onPress={() => onMarkPaid(payout)}
        >
          <Icon name="check" size={12} color={colors.success[600]} />
        </Pressable>
      </View>
    </View>
  );
};

const PayrollSection = ({ pendingPayouts, totalOwed, state, onRefresh }) => {
  const navigate = useNavigate();

  // Group payouts by employee
  const payoutsByEmployee = {};
  pendingPayouts.forEach((payout) => {
    const empId = payout.businessEmployeeId;
    if (!payoutsByEmployee[empId]) {
      payoutsByEmployee[empId] = {
        employee: payout.employee,
        payouts: [],
        totalOwed: 0,
      };
    }
    payoutsByEmployee[empId].payouts.push(payout);
    payoutsByEmployee[empId].totalOwed += payout.payAmount || 0;
  });

  const employeesWithPayouts = Object.values(payoutsByEmployee);
  const totalEmployeesOwed = employeesWithPayouts.length;

  // Show only first 3 payouts in summary
  const displayedPayouts = pendingPayouts.slice(0, 3);
  const remainingCount = Math.max(0, pendingPayouts.length - 3);

  const handleMarkPaid = async (payout) => {
    // Navigate to payroll screen with the specific payout
    navigate(`/business-owner/payroll?highlight=${payout.id}`);
  };

  const handlePayAll = () => {
    navigate("/business-owner/payroll");
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="credit-card" size={16} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>Payroll</Text>
          {pendingPayouts.length > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{pendingPayouts.length}</Text>
            </View>
          )}
        </View>
        <Pressable
          style={styles.viewAllButton}
          onPress={() => navigate("/business-owner/payroll")}
        >
          <Text style={styles.viewAllText}>Manage</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Payroll Card */}
      <View style={styles.payrollCard}>
        {pendingPayouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check-circle" size={32} color={colors.success[400]} />
            <Text style={styles.emptyStateTitle}>All caught up!</Text>
            <Text style={styles.emptyStateText}>No pending payroll</Text>
          </View>
        ) : (
          <>
            {/* Summary Banner */}
            <View style={styles.summaryBanner}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Total Owed</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(totalOwed)}</Text>
                <Text style={styles.summarySubtext}>
                  to {totalEmployeesOwed} employee{totalEmployeesOwed > 1 ? "s" : ""}
                </Text>
              </View>
              <Pressable style={styles.payAllButton} onPress={handlePayAll}>
                <Icon name="money" size={14} color={colors.neutral[0]} />
                <Text style={styles.payAllText}>View All</Text>
              </Pressable>
            </View>

            {/* Payout List */}
            <View style={styles.payoutList}>
              {displayedPayouts.map((payout) => (
                <PayoutItem
                  key={payout.id}
                  payout={payout}
                  onMarkPaid={handleMarkPaid}
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
                  +{remainingCount} more payout{remainingCount > 1 ? "s" : ""}
                </Text>
              </Pressable>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/business-owner/payroll")}
              >
                <Icon name="history" size={14} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>Pay History</Text>
              </Pressable>
            </View>
          </>
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
  alertBadge: {
    backgroundColor: colors.warning[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    minWidth: 20,
    alignItems: "center",
  },
  alertBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
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
  payrollCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: "hidden",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  payAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  payAllText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  payoutList: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  payoutItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  payoutMain: {
    flex: 1,
    marginRight: spacing.md,
  },
  payoutEmployee: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  payoutDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  payoutClient: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  payoutDot: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  payoutDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  payoutActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  payoutAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  markPaidButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.success[50],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  showMoreButton: {
    padding: spacing.md,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  showMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: "row",
    padding: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
});

export default PayrollSection;
