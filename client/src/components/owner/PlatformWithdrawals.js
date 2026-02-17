import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import OwnerDashboardService from "../../services/fetchRequests/OwnerDashboardService";
import useSafeNavigation from "../../hooks/useSafeNavigation";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const PlatformWithdrawals = ({ state }) => {
  const { goBack } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [error, setError] = useState(null);

  // Withdrawal modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDescription, setWithdrawDescription] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(null);

  useEffect(() => {
    if (state.currentUser.token) {
      fetchData();
    }
  }, [state.currentUser.token]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [balanceData, withdrawalsData] = await Promise.all([
        OwnerDashboardService.getStripeBalance(state.currentUser.token),
        OwnerDashboardService.getWithdrawals(state.currentUser.token),
      ]);

      setBalance(balanceData);
      setWithdrawals(withdrawalsData.withdrawals || []);
    } catch (err) {
      console.error("Failed to fetch withdrawal data:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [state.currentUser.token]);

  const handleWithdraw = async () => {
    const amountDollars = parseFloat(withdrawAmount);
    if (isNaN(amountDollars) || amountDollars < 1) {
      setWithdrawError("Please enter a valid amount (minimum $1.00)");
      return;
    }

    const amountCents = Math.round(amountDollars * 100);

    if (amountCents > balance.withdrawableBalance.cents) {
      setWithdrawError(
        `Amount exceeds available balance of $${balance.withdrawableBalance.dollars}`
      );
      return;
    }

    setWithdrawing(true);
    setWithdrawError(null);

    const result = await OwnerDashboardService.createWithdrawal(
      state.currentUser.token,
      amountCents,
      withdrawDescription
    );

    setWithdrawing(false);

    if (result.success) {
      setWithdrawSuccess(result.message);
      setWithdrawAmount("");
      setWithdrawDescription("");
      // Refresh data after successful withdrawal
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawSuccess(null);
        fetchData();
      }, 2000);
    } else {
      setWithdrawError(result.error || "Failed to process withdrawal");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return colors.success[600];
      case "processing":
      case "pending":
        return colors.warning[600];
      case "failed":
      case "canceled":
        return colors.error[600];
      default:
        return colors.text.secondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return "check-circle";
      case "processing":
      case "pending":
        return "clock-o";
      case "failed":
      case "canceled":
        return "times-circle";
      default:
        return "question-circle";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          onPress={() => goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={16} color={colors.primary[600]} />
        </Pressable>
        <Text style={styles.headerTitle}>Platform Withdrawals</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available to Withdraw</Text>
        <Text style={styles.balanceAmount}>
          ${balance?.withdrawableBalance?.dollars || "0.00"}
        </Text>

        <View style={styles.balanceDetails}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceDetailLabel}>Stripe Balance</Text>
            <Text style={styles.balanceDetailValue}>
              ${balance?.available?.dollars || "0.00"}
            </Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceDetailLabel}>Pending in Stripe</Text>
            <Text style={styles.balanceDetailValue}>
              ${balance?.pending?.dollars || "0.00"}
            </Text>
          </View>
          {balance?.pendingWithdrawals?.count > 0 && (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceDetailLabel}>
                Pending Withdrawals ({balance.pendingWithdrawals.count})
              </Text>
              <Text style={[styles.balanceDetailValue, { color: colors.warning[600] }]}>
                -${balance.pendingWithdrawals.dollars}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.withdrawButton,
            pressed && styles.withdrawButtonPressed,
            balance?.withdrawableBalance?.cents < 100 && styles.withdrawButtonDisabled,
          ]}
          onPress={() => setShowWithdrawModal(true)}
          disabled={balance?.withdrawableBalance?.cents < 100}
        >
          <Icon name="bank" size={18} color={colors.neutral[0]} />
          <Text style={styles.withdrawButtonText}>Withdraw to Bank</Text>
        </Pressable>

        {balance?.withdrawableBalance?.cents < 100 && (
          <Text style={styles.minAmountText}>
            Minimum withdrawal amount is $1.00
          </Text>
        )}
      </View>

      {/* Year Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>This Year</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              ${balance?.withdrawnThisYear?.totalWithdrawnDollars || "0.00"}
            </Text>
            <Text style={styles.summaryLabel}>Total Withdrawn</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {balance?.withdrawnThisYear?.withdrawalCount || 0}
            </Text>
            <Text style={styles.summaryLabel}>Withdrawals</Text>
          </View>
        </View>
      </View>

      {/* Withdrawal History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdrawal History</Text>

        {withdrawals.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="history" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyStateText}>No withdrawals yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Your withdrawal history will appear here
            </Text>
          </View>
        ) : (
          withdrawals.map((withdrawal) => (
            <View key={withdrawal.id} style={styles.withdrawalItem}>
              <View style={styles.withdrawalLeft}>
                <Icon
                  name={getStatusIcon(withdrawal.status)}
                  size={20}
                  color={getStatusColor(withdrawal.status)}
                />
                <View style={styles.withdrawalInfo}>
                  <Text style={styles.withdrawalAmount}>
                    ${withdrawal.amount.dollars}
                  </Text>
                  <Text style={styles.withdrawalDate}>
                    {formatDate(withdrawal.requestedAt)}
                  </Text>
                  {withdrawal.bankAccountLast4 && (
                    <Text style={styles.withdrawalBank}>
                      ****{withdrawal.bankAccountLast4}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.withdrawalRight}>
                <Text
                  style={[
                    styles.withdrawalStatus,
                    { color: getStatusColor(withdrawal.status) },
                  ]}
                >
                  {withdrawal.status.charAt(0).toUpperCase() +
                    withdrawal.status.slice(1)}
                </Text>
                {withdrawal.estimatedArrival && withdrawal.status === "processing" && (
                  <Text style={styles.withdrawalEta}>
                    ETA: {formatDate(withdrawal.estimatedArrival)}
                  </Text>
                )}
                {withdrawal.failureReason && (
                  <Text style={styles.withdrawalError}>
                    {withdrawal.failureReason}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Withdrawal Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Funds</Text>
              <Pressable
                onPress={() => {
                  setShowWithdrawModal(false);
                  setWithdrawError(null);
                  setWithdrawSuccess(null);
                }}
                style={styles.modalClose}
              >
                <Icon name="times" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            {withdrawSuccess ? (
              <View style={styles.successContainer}>
                <Icon name="check-circle" size={48} color={colors.success[600]} />
                <Text style={styles.successText}>{withdrawSuccess}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalLabel}>
                  Available: ${balance?.withdrawableBalance?.dollars || "0.00"}
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <TextInput
                  style={styles.descriptionInput}
                  value={withdrawDescription}
                  onChangeText={setWithdrawDescription}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.text.tertiary}
                />

                {withdrawError && (
                  <View style={styles.modalError}>
                    <Icon name="exclamation-circle" size={14} color={colors.error[600]} />
                    <Text style={styles.modalErrorText}>{withdrawError}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.modalWithdrawButton,
                    pressed && styles.modalWithdrawButtonPressed,
                    withdrawing && styles.modalWithdrawButtonDisabled,
                  ]}
                  onPress={handleWithdraw}
                  disabled={withdrawing}
                >
                  {withdrawing ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <>
                      <Icon name="bank" size={16} color={colors.neutral[0]} />
                      <Text style={styles.modalWithdrawButtonText}>
                        Withdraw to Bank
                      </Text>
                    </>
                  )}
                </Pressable>

                <Text style={styles.modalNote}>
                  Funds typically arrive in 1-2 business days
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorBannerText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  balanceCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginBottom: spacing.lg,
  },
  balanceDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  balanceDetailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  balanceDetailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  withdrawButtonPressed: {
    backgroundColor: colors.primary[700],
    transform: [{ scale: 0.98 }],
  },
  withdrawButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  withdrawButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  minAmountText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  withdrawalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  withdrawalLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  withdrawalInfo: {
    gap: spacing.xs,
  },
  withdrawalAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  withdrawalDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  withdrawalBank: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  withdrawalRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  withdrawalStatus: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  withdrawalEta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  withdrawalError: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    maxWidth: 150,
    textAlign: "right",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalClose: {
    padding: spacing.sm,
  },
  modalLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  currencyPrefix: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  descriptionInput: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  modalErrorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  modalWithdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  modalWithdrawButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  modalWithdrawButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  modalWithdrawButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  modalNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  successText: {
    fontSize: typography.fontSize.base,
    color: colors.success[700],
    marginTop: spacing.md,
    textAlign: "center",
  },
});

export default PlatformWithdrawals;
