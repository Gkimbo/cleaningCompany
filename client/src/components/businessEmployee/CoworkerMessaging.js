import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
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

// Coworker Card Component
const CoworkerCard = ({ coworker, onPress, hasConversation }) => (
  <Pressable style={styles.coworkerCard} onPress={onPress}>
    <View style={styles.coworkerAvatarContainer}>
      <View style={styles.coworkerAvatar}>
        <Text style={styles.coworkerAvatarText}>
          {(coworker.firstName?.[0] || "E").toUpperCase()}
          {(coworker.lastName?.[0] || "").toUpperCase()}
        </Text>
      </View>
      <View style={styles.statusDot} />
    </View>
    <View style={styles.coworkerInfo}>
      <Text style={styles.coworkerName}>
        {coworker.firstName} {coworker.lastName}
      </Text>
      <View style={styles.coworkerMetaRow}>
        <Text style={styles.coworkerStatus}>Coworker</Text>
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

// Conversation Item Component
const ConversationItem = ({ conversation, onPress }) => {
  const lastMessage = conversation.messages?.[0];
  const unreadCount = conversation.unreadCount || 0;
  const displayTitle = conversation.displayTitle || "Conversation";
  const isBusinessOwner = conversation.conversationType === "business_employee";

  const getIcon = () => {
    if (isBusinessOwner) return "briefcase";
    return "user";
  };

  const getIconBg = () => {
    if (isBusinessOwner) return colors.warning[500];
    return colors.primary[500];
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
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
            {displayTitle}
          </Text>
          {lastMessage && (
            <Text style={styles.conversationTime}>{formatTime(lastMessage.createdAt)}</Text>
          )}
        </View>
        {isBusinessOwner && (
          <View style={styles.managerBadge}>
            <Icon name="star" size={10} color={colors.warning[600]} />
            <Text style={styles.managerBadgeText}>Manager</Text>
          </View>
        )}
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
const CoworkerMessaging = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [coworkers, setCoworkers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("conversations");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [coworkersRes, conversationsRes] = await Promise.all([
        fetch(`${API_BASE}/messages/coworkers`, {
          headers: { Authorization: `Bearer ${state.currentUser.token}` },
        }),
        fetch(`${API_BASE}/messages/my-coworker-conversations`, {
          headers: { Authorization: `Bearer ${state.currentUser.token}` },
        }),
      ]);

      const coworkersData = await coworkersRes.json();
      const conversationsData = await conversationsRes.json();

      if (coworkersRes.ok) {
        setCoworkers(coworkersData.coworkers || []);
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

  const startConversation = async (coworkerId) => {
    try {
      const response = await fetch(`${API_BASE}/messages/coworker-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ coworkerId }),
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

  const messageManager = async () => {
    try {
      // Create conversation with business owner (employeeId not needed - backend knows)
      const response = await fetch(`${API_BASE}/messages/employee-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (response.ok && data.conversation) {
        navigate(`/messages/${data.conversation.id}`);
      } else {
        setError(data.error || "Failed to start conversation with manager");
      }
    } catch (err) {
      console.error("Error starting manager conversation:", err);
      setError("Failed to start conversation");
    }
  };

  // Filter data based on search
  const filteredCoworkers = coworkers.filter((cw) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      cw.firstName?.toLowerCase().includes(searchLower) ||
      cw.lastName?.toLowerCase().includes(searchLower)
    );
  });

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return conv.displayTitle?.toLowerCase().includes(searchLower);
  });

  // Get coworkers with existing conversations
  const coworkersWithConversations = new Set(
    conversations
      .filter((c) => c.conversationType === "employee_peer")
      .flatMap((c) => c.participants?.map((p) => p.businessEmployeeId) || [])
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const managerConversation = conversations.find((c) => c.conversationType === "business_employee");

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
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Team Chat</Text>
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
          icon="briefcase"
          label="Manager"
          sublabel={managerConversation ? "Continue chat" : "Start chat"}
          color={colors.warning[500]}
          onPress={messageManager}
          badge={managerConversation?.unreadCount || 0}
        />
        <QuickActionCard
          icon="comments"
          label="Chats"
          sublabel={`${conversations.length} active`}
          color={colors.primary[500]}
          badge={totalUnread}
          onPress={() => setActiveTab("conversations")}
        />
        <QuickActionCard
          icon="users"
          label="Team"
          sublabel={`${coworkers.length} coworkers`}
          color={colors.success[500]}
          onPress={() => setActiveTab("coworkers")}
        />
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={activeTab === "conversations" ? "Search conversations..." : "Search coworkers..."}
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
          style={[styles.tab, activeTab === "coworkers" && styles.tabActive]}
          onPress={() => setActiveTab("coworkers")}
        >
          <Icon
            name="user-plus"
            size={16}
            color={activeTab === "coworkers" ? colors.primary[600] : colors.neutral[400]}
          />
          <Text style={[styles.tabText, activeTab === "coworkers" && styles.tabTextActive]}>
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
              message="Start a conversation with a coworker or your manager to coordinate on jobs."
              action={() => setActiveTab("coworkers")}
              actionLabel="Message a Coworker"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredCoworkers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <CoworkerCard
              coworker={item}
              onPress={() => startConversation(item.id)}
              hasConversation={coworkersWithConversations.has(item.id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={searchQuery ? "No matches found" : "No coworkers yet"}
              message={
                searchQuery
                  ? "Try a different search term"
                  : "You're the only employee on the team right now."
              }
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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

  // Coworker Card
  coworkerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  coworkerAvatarContainer: {
    position: "relative",
  },
  coworkerAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  coworkerAvatarText: {
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
    backgroundColor: colors.success[500],
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  coworkerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  coworkerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  coworkerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: spacing.sm,
  },
  coworkerStatus: {
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
  managerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  managerBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.medium,
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
});

export default CoworkerMessaging;
