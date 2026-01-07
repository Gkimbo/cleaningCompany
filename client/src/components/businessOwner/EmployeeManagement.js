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
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Status badge colors
const STATUS_COLORS = {
  pending_invite: { bg: colors.warning[100], text: colors.warning[700] },
  active: { bg: colors.success[100], text: colors.success[700] },
  inactive: { bg: colors.neutral[200], text: colors.neutral[600] },
  terminated: { bg: colors.error[100], text: colors.error[700] },
};

// Payment method labels
const PAYMENT_METHODS = {
  stripe_connect: "Stripe Connect",
  direct_payment: "Direct Payment",
};

// Employee Card Component
const EmployeeCard = ({ employee, onEdit, onTerminate, onResendInvite, onReactivate }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const statusColors = STATUS_COLORS[employee.status] || STATUS_COLORS.inactive;

  return (
    <View style={styles.employeeCard}>
      <View style={styles.employeeHeader}>
        <View style={styles.employeeAvatar}>
          <Text style={styles.employeeAvatarText}>
            {(employee.firstName?.[0] || "E").toUpperCase()}
          </Text>
        </View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>
            {employee.firstName} {employee.lastName}
          </Text>
          <Text style={styles.employeeEmail}>{employee.email}</Text>
          {employee.phone && (
            <Text style={styles.employeePhone}>{employee.phone}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {employee.status.replace("_", " ")}
          </Text>
        </View>
      </View>

      <View style={styles.employeeDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payment:</Text>
          <Text style={styles.detailValue}>
            {PAYMENT_METHODS[employee.paymentMethod] || employee.paymentMethod}
          </Text>
        </View>
        {employee.defaultHourlyRate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Default Rate:</Text>
            <Text style={styles.detailValue}>
              ${(employee.defaultHourlyRate / 100).toFixed(2)}/hr
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>
            {employee.status === "pending_invite" ? "Invited:" : "Added:"}
          </Text>
          <Text style={styles.detailValue}>
            {formatDate(employee.invitedAt || employee.createdAt)}
          </Text>
        </View>
      </View>

      <View style={styles.employeeActions}>
        {employee.status === "pending_invite" && (
          <Pressable
            style={[styles.actionButton, styles.resendButton]}
            onPress={() => onResendInvite(employee)}
          >
            <Icon name="envelope" size={14} color={colors.primary[600]} />
            <Text style={styles.resendButtonText}>Resend</Text>
          </Pressable>
        )}
        {employee.status === "terminated" ? (
          <Pressable
            style={[styles.actionButton, styles.reactivateButton]}
            onPress={() => onReactivate(employee)}
          >
            <Icon name="refresh" size={14} color={colors.success[600]} />
            <Text style={styles.reactivateButtonText}>Reactivate</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.actionButton, styles.editButton]}
              onPress={() => onEdit(employee)}
            >
              <Icon name="pencil" size={14} color={colors.primary[600]} />
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.terminateButton]}
              onPress={() => onTerminate(employee)}
            >
              <Icon name="user-times" size={14} color={colors.error[600]} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};

// Invite Modal Component
const InviteEmployeeModal = ({ visible, onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    defaultHourlyRate: "",
    paymentMethod: "direct_payment",
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
        ...formData,
        defaultHourlyRate: formData.defaultHourlyRate
          ? Math.round(parseFloat(formData.defaultHourlyRate) * 100)
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
      defaultHourlyRate: "",
      paymentMethod: "direct_payment",
    });
    setFormErrors({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Employee</Text>
            <Pressable onPress={handleClose}>
              <Icon name="times" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={[styles.input, formErrors.firstName && styles.inputError]}
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                placeholder="John"
              />
              {formErrors.firstName && (
                <Text style={styles.errorText}>{formErrors.firstName}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={[styles.input, formErrors.lastName && styles.inputError]}
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                placeholder="Doe"
              />
              {formErrors.lastName && (
                <Text style={styles.errorText}>{formErrors.lastName}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={[styles.input, formErrors.email && styles.inputError]}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {formErrors.email && (
                <Text style={styles.errorText}>{formErrors.email}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone (optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Default Hourly Rate (optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.defaultHourlyRate}
                onChangeText={(text) => setFormData({ ...formData, defaultHourlyRate: text })}
                placeholder="25.00"
                keyboardType="decimal-pad"
              />
              <Text style={styles.helperText}>
                You can set a different rate per job when assigning
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Payment Method</Text>
              <View style={styles.paymentOptions}>
                <Pressable
                  style={[
                    styles.paymentOption,
                    formData.paymentMethod === "direct_payment" && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, paymentMethod: "direct_payment" })}
                >
                  <Icon
                    name="money"
                    size={16}
                    color={formData.paymentMethod === "direct_payment" ? colors.primary[600] : colors.neutral[500]}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      formData.paymentMethod === "direct_payment" && styles.paymentOptionTextSelected,
                    ]}
                  >
                    Direct Payment
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.paymentOption,
                    formData.paymentMethod === "stripe_connect" && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, paymentMethod: "stripe_connect" })}
                >
                  <Icon
                    name="credit-card"
                    size={16}
                    color={formData.paymentMethod === "stripe_connect" ? colors.primary[600] : colors.neutral[500]}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      formData.paymentMethod === "stripe_connect" && styles.paymentOptionTextSelected,
                    ]}
                  >
                    Stripe Connect
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Send Invitation</Text>
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

  const handleClose = () => {
    setReason("");
    onClose();
  };

  if (!employee) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.terminateModalContent]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terminate Employee</Text>
            <Pressable onPress={handleClose}>
              <Icon name="times" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.terminateWarning}>
              Are you sure you want to terminate{" "}
              <Text style={styles.terminateName}>
                {employee.firstName} {employee.lastName}
              </Text>
              ?
            </Text>
            <Text style={styles.terminateInfo}>
              They will no longer have access to assigned jobs. This can be undone later.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Reason (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                placeholder="Enter reason for termination..."
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.terminateConfirmButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.terminateConfirmText}>Terminate</Text>
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
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter]);

  const fetchEmployees = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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

  const handleTerminate = async (reason) => {
    if (!selectedEmployee) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await BusinessOwnerService.terminateEmployee(
        state.currentUser.token,
        selectedEmployee.id,
        reason
      );

      if (result.success) {
        setSuccess("Employee terminated successfully");
        setShowTerminateModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to terminate employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async (employee) => {
    setError(null);
    setSuccess(null);

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
    setError(null);
    setSuccess(null);

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

  const openTerminateModal = (employee) => {
    setSelectedEmployee(employee);
    setShowTerminateModal(true);
  };

  // Clear success/error messages after 5 seconds
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Employees</Text>
          <Text style={styles.subtitle}>
            {activeCount} active, {pendingCount} pending
          </Text>
        </View>
        <Pressable
          style={styles.inviteButton}
          onPress={() => setShowInviteModal(true)}
        >
          <Icon name="plus" size={16} color="#fff" />
          <Text style={styles.inviteButtonText}>Invite</Text>
        </Pressable>
      </View>

      {/* Status Filters */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { value: null, label: "All" },
            { value: "active", label: "Active" },
            { value: "pending_invite", label: "Pending" },
            { value: "inactive", label: "Inactive" },
            { value: "terminated", label: "Terminated" },
          ].map((filter) => (
            <Pressable
              key={filter.value || "all"}
              style={[
                styles.filterChip,
                statusFilter === filter.value && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === filter.value && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
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

      {/* Employee List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading employees...</Text>
        </View>
      ) : employees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="users" size={48} color={colors.neutral[300]} />
          <Text style={styles.emptyTitle}>No Employees Yet</Text>
          <Text style={styles.emptyText}>
            Invite your first employee to get started
          </Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Icon name="plus" size={16} color="#fff" />
            <Text style={styles.emptyButtonText}>Invite Employee</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
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
            />
          ))}
        </ScrollView>
      )}

      {/* Modals */}
      <InviteEmployeeModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleInviteSubmit}
        isSubmitting={isSubmitting}
      />

      <TerminateModal
        visible={showTerminateModal}
        employee={selectedEmployee}
        onClose={() => {
          setShowTerminateModal(false);
          setSelectedEmployee(null);
        }}
        onConfirm={handleTerminate}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...shadows.md,
  },
  inviteButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  filterChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  employeeCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  employeeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  employeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  employeeEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeePhone: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
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
  employeeDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  employeeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  editButton: {
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  terminateButton: {
    borderColor: colors.error[200],
    backgroundColor: colors.error[50],
  },
  resendButton: {
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  resendButtonText: {
    marginLeft: spacing.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  reactivateButton: {
    borderColor: colors.success[200],
    backgroundColor: colors.success[50],
  },
  reactivateButtonText: {
    marginLeft: spacing.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["3xl"],
  },
  emptyTitle: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.xl,
    ...shadows.md,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
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
  terminateModalContent: {
    justifyContent: "center",
    maxHeight: "50%",
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
  formGroup: {
    marginBottom: spacing.lg,
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
  inputError: {
    borderColor: colors.error[500],
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  helperText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  paymentOptions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  paymentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  paymentOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  paymentOptionText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  paymentOptionTextSelected: {
    color: colors.primary[700],
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
    minWidth: 120,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: colors.primary[300],
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  terminateWarning: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  terminateName: {
    fontWeight: typography.fontWeight.semibold,
  },
  terminateInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  terminateConfirmButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.error[600],
    minWidth: 120,
    alignItems: "center",
  },
  terminateConfirmText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
});

export default EmployeeManagement;
