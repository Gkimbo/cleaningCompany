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
import HRManagementService from "../../services/fetchRequests/HRManagementService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Generate a secure password
const generatePassword = () => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";

  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

// Employee Card Component
const EmployeeCard = ({ employee, onEdit, onDelete }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.employeeCard}>
      <View style={styles.employeeInfo}>
        <View style={styles.employeeAvatar}>
          <Text style={styles.employeeAvatarText}>
            {((employee.firstName && employee.firstName[0]) || (employee.username && employee.username[0]) || "H").toUpperCase()}
          </Text>
        </View>
        <View style={styles.employeeDetails}>
          <Text style={styles.employeeName}>
            {employee.firstName} {employee.lastName}
          </Text>
          <Text style={styles.employeeUsername}>@{employee.username}</Text>
          <Text style={styles.employeeContact}>{employee.email}</Text>
          {employee.phone && (
            <Text style={styles.employeeContact}>{employee.phone}</Text>
          )}
          <Text style={styles.employeeDate}>
            Added {formatDate(employee.createdAt)}
          </Text>
        </View>
      </View>
      <View style={styles.employeeActions}>
        <Pressable
          style={[styles.actionButton, styles.editButton]}
          onPress={() => onEdit(employee)}
        >
          <Icon name="pencil" size={14} color={colors.primary[600]} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(employee)}
        >
          <Icon name="trash" size={14} color={colors.error[600]} />
        </Pressable>
      </View>
    </View>
  );
};

const HREmployeeManagement = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hrStaff, setHrStaff] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchHRStaff();
  }, []);

  const fetchHRStaff = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await HRManagementService.getHRStaff(state.currentUser.token);
      setHrStaff(result.hrStaff || []);
    } catch (err) {
      console.error("Error fetching HR staff:", err);
      setError("Failed to load HR staff");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchHRStaff(true);
  }, [state.currentUser.token]);

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      phone: "",
      password: generatePassword(),
    });
    setFormErrors({});
  };

  const validateForm = (isEdit = false) => {
    const errors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Last name is required";
    }

    if (!isEdit) {
      if (!formData.username.trim()) {
        errors.username = "Username is required";
      } else if (formData.username.length < 4) {
        errors.username = "Username must be at least 4 characters";
      } else if (formData.username.toLowerCase().includes("owner")) {
        errors.username = "Username cannot contain 'owner'";
      }

      if (!formData.password) {
        errors.password = "Password is required";
      } else if (formData.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
      }
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email";
    }

    if (formData.phone && formData.phone.replace(/\D/g, "").length < 10) {
      errors.phone = "Please enter a valid phone number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAddModal = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, password: generatePassword() }));
    setShowAddModal(true);
  };

  const handleOpenEditModal = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      username: employee.username || "",
      email: employee.email || "",
      phone: employee.phone || "",
      password: "",
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleOpenDeleteModal = (employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const handleCreate = async () => {
    if (!validateForm(false)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await HRManagementService.createHREmployee(
        state.currentUser.token,
        {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          username: formData.username.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          password: formData.password,
        }
      );

      if (result.success) {
        setSuccess("HR employee created successfully! A welcome email has been sent.");
        setShowAddModal(false);
        fetchHRStaff(true);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setFormErrors({ submit: result.error });
      }
    } catch (err) {
      setFormErrors({ submit: "Failed to create HR employee" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm(true)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await HRManagementService.updateHREmployee(
        state.currentUser.token,
        selectedEmployee.id,
        {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
        }
      );

      if (result.success) {
        setSuccess("HR employee updated successfully!");
        setShowEditModal(false);
        fetchHRStaff(true);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setFormErrors({ submit: result.error });
      }
    } catch (err) {
      setFormErrors({ submit: "Failed to update HR employee" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await HRManagementService.deleteHREmployee(
        state.currentUser.token,
        selectedEmployee.id
      );

      if (result.success) {
        setSuccess("HR employee removed successfully!");
        setShowDeleteModal(false);
        fetchHRStaff(true);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error);
        setShowDeleteModal(false);
      }
    } catch (err) {
      setError("Failed to remove HR employee");
      setShowDeleteModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFormInput = (label, field, placeholder, options = {}) => (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, formErrors[field] && styles.formInputError]}
        placeholder={placeholder}
        value={formData[field]}
        onChangeText={(text) => setFormData((prev) => ({ ...prev, [field]: text }))}
        placeholderTextColor={colors.text.tertiary}
        editable={options.editable !== false}
        keyboardType={options.keyboardType || "default"}
        autoCapitalize={options.autoCapitalize || "none"}
        secureTextEntry={options.secureTextEntry}
      />
      {formErrors[field] && (
        <Text style={styles.formError}>{formErrors[field]}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading HR staff...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary[500]]}
          tintColor={colors.primary[500]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>HR Management</Text>
      </View>

      {/* Success Message */}
      {success && (
        <View style={styles.messageSuccess}>
          <Text style={styles.messageSuccessText}>{success}</Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.messageError}>
          <Text style={styles.messageErrorText}>{error}</Text>
        </View>
      )}

      {/* Add Button */}
      <Pressable style={styles.addButton} onPress={handleOpenAddModal}>
        <Icon name="plus" size={16} color={colors.neutral[0]} />
        <Text style={styles.addButtonText}>Add HR Employee</Text>
      </Pressable>

      {/* Staff List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          HR Staff ({hrStaff.length})
        </Text>

        {hrStaff.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="users" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyStateTitle}>No HR Employees</Text>
            <Text style={styles.emptyStateText}>
              Add your first HR employee to help manage the platform.
            </Text>
          </View>
        ) : (
          <View style={styles.staffList}>
            {hrStaff.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onEdit={handleOpenEditModal}
                onDelete={handleOpenDeleteModal}
              />
            ))}
          </View>
        )}
      </View>

      {/* Add Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add HR Employee</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowAddModal(false)}
              >
                <Icon name="times" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {renderFormInput("First Name", "firstName", "Enter first name", {
                autoCapitalize: "words",
              })}
              {renderFormInput("Last Name", "lastName", "Enter last name", {
                autoCapitalize: "words",
              })}
              {renderFormInput("Username", "username", "Enter username")}
              {renderFormInput("Email", "email", "Enter email address", {
                keyboardType: "email-address",
              })}
              {renderFormInput("Phone (Optional)", "phone", "Enter phone number", {
                keyboardType: "phone-pad",
              })}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[
                      styles.formInput,
                      styles.passwordInput,
                      formErrors.password && styles.formInputError,
                    ]}
                    placeholder="Password"
                    value={formData.password}
                    onChangeText={(text) =>
                      setFormData((prev) => ({ ...prev, password: text }))
                    }
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <Pressable
                    style={styles.generateButton}
                    onPress={() =>
                      setFormData((prev) => ({ ...prev, password: generatePassword() }))
                    }
                  >
                    <Icon name="refresh" size={14} color={colors.primary[600]} />
                  </Pressable>
                </View>
                {formErrors.password && (
                  <Text style={styles.formError}>{formErrors.password}</Text>
                )}
                <Text style={styles.formHint}>
                  Password will be sent to the employee via email.
                </Text>
              </View>

              {formErrors.submit && (
                <View style={styles.submitError}>
                  <Text style={styles.submitErrorText}>{formErrors.submit}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleCreate}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <Text style={styles.submitButtonText}>Create Employee</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit HR Employee</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowEditModal(false)}
              >
                <Icon name="times" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Username</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputDisabled]}
                  value={formData.username}
                  editable={false}
                />
                <Text style={styles.formHint}>Username cannot be changed.</Text>
              </View>

              {renderFormInput("First Name", "firstName", "Enter first name", {
                autoCapitalize: "words",
              })}
              {renderFormInput("Last Name", "lastName", "Enter last name", {
                autoCapitalize: "words",
              })}
              {renderFormInput("Email", "email", "Enter email address", {
                keyboardType: "email-address",
              })}
              {renderFormInput("Phone (Optional)", "phone", "Enter phone number", {
                keyboardType: "phone-pad",
              })}

              {formErrors.submit && (
                <View style={styles.submitError}>
                  <Text style={styles.submitErrorText}>{formErrors.submit}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleUpdate}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <Text style={styles.submitButtonText}>Save Changes</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIconContainer}>
              <Icon name="exclamation-triangle" size={32} color={colors.error[500]} />
            </View>
            <Text style={styles.deleteTitle}>Remove HR Employee?</Text>
            <Text style={styles.deleteMessage}>
              Are you sure you want to remove{" "}
              <Text style={styles.deleteEmployeeName}>
                {selectedEmployee && selectedEmployee.firstName} {selectedEmployee && selectedEmployee.lastName}
              </Text>
              ? This action cannot be undone.
            </Text>

            <View style={styles.deleteActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteConfirmButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <Text style={styles.deleteConfirmButtonText}>Remove</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  messageSuccess: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  messageSuccessText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
  },
  messageError: {
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  messageErrorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  addButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  staffList: {
    gap: spacing.md,
  },
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  employeeInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  employeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  employeeDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  employeeUsername: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },
  employeeContact: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  employeeDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  employeeActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    backgroundColor: colors.primary[100],
  },
  deleteButton: {
    backgroundColor: colors.error[100],
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    padding: spacing.lg,
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
  closeButton: {
    padding: spacing.sm,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  formInputError: {
    borderColor: colors.error[500],
  },
  formInputDisabled: {
    backgroundColor: colors.neutral[100],
    color: colors.text.tertiary,
  },
  formError: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    marginTop: spacing.xs,
  },
  formHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  passwordInput: {
    flex: 1,
  },
  generateButton: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  submitError: {
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  submitErrorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Delete modal
  deleteModalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginVertical: "auto",
    alignItems: "center",
  },
  deleteIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  deleteTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  deleteMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  deleteEmployeeName: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  deleteActions: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: colors.error[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  deleteConfirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default HREmployeeManagement;
