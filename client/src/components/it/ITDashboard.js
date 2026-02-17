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
  Alert,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome5";
import ITDashboardService from "../../services/fetchRequests/ITDashboardService";
import { usePreview } from "../../context/PreviewContext";
import { PreviewRoleModal } from "../preview";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const { width: screenWidth } = Dimensions.get("window");

// Category labels for display
const CATEGORY_LABELS = {
  app_crash: "App Crash",
  login_problem: "Login Problem",
  system_outage: "System Outage",
  performance_issue: "Performance Issue",
  profile_change: "Profile Change",
  account_access: "Account Access",
  password_reset: "Password Reset",
  data_correction: "Data Correction",
  billing_error: "Billing Error",
  payment_system_error: "Payment System Error",
  security_issue: "Security Issue",
  suspicious_activity: "Suspicious Activity",
  data_request: "Data Request",
};

const CATEGORY_GROUPS = {
  technical: { label: "Technical", icon: "cog", color: "#6366F1" },
  profile: { label: "Profile", icon: "user-alt", color: "#8B5CF6" },
  billing: { label: "Billing", icon: "credit-card", color: "#F59E0B" },
  security: { label: "Security", icon: "shield-alt", color: "#EF4444" },
  data: { label: "Data", icon: "database", color: "#6B7280" },
};

// Modern Stat Card
const StatCard = ({ title, value, icon, color, trend, trendUp }) => (
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
  </View>
);

// Priority Chip
const PriorityChip = ({ priority }) => {
  const configs = {
    critical: { label: "Critical", bg: "#FEE2E2", color: "#DC2626", icon: "exclamation-circle" },
    high: { label: "High", bg: "#FEF3C7", color: "#D97706", icon: "exclamation" },
    normal: { label: "Normal", bg: "#E5E7EB", color: "#4B5563", icon: "minus" },
    low: { label: "Low", bg: "#DBEAFE", color: "#2563EB", icon: "arrow-down" },
  };
  const config = configs[priority] || configs.normal;

  return (
    <View style={[styles.chip, { backgroundColor: config.bg }]}>
      <Icon name={config.icon} size={9} color={config.color} solid />
      <Text style={[styles.chipText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// Status Chip
const StatusChip = ({ status }) => {
  const configs = {
    submitted: { label: "New", bg: "#DBEAFE", color: "#2563EB", icon: "inbox" },
    in_progress: { label: "In Progress", bg: "#FEF3C7", color: "#D97706", icon: "spinner" },
    awaiting_info: { label: "Awaiting", bg: "#E9D5FF", color: "#7C3AED", icon: "question-circle" },
    resolved: { label: "Resolved", bg: "#DCFCE7", color: "#16A34A", icon: "check-circle" },
    closed: { label: "Closed", bg: "#E5E7EB", color: "#6B7280", icon: "times-circle" },
  };
  const config = configs[status] || configs.submitted;

  return (
    <View style={[styles.chip, { backgroundColor: config.bg }]}>
      <Icon name={config.icon} size={10} color={config.color} />
      <Text style={[styles.chipText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// Category Pill
const CategoryPill = ({ group, label, icon, color, isActive, onPress, count }) => (
  <Pressable
    style={[
      styles.categoryPill,
      isActive && { backgroundColor: color, borderColor: color },
    ]}
    onPress={onPress}
  >
    <Icon name={icon} size={12} color={isActive ? "#fff" : color} />
    <Text style={[styles.categoryPillText, isActive && { color: "#fff" }]}>{label}</Text>
    {count > 0 && (
      <View style={[styles.categoryCount, isActive && { backgroundColor: "rgba(255,255,255,0.3)" }]}>
        <Text style={[styles.categoryCountText, isActive && { color: "#fff" }]}>{count}</Text>
      </View>
    )}
  </Pressable>
);

// Ticket Card
const TicketCard = ({ dispute, onPress }) => {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const reporterName = dispute.reporter
    ? `${dispute.reporter.firstName} ${dispute.reporter.lastName?.charAt(0)}.`
    : "Unknown";

  const isUrgent = dispute.priority === "critical" || dispute.priority === "high";
  const isPastSLA = dispute.slaDeadline && new Date(dispute.slaDeadline) < new Date() && !["resolved", "closed"].includes(dispute.status);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.ticketCard,
        isUrgent && styles.ticketCardUrgent,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
      ]}
      onPress={() => onPress(dispute)}
    >
      {/* Header Row */}
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketId}>{dispute.caseNumber}</Text>
        <Text style={styles.ticketTime}>{formatTime(dispute.submittedAt)}</Text>
      </View>

      {/* Category */}
      <Text style={styles.ticketCategory}>
        {CATEGORY_LABELS[dispute.category] || dispute.category}
      </Text>

      {/* Description */}
      <Text style={styles.ticketDesc} numberOfLines={2}>
        {dispute.description}
      </Text>

      {/* Footer Row */}
      <View style={styles.ticketFooter}>
        <View style={styles.ticketMeta}>
          <View style={styles.ticketReporter}>
            <Icon name="user-circle" size={14} color="#9CA3AF" solid />
            <Text style={styles.ticketReporterText}>{reporterName}</Text>
          </View>
          {isPastSLA && (
            <View style={styles.slaBadge}>
              <Icon name="clock" size={10} color="#DC2626" />
              <Text style={styles.slaText}>SLA Breach</Text>
            </View>
          )}
        </View>
        <View style={styles.ticketBadges}>
          <StatusChip status={dispute.status} />
          <PriorityChip priority={dispute.priority} />
        </View>
      </View>
    </Pressable>
  );
};

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

// Category to tool type mapping
const CATEGORY_TOOLS = {
  // Technical issues - need app/account tools
  app_crash: ["app", "account"],
  login_problem: ["account", "security"],
  system_outage: ["app"],
  performance_issue: ["app"],
  // Profile issues - need profile/account tools
  profile_change: ["profile"],
  account_access: ["account", "security"],
  password_reset: ["account"],
  data_correction: ["profile", "data"],
  // Billing issues - need billing tools
  billing_error: ["billing"],
  payment_system_error: ["billing"],
  // Security issues - need security tools
  security_issue: ["security", "account"],
  suspicious_activity: ["security", "account"],
  // Data issues - need data tools
  data_request: ["data", "profile"],
};

// Support Tool Button
const SupportToolButton = ({ icon, label, description, color, onPress, loading, disabled }) => (
  <Pressable
    style={({ pressed }) => [
      styles.supportToolBtn,
      pressed && { opacity: 0.9 },
      disabled && { opacity: 0.5 },
    ]}
    onPress={onPress}
    disabled={loading || disabled}
  >
    <View style={[styles.supportToolIcon, { backgroundColor: color + "15" }]}>
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon name={icon} size={16} color={color} />
      )}
    </View>
    <View style={styles.supportToolContent}>
      <Text style={styles.supportToolLabel}>{label}</Text>
      <Text style={styles.supportToolDesc}>{description}</Text>
    </View>
    <Icon name="chevron-right" size={14} color="#9CA3AF" />
  </Pressable>
);

// Tool Section Header
const ToolSectionHeader = ({ icon, title, color }) => (
  <View style={styles.toolSectionHeader}>
    <Icon name={icon} size={14} color={color} />
    <Text style={[styles.toolSectionTitle, { color }]}>{title}</Text>
  </View>
);

// Dispute Detail Modal
const DisputeDetailModal = ({ visible, dispute, onClose, onResolve, onTakeTicket, currentUserId, token }) => {
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  // Tool states
  const [activeToolTab, setActiveToolTab] = useState(null);
  const [toolData, setToolData] = useState({});
  const [loadingTool, setLoadingTool] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (dispute) {
      setResolutionNotes("");
      setShowResolveForm(false);
      setActiveToolTab(null);
      setToolData({});
    }
  }, [dispute]);

  const getToolTypes = () => {
    if (!dispute?.category) return [];
    return CATEGORY_TOOLS[dispute.category] || ["account"];
  };

  // Load tool data
  const loadToolData = async (toolType) => {
    if (!dispute?.reporter?.id || loadingTool) return;
    setLoadingTool(toolType);
    setActiveToolTab(toolType);

    try {
      let result;
      switch (toolType) {
        case "account":
          result = await ITDashboardService.getUserDetails(token, dispute.reporter.id);
          setToolData(prev => ({ ...prev, account: result.user }));
          break;
        case "profile":
          result = await ITDashboardService.getUserProfile(token, dispute.reporter.id);
          setToolData(prev => ({ ...prev, profile: result.profile }));
          break;
        case "billing":
          result = await ITDashboardService.getUserBilling(token, dispute.reporter.id);
          setToolData(prev => ({ ...prev, billing: result.billing }));
          break;
        case "security":
          result = await ITDashboardService.getUserSecurity(token, dispute.reporter.id);
          setToolData(prev => ({ ...prev, security: result.security }));
          break;
        case "app":
          result = await ITDashboardService.getUserAppInfo(token, dispute.reporter.id);
          setToolData(prev => ({ ...prev, app: result.appInfo }));
          break;
        case "data":
          result = await ITDashboardService.getUserDataSummary(token, dispute.reporter.id);
          setToolData(prev => ({ ...prev, data: result.dataSummary }));
          break;
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load data");
    } finally {
      setLoadingTool(null);
    }
  };

  // Action handlers
  const handleSendPasswordReset = async () => {
    Alert.alert(
      "Send Password Reset",
      `This will send a password reset email to ${dispute.reporter.email}. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Reset",
          onPress: async () => {
            setActionLoading("password");
            const result = await ITDashboardService.sendPasswordReset(token, dispute.reporter.id);
            setActionLoading(null);
            Alert.alert(result.success ? "Success" : "Error", result.message || result.error);
          },
        },
      ]
    );
  };

  const handleUnlockAccount = async () => {
    setActionLoading("unlock");
    const result = await ITDashboardService.unlockAccount(token, dispute.reporter.id);
    setActionLoading(null);
    if (result.success) {
      Alert.alert("Success", result.message);
      loadToolData("account");
    } else {
      Alert.alert("Error", result.error);
    }
  };

  const handleForceLogout = async () => {
    Alert.alert(
      "Force Logout",
      "This will log the user out of all devices. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Force Logout",
          style: "destructive",
          onPress: async () => {
            setActionLoading("logout");
            const result = await ITDashboardService.forceLogout(token, dispute.reporter.id);
            setActionLoading(null);
            Alert.alert(result.success ? "Success" : "Error", result.message || result.error);
            if (result.success) loadToolData("security");
          },
        },
      ]
    );
  };

  const handleClearAppState = async () => {
    Alert.alert(
      "Clear App State",
      "This will clear the user's app data and force a fresh start. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          onPress: async () => {
            setActionLoading("clearApp");
            const result = await ITDashboardService.clearAppState(token, dispute.reporter.id);
            setActionLoading(null);
            Alert.alert(result.success ? "Success" : "Error", result.message || result.error);
            if (result.success) loadToolData("app");
          },
        },
      ]
    );
  };

  const handleSuspendAccount = async () => {
    Alert.alert(
      "Suspend Account",
      "Temporarily suspend this account for 24 hours?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Suspend",
          style: "destructive",
          onPress: async () => {
            setActionLoading("suspend");
            const result = await ITDashboardService.suspendAccount(token, dispute.reporter.id, {
              reason: `IT Support action for ticket ${dispute.caseNumber}`,
              hours: 24,
            });
            setActionLoading(null);
            Alert.alert(result.success ? "Success" : "Error", result.message || result.error);
            if (result.success) loadToolData("security");
          },
        },
      ]
    );
  };

  if (!dispute) return null;

  const reporterName = dispute.reporter
    ? `${dispute.reporter.firstName} ${dispute.reporter.lastName}`
    : "Unknown User";

  const assigneeName = dispute.assignee
    ? `${dispute.assignee.firstName} ${dispute.assignee.lastName}`
    : null;

  const handleResolve = () => {
    if (!resolutionNotes.trim()) {
      Alert.alert("Required", "Please describe how the issue was resolved");
      return;
    }
    onResolve(dispute.id, { resolutionNotes: resolutionNotes.trim() });
  };

  const isOpen = !["resolved", "closed"].includes(dispute.status);
  const isAssignedToMe = dispute.assignedTo === currentUserId;
  const isUnassigned = !dispute.assignedTo;
  const toolTypes = getToolTypes();

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const isPastSLA = dispute.slaDeadline && new Date(dispute.slaDeadline) < new Date() && isOpen;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalCaseRow}>
                <Text style={styles.modalCaseNum}>{dispute.caseNumber}</Text>
                <PriorityChip priority={dispute.priority} />
              </View>
              <Text style={styles.modalCategory}>
                {CATEGORY_LABELS[dispute.category] || dispute.category}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Icon name="times" size={18} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            <View style={[
              styles.statusBanner,
              dispute.status === "resolved" && styles.statusBannerResolved,
              dispute.status === "in_progress" && styles.statusBannerProgress,
              isPastSLA && styles.statusBannerSLA,
            ]}>
              <Icon
                name={dispute.status === "resolved" ? "check-circle" : isPastSLA ? "exclamation-triangle" : "info-circle"}
                size={16}
                color={dispute.status === "resolved" ? "#059669" : isPastSLA ? "#DC2626" : "#6366F1"}
              />
              <Text style={[
                styles.statusBannerText,
                dispute.status === "resolved" && styles.statusBannerTextResolved,
                isPastSLA && styles.statusBannerTextSLA,
              ]}>
                {dispute.status === "resolved"
                  ? "This ticket has been resolved"
                  : isPastSLA
                    ? "SLA deadline exceeded"
                    : isAssignedToMe
                      ? "You are handling this ticket"
                      : isUnassigned
                        ? "This ticket needs attention"
                        : `Assigned to ${assigneeName}`}
              </Text>
            </View>

            {/* Quick Info Cards */}
            <View style={styles.infoCards}>
              <View style={styles.infoCard}>
                <View style={[styles.infoCardIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Icon name="user" size={14} color="#6366F1" />
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardLabel}>Reported by</Text>
                  <Text style={styles.infoCardValue}>{reporterName}</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <View style={[styles.infoCardIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Icon name="clock" size={14} color="#D97706" />
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardLabel}>Submitted</Text>
                  <Text style={styles.infoCardValue}>{formatDate(dispute.submittedAt)}</Text>
                </View>
              </View>

              {dispute.slaDeadline && (
                <View style={styles.infoCard}>
                  <View style={[styles.infoCardIcon, { backgroundColor: isPastSLA ? "#FEE2E2" : "#DCFCE7" }]}>
                    <Icon name="hourglass-half" size={14} color={isPastSLA ? "#DC2626" : "#059669"} />
                  </View>
                  <View style={styles.infoCardContent}>
                    <Text style={styles.infoCardLabel}>SLA Deadline</Text>
                    <Text style={[styles.infoCardValue, isPastSLA && { color: "#DC2626" }]}>
                      {formatDate(dispute.slaDeadline)}
                    </Text>
                  </View>
                </View>
              )}

              {(dispute.platform || dispute.appVersion) && (
                <View style={styles.infoCard}>
                  <View style={[styles.infoCardIcon, { backgroundColor: "#F3E8FF" }]}>
                    <Icon name="mobile-alt" size={14} color="#7C3AED" />
                  </View>
                  <View style={styles.infoCardContent}>
                    <Text style={styles.infoCardLabel}>Platform</Text>
                    <Text style={styles.infoCardValue}>
                      {[dispute.platform, dispute.appVersion].filter(Boolean).join(" v")}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.descCard}>
              <Text style={styles.descCardLabel}>Issue Description</Text>
              <Text style={styles.descCardText}>{dispute.description}</Text>
              {dispute.reporter?.email && (
                <View style={styles.contactRow}>
                  <Icon name="envelope" size={12} color="#6366F1" />
                  <Text style={styles.contactText}>{dispute.reporter.email}</Text>
                </View>
              )}
            </View>

            {/* Support Tools - Show based on category */}
            {toolTypes.length > 0 && isOpen && isAssignedToMe && (
              <View style={styles.supportToolsCard}>
                <View style={styles.supportToolsHeader}>
                  <Icon name="tools" size={16} color="#6366F1" />
                  <Text style={styles.supportToolsTitle}>Support Tools</Text>
                </View>

                {/* Tool Type Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolTabs}>
                  {toolTypes.map((type) => {
                    const tabConfig = {
                      account: { icon: "user-cog", label: "Account", color: "#6366F1" },
                      profile: { icon: "id-card", label: "Profile", color: "#8B5CF6" },
                      billing: { icon: "credit-card", label: "Billing", color: "#F59E0B" },
                      security: { icon: "shield-alt", label: "Security", color: "#EF4444" },
                      app: { icon: "mobile-alt", label: "App", color: "#14B8A6" },
                      data: { icon: "database", label: "Data", color: "#6B7280" },
                    }[type];
                    const isActive = activeToolTab === type;
                    return (
                      <Pressable
                        key={type}
                        style={[styles.toolTab, isActive && { backgroundColor: tabConfig.color }]}
                        onPress={() => loadToolData(type)}
                      >
                        {loadingTool === type ? (
                          <ActivityIndicator size="small" color={isActive ? "#fff" : tabConfig.color} />
                        ) : (
                          <Icon name={tabConfig.icon} size={14} color={isActive ? "#fff" : tabConfig.color} />
                        )}
                        <Text style={[styles.toolTabText, isActive && { color: "#fff" }]}>{tabConfig.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Account Tools */}
                {activeToolTab === "account" && toolData.account && (
                  <View style={styles.toolContent}>
                    <View style={styles.accountStatusCard}>
                      <View style={styles.accountStatusGrid}>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Last Login</Text>
                          <Text style={styles.accountStatusValue}>
                            {toolData.account.lastLogin ? formatDate(toolData.account.lastLogin) : "Never"}
                          </Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Login Count</Text>
                          <Text style={styles.accountStatusValue}>{toolData.account.loginCount || 0}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Failed Attempts</Text>
                          <Text style={[styles.accountStatusValue, toolData.account.failedLoginAttempts > 0 && { color: "#DC2626" }]}>
                            {toolData.account.failedLoginAttempts || 0}
                          </Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Status</Text>
                          <Text style={[styles.accountStatusValue, (toolData.account.isLocked || toolData.account.accountFrozen) && { color: "#DC2626" }]}>
                            {toolData.account.accountFrozen ? "Frozen" : toolData.account.isLocked ? "Locked" : "Active"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <SupportToolButton icon="key" label="Send Password Reset" description="Email temporary password" color="#D97706" onPress={handleSendPasswordReset} loading={actionLoading === "password"} />
                    {(toolData.account.isLocked || toolData.account.failedLoginAttempts > 0) && (
                      <SupportToolButton icon="unlock" label="Unlock Account" description="Clear failed attempts" color="#059669" onPress={handleUnlockAccount} loading={actionLoading === "unlock"} />
                    )}
                  </View>
                )}

                {/* Profile Tools */}
                {activeToolTab === "profile" && toolData.profile && (
                  <View style={styles.toolContent}>
                    <View style={styles.accountStatusCard}>
                      <View style={styles.accountStatusGrid}>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Name</Text>
                          <Text style={styles.accountStatusValue}>{toolData.profile.firstName} {toolData.profile.lastName}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Type</Text>
                          <Text style={styles.accountStatusValue}>{toolData.profile.type}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Email</Text>
                          <Text style={styles.accountStatusValue}>{toolData.profile.email}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Phone</Text>
                          <Text style={styles.accountStatusValue}>{toolData.profile.phone || "Not set"}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.toolNote}>Contact changes require user verification. Guide user through settings.</Text>
                  </View>
                )}

                {/* Billing Tools */}
                {activeToolTab === "billing" && toolData.billing && (
                  <View style={styles.toolContent}>
                    <View style={styles.accountStatusCard}>
                      <View style={styles.accountStatusGrid}>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Payment Method</Text>
                          <Text style={[styles.accountStatusValue, !toolData.billing.hasPaymentMethod && { color: "#D97706" }]}>
                            {toolData.billing.hasPaymentMethod ? "On file" : "None"}
                          </Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Total Bills</Text>
                          <Text style={styles.accountStatusValue}>{toolData.billing.stats?.totalBills || 0}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Paid</Text>
                          <Text style={[styles.accountStatusValue, { color: "#059669" }]}>{toolData.billing.stats?.paidBills || 0}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Pending</Text>
                          <Text style={[styles.accountStatusValue, toolData.billing.stats?.pendingBills > 0 && { color: "#D97706" }]}>
                            {toolData.billing.stats?.pendingBills || 0}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.toolNote}>Billing issues require owner authorization. Escalate if needed.</Text>
                  </View>
                )}

                {/* Security Tools */}
                {activeToolTab === "security" && toolData.security && (
                  <View style={styles.toolContent}>
                    <View style={styles.accountStatusCard}>
                      <View style={styles.accountStatusGrid}>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Last Login</Text>
                          <Text style={styles.accountStatusValue}>{toolData.security.lastLogin ? formatDate(toolData.security.lastLogin) : "Never"}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Device</Text>
                          <Text style={styles.accountStatusValue}>{toolData.security.lastDeviceType || "Unknown"}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Push Active</Text>
                          <Text style={[styles.accountStatusValue, { color: toolData.security.hasActivePushToken ? "#059669" : "#9CA3AF" }]}>
                            {toolData.security.hasActivePushToken ? "Yes" : "No"}
                          </Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Warnings</Text>
                          <Text style={[styles.accountStatusValue, toolData.security.warningCount > 0 && { color: "#EF4444" }]}>
                            {toolData.security.warningCount || 0}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <SupportToolButton icon="sign-out-alt" label="Force Logout" description="Log user out of all devices" color="#D97706" onPress={handleForceLogout} loading={actionLoading === "logout"} />
                    <SupportToolButton icon="ban" label="Suspend Account (24h)" description="Temporarily block access" color="#EF4444" onPress={handleSuspendAccount} loading={actionLoading === "suspend"} />
                  </View>
                )}

                {/* App Tools */}
                {activeToolTab === "app" && toolData.app && (
                  <View style={styles.toolContent}>
                    <View style={styles.accountStatusCard}>
                      <View style={styles.accountStatusGrid}>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Device</Text>
                          <Text style={styles.accountStatusValue}>{toolData.app.lastDeviceType || "Unknown"}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Logins</Text>
                          <Text style={styles.accountStatusValue}>{toolData.app.loginCount || 0}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Push</Text>
                          <Text style={[styles.accountStatusValue, { color: toolData.app.hasPushNotifications ? "#059669" : "#9CA3AF" }]}>
                            {toolData.app.hasPushNotifications ? "Enabled" : "Disabled"}
                          </Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Terms v{toolData.app.termsVersion || "?"}</Text>
                          <Text style={styles.accountStatusValue}>Privacy v{toolData.app.privacyVersion || "?"}</Text>
                        </View>
                      </View>
                    </View>
                    <SupportToolButton icon="sync" label="Clear App State" description="Force fresh app start" color="#6366F1" onPress={handleClearAppState} loading={actionLoading === "clearApp"} />
                  </View>
                )}

                {/* Data Tools */}
                {activeToolTab === "data" && toolData.data && (
                  <View style={styles.toolContent}>
                    <View style={styles.accountStatusCard}>
                      <Text style={styles.accountStatusTitle}>Data Summary</Text>
                      <View style={styles.accountStatusGrid}>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Appointments</Text>
                          <Text style={styles.accountStatusValue}>{toolData.data.data?.appointments || 0}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Reviews Given</Text>
                          <Text style={styles.accountStatusValue}>{toolData.data.data?.reviewsGiven || 0}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Reviews Received</Text>
                          <Text style={styles.accountStatusValue}>{toolData.data.data?.reviewsReceived || 0}</Text>
                        </View>
                        <View style={styles.accountStatusItem}>
                          <Text style={styles.accountStatusLabel}>Bills</Text>
                          <Text style={styles.accountStatusValue}>{toolData.data.data?.bills || 0}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.toolNote}>Full data export requires system admin. Escalate GDPR requests.</Text>
                  </View>
                )}

                {!activeToolTab && (
                  <Text style={styles.toolSelectHint}>Select a tool category above to view details</Text>
                )}
              </View>
            )}

            {/* Hint to take ticket first for support tools */}
            {toolTypes.length > 0 && isOpen && !isAssignedToMe && (
              <View style={styles.toolsHintCard}>
                <Icon name="info-circle" size={14} color="#6366F1" />
                <Text style={styles.toolsHintText}>
                  Take this ticket to access support tools for this issue type.
                </Text>
              </View>
            )}

            {/* Resolution Display */}
            {dispute.status === "resolved" && dispute.resolutionNotes && (
              <View style={styles.resolutionCard}>
                <View style={styles.resolutionHeader}>
                  <Icon name="check-circle" size={16} color="#059669" solid />
                  <Text style={styles.resolutionTitle}>Resolution</Text>
                </View>
                <Text style={styles.resolutionText}>{dispute.resolutionNotes}</Text>
                {dispute.resolvedAt && (
                  <Text style={styles.resolutionDate}>
                    Resolved on {formatDate(dispute.resolvedAt)}
                  </Text>
                )}
              </View>
            )}

            {/* Actions for open tickets */}
            {isOpen && (
              <View style={styles.actionsCard}>
                {/* Take Ticket Button - show if unassigned or assigned to someone else */}
                {!isAssignedToMe && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.takeTicketBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => onTakeTicket(dispute.id)}
                  >
                    <View style={styles.takeTicketIcon}>
                      <Icon name="hand-paper" size={18} color="#fff" />
                    </View>
                    <View style={styles.takeTicketContent}>
                      <Text style={styles.takeTicketTitle}>I'll Handle This</Text>
                      <Text style={styles.takeTicketDesc}>Take ownership of this ticket</Text>
                    </View>
                    <Icon name="chevron-right" size={16} color="#fff" />
                  </Pressable>
                )}

                {/* Resolve Section */}
                {isAssignedToMe && !showResolveForm && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.resolveToggleBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => setShowResolveForm(true)}
                  >
                    <Icon name="check-double" size={16} color="#059669" />
                    <Text style={styles.resolveToggleText}>Ready to resolve this ticket?</Text>
                    <Icon name="chevron-down" size={14} color="#059669" />
                  </Pressable>
                )}

                {isAssignedToMe && showResolveForm && (
                  <View style={styles.resolveForm}>
                    <View style={styles.resolveFormHeader}>
                      <Text style={styles.resolveFormTitle}>Resolve Ticket</Text>
                      <Pressable onPress={() => setShowResolveForm(false)}>
                        <Icon name="times" size={16} color="#6B7280" />
                      </Pressable>
                    </View>
                    <TextInput
                      style={styles.resolveTextArea}
                      placeholder="Describe how the issue was resolved..."
                      placeholderTextColor="#9CA3AF"
                      value={resolutionNotes}
                      onChangeText={setResolutionNotes}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.resolveSubmitBtn,
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={handleResolve}
                    >
                      <Icon name="check-circle" size={16} color="#fff" />
                      <Text style={styles.resolveSubmitText}>Mark as Resolved</Text>
                    </Pressable>
                  </View>
                )}

                {/* Hint for non-assigned */}
                {!isAssignedToMe && (
                  <Text style={styles.actionHint}>
                    Take this ticket to start working on it
                  </Text>
                )}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Main IT Dashboard Component
const ITDashboard = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { enterPreviewMode, isLoading: previewLoading, error: previewError } = usePreview();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickStats, setQuickStats] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedFilter, setSelectedFilter] = useState("all"); // "all", "my_assigned", "critical"
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  const handleSelectPreviewRole = async (role) => {
    const success = await enterPreviewMode(role);
    if (success) {
      setPreviewModalVisible(false);
      navigate("/");
    }
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = state.currentUser?.token;
      if (!token) return;

      const [statsResult, disputesResult] = await Promise.all([
        ITDashboardService.getQuickStats(token),
        ITDashboardService.getDisputes(token, { status: "open" }),
      ]);

      setQuickStats(statsResult);
      setDisputes(disputesResult.disputes || []);
    } catch (error) {
      console.error("Error fetching IT dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser?.token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleViewDispute = (dispute) => {
    setSelectedDispute(dispute);
    setShowDetailModal(true);
  };

  const handleResolve = async (disputeId, resolution) => {
    const result = await ITDashboardService.resolveDispute(
      state.currentUser.token,
      disputeId,
      resolution
    );

    if (result.success) {
      Alert.alert("Success", "Issue resolved successfully");
      setShowDetailModal(false);
      setSelectedDispute(null);
      fetchDashboardData();
    } else {
      Alert.alert("Error", result.error || "Failed to resolve issue");
    }
  };

  const handleTakeTicket = async (disputeId) => {
    // Assign the ticket to the current user
    const result = await ITDashboardService.assignDispute(
      state.currentUser.token,
      disputeId,
      state.currentUser.id
    );

    if (result.success) {
      Alert.alert("Got It!", "This ticket is now assigned to you");
      // Update the selected dispute to reflect the change
      setSelectedDispute(prev => prev ? { ...prev, assignedTo: state.currentUser.id } : null);
      fetchDashboardData();
    } else {
      Alert.alert("Error", result.error || "Failed to take ticket");
    }
  };

  // Apply both special filter and category filter
  const filteredDisputes = disputes.filter((d) => {
    // First, apply special filter (my_assigned, critical)
    if (selectedFilter === "my_assigned" && d.assignedTo !== state.currentUser?.id) {
      return false;
    }
    if (selectedFilter === "critical" && d.priority !== "critical" && d.priority !== "high") {
      return false;
    }

    // Then, apply category filter
    if (selectedCategory !== "all") {
      const categoryGroups = {
        technical: ["app_crash", "login_problem", "system_outage", "performance_issue"],
        profile: ["profile_change", "account_access", "password_reset", "data_correction"],
        billing: ["billing_error", "payment_system_error"],
        security: ["security_issue", "suspicious_activity"],
        data: ["data_request"],
      };
      if (!categoryGroups[selectedCategory]?.includes(d.category)) {
        return false;
      }
    }

    return true;
  });

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading Dashboard</Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.heroGreeting}>IT Support</Text>
            <Text style={styles.heroTitle}>Dashboard</Text>
          </View>
          <View style={styles.heroIcon}>
            <Icon name="headset" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsWrap}>
          <ActionButton
            icon="inbox"
            label="All Tickets"
            color={selectedFilter === "all" ? "#6366F1" : "#9CA3AF"}
            badge={quickStats?.openDisputes || 0}
            onPress={() => {
              setSelectedFilter("all");
              setSelectedCategory("all");
            }}
          />
          <ActionButton
            icon="user-check"
            label="My Assigned"
            color={selectedFilter === "my_assigned" ? "#8B5CF6" : "#9CA3AF"}
            badge={quickStats?.myAssigned || 0}
            onPress={() => {
              setSelectedFilter("my_assigned");
              setSelectedCategory("all");
            }}
          />
          <ActionButton
            icon="fire-alt"
            label="Critical"
            color={selectedFilter === "critical" ? "#EF4444" : "#9CA3AF"}
            badge={quickStats?.criticalHighPriority || 0}
            onPress={() => {
              setSelectedFilter("critical");
              setSelectedCategory("all");
            }}
          />
          <ActionButton
            icon="eye"
            label="Preview"
            color="#14B8A6"
            onPress={() => setPreviewModalVisible(true)}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsWrap}>
          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Open Tickets"
              value={quickStats?.openDisputes || 0}
              icon="ticket-alt"
              color="#6366F1"
            />
            <StatCard
              title="Critical"
              value={quickStats?.criticalHighPriority || 0}
              icon="exclamation-circle"
              color="#EF4444"
            />
            <StatCard
              title="Resolved"
              value={quickStats?.resolvedThisWeek || 0}
              icon="check-circle"
              color="#10B981"
              trend="12%"
              trendUp
            />
            <StatCard
              title="SLA Breach"
              value={quickStats?.slaBreaches || 0}
              icon="clock"
              color="#F59E0B"
            />
          </View>
        </View>

        {/* Category Filter */}
        <View style={styles.filterWrap}>
          <Text style={styles.sectionLabel}>Filter by Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <CategoryPill
              group="all"
              label="All"
              icon="layer-group"
              color="#6366F1"
              isActive={selectedCategory === "all" && selectedFilter === "all"}
              onPress={() => {
                setSelectedCategory("all");
                setSelectedFilter("all");
              }}
              count={quickStats?.openDisputes || 0}
            />
            {Object.entries(CATEGORY_GROUPS).map(([key, config]) => (
              <CategoryPill
                key={key}
                group={key}
                label={config.label}
                icon={config.icon}
                color={config.color}
                isActive={selectedCategory === key}
                onPress={() => {
                  setSelectedCategory(key);
                  setSelectedFilter("all");
                }}
                count={quickStats?.disputesByGroup?.[key] || 0}
              />
            ))}
          </ScrollView>
        </View>

        {/* Tickets List */}
        <View style={styles.ticketsWrap}>
          <View style={styles.ticketsHeader}>
            <Text style={styles.sectionLabel}>
              {selectedFilter === "my_assigned"
                ? "My Assigned Tickets"
                : selectedFilter === "critical"
                  ? "Critical & High Priority"
                  : selectedCategory === "all"
                    ? "All Tickets"
                    : `${CATEGORY_GROUPS[selectedCategory]?.label} Tickets`}
            </Text>
            <Text style={styles.ticketCount}>{filteredDisputes.length} open</Text>
          </View>

          {filteredDisputes.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="check-double" size={32} color="#10B981" />
              </View>
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptyText}>No open tickets in this category</Text>
            </View>
          ) : (
            filteredDisputes.map((dispute) => (
              <TicketCard
                key={dispute.id}
                dispute={dispute}
                onPress={handleViewDispute}
              />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <DisputeDetailModal
        visible={showDetailModal}
        dispute={selectedDispute}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDispute(null);
        }}
        onResolve={handleResolve}
        onTakeTicket={handleTakeTicket}
        currentUserId={state.currentUser?.id}
        token={state.currentUser?.token}
      />

      <PreviewRoleModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        onSelectRole={handleSelectPreviewRole}
        isLoading={previewLoading}
        error={previewError}
      />
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

  // Hero Header
  hero: {
    backgroundColor: "#6366F1",
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

  // Filter
  filterWrap: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  filterScroll: {
    gap: 8,
    paddingRight: 16,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4B5563",
  },
  categoryCount: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },

  // Tickets
  ticketsWrap: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  ticketsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ticketCount: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  ticketCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  ticketCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketId: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  ticketTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  ticketCategory: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6366F1",
    marginBottom: 6,
  },
  ticketDesc: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ticketReporter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ticketReporterText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  slaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slaText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#DC2626",
  },
  ticketBadges: {
    flexDirection: "row",
    gap: 6,
  },

  // Chips
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
    backgroundColor: "#DCFCE7",
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
    maxHeight: "92%",
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
  modalHeaderLeft: {
    flex: 1,
  },
  modalCaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalCaseNum: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalCategory: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "600",
    marginTop: 4,
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

  // Status Banner
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  statusBannerResolved: {
    backgroundColor: "#DCFCE7",
  },
  statusBannerProgress: {
    backgroundColor: "#FEF3C7",
  },
  statusBannerSLA: {
    backgroundColor: "#FEE2E2",
  },
  statusBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#4338CA",
  },
  statusBannerTextResolved: {
    color: "#059669",
  },
  statusBannerTextSLA: {
    color: "#DC2626",
  },

  // Info Cards
  infoCards: {
    gap: 10,
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    ...shadows.sm,
  },
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  infoCardValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },

  // Description Card
  descCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...shadows.sm,
  },
  descCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  descCardText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 24,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "500",
  },

  // Resolution Card
  resolutionCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  resolutionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  resolutionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },
  resolutionText: {
    fontSize: 15,
    color: "#065F46",
    lineHeight: 22,
  },
  resolutionDate: {
    fontSize: 12,
    color: "#059669",
    marginTop: 10,
  },

  // Actions Card
  actionsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    ...shadows.sm,
  },

  // Take Ticket Button
  takeTicketBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  takeTicketIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  takeTicketContent: {
    flex: 1,
  },
  takeTicketTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  takeTicketDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },

  // Resolve Toggle
  resolveToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderStyle: "dashed",
  },
  resolveToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },

  // Resolve Form
  resolveForm: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  resolveFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  resolveFormTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  resolveTextArea: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 14,
    color: "#1F2937",
  },
  resolveSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  resolveSubmitText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // Action Hint
  actionHint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 12,
  },

  // Support Tools
  supportToolsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  supportToolsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  supportToolsTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  supportToolBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  supportToolIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  supportToolContent: {
    flex: 1,
  },
  supportToolLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  supportToolDesc: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  loadingTools: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 10,
  },
  loadingToolsText: {
    fontSize: 14,
    color: "#6B7280",
  },
  accountStatusCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  accountStatusTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accountStatusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  accountStatusItem: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
  },
  accountStatusLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  accountStatusValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  lockWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  lockWarningText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500",
  },
  toolsHintCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  toolsHintText: {
    flex: 1,
    fontSize: 13,
    color: "#4338CA",
    lineHeight: 18,
  },

  // Tool Tabs
  toolTabs: {
    flexDirection: "row",
    marginBottom: 14,
  },
  toolTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
    gap: 6,
  },
  toolTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4B5563",
  },
  toolContent: {
    marginTop: 4,
  },
  toolNote: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 8,
  },
  toolSelectHint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default ITDashboard;
