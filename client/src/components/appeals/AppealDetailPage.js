import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../context/AuthContext";
import AppealService from "../../services/fetchRequests/AppealService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const STATUS_CONFIG = {
  submitted: {
    label: "Submitted",
    color: colors.primary[500],
    bgColor: colors.primary[50],
    icon: "clock-o",
    description: "Your appeal has been submitted and is waiting to be reviewed.",
  },
  under_review: {
    label: "Under Review",
    color: colors.warning[600],
    bgColor: colors.warning[50],
    icon: "eye",
    description: "A team member is currently reviewing your appeal.",
  },
  awaiting_documents: {
    label: "Awaiting Documents",
    color: colors.secondary[500],
    bgColor: colors.secondary[50],
    icon: "file-text-o",
    description: "Please upload supporting documents to proceed with your appeal.",
  },
  approved: {
    label: "Approved",
    color: colors.success[600],
    bgColor: colors.success[50],
    icon: "check-circle",
    description: "Your appeal has been approved!",
  },
  partially_approved: {
    label: "Partially Approved",
    color: colors.success[500],
    bgColor: colors.success[50],
    icon: "check",
    description: "Your appeal has been partially approved.",
  },
  denied: {
    label: "Denied",
    color: colors.error[600],
    bgColor: colors.error[50],
    icon: "times-circle",
    description: "Your appeal was not approved.",
  },
  escalated: {
    label: "Escalated",
    color: colors.warning[700],
    bgColor: colors.warning[50],
    icon: "arrow-up",
    description: "Your appeal has been escalated for senior review.",
  },
};

const CATEGORY_LABELS = {
  medical_emergency: "Medical Emergency",
  family_emergency: "Family Emergency",
  natural_disaster: "Natural Disaster",
  property_issue: "Property Issue",
  transportation: "Transportation",
  scheduling_error: "Scheduling Error",
  other: "Other",
};

const SEVERITY_CONFIG = {
  low: { label: "Low", color: colors.success[500] },
  medium: { label: "Medium", color: colors.warning[500] },
  high: { label: "High", color: colors.secondary[500] },
  critical: { label: "Critical", color: colors.error[500] },
};

const AppealDetailPage = () => {
  const { user } = useContext(AuthContext);
  const route = useRoute();
  const navigation = useNavigation();
  const { appealId } = route.params;

  const [appeal, setAppeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAppeal = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    }

    try {
      const result = await AppealService.getAppeal(user.token, appealId);

      if (result.success) {
        setAppeal(result.appeal);
        setError(null);
      } else {
        setError(result.error || "Failed to load appeal");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppeal();
  }, [appealId]);

  const handleRefresh = () => {
    fetchAppeal(true);
  };

  const handleWithdraw = () => {
    Alert.alert(
      "Withdraw Appeal",
      "Are you sure you want to withdraw this appeal? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            setWithdrawing(true);
            try {
              const result = await AppealService.withdrawAppeal(user.token, appealId);
              if (result.success) {
                Alert.alert("Appeal Withdrawn", "Your appeal has been withdrawn.", [
                  { text: "OK", onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert("Error", result.error || "Failed to withdraw appeal");
              }
            } catch (err) {
              Alert.alert("Error", "An unexpected error occurred");
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const canWithdraw = () => {
    return appeal && ["submitted", "under_review", "awaiting_documents"].includes(appeal.status);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading appeal details...</Text>
      </View>
    );
  }

  if (error || !appeal) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[500]} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error || "Appeal not found"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchAppeal()}>
          <Icon name="refresh" size={16} color={colors.neutral[0]} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[appeal.status] || STATUS_CONFIG.submitted;
  const severityConfig = SEVERITY_CONFIG[appeal.severity] || SEVERITY_CONFIG.medium;
  const isPending = ["submitted", "under_review", "awaiting_documents", "escalated"].includes(
    appeal.status
  );
  const isResolved = ["approved", "partially_approved", "denied"].includes(appeal.status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary[500]]}
          tintColor={colors.primary[500]}
        />
      }
    >
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusConfig.bgColor }]}>
        <View style={styles.statusIconContainer}>
          <Icon name={statusConfig.icon} size={32} color={statusConfig.color} />
        </View>
        <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
        <Text style={styles.statusDescription}>{statusConfig.description}</Text>
      </View>

      {/* Appeal ID & Dates */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="info-circle" size={18} color={colors.primary[600]} />
          <Text style={styles.cardTitle}>Appeal Information</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Appeal ID</Text>
          <Text style={styles.infoValue}>#{appeal.id}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category</Text>
          <Text style={styles.infoValue}>
            {CATEGORY_LABELS[appeal.category] || appeal.category}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Priority</Text>
          <View style={[styles.severityBadge, { backgroundColor: severityConfig.color }]}>
            <Text style={styles.severityBadgeText}>{severityConfig.label}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Submitted</Text>
          <Text style={styles.infoValue}>{formatDate(appeal.submittedAt)}</Text>
        </View>

        {isPending && appeal.slaDeadline && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expected Response</Text>
            <Text
              style={[
                styles.infoValue,
                new Date(appeal.slaDeadline) < new Date() && styles.overdueText,
              ]}
            >
              {formatDate(appeal.slaDeadline)}
            </Text>
          </View>
        )}

        {isResolved && appeal.closedAt && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Resolved</Text>
            <Text style={styles.infoValue}>{formatDate(appeal.closedAt)}</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="file-text-o" size={18} color={colors.primary[600]} />
          <Text style={styles.cardTitle}>Your Statement</Text>
        </View>
        <Text style={styles.descriptionText}>{appeal.description}</Text>

        {appeal.requestedRelief && (
          <>
            <Text style={styles.subSectionTitle}>Requested Relief</Text>
            <Text style={styles.descriptionText}>{appeal.requestedRelief}</Text>
          </>
        )}
      </View>

      {/* Financial Impact */}
      {(appeal.originalPenaltyAmount || appeal.originalRefundWithheld) && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="dollar" size={18} color={colors.primary[600]} />
            <Text style={styles.cardTitle}>Financial Impact</Text>
          </View>

          {appeal.originalPenaltyAmount > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Cancellation Fee Charged</Text>
              <Text style={styles.financialValue}>
                ${(appeal.originalPenaltyAmount / 100).toFixed(2)}
              </Text>
            </View>
          )}

          {appeal.originalRefundWithheld > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Refund Withheld</Text>
              <Text style={styles.financialValue}>
                ${(appeal.originalRefundWithheld / 100).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Resolution (for closed appeals) */}
      {isResolved && (appeal.reviewDecision || appeal.resolution) && (
        <View style={[styles.card, styles.resolutionCard]}>
          <View style={styles.cardHeader}>
            <Icon
              name={appeal.status === "denied" ? "times-circle" : "check-circle"}
              size={18}
              color={appeal.status === "denied" ? colors.error[600] : colors.success[600]}
            />
            <Text style={styles.cardTitle}>Resolution</Text>
          </View>

          {appeal.reviewDecision && (
            <>
              <Text style={styles.subSectionTitle}>Decision Notes</Text>
              <Text style={styles.descriptionText}>{appeal.reviewDecision}</Text>
            </>
          )}

          {appeal.resolution && (
            <View style={styles.resolutionItems}>
              {appeal.resolution.penaltyWaived && (
                <View style={styles.resolutionItem}>
                  <Icon name="check" size={14} color={colors.success[600]} />
                  <Text style={styles.resolutionItemText}>Cancellation penalty waived</Text>
                </View>
              )}
              {appeal.resolution.feeRefunded && (
                <View style={styles.resolutionItem}>
                  <Icon name="check" size={14} color={colors.success[600]} />
                  <Text style={styles.resolutionItemText}>
                    Cancellation fee refunded: $
                    {(appeal.resolution.refundAmount / 100).toFixed(2)}
                  </Text>
                </View>
              )}
              {appeal.resolution.accountUnfrozen && (
                <View style={styles.resolutionItem}>
                  <Icon name="check" size={14} color={colors.success[600]} />
                  <Text style={styles.resolutionItemText}>Account restrictions removed</Text>
                </View>
              )}
              {appeal.resolution.ratingRemoved && (
                <View style={styles.resolutionItem}>
                  <Icon name="check" size={14} color={colors.success[600]} />
                  <Text style={styles.resolutionItemText}>Penalty rating removed</Text>
                </View>
              )}
            </View>
          )}

          {appeal.resolutionNotes && (
            <>
              <Text style={styles.subSectionTitle}>Additional Notes</Text>
              <Text style={styles.descriptionText}>{appeal.resolutionNotes}</Text>
            </>
          )}
        </View>
      )}

      {/* Supporting Documents */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="paperclip" size={18} color={colors.primary[600]} />
          <Text style={styles.cardTitle}>Supporting Documents</Text>
        </View>

        {appeal.supportingDocuments && appeal.supportingDocuments.length > 0 ? (
          <View style={styles.documentsContainer}>
            {appeal.supportingDocuments.map((doc, index) => (
              <View key={index} style={styles.documentItem}>
                <Icon name="file" size={14} color={colors.text.secondary} />
                <Text style={styles.documentName}>{doc.name || `Document ${index + 1}`}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDocumentsText}>No documents uploaded</Text>
        )}

        {isPending && (
          <TouchableOpacity style={styles.uploadButton}>
            <Icon name="cloud-upload" size={16} color={colors.primary[600]} />
            <Text style={styles.uploadButtonText}>Upload Documents</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Withdraw Action */}
      {canWithdraw() && (
        <TouchableOpacity
          style={styles.withdrawButton}
          onPress={handleWithdraw}
          disabled={withdrawing}
        >
          {withdrawing ? (
            <ActivityIndicator size="small" color={colors.error[600]} />
          ) : (
            <>
              <Icon name="times" size={16} color={colors.error[600]} />
              <Text style={styles.withdrawButtonText}>Withdraw Appeal</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Help Section */}
      <View style={styles.helpSection}>
        <Icon name="question-circle" size={20} color={colors.text.tertiary} />
        <Text style={styles.helpText}>
          Need help? Contact our support team if you have questions about your appeal.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.secondary,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  statusBanner: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  statusIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statusLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statusDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  resolutionCard: {
    borderWidth: 1,
    borderColor: colors.success[200],
    backgroundColor: colors.success[50],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  overdueText: {
    color: colors.error[600],
  },
  severityBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  severityBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  subSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  financialLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  financialValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
  },
  resolutionItems: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  resolutionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resolutionItemText: {
    fontSize: typography.fontSize.base,
    color: colors.success[700],
  },
  documentsContainer: {
    gap: spacing.sm,
  },
  documentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  documentName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  noDocumentsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  uploadButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  withdrawButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[600],
  },
  helpSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    gap: spacing.sm,
  },
  helpText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    lineHeight: 20,
  },
});

export default AppealDetailPage;
