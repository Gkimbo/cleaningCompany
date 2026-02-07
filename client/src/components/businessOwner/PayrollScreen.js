import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate, useLocation } from "react-router-native";
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
  pending: { bg: colors.warning[100], text: colors.warning[700], label: "Pending", icon: "clock-o" },
  processing: { bg: colors.primary[100], text: colors.primary[700], label: "Processing", icon: "refresh" },
  paid: { bg: colors.success[100], text: colors.success[700], label: "Paid", icon: "check" },
  paid_outside_platform: { bg: colors.secondary[100], text: colors.secondary[700], label: "Paid Outside", icon: "check" },
};

// Pay Type Labels
const PAY_TYPE_LABELS = {
  hourly: { label: "Hourly", icon: "clock-o", color: colors.primary[600] },
  per_job: { label: "Per Job", icon: "briefcase", color: colors.secondary[600] },
  percentage: { label: "Percentage", icon: "percent", color: colors.success[600] },
};

// Quick Action Button
const QuickAction = ({ icon, label, onPress, color = colors.primary[600] }) => (
  <Pressable style={styles.quickAction} onPress={onPress}>
    <View style={[styles.quickActionIcon, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={16} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </Pressable>
);

// Tab Button
const TabButton = ({ label, active, count, onPress }) => (
  <Pressable
    style={[styles.tabButton, active && styles.tabButtonActive]}
    onPress={onPress}
  >
    <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
      {label}
    </Text>
    {count > 0 && (
      <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
        <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
          {count}
        </Text>
      </View>
    )}
  </Pressable>
);

// Filter Chip
const FilterChip = ({ label, active, onPress, onClear }) => (
  <Pressable
    style={[styles.filterChip, active && styles.filterChipActive]}
    onPress={onPress}
  >
    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
      {label}
    </Text>
    {active && onClear && (
      <Pressable onPress={onClear} hitSlop={8}>
        <Icon name="times" size={12} color={colors.primary[600]} />
      </Pressable>
    )}
  </Pressable>
);

// Payout Item Component
const PayoutItem = ({ payout, selected, onToggle, onMarkPaid, onEditHours, highlighted }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const status = PAYOUT_STATUS[payout.payoutStatus] || PAYOUT_STATUS.pending;
  const payType = PAY_TYPE_LABELS[payout.payType] || PAY_TYPE_LABELS.per_job;
  const isHourly = payout.payType === "hourly";
  const hourlyRate = payout.employee?.hourlyRate;
  const isPending = payout.payoutStatus === "pending";

  return (
    <View style={[styles.payoutItem, highlighted && styles.payoutItemHighlighted]}>
      {isPending && !payout.isSelfAssignment && (
        <Pressable
          style={[styles.payoutCheckbox, selected && styles.payoutCheckboxSelected]}
          onPress={onToggle}
        >
          {selected && <Icon name="check" size={12} color="#fff" />}
        </Pressable>
      )}
      <View style={[styles.payoutContent, (!isPending || payout.isSelfAssignment) && styles.payoutContentFull]}>
        <View style={styles.payoutHeader}>
          <View style={styles.payoutHeaderLeft}>
            <View style={styles.payoutAvatar}>
              <Text style={styles.payoutAvatarText}>
                {payout.isSelfAssignment
                  ? "S"
                  : (payout.employee?.firstName?.[0] || "E").toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.payoutEmployee}>
                {payout.isSelfAssignment
                  ? "Self-Assignment"
                  : `${payout.employee?.firstName || ""} ${payout.employee?.lastName || ""}`}
              </Text>
              <View style={styles.payoutMeta}>
                <View style={[styles.payTypeBadge, { backgroundColor: payType.color + "15" }]}>
                  <Icon name={payType.icon} size={10} color={payType.color} />
                  <Text style={[styles.payTypeBadgeText, { color: payType.color }]}>
                    {payType.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={[styles.payoutStatusBadge, { backgroundColor: status.bg }]}>
            <Icon name={status.icon} size={10} color={status.text} />
            <Text style={[styles.payoutStatusText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.payoutDetails}>
          <View style={styles.payoutDetailRow}>
            <Icon name="home" size={12} color={colors.text.tertiary} />
            <Text style={styles.payoutDetailText} numberOfLines={1}>
              {payout.appointment?.home?.address || "Address pending"}
            </Text>
          </View>
          <View style={styles.payoutDetailRow}>
            <Icon name="calendar" size={12} color={colors.text.tertiary} />
            <Text style={styles.payoutDetailText}>
              {formatDate(payout.appointment?.date)}
            </Text>
          </View>
        </View>

        {/* Hours section for hourly employees */}
        {isHourly && (
          <View style={styles.hoursRow}>
            <View style={styles.hoursInfo}>
              <Icon name="clock-o" size={14} color={colors.primary[500]} />
              <Text style={styles.hoursText}>
                {payout.hoursWorked ? `${payout.hoursWorked} hrs` : "No hours recorded"}
                {hourlyRate ? ` @ $${(hourlyRate / 100).toFixed(2)}/hr` : ""}
              </Text>
            </View>
            {isPending && (
              <Pressable style={styles.editHoursButton} onPress={() => onEditHours(payout)}>
                <Icon name="pencil" size={12} color={colors.primary[600]} />
                <Text style={styles.editHoursText}>Edit</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.payoutFooter}>
          <View style={styles.payoutAmountContainer}>
            <Text style={styles.payoutAmountLabel}>Pay Amount</Text>
            <Text style={styles.payoutAmount}>
              ${((payout.payAmount || 0) / 100).toFixed(2)}
            </Text>
          </View>
          {isPending && !payout.isSelfAssignment && (
            <Pressable style={styles.markPaidButton} onPress={onMarkPaid}>
              <Icon name="check-circle" size={16} color="#fff" />
              <Text style={styles.markPaidText}>Mark Paid</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

// Employee Summary Card
const EmployeeSummaryCard = ({ employee, summary, onViewDetails, onViewHours }) => {
  const payType = PAY_TYPE_LABELS[employee.payType] || PAY_TYPE_LABELS.per_job;

  return (
    <View style={styles.employeeSummary}>
      <Pressable style={styles.employeeSummaryMain} onPress={onViewDetails}>
        <View style={styles.employeeAvatar}>
          <Text style={styles.employeeAvatarText}>
            {(employee.firstName?.[0] || "E").toUpperCase()}
          </Text>
        </View>
        <View style={styles.employeeSummaryInfo}>
          <Text style={styles.employeeSummaryName}>
            {employee.firstName} {employee.lastName}
          </Text>
          <View style={styles.employeeSummaryMeta}>
            <View style={[styles.payTypeBadgeSmall, { backgroundColor: payType.color + "15" }]}>
              <Text style={[styles.payTypeBadgeTextSmall, { color: payType.color }]}>
                {payType.label}
              </Text>
            </View>
            <Text style={styles.employeeSummaryJobs}>
              {summary.pendingCount} pending
            </Text>
          </View>
        </View>
        <View style={styles.employeeSummaryAmount}>
          <Text style={styles.employeeSummaryTotal}>
            ${((summary.pendingAmount || 0) / 100).toFixed(2)}
          </Text>
          <Text style={styles.employeeSummaryLabel}>owed</Text>
        </View>
      </Pressable>
      {employee.payType === "hourly" && (
        <Pressable style={styles.viewHoursButton} onPress={onViewHours}>
          <Icon name="clock-o" size={12} color={colors.primary[600]} />
          <Text style={styles.viewHoursText}>View Hours</Text>
        </Pressable>
      )}
    </View>
  );
};

// Stat Card
const StatCard = ({ icon, label, value, color = colors.primary[600] }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
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
            <View style={styles.modalHeaderIcon}>
              <Icon name="check-circle" size={24} color={colors.success[600]} />
            </View>
            <Text style={styles.modalTitle}>Mark as Paid</Text>
            <Pressable style={styles.modalCloseButton} onPress={handleClose}>
              <Icon name="times" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.modalSummaryCard}>
              <View style={styles.modalSummaryRow}>
                <Text style={styles.modalSummaryLabel}>Employee</Text>
                <Text style={styles.modalSummaryValue}>
                  {payout.employee?.firstName} {payout.employee?.lastName}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={styles.modalSummaryLabel}>Amount</Text>
                <Text style={styles.modalSummaryAmount}>
                  ${((payout.payAmount || 0) / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={styles.modalSummaryLabel}>Job Date</Text>
                <Text style={styles.modalSummaryValue}>
                  {new Date(payout.appointment?.date).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Payment Note (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={note}
                onChangeText={setNote}
                placeholder="e.g., Paid via Venmo, check #1234..."
                placeholderTextColor={colors.text.tertiary}
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
                <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                </>
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
  const employeeCount = new Set(payouts.map(p => p.businessEmployeeId)).size;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalHeaderIcon, { backgroundColor: colors.primary[100] }]}>
              <Icon name="credit-card" size={24} color={colors.primary[600]} />
            </View>
            <Text style={styles.modalTitle}>Process Batch Payment</Text>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Icon name="times" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.batchStatsRow}>
              <View style={styles.batchStat}>
                <Text style={styles.batchStatValue}>{payouts.length}</Text>
                <Text style={styles.batchStatLabel}>Jobs</Text>
              </View>
              <View style={styles.batchStatDivider} />
              <View style={styles.batchStat}>
                <Text style={styles.batchStatValue}>{employeeCount}</Text>
                <Text style={styles.batchStatLabel}>Employees</Text>
              </View>
              <View style={styles.batchStatDivider} />
              <View style={styles.batchStat}>
                <Text style={[styles.batchStatValue, styles.batchStatAmount]}>
                  ${(totalAmount / 100).toFixed(2)}
                </Text>
                <Text style={styles.batchStatLabel}>Total</Text>
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
                <>
                  <Icon name="check-circle" size={14} color="#fff" />
                  <Text style={styles.confirmButtonText}>Process All</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Edit Hours Modal
const EditHoursModal = ({ visible, payout, onClose, onSave, isSubmitting }) => {
  const [hours, setHours] = useState("");

  useEffect(() => {
    if (payout?.hoursWorked) {
      setHours(String(payout.hoursWorked));
    } else {
      setHours("");
    }
  }, [payout]);

  const handleSave = () => {
    const hoursValue = parseFloat(hours);
    if (isNaN(hoursValue) || hoursValue <= 0) {
      Alert.alert("Invalid Hours", "Please enter a valid number of hours.");
      return;
    }
    onSave(hoursValue);
  };

  const handleClose = () => {
    setHours("");
    onClose();
  };

  const roundUpHours = () => {
    const hoursValue = parseFloat(hours);
    if (!isNaN(hoursValue) && hoursValue > 0) {
      const rounded = Math.ceil(hoursValue * 2) / 2;
      setHours(String(Math.max(0.5, rounded)));
    }
  };

  if (!payout) return null;

  const hourlyRate = payout.employee?.hourlyRate;
  const calculatedPay = parseFloat(hours) * (hourlyRate || 0) / 100;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalHeaderIcon, { backgroundColor: colors.primary[100] }]}>
              <Icon name="clock-o" size={24} color={colors.primary[600]} />
            </View>
            <Text style={styles.modalTitle}>Edit Hours</Text>
            <Pressable style={styles.modalCloseButton} onPress={handleClose}>
              <Icon name="times" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.modalSummaryCard}>
              <View style={styles.modalSummaryRow}>
                <Text style={styles.modalSummaryLabel}>Employee</Text>
                <Text style={styles.modalSummaryValue}>
                  {payout.employee?.firstName} {payout.employee?.lastName}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={styles.modalSummaryLabel}>Job Date</Text>
                <Text style={styles.modalSummaryValue}>
                  {new Date(payout.appointment?.date).toLocaleDateString()}
                </Text>
              </View>
              {hourlyRate && (
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Hourly Rate</Text>
                  <Text style={styles.modalSummaryValue}>
                    ${(hourlyRate / 100).toFixed(2)}/hr
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Hours Worked</Text>
              <View style={styles.hoursInputRow}>
                <TextInput
                  style={[styles.input, styles.hoursInput]}
                  value={hours}
                  onChangeText={setHours}
                  placeholder="e.g., 2.5"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                  onBlur={roundUpHours}
                />
                <Pressable style={styles.roundButton} onPress={roundUpHours}>
                  <Icon name="arrow-up" size={12} color={colors.primary[600]} />
                  <Text style={styles.roundButtonText}>Round Up</Text>
                </Pressable>
              </View>
              <Text style={styles.helperText}>
                Hours are rounded up to the nearest half hour (0.5)
              </Text>
            </View>

            {hourlyRate && hours && !isNaN(parseFloat(hours)) && (
              <View style={styles.calculatedPayBox}>
                <View>
                  <Text style={styles.calculatedPayLabel}>Calculated Pay</Text>
                  <Text style={styles.calculatedPayFormula}>
                    {hours} hrs × ${(hourlyRate / 100).toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.calculatedPayAmount}>
                  ${calculatedPay.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={14} color="#fff" />
                  <Text style={styles.confirmButtonText}>Save Hours</Text>
                </>
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
  const location = useLocation();
  const scrollViewRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState([]);
  const [paidPayouts, setPaidPayouts] = useState([]);
  const [employeeSummaries, setEmployeeSummaries] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Selection state
  const [selectedPayouts, setSelectedPayouts] = useState(new Set());

  // Modal states
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditHoursModal, setShowEditHoursModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [editingPayout, setEditingPayout] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View mode and filters
  const [viewMode, setViewMode] = useState("pending");
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Parse query params for highlight
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlight = params.get("highlight");
    if (highlight) {
      setHighlightedId(parseInt(highlight));
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => setHighlightedId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.search]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [pendingResult, paidResult] = await Promise.all([
        BusinessOwnerService.getPendingPayouts(state.currentUser.token),
        BusinessOwnerService.getPayrollHistory(state.currentUser.token),
      ]);

      const pendingPayouts = pendingResult.pendingPayouts || [];
      setPayouts(pendingPayouts);
      setPaidPayouts(paidResult.payouts || []);

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
    const pendingIds = filteredPayouts
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

  const handleEditHours = (payout) => {
    setEditingPayout(payout);
    setShowEditHoursModal(true);
  };

  const handleSaveHours = async (hoursWorked) => {
    if (!editingPayout) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await BusinessOwnerService.updateHoursWorked(
        state.currentUser.token,
        editingPayout.id,
        hoursWorked
      );

      if (result.success) {
        setSuccess("Hours updated successfully");
        setShowEditHoursModal(false);
        setEditingPayout(null);
        fetchData();
      } else {
        setError(result.error || "Failed to update hours");
      }
    } catch (err) {
      setError("Failed to update hours. Please try again.");
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

  // Filtered payouts based on employee filter
  const filteredPayouts = employeeFilter
    ? payouts.filter((p) => p.businessEmployeeId === employeeFilter)
    : payouts;

  const pendingPayouts = filteredPayouts.filter((p) => p.payoutStatus === "pending");
  const totalPending = payouts.filter(p => p.payoutStatus === "pending").reduce((sum, p) => sum + (p.payAmount || 0), 0);
  const selectedPayoutsList = payouts.filter((p) => selectedPayouts.has(p.id));
  const selectedTotal = selectedPayoutsList.reduce((sum, p) => sum + (p.payAmount || 0), 0);

  // Get unique employees for filter
  const uniqueEmployees = Array.from(
    new Map(payouts.filter(p => !p.isSelfAssignment).map((p) => [p.businessEmployeeId, p.employee])).values()
  );

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
        <Pressable
          style={styles.headerAction}
          onPress={() => navigate("/business-owner/timesheet")}
        >
          <Icon name="clock-o" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryLabel}>Pending Payroll</Text>
            <Text style={styles.summaryAmount}>${(totalPending / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{pendingPayouts.length}</Text>
              <Text style={styles.summaryStatLabel}>Jobs</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{employeeSummaries.length}</Text>
              <Text style={styles.summaryStatLabel}>Employees</Text>
            </View>
          </View>
        </View>

        {selectedPayouts.size > 0 && (
          <View style={styles.selectionSummary}>
            <Text style={styles.selectionSummaryText}>
              {selectedPayouts.size} selected • ${(selectedTotal / 100).toFixed(2)}
            </Text>
            <Pressable
              style={styles.processButton}
              onPress={() => setShowBatchModal(true)}
            >
              <Icon name="credit-card" size={14} color="#fff" />
              <Text style={styles.processButtonText}>Process Selected</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsRow}>
        <QuickAction
          icon="clock-o"
          label="Timesheet"
          onPress={() => navigate("/business-owner/timesheet")}
        />
        <QuickAction
          icon="users"
          label="Employees"
          onPress={() => navigate("/business-owner/employees")}
          color={colors.secondary[600]}
        />
        <QuickAction
          icon="bar-chart"
          label="Financials"
          onPress={() => navigate("/business-owner/financials")}
          color={colors.success[600]}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TabButton
          label="Pending"
          active={viewMode === "pending"}
          count={pendingPayouts.length}
          onPress={() => setViewMode("pending")}
        />
        <TabButton
          label="History"
          active={viewMode === "history"}
          count={0}
          onPress={() => setViewMode("history")}
        />
      </View>

      {/* Filters */}
      {viewMode === "pending" && uniqueEmployees.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          <FilterChip
            label="All Employees"
            active={!employeeFilter}
            onPress={() => setEmployeeFilter(null)}
          />
          {uniqueEmployees.map((emp) => (
            <FilterChip
              key={emp.id}
              label={`${emp.firstName} ${emp.lastName?.[0] || ""}.`}
              active={employeeFilter === emp.id}
              onPress={() => setEmployeeFilter(emp.id)}
              onClear={employeeFilter === emp.id ? () => setEmployeeFilter(null) : null}
            />
          ))}
        </ScrollView>
      )}

      {/* Selection Actions */}
      {viewMode === "pending" && pendingPayouts.length > 0 && (
        <View style={styles.selectionBar}>
          <Pressable onPress={selectAll} style={styles.selectionAction}>
            <Icon name="check-square-o" size={14} color={colors.primary[600]} />
            <Text style={styles.selectionLink}>Select All</Text>
          </Pressable>
          {selectedPayouts.size > 0 && (
            <Pressable onPress={clearSelection} style={styles.selectionAction}>
              <Icon name="times" size={14} color={colors.text.secondary} />
              <Text style={[styles.selectionLink, { color: colors.text.secondary }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
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

        {viewMode === "pending" ? (
          <>
            {/* Employee Summaries */}
            {employeeSummaries.length > 0 && !employeeFilter && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>By Employee</Text>
                  <Text style={styles.sectionSubtitle}>
                    {employeeSummaries.length} employee{employeeSummaries.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.employeeSummaries}>
                  {employeeSummaries.map((item) => (
                    <EmployeeSummaryCard
                      key={item.employee.id}
                      employee={item.employee}
                      summary={item}
                      onViewDetails={() => setEmployeeFilter(item.employee.id)}
                      onViewHours={() =>
                        navigate(`/business-owner/employees/${item.employee.id}/hours`)
                      }
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Pending Payouts List */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {employeeFilter ? "Pending Payments" : "All Pending Payments"}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {pendingPayouts.length} job{pendingPayouts.length !== 1 ? "s" : ""}
                </Text>
              </View>
              {pendingPayouts.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyStateIcon}>
                    <Icon name="check-circle" size={48} color={colors.success[400]} />
                  </View>
                  <Text style={styles.emptyTitle}>All Caught Up!</Text>
                  <Text style={styles.emptyText}>
                    {employeeFilter
                      ? "No pending payments for this employee."
                      : "No pending payroll at the moment."}
                  </Text>
                  {employeeFilter && (
                    <Pressable
                      style={styles.emptyStateButton}
                      onPress={() => setEmployeeFilter(null)}
                    >
                      <Text style={styles.emptyStateButtonText}>View All Employees</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={styles.payoutList}>
                  {pendingPayouts.map((payout) => (
                    <PayoutItem
                      key={payout.id}
                      payout={payout}
                      selected={selectedPayouts.has(payout.id)}
                      highlighted={payout.id === highlightedId}
                      onToggle={() => togglePayoutSelection(payout.id)}
                      onMarkPaid={() => {
                        setSelectedPayout(payout);
                        setShowMarkPaidModal(true);
                      }}
                      onEditHours={() => handleEditHours(payout)}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          // History View
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payment History</Text>
              <Text style={styles.sectionSubtitle}>Last 30 days</Text>
            </View>
            {paidPayouts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Icon name="history" size={48} color={colors.neutral[300]} />
                </View>
                <Text style={styles.emptyTitle}>No Payment History</Text>
                <Text style={styles.emptyText}>
                  Payments you process will appear here.
                </Text>
              </View>
            ) : (
              <View style={styles.payoutList}>
                {paidPayouts.map((payout) => (
                  <PayoutItem
                    key={payout.id}
                    payout={payout}
                    selected={false}
                    onToggle={() => {}}
                    onMarkPaid={() => {}}
                    onEditHours={() => {}}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Info Card */}
        {viewMode === "pending" && pendingPayouts.length > 0 && (
          <View style={styles.infoCard}>
            <Icon name="info-circle" size={18} color={colors.primary[600]} />
            <View style={styles.infoCardContent}>
              <Text style={styles.infoCardTitle}>How Payroll Works</Text>
              <Text style={styles.infoCardText}>
                Mark payments as "Paid" after you've transferred funds to your employees.
                This helps you track payroll without automatically processing payments.
              </Text>
            </View>
          </View>
        )}

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

      <EditHoursModal
        visible={showEditHoursModal}
        payout={editingPayout}
        onClose={() => {
          setShowEditHoursModal(false);
          setEditingPayout(null);
        }}
        onSave={handleSaveHours}
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
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  summaryCard: {
    backgroundColor: colors.primary[600],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[200],
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  summaryStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  summaryStat: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  summaryStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  summaryStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[200],
    marginTop: 2,
  },
  summaryStatDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 4,
  },
  selectionSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  selectionSummaryText: {
    color: colors.primary[100],
    fontSize: typography.fontSize.sm,
  },
  processButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  processButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  quickActionsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.background.primary,
    ...shadows.sm,
  },
  tabButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  tabButtonTextActive: {
    color: colors.primary[600],
  },
  tabBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  tabBadgeActive: {
    backgroundColor: colors.primary[100],
  },
  tabBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },
  tabBadgeTextActive: {
    color: colors.primary[600],
  },
  filtersContainer: {
    maxHeight: 50,
  },
  filtersContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  selectionBar: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  selectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  employeeSummaries: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },
  employeeSummary: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  employeeSummaryMain: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.lg,
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
  employeeSummaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  payTypeBadgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  payTypeBadgeTextSmall: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  employeeSummaryJobs: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  employeeSummaryAmount: {
    alignItems: "flex-end",
    marginRight: spacing.sm,
  },
  employeeSummaryTotal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[600],
  },
  employeeSummaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  viewHoursButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[50],
    gap: spacing.xs,
  },
  viewHoursText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
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
  payoutItemHighlighted: {
    backgroundColor: colors.primary[50],
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
    marginTop: spacing.xs,
  },
  payoutCheckboxSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  payoutContent: {
    flex: 1,
  },
  payoutContentFull: {
    marginLeft: 0,
  },
  payoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  payoutHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  payoutAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  payoutAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  payoutEmployee: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  payoutMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  payTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  payTypeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  payoutStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  payoutStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  payoutDetails: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  payoutDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  payoutDetailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },
  hoursInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  hoursText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  editHoursButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
  },
  editHoursText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  payoutFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payoutAmountContainer: {},
  payoutAmountLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  payoutAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  markPaidButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  markPaidText: {
    fontSize: typography.fontSize.sm,
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.success[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyStateButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
  },
  emptyStateButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  errorMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error[500],
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
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success[500],
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
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
    marginBottom: spacing.xs,
  },
  infoCardText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
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
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.md,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalSummaryCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  modalSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  modalSummaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  modalSummaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  modalSummaryAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  formGroup: {
    marginTop: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
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
  hoursInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  hoursInput: {
    flex: 1,
  },
  roundButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  roundButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  calculatedPayBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calculatedPayLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  calculatedPayFormula: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: 2,
  },
  calculatedPayAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  batchStatsRow: {
    flexDirection: "row",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  batchStat: {
    flex: 1,
    alignItems: "center",
  },
  batchStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  batchStatAmount: {
    color: colors.primary[600],
  },
  batchStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  batchStatDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    minWidth: 140,
    justifyContent: "center",
    gap: spacing.sm,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.primary[300],
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  statCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.sm,
    minWidth: 100,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});

export default PayrollScreen;
