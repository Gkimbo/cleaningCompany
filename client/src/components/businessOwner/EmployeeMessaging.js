import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import useSafeNavigation from "../../hooks/useSafeNavigation";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api/v1";

// Quick Action Card Component
const QuickActionCard = ({ icon, label, sublabel, color, onPress, badge }) => (
  <Pressable
    style={[styles.quickAction, { backgroundColor: color + "15" }]}
    onPress={onPress}
  >
    <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
      <Icon name={icon} size={20} color="#fff" />
      {badge > 0 && (
        <View style={styles.quickActionBadge}>
          <Text style={styles.quickActionBadgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
    <Text style={styles.quickActionSublabel}>{sublabel}</Text>
  </Pressable>
);

// Employee Card with status indicator
const EmployeeCard = ({ employee, onPress, hasConversation }) => {
  const getStatusColor = () => {
    if (employee.status === "active") return colors.success[500];
    if (employee.status === "pending_invite") return colors.warning[500];
    return colors.neutral[400];
  };

  const getStatusText = () => {
    if (employee.status === "active") return "Active";
    if (employee.status === "pending_invite") return "Pending";
    return "Inactive";
  };

  return (
    <Pressable style={styles.employeeCard} onPress={onPress}>
      <View style={styles.employeeAvatarContainer}>
        <View style={styles.employeeAvatar}>
          <Text style={styles.employeeAvatarText}>
            {(employee.firstName?.[0] || "E").toUpperCase()}
            {(employee.lastName?.[0] || "").toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      </View>
      <View style={styles.employeeInfo}>
        <Text style={styles.employeeName}>
          {employee.firstName} {employee.lastName}
        </Text>
        <View style={styles.employeeMetaRow}>
          <Text style={styles.employeeStatus}>{getStatusText()}</Text>
          {hasConversation && (
            <View style={styles.hasConversationBadge}>
              <Icon name="comments" size={10} color={colors.primary[600]} />
              <Text style={styles.hasConversationText}>Active chat</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.messageIconContainer}>
        <Icon name="comment" size={18} color={colors.primary[500]} />
      </View>
    </Pressable>
  );
};

// Conversation List Item with enhanced styling
const ConversationItem = ({ conversation, onPress }) => {
  const lastMessage = conversation.messages?.[0];
  const participants = conversation.participants || [];
  const otherParticipants = participants.filter((p) => p.role !== "business_owner");
  const unreadCount = conversation.unreadCount || 0;

  const getTitle = () => {
    if (conversation.conversationType === "employee_broadcast") {
      return "Team Announcements";
    }
    if (conversation.conversationType === "job_chat") {
      return conversation.title || "Job Discussion";
    }
    return otherParticipants.map((p) => p.user?.firstName || "Employee").join(", ");
  };

  const getIcon = () => {
    if (conversation.conversationType === "employee_broadcast") return "bullhorn";
    if (conversation.conversationType === "job_chat") return "briefcase";
    return "user";
  };

  const getIconBg = () => {
    if (conversation.conversationType === "employee_broadcast") return colors.secondary[500];
    if (conversation.conversationType === "job_chat") return colors.warning[500];
    return colors.primary[500];
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Pressable
      style={[styles.conversationItem, unreadCount > 0 && styles.conversationUnread]}
      onPress={onPress}
    >
      <View style={[styles.conversationIcon, { backgroundColor: getIconBg() }]}>
        <Icon name={getIcon()} size={18} color="#fff" />
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.conversationTitle, unreadCount > 0 && styles.conversationTitleUnread]}>
            {getTitle()}
          </Text>
          {lastMessage && (
            <Text style={styles.conversationTime}>{formatTime(lastMessage.createdAt)}</Text>
          )}
        </View>
        {lastMessage && (
          <View style={styles.conversationPreviewRow}>
            <Text
              style={[styles.conversationPreview, unreadCount > 0 && styles.conversationPreviewUnread]}
              numberOfLines={1}
            >
              {lastMessage.content}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
};

// Enhanced Broadcast Modal
const BroadcastModal = ({ visible, onClose, onSend, isSending, employeeCount }) => {
  const [message, setMessage] = useState("");
  const [charCount, setCharCount] = useState(0);
  const maxChars = 500;

  const handleMessageChange = (text) => {
    if (text.length <= maxChars) {
      setMessage(text);
      setCharCount(text.length);
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage("");
      setCharCount(0);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIcon}>
              <Icon name="bullhorn" size={20} color="#fff" />
            </View>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Team Announcement</Text>
              <Text style={styles.modalSubtitle}>
                Sending to {employeeCount} employee{employeeCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <Pressable style={styles.modalClose} onPress={onClose}>
              <Icon name="times" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.modalBody}>
            <View style={styles.broadcastTips}>
              <View style={styles.tipItem}>
                <Icon name="check-circle" size={14} color={colors.success[500]} />
                <Text style={styles.tipText}>All active employees will receive this</Text>
              </View>
              <View style={styles.tipItem}>
                <Icon name="bell" size={14} color={colors.primary[500]} />
                <Text style={styles.tipText}>Push notification will be sent</Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.broadcastInput}
                value={message}
                onChangeText={handleMessageChange}
                placeholder="Write your announcement here..."
                placeholderTextColor={colors.neutral[400]}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, charCount > maxChars * 0.9 && styles.charCountWarning]}>
                {charCount}/{maxChars}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sendButton, (!message.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!message.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="paper-plane" size={14} color="#fff" />
                  <Text style={styles.sendButtonText}>Send Announcement</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Search Bar Component
const SearchBar = ({ value, onChange, placeholder }) => (
  <View style={styles.searchContainer}>
    <Icon name="search" size={16} color={colors.neutral[400]} />
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.neutral[400]}
    />
    {value.length > 0 && (
      <Pressable onPress={() => onChange("")}>
        <Icon name="times-circle" size={16} color={colors.neutral[400]} />
      </Pressable>
    )}
  </View>
);

// Empty State Component
const EmptyState = ({ icon, title, message, action, actionLabel }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconContainer}>
      <Icon name={icon} size={32} color={colors.primary[400]} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{message}</Text>
    {action && (
      <Pressable style={styles.emptyButton} onPress={action}>
        <Text style={styles.emptyButtonText}>{actionLabel}</Text>
      </Pressable>
    )}
  </View>
);

// Main Component
const EmployeeMessaging = ({ state }) => {
  const { goBack, navigate } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("conversations");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [employeesRes, conversationsRes] = await Promise.all([
        fetch(`${API_BASE}/messages/business-employees`, {
          headers: { Authorization: `Bearer ${state.currentUser.token}` },
        }),
        fetch(`${API_BASE}/messages/my-business-conversations`, {
          headers: { Authorization: `Bearer ${state.currentUser.token}` },
        }),
      ]);

      const employeesData = await employeesRes.json();
      const conversationsData = await conversationsRes.json();

      if (employeesRes.ok) {
        setEmployees(employeesData.employees || []);
      }
      if (conversationsRes.ok) {
        setConversations(conversationsData.conversations || []);
      }
    } catch (err) {
      console.error("Error fetching messaging data:", err);
      setError("Failed to load messaging data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startConversation = async (employeeId) => {
    try {
      const response = await fetch(`${API_BASE}/messages/employee-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ employeeId }),
      });

      const data = await response.json();
      if (response.ok && data.conversation) {
        navigate(`/messages/${data.conversation.id}`);
      } else {
        setError(data.error || "Failed to start conversation");
      }
    } catch (err) {
      console.error("Error starting conversation:", err);
      setError("Failed to start conversation");
    }
  };

  const sendBroadcast = async (content) => {
    setIsSending(true);
    try {
      const response = await fetch(`${API_BASE}/messages/employee-broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (response.ok) {
        setShowBroadcast(false);
        fetchData();
      } else {
        setError(data.error || "Failed to send broadcast");
      }
    } catch (err) {
      console.error("Error sending broadcast:", err);
      setError("Failed to send broadcast");
    } finally {
      setIsSending(false);
    }
  };

  // Filter data based on search
  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      emp.firstName?.toLowerCase().includes(searchLower) ||
      emp.lastName?.toLowerCase().includes(searchLower)
    );
  });

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const participants = conv.participants || [];
    return participants.some((p) =>
      p.user?.firstName?.toLowerCase().includes(searchLower)
    );
  });

  // Get employees with existing conversations
  const employeesWithConversations = new Set(
    conversations
      .filter((c) => c.conversationType === "business_employee")
      .flatMap((c) => c.participants?.map((p) => p.businessEmployeeId) || [])
  );

  const activeEmployees = employees.filter((e) => e.status === "active");
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Team Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread} new</Text>
            </View>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <QuickActionCard
          icon="bullhorn"
          label="Broadcast"
          sublabel="Message all"
          color={colors.secondary[500]}
          onPress={() => setShowBroadcast(true)}
        />
        <QuickActionCard
          icon="comments"
          label="Conversations"
          sublabel={`${conversations.length} active`}
          color={colors.primary[500]}
          badge={totalUnread}
          onPress={() => setActiveTab("conversations")}
        />
        <QuickActionCard
          icon="users"
          label="Team"
          sublabel={`${activeEmployees.length} members`}
          color={colors.success[500]}
          onPress={() => setActiveTab("employees")}
        />
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={activeTab === "conversations" ? "Search conversations..." : "Search employees..."}
        />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "conversations" && styles.tabActive]}
          onPress={() => setActiveTab("conversations")}
        >
          <Icon
            name="comments"
            size={16}
            color={activeTab === "conversations" ? colors.primary[600] : colors.neutral[400]}
          />
          <Text style={[styles.tabText, activeTab === "conversations" && styles.tabTextActive]}>
            Conversations
          </Text>
          {totalUnread > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "employees" && styles.tabActive]}
          onPress={() => setActiveTab("employees")}
        >
          <Icon
            name="user-plus"
            size={16}
            color={activeTab === "employees" ? colors.primary[600] : colors.neutral[400]}
          />
          <Text style={[styles.tabText, activeTab === "employees" && styles.tabTextActive]}>
            New Message
          </Text>
        </Pressable>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => setError(null)}>
            <Icon name="times" size={16} color={colors.error[600]} />
          </Pressable>
        </View>
      )}

      {/* Content */}
      {activeTab === "conversations" ? (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={() => navigate(`/messages/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="comments-o"
              title="No conversations yet"
              message="Start a conversation with an employee or send a team announcement to get started."
              action={() => setActiveTab("employees")}
              actionLabel="Start a Conversation"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredEmployees}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <EmployeeCard
              employee={item}
              onPress={() => startConversation(item.id)}
              hasConversation={employeesWithConversations.has(item.id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={searchQuery ? "No matches found" : "No employees yet"}
              message={
                searchQuery
                  ? "Try a different search term"
                  : "Invite employees to your team to start messaging them."
              }
              action={!searchQuery ? () => navigate("/business-owner/employees") : null}
              actionLabel="Manage Employees"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Broadcast Modal */}
      <BroadcastModal
        visible={showBroadcast}
        onClose={() => setShowBroadcast(false)}
        onSend={sendBroadcast}
        isSending={isSending}
        employeeCount={activeEmployees.length}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerBadge: {
    backgroundColor: colors.error[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  headerBadgeText: {
    color: "#fff",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  headerSpacer: {
    width: 40,
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.xl,
    alignItems: "center",
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  quickActionBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error[500],
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  quickActionBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  quickActionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  quickActionSublabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Search
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: 4,
  },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  tabBadge: {
    backgroundColor: colors.error[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },

  // Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },

  // List Content
  listContent: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },

  // Employee Card
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  employeeAvatarContainer: {
    position: "relative",
  },
  employeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  employeeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: spacing.sm,
  },
  employeeStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  hasConversationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 4,
  },
  hasConversationText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  messageIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },

  // Conversation Item
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  conversationUnread: {
    backgroundColor: colors.primary[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  conversationIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  conversationContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conversationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    flex: 1,
  },
  conversationTitleUnread: {
    fontWeight: typography.fontWeight.bold,
  },
  conversationTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  conversationPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  conversationPreview: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  conversationPreviewUnread: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  unreadBadge: {
    backgroundColor: colors.primary[600],
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.secondary[500],
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    padding: spacing.lg,
  },
  broadcastTips: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  inputContainer: {
    position: "relative",
  },
  broadcastInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 140,
    textAlignVertical: "top",
  },
  charCount: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.md,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  charCountWarning: {
    color: colors.warning[600],
  },
  modalFooter: {
    flexDirection: "row",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  sendButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    gap: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
});

export default EmployeeMessaging;
