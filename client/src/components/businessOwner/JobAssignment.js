import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
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
import { usePricing } from "../../context/PricingContext";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Assignment Status Colors
const STATUS_COLORS = {
  assigned: { bg: colors.primary[100], text: colors.primary[700] },
  started: { bg: colors.warning[100], text: colors.warning[700] },
  completed: { bg: colors.success[100], text: colors.success[700] },
  cancelled: { bg: colors.neutral[200], text: colors.neutral[600] },
  no_show: { bg: colors.error[100], text: colors.error[700] },
};

// Unassigned Job Card
const UnassignedJobCard = ({ job, onAssign }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  return (
    <View style={styles.jobCard}>
      <View style={styles.jobCardHeader}>
        <View style={styles.jobDateBadge}>
          <Text style={styles.jobDateDay}>{new Date(job.date + "T00:00:00").getDate()}</Text>
          <Text style={styles.jobDateMonth}>
            {new Date(job.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
          </Text>
        </View>
        <View style={styles.jobInfo}>
          <Text style={styles.jobClient}>{job.clientName || "Client"}</Text>
          <Text style={styles.jobAddress}>{job.address || "No address"}</Text>
          <Text style={styles.jobTime}>
            {formatTime(job.startTime)} - {job.duration || "2"} hours
          </Text>
        </View>
        <View style={styles.jobPrice}>
          <Text style={styles.jobPriceAmount}>
            ${((job.totalPrice || 0) / 100).toFixed(0)}
          </Text>
        </View>
      </View>
      <View style={styles.jobCardActions}>
        <Pressable
          style={styles.assignButton}
          onPress={() => onAssign(job)}
        >
          <Icon name="user-plus" size={14} color={colors.primary[600]} />
          <Text style={styles.assignButtonText}>Assign Employee</Text>
        </Pressable>
        <Pressable
          style={styles.selfAssignButton}
          onPress={() => onAssign(job, true)}
        >
          <Icon name="user" size={14} color={colors.secondary[600]} />
          <Text style={styles.selfAssignButtonText}>Clean Myself</Text>
        </Pressable>
      </View>
    </View>
  );
};

// Assigned Job Card
const AssignedJobCard = ({ assignment, onReassign, onUnassign, onViewDetails, platformFeePercent }) => {
  const statusColors = STATUS_COLORS[assignment.status] || STATUS_COLORS.assigned;

  // Calculate financials
  const jobPrice = assignment.appointment?.price || assignment.appointment?.totalPrice || 0;
  const employeePay = assignment.payAmount || 0;
  const platformFee = Math.round(jobPrice * (platformFeePercent / 100));
  const profit = jobPrice - platformFee - employeePay;

  return (
    <Pressable style={styles.jobCard} onPress={onViewDetails}>
      <View style={styles.jobCardHeader}>
        <View style={styles.jobDateBadge}>
          <Text style={styles.jobDateDay}>
            {new Date(assignment.appointment?.date + "T00:00:00").getDate()}
          </Text>
          <Text style={styles.jobDateMonth}>
            {new Date(assignment.appointment?.date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
            })}
          </Text>
        </View>
        <View style={styles.jobInfo}>
          <Text style={styles.jobClient}>
            {assignment.appointment?.clientName || "Client"}
          </Text>
          <Text style={styles.jobAssignee}>
            {assignment.isSelfAssignment
              ? "You (Self-assigned)"
              : `${assignment.employee?.firstName || ""} ${assignment.employee?.lastName || ""}`}
          </Text>
          <View style={styles.financialInfo}>
            <Text style={styles.jobPriceLabel}>
              Job: ${(jobPrice / 100).toFixed(0)}
            </Text>
            <Text style={styles.feeLabel}>
              Fee: ${(platformFee / 100).toFixed(0)}
            </Text>
            {!assignment.isSelfAssignment && (
              <Text style={styles.employeePayLabel}>
                Pay: ${(employeePay / 100).toFixed(0)}
              </Text>
            )}
            <Text style={[styles.profitLabel, profit < 0 && styles.profitNegative]}>
              You: ${(profit / 100).toFixed(0)}
            </Text>
          </View>
        </View>
        <View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {assignment.status}
            </Text>
          </View>
        </View>
      </View>
      {assignment.status === "assigned" && !assignment.isSelfAssignment && (
        <View style={styles.jobCardActions}>
          <Pressable
            style={styles.reassignButton}
            onPress={onReassign}
          >
            <Icon name="exchange" size={14} color={colors.primary[600]} />
            <Text style={styles.reassignButtonText}>Reassign</Text>
          </Pressable>
          <Pressable
            style={styles.unassignButton}
            onPress={onUnassign}
          >
            <Icon name="times" size={14} color={colors.error[600]} />
            <Text style={styles.unassignButtonText}>Unassign</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
};

// Assign Modal
const AssignModal = ({
  visible,
  job,
  employees,
  onClose,
  onSubmit,
  isSubmitting,
  isSelfAssign,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState("flat_rate");
  const [showFinancials, setShowFinancials] = useState(false);
  const [isUsingDefaultPay, setIsUsingDefaultPay] = useState(false);
  const { pricing } = usePricing();

  // Get platform fee from config (default 10%)
  const platformFeePercent = (pricing?.platform?.businessOwnerFeePercent || 0.10) * 100;

  // Calculate default pay based on employee's pay type
  const calculateDefaultPay = (employee, jobPrice) => {
    if (!employee) return null;

    const empPayType = employee.payType || "per_job";

    switch (empPayType) {
      case "hourly":
        // For hourly, show estimated pay (will be calculated at completion)
        // Use 2 hours as default estimate
        const hourlyRate = employee.defaultHourlyRate || 0;
        return {
          amount: hourlyRate * 2, // 2 hour estimate
          payType: "hourly",
          note: `$${(hourlyRate / 100).toFixed(2)}/hr (2hr estimate)`,
        };
      case "per_job":
      case "flat_rate":
        const jobRate = employee.defaultJobRate || 0;
        return {
          amount: jobRate,
          payType: "flat_rate",
          note: jobRate > 0 ? `Default: $${(jobRate / 100).toFixed(2)}/job` : null,
        };
      case "percentage":
        const percentage = parseFloat(employee.payRate) || 0;
        const calculatedPay = Math.round((percentage / 100) * (jobPrice || 0));
        return {
          amount: calculatedPay,
          payType: "percentage",
          note: `${percentage}% of job price`,
        };
      default:
        return null;
    }
  };

  // Set initial pay amount when modal opens (use suggestion if no employee selected yet)
  useEffect(() => {
    if (job && visible && !selectedEmployee) {
      const suggestions = BusinessOwnerService.suggestPayAmounts(job.totalPrice || 0);
      setPayAmount((suggestions.margin35.payAmount / 100).toFixed(2));
      setIsUsingDefaultPay(false);
    }
  }, [job, visible]);

  // Update pay when employee is selected
  useEffect(() => {
    if (selectedEmployee && job) {
      const defaultPay = calculateDefaultPay(selectedEmployee, job.totalPrice);
      if (defaultPay && defaultPay.amount > 0) {
        setPayAmount((defaultPay.amount / 100).toFixed(2));
        setPayType(defaultPay.payType);
        setIsUsingDefaultPay(true);
      } else {
        // Fallback to suggested pay if no default set
        const suggestions = BusinessOwnerService.suggestPayAmounts(job.totalPrice || 0);
        setPayAmount((suggestions.margin35.payAmount / 100).toFixed(2));
        setPayType("flat_rate");
        setIsUsingDefaultPay(false);
      }
    }
  }, [selectedEmployee, job]);

  const handleSubmit = () => {
    if (!isSelfAssign && !selectedEmployee) return;
    onSubmit({
      appointmentId: job.id,
      employeeId: isSelfAssign ? null : selectedEmployee.id,
      payAmount: Math.round(parseFloat(payAmount) * 100),
      payType,
      isSelfAssign,
    });
  };

  const handleClose = () => {
    setSelectedEmployee(null);
    setPayAmount("");
    setPayType("flat_rate");
    setShowFinancials(false);
    onClose();
  };

  const financials = job
    ? BusinessOwnerService.calculateJobFinancials(
        job.totalPrice || 0,
        Math.round(parseFloat(payAmount || 0) * 100),
        platformFeePercent
      )
    : null;

  if (!job) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isSelfAssign ? "Self-Assign Job" : "Assign Employee"}
            </Text>
            <Pressable onPress={handleClose}>
              <Icon name="times" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Job Details */}
            <View style={styles.jobSummary}>
              <Text style={styles.jobSummaryTitle}>
                {job.clientName || "Client"} - {job.address || "No address"}
              </Text>
              <Text style={styles.jobSummaryDate}>
                {new Date(job.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Text style={styles.jobSummaryPrice}>
                Customer Pays: ${((job.totalPrice || 0) / 100).toFixed(2)}
              </Text>
            </View>

            {/* Employee Selection (if not self-assign) */}
            {!isSelfAssign && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Select Employee</Text>
                <ScrollView style={styles.employeeList} horizontal={false}>
                  {employees.map((emp) => (
                    <Pressable
                      key={emp.id}
                      style={[
                        styles.employeeOption,
                        selectedEmployee?.id === emp.id && styles.employeeOptionSelected,
                      ]}
                      onPress={() => setSelectedEmployee(emp)}
                    >
                      <View style={styles.employeeOptionAvatar}>
                        <Text style={styles.employeeOptionAvatarText}>
                          {(emp.firstName?.[0] || "E").toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.employeeOptionInfo}>
                        <Text style={styles.employeeOptionName}>
                          {emp.firstName} {emp.lastName}
                        </Text>
                        <Text style={styles.employeeOptionRate}>
                          {emp.payType === "hourly" && emp.defaultHourlyRate
                            ? `$${(emp.defaultHourlyRate / 100).toFixed(2)}/hr`
                            : emp.payType === "percentage" && emp.payRate
                            ? `${parseFloat(emp.payRate)}% of job`
                            : emp.defaultJobRate
                            ? `$${(emp.defaultJobRate / 100).toFixed(2)}/job`
                            : "No default rate set"}
                        </Text>
                      </View>
                      {selectedEmployee?.id === emp.id && (
                        <Icon name="check" size={16} color={colors.primary[600]} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Pay Amount (skip for self-assign) */}
            {!isSelfAssign && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Pay Amount</Text>
                  {/* Show default pay info when employee selected */}
                  {selectedEmployee && isUsingDefaultPay && (
                    <View style={styles.defaultPayNote}>
                      <Icon name="info-circle" size={12} color={colors.primary[600]} />
                      <Text style={styles.defaultPayNoteText}>
                        Using {selectedEmployee.firstName}'s default{" "}
                        {selectedEmployee.payType === "hourly"
                          ? "hourly rate (2hr estimate)"
                          : selectedEmployee.payType === "percentage"
                          ? `${parseFloat(selectedEmployee.payRate)}% rate`
                          : "job rate"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.payInputRow}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.payInput}
                      value={payAmount}
                      onChangeText={(val) => {
                        setPayAmount(val);
                        setIsUsingDefaultPay(false); // Mark as overridden when manually changed
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                  {/* Quick suggestions */}
                  <Text style={styles.suggestionsLabel}>Quick suggestions:</Text>
                  <View style={styles.paySuggestions}>
                    {job &&
                      Object.entries(
                        BusinessOwnerService.suggestPayAmounts(job.totalPrice || 0)
                      ).map(([key, value]) => (
                        <Pressable
                          key={key}
                          style={styles.paySuggestion}
                          onPress={() => {
                            setPayAmount((value.payAmount / 100).toFixed(2));
                            setIsUsingDefaultPay(false);
                          }}
                        >
                          <Text style={styles.paySuggestionAmount}>{value.formatted}</Text>
                          <Text style={styles.paySuggestionLabel}>{value.label}</Text>
                        </Pressable>
                      ))}
                  </View>
                </View>

                {/* Pay Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Pay Type</Text>
                  <View style={styles.payTypeRow}>
                    <Pressable
                      style={[
                        styles.payTypeOption,
                        payType === "flat_rate" && styles.payTypeOptionSelected,
                      ]}
                      onPress={() => setPayType("flat_rate")}
                    >
                      <Text
                        style={[
                          styles.payTypeText,
                          payType === "flat_rate" && styles.payTypeTextSelected,
                        ]}
                      >
                        Flat Rate
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.payTypeOption,
                        payType === "hourly" && styles.payTypeOptionSelected,
                      ]}
                      onPress={() => setPayType("hourly")}
                    >
                      <Text
                        style={[
                          styles.payTypeText,
                          payType === "hourly" && styles.payTypeTextSelected,
                        ]}
                      >
                        Hourly
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Financial Breakdown */}
                <Pressable
                  style={styles.financialsToggle}
                  onPress={() => setShowFinancials(!showFinancials)}
                >
                  <Text style={styles.financialsToggleText}>
                    {showFinancials ? "Hide" : "Show"} Financial Breakdown
                  </Text>
                  <Icon
                    name={showFinancials ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={colors.primary[600]}
                  />
                </Pressable>

                {showFinancials && financials && (
                  <View style={styles.financialsCard}>
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Customer Pays</Text>
                      <Text style={styles.financialValue}>
                        {financials.formatted.customerPays}
                      </Text>
                    </View>
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Platform Fee ({platformFeePercent}%)</Text>
                      <Text style={[styles.financialValue, { color: colors.error[600] }]}>
                        -{financials.formatted.platformFee}
                      </Text>
                    </View>
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Employee Pay</Text>
                      <Text style={[styles.financialValue, { color: colors.error[600] }]}>
                        -{financials.formatted.employeePay}
                      </Text>
                    </View>
                    <View style={[styles.financialRow, styles.financialRowTotal]}>
                      <Text style={styles.financialLabelTotal}>Your Profit</Text>
                      <Text
                        style={[
                          styles.financialValueTotal,
                          financials.businessOwnerProfit < 0 && { color: colors.error[600] },
                        ]}
                      >
                        {financials.formatted.businessOwnerProfit}
                      </Text>
                    </View>
                    <Text style={styles.financialMargin}>
                      Profit Margin: {financials.formatted.profitMargin}
                    </Text>
                    {financials.warnings.map((warning, i) => (
                      <View key={i} style={styles.warningBadge}>
                        <Icon name="exclamation-triangle" size={12} color={colors.warning[700]} />
                        <Text style={styles.warningText}>{warning.message}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {isSelfAssign && (
              <View style={styles.selfAssignInfo}>
                <Icon name="info-circle" size={20} color={colors.primary[600]} />
                <Text style={styles.selfAssignInfoText}>
                  Self-assigning this job means you'll clean it yourself. The job will be tracked
                  with $0 payroll for analytics purposes.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.submitButton,
                (!isSelfAssign && !selectedEmployee) && styles.submitButtonDisabled,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={(!isSelfAssign && !selectedEmployee) || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isSelfAssign ? "Self-Assign" : "Assign"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
const JobAssignment = ({ state }) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const platformFeePercent = (pricing?.platform?.businessOwnerFeePercent || 0.10) * 100;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isSelfAssign, setIsSelfAssign] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View toggle
  const [viewMode, setViewMode] = useState("unassigned"); // 'unassigned' | 'assigned'

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [calendarResult, employeesResult] = await Promise.all([
        BusinessOwnerService.getCalendar(
          state.currentUser.token,
          new Date().getMonth() + 1,
          new Date().getFullYear()
        ),
        BusinessOwnerService.getEmployees(state.currentUser.token, "active"),
      ]);

      setUnassignedJobs(calendarResult.unassignedJobs || []);
      setAssignments(calendarResult.assignments || []);
      setEmployees(employeesResult.employees || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load jobs");
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

  const handleAssign = (job, selfAssign = false) => {
    setSelectedJob(job);
    setIsSelfAssign(selfAssign);
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (data) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let result;
      if (data.isSelfAssign) {
        result = await BusinessOwnerService.selfAssign(
          state.currentUser.token,
          data.appointmentId
        );
      } else {
        result = await BusinessOwnerService.assignEmployee(state.currentUser.token, {
          appointmentId: data.appointmentId,
          employeeId: data.employeeId,
          payAmount: data.payAmount,
          payType: data.payType,
        });
      }

      if (result.success) {
        setSuccess("Job assigned successfully!");
        setShowAssignModal(false);
        fetchData();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to assign job. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async (assignment) => {
    setError(null);
    setSuccess(null);

    try {
      const result = await BusinessOwnerService.unassignJob(
        state.currentUser.token,
        assignment.id
      );

      if (result.success) {
        setSuccess("Job unassigned successfully");
        fetchData();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to unassign job. Please try again.");
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Job Assignment</Text>
        <Pressable
          style={styles.calendarButton}
          onPress={() => navigate("/business-owner/calendar")}
        >
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* View Toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, viewMode === "unassigned" && styles.toggleButtonActive]}
          onPress={() => setViewMode("unassigned")}
        >
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === "unassigned" && styles.toggleButtonTextActive,
            ]}
          >
            Unassigned ({unassignedJobs.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, viewMode === "assigned" && styles.toggleButtonActive]}
          onPress={() => setViewMode("assigned")}
        >
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === "assigned" && styles.toggleButtonTextActive,
            ]}
          >
            Assigned ({assignments.length})
          </Text>
        </Pressable>
      </View>

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

      {/* Job List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {viewMode === "unassigned" ? (
          unassignedJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check-circle" size={48} color={colors.success[300]} />
              <Text style={styles.emptyStateTitle}>All Caught Up!</Text>
              <Text style={styles.emptyStateText}>
                No unassigned jobs at the moment.
              </Text>
            </View>
          ) : (
            unassignedJobs.map((job) => (
              <UnassignedJobCard
                key={job.id}
                job={job}
                onAssign={handleAssign}
              />
            ))
          )
        ) : assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="calendar-o" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyStateTitle}>No Assignments</Text>
            <Text style={styles.emptyStateText}>
              Assigned jobs will appear here.
            </Text>
          </View>
        ) : (
          assignments.map((assignment) => (
            <AssignedJobCard
              key={assignment.id}
              assignment={assignment}
              platformFeePercent={platformFeePercent}
              onReassign={() => {
                setSelectedJob(assignment.appointment);
                setIsSelfAssign(false);
                setShowAssignModal(true);
              }}
              onUnassign={() => handleUnassign(assignment)}
              onViewDetails={() =>
                navigate(`/business-owner/assignments/${assignment.id}`)
              }
            />
          ))
        )}
      </ScrollView>

      {/* Assign Modal */}
      <AssignModal
        visible={showAssignModal}
        job={selectedJob}
        employees={employees}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedJob(null);
          setIsSelfAssign(false);
        }}
        onSubmit={handleAssignSubmit}
        isSubmitting={isSubmitting}
        isSelfAssign={isSelfAssign}
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
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
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
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  calendarButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: colors.primary[600],
  },
  toggleButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  jobCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  jobCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  jobDateBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  jobDateDay: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  jobDateMonth: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    textTransform: "uppercase",
  },
  jobInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  jobClient: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  jobTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  jobAssignee: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  jobPay: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: 2,
  },
  financialInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  jobPriceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  feeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  employeePayLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
  },
  profitLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  profitNegative: {
    color: colors.error[600],
  },
  jobPrice: {
    alignItems: "flex-end",
  },
  jobPriceAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: "capitalize",
  },
  jobCardActions: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm,
  },
  assignButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  assignButtonText: {
    marginLeft: spacing.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  selfAssignButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.secondary[50],
    borderWidth: 1,
    borderColor: colors.secondary[200],
  },
  selfAssignButtonText: {
    marginLeft: spacing.sm,
    color: colors.secondary[700],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  reassignButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
  },
  reassignButtonText: {
    marginLeft: spacing.xs,
    color: colors.primary[700],
    fontSize: typography.fontSize.sm,
  },
  unassignButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.error[50],
  },
  unassignButtonText: {
    marginLeft: spacing.xs,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyStateTitle: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyStateText: {
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "90%",
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
  jobSummary: {
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  jobSummaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobSummaryDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  jobSummaryPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  employeeList: {
    maxHeight: 200,
  },
  employeeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    marginBottom: spacing.sm,
  },
  employeeOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  employeeOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeOptionAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  employeeOptionInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeOptionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  employeeOptionRate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  payInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  payInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
  },
  defaultPayNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  defaultPayNoteText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    flex: 1,
  },
  suggestionsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  paySuggestions: {
    flexDirection: "row",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  paySuggestion: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    padding: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  paySuggestionAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  paySuggestionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  payTypeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  payTypeOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: "center",
  },
  payTypeOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  payTypeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  payTypeTextSelected: {
    color: colors.primary[700],
  },
  financialsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  financialsToggleText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    marginRight: spacing.xs,
  },
  financialsCard: {
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  financialRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  financialLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  financialValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  financialLabelTotal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  financialValueTotal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  financialMargin: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  warningText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    flex: 1,
  },
  selfAssignInfo: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  selfAssignInfoText: {
    flex: 1,
    marginLeft: spacing.md,
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
  submitButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    minWidth: 100,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: colors.primary[300],
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
});

export default JobAssignment;
