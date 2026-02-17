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
  Alert,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome5";
import HRDashboardService from "../../services/fetchRequests/HRDashboardService";
import CreateSupportTicketModal from "../conflicts/modals/CreateSupportTicketModal";
import { shadows } from "../../services/styles/theme";

// Tool tabs for resolution
const TOOL_TABS = [
  { key: "details", label: "Details", icon: "info-circle" },
  { key: "parties", label: "Parties", icon: "users" },
  { key: "history", label: "History", icon: "history" },
  { key: "tools", label: "Tools", icon: "tools" },
];

const { width: screenWidth } = Dimensions.get("window");

// Modern Stat Card
const StatCard = ({ title, value, icon, color, trend, trendUp, subtitle }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <View style={styles.statCardHeader}>
      <View style={[styles.statIconWrap, { backgroundColor: color + "15" }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trendUp ? "#DCFCE7" : "#FEE2E2" }]}>
          <Icon name={trendUp ? "arrow-up" : "arrow-down"} size={8} color={trendUp ? "#16A34A" : "#DC2626"} />
          <Text style={[styles.trendText, { color: trendUp ? "#16A34A" : "#DC2626" }]}>{trend}</Text>
        </View>
      )}
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

// Action Button
const ActionButton = ({ icon, label, color, onPress, badge }) => (
  <Pressable
    style={({ pressed }) => [
      styles.actionBtn,
      pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
    ]}
    onPress={onPress}
  >
    <View style={[styles.actionBtnIcon, { backgroundColor: color }]}>
      <Icon name={icon} size={18} color="#fff" />
      {badge > 0 && (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.actionBtnLabel}>{label}</Text>
  </Pressable>
);

// Status Chip
const StatusChip = ({ status }) => {
  const configs = {
    pending_homeowner: { label: "Awaiting", bg: "#FEF3C7", color: "#D97706", icon: "clock" },
    approved: { label: "Approved", bg: "#DCFCE7", color: "#16A34A", icon: "check" },
    denied: { label: "Denied", bg: "#FEE2E2", color: "#DC2626", icon: "times" },
    pending_owner: { label: "Review", bg: "#E9D5FF", color: "#7C3AED", icon: "eye" },
    expired: { label: "Expired", bg: "#FEE2E2", color: "#DC2626", icon: "clock" },
    owner_approved: { label: "Resolved", bg: "#DCFCE7", color: "#16A34A", icon: "check-circle" },
    owner_denied: { label: "Claim Denied", bg: "#FEE2E2", color: "#DC2626", icon: "times-circle" },
  };
  const config = configs[status] || { label: status, bg: "#E5E7EB", color: "#6B7280", icon: "question" };

  return (
    <View style={[styles.chip, { backgroundColor: config.bg }]}>
      <Icon name={config.icon} size={10} color={config.color} />
      <Text style={[styles.chipText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// Dispute Card
const DisputeCard = ({ dispute, onPress }) => {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 1) return "Today";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const homeAddress = dispute.home ? `${dispute.home.address}` : "Unknown";
  const cleanerName = dispute.cleaner
    ? `${dispute.cleaner.firstName} ${dispute.cleaner.lastName?.charAt(0)}.`
    : "Unknown";
  const needsReview = ["denied", "expired", "pending_owner"].includes(dispute.status);
  const priceDiff = Number(dispute.priceDifference) || 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.disputeCard,
        needsReview && styles.disputeCardUrgent,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
      ]}
      onPress={() => onPress(dispute)}
    >
      <View style={styles.disputeHeader}>
        <StatusChip status={dispute.status} />
        {needsReview && (
          <View style={styles.urgentBadge}>
            <Icon name="exclamation" size={8} color="#DC2626" />
            <Text style={styles.urgentText}>Action</Text>
          </View>
        )}
      </View>

      <Text style={styles.disputeAddress} numberOfLines={1}>{homeAddress}</Text>

      <View style={styles.disputeMeta}>
        <View style={styles.disputeMetaItem}>
          <Icon name="user" size={12} color="#9CA3AF" solid />
          <Text style={styles.disputeMetaText}>{cleanerName}</Text>
        </View>
        {dispute.appointment && (
          <View style={styles.disputeMetaItem}>
            <Icon name="calendar" size={12} color="#9CA3AF" />
            <Text style={styles.disputeMetaText}>{formatTime(dispute.appointment.date)}</Text>
          </View>
        )}
      </View>

      <View style={styles.disputeSizeRow}>
        <View style={styles.sizeBox}>
          <Text style={styles.sizeLabel}>Listed</Text>
          <Text style={styles.sizeValue}>{dispute.originalNumBeds}bd/{dispute.originalNumBaths}ba</Text>
        </View>
        <Icon name="arrow-right" size={12} color="#9CA3AF" />
        <View style={styles.sizeBox}>
          <Text style={styles.sizeLabel}>Reported</Text>
          <Text style={[styles.sizeValue, styles.sizeValueHighlight]}>
            {dispute.reportedNumBeds}bd/{dispute.reportedNumBaths}ba
          </Text>
        </View>
        {priceDiff > 0 && (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>+${priceDiff.toFixed(0)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

// Conversation Card
const ConversationCard = ({ conversation, onPress }) => {
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const customerName = conversation.customer?.name || conversation.title || "Support";
  const customerType = conversation.customer?.type;
  const initials = customerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.conversationCard,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
      ]}
      onPress={() => onPress(conversation)}
    >
      <View style={[
        styles.avatar,
        { backgroundColor: customerType === "cleaner" ? "#DDD6FE" : "#DBEAFE" }
      ]}>
        <Text style={[
          styles.avatarText,
          { color: customerType === "cleaner" ? "#7C3AED" : "#2563EB" }
        ]}>
          {initials}
        </Text>
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>{customerName}</Text>
          <Text style={styles.conversationTime}>{formatTime(conversation.lastMessageAt)}</Text>
        </View>
        {customerType && (
          <View style={[
            styles.typeBadge,
            { backgroundColor: customerType === "cleaner" ? "#F3E8FF" : "#EFF6FF" }
          ]}>
            <Text style={[
              styles.typeBadgeText,
              { color: customerType === "cleaner" ? "#7C3AED" : "#2563EB" }
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
      <Icon name="chevron-right" size={14} color="#D1D5DB" />
    </Pressable>
  );
};

// Main HR Dashboard
const HRDashboard = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickStats, setQuickStats] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);

  // Modal states
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [finalBeds, setFinalBeds] = useState("");
  const [finalBaths, setFinalBaths] = useState("");
  const [finalHalfBaths, setFinalHalfBaths] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Tool states
  const [activeToolTab, setActiveToolTab] = useState("details");
  const [cleanerProfile, setCleanerProfile] = useState(null);
  const [homeownerProfile, setHomeownerProfile] = useState(null);
  const [homeDetails, setHomeDetails] = useState(null);
  const [claimHistory, setClaimHistory] = useState(null);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolAction, setToolAction] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");

  const bedOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"];
  const bathOptions = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5+"];
  const halfBathOptions = ["0", "1", "2", "3+"];

  useEffect(() => {
    if (state.currentUser.token) {
      fetchDashboardData();
    }
  }, [state.currentUser.token]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      console.error("[HRDashboard] Error:", err);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => fetchDashboardData(true), [state.currentUser.token]);

  const handleDisputePress = (dispute) => {
    setSelectedDispute(dispute);
    setFinalBeds(dispute.reportedNumBeds?.toString() || "");
    setFinalBaths(dispute.reportedNumBaths?.toString() || "");
    setFinalHalfBaths(dispute.reportedNumHalfBaths?.toString() || "0");
    setOwnerNote("");
    setSubmitError("");
    setActiveToolTab("details");
    setCleanerProfile(null);
    setHomeownerProfile(null);
    setHomeDetails(null);
    setClaimHistory(null);
    setToolAction(null);
    setCreditAmount("");
    setCreditReason("");
    setNotificationTitle("");
    setNotificationBody("");
    setShowDetailModal(true);
  };

  // Load party profiles
  const loadPartyProfiles = async () => {
    if (!selectedDispute) return;
    setLoadingTools(true);
    try {
      const [cleanerRes, homeownerRes] = await Promise.all([
        selectedDispute.cleaner?.id
          ? HRDashboardService.getUserProfile(state.currentUser.token, selectedDispute.cleaner.id)
          : Promise.resolve({ profile: null }),
        selectedDispute.homeowner?.id
          ? HRDashboardService.getUserProfile(state.currentUser.token, selectedDispute.homeowner.id)
          : Promise.resolve({ profile: null }),
      ]);
      setCleanerProfile(cleanerRes.profile);
      setHomeownerProfile(homeownerRes.profile);
    } catch (err) {
      console.error("Error loading profiles:", err);
    } finally {
      setLoadingTools(false);
    }
  };

  // Load home and claim history
  const loadHistory = async () => {
    if (!selectedDispute) return;
    setLoadingTools(true);
    try {
      const [homeRes, claimRes] = await Promise.all([
        selectedDispute.home?.id
          ? HRDashboardService.getHomeDetails(state.currentUser.token, selectedDispute.home.id)
          : Promise.resolve({ home: null }),
        selectedDispute.cleaner?.id
          ? HRDashboardService.getCleanerClaimHistory(state.currentUser.token, selectedDispute.cleaner.id)
          : Promise.resolve({ claims: [] }),
      ]);
      setHomeDetails(homeRes.home);
      setClaimHistory(claimRes);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingTools(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tabKey) => {
    setActiveToolTab(tabKey);
    if (tabKey === "parties" && !cleanerProfile && !homeownerProfile) {
      loadPartyProfiles();
    }
    if (tabKey === "history" && !homeDetails && !claimHistory) {
      loadHistory();
    }
  };

  // Tool actions
  const handleMarkFalseClaim = async (userId, userType) => {
    Alert.alert(
      "Mark False Claim",
      `This will increment the false ${userType === "cleaner" ? "claim" : "home size"} count for this user. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            setLoadingTools(true);
            const result = await HRDashboardService.markFalseClaim(
              state.currentUser.token,
              userId,
              userType,
              `Dispute #${selectedDispute.id}`,
              selectedDispute.id
            );
            setLoadingTools(false);
            if (result.success) {
              Alert.alert("Success", "False claim marked successfully");
              loadPartyProfiles();
            } else {
              Alert.alert("Error", result.error || "Failed to mark false claim");
            }
          },
        },
      ]
    );
  };

  const handleIssueCredit = async (userId) => {
    if (!creditAmount || isNaN(parseFloat(creditAmount)) || parseFloat(creditAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    setLoadingTools(true);
    const result = await HRDashboardService.issueCredit(
      state.currentUser.token,
      userId,
      parseFloat(creditAmount),
      creditReason || `Dispute resolution #${selectedDispute.id}`,
      selectedDispute.appointment?.id
    );
    setLoadingTools(false);
    if (result.success) {
      Alert.alert("Success", `$${creditAmount} credit issued successfully`);
      setCreditAmount("");
      setCreditReason("");
      setToolAction(null);
    } else {
      Alert.alert("Error", result.error || "Failed to issue credit");
    }
  };

  const handleSendNotification = async (userId) => {
    if (!notificationTitle || !notificationBody) {
      Alert.alert("Error", "Please enter title and message");
      return;
    }
    setLoadingTools(true);
    const result = await HRDashboardService.sendNotification(
      state.currentUser.token,
      userId,
      notificationTitle,
      notificationBody
    );
    setLoadingTools(false);
    if (result.success) {
      Alert.alert("Success", "Notification sent successfully");
      setNotificationTitle("");
      setNotificationBody("");
      setToolAction(null);
    } else {
      Alert.alert("Error", result.error || "Failed to send notification");
    }
  };

  const handleUpdateHomeSize = async () => {
    if (!selectedDispute?.home?.id) return;
    setLoadingTools(true);
    const result = await HRDashboardService.updateHomeSize(
      state.currentUser.token,
      selectedDispute.home.id,
      {
        numBeds: finalBeds,
        numBaths: finalBaths,
        numHalfBaths: finalHalfBaths,
        reason: `HR resolution for dispute #${selectedDispute.id}`,
      }
    );
    setLoadingTools(false);
    if (result.success) {
      Alert.alert("Success", "Home size updated successfully");
      loadHistory();
    } else {
      Alert.alert("Error", result.error || "Failed to update home size");
    }
  };

  const handleConversationPress = (conversation) => {
    navigate(`/messages/${conversation.id}`);
  };

  const handleResolveDispute = async (approve) => {
    if (!finalBeds || !finalBaths) {
      setSubmitError("Please select bedroom and bathroom counts");
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
      setSubmitError("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = quickStats?.pendingDisputes || 0;
  const needsActionCount = disputes.filter(d =>
    ["denied", "expired", "pending_owner"].includes(d.status)
  ).length;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading Dashboard</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.errorCard}>
          <Icon name="exclamation-triangle" size={32} color="#EF4444" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchDashboardData()}>
            <Icon name="redo" size={14} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.heroGreeting}>Human Resources</Text>
            <Text style={styles.heroTitle}>Dashboard</Text>
          </View>
          <View style={styles.heroIcon}>
            <Icon name="gavel" size={28} color="rgba(255,255,255,0.9)" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsWrap}>
          <ActionButton
            icon="user-plus"
            label="Applications"
            color="#8B5CF6"
            badge={quickStats?.pendingApplications || 0}
            onPress={() => navigate("/list-of-applications")}
          />
          <ActionButton
            icon="users"
            label="Employees"
            color="#6366F1"
            onPress={() => navigate("/employees")}
          />
          <ActionButton
            icon="balance-scale"
            label="Conflicts"
            color="#EF4444"
            badge={quickStats?.pendingConflicts || 0}
            onPress={() => navigate("/conflicts")}
          />
          <ActionButton
            icon="plus-circle"
            label="Ticket"
            color="#F59E0B"
            onPress={() => setShowCreateTicketModal(true)}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsWrap}>
          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Pending Disputes"
              value={pendingCount}
              icon="exclamation-triangle"
              color={pendingCount > 0 ? "#F59E0B" : "#10B981"}
              subtitle={needsActionCount > 0 ? `${needsActionCount} need action` : null}
            />
            <StatCard
              title="Support Chats"
              value={quickStats?.supportConversations || 0}
              icon="comments"
              color="#6366F1"
            />
            <StatCard
              title="Resolved"
              value={quickStats?.disputesResolvedThisWeek || 0}
              icon="check-circle"
              color="#10B981"
              trend="This week"
            />
            <StatCard
              title="Active Cleaners"
              value={quickStats?.activeCleaners || 0}
              icon="user-check"
              color="#8B5CF6"
            />
          </View>
        </View>

        {/* Disputes Section */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Disputes Requiring Attention</Text>
            <Text style={styles.sectionCount}>{disputes.length} open</Text>
          </View>

          {disputes.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="check-double" size={28} color="#10B981" />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptyText}>No pending disputes to review</Text>
            </View>
          ) : (
            disputes.slice(0, 5).map((dispute) => (
              <DisputeCard
                key={dispute.id}
                dispute={dispute}
                onPress={handleDisputePress}
              />
            ))
          )}

          {disputes.length > 5 && (
            <Pressable style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All {disputes.length} Disputes</Text>
              <Icon name="chevron-right" size={12} color="#7C3AED" />
            </Pressable>
          )}
        </View>

        {/* Conversations Section */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Recent Messages</Text>
            <Pressable onPress={() => navigate("/messages")} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See All</Text>
              <Icon name="chevron-right" size={10} color="#7C3AED" />
            </Pressable>
          </View>

          {conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="inbox" size={28} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>No Messages</Text>
              <Text style={styles.emptyText}>Support conversations will appear here</Text>
            </View>
          ) : (
            conversations.slice(0, 4).map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                onPress={handleConversationPress}
              />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Support Ticket Modal */}
      <CreateSupportTicketModal
        visible={showCreateTicketModal}
        onClose={() => setShowCreateTicketModal(false)}
        onSuccess={() => {
          setShowCreateTicketModal(false);
          fetchDashboardData(true);
        }}
        token={state.currentUser.token}
      />

      {/* Dispute Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Dispute Details</Text>
                <Text style={styles.modalSubtitle}>#{selectedDispute?.id}</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setShowDetailModal(false)}>
                <Icon name="times" size={18} color="#6B7280" />
              </Pressable>
            </View>

            {/* Tool Tabs */}
            <View style={styles.toolTabsRow}>
              {TOOL_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[styles.toolTab, activeToolTab === tab.key && styles.toolTabActive]}
                  onPress={() => handleTabChange(tab.key)}
                >
                  <Icon
                    name={tab.icon}
                    size={14}
                    color={activeToolTab === tab.key ? "#7C3AED" : "#9CA3AF"}
                  />
                  <Text style={[styles.toolTabText, activeToolTab === tab.key && styles.toolTabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedDispute && (
                <>
                  {/* Details Tab */}
                  {activeToolTab === "details" && (
                    <>
                      <View style={styles.modalStatusRow}>
                        <StatusChip status={selectedDispute.status} />
                      </View>

                  {/* Property Card */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoCardHeader}>
                      <Icon name="home" size={14} color="#7C3AED" />
                      <Text style={styles.infoCardLabel}>Property</Text>
                    </View>
                    <Text style={styles.infoCardValue}>{selectedDispute.home?.address}</Text>
                    <Text style={styles.infoCardSub}>
                      {selectedDispute.home?.city}, {selectedDispute.home?.state}
                    </Text>
                  </View>

                  {/* Parties */}
                  <View style={styles.partiesRow}>
                    <View style={[styles.partyCard, { backgroundColor: "#F3E8FF", borderColor: "#DDD6FE" }]}>
                      <Icon name="user" size={16} color="#7C3AED" />
                      <Text style={styles.partyLabel}>Cleaner</Text>
                      <Text style={styles.partyName}>
                        {selectedDispute.cleaner?.firstName} {selectedDispute.cleaner?.lastName}
                      </Text>
                      {selectedDispute.cleaner?.falseClaimCount > 0 && (
                        <View style={styles.warningRow}>
                          <Icon name="exclamation-triangle" size={10} color="#D97706" />
                          <Text style={styles.warningText}>{selectedDispute.cleaner.falseClaimCount} prior claims</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.partyCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                      <Icon name="home" size={16} color="#2563EB" />
                      <Text style={styles.partyLabel}>Homeowner</Text>
                      <Text style={styles.partyName}>
                        {selectedDispute.homeowner?.firstName} {selectedDispute.homeowner?.lastName}
                      </Text>
                      {selectedDispute.homeowner?.falseHomeSizeCount > 0 && (
                        <View style={styles.warningRow}>
                          <Icon name="exclamation-triangle" size={10} color="#D97706" />
                          <Text style={styles.warningText}>{selectedDispute.homeowner.falseHomeSizeCount} size issues</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Size Comparison */}
                  <View style={styles.comparisonCard}>
                    <Text style={styles.comparisonTitle}>Size Discrepancy</Text>
                    <View style={styles.comparisonBoxes}>
                      <View style={styles.compBox}>
                        <Text style={styles.compBoxLabel}>On File</Text>
                        <Text style={styles.compBoxValue}>{selectedDispute.originalNumBeds} bed</Text>
                        <Text style={styles.compBoxValue}>{selectedDispute.originalNumBaths} bath</Text>
                      </View>
                      <View style={styles.compArrow}>
                        <Icon name="arrow-right" size={16} color="#9CA3AF" />
                      </View>
                      <View style={[styles.compBox, styles.compBoxHighlight]}>
                        <Text style={styles.compBoxLabel}>Reported</Text>
                        <Text style={styles.compBoxValueHL}>{selectedDispute.reportedNumBeds} bed</Text>
                        <Text style={styles.compBoxValueHL}>{selectedDispute.reportedNumBaths} bath</Text>
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
                      <Text style={styles.photosSectionTitle}>Evidence Photos</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {selectedDispute.photos.map((photo) => (
                          <View key={photo.id} style={styles.photoItem}>
                            <Image source={{ uri: photo.photoUrl }} style={styles.photoImage} resizeMode="cover" />
                            <Text style={styles.photoLabel}>{photo.roomType} #{photo.roomNumber}</Text>
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
                  {["pending_owner", "denied", "expired"].includes(selectedDispute.status) && (
                    <View style={styles.resolutionForm}>
                      <View style={styles.formHeader}>
                        <Icon name="gavel" size={18} color="#7C3AED" />
                        <Text style={styles.formTitle}>Make Your Decision</Text>
                      </View>
                      <Text style={styles.formDesc}>
                        Set the final room counts for this property.
                      </Text>

                      {/* Bedrooms */}
                      <Text style={styles.selectorLabel}>Bedrooms</Text>
                      <View style={styles.selectorRow}>
                        {bedOptions.map((opt) => (
                          <Pressable
                            key={opt}
                            style={[styles.selectorBtn, finalBeds === opt && styles.selectorBtnActive]}
                            onPress={() => setFinalBeds(opt)}
                          >
                            <Text style={[styles.selectorBtnText, finalBeds === opt && styles.selectorBtnTextActive]}>
                              {opt}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {/* Bathrooms */}
                      <Text style={styles.selectorLabel}>Bathrooms</Text>
                      <View style={styles.selectorRow}>
                        {bathOptions.map((opt) => (
                          <Pressable
                            key={opt}
                            style={[styles.selectorBtn, finalBaths === opt && styles.selectorBtnActive]}
                            onPress={() => setFinalBaths(opt)}
                          >
                            <Text style={[styles.selectorBtnText, finalBaths === opt && styles.selectorBtnTextActive]}>
                              {opt}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {/* Half Baths */}
                      <Text style={styles.selectorLabel}>Half Baths</Text>
                      <View style={styles.selectorRow}>
                        {halfBathOptions.map((opt) => (
                          <Pressable
                            key={opt}
                            style={[styles.selectorBtn, finalHalfBaths === opt && styles.selectorBtnActive]}
                            onPress={() => setFinalHalfBaths(opt)}
                          >
                            <Text style={[styles.selectorBtnText, finalHalfBaths === opt && styles.selectorBtnTextActive]}>
                              {opt}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={styles.notesInputLabel}>Resolution Notes (Optional)</Text>
                      <TextInput
                        style={styles.textArea}
                        value={ownerNote}
                        onChangeText={setOwnerNote}
                        placeholder="Explain your decision..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                      />

                      {submitError && (
                        <View style={styles.errorBanner}>
                          <Icon name="exclamation-circle" size={14} color="#DC2626" />
                          <Text style={styles.errorBannerText}>{submitError}</Text>
                        </View>
                      )}

                      <View style={styles.buttonRow}>
                        <Pressable
                          style={[styles.decisionBtn, styles.denyBtn]}
                          onPress={() => handleResolveDispute(false)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Icon name="times" size={14} color="#fff" />
                              <Text style={styles.decisionBtnText}>Deny</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          style={[styles.decisionBtn, styles.approveBtn]}
                          onPress={() => handleResolveDispute(true)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Icon name="check" size={14} color="#fff" />
                              <Text style={styles.decisionBtnText}>Approve</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                    </>
                  )}

                  {/* Parties Tab */}
                  {activeToolTab === "parties" && (
                    <>
                      {loadingTools ? (
                        <View style={styles.toolLoadingWrap}>
                          <ActivityIndicator size="large" color="#7C3AED" />
                          <Text style={styles.toolLoadingText}>Loading profiles...</Text>
                        </View>
                      ) : (
                        <>
                          {/* Cleaner Profile */}
                          {cleanerProfile && (
                            <View style={styles.profileCard}>
                              <View style={styles.profileCardHeader}>
                                <View style={[styles.profileAvatar, { backgroundColor: "#F3E8FF" }]}>
                                  <Icon name="broom" size={20} color="#7C3AED" />
                                </View>
                                <View style={styles.profileInfo}>
                                  <Text style={styles.profileName}>
                                    {cleanerProfile.firstName} {cleanerProfile.lastName}
                                  </Text>
                                  <Text style={styles.profileType}>Cleaner</Text>
                                </View>
                              </View>

                              <View style={styles.profileStatsRow}>
                                <View style={styles.profileStat}>
                                  <Text style={styles.profileStatValue}>{cleanerProfile.stats?.falseClaimCount || 0}</Text>
                                  <Text style={styles.profileStatLabel}>False Claims</Text>
                                </View>
                                <View style={styles.profileStat}>
                                  <Text style={styles.profileStatValue}>{cleanerProfile.stats?.homeSizeDisputes || 0}</Text>
                                  <Text style={styles.profileStatLabel}>Total Disputes</Text>
                                </View>
                                <View style={styles.profileStat}>
                                  <Text style={styles.profileStatValue}>{cleanerProfile.stats?.reviewsReceived || 0}</Text>
                                  <Text style={styles.profileStatLabel}>Reviews</Text>
                                </View>
                              </View>

                              {cleanerProfile.ownerPrivateNotes && (
                                <View style={styles.profileNotes}>
                                  <Text style={styles.profileNotesLabel}>HR Notes</Text>
                                  <Text style={styles.profileNotesText}>{cleanerProfile.ownerPrivateNotes}</Text>
                                </View>
                              )}

                              <View style={styles.profileActions}>
                                <Pressable
                                  style={styles.profileActionBtn}
                                  onPress={() => handleMarkFalseClaim(cleanerProfile.id, "cleaner")}
                                >
                                  <Icon name="flag" size={12} color="#DC2626" />
                                  <Text style={styles.profileActionText}>Mark False Claim</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.profileActionBtn}
                                  onPress={() => setToolAction({ type: "credit", userId: cleanerProfile.id, userName: cleanerProfile.firstName })}
                                >
                                  <Icon name="dollar-sign" size={12} color="#10B981" />
                                  <Text style={styles.profileActionText}>Issue Credit</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.profileActionBtn}
                                  onPress={() => setToolAction({ type: "notify", userId: cleanerProfile.id, userName: cleanerProfile.firstName })}
                                >
                                  <Icon name="bell" size={12} color="#6366F1" />
                                  <Text style={styles.profileActionText}>Notify</Text>
                                </Pressable>
                              </View>
                            </View>
                          )}

                          {/* Homeowner Profile */}
                          {homeownerProfile && (
                            <View style={styles.profileCard}>
                              <View style={styles.profileCardHeader}>
                                <View style={[styles.profileAvatar, { backgroundColor: "#DBEAFE" }]}>
                                  <Icon name="home" size={20} color="#2563EB" />
                                </View>
                                <View style={styles.profileInfo}>
                                  <Text style={styles.profileName}>
                                    {homeownerProfile.firstName} {homeownerProfile.lastName}
                                  </Text>
                                  <Text style={styles.profileType}>Homeowner</Text>
                                </View>
                              </View>

                              <View style={styles.profileStatsRow}>
                                <View style={styles.profileStat}>
                                  <Text style={styles.profileStatValue}>{homeownerProfile.stats?.falseHomeSizeCount || 0}</Text>
                                  <Text style={styles.profileStatLabel}>Size Issues</Text>
                                </View>
                                <View style={styles.profileStat}>
                                  <Text style={styles.profileStatValue}>{homeownerProfile.stats?.cancellationCount || 0}</Text>
                                  <Text style={styles.profileStatLabel}>Cancellations</Text>
                                </View>
                                <View style={styles.profileStat}>
                                  <Text style={styles.profileStatValue}>{homeownerProfile.homes?.length || 0}</Text>
                                  <Text style={styles.profileStatLabel}>Homes</Text>
                                </View>
                              </View>

                              {homeownerProfile.ownerPrivateNotes && (
                                <View style={styles.profileNotes}>
                                  <Text style={styles.profileNotesLabel}>HR Notes</Text>
                                  <Text style={styles.profileNotesText}>{homeownerProfile.ownerPrivateNotes}</Text>
                                </View>
                              )}

                              <View style={styles.profileActions}>
                                <Pressable
                                  style={styles.profileActionBtn}
                                  onPress={() => handleMarkFalseClaim(homeownerProfile.id, "homeowner")}
                                >
                                  <Icon name="flag" size={12} color="#DC2626" />
                                  <Text style={styles.profileActionText}>Mark Size Issue</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.profileActionBtn}
                                  onPress={() => setToolAction({ type: "credit", userId: homeownerProfile.id, userName: homeownerProfile.firstName })}
                                >
                                  <Icon name="dollar-sign" size={12} color="#10B981" />
                                  <Text style={styles.profileActionText}>Issue Credit</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.profileActionBtn}
                                  onPress={() => setToolAction({ type: "notify", userId: homeownerProfile.id, userName: homeownerProfile.firstName })}
                                >
                                  <Icon name="bell" size={12} color="#6366F1" />
                                  <Text style={styles.profileActionText}>Notify</Text>
                                </Pressable>
                              </View>
                            </View>
                          )}

                          {/* Action Forms */}
                          {toolAction?.type === "credit" && (
                            <View style={styles.actionFormCard}>
                              <Text style={styles.actionFormTitle}>Issue Credit to {toolAction.userName}</Text>
                              <TextInput
                                style={styles.actionInput}
                                placeholder="Amount ($)"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="decimal-pad"
                                value={creditAmount}
                                onChangeText={setCreditAmount}
                              />
                              <TextInput
                                style={[styles.actionInput, { height: 80 }]}
                                placeholder="Reason (optional)"
                                placeholderTextColor="#9CA3AF"
                                multiline
                                value={creditReason}
                                onChangeText={setCreditReason}
                              />
                              <View style={styles.actionFormBtns}>
                                <Pressable
                                  style={styles.actionCancelBtn}
                                  onPress={() => setToolAction(null)}
                                >
                                  <Text style={styles.actionCancelText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.actionSubmitBtn}
                                  onPress={() => handleIssueCredit(toolAction.userId)}
                                  disabled={loadingTools}
                                >
                                  {loadingTools ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <Text style={styles.actionSubmitText}>Issue Credit</Text>
                                  )}
                                </Pressable>
                              </View>
                            </View>
                          )}

                          {toolAction?.type === "notify" && (
                            <View style={styles.actionFormCard}>
                              <Text style={styles.actionFormTitle}>Send Notification to {toolAction.userName}</Text>
                              <TextInput
                                style={styles.actionInput}
                                placeholder="Title"
                                placeholderTextColor="#9CA3AF"
                                value={notificationTitle}
                                onChangeText={setNotificationTitle}
                              />
                              <TextInput
                                style={[styles.actionInput, { height: 100 }]}
                                placeholder="Message"
                                placeholderTextColor="#9CA3AF"
                                multiline
                                value={notificationBody}
                                onChangeText={setNotificationBody}
                              />
                              <View style={styles.actionFormBtns}>
                                <Pressable
                                  style={styles.actionCancelBtn}
                                  onPress={() => setToolAction(null)}
                                >
                                  <Text style={styles.actionCancelText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.actionSubmitBtn}
                                  onPress={() => handleSendNotification(toolAction.userId)}
                                  disabled={loadingTools}
                                >
                                  {loadingTools ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <Text style={styles.actionSubmitText}>Send</Text>
                                  )}
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* History Tab */}
                  {activeToolTab === "history" && (
                    <>
                      {loadingTools ? (
                        <View style={styles.toolLoadingWrap}>
                          <ActivityIndicator size="large" color="#7C3AED" />
                          <Text style={styles.toolLoadingText}>Loading history...</Text>
                        </View>
                      ) : (
                        <>
                          {/* Home Details */}
                          {homeDetails && (
                            <View style={styles.historyCard}>
                              <View style={styles.historyCardHeader}>
                                <Icon name="home" size={16} color="#7C3AED" />
                                <Text style={styles.historyCardTitle}>Property History</Text>
                              </View>
                              <Text style={styles.historyAddress}>{homeDetails.address}</Text>
                              <Text style={styles.historySubtext}>
                                {homeDetails.city}, {homeDetails.state} {homeDetails.zipcode}
                              </Text>
                              <View style={styles.historySizeRow}>
                                <Text style={styles.historySizeLabel}>Current Size:</Text>
                                <Text style={styles.historySizeValue}>
                                  {homeDetails.numBeds} bed / {homeDetails.numBaths} bath
                                  {homeDetails.numHalfBaths > 0 && ` / ${homeDetails.numHalfBaths} half`}
                                </Text>
                              </View>

                              {homeDetails.disputeHistory?.length > 0 && (
                                <>
                                  <Text style={styles.historyListTitle}>Past Disputes</Text>
                                  {homeDetails.disputeHistory.slice(0, 5).map((d, i) => (
                                    <View key={i} style={styles.historyListItem}>
                                      <View style={styles.historyListDot} />
                                      <View style={styles.historyListContent}>
                                        <Text style={styles.historyListText}>
                                          {d.originalSize} to {d.reportedSize}
                                        </Text>
                                        <Text style={styles.historyListMeta}>
                                          {d.status} - {new Date(d.createdAt).toLocaleDateString()}
                                        </Text>
                                      </View>
                                    </View>
                                  ))}
                                </>
                              )}
                            </View>
                          )}

                          {/* Cleaner Claim History */}
                          {claimHistory && (
                            <View style={styles.historyCard}>
                              <View style={styles.historyCardHeader}>
                                <Icon name="clipboard-list" size={16} color="#F59E0B" />
                                <Text style={styles.historyCardTitle}>Cleaner Claim History</Text>
                              </View>
                              <Text style={styles.historySubtext}>{claimHistory.cleaner?.name}</Text>

                              <View style={styles.claimStatsRow}>
                                <View style={styles.claimStat}>
                                  <Text style={styles.claimStatValue}>{claimHistory.stats?.totalClaims || 0}</Text>
                                  <Text style={styles.claimStatLabel}>Total</Text>
                                </View>
                                <View style={styles.claimStat}>
                                  <Text style={[styles.claimStatValue, { color: "#10B981" }]}>
                                    {claimHistory.stats?.approvedClaims || 0}
                                  </Text>
                                  <Text style={styles.claimStatLabel}>Approved</Text>
                                </View>
                                <View style={styles.claimStat}>
                                  <Text style={[styles.claimStatValue, { color: "#EF4444" }]}>
                                    {claimHistory.stats?.deniedClaims || 0}
                                  </Text>
                                  <Text style={styles.claimStatLabel}>Denied</Text>
                                </View>
                                <View style={styles.claimStat}>
                                  <Text style={[styles.claimStatValue, { color: "#6366F1" }]}>
                                    {claimHistory.stats?.approvalRate || 0}%
                                  </Text>
                                  <Text style={styles.claimStatLabel}>Rate</Text>
                                </View>
                              </View>

                              {claimHistory.claims?.length > 0 && (
                                <>
                                  <Text style={styles.historyListTitle}>Recent Claims</Text>
                                  {claimHistory.claims.slice(0, 5).map((c, i) => (
                                    <View key={i} style={styles.historyListItem}>
                                      <View
                                        style={[
                                          styles.historyListDot,
                                          {
                                            backgroundColor: ["approved", "owner_approved"].includes(c.status)
                                              ? "#10B981"
                                              : ["denied", "owner_denied"].includes(c.status)
                                              ? "#EF4444"
                                              : "#F59E0B",
                                          },
                                        ]}
                                      />
                                      <View style={styles.historyListContent}>
                                        <Text style={styles.historyListText} numberOfLines={1}>
                                          {c.home}
                                        </Text>
                                        <Text style={styles.historyListMeta}>
                                          {c.originalSize} to {c.reportedSize} ({c.status})
                                        </Text>
                                      </View>
                                    </View>
                                  ))}
                                </>
                              )}
                            </View>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Tools Tab */}
                  {activeToolTab === "tools" && (
                    <View style={styles.toolsContainer}>
                      <Text style={styles.toolsSectionTitle}>Resolution Actions</Text>

                      {/* Update Home Size */}
                      <View style={styles.toolCard}>
                        <View style={styles.toolCardHeader}>
                          <Icon name="ruler-combined" size={18} color="#7C3AED" />
                          <Text style={styles.toolCardTitle}>Update Home Size</Text>
                        </View>
                        <Text style={styles.toolCardDesc}>
                          Permanently update the home's registered size.
                        </Text>

                        <View style={styles.toolSizeSelectors}>
                          <View style={styles.toolSizeSelector}>
                            <Text style={styles.toolSizeSelectorLabel}>Beds</Text>
                            <View style={styles.toolSizeOptions}>
                              {["1", "2", "3", "4", "5", "6+"].map((opt) => (
                                <Pressable
                                  key={opt}
                                  style={[styles.toolSizeOption, finalBeds === opt && styles.toolSizeOptionActive]}
                                  onPress={() => setFinalBeds(opt)}
                                >
                                  <Text style={[styles.toolSizeOptionText, finalBeds === opt && styles.toolSizeOptionTextActive]}>
                                    {opt}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                          <View style={styles.toolSizeSelector}>
                            <Text style={styles.toolSizeSelectorLabel}>Baths</Text>
                            <View style={styles.toolSizeOptions}>
                              {["1", "1.5", "2", "2.5", "3", "4+"].map((opt) => (
                                <Pressable
                                  key={opt}
                                  style={[styles.toolSizeOption, finalBaths === opt && styles.toolSizeOptionActive]}
                                  onPress={() => setFinalBaths(opt)}
                                >
                                  <Text style={[styles.toolSizeOptionText, finalBaths === opt && styles.toolSizeOptionTextActive]}>
                                    {opt}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        </View>

                        <Pressable
                          style={styles.toolActionBtn}
                          onPress={handleUpdateHomeSize}
                          disabled={loadingTools}
                        >
                          {loadingTools ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Icon name="save" size={14} color="#fff" />
                              <Text style={styles.toolActionBtnText}>Update Home Size</Text>
                            </>
                          )}
                        </Pressable>
                      </View>

                      {/* Quick Actions */}
                      <View style={styles.toolCard}>
                        <View style={styles.toolCardHeader}>
                          <Icon name="bolt" size={18} color="#F59E0B" />
                          <Text style={styles.toolCardTitle}>Quick Actions</Text>
                        </View>

                        <View style={styles.quickActionsGrid}>
                          <Pressable
                            style={styles.quickActionBtn}
                            onPress={() => {
                              if (selectedDispute?.cleaner?.id) {
                                handleMarkFalseClaim(selectedDispute.cleaner.id, "cleaner");
                              }
                            }}
                          >
                            <View style={[styles.quickActionIcon, { backgroundColor: "#FEE2E2" }]}>
                              <Icon name="flag" size={16} color="#DC2626" />
                            </View>
                            <Text style={styles.quickActionLabel}>Mark Cleaner{"\n"}False Claim</Text>
                          </Pressable>

                          <Pressable
                            style={styles.quickActionBtn}
                            onPress={() => {
                              if (selectedDispute?.homeowner?.id) {
                                handleMarkFalseClaim(selectedDispute.homeowner.id, "homeowner");
                              }
                            }}
                          >
                            <View style={[styles.quickActionIcon, { backgroundColor: "#FEF3C7" }]}>
                              <Icon name="home" size={16} color="#D97706" />
                            </View>
                            <Text style={styles.quickActionLabel}>Mark Owner{"\n"}Size Issue</Text>
                          </Pressable>

                          <Pressable
                            style={styles.quickActionBtn}
                            onPress={() => {
                              if (selectedDispute?.cleaner?.id) {
                                setToolAction({
                                  type: "credit",
                                  userId: selectedDispute.cleaner.id,
                                  userName: selectedDispute.cleaner.firstName,
                                });
                              }
                            }}
                          >
                            <View style={[styles.quickActionIcon, { backgroundColor: "#DCFCE7" }]}>
                              <Icon name="dollar-sign" size={16} color="#16A34A" />
                            </View>
                            <Text style={styles.quickActionLabel}>Credit{"\n"}Cleaner</Text>
                          </Pressable>

                          <Pressable
                            style={styles.quickActionBtn}
                            onPress={() => {
                              if (selectedDispute?.homeowner?.id) {
                                setToolAction({
                                  type: "credit",
                                  userId: selectedDispute.homeowner.id,
                                  userName: selectedDispute.homeowner.firstName,
                                });
                              }
                            }}
                          >
                            <View style={[styles.quickActionIcon, { backgroundColor: "#E0E7FF" }]}>
                              <Icon name="dollar-sign" size={16} color="#4F46E5" />
                            </View>
                            <Text style={styles.quickActionLabel}>Credit{"\n"}Homeowner</Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* Credit Form if active */}
                      {toolAction?.type === "credit" && (
                        <View style={styles.actionFormCard}>
                          <Text style={styles.actionFormTitle}>Issue Credit to {toolAction.userName}</Text>
                          <TextInput
                            style={styles.actionInput}
                            placeholder="Amount ($)"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                            value={creditAmount}
                            onChangeText={setCreditAmount}
                          />
                          <TextInput
                            style={[styles.actionInput, { height: 80 }]}
                            placeholder="Reason (optional)"
                            placeholderTextColor="#9CA3AF"
                            multiline
                            value={creditReason}
                            onChangeText={setCreditReason}
                          />
                          <View style={styles.actionFormBtns}>
                            <Pressable style={styles.actionCancelBtn} onPress={() => setToolAction(null)}>
                              <Text style={styles.actionCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={styles.actionSubmitBtn}
                              onPress={() => handleIssueCredit(toolAction.userId)}
                              disabled={loadingTools}
                            >
                              {loadingTools ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.actionSubmitText}>Issue Credit</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={{ height: 40 }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollView: {
    flex: 1,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: "#fff",
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    ...shadows.lg,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  errorCard: {
    backgroundColor: "#fff",
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    ...shadows.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Hero
  hero: {
    backgroundColor: "#7C3AED",
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroContent: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginTop: 4,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Actions
  actionsWrap: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    marginTop: -16,
    marginHorizontal: 16,
    borderRadius: 16,
    ...shadows.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
  },
  actionBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  actionBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  actionBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  actionBtnLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Stats
  statsWrap: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: (screenWidth - 44) / 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    ...shadows.sm,
  },
  statCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 11,
    color: "#D97706",
    marginTop: 4,
    fontWeight: "500",
  },

  // Section
  sectionWrap: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionCount: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: "#7C3AED",
    fontWeight: "600",
  },

  // Empty State
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    ...shadows.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
  },

  // Chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Dispute Card
  disputeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  disputeCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  disputeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#DC2626",
  },
  disputeAddress: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  disputeMeta: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  disputeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  disputeMetaText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  disputeSizeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 12,
  },
  sizeBox: {
    flex: 1,
  },
  sizeLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  sizeValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  sizeValueHighlight: {
    color: "#7C3AED",
  },
  priceBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: "#7C3AED",
    fontWeight: "600",
  },

  // Conversation Card
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...shadows.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  conversationPreview: {
    fontSize: 13,
    color: "#6B7280",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#7C3AED",
    fontWeight: "500",
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    padding: 16,
  },
  modalStatusRow: {
    marginBottom: 16,
  },

  // Info Card
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoCardLabel: {
    fontSize: 12,
    color: "#7C3AED",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  infoCardSub: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },

  // Parties
  partiesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  partyCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  partyLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 2,
  },
  partyName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  warningText: {
    fontSize: 11,
    color: "#D97706",
  },

  // Comparison
  comparisonCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  comparisonTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  comparisonBoxes: {
    flexDirection: "row",
    alignItems: "center",
  },
  compBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  compBoxHighlight: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  compArrow: {
    paddingHorizontal: 8,
  },
  compBoxLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 4,
  },
  compBoxValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  compBoxValueHL: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7C3AED",
  },
  priceDiffRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  priceDiffLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  priceDiffValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16A34A",
  },

  // Photos
  photosSection: {
    marginBottom: 12,
  },
  photosSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 10,
  },
  photoItem: {
    marginRight: 10,
  },
  photoImage: {
    width: 100,
    height: 75,
    borderRadius: 8,
  },
  photoLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },

  // Notes
  notesSection: {
    marginBottom: 12,
  },
  noteCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },

  // Resolution Form
  resolutionForm: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    ...shadows.sm,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  formDesc: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 10,
    marginTop: 8,
  },
  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectorBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 48,
    alignItems: "center",
  },
  selectorBtnActive: {
    backgroundColor: "#7C3AED",
  },
  selectorBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  selectorBtnTextActive: {
    color: "#fff",
  },
  notesInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    color: "#1F2937",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    color: "#DC2626",
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  decisionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  approveBtn: {
    backgroundColor: "#10B981",
  },
  denyBtn: {
    backgroundColor: "#EF4444",
  },
  decisionBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // Tool Tabs
  toolTabsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 12,
  },
  toolTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  toolTabActive: {
    borderBottomColor: "#7C3AED",
  },
  toolTabText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  toolTabTextActive: {
    color: "#7C3AED",
    fontWeight: "600",
  },

  // Tool Loading
  toolLoadingWrap: {
    padding: 40,
    alignItems: "center",
  },
  toolLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  // Profile Cards
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  profileCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  profileType: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  profileStatsRow: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  profileStat: {
    flex: 1,
    alignItems: "center",
  },
  profileStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  profileStatLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  profileNotes: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  profileNotesLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  profileNotesText: {
    fontSize: 13,
    color: "#78350F",
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
  },
  profileActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  profileActionText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#374151",
  },

  // Action Forms
  actionFormCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  actionFormTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4338CA",
    marginBottom: 12,
  },
  actionInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 10,
  },
  actionFormBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  actionCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  actionSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#7C3AED",
  },
  actionSubmitText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // History Cards
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  historyCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  historyAddress: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
  },
  historySubtext: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  historySizeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 8,
  },
  historySizeLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  historySizeValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7C3AED",
  },
  historyListTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
  },
  historyListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  historyListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9CA3AF",
    marginTop: 6,
    marginRight: 10,
  },
  historyListContent: {
    flex: 1,
  },
  historyListText: {
    fontSize: 14,
    color: "#1F2937",
  },
  historyListMeta: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // Claim Stats
  claimStatsRow: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  claimStat: {
    flex: 1,
    alignItems: "center",
  },
  claimStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  claimStatLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },

  // Tools Container
  toolsContainer: {
    padding: 4,
  },
  toolsSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toolCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  toolCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  toolCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  toolCardDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  toolSizeSelectors: {
    marginBottom: 16,
  },
  toolSizeSelector: {
    marginBottom: 12,
  },
  toolSizeSelectorLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  toolSizeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toolSizeOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    minWidth: 44,
    alignItems: "center",
  },
  toolSizeOptionActive: {
    backgroundColor: "#7C3AED",
  },
  toolSizeOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  toolSizeOptionTextActive: {
    color: "#fff",
  },
  toolActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  toolActionBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  quickActionBtn: {
    width: (screenWidth - 80) / 2,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
    lineHeight: 16,
  },
});

export default HRDashboard;
