import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from "react-native";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import AddEmployeeForm from "./forms/AddNewEmployeeForm";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const AddEmployee = ({ state, setEmployeeList, employeeList }) => {
  const navigate = useNavigate();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEmployees = async () => {
    const response = await FetchData.get(
      "/api/v1/users/employees",
      state.currentUser.token
    );
    setEmployeeList(response.users);
  };

  const handleBack = () => {
    navigate("/");
  };

  const handleEdit = (id) => {
    navigate(`/employee-edit/${id}`);
  };

  const handleDeletePress = (employeeId, employeeName) => {
    setSelectedEmployeeId(employeeId);
    setSelectedEmployeeName(employeeName);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedEmployeeId) return;

    setIsDeleting(true);
    try {
      await FetchData.deleteEmployee(selectedEmployeeId);
      const updatedEmployeeList = employeeList.filter(
        (emp) => emp.id !== Number(selectedEmployeeId)
      );
      setEmployeeList(updatedEmployeeList);
    } catch (error) {
      console.error("Error deleting employee:", error);
    } finally {
      setIsDeleting(false);
      setDeleteModalVisible(false);
      setSelectedEmployeeId(null);
      setSelectedEmployeeName("");
    }
  };

  const formatLastLogin = (lastLogin) => {
    if (!lastLogin) return "Never";
    const date = new Date(lastLogin);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const EmployeeTile = ({ employee }) => (
    <View style={styles.employeeTile}>
      <View style={styles.employeeHeader}>
        <View style={styles.employeeInfo}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {employee.username?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
          <View style={styles.employeeDetails}>
            <Text style={styles.employeeName}>{employee.username}</Text>
            <Text style={styles.employeeEmail}>{employee.email}</Text>
          </View>
        </View>
        <View style={[styles.typeBadge, employee.type === "manager" && styles.managerBadge]}>
          <Text style={[styles.typeBadgeText, employee.type === "manager" && styles.managerBadgeText]}>
            {employee.type === "manager" ? "Manager" : "Cleaner"}
          </Text>
        </View>
      </View>

      <View style={styles.employeeMeta}>
        <Text style={styles.lastLoginLabel}>Last Login</Text>
        <Text style={styles.lastLoginValue}>{formatLastLogin(employee.lastLogin)}</Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEdit(employee.id)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePress(employee.id, employee.username)}
        >
          <Text style={styles.deleteButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{"<"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Employees</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.subtitle}>
        Add new cleaners or manage existing employee accounts
      </Text>

      {/* Add Employee Form */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add New Employee</Text>
        <AddEmployeeForm
          employeeList={employeeList}
          setEmployeeList={setEmployeeList}
        />
      </View>

      {/* Employee List */}
      {employeeList && employeeList.length > 0 ? (
        <View style={styles.employeesList}>
          <Text style={styles.sectionTitle}>
            Current Employees ({employeeList.length})
          </Text>
          {employeeList.map((employee) => (
            <EmployeeTile key={employee.id} employee={employee} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>👥</Text>
          </View>
          <Text style={styles.emptyTitle}>No Employees Yet</Text>
          <Text style={styles.emptyDescription}>
            Add your first employee using the form above to get started.
          </Text>
        </View>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Remove Employee?</Text>
            <Text style={styles.modalText}>
              Are you sure you want to remove {selectedEmployeeName}? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.keepButtonText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  {isDeleting ? "Removing..." : "Remove"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 60,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  formTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  employeesList: {
    marginBottom: spacing.lg,
  },
  employeeTile: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  employeeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  employeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  employeeDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  employeeEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  typeBadge: {
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  managerBadge: {
    backgroundColor: colors.secondary[100],
  },
  managerBadgeText: {
    color: colors.secondary[700],
  },
  employeeMeta: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  lastLoginLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  lastLoginValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  editButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.error[500],
  },
  deleteButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  emptyIconText: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    margin: spacing.xl,
    ...shadows.lg,
    maxWidth: 400,
    width: "90%",
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: "center",
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  keepButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  keepButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: colors.error[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  confirmDeleteButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
});

export default AddEmployee;
