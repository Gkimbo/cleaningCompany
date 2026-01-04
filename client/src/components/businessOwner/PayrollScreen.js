import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Status Colors
const PAYOUT_STATUS = {
  pending: { bg: colors.warning[100], text: colors.warning[700], label: "Pending" },
  processing: { bg: colors.primary[100], text: colors.primary[700], label: "Processing" },
  paid: { bg: colors.success[100], text: colors.success[700], label: "Paid" },
  paid_outside_platform: { bg: colors.secondary[100], text: colors.secondary[700], label: "Paid Outside" },
};

// Payout Item Component
const PayoutItem = ({ payout, selected, onToggle, onMarkPaid }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const status = PAYOUT_STATUS[payout.payoutStatus] || PAYOUT_STATUS.pending;

  return (
    <View style={styles.payoutItem}>
      <Pressable
        style={[styles.payoutCheckbox, selected && styles.payoutCheckboxSelected]}
        onPress={onToggle}
      >
        {selected && <Icon name="check" size={12} color="#fff" />}
      </Pressable>
      <View style={styles.payoutContent}>
        <View style={styles.payoutHeader}>
          <Text style={styles.payoutEmployee}>
            {payout.isSelfAssignment
              ? "Self-Assignment"
              : `${payout.employee?.firstName || ""} ${payout.employee?.lastName || ""}`}
          </Text>
          <View style={[styles.payoutStatusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.payoutStatusText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
        </View>
        <Text style={styles.payoutClient}>
          {payout.appointment?.clientName || "Client"} - {formatDate(payout.appointment?.date)}
        </Text>
        <View style={styles.payoutFooter}>
          <Text style={styles.payoutAmount}>
            ${((payout.payAmount || 0) / 100).toFixed(2)}
          </Text>
          {payout.payoutStatus === "pending" && !payout.isSelfAssignment && (
            <Pressable style={styles.markPaidButton} onPress={onMarkPaid}>
              <Icon name="check-circle" size={14} color={colors.success[600]} />
              <Text style={styles.markPaidText}>Mark Paid</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

// Employee Summary Card
const EmployeeSummaryCard = ({ employee, summary, onViewDetails }) => (
  <Pressable style={styles.employeeSummary} onPress={onViewDetails}>
    <View style={styles.employeeAvatar}>
      <Text style={styles.employeeAvatarText}>
        {(employee.firstName?.[0] || "E").toUpperCase()}
      </Text>
    </View>
    <View style={styles.employeeSummaryInfo}>
      <Text style={styles.employeeSummaryName}>
        {employee.firstName} {employee.lastName}
      </Text>
      <Text style={styles.employeeSummaryJobs}>
        {summary.pendingCount} pending jobs
      </Text>
    </View>
    <View style={styles.employeeSummaryAmount}>
      <Text style={styles.employeeSummaryTotal}>
        ${((summary.pendingAmount || 0) / 100).toFixed(2)}
      </Text>
      <Text style={styles.employeeSummaryLabel}>pending</Text>
    </View>
    <Icon name="chevron-right" size={14} color={colors.neutral[400]} />
  </Pressable>
);

// Mark Paid Modal
const MarkPaidModal = ({ visible, payout, onClose, onConfirm, isSubmitting }) => {
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    onConfirm(note);
    setNote("");
  };

  const handleClose = () => {
    setNote("");
    onClose();
  };

  if (!payout) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Mark as Paid</Text>
            <Pressable onPress={handleClose}>
              <Icon name="times" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.payoutSummary}>
              <Text style={styles.payoutSummaryLabel}>Employee</Text>
              <Text style={styles.payoutSummaryValue}>
                {payout.employee?.firstName} {payout.employee?.lastName}
              </Text>
            </View>
            <View style={styles.payoutSummary}>
              <Text style={styles.payoutSummaryLabel}>Amount</Text>
              <Text style={styles.payoutSummaryValue}>
                ${((payout.payAmount || 0) / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.payoutSummary}>
              <Text style={styles.payoutSummaryLabel}>Job Date</Text>
              <Text style={styles.payoutSummaryValue}>
                {new Date(payout.appointment?.date).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Payment Note (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={note}
                onChangeText={setNote}
                placeholder="e.g., Paid via Venmo, check #1234..."
                multiline
                numberOfLines={3}
              />
              <Text style={styles.helperText}>
                Record how you paid the employee for your records
              </Text>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Payment</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Batch Process Modal
const BatchProcessModal = ({ visible, payouts, onClose, onConfirm, isSubmitting }) => {
  const totalAmount = payouts.reduce((sum, p) => sum + (p.payAmount || 0), 0);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Process Batch Payment</Text>
            <Pressable onPress={onClose}>
              <Icon name="times" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.batchSummary}>
              <View style={styles.batchSummaryRow}>
                <Text style={styles.batchSummaryLabel}>Selected Jobs</Text>
                <Text style={styles.batchSummaryValue}>{payouts.length}</Text>
              </View>
              <View style={styles.batchSummaryRow}>
                <Text style={styles.batchSummaryLabel}>Total Amount</Text>
                <Text style={styles.batchSummaryAmount}>
                  ${(totalAmount / 100).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.batchWarning}>
              <Icon name="info-circle" size={16} color={colors.primary[600]} />
              <Text style={styles.batchWarningText}>
                This will mark all selected jobs as paid. Make sure you've actually
                processed these payments to your employees.
              </Text>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Process All</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
const PayrollScreen = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState([]);
  const [employeeSummaries, setEmployeeSummaries] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Selection state
  const [selectedPayouts, setSelectedPayouts] = useState(new Set());

  // Modal states
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState("pending"); // 'pending' | 'history'

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await BusinessOwnerService.getPendingPayouts(state.currentUser.token);

      // Get all pending payouts
      const pendingPayouts = result.pendingPayouts || [];
      setPayouts(pendingPayouts);

      // Group by employee for summary
      const employeeMap = new Map();
      pendingPayouts.forEach((payout) => {
        if (payout.isSelfAssignment) return;
        const empId = payout.businessEmployeeId;
        if (!employeeMap.has(empId)) {
          employeeMap.set(empId, {
            employee: payout.employee,
            pendingCount: 0,
            pendingAmount: 0,
          });
        }
        const summary = employeeMap.get(empId);
        summary.pendingCount++;
        summary.pendingAmount += payout.payAmount || 0;
      });

      setEmployeeSummaries(Array.from(employeeMap.values()));
    } catch (err) {
      console.error("Error fetching payouts:", err);
      setError("Failed to load payroll data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [state.currentUser.token]);

  const togglePayoutSelection = (payoutId) => {
    setSelectedPayouts((prev) => {
      const next = new Set(prev);
      if (next.has(payoutId)) {
        next.delete(payoutId);
      } else {
        next.add(payoutId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const pendingIds = payouts
      .filter((p) => p.payoutStatus === "pending" && !p.isSelfAssignment)
      .map((p) => p.id);
    setSelectedPayouts(new Set(pendingIds));
  };

  const clearSelection = () => {
    setSelectedPayouts(new Set());
  };

  const handleMarkPaid = async (note) => {
    if (!selectedPayout) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await BusinessOwnerService.markPaidOutsidePlatform(
        state.currentUser.token,
        selectedPayout.id,
        note
      );

      if (result.success) {
        setSuccess("Payment recorded successfully");
        setShowMarkPaidModal(false);
        setSelectedPayout(null);
        fetchData();
      } else {
        setError(result.error || "Failed to record payment");
      }
    } catch (err) {
      setError("Failed to record payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchProcess = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const ids = Array.from(selectedPayouts);
      const result = await BusinessOwnerService.processBatchPayouts(
        state.currentUser.token,
        ids
      );

      if (result.success) {
        setSuccess(`${ids.length} payments processed successfully`);
        setShowBatchModal(false);
        setSelectedPayouts(new Set());
        fetchData();
      } else {
        setError(result.error || "Failed to process payments");
      }
    } catch (err) {
      setError("Failed to process payments. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const pendingPayouts = payouts.filter((p) => p.payoutStatus === "pending");
  const totalPending = pendingPayouts.reduce((sum, p) => sum + (p.payAmount || 0), 0);
  const selectedPayoutsList = payouts.filter((p) => selectedPayouts.has(p.id));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading payroll...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Payroll</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>Pending Payroll</Text>
          <Text style={styles.summaryAmount}>${(totalPending / 100).toFixed(2)}</Text>
          <Text style={styles.summarySubtext}>
            {pendingPayouts.length} jobs to pay
          </Text>
        </View>
        {selectedPayouts.size > 0 && (
          <Pressable
            style={styles.processButton}
            onPress={() => setShowBatchModal(true)}
          >
            <Icon name="credit-card" size={16} color="#fff" />
            <Text style={styles.processButtonText}>
              Process {selectedPayouts.size} Selected
            </Text>
          </Pressable>
        )}
      </View>

      {/* Selection Actions */}
      {pendingPayouts.length > 0 && (
        <View style={styles.selectionBar}>
          <Pressable onPress={selectAll}>
            <Text style={styles.selectionLink}>Select All</Text>
          </Pressable>
          {selectedPayouts.size > 0 && (
            <Pressable onPress={clearSelection}>
              <Text style={styles.selectionLink}>Clear</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Messages */}
        {error && (
          <View style={styles.errorMessage}>
            <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
            <Text style={styles.errorMessageText}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={styles.successMessage}>
            <Icon name="check-circle" size={16} color={colors.success[600]} />
            <Text style={styles.successMessageText}>{success}</Text>
          </View>
        )}

        {/* Employee Summaries */}
        {employeeSummaries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>By Employee</Text>
            <View style={styles.employeeSummaries}>
              {employeeSummaries.map((item) => (
                <EmployeeSummaryCard
                  key={item.employee.id}
                  employee={item.employee}
                  summary={item}
                  onViewDetails={() =>
                    navigate(`/business-owner/employees/${item.employee.id}`)
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Pending Payouts List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Payments</Text>
          {pendingPayouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check-circle" size={48} color={colors.success[300]} />
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptyText}>No pending payroll at the moment.</Text>
            </View>
          ) : (
            <View style={styles.payoutList}>
              {pendingPayouts.map((payout) => (
                <PayoutItem
                  key={payout.id}
                  payout={payout}
                  selected={selectedPayouts.has(payout.id)}
                  onToggle={() => togglePayoutSelection(payout.id)}
                  onMarkPaid={() => {
                    setSelectedPayout(payout);
                    setShowMarkPaidModal(true);
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="info-circle" size={20} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            Mark payments as "Paid" after you've actually transferred funds to your
            employees. This helps you track payroll without automatically processing payments.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Modals */}
      <MarkPaidModal
        visible={showMarkPaidModal}
        payout={selectedPayout}
        onClose={() => {
          setShowMarkPaidModal(false);
          setSelectedPayout(null);
        }}
        onConfirm={handleMarkPaid}
        isSubmitting={isSubmitting}
      />

      <BatchProcessModal
        visible={showBatchModal}
        payouts={selectedPayoutsList}
        onClose={() => setShowBatchModal(false)}
        onConfirm={handleBatchProcess}
        isSubmitting={isSubmitting}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  summaryCard: {
    backgroundColor: colors.primary[600],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  summaryMain: {
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[100],
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  summarySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[200],
    marginTop: spacing.xs,
  },
  processButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  processButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  selectionLink: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  employeeSummaries: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },
  employeeSummary: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  employeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  employeeSummaryInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeSummaryName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  employeeSummaryJobs: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeeSummaryAmount: {
    alignItems: "flex-end",
    marginRight: spacing.md,
  },
  employeeSummaryTotal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[600],
  },
  employeeSummaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  payoutList: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },
  payoutItem: {
    flexDirection: "row",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  payoutCheckbox: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border.default,
    marginRight: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  payoutCheckboxSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  payoutContent: {
    flex: 1,
  },
  payoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  payoutEmployee: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  payoutStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  payoutStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  payoutClient: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  payoutFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  payoutAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  markPaidButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  markPaidText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error[600],
  },
  errorMessageText: {
    marginLeft: spacing.sm,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  successMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success[600],
  },
  successMessageText: {
    marginLeft: spacing.sm,
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  payoutSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  payoutSummaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  payoutSummaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  formGroup: {
    marginTop: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  batchSummary: {
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  batchSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  batchSummaryLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  batchSummaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  batchSummaryAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  batchWarning: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  batchWarningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  confirmButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    minWidth: 120,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: colors.primary[300],
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
});

export default PayrollScreen;
