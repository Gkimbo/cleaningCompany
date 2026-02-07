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
  assigned: { bg: colors.primary[100], text: colors.primary[700], label: "Scheduled", icon: "calendar" },
  started: { bg: colors.warning[100], text: colors.warning[700], label: "In Progress", icon: "clock-o" },
  completed: { bg: colors.success[100], text: colors.success[700], label: "Completed", icon: "check-circle" },
  cancelled: { bg: colors.neutral[200], text: colors.neutral[600], label: "Cancelled", icon: "ban" },
  no_show: { bg: colors.error[100], text: colors.error[700], label: "No Show", icon: "times-circle" },
};

// Info Row Component
const InfoRow = ({ icon, label, value, onPress, isLink }) => (
  <Pressable
    style={styles.infoRow}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.infoIcon}>
      <Icon name={icon} size={16} color={colors.neutral[400]} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, isLink && styles.infoValueLink]}>
        {value}
      </Text>
    </View>
    {onPress && (
      <Icon name="chevron-right" size={14} color={colors.neutral[400]} />
    )}
  </Pressable>
);

// Employee Selection Modal
const EmployeeSelectionModal = ({
  visible,
  onClose,
  employees,
  loading,
  onSelect,
  title,
  currentEmployeeId,
  isSubmitting,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <Icon name="times" size={20} color={colors.text.secondary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.modalLoading}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.modalLoadingText}>Loading employees...</Text>
          </View>
        ) : employees.length === 0 ? (
          <View style={styles.modalEmpty}>
            <Icon name="users" size={40} color={colors.neutral[300]} />
            <Text style={styles.modalEmptyText}>No employees available</Text>
          </View>
        ) : (
          <ScrollView style={styles.employeeList}>
            {employees.map((emp) => {
              const isCurrent = emp.id === currentEmployeeId;
              return (
                <Pressable
                  key={emp.id}
                  style={[
                    styles.employeeItem,
                    isCurrent && styles.employeeItemCurrent,
                  ]}
                  onPress={() => !isCurrent && onSelect(emp)}
                  disabled={isCurrent || isSubmitting}
                >
                  <View style={[styles.employeeAvatar, isCurrent && styles.employeeAvatarCurrent]}>
                    <Text style={[styles.employeeAvatarText, isCurrent && styles.employeeAvatarTextCurrent]}>
                      {(emp.firstName?.[0] || "E").toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>
                      {emp.firstName} {emp.lastName}
                      {isCurrent && <Text style={styles.currentBadge}> (Current)</Text>}
                    </Text>
                    {emp.hourlyRate && (
                      <Text style={styles.employeeRate}>
                        ${emp.hourlyRate}/hr
                      </Text>
                    )}
                    {!emp.isAvailable && emp.unavailableReason && (
                      <Text style={styles.unavailableText}>
                        {emp.unavailableReason}
                      </Text>
                    )}
                  </View>
                  {!isCurrent && (
                    <Icon name="chevron-right" size={14} color={colors.neutral[400]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  </Modal>
);

// Add Employee Modal with Pay Input
const AddEmployeeModal = ({
  visible,
  onClose,
  employees,
  loading,
  onSubmit,
  isSubmitting,
  existingEmployeeIds,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [payAmount, setPayAmount] = useState("");

  const handleSubmit = () => {
    if (!selectedEmployee) {
      Alert.alert("Error", "Please select an employee");
      return;
    }
    onSubmit(selectedEmployee, parseFloat(payAmount) || 0);
  };

  const availableEmployees = employees.filter(
    (emp) => !existingEmployeeIds.includes(emp.id)
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Employee to Job</Text>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Icon name="times" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
              <Text style={styles.modalLoadingText}>Loading employees...</Text>
            </View>
          ) : availableEmployees.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Icon name="users" size={40} color={colors.neutral[300]} />
              <Text style={styles.modalEmptyText}>
                All employees are already assigned to this job
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Select Employee</Text>
              <ScrollView style={styles.employeeListCompact}>
                {availableEmployees.map((emp) => {
                  const isSelected = selectedEmployee?.id === emp.id;
                  return (
                    <Pressable
                      key={emp.id}
                      style={[
                        styles.employeeItemCompact,
                        isSelected && styles.employeeItemSelected,
                      ]}
                      onPress={() => setSelectedEmployee(emp)}
                    >
                      <View style={[styles.employeeAvatarSmall, isSelected && styles.employeeAvatarSelected]}>
                        <Text style={[styles.employeeAvatarTextSmall, isSelected && styles.employeeAvatarTextSelected]}>
                          {(emp.firstName?.[0] || "E").toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>
                          {emp.firstName} {emp.lastName}
                        </Text>
                        {emp.hourlyRate && (
                          <Text style={styles.employeeRate}>
                            ${emp.hourlyRate}/hr
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Icon name="check-circle" size={20} color={colors.primary[600]} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionLabel}>Pay Amount (Optional)</Text>
              <View style={styles.payInputContainer}>
                <Text style={styles.payInputPrefix}>$</Text>
                <TextInput
                  style={styles.payInput}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.neutral[400]}
                />
              </View>
              {selectedEmployee?.hourlyRate && (
                <Text style={styles.payHint}>
                  Default rate: ${selectedEmployee.hourlyRate}/hr
                </Text>
              )}

              <Pressable
                style={[
                  styles.submitButton,
                  (!selectedEmployee || isSubmitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!selectedEmployee || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Employee</Text>
                )}
              </Pressable>
            </>
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

  // Employee modals
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // All assignments for this appointment (for multi-employee jobs)
  const [allAssignments, setAllAssignments] = useState([]);

  const fetchAssignmentDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await BusinessOwnerService.getAssignmentDetail(
        state.currentUser.token,
        assignmentId
      );

      if (result?.assignment) {
        setAssignment(result.assignment);
        // If there are co-assignments, set them
        if (result.allAssignments) {
          setAllAssignments(result.allAssignments);
        }
      } else {
        setError(result.error || "Assignment not found");
      }
    } catch (err) {
      console.error("Error fetching assignment details:", err);
      setError("Failed to load assignment details");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    try {
      // Get all employees (no status filter to ensure we get data)
      const result = await BusinessOwnerService.getEmployees(
        state.currentUser.token
      );
      console.log("Fetched employees:", result);
      if (result?.employees && result.employees.length > 0) {
        // Filter to active employees and transform to include hourlyRate
        const transformedEmployees = result.employees
          .filter((emp) => emp.status === "active")
          .map((emp) => ({
            ...emp,
            hourlyRate: emp.defaultHourlyRate ? emp.defaultHourlyRate / 100 : null,
          }));
        setEmployees(transformedEmployees);
      } else {
        console.log("No employees returned from API");
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignmentDetails();
  }, [assignmentId]);

  const handleOpenReassignModal = () => {
    setShowReassignModal(true);
    fetchEmployees();
  };

  const handleOpenAddEmployeeModal = () => {
    setShowAddEmployeeModal(true);
    fetchEmployees();
  };

  const handleReassign = async (newEmployee) => {
    setActionLoading(true);
    try {
      const result = await BusinessOwnerService.reassignJob(
        state.currentUser.token,
        assignment.id,
        newEmployee.id
      );

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
      const appointment = assignment?.appointment;
      const result = await BusinessOwnerService.assignEmployee(
        state.currentUser.token,
        {
          appointmentId: appointment?.id,
          employeeId: employee.id,
          payAmount: payAmount * 100, // Convert to cents
          payType: "flat",
        }
      );

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

  const handleUnassign = async () => {
    Alert.alert(
      "Remove Assignment",
      "Are you sure you want to remove this employee from the job?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              const result = await BusinessOwnerService.unassignJob(
                state.currentUser.token,
                assignment.id
              );
              if (result.message) {
                Alert.alert("Success", "Assignment removed");
                navigate(-1);
              } else {
                Alert.alert("Error", result.error || "Failed to remove assignment");
              }
            } catch (err) {
              Alert.alert("Error", "Failed to remove assignment");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const openMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
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
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading assignment details...</Text>
      </View>
    );
  }

  if (error || !assignment) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || "Assignment not found"}</Text>
        <Pressable style={styles.retryButton} onPress={() => navigate(-1)}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.assigned;
  const appointment = assignment.appointment || {};
  const home = appointment.home || {};
  const client = home.user || {};
  const employee = assignment.employee || {};

  // Check if job is today
  const isToday = appointment.date && new Date(appointment.date).toDateString() === new Date().toDateString();

  // Get existing employee IDs for this job
  const existingEmployeeIds = allAssignments.map((a) => a.businessEmployeeId).filter(Boolean);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Assignment Details</Text>
        <Pressable
          style={styles.calendarButton}
          onPress={() => navigate("/business-owner/calendar")}
        >
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
          <Icon name={statusConfig.icon} size={20} color={statusConfig.text} />
          <Text style={[styles.statusText, { color: statusConfig.text }]}>
            {statusConfig.label}
          </Text>
          {isToday && assignment.status === "assigned" && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
        </View>

        {/* Date & Time Card */}
        <View style={styles.card}>
          <View style={styles.dateTimeHeader}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeDay}>
                {appointment.date ? new Date(appointment.date).getDate() : "-"}
              </Text>
              <Text style={styles.dateBadgeMonth}>
                {appointment.date
                  ? new Date(appointment.date).toLocaleDateString("en-US", { month: "short" })
                  : "-"}
              </Text>
            </View>
            <View style={styles.dateTimeInfo}>
              <Text style={styles.dateText}>
                {appointment.date ? formatDate(appointment.date) : "Date not set"}
              </Text>
              <Text style={styles.timeText}>
                {appointment.startTime ? formatTime(appointment.startTime) : "Time not set"}
                {appointment.duration ? ` - ${appointment.duration} hours` : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Assigned Employee Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Assigned Employee</Text>
            {assignment.status === "assigned" && (
              <Pressable
                style={styles.changeButton}
                onPress={handleOpenReassignModal}
              >
                <Icon name="exchange" size={14} color={colors.primary[600]} />
                <Text style={styles.changeButtonText}>Change</Text>
              </Pressable>
            )}
          </View>
          {assignment.isSelfAssignment ? (
            <View style={styles.selfAssignBadge}>
              <Icon name="user" size={16} color={colors.primary[600]} />
              <Text style={styles.selfAssignText}>Self-Assigned (You)</Text>
            </View>
          ) : employee.firstName ? (
            <>
              <InfoRow
                icon="user"
                label="Name"
                value={`${employee.firstName} ${employee.lastName || ""}`}
              />
              {employee.phone && (
                <InfoRow
                  icon="phone"
                  label="Phone"
                  value={employee.phone}
                  onPress={() => Linking.openURL(`tel:${employee.phone}`)}
                  isLink
                />
              )}
              {employee.email && (
                <InfoRow
                  icon="envelope"
                  label="Email"
                  value={employee.email}
                  onPress={() => Linking.openURL(`mailto:${employee.email}`)}
                  isLink
                />
              )}
            </>
          ) : (
            <Text style={styles.noDataText}>Employee info not available</Text>
          )}
        </View>

        {/* Add More Employees Button */}
        {assignment.status === "assigned" && (
          <Pressable
            style={styles.addEmployeeCard}
            onPress={handleOpenAddEmployeeModal}
          >
            <View style={styles.addEmployeeIcon}>
              <Icon name="user-plus" size={20} color={colors.primary[600]} />
            </View>
            <View style={styles.addEmployeeContent}>
              <Text style={styles.addEmployeeTitle}>Add Another Employee</Text>
              <Text style={styles.addEmployeeSubtitle}>
                Assign additional team members to this job
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={colors.neutral[400]} />
          </Pressable>
        )}

        {/* Pay Card */}
        {assignment.payAmount !== undefined && (
          <View style={styles.payCard}>
            <View style={styles.payCardContent}>
              <Text style={styles.payLabel}>Employee Pay</Text>
              <Text style={styles.payAmount}>
                ${(assignment.payAmount / 100).toFixed(2)}
              </Text>
              {assignment.payType && (
                <Text style={styles.payType}>{assignment.payType}</Text>
              )}
            </View>
            <View style={styles.payStatusBadge}>
              <Text style={styles.payStatusText}>
                {assignment.payoutStatus === "paid" ? "Paid" : "Pending"}
              </Text>
            </View>
          </View>
        )}

        {/* Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          {home.address ? (
            <InfoRow
              icon="map-marker"
              label="Address"
              value={home.address}
              onPress={() => openMaps(home.address)}
              isLink
            />
          ) : (
            <Text style={styles.noDataText}>Address not available</Text>
          )}
          {home.numBeds && (
            <InfoRow
              icon="home"
              label="Home Size"
              value={`${home.numBeds} bedroom, ${home.numBaths} bathroom`}
            />
          )}
          {home.keyPadCode && (
            <InfoRow icon="key" label="Keypad Code" value={home.keyPadCode} />
          )}
          {home.keyLocation && (
            <InfoRow icon="key" label="Key Location" value={home.keyLocation} />
          )}
          {home.specialNotes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Special Instructions</Text>
              <Text style={styles.notesText}>{home.specialNotes}</Text>
            </View>
          )}
        </View>

        {/* Client Card */}
        {client.firstName && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Client</Text>
            <InfoRow
              icon="user"
              label="Name"
              value={`${client.firstName} ${client.lastName || ""}`}
            />
            {client.phone && (
              <InfoRow
                icon="phone"
                label="Phone"
                value={client.phone}
                onPress={() => Linking.openURL(`tel:${client.phone}`)}
                isLink
              />
            )}
            {client.email && (
              <InfoRow
                icon="envelope"
                label="Email"
                value={client.email}
                onPress={() => Linking.openURL(`mailto:${client.email}`)}
                isLink
              />
            )}
          </View>
        )}

        {/* Job Price Card */}
        {appointment.price && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Job Details</Text>
            <InfoRow
              icon="money"
              label="Job Price"
              value={`$${parseFloat(appointment.price).toFixed(2)}`}
            />
            {assignment.payAmount !== undefined && (
              <InfoRow
                icon="calculator"
                label="Your Profit"
                value={`$${(parseFloat(appointment.price) - assignment.payAmount / 100).toFixed(2)}`}
              />
            )}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Buttons */}
      {assignment.status === "assigned" && (
        <View style={styles.actionBar}>
          <Pressable
            style={[styles.unassignButton, actionLoading && styles.buttonDisabled]}
            onPress={handleUnassign}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={colors.error[600]} />
            ) : (
              <>
                <Icon name="times" size={18} color={colors.error[600]} />
                <Text style={styles.unassignButtonText}>Remove from Job</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Reassign Modal */}
      <EmployeeSelectionModal
        visible={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        employees={employees}
        loading={employeesLoading}
        onSelect={handleReassign}
        title="Reassign Job To"
        currentEmployeeId={employee?.id}
        isSubmitting={actionLoading}
      />

      {/* Add Employee Modal */}
      <AddEmployeeModal
        visible={showAddEmployeeModal}
        onClose={() => setShowAddEmployeeModal(false)}
        employees={employees}
        loading={employeesLoading}
        onSubmit={handleAddEmployee}
        isSubmitting={actionLoading}
        existingEmployeeIds={existingEmployeeIds}
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorTitle: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  errorText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  statusText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  todayBadge: {
    marginLeft: spacing.md,
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  todayBadgeText: {
    color: "#fff",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  card: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  changeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  changeButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  dateTimeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  dateBadgeDay: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  dateBadgeMonth: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    textTransform: "uppercase",
  },
  dateTimeInfo: {
    marginLeft: spacing.lg,
  },
  dateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  selfAssignBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  selfAssignText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  addEmployeeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
  },
  addEmployeeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  addEmployeeContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  addEmployeeTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  addEmployeeSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  payCardContent: {},
  payLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  payAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  payType: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    textTransform: "capitalize",
  },
  payStatusBadge: {
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  payStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginTop: 2,
  },
  infoValueLink: {
    color: colors.primary[600],
  },
  noDataText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  notesSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[400],
  },
  notesLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
  },
  bottomPadding: {
    height: 100,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.lg,
  },
  unassignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  unassignButtonText: {
    marginLeft: spacing.sm,
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.7,
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
    maxHeight: "80%",
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
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
  modalLoading: {
    padding: spacing.xl,
    alignItems: "center",
  },
  modalLoadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  modalEmpty: {
    padding: spacing.xl,
    alignItems: "center",
  },
  modalEmptyText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    textAlign: "center",
  },
  employeeList: {
    maxHeight: 400,
  },
  employeeListCompact: {
    maxHeight: 200,
    marginHorizontal: spacing.lg,
  },
  employeeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  employeeItemCurrent: {
    backgroundColor: colors.neutral[50],
  },
  employeeItemCompact: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
  },
  employeeItemSelected: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarCurrent: {
    backgroundColor: colors.primary[100],
  },
  employeeAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarSelected: {
    backgroundColor: colors.primary[200],
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  employeeAvatarTextCurrent: {
    color: colors.primary[700],
  },
  employeeAvatarTextSmall: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  employeeAvatarTextSelected: {
    color: colors.primary[700],
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  currentBadge: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    color: colors.primary[600],
  },
  employeeRate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  unavailableText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  payInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
  },
  payInputPrefix: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
  },
  payInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    paddingVertical: spacing.md,
    marginLeft: spacing.xs,
  },
  payHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  submitButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: "#fff",
  },
});

export default AssignmentDetail;
