import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { UserContext } from "../../context/UserContext";
import SuspiciousReportsService from "../../services/fetchRequests/SuspiciousReportsService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

/**
 * SuspiciousReportDetailModal
 *
 * Displays full report details and allows HR/Owner to take action
 */
const SuspiciousReportDetailModal = ({
  visible,
  reportId,
  onClose,
  onActionTaken,
}) => {
  const { state } = useContext(UserContext);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible && reportId) {
      loadReport();
    }
  }, [visible, reportId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const result = await SuspiciousReportsService.getReportById(
        state.currentUser.token,
        reportId
      );
      if (result.report) {
        setReport(result.report);
      }
    } catch (error) {
      console.error("Error loading report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAction = async () => {
    if (!selectedAction) {
      Alert.alert("Error", "Please select an action");
      return;
    }

    if ((selectedAction === "warn" || selectedAction === "suspend") && !notes.trim()) {
      Alert.alert("Error", "Notes are required for warn and suspend actions");
      return;
    }

    // Confirm destructive actions
    if (selectedAction === "suspend") {
      Alert.alert(
        "Suspend User",
        `Are you sure you want to suspend ${report.reportedUser?.name}? They will not be able to log in until the suspension is lifted.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Suspend",
            style: "destructive",
            onPress: () => submitAction(),
          },
        ]
      );
      return;
    }

    submitAction();
  };

  const submitAction = async () => {
    setSubmitting(true);
    try {
      const result = await SuspiciousReportsService.takeAction(
        state.currentUser.token,
        reportId,
        selectedAction,
        notes
      );

      if (result.success) {
        Alert.alert("Success", result.message || "Action completed successfully");
        if (onActionTaken) {
          onActionTaken(result.report);
        }
        onClose();
      } else {
        Alert.alert("Error", result.error || "Failed to complete action");
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSuspiciousTypeLabel = (type) => {
    switch (type) {
      case "phone_number":
        return "Phone Number";
      case "email":
        return "Email Address";
      case "off_platform":
        return "Off-Platform Communication";
      default:
        return type;
    }
  };

  const getAccountStatusBadge = (user) => {
    if (!user) return null;

    if (user.accountStatus === "suspended") {
      return (
        <View style={[styles.userStatusBadge, { backgroundColor: colors.error[100] }]}>
          <Icon name="slash" size={14} color={colors.error[600]} />
          <Text style={[styles.userStatusText, { color: colors.error[600] }]}>
            Suspended
          </Text>
        </View>
      );
    }

    if (user.accountStatus === "warned") {
      return (
        <View style={[styles.userStatusBadge, { backgroundColor: colors.warning[100] }]}>
          <Icon name="alert-triangle" size={14} color={colors.warning[600]} />
          <Text style={[styles.userStatusText, { color: colors.warning[600] }]}>
            {user.warningCount} Warning{user.warningCount > 1 ? "s" : ""}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.userStatusBadge, { backgroundColor: colors.success[100] }]}>
        <Icon name="check-circle" size={14} color={colors.success[600]} />
        <Text style={[styles.userStatusText, { color: colors.success[600] }]}>
          Active
        </Text>
      </View>
    );
  };

  const actions = [
    {
      id: "dismiss",
      label: "Dismiss",
      description: "False report - no action needed",
      icon: "x-circle",
      color: colors.neutral[500],
    },
    {
      id: "reviewed",
      label: "Mark Reviewed",
      description: "Acknowledged but no action needed",
      icon: "check-circle",
      color: colors.primary[500],
    },
    {
      id: "warn",
      label: "Warn User",
      description: "Add warning to user profile",
      icon: "alert-triangle",
      color: colors.warning[500],
      requiresNotes: true,
    },
    {
      id: "suspend",
      label: "Suspend User",
      description: "Freeze account - user cannot login",
      icon: "slash",
      color: colors.error[500],
      requiresNotes: true,
    },
    {
      id: "clear_flags",
      label: "Clear All Flags",
      description: "Remove all warnings and suspension",
      icon: "refresh-cw",
      color: colors.success[500],
    },
  ];

  const handleClose = () => {
    setSelectedAction(null);
    setNotes("");
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Suspicious Activity Report</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Icon name="x" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
          ) : report ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Users Section */}
              <View style={styles.section}>
                <View style={styles.usersRow}>
                  {/* Reporter */}
                  <View style={styles.userCard}>
                    <Text style={styles.userLabel}>REPORTER</Text>
                    <Text style={styles.userName}>{report.reporter?.name || "Unknown"}</Text>
                    <Text style={styles.userType}>
                      {report.reporter?.type === "cleaner" ? "Cleaner" : "Client"}
                    </Text>
                    {getAccountStatusBadge(report.reporter)}
                  </View>

                  {/* Arrow */}
                  <View style={styles.arrowContainer}>
                    <Icon name="arrow-right" size={20} color={colors.text.tertiary} />
                  </View>

                  {/* Reported User */}
                  <View style={styles.userCard}>
                    <Text style={styles.userLabel}>REPORTED USER</Text>
                    <Text style={styles.userName}>{report.reportedUser?.name || "Unknown"}</Text>
                    <Text style={styles.userType}>
                      {report.reportedUser?.type === "cleaner" ? "Cleaner" : "Client"}
                    </Text>
                    {getAccountStatusBadge(report.reportedUser)}
                  </View>
                </View>
              </View>

              {/* Report Details */}
              <View style={styles.section}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Submitted:</Text>
                  <Text style={styles.detailValue}>{formatDate(report.createdAt)}</Text>
                </View>
                {report.appointmentId && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Appointment:</Text>
                    <Text style={styles.detailValue}>
                      #{report.appointmentId} - {formatDate(report.appointmentDate)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Detected:</Text>
                  <View style={styles.tagsContainer}>
                    {report.suspiciousContentTypes?.map((type, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{getSuspiciousTypeLabel(type)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Message Content */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Message Content</Text>
                <View style={styles.messageBox}>
                  <Text style={styles.messageContent}>"{report.messageContent}"</Text>
                </View>
              </View>

              {/* Previous Reports */}
              {report.previousReports?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Previous Reports ({report.previousReports.length})
                  </Text>
                  {report.previousReports.map((pr, index) => (
                    <View key={index} style={styles.previousReportItem}>
                      <View style={styles.previousReportHeader}>
                        <Text style={styles.previousReportDate}>
                          {formatDate(pr.createdAt)}
                        </Text>
                        <Text style={[
                          styles.previousReportStatus,
                          { color: pr.status === "action_taken" ? colors.error[600] : colors.text.tertiary }
                        ]}>
                          {pr.status.replace("_", " ")}
                        </Text>
                      </View>
                      <Text style={styles.previousReportTypes}>
                        {pr.suspiciousContentTypes?.map(getSuspiciousTypeLabel).join(", ")}
                      </Text>
                      {pr.reviewNotes && (
                        <Text style={styles.previousReportNotes}>{pr.reviewNotes}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Already Reviewed Info */}
              {report.status !== "pending" && (
                <View style={styles.reviewedSection}>
                  <Icon name="check-circle" size={20} color={colors.primary[600]} />
                  <View style={styles.reviewedInfo}>
                    <Text style={styles.reviewedText}>
                      {report.status.replace("_", " ").toUpperCase()} by {report.reviewedBy?.name || "Unknown"}
                    </Text>
                    <Text style={styles.reviewedDate}>
                      {formatDate(report.reviewedAt)}
                    </Text>
                    {report.reviewNotes && (
                      <Text style={styles.reviewedNotes}>{report.reviewNotes}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Action Section (only for pending reports) */}
              {report.status === "pending" && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Take Action</Text>

                  {/* Action Options */}
                  {actions.map((action) => (
                    <TouchableOpacity
                      key={action.id}
                      style={[
                        styles.actionOption,
                        selectedAction === action.id && styles.actionOptionSelected,
                      ]}
                      onPress={() => setSelectedAction(action.id)}
                    >
                      <View style={styles.actionRadio}>
                        {selectedAction === action.id ? (
                          <Icon name="check-circle" size={20} color={action.color} />
                        ) : (
                          <View style={styles.radioEmpty} />
                        )}
                      </View>
                      <View style={styles.actionContent}>
                        <View style={styles.actionHeader}>
                          <Icon name={action.icon} size={16} color={action.color} />
                          <Text style={[styles.actionLabel, { color: action.color }]}>
                            {action.label}
                          </Text>
                        </View>
                        <Text style={styles.actionDescription}>{action.description}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Notes Input */}
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>
                      Notes {(selectedAction === "warn" || selectedAction === "suspend") && (
                        <Text style={styles.required}>*</Text>
                      )}
                    </Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Enter notes about the action taken..."
                      placeholderTextColor={colors.text.tertiary}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      !selectedAction && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmitAction}
                    disabled={!selectedAction || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit Action</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load report</Text>
            </View>
          )}
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
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    ...shadows.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.xl * 2,
    alignItems: "center",
  },
  errorContainer: {
    padding: spacing.xl * 2,
    alignItems: "center",
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.base,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  usersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userCard: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  arrowContainer: {
    paddingHorizontal: spacing.sm,
  },
  userLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: "center",
  },
  userType: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  userStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.xs,
    gap: 4,
  },
  userStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    width: 100,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    flex: 1,
  },
  tag: {
    backgroundColor: colors.error[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium,
  },
  messageBox: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[400],
  },
  messageContent: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontStyle: "italic",
    lineHeight: 24,
  },
  previousReportItem: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  previousReportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  previousReportDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  previousReportStatus: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textTransform: "capitalize",
  },
  previousReportTypes: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  previousReportNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  reviewedSection: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  reviewedInfo: {
    flex: 1,
  },
  reviewedText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  reviewedDate: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },
  reviewedNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  actionOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  actionOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  actionRadio: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.neutral[300],
  },
  actionContent: {
    flex: 1,
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  actionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  notesContainer: {
    marginTop: spacing.sm,
  },
  notesLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error[500],
  },
  notesInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default SuspiciousReportDetailModal;
