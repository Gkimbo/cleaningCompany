import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Status configuration
const STATUS_CONFIG = {
  assigned: { bg: colors.primary[50], text: colors.primary[600], label: "Scheduled", icon: "calendar-check-o" },
  started: { bg: colors.warning[50], text: colors.warning[600], label: "In Progress", icon: "spinner" },
  completed: { bg: colors.success[50], text: colors.success[600], label: "Completed", icon: "check-circle" },
  cancelled: { bg: colors.neutral[100], text: colors.neutral[500], label: "Cancelled", icon: "ban" },
  no_show: { bg: colors.error[50], text: colors.error[600], label: "No Show", icon: "times-circle" },
};

// Section Header Component
const SectionHeader = ({ icon, title, action }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      <View style={styles.sectionIcon}>
        <Icon name={icon} size={14} color={colors.primary[500]} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {action}
  </View>
);

// Detail Item Component
const DetailItem = ({ icon, label, value, onPress, accent, large }) => (
  <Pressable
    style={[styles.detailItem, large && styles.detailItemLarge]}
    onPress={onPress}
    disabled={!onPress}
  >
    {icon && (
      <View style={[styles.detailIcon, accent && { backgroundColor: accent + "15" }]}>
        <Icon name={icon} size={14} color={accent || colors.neutral[400]} />
      </View>
    )}
    <View style={styles.detailContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, onPress && styles.detailValueLink, large && styles.detailValueLarge]}>
        {value}
      </Text>
    </View>
    {onPress && (
      <Icon name="angle-right" size={18} color={colors.neutral[300]} />
    )}
  </Pressable>
);

// Employee Selection Modal (for reassigning)
const EmployeeSelectionModal = ({
  visible,
  onClose,
  employees,
  loading,
  onSelect,
  title,
  currentEmployeeId,
  isSubmitting,
  jobPrice,
  platformFee,
  currentEmployeePay,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Calculate projected financials (replacing current employee's pay with new employee's pay)
  const currentEmpPay = employees.find(e => e.id === currentEmployeeId)?.calculatedPay || 0;
  const newEmployeePay = selectedEmployee ? (selectedEmployee.calculatedPay || 0) / 100 : 0;
  const otherEmployeesPay = (currentEmployeePay || 0) - (currentEmpPay / 100);
  const projectedTotalPay = otherEmployeesPay + newEmployeePay;
  const projectedProfit = (jobPrice || 0) - (platformFee || 0) - projectedTotalPay;

  const handleConfirm = () => {
    if (selectedEmployee) {
      onSelect(selectedEmployee);
      setSelectedEmployee(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.reassignModalContent}>
          {/* Header */}
          <View style={styles.reassignModalHeader}>
            <View style={styles.reassignModalHeaderIcon}>
              <Icon name="exchange" size={16} color={colors.primary[500]} />
            </View>
            <View style={styles.reassignModalHeaderText}>
              <Text style={styles.reassignModalTitle}>{title}</Text>
              <Text style={styles.reassignModalSubtitle}>Choose who to assign this job to</Text>
            </View>
            <Pressable style={styles.reassignModalClose} onPress={onClose}>
              <Icon name="times" size={16} color={colors.neutral[400]} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={styles.modalLoadingText}>Loading team...</Text>
            </View>
          ) : employees.length === 0 ? (
            <View style={styles.modalEmpty}>
              <View style={styles.emptyIcon}>
                <Icon name="users" size={32} color={colors.neutral[300]} />
              </View>
              <Text style={styles.modalEmptyText}>No employees available</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.reassignScrollContent}
            >
              {/* Employee Cards */}
              <View style={styles.reassignEmployeeList}>
                {employees.map((emp) => {
                  const isCurrent = emp.id === currentEmployeeId;
                  const isSelected = selectedEmployee?.id === emp.id;
                  return (
                    <Pressable
                      key={emp.id}
                      style={[
                        styles.reassignEmployeeCard,
                        isCurrent && styles.reassignEmployeeCardCurrent,
                        isSelected && styles.reassignEmployeeCardSelected,
                      ]}
                      onPress={() => !isCurrent && setSelectedEmployee(emp)}
                      disabled={isCurrent || isSubmitting}
                    >
                      {/* Selection indicator */}
                      <View style={[
                        styles.reassignSelectionCircle,
                        isSelected && styles.reassignSelectionCircleSelected,
                        isCurrent && styles.reassignSelectionCircleCurrent,
                      ]}>
                        {isSelected && <Icon name="check" size={10} color="#fff" />}
                        {isCurrent && <Icon name="user" size={10} color={colors.neutral[400]} />}
                      </View>

                      {/* Avatar */}
                      <View style={[
                        styles.reassignAvatar,
                        isSelected && styles.reassignAvatarSelected,
                      ]}>
                        <Text style={[
                          styles.reassignAvatarText,
                          isSelected && styles.reassignAvatarTextSelected,
                        ]}>
                          {(emp.firstName?.[0] || "E").toUpperCase()}
                        </Text>
                      </View>

                      {/* Info */}
                      <View style={styles.reassignEmployeeInfo}>
                        <Text style={[
                          styles.reassignEmployeeName,
                          isCurrent && styles.reassignEmployeeNameCurrent,
                        ]}>
                          {emp.firstName} {emp.lastName}
                        </Text>
                        {isCurrent ? (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>Currently Assigned</Text>
                          </View>
                        ) : emp.formattedCalculatedPay ? (
                          <View style={styles.reassignPayInfo}>
                            <Text style={styles.reassignPayRate}>
                              {emp.calculatedPayType === "hourly" && emp.hourlyRate
                                ? `$${emp.hourlyRate.toFixed(0)}/hr`
                                : emp.calculatedPayType === "percentage" && emp.percentRate
                                ? `${emp.percentRate}%`
                                : "Flat rate"}
                            </Text>
                            <View style={styles.reassignPayDot} />
                            <Text style={styles.reassignPayTotal}>{emp.formattedCalculatedPay}</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Financial Preview */}
              {selectedEmployee && jobPrice !== undefined && (
                <View style={styles.reassignFinancialCard}>
                  <View style={styles.reassignFinancialHeader}>
                    <Icon name="calculator" size={14} color={colors.primary[500]} />
                    <Text style={styles.reassignFinancialTitle}>Financial Impact</Text>
                  </View>

                  <View style={styles.reassignFinancialBody}>
                    <View style={styles.reassignFinancialRow}>
                      <Text style={styles.reassignFinancialLabel}>Job Price</Text>
                      <Text style={styles.reassignFinancialValue}>${jobPrice.toFixed(2)}</Text>
                    </View>
                    <View style={styles.reassignFinancialRow}>
                      <Text style={styles.reassignFinancialLabel}>Platform Fee</Text>
                      <Text style={[styles.reassignFinancialValue, styles.reassignFinancialDeduct]}>
                        -${platformFee.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.reassignFinancialRow}>
                      <Text style={styles.reassignFinancialLabel}>{selectedEmployee.firstName}'s Pay</Text>
                      <Text style={[styles.reassignFinancialValue, styles.reassignFinancialDeduct]}>
                        -${newEmployeePay.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.reassignFinancialFooter}>
                    <Text style={styles.reassignFinancialProfitLabel}>Your Profit</Text>
                    <Text style={[
                      styles.reassignFinancialProfitValue,
                      projectedProfit >= 0 ? styles.profitPositive : styles.profitNegative
                    ]}>
                      ${projectedProfit.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Confirm Button */}
              {selectedEmployee && (
                <Pressable
                  style={[styles.reassignConfirmButton, isSubmitting && styles.reassignConfirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check" size={16} color="#fff" />
                      <Text style={styles.reassignConfirmButtonText}>
                        Assign to {selectedEmployee.firstName}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Add Employee Modal
const AddEmployeeModal = ({
  visible,
  onClose,
  employees,
  loading,
  onSubmit,
  isSubmitting,
  existingEmployeeIds,
  jobPrice,
  platformFee,
  recalculatedExistingPay,
  recalculatedAssignments,
  hoursPerCleaner,
  totalCleaners,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const handleSubmit = () => {
    if (!selectedEmployee) {
      Alert.alert("Error", "Please select an employee");
      return;
    }
    const payAmount = (selectedEmployee.calculatedPay || 0) / 100;
    onSubmit(selectedEmployee, payAmount);
  };

  const availableEmployees = employees.filter((emp) => !existingEmployeeIds.includes(emp.id));

  // Calculate projected financials with recalculated pay (hours split among all cleaners)
  const existingTeamPay = (recalculatedExistingPay || 0) / 100;
  const newEmployeePay = selectedEmployee ? (selectedEmployee.calculatedPay || 0) / 100 : 0;
  const totalEmployeePay = existingTeamPay + newEmployeePay;
  const projectedProfit = jobPrice - platformFee - totalEmployeePay;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add Team Member</Text>
              <Text style={styles.modalSubtitle}>Assign another employee to this job</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Icon name="times" size={18} color={colors.neutral[500]} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={styles.modalLoadingText}>Loading team...</Text>
            </View>
          ) : availableEmployees.length === 0 ? (
            <View style={styles.modalEmpty}>
              <View style={styles.emptyIcon}>
                <Icon name="check-circle" size={32} color={colors.success[400]} />
              </View>
              <Text style={styles.modalEmptyText}>All team members are assigned</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionLabel}>Select Employee</Text>
              <View style={styles.employeeGrid}>
                {availableEmployees.map((emp) => {
                  const isSelected = selectedEmployee?.id === emp.id;
                  return (
                    <Pressable
                      key={emp.id}
                      style={[styles.employeeCard, isSelected && styles.employeeCardSelected]}
                      onPress={() => setSelectedEmployee(emp)}
                    >
                      <View style={[styles.employeeCardAvatar, isSelected && styles.employeeCardAvatarSelected]}>
                        <Text style={[styles.employeeCardAvatarText, isSelected && styles.employeeCardAvatarTextSelected]}>
                          {(emp.firstName?.[0] || "E").toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.employeeCardName} numberOfLines={1}>
                        {emp.firstName}
                      </Text>
                      {emp.formattedCalculatedPay && (
                        <Text style={styles.employeeCardPay}>
                          {emp.calculatedPayType === "hourly" && emp.hourlyRate
                            ? `$${emp.hourlyRate.toFixed(0)}/hr`
                            : emp.calculatedPayType === "percentage" && emp.percentRate
                            ? `${emp.percentRate}%`
                            : null}
                        </Text>
                      )}
                      {emp.formattedCalculatedPay && (
                        <Text style={styles.employeeCardPayTotal}>{emp.formattedCalculatedPay}</Text>
                      )}
                      {isSelected && (
                        <View style={styles.selectedCheck}>
                          <Icon name="check" size={10} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Financial Preview */}
              {selectedEmployee && (
                <View style={styles.financialPreview}>
                  <Text style={styles.financialPreviewTitle}>
                    With {totalCleaners} cleaner{totalCleaners > 1 ? "s" : ""} ({hoursPerCleaner.toFixed(1)} hrs each)
                  </Text>
                  <View style={styles.financialPreviewRow}>
                    <Text style={styles.financialPreviewLabel}>Job Price</Text>
                    <Text style={styles.financialPreviewValue}>${jobPrice.toFixed(2)}</Text>
                  </View>
                  <View style={styles.financialPreviewRow}>
                    <Text style={styles.financialPreviewLabel}>Platform Fee</Text>
                    <Text style={[styles.financialPreviewValue, styles.financialPreviewDeduct]}>-${platformFee.toFixed(2)}</Text>
                  </View>
                  {recalculatedAssignments?.length > 0 && recalculatedAssignments.map((emp) => (
                    <View key={emp.assignmentId} style={styles.financialPreviewRow}>
                      <Text style={styles.financialPreviewLabel}>{emp.employeeName}</Text>
                      <Text style={[styles.financialPreviewValue, styles.financialPreviewDeduct]}>
                        -{emp.formattedRecalculatedPay}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.financialPreviewRow}>
                    <Text style={styles.financialPreviewLabel}>+ {selectedEmployee.firstName}</Text>
                    <Text style={[styles.financialPreviewValue, styles.financialPreviewDeduct]}>-${newEmployeePay.toFixed(2)}</Text>
                  </View>
                  <View style={styles.financialPreviewDivider} />
                  <View style={styles.financialPreviewRow}>
                    <Text style={styles.financialPreviewLabelBold}>Your Profit</Text>
                    <Text style={[styles.financialPreviewValueBold, projectedProfit >= 0 ? styles.profitPositive : styles.profitNegative]}>
                      ${projectedProfit.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <Pressable
                style={[styles.addButton, (!selectedEmployee || isSubmitting) && styles.addButtonDisabled]}
                onPress={handleSubmit}
                disabled={!selectedEmployee || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="plus" size={16} color="#fff" />
                    <Text style={styles.addButtonText}>Add to Job</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Main Component
const AssignmentDetail = ({ state }) => {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [allAssignments, setAllAssignments] = useState([]);
  const [jobDetails, setJobDetails] = useState(null);
  const [modalJobDetails, setModalJobDetails] = useState(null);

  const fetchAssignmentDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await BusinessOwnerService.getAssignmentDetail(state.currentUser.token, assignmentId);
      if (result?.assignment) {
        setAssignment(result.assignment);
        if (result.allAssignments) setAllAssignments(result.allAssignments);
        if (result.jobDetails) setJobDetails(result.jobDetails);
      } else {
        setError(result.error || "Assignment not found");
      }
    } catch (err) {
      setError("Failed to load assignment details");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeesForJob = async (appointmentId, mode = "add") => {
    setEmployeesLoading(true);
    try {
      const result = await BusinessOwnerService.getEmployeesForJob(state.currentUser.token, appointmentId, mode);
      if (result?.employees?.length > 0) {
        const transformed = result.employees.map((emp) => ({
          ...emp,
          calculatedPay: emp.calculatedPay,
          calculatedPayType: emp.calculatedPayType,
          formattedCalculatedPay: emp.formattedCalculatedPay,
          hourlyRate: emp.defaultHourlyRate ? emp.defaultHourlyRate / 100 : null,
          jobRate: emp.defaultJobRate ? emp.defaultJobRate / 100 : null,
          percentRate: emp.payRate ? parseFloat(emp.payRate) : null,
        }));
        setEmployees(transformed);
        // Store job details with recalculated pay for modal
        if (result.jobDetails) {
          setModalJobDetails(result.jobDetails);
        }
      } else {
        setEmployees([]);
      }
    } catch (err) {
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignmentDetails();
  }, [assignmentId]);

  const handleOpenReassignModal = () => {
    setShowReassignModal(true);
    if (assignment?.appointment?.id) fetchEmployeesForJob(assignment.appointment.id, "reassign");
  };

  const handleOpenAddEmployeeModal = () => {
    setShowAddEmployeeModal(true);
    if (assignment?.appointment?.id) fetchEmployeesForJob(assignment.appointment.id, "add");
  };

  const handleReassign = async (newEmployee) => {
    setActionLoading(true);
    try {
      const result = await BusinessOwnerService.reassignJob(state.currentUser.token, assignment.id, newEmployee.id);
      if (result.success || result.assignment) {
        Alert.alert("Success", `Job reassigned to ${newEmployee.firstName}`);
        setShowReassignModal(false);
        fetchAssignmentDetails();
      } else {
        Alert.alert("Error", result.error || "Failed to reassign job");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to reassign job");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddEmployee = async (employee, payAmount) => {
    setActionLoading(true);
    try {
      const result = await BusinessOwnerService.assignEmployee(state.currentUser.token, {
        appointmentId: assignment?.appointment?.id,
        employeeId: employee.id,
        payAmount: payAmount * 100,
        payType: employee.calculatedPayType || "flat_rate",
      });
      if (result.success) {
        Alert.alert("Success", `${employee.firstName} added to the job`);
        setShowAddEmployeeModal(false);
        fetchAssignmentDetails();
      } else {
        Alert.alert("Error", result.error || "Failed to add employee");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to add employee");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignEmployee = async (empAssignmentId) => {
    const empAssignment = allAssignments.find((a) => a.id === empAssignmentId);
    const empName = empAssignment?.employee
      ? `${empAssignment.employee.firstName || ""}`.trim()
      : "this employee";

    Alert.alert("Remove Employee", `Remove ${empName} from this job?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            const result = await BusinessOwnerService.unassignJob(state.currentUser.token, empAssignmentId);
            if (result.message) {
              // If this was the last assignment OR we removed the assignment we're viewing
              const isViewingRemovedAssignment = parseInt(assignmentId) === empAssignmentId;
              if (allAssignments.length <= 1 || isViewingRemovedAssignment) {
                // Find another assignment to navigate to, or go back
                const remainingAssignment = allAssignments.find((a) => a.id !== empAssignmentId);
                if (remainingAssignment) {
                  navigate(`/business-owner/assignments/${remainingAssignment.id}`, { replace: true });
                } else {
                  navigate(-1);
                }
              } else {
                fetchAssignmentDetails();
              }
            } else {
              Alert.alert("Error", result.error || "Failed to remove employee");
            }
          } catch (err) {
            Alert.alert("Error", "Failed to remove employee");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const openMaps = async (address) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to web URL
        await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
      }
    } catch (error) {
      console.log("Could not open maps:", error);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error || !assignment) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Icon name="exclamation-triangle" size={32} color={colors.error[400]} />
        </View>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error || "Assignment not found"}</Text>
        <Pressable style={styles.errorButton} onPress={() => navigate(-1)}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.assigned;
  const appointment = assignment.appointment || {};
  const home = appointment.home || {};
  const client = home.user || {};
  const employee = assignment.employee || {};
  const isToday = appointment.date && new Date(appointment.date + "T00:00:00").toDateString() === new Date().toDateString();
  const existingEmployeeIds = allAssignments.map((a) => a.businessEmployeeId).filter(Boolean);

  // Calculate financials
  const jobPrice = parseFloat(appointment.price) || 0;
  const platformFee = (jobDetails?.platformFeeAmount || 0) / 100;
  const totalEmployeePay = allAssignments.reduce((sum, emp) => sum + (emp.calculatedPay || emp.payAmount || 0), 0) / 100;
  const profit = jobPrice - platformFee - totalEmployeePay;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {client.firstName ? `${client.firstName}'s Home` : "Assignment"}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
          <Icon name={statusConfig.icon} size={12} color={statusConfig.text} />
          <Text style={[styles.statusPillText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Card - Date & Time */}
        <View style={styles.heroCard}>
          <View style={styles.heroDateSection}>
            <View style={styles.heroDateBadge}>
              <Text style={styles.heroDateDay}>
                {appointment.date ? new Date(appointment.date + "T00:00:00").getDate() : "-"}
              </Text>
              <Text style={styles.heroDateMonth}>
                {appointment.date ? new Date(appointment.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" }).toUpperCase() : ""}
              </Text>
            </View>
            <View style={styles.heroDateInfo}>
              <Text style={styles.heroDateText}>{appointment.date ? formatDate(appointment.date) : "No date"}</Text>
              <Text style={styles.heroTimeText}>
                {appointment.startTime ? formatTime(appointment.startTime) : "Time TBD"}
                {jobDetails?.estimatedHours ? ` · ${jobDetails.estimatedHours} hrs` : ""}
              </Text>
              {isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>${jobPrice.toFixed(0)}</Text>
              <Text style={styles.quickStatLabel}>Job Price</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={[styles.quickStatValue, { color: colors.success[600] }]}>${profit.toFixed(0)}</Text>
              <Text style={styles.quickStatLabel}>Your Profit</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{allAssignments.length}</Text>
              <Text style={styles.quickStatLabel}>{allAssignments.length === 1 ? "Cleaner" : "Cleaners"}</Text>
            </View>
          </View>
        </View>

        {/* Team Section */}
        <View style={styles.section}>
          <SectionHeader
            icon="users"
            title="Assigned Team"
            action={
              assignment.status === "assigned" && allAssignments.length === 1 && (
                <Pressable style={styles.headerAction} onPress={handleOpenReassignModal}>
                  <Icon name="exchange" size={12} color={colors.primary[500]} />
                  <Text style={styles.headerActionText}>Change</Text>
                </Pressable>
              )
            }
          />
          <View style={styles.sectionContent}>
            {allAssignments.map((emp, index) => (
              <View key={emp.id} style={[styles.teamMember, index < allAssignments.length - 1 && styles.teamMemberBorder]}>
                <View style={[styles.teamMemberAvatar, emp.isSelfAssignment && styles.teamMemberAvatarSelf]}>
                  <Text style={styles.teamMemberAvatarText}>
                    {emp.isSelfAssignment ? "Me" : (emp.employee?.firstName?.[0] || "?").toUpperCase()}
                  </Text>
                </View>
                <View style={styles.teamMemberInfo}>
                  <Text style={styles.teamMemberName}>
                    {emp.isSelfAssignment ? "You" : `${emp.employee?.firstName || ""} ${emp.employee?.lastName || ""}`.trim()}
                  </Text>
                  <View style={styles.teamMemberMeta}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_CONFIG[emp.status]?.text || colors.neutral[400] }]} />
                    <Text style={styles.teamMemberStatus}>{STATUS_CONFIG[emp.status]?.label || emp.status}</Text>
                    <Text style={styles.teamMemberPay}>
                      {emp.calculatedPayType === "hourly" && emp.employeeRateInfo?.defaultHourlyRate
                        ? ` · $${(emp.employeeRateInfo.defaultHourlyRate / 100).toFixed(0)}/hr · $${((emp.calculatedPay || emp.payAmount || 0) / 100).toFixed(2)}`
                        : emp.calculatedPayType === "percentage" && emp.employeeRateInfo?.payRate
                        ? ` · ${emp.employeeRateInfo.payRate}% · $${((emp.calculatedPay || emp.payAmount || 0) / 100).toFixed(2)}`
                        : ` · $${((emp.calculatedPay || emp.payAmount || 0) / 100).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
                {emp.status === "assigned" && !emp.isSelfAssignment && (
                  <Pressable style={styles.removeButton} onPress={() => handleUnassignEmployee(emp.id)}>
                    <Icon name="times" size={12} color={colors.error[500]} />
                  </Pressable>
                )}
              </View>
            ))}

            {/* Add Employee Button */}
            {assignment.status === "assigned" && (
              <Pressable style={styles.addTeamMember} onPress={handleOpenAddEmployeeModal}>
                <View style={styles.addTeamMemberIcon}>
                  <Icon name="plus" size={14} color={colors.primary[500]} />
                </View>
                <Text style={styles.addTeamMemberText}>Add team member</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <SectionHeader icon="map-marker" title="Location" />
          <View style={styles.sectionContent}>
            {home.address && (
              <Pressable style={styles.addressCard} onPress={() => openMaps(home.address)}>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressText}>{home.address}</Text>
                  {home.numBeds && (
                    <Text style={styles.addressMeta}>
                      {home.numBeds} bed · {home.numBaths} bath
                    </Text>
                  )}
                </View>
                <View style={styles.mapButton}>
                  <Icon name="location-arrow" size={14} color={colors.primary[500]} />
                </View>
              </Pressable>
            )}
            {home.keyPadCode && (
              <DetailItem icon="key" label="Keypad Code" value={home.keyPadCode} />
            )}
            {home.keyLocation && (
              <DetailItem icon="key" label="Key Location" value={home.keyLocation} />
            )}
            {home.specialNotes && (
              <View style={styles.notesBox}>
                <View style={styles.notesHeader}>
                  <Icon name="sticky-note" size={12} color={colors.warning[600]} />
                  <Text style={styles.notesTitle}>Special Instructions</Text>
                </View>
                <Text style={styles.notesText}>{home.specialNotes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Client Section */}
        {client.firstName && (
          <View style={styles.section}>
            <SectionHeader icon="user" title="Client" />
            <View style={styles.sectionContent}>
              <DetailItem label="Name" value={`${client.firstName} ${client.lastName || ""}`} />
              {client.phone && (
                <DetailItem
                  icon="phone"
                  label="Phone"
                  value={client.phone}
                  onPress={() => Linking.openURL(`tel:${client.phone}`)}
                />
              )}
              {client.email && (
                <DetailItem
                  icon="envelope"
                  label="Email"
                  value={client.email}
                  onPress={() => Linking.openURL(`mailto:${client.email}`)}
                />
              )}
            </View>
          </View>
        )}

        {/* Financials Section */}
        <View style={styles.section}>
          <SectionHeader icon="dollar" title="Financials" />
          <View style={styles.financialsCard}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Job Price</Text>
              <Text style={styles.financialValue}>${jobPrice.toFixed(2)}</Text>
            </View>
            {jobDetails?.platformFeeAmount !== undefined && (
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>
                  Platform Fee ({Math.round((jobDetails?.platformFeePercent || 0) * 100)}%)
                </Text>
                <Text style={[styles.financialValue, styles.financialDeduct]}>-${platformFee.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Employee Pay</Text>
              <Text style={[styles.financialValue, styles.financialDeduct]}>-${totalEmployeePay.toFixed(2)}</Text>
            </View>
            <View style={styles.financialDivider} />
            <View style={styles.financialRow}>
              <Text style={styles.financialLabelBold}>Your Profit</Text>
              <Text style={[styles.financialValueBold, profit >= 0 ? styles.profitPositive : styles.profitNegative]}>
                ${profit.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Modals */}
      <EmployeeSelectionModal
        visible={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        employees={employees}
        loading={employeesLoading}
        onSelect={handleReassign}
        title="Reassign Job"
        currentEmployeeId={employee?.id}
        isSubmitting={actionLoading}
        jobPrice={jobPrice}
        platformFee={platformFee}
        currentEmployeePay={totalEmployeePay}
      />

      <AddEmployeeModal
        visible={showAddEmployeeModal}
        onClose={() => setShowAddEmployeeModal(false)}
        employees={employees}
        loading={employeesLoading}
        onSubmit={handleAddEmployee}
        isSubmitting={actionLoading}
        existingEmployeeIds={existingEmployeeIds}
        jobPrice={jobPrice}
        platformFee={platformFee}
        recalculatedExistingPay={modalJobDetails?.recalculatedExistingPay || 0}
        recalculatedAssignments={modalJobDetails?.recalculatedAssignments || []}
        hoursPerCleaner={modalJobDetails?.hoursPerCleaner || 0}
        totalCleaners={modalJobDetails?.totalCleaners || 1}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.neutral[50],
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.error[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  errorButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  errorButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  statusPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  scrollView: {
    flex: 1,
  },

  // Hero Card
  heroCard: {
    backgroundColor: "#fff",
    margin: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  heroDateSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  heroDateBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[500],
    justifyContent: "center",
    alignItems: "center",
  },
  heroDateDay: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    lineHeight: 28,
  },
  heroDateMonth: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
  },
  heroDateInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  heroDateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  heroTimeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  todayBadge: {
    backgroundColor: colors.success[500],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    letterSpacing: 0.5,
  },
  quickStats: {
    flexDirection: "row",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  quickStat: {
    flex: 1,
    alignItems: "center",
  },
  quickStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  quickStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: 4,
  },

  // Sections
  section: {
    backgroundColor: "#fff",
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[500],
  },
  sectionContent: {
    padding: spacing.md,
  },

  // Team Members
  teamMember: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  teamMemberBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  teamMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  teamMemberAvatarSelf: {
    backgroundColor: colors.primary[100],
  },
  teamMemberAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  teamMemberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  teamMemberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  teamMemberMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  teamMemberStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  teamMemberPay: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error[50],
    justifyContent: "center",
    alignItems: "center",
  },
  addTeamMember: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  addTeamMemberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
  },
  addTeamMemberText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[500],
    marginLeft: spacing.md,
  },

  // Address Card
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  addressMeta: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  mapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },

  // Detail Items
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  detailItemLarge: {
    paddingVertical: spacing.md,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  detailValueLarge: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  detailValueLink: {
    color: colors.primary[500],
  },

  // Notes
  notesBox: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[400],
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  notesTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginLeft: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
  },

  // Financials
  financialsCard: {
    padding: spacing.md,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
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
  financialDeduct: {
    color: colors.error[500],
  },
  financialDivider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.sm,
  },
  financialLabelBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  financialValueBold: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  profitPositive: {
    color: colors.success[600],
  },
  profitNegative: {
    color: colors.error[600],
  },

  bottomPadding: {
    height: spacing.xl,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "85%",
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },

  // Reassign Modal Styles
  reassignModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "90%",
  },
  reassignModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  reassignModalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  reassignModalHeaderText: {
    flex: 1,
  },
  reassignModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  reassignModalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  reassignModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  reassignScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  reassignEmployeeList: {
    gap: spacing.sm,
  },
  reassignEmployeeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  reassignEmployeeCardCurrent: {
    backgroundColor: colors.neutral[100],
    opacity: 0.7,
  },
  reassignEmployeeCardSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  reassignSelectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  reassignSelectionCircleSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  reassignSelectionCircleCurrent: {
    backgroundColor: colors.neutral[200],
    borderColor: colors.neutral[300],
  },
  reassignAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  reassignAvatarSelected: {
    backgroundColor: colors.primary[500],
  },
  reassignAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[600],
  },
  reassignAvatarTextSelected: {
    color: "#fff",
  },
  reassignEmployeeInfo: {
    flex: 1,
  },
  reassignEmployeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  reassignEmployeeNameCurrent: {
    color: colors.text.tertiary,
  },
  currentBadge: {
    backgroundColor: colors.neutral[200],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  currentBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  reassignPayInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  reassignPayRate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  reassignPayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    marginHorizontal: spacing.xs,
  },
  reassignPayTotal: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  reassignFinancialCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    overflow: "hidden",
  },
  reassignFinancialHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    gap: spacing.sm,
  },
  reassignFinancialTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  reassignFinancialBody: {
    padding: spacing.md,
  },
  reassignFinancialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  reassignFinancialLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  reassignFinancialValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  reassignFinancialDeduct: {
    color: colors.error[500],
  },
  reassignFinancialFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  reassignFinancialProfitLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  reassignFinancialProfitValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  reassignConfirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[500],
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  reassignConfirmButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  reassignConfirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: "#fff",
  },

  modalLoading: {
    padding: spacing.xl * 2,
    alignItems: "center",
  },
  modalLoadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  modalEmpty: {
    padding: spacing.xl * 2,
    alignItems: "center",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalEmptyText: {
    color: colors.text.secondary,
    textAlign: "center",
  },
  modalSectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Employee List (Modal)
  employeeList: {
    // No maxHeight - parent ScrollView handles scrolling
  },
  employeeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  employeeOptionCurrent: {
    backgroundColor: colors.neutral[50],
  },
  employeeOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarActive: {
    backgroundColor: colors.primary[100],
  },
  employeeAvatarSelected: {
    backgroundColor: colors.primary[500],
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  employeeAvatarTextActive: {
    color: colors.primary[600],
  },
  employeeAvatarTextSelected: {
    color: "#fff",
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
  currentLabel: {
    color: colors.primary[500],
    fontWeight: typography.fontWeight.normal,
  },
  employeeOptionPay: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeeOptionPayTotal: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.semibold,
  },

  // Employee Grid (Add Modal)
  employeeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  employeeCard: {
    width: "30%",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  employeeCardSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  employeeCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  employeeCardAvatarSelected: {
    backgroundColor: colors.primary[500],
  },
  employeeCardAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  employeeCardAvatarTextSelected: {
    color: "#fff",
  },
  employeeCardName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textAlign: "center",
  },
  employeeCardPay: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeeCardPayTotal: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  selectedCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary[500],
    justifyContent: "center",
    alignItems: "center",
  },

  // Pay Input (Modal)
  payInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing.md,
  },
  payInputCurrency: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  payInputField: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingVertical: spacing.md,
    marginLeft: spacing.xs,
  },
  payInputHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },

  // Financial Preview (Modal)
  financialPreview: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  financialPreviewTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  financialPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  financialPreviewLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  financialPreviewValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  financialPreviewDeduct: {
    color: colors.error[500],
  },
  financialPreviewDivider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.sm,
  },
  financialPreviewLabelBold: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  financialPreviewValueBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[500],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  addButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  addButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: "#fff",
  },
});

export default AssignmentDetail;
