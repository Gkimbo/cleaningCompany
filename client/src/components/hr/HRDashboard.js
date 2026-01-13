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

// Quick Action Button Component
const QuickActionButton = ({ icon, label, onPress, color = colors.primary[500], badge }) => (
  <Pressable
    style={({ pressed }) => [
      styles.quickAction,
      pressed && styles.quickActionPressed,
    ]}
    onPress={onPress}
  >
    <View style={[styles.quickActionIcon, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={22} color={color} />
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </Pressable>
);

// Status badge component for disputes
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending_homeowner: { label: "Awaiting Homeowner", color: colors.warning[600], bg: colors.warning[50], icon: "clock-o" },
    approved: { label: "Approved", color: colors.success[600], bg: colors.success[50], icon: "check" },
    denied: { label: "Homeowner Denied", color: colors.error[600], bg: colors.error[50], icon: "exclamation-circle" },
    pending_owner: { label: "Needs Your Review", color: colors.warning[600], bg: colors.warning[50], icon: "eye" },
    expired: { label: "Expired", color: colors.error[600], bg: colors.error[50], icon: "clock-o" },
    owner_approved: { label: "Resolved", color: colors.success[600], bg: colors.success[50], icon: "check-circle" },
    owner_denied: { label: "Claim Denied", color: colors.error[600], bg: colors.error[50], icon: "times-circle" },
  };

  const config = statusConfig[status] || { label: status, color: colors.text.tertiary, bg: colors.neutral[100], icon: "question" };

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Icon name={config.icon} size={12} color={config.color} style={{ marginRight: 4 }} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// Enhanced Stat Card Component
const StatCard = ({ title, value, icon, color = colors.primary[500], onPress, subtitle }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.statCard,
      pressed && onPress && styles.statCardPressed,
    ]}
  >
    <View style={[styles.statIconContainer, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </Pressable>
);

// Section Header Component
const SectionHeader = ({ title, icon, onPress, actionText }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      {icon && <Icon name={icon} size={16} color={colors.text.primary} style={{ marginRight: 8 }} />}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {onPress && (
      <Pressable onPress={onPress} style={styles.sectionActionButton}>
        <Text style={styles.sectionAction}>{actionText || "View All"}</Text>
        <Icon name="chevron-right" size={12} color={colors.primary[500]} style={{ marginLeft: 4 }} />
      </Pressable>
    )}
  </View>
);

// Enhanced Dispute Card Component
const DisputeCard = ({ dispute, onPress }) => {
  const formatDate = (dateString) => {
    const options = { month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const priceDifference = Number(dispute.priceDifference) || 0;
  const homeAddress = dispute.home
    ? `${dispute.home.address}, ${dispute.home.city}`
    : "Unknown address";
  const cleanerName = dispute.cleaner
    ? `${dispute.cleaner.firstName} ${dispute.cleaner.lastName}`
    : "Unknown cleaner";

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
      <View style={styles.disputeCardHeader}>
        <StatusBadge status={dispute.status} />
        {needsReview && (
          <View style={styles.actionNeededBadge}>
            <Text style={styles.actionNeededText}>Action Needed</Text>
          </View>
        )}
      </View>

      <Text style={styles.homeAddress} numberOfLines={1}>{homeAddress}</Text>

      <View style={styles.disputeInfoRow}>
        <View style={styles.disputeInfoItem}>
          <Icon name="user" size={12} color={colors.text.tertiary} />
          <Text style={styles.disputeInfoText}>{cleanerName}</Text>
        </View>
        {dispute.appointment && (
          <View style={styles.disputeInfoItem}>
            <Icon name="calendar" size={12} color={colors.text.tertiary} />
            <Text style={styles.disputeInfoText}>{formatDate(dispute.appointment.date)}</Text>
          </View>
        )}
      </View>

      <View style={styles.sizeComparisonRow}>
        <View style={styles.sizeItem}>
          <Text style={styles.sizeLabel}>Listed</Text>
          <Text style={styles.sizeValue}>{dispute.originalNumBeds}bd / {dispute.originalNumBaths}ba</Text>
        </View>
        <Icon name="long-arrow-right" size={16} color={colors.text.tertiary} />
        <View style={styles.sizeItem}>
          <Text style={styles.sizeLabel}>Reported</Text>
          <Text style={[styles.sizeValue, styles.sizeValueHighlight]}>
            {dispute.reportedNumBeds}bd / {dispute.reportedNumBaths}ba
          </Text>
        </View>
        {priceDifference > 0 && (
          <View style={styles.priceDiffBadge}>
            <Text style={styles.priceDiffText}>+${priceDifference.toFixed(0)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

// Enhanced Conversation Card Component
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

  const customerName = conversation.customer?.name || conversation.title || "Support Conversation";
  const customerType = conversation.customer?.type;
  const initials = customerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [styles.conversationCard, pressed && styles.cardPressed]}
      onPress={() => onPress(conversation)}
    >
      <View style={[
        styles.avatar,
        { backgroundColor: customerType === "cleaner" ? colors.secondary[100] : colors.primary[100] }
      ]}>
        <Text style={[
          styles.avatarText,
          { color: customerType === "cleaner" ? colors.secondary[700] : colors.primary[700] }
        ]}>
          {initials}
        </Text>
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationTitle} numberOfLines={1}>{customerName}</Text>
          <Text style={styles.conversationTime}>{formatDate(conversation.lastMessageAt)}</Text>
        </View>
        {customerType && (
          <View style={[
            styles.userTypeBadge,
            { backgroundColor: customerType === "cleaner" ? colors.secondary[50] : colors.primary[50] }
          ]}>
            <Text style={[
              styles.userTypeBadgeText,
              { color: customerType === "cleaner" ? colors.secondary[700] : colors.primary[700] }
            ]}>
              {customerType === "cleaner" ? "Cleaner" : "Client"}
            </Text>
          </View>
        )}
        {conversation.lastMessage && (
          <Text style={styles.conversationPreview} numberOfLines={1}>
            {conversation.lastMessage}
          </Text>
        )}
      </View>
      <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
    </Pressable>
  );
};

// Empty State Component
const EmptyState = ({ icon, title, subtitle }) => (
  <View style={styles.emptySection}>
    <View style={styles.emptyIconContainer}>
      <Icon name={icon} size={28} color={colors.text.tertiary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </View>
);

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

  const bedOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12+"];
  const bathOptions = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8+"];
  const halfBathOptions = ["0", "1", "2", "3", "4", "5+"];

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const pendingCount = quickStats?.pendingDisputes || 0;
  const needsActionCount = disputes.filter(d =>
    d.status === "denied" || d.status === "expired" || d.status === "pending_owner"
  ).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchDashboardData}>
          <Icon name="refresh" size={16} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.retryButtonText}>Try Again</Text>
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
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.headerTitle}>HR Dashboard</Text>
        </View>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <QuickActionButton
            icon="users"
            label="Applications"
            color={colors.secondary[500]}
            onPress={() => navigate("/list-of-applications")}
            badge={quickStats?.pendingApplications}
          />
          <QuickActionButton
            icon="id-card"
            label="Employees"
            color={colors.primary[500]}
            onPress={() => navigate("/employees")}
          />
          <QuickActionButton
            icon="balance-scale"
            label="Conflicts"
            color={colors.error[500]}
            onPress={() => navigate("/conflicts")}
            badge={quickStats?.pendingConflicts}
          />
          <QuickActionButton
            icon="comments"
            label="Messages"
            color={colors.success[500]}
            onPress={() => navigate("/messages")}
            badge={quickStats?.unreadMessages}
          />
        </View>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <StatCard
            title="Pending Disputes"
            value={pendingCount}
            icon="exclamation-triangle"
            color={pendingCount > 0 ? colors.warning[500] : colors.success[500]}
            subtitle={needsActionCount > 0 ? `${needsActionCount} need action` : null}
          />
          <StatCard
            title="Support Chats"
            value={quickStats?.supportConversations || 0}
            icon="comments-o"
            color={colors.primary[500]}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            title="Resolved This Week"
            value={quickStats?.disputesResolvedThisWeek || 0}
            icon="check-circle"
            color={colors.success[500]}
          />
          <StatCard
            title="Active Cleaners"
            value={quickStats?.activeCleaners || 0}
            icon="user-circle"
            color={colors.secondary[500]}
          />
        </View>
      </View>

      {/* Pending Disputes Section */}
      <SectionHeader
        title="Disputes Requiring Attention"
        icon="gavel"
      />
      {disputes.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="All caught up!"
          subtitle="No pending disputes to review"
        />
      ) : (
        <View style={styles.cardList}>
          {disputes.slice(0, 5).map((dispute) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              onPress={handleDisputePress}
            />
          ))}
          {disputes.length > 5 && (
            <Pressable style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>View All {disputes.length} Disputes</Text>
              <Icon name="chevron-right" size={12} color={colors.primary[500]} />
            </Pressable>
          )}
        </View>
      )}

      {/* Support Conversations Section */}
      <SectionHeader
        title="Recent Support Messages"
        icon="envelope"
        onPress={() => navigate("/messages")}
        actionText="All Messages"
      />
      {conversations.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No messages"
          subtitle="Support conversations will appear here"
        />
      ) : (
        <View style={styles.cardList}>
          {conversations.slice(0, 4).map((conversation) => (
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
            {/* Fixed Header */}
            <View style={styles.modalHeaderFixed}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Dispute Details</Text>
                  <Text style={styles.modalSubtitle}>#{selectedDispute?.id}</Text>
                </View>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowDetailModal(false)}
                >
                  <Icon name="times" size={18} color={colors.text.primary} />
                </Pressable>
              </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >

              {selectedDispute && (
                <>
                  <View style={styles.modalStatusRow}>
                    <StatusBadge status={selectedDispute.status} />
                  </View>

                  {/* Property Info Card */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoCardHeader}>
                      <Icon name="home" size={16} color={colors.primary[500]} />
                      <Text style={styles.infoCardTitle}>Property</Text>
                    </View>
                    <Text style={styles.infoCardValue}>
                      {selectedDispute.home?.address}
                    </Text>
                    <Text style={styles.infoCardSubvalue}>
                      {selectedDispute.home?.city}, {selectedDispute.home?.state} {selectedDispute.home?.zipcode}
                    </Text>
                  </View>

                  {/* Parties Info */}
                  <View style={styles.partiesRow}>
                    <View style={[styles.partyCard, styles.partyCardCleaner]}>
                      <View style={styles.partyHeader}>
                        <Icon name="user" size={18} color={colors.secondary[600]} />
                        <Text style={styles.partyLabel}>Cleaner</Text>
                      </View>
                      <Text style={styles.partyName}>
                        {selectedDispute.cleaner?.firstName} {selectedDispute.cleaner?.lastName}
                      </Text>
                      {selectedDispute.cleaner?.falseClaimCount > 0 && (
                        <View style={styles.warningBadge}>
                          <Icon name="warning" size={12} color={colors.warning[600]} />
                          <Text style={styles.warningBadgeText}>
                            {selectedDispute.cleaner.falseClaimCount} prior false claims
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.partyCard, styles.partyCardHomeowner]}>
                      <View style={styles.partyHeader}>
                        <Icon name="home" size={18} color={colors.primary[600]} />
                        <Text style={styles.partyLabel}>Homeowner</Text>
                      </View>
                      <Text style={styles.partyName}>
                        {selectedDispute.homeowner?.firstName} {selectedDispute.homeowner?.lastName}
                      </Text>
                      {selectedDispute.homeowner?.falseHomeSizeCount > 0 && (
                        <View style={styles.warningBadge}>
                          <Icon name="warning" size={12} color={colors.warning[600]} />
                          <Text style={styles.warningBadgeText}>
                            {selectedDispute.homeowner.falseHomeSizeCount} prior size issues
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Size Comparison Card */}
                  <View style={styles.comparisonCard}>
                    <Text style={styles.comparisonTitle}>Size Discrepancy</Text>
                    <View style={styles.comparisonBoxes}>
                      <View style={styles.comparisonBox}>
                        <Text style={styles.comparisonBoxLabel}>On File</Text>
                        <Text style={styles.comparisonBoxValue}>
                          {selectedDispute.originalNumBeds} bed
                        </Text>
                        <Text style={styles.comparisonBoxValue}>
                          {selectedDispute.originalNumBaths} bath
                        </Text>
                      </View>
                      <View style={styles.comparisonArrow}>
                        <Icon name="arrow-right" size={20} color={colors.text.tertiary} />
                      </View>
                      <View style={[styles.comparisonBox, styles.comparisonBoxHighlight]}>
                        <Text style={styles.comparisonBoxLabel}>Reported</Text>
                        <Text style={styles.comparisonBoxValueHighlight}>
                          {selectedDispute.reportedNumBeds} bed
                        </Text>
                        <Text style={styles.comparisonBoxValueHighlight}>
                          {selectedDispute.reportedNumBaths} bath
                        </Text>
                      </View>
                    </View>
                    <View style={styles.priceDiffRow}>
                      <Text style={styles.priceDiffLabel}>Price Difference:</Text>
                      <Text style={styles.priceDiffValue}>
                        ${Number(selectedDispute.priceDifference || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Photos */}
                  {selectedDispute.photos && selectedDispute.photos.length > 0 && (
                    <View style={styles.photosSection}>
                      <Text style={styles.photosSectionTitle}>
                        <Icon name="camera" size={14} color={colors.text.primary} /> Evidence Photos
                      </Text>
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
                  {(selectedDispute.cleanerNotes || selectedDispute.homeownerNotes) && (
                    <View style={styles.notesSection}>
                      {selectedDispute.cleanerNotes && (
                        <View style={styles.noteCard}>
                          <Text style={styles.noteLabel}>Cleaner's Notes</Text>
                          <Text style={styles.noteText}>{selectedDispute.cleanerNotes}</Text>
                        </View>
                      )}
                      {selectedDispute.homeownerNotes && (
                        <View style={styles.noteCard}>
                          <Text style={styles.noteLabel}>Homeowner's Response</Text>
                          <Text style={styles.noteText}>{selectedDispute.homeownerNotes}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Resolution Form */}
                  {(selectedDispute.status === "pending_owner" ||
                    selectedDispute.status === "denied" ||
                    selectedDispute.status === "expired") && (
                    <View style={styles.resolutionForm}>
                      <View style={styles.formTitleRow}>
                        <Icon name="gavel" size={20} color={colors.primary[600]} />
                        <Text style={styles.formTitle}>Make Your Decision</Text>
                      </View>
                      <Text style={styles.formDescription}>
                        Set the final room counts for this property. This will update the home's listing and affect future pricing.
                      </Text>

                      {/* Bedrooms */}
                      <View style={styles.selectorSection}>
                        <Text style={styles.selectorLabel}>
                          <Icon name="bed" size={14} color={colors.text.primary} /> Bedrooms
                        </Text>
                        <View style={styles.selectorRow}>
                          {bedOptions.map((option) => (
                            <Pressable
                              key={option}
                              style={[
                                styles.selectorButton,
                                finalBeds === option && styles.selectorButtonActive,
                              ]}
                              onPress={() => setFinalBeds(option)}
                            >
                              <Text
                                style={[
                                  styles.selectorButtonText,
                                  finalBeds === option && styles.selectorButtonTextActive,
                                ]}
                              >
                                {option}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {/* Full Baths */}
                      <View style={styles.selectorSection}>
                        <Text style={styles.selectorLabel}>
                          <Icon name="bath" size={14} color={colors.text.primary} /> Full Baths
                        </Text>
                        <View style={styles.selectorRow}>
                          {bathOptions.map((option) => (
                            <Pressable
                              key={option}
                              style={[
                                styles.selectorButton,
                                finalBaths === option && styles.selectorButtonActive,
                              ]}
                              onPress={() => setFinalBaths(option)}
                            >
                              <Text
                                style={[
                                  styles.selectorButtonText,
                                  finalBaths === option && styles.selectorButtonTextActive,
                                ]}
                              >
                                {option}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {/* Half Baths */}
                      <View style={styles.selectorSection}>
                        <Text style={styles.selectorLabel}>
                          <Icon name="tint" size={14} color={colors.text.primary} /> Half Baths
                        </Text>
                        <View style={styles.selectorRow}>
                          {halfBathOptions.map((option) => (
                            <Pressable
                              key={option}
                              style={[
                                styles.selectorButton,
                                finalHalfBaths === option && styles.selectorButtonActive,
                              ]}
                              onPress={() => setFinalHalfBaths(option)}
                            >
                              <Text
                                style={[
                                  styles.selectorButtonText,
                                  finalHalfBaths === option && styles.selectorButtonTextActive,
                                ]}
                              >
                                {option}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <Text style={styles.notesLabel}>Resolution Notes (Optional)</Text>
                      <TextInput
                        style={styles.textArea}
                        value={ownerNote}
                        onChangeText={setOwnerNote}
                        placeholder="Explain your decision..."
                        multiline
                        numberOfLines={3}
                        placeholderTextColor={colors.text.tertiary}
                      />

                      {submitError ? (
                        <View style={styles.errorBanner}>
                          <Icon name="exclamation-circle" size={14} color={colors.error[600]} />
                          <Text style={styles.errorBannerText}>{submitError}</Text>
                        </View>
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
    backgroundColor: colors.neutral[50],
  },
  contentContainer: {
    paddingBottom: spacing["3xl"],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  // Quick Actions
  quickActionsContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  quickActionsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickAction: {
    alignItems: "center",
    flex: 1,
  },
  quickActionPressed: {
    opacity: 0.7,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
  },
  quickActionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  // Stats
  statsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  statCardPressed: {
    opacity: 0.9,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    marginTop: spacing.xs,
    fontWeight: "500",
  },
  // Section Header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionActionButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionAction: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[500],
    fontWeight: "600",
  },
  // Empty State
  emptySection: {
    alignItems: "center",
    padding: spacing["2xl"],
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  // Card List
  cardList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  // Dispute Card
  disputeCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  disputeCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  disputeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actionNeededBadge: {
    backgroundColor: colors.error[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  actionNeededText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
  },
  homeAddress: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  disputeInfoRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  disputeInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  disputeInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  sizeComparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  sizeItem: {
    flex: 1,
  },
  sizeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  sizeValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: "600",
  },
  sizeValueHighlight: {
    color: colors.primary[600],
  },
  priceDiffBadge: {
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  priceDiffText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
  },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  viewMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[500],
    fontWeight: "600",
  },
  // Conversation Card
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  conversationTitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "600",
    flex: 1,
    marginRight: spacing.sm,
  },
  conversationTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  userTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  userTypeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "500",
  },
  conversationPreview: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 25,
  },
  modalHeaderFixed: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalHandle: {
    width: 48,
    height: 5,
    backgroundColor: colors.neutral[400],
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[500],
    marginTop: 4,
    fontWeight: "500",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing["3xl"],
  },
  modalStatusRow: {
    marginBottom: spacing.lg,
  },
  // Info Card
  infoCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  infoCardTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginLeft: spacing.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoCardValue: {
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    fontWeight: "700",
  },
  infoCardSubvalue: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: 4,
  },
  // Parties
  partiesRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  partyCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 2,
  },
  partyCardCleaner: {
    backgroundColor: colors.secondary[50],
    borderColor: colors.secondary[300],
  },
  partyCardHomeowner: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  partyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  partyLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  partyName: {
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    fontWeight: "700",
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: 4,
  },
  warningBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
  },
  // Comparison Card
  comparisonCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.warning[200],
  },
  comparisonTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: "700",
    marginBottom: spacing.lg,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  comparisonBoxes: {
    flexDirection: "row",
    alignItems: "center",
  },
  comparisonBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  comparisonBoxHighlight: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  comparisonArrow: {
    paddingHorizontal: spacing.sm,
  },
  comparisonBoxLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  comparisonBoxValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: "600",
  },
  comparisonBoxValueHighlight: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.bold,
  },
  priceDiffRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing.sm,
  },
  priceDiffLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  priceDiffValue: {
    fontSize: typography.fontSize.lg,
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
  },
  // Photos
  photosSection: {
    marginBottom: spacing.md,
  },
  photosSectionTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  photoItem: {
    marginRight: spacing.md,
  },
  photoImage: {
    width: 120,
    height: 90,
    borderRadius: radius.lg,
  },
  photoLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  // Notes
  notesSection: {
    marginBottom: spacing.md,
  },
  noteCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noteLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: "500",
    marginBottom: spacing.xs,
  },
  noteText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  // Resolution Form
  resolutionForm: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary[200],
  },
  formTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  formTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  formDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  selectorSection: {
    marginBottom: spacing.lg,
  },
  selectorLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  selectorButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 50,
    alignItems: "center",
  },
  selectorButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  selectorButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  selectorButtonTextActive: {
    color: colors.white,
  },
  notesLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "700",
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textArea: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  errorBannerText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  approveButton: {
    backgroundColor: colors.success[600],
  },
  denyButton: {
    backgroundColor: colors.error[600],
  },
  buttonText: {
    fontSize: typography.fontSize.base,
    color: colors.white,
    fontWeight: "700",
  },
});

export default HRDashboard;
