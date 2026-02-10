import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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

// Status badge colors
const STATUS_COLORS = {
  pending_invite: { bg: colors.warning[100], text: colors.warning[700], icon: "clock-o" },
  active: { bg: colors.success[100], text: colors.success[700], icon: "check-circle" },
  inactive: { bg: colors.neutral[200], text: colors.neutral[600], icon: "pause-circle" },
  terminated: { bg: colors.error[100], text: colors.error[700], icon: "times-circle" },
};

// Pay type labels
const PAY_TYPE_LABELS = {
  hourly: "Hourly Rate",
  per_job: "Per Job",
  percentage: "Percentage",
};

// Employee Card Component
const EmployeeCard = ({ employee, onEdit, onTerminate, onResendInvite, onReactivate, onQuickEdit }) => {
  const statusColors = STATUS_COLORS[employee.status] || STATUS_COLORS.inactive;

  const formatPayInfo = () => {
    if (employee.payType === "hourly" && employee.defaultHourlyRate) {
      return `$${(employee.defaultHourlyRate / 100).toFixed(2)}/hr`;
    } else if (employee.payType === "per_job" && employee.defaultJobRate) {
      return `$${(employee.defaultJobRate / 100).toFixed(2)}/job`;
    } else if (employee.payType === "percentage" && employee.payRate) {
      return `${employee.payRate}%`;
    }
    return "Not set";
  };

  return (
    <Pressable style={styles.employeeCard} onPress={() => onQuickEdit(employee)}>
      {/* Header Row */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.avatarText, { color: statusColors.text }]}>
              {(employee.firstName?.[0] || "E").toUpperCase()}
              {(employee.lastName?.[0] || "").toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
        </View>

        <View style={styles.employeeMainInfo}>
          <Text style={styles.employeeName}>
            {employee.firstName} {employee.lastName}
          </Text>
          <Text style={styles.employeeEmail}>{employee.email}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Icon name={statusColors.icon} size={10} color={statusColors.text} />
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {employee.status === "pending_invite" ? "Pending" : employee.status}
          </Text>
        </View>
      </View>

      {/* Pay Info Row */}
      <View style={styles.payInfoRow}>
        <View style={styles.payInfoItem}>
          <Icon name="dollar" size={14} color={colors.success[600]} />
          <Text style={styles.payInfoLabel}>Pay:</Text>
          <Text style={styles.payInfoValue}>{formatPayInfo()}</Text>
        </View>
        {employee.payType && (
          <View style={styles.payTypeBadge}>
            <Text style={styles.payTypeBadgeText}>
              {PAY_TYPE_LABELS[employee.payType] || employee.payType}
            </Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      {employee.status === "active" && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="briefcase" size={16} color={colors.primary[500]} />
            <Text style={styles.statValue}>{employee.totalJobs || 0}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="star" size={16} color={colors.warning[500]} />
            <Text style={styles.statValue}>{employee.rating || "N/A"}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="calendar-check-o" size={16} color={colors.success[500]} />
            <Text style={styles.statValue}>{employee.completedJobs || 0}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {employee.status === "pending_invite" && (
          <Pressable
            style={styles.actionBtn}
            onPress={(e) => { e.stopPropagation(); onResendInvite(employee); }}
          >
            <Icon name="paper-plane" size={14} color={colors.primary[600]} />
            <Text style={styles.actionBtnText}>Resend Invite</Text>
          </Pressable>
        )}
        {employee.status === "terminated" ? (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnSuccess]}
            onPress={(e) => { e.stopPropagation(); onReactivate(employee); }}
          >
            <Icon name="refresh" size={14} color={colors.success[600]} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextSuccess]}>Reactivate</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation(); onEdit(employee); }}
            >
              <Icon name="cog" size={14} color={colors.primary[600]} />
              <Text style={styles.actionBtnText}>Settings</Text>
            </Pressable>
            {employee.status !== "pending_invite" && (
              <Pressable
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={(e) => { e.stopPropagation(); onTerminate(employee); }}
              >
                <Icon name="user-times" size={14} color={colors.error[600]} />
                <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Remove</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
};

// Quick Edit Modal - for editing pay settings directly
const QuickEditModal = ({ visible, employee, onClose, onSave, isSubmitting }) => {
  const [payType, setPayType] = useState("hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [jobRate, setJobRate] = useState("");
  const [percentageRate, setPercentageRate] = useState("");

  useEffect(() => {
    if (employee) {
      setPayType(employee.payType || "hourly");
      setHourlyRate(employee.defaultHourlyRate ? (employee.defaultHourlyRate / 100).toString() : "");
      setJobRate(employee.defaultJobRate ? (employee.defaultJobRate / 100).toString() : "");
      setPercentageRate(employee.payRate ? employee.payRate.toString() : "");
    }
  }, [employee]);

  const handleSave = () => {
    const data = {
      payType,
      defaultHourlyRate: payType === "hourly" ? Math.round(parseFloat(hourlyRate || 0) * 100) : null,
      defaultJobRate: payType === "per_job" ? Math.round(parseFloat(jobRate || 0) * 100) : null,
      payRate: payType === "percentage" ? parseFloat(percentageRate || 0) : null,
    };
    onSave(employee.id, data);
  };

  if (!employee) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.quickEditModal}>
          {/* Header */}
          <View style={styles.quickEditHeader}>
            <View style={styles.quickEditAvatar}>
              <Text style={styles.quickEditAvatarText}>
                {(employee.firstName?.[0] || "").toUpperCase()}
                {(employee.lastName?.[0] || "").toUpperCase()}
              </Text>
            </View>
            <View style={styles.quickEditInfo}>
              <Text style={styles.quickEditName}>
                {employee.firstName} {employee.lastName}
              </Text>
              <Text style={styles.quickEditEmail}>{employee.email}</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Icon name="times" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>

          {/* Pay Type Selection */}
          <View style={styles.sectionHeader}>
            <Icon name="dollar" size={16} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>Payment Settings</Text>
          </View>

          <View style={styles.payTypeSelector}>
            <Pressable
              style={[styles.payTypeOption, payType === "hourly" && styles.payTypeOptionActive]}
              onPress={() => setPayType("hourly")}
            >
              <Icon
                name="clock-o"
                size={20}
                color={payType === "hourly" ? colors.primary[600] : colors.neutral[400]}
              />
              <Text style={[styles.payTypeLabel, payType === "hourly" && styles.payTypeLabelActive]}>
                Hourly
              </Text>
              <Text style={styles.payTypeDesc}>Pay per hour worked</Text>
            </Pressable>

            <Pressable
              style={[styles.payTypeOption, payType === "per_job" && styles.payTypeOptionActive]}
              onPress={() => setPayType("per_job")}
            >
              <Icon
                name="briefcase"
                size={20}
                color={payType === "per_job" ? colors.primary[600] : colors.neutral[400]}
              />
              <Text style={[styles.payTypeLabel, payType === "per_job" && styles.payTypeLabelActive]}>
                Per Job
              </Text>
              <Text style={styles.payTypeDesc}>Fixed rate per job</Text>
            </Pressable>

            <Pressable
              style={[styles.payTypeOption, payType === "percentage" && styles.payTypeOptionActive]}
              onPress={() => setPayType("percentage")}
            >
              <Icon
                name="percent"
                size={18}
                color={payType === "percentage" ? colors.primary[600] : colors.neutral[400]}
              />
              <Text style={[styles.payTypeLabel, payType === "percentage" && styles.payTypeLabelActive]}>
                Percentage
              </Text>
              <Text style={styles.payTypeDesc}>% of job price</Text>
            </Pressable>
          </View>

          {/* Rate Input */}
          <View style={styles.rateInputSection}>
            {payType === "hourly" && (
              <View style={styles.rateInputGroup}>
                <Text style={styles.rateLabel}>Hourly Rate</Text>
                <View style={styles.rateInputWrapper}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.neutral[400]}
                  />
                  <Text style={styles.rateSuffix}>/hour</Text>
                </View>
                <Text style={styles.rateHint}>
                  Employee will be paid this rate for each hour worked
                </Text>
              </View>
            )}

            {payType === "per_job" && (
              <View style={styles.rateInputGroup}>
                <Text style={styles.rateLabel}>Rate Per Job</Text>
                <View style={styles.rateInputWrapper}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={jobRate}
                    onChangeText={setJobRate}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.neutral[400]}
                  />
                  <Text style={styles.rateSuffix}>/job</Text>
                </View>
                <Text style={styles.rateHint}>
                  Employee will be paid this fixed amount per job completed
                </Text>
              </View>
            )}

            {payType === "percentage" && (
              <View style={styles.rateInputGroup}>
                <Text style={styles.rateLabel}>Percentage of Job</Text>
                <View style={styles.rateInputWrapper}>
                  <TextInput
                    style={styles.rateInput}
                    value={percentageRate}
                    onChangeText={setPercentageRate}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.neutral[400]}
                  />
                  <Text style={styles.rateSuffix}>%</Text>
                </View>
                <Text style={styles.rateHint}>
                  Employee will receive this percentage of the job's total price
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.quickEditFooter}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Invite Modal Component
const InviteEmployeeModal = ({ visible, onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    payType: "hourly",
    hourlyRate: "",
    jobRate: "",
    percentageRate: "",
  });
  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = "First name is required";
    if (!formData.lastName.trim()) errors.lastName = "Last name is required";
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const data = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        payType: formData.payType,
        defaultHourlyRate: formData.payType === "hourly"
          ? Math.round(parseFloat(formData.hourlyRate || 0) * 100)
          : null,
        defaultJobRate: formData.payType === "per_job"
          ? Math.round(parseFloat(formData.jobRate || 0) * 100)
          : null,
        payRate: formData.payType === "percentage"
          ? parseFloat(formData.percentageRate || 0)
          : null,
      };
      onSubmit(data);
    }
  };

  const handleClose = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      payType: "hourly",
      hourlyRate: "",
      jobRate: "",
      percentageRate: "",
    });
    setFormErrors({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.inviteModal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add New Employee</Text>
              <Text style={styles.modalSubtitle}>They'll receive an invite email</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <Icon name="times" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Basic Info Section */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Icon name="user" size={16} color={colors.primary[600]} />
                <Text style={styles.sectionTitle}>Basic Information</Text>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={styles.label}>First Name *</Text>
                  <TextInput
                    style={[styles.input, formErrors.firstName && styles.inputError]}
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                    placeholder="John"
                    placeholderTextColor={colors.neutral[400]}
                  />
                  {formErrors.firstName && (
                    <Text style={styles.errorText}>{formErrors.firstName}</Text>
                  )}
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Last Name *</Text>
                  <TextInput
                    style={[styles.input, formErrors.lastName && styles.inputError]}
                    value={formData.lastName}
                    onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                    placeholder="Doe"
                    placeholderTextColor={colors.neutral[400]}
                  />
                  {formErrors.lastName && (
                    <Text style={styles.errorText}>{formErrors.lastName}</Text>
                  )}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={styles.inputWithIcon}>
                  <Icon name="envelope" size={16} color={colors.neutral[400]} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputIconed, formErrors.email && styles.inputError]}
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    placeholder="john@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={colors.neutral[400]}
                  />
                </View>
                {formErrors.email && (
                  <Text style={styles.errorText}>{formErrors.email}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.inputWithIcon}>
                  <Icon name="phone" size={16} color={colors.neutral[400]} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputIconed}
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                    placeholder="(555) 123-4567"
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.neutral[400]}
                  />
                </View>
              </View>
            </View>

            {/* Pay Settings Section */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Icon name="dollar" size={16} color={colors.primary[600]} />
                <Text style={styles.sectionTitle}>Payment Settings</Text>
              </View>

              <Text style={styles.payTypeQuestion}>How do you want to pay this employee?</Text>

              <View style={styles.payTypeGrid}>
                <Pressable
                  style={[styles.payTypeCard, formData.payType === "hourly" && styles.payTypeCardActive]}
                  onPress={() => setFormData({ ...formData, payType: "hourly" })}
                >
                  <View style={[styles.payTypeIcon, formData.payType === "hourly" && styles.payTypeIconActive]}>
                    <Icon name="clock-o" size={24} color={formData.payType === "hourly" ? colors.primary[600] : colors.neutral[400]} />
                  </View>
                  <Text style={[styles.payTypeCardTitle, formData.payType === "hourly" && styles.payTypeCardTitleActive]}>
                    Hourly
                  </Text>
                  <Text style={styles.payTypeCardDesc}>Per hour worked</Text>
                </Pressable>

                <Pressable
                  style={[styles.payTypeCard, formData.payType === "per_job" && styles.payTypeCardActive]}
                  onPress={() => setFormData({ ...formData, payType: "per_job" })}
                >
                  <View style={[styles.payTypeIcon, formData.payType === "per_job" && styles.payTypeIconActive]}>
                    <Icon name="briefcase" size={24} color={formData.payType === "per_job" ? colors.primary[600] : colors.neutral[400]} />
                  </View>
                  <Text style={[styles.payTypeCardTitle, formData.payType === "per_job" && styles.payTypeCardTitleActive]}>
                    Per Job
                  </Text>
                  <Text style={styles.payTypeCardDesc}>Fixed per job</Text>
                </Pressable>

                <Pressable
                  style={[styles.payTypeCard, formData.payType === "percentage" && styles.payTypeCardActive]}
                  onPress={() => setFormData({ ...formData, payType: "percentage" })}
                >
                  <View style={[styles.payTypeIcon, formData.payType === "percentage" && styles.payTypeIconActive]}>
                    <Icon name="percent" size={20} color={formData.payType === "percentage" ? colors.primary[600] : colors.neutral[400]} />
                  </View>
                  <Text style={[styles.payTypeCardTitle, formData.payType === "percentage" && styles.payTypeCardTitleActive]}>
                    Percentage
                  </Text>
                  <Text style={styles.payTypeCardDesc}>% of job price</Text>
                </Pressable>
              </View>

              {/* Rate Input based on type */}
              <View style={styles.rateInputBox}>
                {formData.payType === "hourly" && (
                  <>
                    <Text style={styles.rateInputLabel}>Hourly Rate</Text>
                    <View style={styles.rateInputContainer}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.rateInputField}
                        value={formData.hourlyRate}
                        onChangeText={(text) => setFormData({ ...formData, hourlyRate: text })}
                        placeholder="25.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.neutral[400]}
                      />
                      <Text style={styles.rateUnit}>/hour</Text>
                    </View>
                  </>
                )}

                {formData.payType === "per_job" && (
                  <>
                    <Text style={styles.rateInputLabel}>Amount Per Job</Text>
                    <View style={styles.rateInputContainer}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.rateInputField}
                        value={formData.jobRate}
                        onChangeText={(text) => setFormData({ ...formData, jobRate: text })}
                        placeholder="75.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.neutral[400]}
                      />
                      <Text style={styles.rateUnit}>/job</Text>
                    </View>
                  </>
                )}

                {formData.payType === "percentage" && (
                  <>
                    <Text style={styles.rateInputLabel}>Percentage of Job Price</Text>
                    <View style={styles.rateInputContainer}>
                      <TextInput
                        style={styles.rateInputField}
                        value={formData.percentageRate}
                        onChangeText={(text) => setFormData({ ...formData, percentageRate: text })}
                        placeholder="70"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.neutral[400]}
                      />
                      <Text style={styles.rateUnit}>%</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="paper-plane" size={16} color="#fff" />
                  <Text style={styles.submitBtnText}>Send Invite</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Terminate Modal Component
const TerminateModal = ({ visible, employee, onClose, onConfirm, isSubmitting }) => {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
  };

  if (!employee) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.terminateModal}>
          <View style={styles.terminateIconContainer}>
            <Icon name="exclamation-triangle" size={32} color={colors.error[500]} />
          </View>
          <Text style={styles.terminateTitle}>Remove Employee</Text>
          <Text style={styles.terminateMessage}>
            Are you sure you want to remove{" "}
            <Text style={styles.terminateEmployeeName}>
              {employee.firstName} {employee.lastName}
            </Text>
            ? They will lose access to all assigned jobs.
          </Text>

          <View style={styles.terminateReasonBox}>
            <Text style={styles.terminateReasonLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.terminateReasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Enter reason..."
              multiline
              numberOfLines={2}
              placeholderTextColor={colors.neutral[400]}
            />
          </View>

          <View style={styles.terminateActions}>
            <Pressable style={styles.terminateCancelBtn} onPress={onClose}>
              <Text style={styles.terminateCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.terminateConfirmBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.terminateConfirmText}>Remove</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
const EmployeeManagement = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter]);

  const fetchEmployees = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await BusinessOwnerService.getEmployees(
        state.currentUser.token,
        statusFilter
      );
      setEmployees(result.employees || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError("Failed to load employees");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchEmployees(true);
  }, [state.currentUser.token, statusFilter]);

  const handleInviteSubmit = async (formData) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await BusinessOwnerService.inviteEmployee(
        state.currentUser.token,
        formData
      );

      if (result.success) {
        setSuccess("Invitation sent successfully!");
        setShowInviteModal(false);
        fetchEmployees();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to send invitation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickEditSave = async (employeeId, data) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await BusinessOwnerService.updateEmployee(
        state.currentUser.token,
        employeeId,
        data
      );

      if (result.success) {
        setSuccess("Employee updated successfully!");
        setShowQuickEditModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to update employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTerminate = async (reason) => {
    if (!selectedEmployee) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await BusinessOwnerService.terminateEmployee(
        state.currentUser.token,
        selectedEmployee.id,
        reason
      );

      if (result.success) {
        setSuccess("Employee removed successfully");
        setShowTerminateModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to remove employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async (employee) => {
    try {
      const result = await BusinessOwnerService.reactivateEmployee(
        state.currentUser.token,
        employee.id
      );

      if (result.success) {
        setSuccess("Employee reactivated successfully");
        fetchEmployees();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to reactivate employee. Please try again.");
    }
  };

  const handleResendInvite = async (employee) => {
    try {
      const result = await BusinessOwnerService.resendInvite(
        state.currentUser.token,
        employee.id
      );

      if (result.success) {
        setSuccess("Invitation resent successfully");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to resend invitation. Please try again.");
    }
  };

  const handleEdit = (employee) => {
    navigate(`/business-owner/employees/${employee.id}/edit`);
  };

  const handleQuickEdit = (employee) => {
    setSelectedEmployee(employee);
    setShowQuickEditModal(true);
  };

  const openTerminateModal = (employee) => {
    setSelectedEmployee(employee);
    setShowTerminateModal(true);
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

  const activeCount = employees.filter((e) => e.status === "active").length;
  const pendingCount = employees.filter((e) => e.status === "pending_invite").length;
  const totalCount = employees.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Top Row - Back button and Add button */}
        <View style={styles.headerTopRow}>
          <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
            <Icon name="arrow-left" size={16} color="#fff" />
          </Pressable>
          <Pressable
            style={styles.addButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Icon name="user-plus" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Title */}
        <Text style={styles.title}>Your Team</Text>

        {/* Stats Row */}
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{activeCount}</Text>
            <Text style={styles.headerStatLabel}>Active</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{pendingCount}</Text>
            <Text style={styles.headerStatLabel}>Pending</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{totalCount}</Text>
            <Text style={styles.headerStatLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { value: null, label: "All", icon: "users" },
            { value: "active", label: "Active", icon: "check-circle" },
            { value: "pending_invite", label: "Pending", icon: "clock-o" },
            { value: "terminated", label: "Removed", icon: "times-circle" },
          ].map((filter) => (
            <Pressable
              key={filter.value || "all"}
              style={[styles.filterPill, statusFilter === filter.value && styles.filterPillActive]}
              onPress={() => setStatusFilter(filter.value)}
            >
              <Icon
                name={filter.icon}
                size={14}
                color={statusFilter === filter.value ? "#fff" : colors.neutral[500]}
              />
              <Text style={[styles.filterPillText, statusFilter === filter.value && styles.filterPillTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Messages */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable onPress={() => setError(null)}>
            <Icon name="times" size={14} color={colors.error[600]} />
          </Pressable>
        </View>
      )}
      {success && (
        <View style={styles.successBanner}>
          <Icon name="check-circle" size={16} color={colors.success[600]} />
          <Text style={styles.successBannerText}>{success}</Text>
          <Pressable onPress={() => setSuccess(null)}>
            <Icon name="times" size={14} color={colors.success[600]} />
          </Pressable>
        </View>
      )}

      {/* Employee List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading team...</Text>
        </View>
      ) : employees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Icon name="users" size={48} color={colors.primary[300]} />
          </View>
          <Text style={styles.emptyTitle}>No Team Members Yet</Text>
          <Text style={styles.emptyText}>
            Invite your first team member to start assigning jobs and growing your business
          </Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Icon name="user-plus" size={18} color="#fff" />
            <Text style={styles.emptyButtonText}>Invite Employee</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onEdit={handleEdit}
              onTerminate={openTerminateModal}
              onResendInvite={handleResendInvite}
              onReactivate={handleReactivate}
              onQuickEdit={handleQuickEdit}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Modals */}
      <InviteEmployeeModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleInviteSubmit}
        isSubmitting={isSubmitting}
      />

      {showQuickEditModal && selectedEmployee && (
        <QuickEditModal
          visible={true}
          employee={selectedEmployee}
          onClose={() => {
            setShowQuickEditModal(false);
            setSelectedEmployee(null);
          }}
          onSave={handleQuickEditSave}
          isSubmitting={isSubmitting}
        />
      )}

      {showTerminateModal && selectedEmployee && (
        <TerminateModal
          visible={true}
          employee={selectedEmployee}
          onClose={() => {
            setShowTerminateModal(false);
            setSelectedEmployee(null);
          }}
          onConfirm={handleTerminate}
          isSubmitting={isSubmitting}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["4xl"],
    paddingBottom: spacing.xl,
    backgroundColor: colors.primary[600],
    borderBottomLeftRadius: radius["2xl"],
    borderBottomRightRadius: radius["2xl"],
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    marginBottom: spacing.md,
    letterSpacing: -0.5,
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: radius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
  },
  headerStat: {
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  headerStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  headerStatLabel: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: spacing.xs,
  },
  addButtonIcon: {
    color: colors.primary[600],
  },
  filterContainer: {
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.lg,
    marginTop: -spacing.lg,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[50],
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterPillActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  filterPillText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[500],
    marginLeft: spacing.sm,
  },
  filterPillTextActive: {
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  employeeCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  employeeMainInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  employeeEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: 6,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  payInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  payInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  payInfoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginLeft: spacing.sm,
  },
  payInfoValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
    marginLeft: spacing.xs,
  },
  payTypeBadge: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  payTypeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.default,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  actionBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  actionBtnSuccess: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[100],
  },
  actionBtnTextSuccess: {
    color: colors.success[600],
  },
  actionBtnDanger: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[100],
  },
  actionBtnTextDanger: {
    color: colors.error[600],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: spacing["4xl"],
  },
  loadingText: {
    marginTop: spacing.lg,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["3xl"],
    paddingBottom: spacing["4xl"],
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    borderWidth: 3,
    borderColor: colors.primary[100],
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
    marginTop: spacing["2xl"],
    gap: spacing.sm,
    ...shadows.lg,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[100],
    ...shadows.sm,
  },
  errorBannerText: {
    flex: 1,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[100],
    ...shadows.sm,
  },
  successBannerText: {
    flex: 1,
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  inviteModal: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    maxHeight: "90%",
    ...shadows.xl,
  },
  quickEditModal: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    maxHeight: "80%",
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
    backgroundColor: colors.neutral[50],
  },
  formSection: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  formRow: {
    flexDirection: "row",
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: radius.xl,
  },
  inputIcon: {
    marginLeft: spacing.lg,
  },
  inputIconed: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.error[500],
    backgroundColor: colors.error[50],
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },
  payTypeQuestion: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  payTypeGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  payTypeCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  payTypeCardActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  payTypeIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  payTypeIconActive: {
    backgroundColor: colors.primary[100],
  },
  payTypeCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  payTypeCardTitleActive: {
    color: colors.primary[700],
  },
  payTypeCardDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: "center",
  },
  rateInputBox: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    backgroundColor: colors.neutral[50],
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  rateInputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rateInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary[200],
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  currencySymbol: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  rateInputField: {
    flex: 1,
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    paddingVertical: spacing.lg,
    marginLeft: spacing.xs,
  },
  rateUnit: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cancelBtnText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    gap: spacing.sm,
    ...shadows.md,
  },
  submitBtnDisabled: {
    backgroundColor: colors.primary[300],
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  // Quick Edit Modal
  quickEditHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.primary[50],
  },
  quickEditAvatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    justifyContent: "center",
    alignItems: "center",
    ...shadows.md,
  },
  quickEditAvatarText: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  quickEditInfo: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  quickEditName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  quickEditEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  payTypeSelector: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
  },
  payTypeOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  payTypeOptionActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  payTypeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  payTypeLabelActive: {
    color: colors.primary[700],
  },
  payTypeDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: 4,
  },
  rateInputSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  rateInputGroup: {
    padding: spacing.xl,
    backgroundColor: colors.neutral[50],
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  rateLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rateInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary[200],
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  currencyPrefix: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  rateInput: {
    flex: 1,
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    paddingVertical: spacing.lg,
    marginLeft: spacing.xs,
  },
  rateSuffix: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },
  rateHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  quickEditFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
    backgroundColor: colors.neutral[50],
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    gap: spacing.sm,
    ...shadows.md,
  },
  saveBtnDisabled: {
    backgroundColor: colors.primary[300],
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  // Terminate Modal
  terminateModal: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    borderRadius: radius["3xl"],
    padding: spacing["2xl"],
    alignItems: "center",
    position: "absolute",
    top: "25%",
    left: 0,
    right: 0,
    ...shadows.xl,
  },
  terminateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.error[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    borderWidth: 3,
    borderColor: colors.error[100],
  },
  terminateTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    letterSpacing: -0.5,
  },
  terminateMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
  },
  terminateEmployeeName: {
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
  },
  terminateReasonBox: {
    width: "100%",
    marginTop: spacing.xl,
  },
  terminateReasonLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  terminateReasonInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    textAlignVertical: "top",
    minHeight: 80,
  },
  terminateActions: {
    flexDirection: "row",
    marginTop: spacing["2xl"],
    gap: spacing.md,
    width: "100%",
  },
  terminateCancelBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  terminateCancelText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  terminateConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.error[600],
    alignItems: "center",
    ...shadows.md,
  },
  terminateConfirmText: {
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
});

export default EmployeeManagement;
