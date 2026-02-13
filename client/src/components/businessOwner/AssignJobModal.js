import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";

/**
 * Format date for display
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {string} Formatted date
 */
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format time for display
 * @param {string} timeStr - Time string (HH:MM:SS or HH:MM)
 * @returns {string} Formatted time
 */
const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Format price for display
 * @param {number} cents - Price in cents
 * @returns {string} Formatted price
 */
const formatPrice = (cents) => {
  if (!cents) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
};

const JobCard = ({ job, employee, onAssign, isAssigning }) => {
  return (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <Icon name="calendar" size={14} color={colors.primary[600]} />
        <Text style={styles.jobDate}>
          {formatDate(job.date)} at {formatTime(job.startTime)}
        </Text>
      </View>

      <View style={styles.jobDetail}>
        <Icon name="map-marker" size={14} color={colors.text.tertiary} />
        <Text style={styles.jobAddress} numberOfLines={1}>
          {job.address}
        </Text>
      </View>

      <View style={styles.jobDetail}>
        <Icon name="home" size={14} color={colors.text.tertiary} />
        <Text style={styles.jobHome}>
          {job.numBeds} bed, {job.numBaths} bath
        </Text>
      </View>

      <View style={styles.jobFooter}>
        <View style={styles.priceContainer}>
          <Icon name="dollar" size={14} color={colors.success[600]} />
          <Text style={styles.jobPrice}>{formatPrice(job.price)}</Text>
        </View>

        <Pressable
          style={[styles.assignJobButton, isAssigning && styles.assignJobButtonDisabled]}
          onPress={() => onAssign(job)}
          disabled={isAssigning}
        >
          {isAssigning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check" size={12} color="#fff" />
              <Text style={styles.assignJobButtonText}>
                Assign to {employee.firstName}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const AssignJobModal = ({
  visible,
  employee,
  jobs,
  token,
  onClose,
  onAssignSuccess,
}) => {
  const [assigningJobId, setAssigningJobId] = useState(null);

  const handleAssign = async (job) => {
    if (!employee || assigningJobId) return;

    setAssigningJobId(job.id);

    try {
      // Use a default pay amount based on job price (e.g., 90% of job price)
      const defaultPayAmount = Math.round(job.price * 0.9);

      const result = await BusinessOwnerService.assignEmployee(token, {
        appointmentId: job.id,
        employeeId: employee.id,
        payAmount: defaultPayAmount,
        payType: "flat_rate",
      });

      if (result.success) {
        Alert.alert(
          "Job Assigned",
          `Successfully assigned the job to ${employee.firstName}.`,
          [{ text: "OK" }]
        );
        if (onAssignSuccess) {
          onAssignSuccess(job.id, employee.id);
        }
      } else {
        Alert.alert("Error", result.error || "Failed to assign job");
      }
    } catch (error) {
      console.error("Error assigning job:", error);
      Alert.alert("Error", "Failed to assign job. Please try again.");
    } finally {
      setAssigningJobId(null);
    }
  };

  if (!employee) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Assign Job to {employee.firstName}</Text>
              <Text style={styles.subtitle}>
                {jobs.length} unassigned job{jobs.length !== 1 ? "s" : ""} available
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Icon name="times" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Employee Info */}
          <View style={styles.employeeInfo}>
            <View style={styles.employeeAvatar}>
              <Text style={styles.employeeAvatarText}>
                {(employee.firstName?.[0] || "E").toUpperCase()}
              </Text>
            </View>
            <View style={styles.employeeDetails}>
              <Text style={styles.employeeName}>
                {employee.firstName} {employee.lastName}
              </Text>
              <Text style={styles.employeeStats}>
                {employee.hours?.thisWeek || 0}h this week | {employee.jobs?.thisWeek || 0} jobs
              </Text>
            </View>
            <View style={styles.workloadBadge}>
              <Text style={styles.workloadText}>{employee.workloadPercent}%</Text>
            </View>
          </View>

          {/* Jobs List */}
          <ScrollView
            style={styles.jobsList}
            contentContainerStyle={styles.jobsListContent}
            showsVerticalScrollIndicator={false}
          >
            {jobs.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="check-circle" size={48} color={colors.success[400]} />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptyText}>
                  No unassigned jobs at this time.
                </Text>
              </View>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  employee={employee}
                  onAssign={handleAssign}
                  isAssigning={assigningJobId === job.id}
                />
              ))
            )}
          </ScrollView>

          {/* Cancel Button */}
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "85%",
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.md,
  },
  employeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
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
  employeeDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  employeeStats: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  workloadBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  workloadText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  jobsList: {
    flex: 1,
  },
  jobsListContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  jobCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  jobDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  jobAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  jobHome: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  jobFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  jobPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  assignJobButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  assignJobButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  assignJobButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
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
    textAlign: "center",
  },
  cancelButton: {
    margin: spacing.lg,
    marginTop: 0,
    padding: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.xl,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
});

export default AssignJobModal;
