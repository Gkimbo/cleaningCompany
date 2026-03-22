import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import CleanerManagementService from "../../services/fetchRequests/CleanerManagementService";
import MessageService from "../../services/fetchRequests/MessageClass";
import useSafeNavigation from "../../hooks/useSafeNavigation";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Format currency helper
const formatCurrency = (cents) => {
  if (!cents && cents !== 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Cleaner Card Component
const CleanerCard = ({
  cleaner,
  onFreeze,
  onUnfreeze,
  onViewProfile,
  onViewJobHistory,
  onSendMessage,
  onIssueWarning,
}) => {
  return (
    <View
      style={[
        styles.cleanerCard,
        cleaner.accountFrozen && styles.cleanerCardFrozen,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <View
            style={[
              styles.avatar,
              cleaner.accountFrozen && styles.avatarFrozen,
            ]}
          >
            <Text style={styles.avatarText}>
              {(
                (cleaner.firstName && cleaner.firstName[0]) ||
                (cleaner.username && cleaner.username[0]) ||
                "C"
              ).toUpperCase()}
            </Text>
          </View>
          {cleaner.accountFrozen && (
            <View style={styles.frozenBadgeIcon}>
              <Icon name="snowflake-o" size={10} color={colors.error[600]} />
            </View>
          )}
        </View>

        <View style={styles.cleanerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cleanerName}>
              {cleaner.firstName || ""} {cleaner.lastName || ""}
            </Text>
            {cleaner.warningCount > 0 && (
              <View style={styles.warningBadge}>
                <Icon
                  name="exclamation-triangle"
                  size={10}
                  color={colors.warning[700]}
                />
                <Text style={styles.warningBadgeText}>
                  {cleaner.warningCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cleanerUsername}>@{cleaner.username}</Text>
          <Text style={styles.cleanerEmail}>{cleaner.email}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            cleaner.accountFrozen
              ? styles.statusBadgeFrozen
              : styles.statusBadgeActive,
          ]}
        >
          <Icon
            name={cleaner.accountFrozen ? "ban" : "check-circle"}
            size={10}
            color={
              cleaner.accountFrozen ? colors.error[700] : colors.success[700]
            }
          />
          <Text
            style={[
              styles.statusText,
              cleaner.accountFrozen
                ? styles.statusTextFrozen
                : styles.statusTextActive,
            ]}
          >
            {cleaner.accountFrozen ? "Frozen" : "Active"}
          </Text>
        </View>
      </View>

      {/* Performance Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Icon name="briefcase" size={14} color={colors.primary[500]} />
          <Text style={styles.metricValue}>{cleaner.jobsCompleted || 0}</Text>
          <Text style={styles.metricLabel}>Jobs</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Icon name="star" size={14} color={colors.warning[500]} />
          <Text style={styles.metricValue}>
            {cleaner.avgRating ? cleaner.avgRating.toFixed(1) : "N/A"}
          </Text>
          <Text style={styles.metricLabel}>Rating</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Icon name="check-circle" size={14} color={colors.success[500]} />
          <Text style={styles.metricValue}>
            {cleaner.reliabilityScore !== null
              ? `${cleaner.reliabilityScore}%`
              : "N/A"}
          </Text>
          <Text style={styles.metricLabel}>Reliable</Text>
        </View>
      </View>

      {/* Earnings Summary Row */}
      <View style={styles.earningsRow}>
        <View style={styles.earningsItem}>
          <Icon name="dollar" size={12} color={colors.success[600]} />
          <Text style={styles.earningsLabel}>Total:</Text>
          <Text style={styles.earningsValue}>
            {formatCurrency(cleaner.totalEarnings)}
          </Text>
        </View>
        <View style={styles.earningsItem}>
          <Text style={styles.earningsLabel}>This Month:</Text>
          <Text style={styles.earningsValue}>
            {formatCurrency(cleaner.monthlyEarnings)}
          </Text>
        </View>
      </View>

      {/* Frozen reason display */}
      {cleaner.accountFrozen && cleaner.accountFrozenReason && (
        <View style={styles.frozenReasonBox}>
          <Icon name="info-circle" size={14} color={colors.error[600]} />
          <Text style={styles.frozenReasonText}>
            {cleaner.accountFrozenReason}
          </Text>
        </View>
      )}

      {/* Meta info */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          Last login: {formatDate(cleaner.lastLogin)}
        </Text>
        <Text style={styles.metaText}>
          Joined: {formatDate(cleaner.createdAt)}
        </Text>
      </View>

      {/* Action buttons - Two rows */}
      <View style={styles.actionsContainer}>
        {/* Primary Actions */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => onViewProfile(cleaner)}
          >
            <Icon name="user" size={14} color={colors.primary[600]} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
              Profile
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => onViewJobHistory(cleaner)}
          >
            <Icon name="history" size={14} color={colors.primary[600]} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
              History
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => onSendMessage(cleaner)}
          >
            <Icon name="comment" size={14} color={colors.primary[600]} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
              Message
            </Text>
          </Pressable>
        </View>
        {/* Secondary Actions */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnWarning]}
            onPress={() => onIssueWarning(cleaner)}
          >
            <Icon
              name="exclamation-triangle"
              size={14}
              color={colors.warning[600]}
            />
            <Text style={[styles.actionBtnText, styles.actionBtnTextWarning]}>
              Warning
            </Text>
          </Pressable>
          {cleaner.accountFrozen ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnSuccess]}
              onPress={() => onUnfreeze(cleaner)}
            >
              <Icon name="unlock" size={14} color={colors.success[600]} />
              <Text
                style={[styles.actionBtnText, styles.actionBtnTextSuccess]}
              >
                Unfreeze
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => onFreeze(cleaner)}
            >
              <Icon name="ban" size={14} color={colors.error[600]} />
              <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
                Freeze
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

// Freeze Modal Component
const FreezeModal = ({
  visible,
  cleaner,
  onClose,
  onConfirm,
  isSubmitting,
}) => {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim().length < 5) return;
    onConfirm(reason);
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.freezeModal}>
          <View style={styles.freezeIconContainer}>
            <Icon name="snowflake-o" size={32} color={colors.error[500]} />
          </View>
          <Text style={styles.freezeTitle}>Freeze Account</Text>
          <Text style={styles.freezeMessage}>
            Are you sure you want to freeze{" "}
            <Text style={styles.freezeCleanerName}>
              {cleaner?.firstName} {cleaner?.lastName}
            </Text>
            's account? They will have limited access to the platform.
          </Text>

          <View style={styles.freezeReasonBox}>
            <Text style={styles.freezeReasonLabel}>Reason (required)</Text>
            <TextInput
              style={styles.freezeReasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Enter reason for freezing..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
            />
            {reason.length > 0 && reason.length < 5 && (
              <Text style={styles.reasonError}>
                Reason must be at least 5 characters
              </Text>
            )}
          </View>

          <View style={styles.freezeActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.freezeConfirmBtn,
                (isSubmitting || reason.trim().length < 5) && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting || reason.trim().length < 5}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Text style={styles.freezeConfirmText}>Freeze Account</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Warning Modal Component
const WarningModal = ({
  visible,
  cleaner,
  onClose,
  onConfirm,
  isSubmitting,
}) => {
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("minor");

  const handleConfirm = () => {
    if (reason.trim().length < 10) return;
    onConfirm(reason, severity);
    setReason("");
    setSeverity("minor");
  };

  const handleClose = () => {
    setReason("");
    setSeverity("minor");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.warningModal}>
          <View style={styles.warningIconContainer}>
            <Icon
              name="exclamation-triangle"
              size={32}
              color={colors.warning[500]}
            />
          </View>
          <Text style={styles.warningTitle}>Issue Warning</Text>
          <Text style={styles.warningMessage}>
            Issue a formal warning to{" "}
            <Text style={styles.warningCleanerName}>
              {cleaner?.firstName} {cleaner?.lastName}
            </Text>
            . Current warnings: {cleaner?.warningCount || 0}
          </Text>

          {/* Severity Selector */}
          <View style={styles.severityBox}>
            <Text style={styles.severityLabel}>Severity</Text>
            <View style={styles.severityOptions}>
              <Pressable
                style={[
                  styles.severityOption,
                  severity === "minor" && styles.severityOptionSelected,
                ]}
                onPress={() => setSeverity("minor")}
              >
                <Text
                  style={[
                    styles.severityOptionText,
                    severity === "minor" && styles.severityOptionTextSelected,
                  ]}
                >
                  Minor
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.severityOption,
                  severity === "major" && styles.severityOptionSelectedMajor,
                ]}
                onPress={() => setSeverity("major")}
              >
                <Text
                  style={[
                    styles.severityOptionText,
                    severity === "major" &&
                      styles.severityOptionTextSelectedMajor,
                  ]}
                >
                  Major
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.warningReasonBox}>
            <Text style={styles.warningReasonLabel}>Reason (required)</Text>
            <TextInput
              style={styles.warningReasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Enter detailed reason for warning..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
            />
            {reason.length > 0 && reason.length < 10 && (
              <Text style={styles.reasonError}>
                Reason must be at least 10 characters
              </Text>
            )}
          </View>

          <View style={styles.warningActions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.warningConfirmBtn,
                (isSubmitting || reason.trim().length < 10) && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting || reason.trim().length < 10}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Text style={styles.warningConfirmText}>Issue Warning</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Job History Modal Component
const JobHistoryModal = ({ visible, cleaner, onClose, token }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (visible && cleaner) {
      setPage(1);
      setJobs([]);
      fetchJobs(1);
    }
  }, [visible, cleaner]);

  const fetchJobs = async (pageNum) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await CleanerManagementService.getCleanerJobHistory(
        token,
        cleaner.id,
        { page: pageNum, limit: 20 }
      );

      if (result.success) {
        if (pageNum === 1) {
          setJobs(result.jobs);
        } else {
          setJobs((prev) => [...prev, ...result.jobs]);
        }
        setHasMore(pageNum < result.pagination.totalPages);
      }
    } catch (err) {
      console.error("Error fetching job history:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchJobs(nextPage);
    }
  };

  const renderJob = ({ item }) => (
    <View style={styles.jobItem}>
      <View style={styles.jobHeader}>
        <Text style={styles.jobDate}>{item.date}</Text>
        <View
          style={[
            styles.jobStatusBadge,
            item.status === "completed"
              ? styles.jobStatusCompleted
              : styles.jobStatusIncomplete,
          ]}
        >
          <Text
            style={[
              styles.jobStatusText,
              item.status === "completed"
                ? styles.jobStatusTextCompleted
                : styles.jobStatusTextIncomplete,
            ]}
          >
            {item.status === "completed" ? "Completed" : "Incomplete"}
          </Text>
        </View>
      </View>
      <Text style={styles.jobAddress}>
        {item.homeAddress || "Address unavailable"}
        {item.homeCity && `, ${item.homeCity}`}
        {item.homeState && `, ${item.homeState}`}
      </Text>
      <View style={styles.jobFooter}>
        <Text style={styles.jobEarnings}>{formatCurrency(item.price)}</Text>
        {item.rating && (
          <View style={styles.jobRating}>
            <Icon name="star" size={12} color={colors.warning[500]} />
            <Text style={styles.jobRatingText}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.historyModalOverlay}>
        <View style={styles.historyModal}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>
              Job History - {cleaner?.firstName} {cleaner?.lastName}
            </Text>
            <Pressable style={styles.historyCloseBtn} onPress={onClose}>
              <Icon name="times" size={20} color={colors.neutral[600]} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
              <Text style={styles.historyLoadingText}>Loading job history...</Text>
            </View>
          ) : jobs.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Icon name="briefcase" size={48} color={colors.neutral[300]} />
              <Text style={styles.historyEmptyText}>No jobs found</Text>
            </View>
          ) : (
            <FlatList
              data={jobs}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderJob}
              contentContainerStyle={styles.historyList}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary[600]}
                    style={{ marginVertical: spacing.md }}
                  />
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// Main Component
const CleanerManagement = ({ state }) => {
  const { goBack, navigate } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaners, setCleaners] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState("all"); // "all", "active", "frozen"

  // Modal states
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showJobHistoryModal, setShowJobHistoryModal] = useState(false);
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCleaners();
  }, [filter]);

  const fetchCleaners = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await CleanerManagementService.getCleaners(
        state.currentUser.token,
        filter
      );
      if (result.success) {
        setCleaners(result.cleaners || []);
      } else {
        setError(result.error || "Failed to load cleaners");
      }
    } catch (err) {
      console.error("Error fetching cleaners:", err);
      setError("Failed to load cleaners");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchCleaners(true);
  }, [filter]);

  const handleFreeze = (cleaner) => {
    setSelectedCleaner(cleaner);
    setShowFreezeModal(true);
  };

  const confirmFreeze = async (reason) => {
    if (!selectedCleaner) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await CleanerManagementService.freezeCleaner(
        state.currentUser.token,
        selectedCleaner.id,
        reason
      );

      if (result.success) {
        setSuccess(
          `${selectedCleaner.firstName}'s account has been frozen`
        );
        setShowFreezeModal(false);
        setSelectedCleaner(null);
        fetchCleaners();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to freeze cleaner");
      }
    } catch (err) {
      console.error("Error freezing cleaner:", err);
      setError("Failed to freeze cleaner");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnfreeze = async (cleaner) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await CleanerManagementService.unfreezeCleaner(
        state.currentUser.token,
        cleaner.id
      );

      if (result.success) {
        setSuccess(`${cleaner.firstName}'s account has been unfrozen`);
        fetchCleaners();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to unfreeze cleaner");
      }
    } catch (err) {
      console.error("Error unfreezing cleaner:", err);
      setError("Failed to unfreeze cleaner");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewProfile = (cleaner) => {
    navigate(`/owner/cleaners/${cleaner.id}`);
  };

  const handleViewJobHistory = (cleaner) => {
    setSelectedCleaner(cleaner);
    setShowJobHistoryModal(true);
  };

  const handleSendMessage = async (cleaner) => {
    try {
      const result = await MessageService.createOwnerDirectConversation(
        cleaner.id,
        state.currentUser.token
      );

      if (result.conversation) {
        navigate(`/messages/${result.conversation.id}`);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error("Error creating conversation:", err);
      setError("Failed to start conversation");
    }
  };

  const handleIssueWarning = (cleaner) => {
    setSelectedCleaner(cleaner);
    setShowWarningModal(true);
  };

  const confirmWarning = async (reason, severity) => {
    if (!selectedCleaner) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await CleanerManagementService.issueWarning(
        state.currentUser.token,
        selectedCleaner.id,
        reason,
        severity
      );

      if (result.success) {
        setSuccess(
          `Warning issued to ${selectedCleaner.firstName}. Total warnings: ${result.warningCount}`
        );
        setShowWarningModal(false);
        setSelectedCleaner(null);
        fetchCleaners();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to issue warning");
      }
    } catch (err) {
      console.error("Error issuing warning:", err);
      setError("Failed to issue warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Count stats
  const totalCleaners = cleaners.length;
  const frozenCount = cleaners.filter((c) => c.accountFrozen).length;
  const activeCount = totalCleaners - frozenCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Icon name="arrow-left" size={18} color={colors.neutral[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Cleaners</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Success/Error Messages */}
      {success && (
        <View style={styles.successBanner}>
          <Icon name="check-circle" size={16} color={colors.success[700]} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorBanner}>
          <Icon name="exclamation-circle" size={16} color={colors.error[700]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalCleaners}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.success[600] }]}>
            {activeCount}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.error[600] }]}>
            {frozenCount}
          </Text>
          <Text style={styles.statLabel}>Frozen</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {[
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "frozen", label: "Frozen" },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading cleaners...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {cleaners.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="users" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>
                {filter === "frozen"
                  ? "No frozen cleaners"
                  : filter === "active"
                  ? "No active cleaners"
                  : "No cleaners found"}
              </Text>
            </View>
          ) : (
            cleaners.map((cleaner) => (
              <CleanerCard
                key={cleaner.id}
                cleaner={cleaner}
                onFreeze={handleFreeze}
                onUnfreeze={handleUnfreeze}
                onViewProfile={handleViewProfile}
                onViewJobHistory={handleViewJobHistory}
                onSendMessage={handleSendMessage}
                onIssueWarning={handleIssueWarning}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Freeze Modal */}
      <FreezeModal
        visible={showFreezeModal}
        cleaner={selectedCleaner}
        onClose={() => {
          setShowFreezeModal(false);
          setSelectedCleaner(null);
        }}
        onConfirm={confirmFreeze}
        isSubmitting={isSubmitting}
      />

      {/* Warning Modal */}
      <WarningModal
        visible={showWarningModal}
        cleaner={selectedCleaner}
        onClose={() => {
          setShowWarningModal(false);
          setSelectedCleaner(null);
        }}
        onConfirm={confirmWarning}
        isSubmitting={isSubmitting}
      />

      {/* Job History Modal */}
      <JobHistoryModal
        visible={showJobHistoryModal}
        cleaner={selectedCleaner}
        onClose={() => {
          setShowJobHistoryModal(false);
          setSelectedCleaner(null);
        }}
        token={state.currentUser.token}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.success[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  successText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  filterTabs: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
  },
  filterTabActive: {
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[500],
  },
  filterTabTextActive: {
    color: colors.primary[600],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing["2xl"],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.base,
  },
  // Cleaner Card Styles
  cleanerCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cleanerCardFrozen: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[200],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFrozen: {
    backgroundColor: colors.error[100],
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  frozenBadgeIcon: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  cleanerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cleanerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  cleanerUsername: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  cleanerEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    marginTop: spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.medium,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusBadgeActive: {
    backgroundColor: colors.success[100],
  },
  statusBadgeFrozen: {
    backgroundColor: colors.error[100],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  statusTextActive: {
    color: colors.success[700],
  },
  statusTextFrozen: {
    color: colors.error[700],
  },
  frozenReasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.error[100],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  frozenReasonText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    fontStyle: "italic",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnSuccess: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  actionBtnDanger: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[200],
  },
  actionBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  actionBtnTextSuccess: {
    color: colors.success[700],
  },
  actionBtnTextDanger: {
    color: colors.error[700],
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  freezeModal: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    ...shadows.lg,
  },
  freezeIconContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  freezeTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[700],
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  freezeMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  freezeCleanerName: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  freezeReasonBox: {
    marginBottom: spacing.lg,
  },
  freezeReasonLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  freezeReasonInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[900],
    minHeight: 80,
    textAlignVertical: "top",
  },
  reasonError: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    marginTop: spacing.xs,
  },
  freezeActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  cancelBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
  },
  freezeConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.error[600],
  },
  freezeConfirmText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  // New styles for enhanced card
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  warningBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
  },
  metricValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    marginTop: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.neutral[200],
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[100],
  },
  earningsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  earningsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  earningsValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  actionsContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing.sm,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
    flex: 1,
  },
  actionBtnTextPrimary: {
    color: colors.primary[700],
  },
  actionBtnWarning: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[200],
    flex: 1,
  },
  actionBtnTextWarning: {
    color: colors.warning[700],
  },
  // Warning Modal Styles
  warningModal: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    ...shadows.lg,
  },
  warningIconContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  warningTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  warningMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  warningCleanerName: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  severityBox: {
    marginBottom: spacing.md,
  },
  severityLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  severityOptions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  severityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  severityOptionSelected: {
    backgroundColor: colors.warning[100],
    borderColor: colors.warning[300],
  },
  severityOptionSelectedMajor: {
    backgroundColor: colors.error[100],
    borderColor: colors.error[300],
  },
  severityOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[600],
  },
  severityOptionTextSelected: {
    color: colors.warning[700],
  },
  severityOptionTextSelectedMajor: {
    color: colors.error[700],
  },
  warningReasonBox: {
    marginBottom: spacing.lg,
  },
  warningReasonLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  warningReasonInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[900],
    minHeight: 80,
    textAlignVertical: "top",
  },
  warningActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  warningConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.warning[600],
  },
  warningConfirmText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
  // Job History Modal Styles
  historyModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  historyModal: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "80%",
    ...shadows.lg,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  historyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    flex: 1,
  },
  historyCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  historyLoading: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  historyLoadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },
  historyEmpty: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  historyEmptyText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.base,
  },
  historyList: {
    padding: spacing.lg,
  },
  jobItem: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  jobDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  jobStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  jobStatusCompleted: {
    backgroundColor: colors.success[100],
  },
  jobStatusIncomplete: {
    backgroundColor: colors.neutral[200],
  },
  jobStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  jobStatusTextCompleted: {
    color: colors.success[700],
  },
  jobStatusTextIncomplete: {
    color: colors.neutral[600],
  },
  jobAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    marginBottom: spacing.sm,
  },
  jobFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  jobEarnings: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  jobRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  jobRatingText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.medium,
  },
});

export default CleanerManagement;
