import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome";
import HRDashboardService from "../../services/fetchRequests/HRDashboardService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const { width: screenWidth } = Dimensions.get("window");

// Status badge component for disputes
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending_homeowner: { label: "Pending Homeowner", color: colors.warning[500], bg: colors.warning[100] },
    approved: { label: "Approved", color: colors.success[600], bg: colors.success[100] },
    denied: { label: "Denied by Homeowner", color: colors.error[600], bg: colors.error[100] },
    pending_owner: { label: "Needs Review", color: colors.warning[600], bg: colors.warning[100] },
    expired: { label: "Expired", color: colors.error[600], bg: colors.error[100] },
    owner_approved: { label: "Resolved - Approved", color: colors.success[600], bg: colors.success[100] },
    owner_denied: { label: "Resolved - Denied", color: colors.error[600], bg: colors.error[100] },
  };

  const config = statusConfig[status] || { label: status, color: colors.text.tertiary, bg: colors.neutral[100] };

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// Stat Card Component
const StatCard = ({ title, value, color = colors.primary[500], onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.statCard,
      { borderLeftColor: color },
      pressed && onPress && styles.statCardPressed,
    ]}
  >
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </Pressable>
);

// Section Header Component
const SectionHeader = ({ title, onPress, actionText }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onPress && (
      <Pressable onPress={onPress}>
        <Text style={styles.sectionAction}>{actionText || "View All"}</Text>
      </Pressable>
    )}
  </View>
);

// Dispute Card Component
const DisputeCard = ({ dispute, onPress }) => {
  const formatDate = (dateString) => {
    const options = { month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const priceDifference = Number(dispute.priceDifference) || 0;
  const homeAddress = dispute.home
    ? `${dispute.home.address}, ${dispute.home.city}`
    : "Unknown address";
  const cleanerName = dispute.cleaner
    ? `${dispute.cleaner.firstName} ${dispute.cleaner.lastName}`
    : "Unknown cleaner";
  const homeownerName = dispute.homeowner
    ? `${dispute.homeowner.firstName} ${dispute.homeowner.lastName}`
    : "Unknown homeowner";

  const needsReview = dispute.status === "denied" || dispute.status === "expired" || dispute.status === "pending_owner";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.disputeCard,
        needsReview && styles.disputeCardUrgent,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(dispute)}
    >
      <View style={styles.cardHeader}>
        <StatusBadge status={dispute.status} />
        <Text style={styles.requestId}>#{dispute.id}</Text>
      </View>

      <Text style={styles.homeAddress} numberOfLines={1}>{homeAddress}</Text>

      <View style={styles.cardInfoRow}>
        <View style={styles.cardInfoItem}>
          <Text style={styles.cardInfoLabel}>Cleaner</Text>
          <Text style={styles.cardInfoValue}>{cleanerName}</Text>
        </View>
        <View style={styles.cardInfoItem}>
          <Text style={styles.cardInfoLabel}>Homeowner</Text>
          <Text style={styles.cardInfoValue}>{homeownerName}</Text>
        </View>
      </View>

      <View style={styles.comparisonRow}>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>On File</Text>
          <Text style={styles.comparisonValue}>
            {dispute.originalNumBeds}b/{dispute.originalNumBaths}ba
          </Text>
        </View>
        <Icon name="arrow-right" size={14} color={colors.text.tertiary} />
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>Reported</Text>
          <Text style={styles.comparisonValueHighlight}>
            {dispute.reportedNumBeds}b/{dispute.reportedNumBaths}ba
          </Text>
        </View>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>Difference</Text>
          <Text style={[styles.comparisonValue, priceDifference > 0 && styles.pricePositive]}>
            {priceDifference > 0 ? `+$${priceDifference.toFixed(2)}` : "$0.00"}
          </Text>
        </View>
      </View>

      {dispute.appointment && (
        <Text style={styles.appointmentDate}>
          Appointment: {formatDate(dispute.appointment.date)}
        </Text>
      )}
    </Pressable>
  );
};

// Conversation Card Component
const ConversationCard = ({ conversation, onPress }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.conversationCard, pressed && styles.cardPressed]}
      onPress={() => onPress(conversation)}
    >
      <View style={styles.conversationHeader}>
        <View style={styles.conversationInfo}>
          <Text style={styles.conversationTitle} numberOfLines={1}>
            {conversation.customer?.name || conversation.title || "Support Conversation"}
          </Text>
          {conversation.customer?.type && (
            <View style={styles.userTypeBadge}>
              <Text style={styles.userTypeBadgeText}>
                {conversation.customer.type === "cleaner" ? "Cleaner" : "Client"}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.conversationTime}>{formatDate(conversation.lastMessageAt)}</Text>
      </View>
      {conversation.lastMessage && (
        <Text style={styles.conversationPreview} numberOfLines={2}>
          {conversation.lastMessageSender ? `${conversation.lastMessageSender}: ` : ""}
          {conversation.lastMessage}
        </Text>
      )}
    </Pressable>
  );
};

const HRDashboard = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickStats, setQuickStats] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);

  // Detail modal state
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [finalBeds, setFinalBeds] = useState("");
  const [finalBaths, setFinalBaths] = useState("");
  const [finalHalfBaths, setFinalHalfBaths] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const bedOptions = ["1", "2", "3", "4", "5", "6", "7", "8+"];
  const bathOptions = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5+"];
  const halfBathOptions = ["0", "1", "2", "3"];

  useEffect(() => {
    if (state.currentUser.token) {
      fetchDashboardData();
    }
  }, [state.currentUser.token]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [stats, disputesData, conversationsData] = await Promise.all([
        HRDashboardService.getQuickStats(state.currentUser.token),
        HRDashboardService.getPendingDisputes(state.currentUser.token),
        HRDashboardService.getSupportConversations(state.currentUser.token),
      ]);

      setQuickStats(stats);
      setDisputes(disputesData.disputes || []);
      setConversations(conversationsData.conversations || []);
    } catch (err) {
      console.error("[HRDashboard] Error fetching data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchDashboardData(true);
  }, [state.currentUser.token]);

  const handleDisputePress = (dispute) => {
    setSelectedDispute(dispute);
    setFinalBeds(dispute.reportedNumBeds?.toString() || "");
    setFinalBaths(dispute.reportedNumBaths?.toString() || "");
    setFinalHalfBaths(dispute.reportedNumHalfBaths?.toString() || "0");
    setOwnerNote("");
    setSubmitError("");
    setShowDetailModal(true);
  };

  const handleConversationPress = (conversation) => {
    navigate(`/messages/${conversation.id}`);
  };

  const handleResolveDispute = async (approve) => {
    if (!finalBeds || !finalBaths) {
      setSubmitError("Please select final bedroom and bathroom counts");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const result = await HRDashboardService.resolveDispute(
        state.currentUser.token,
        selectedDispute.id,
        {
          decision: approve ? "approve" : "deny",
          finalNumBeds: finalBeds,
          finalNumBaths: finalBaths,
          finalNumHalfBaths: finalHalfBaths || "0",
          ownerNote: ownerNote,
        }
      );

      if (result.success) {
        setShowDetailModal(false);
        fetchDashboardData(true);
      } else {
        setSubmitError(result.error || "Failed to resolve dispute");
      }
    } catch (err) {
      setSubmitError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchDashboardData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
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
        <Text style={styles.headerTitle}>HR Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
      </View>

      {/* Quick Stats Row */}
      <View style={styles.quickStatsRow}>
        <StatCard
          title="Pending Disputes"
          value={quickStats?.pendingDisputes || 0}
          color={colors.warning[500]}
        />
        <StatCard
          title="Support Chats"
          value={quickStats?.supportConversations || 0}
          color={colors.primary[500]}
        />
        <StatCard
          title="Resolved This Week"
          value={quickStats?.disputesResolvedThisWeek || 0}
          color={colors.success[500]}
        />
      </View>

      {/* Pending Disputes Section */}
      <SectionHeader title="Pending Disputes" />
      {disputes.length === 0 ? (
        <View style={styles.emptySection}>
          <Icon name="check-circle" size={32} color={colors.success[500]} />
          <Text style={styles.emptyText}>No pending disputes</Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {disputes.map((dispute) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              onPress={handleDisputePress}
            />
          ))}
        </View>
      )}

      {/* Support Conversations Section */}
      <SectionHeader
        title="Support Conversations"
        onPress={() => navigate("/messages")}
        actionText="View All"
      />
      {conversations.length === 0 ? (
        <View style={styles.emptySection}>
          <Icon name="comments" size={32} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No support conversations</Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {conversations.slice(0, 5).map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              onPress={handleConversationPress}
            />
          ))}
        </View>
      )}

      {/* Dispute Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Dispute #{selectedDispute?.id}</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowDetailModal(false)}
                >
                  <Icon name="times" size={20} color={colors.text.secondary} />
                </Pressable>
              </View>

              {selectedDispute && (
                <>
                  <StatusBadge status={selectedDispute.status} />

                  {/* Home Address */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Property</Text>
                    <Text style={styles.detailValue}>
                      {selectedDispute.home?.address}, {selectedDispute.home?.city}, {selectedDispute.home?.state} {selectedDispute.home?.zipcode}
                    </Text>
                  </View>

                  {/* Parties */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailHalf}>
                      <Text style={styles.detailLabel}>Cleaner</Text>
                      <Text style={styles.detailValue}>
                        {selectedDispute.cleaner?.firstName} {selectedDispute.cleaner?.lastName}
                      </Text>
                      {selectedDispute.cleaner?.falseClaimCount > 0 && (
                        <Text style={styles.warningText}>
                          {selectedDispute.cleaner.falseClaimCount} previous false claims
                        </Text>
                      )}
                    </View>
                    <View style={styles.detailHalf}>
                      <Text style={styles.detailLabel}>Homeowner</Text>
                      <Text style={styles.detailValue}>
                        {selectedDispute.homeowner?.firstName} {selectedDispute.homeowner?.lastName}
                      </Text>
                      {selectedDispute.homeowner?.falseHomeSizeCount > 0 && (
                        <Text style={styles.warningText}>
                          {selectedDispute.homeowner.falseHomeSizeCount} previous false size reports
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Size Comparison */}
                  <View style={styles.comparisonSection}>
                    <Text style={styles.detailLabel}>Size Comparison</Text>
                    <View style={styles.sizeCompare}>
                      <View style={styles.sizeBox}>
                        <Text style={styles.sizeBoxLabel}>On File</Text>
                        <Text style={styles.sizeBoxValue}>
                          {selectedDispute.originalNumBeds} bed / {selectedDispute.originalNumBaths} bath
                        </Text>
                      </View>
                      <Icon name="arrow-right" size={20} color={colors.text.tertiary} />
                      <View style={[styles.sizeBox, styles.sizeBoxHighlight]}>
                        <Text style={styles.sizeBoxLabel}>Reported</Text>
                        <Text style={styles.sizeBoxValueHighlight}>
                          {selectedDispute.reportedNumBeds} bed / {selectedDispute.reportedNumBaths} bath
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.priceDiff}>
                      Price difference: ${Number(selectedDispute.priceDifference || 0).toFixed(2)}
                    </Text>
                  </View>

                  {/* Photos */}
                  {selectedDispute.photos && selectedDispute.photos.length > 0 && (
                    <View style={styles.photosSection}>
                      <Text style={styles.detailLabel}>Evidence Photos</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {selectedDispute.photos.map((photo) => (
                          <View key={photo.id} style={styles.photoItem}>
                            <Image
                              source={{ uri: photo.photoUrl }}
                              style={styles.photoImage}
                              resizeMode="cover"
                            />
                            <Text style={styles.photoLabel}>
                              {photo.roomType} #{photo.roomNumber}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Notes */}
                  {selectedDispute.cleanerNotes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Cleaner Notes</Text>
                      <Text style={styles.noteText}>{selectedDispute.cleanerNotes}</Text>
                    </View>
                  )}
                  {selectedDispute.homeownerNotes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Homeowner Notes</Text>
                      <Text style={styles.noteText}>{selectedDispute.homeownerNotes}</Text>
                    </View>
                  )}

                  {/* Resolution Form */}
                  {(selectedDispute.status === "pending_owner" ||
                    selectedDispute.status === "denied" ||
                    selectedDispute.status === "expired") && (
                    <View style={styles.resolutionForm}>
                      <Text style={styles.formTitle}>Resolution</Text>

                      <Text style={styles.formLabel}>Final Bedroom Count</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={finalBeds}
                          onValueChange={setFinalBeds}
                          style={styles.picker}
                        >
                          <Picker.Item label="Select..." value="" />
                          {bedOptions.map((option) => (
                            <Picker.Item key={option} label={option} value={option} />
                          ))}
                        </Picker>
                      </View>

                      <Text style={styles.formLabel}>Final Full Bathroom Count</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={finalBaths}
                          onValueChange={setFinalBaths}
                          style={styles.picker}
                        >
                          <Picker.Item label="Select..." value="" />
                          {bathOptions.map((option) => (
                            <Picker.Item key={option} label={option} value={option} />
                          ))}
                        </Picker>
                      </View>

                      <Text style={styles.formLabel}>Final Half Bathroom Count</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={finalHalfBaths}
                          onValueChange={setFinalHalfBaths}
                          style={styles.picker}
                        >
                          {halfBathOptions.map((option) => (
                            <Picker.Item key={option} label={option} value={option} />
                          ))}
                        </Picker>
                      </View>

                      <Text style={styles.formLabel}>Resolution Notes</Text>
                      <TextInput
                        style={styles.textArea}
                        value={ownerNote}
                        onChangeText={setOwnerNote}
                        placeholder="Add notes about your decision..."
                        multiline
                        numberOfLines={3}
                        placeholderTextColor={colors.text.tertiary}
                      />

                      {submitError ? (
                        <Text style={styles.errorMessage}>{submitError}</Text>
                      ) : null}

                      <View style={styles.buttonRow}>
                        <Pressable
                          style={[styles.actionButton, styles.denyButton]}
                          onPress={() => handleResolveDispute(false)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color={colors.white} />
                          ) : (
                            <>
                              <Icon name="times" size={16} color={colors.white} />
                              <Text style={styles.buttonText}>Deny Claim</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          style={[styles.actionButton, styles.approveButton]}
                          onPress={() => handleResolveDispute(true)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color={colors.white} />
                          ) : (
                            <>
                              <Icon name="check" size={16} color={colors.white} />
                              <Text style={styles.buttonText}>Approve Claim</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentContainer: {
    paddingBottom: spacing[8],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    padding: spacing[6],
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.error[600],
    textAlign: "center",
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  quickStatsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  statCardPressed: {
    opacity: 0.9,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionAction: {
    fontSize: typography.fontSize.base,
    color: colors.primary[500],
    fontWeight: "600",
  },
  emptySection: {
    alignItems: "center",
    padding: spacing[8],
    backgroundColor: colors.white,
    marginHorizontal: spacing[4],
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing[2],
  },
  cardList: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  disputeCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  disputeCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[2],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
  },
  requestId: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  homeAddress: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "600",
    marginBottom: spacing[2],
  },
  cardInfoRow: {
    flexDirection: "row",
    gap: spacing[4],
    marginBottom: spacing[2],
  },
  cardInfoItem: {
    flex: 1,
  },
  cardInfoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  cardInfoValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: "500",
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  comparisonItem: {
    flex: 1,
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  comparisonValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: "600",
  },
  comparisonValueHighlight: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: "700",
  },
  pricePositive: {
    color: colors.success[600],
  },
  appointmentDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing[2],
  },
  conversationCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing[2],
  },
  conversationInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginRight: spacing[2],
  },
  conversationTitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "600",
    flex: 1,
  },
  userTypeBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  userTypeBadgeText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: "500",
  },
  conversationTime: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  conversationPreview: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    padding: spacing[4],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[4],
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing[2],
  },
  detailSection: {
    marginTop: spacing[4],
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing[1],
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  detailRow: {
    flexDirection: "row",
    gap: spacing[4],
    marginTop: spacing[4],
  },
  detailHalf: {
    flex: 1,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    marginTop: spacing[1],
  },
  comparisonSection: {
    marginTop: spacing[4],
  },
  sizeCompare: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginTop: spacing[2],
  },
  sizeBox: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    padding: spacing[3],
    borderRadius: radius.md,
    alignItems: "center",
  },
  sizeBoxHighlight: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  sizeBoxLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  sizeBoxValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "600",
    marginTop: spacing[1],
  },
  sizeBoxValueHighlight: {
    fontSize: typography.fontSize.base,
    color: colors.primary[700],
    fontWeight: "700",
    marginTop: spacing[1],
  },
  priceDiff: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    textAlign: "center",
    marginTop: spacing[3],
    fontWeight: "600",
  },
  photosSection: {
    marginTop: spacing[4],
  },
  photoItem: {
    marginRight: spacing[3],
  },
  photoImage: {
    width: 120,
    height: 90,
    borderRadius: radius.md,
  },
  photoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing[1],
    textAlign: "center",
  },
  noteText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    backgroundColor: colors.neutral[50],
    padding: spacing[3],
    borderRadius: radius.md,
  },
  resolutionForm: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  formTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing[1],
    marginTop: spacing[3],
  },
  pickerContainer: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  textArea: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: spacing[3],
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  errorMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    marginTop: spacing[2],
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[4],
    paddingBottom: spacing[4],
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  approveButton: {
    backgroundColor: colors.success[500],
  },
  denyButton: {
    backgroundColor: colors.error[500],
  },
  buttonText: {
    fontSize: typography.fontSize.base,
    color: colors.white,
    fontWeight: "600",
  },
});

export default HRDashboard;
