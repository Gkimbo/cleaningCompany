import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/Feather";
import { UserContext } from "../../context/UserContext";
import MessageService from "../../services/fetchRequests/MessageClass";
import { useSocket } from "../../services/SocketContext";
import NewConversationModal from "./NewConversationModal";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const TABS = {
  ALL: "all",
  SUPPORT: "support",
  TEAM: "team",
  BROADCASTS: "broadcasts",
};

const ConversationList = () => {
  const { state, dispatch } = useContext(UserContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS.ALL);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const {
    onBroadcast,
    onUnreadUpdate,
    onNewMessage,
    onAddedToConversation,
    onNewInternalConversation,
    onConversationDeleted,
  } = useSocket();

  const isOwner = state.account === "owner";
  const isHR = state.account === "humanResources";
  const canCreateConversation = isOwner || isHR;

  const fetchConversations = useCallback(async () => {
    if (!state.currentUser?.token) return;

    try {
      const response = await MessageService.getConversations(state.currentUser.token);
      if (response.conversations) {
        dispatch({ type: "SET_CONVERSATIONS", payload: response.conversations });

        // Calculate total unread
        const totalUnread = response.conversations.reduce(
          (sum, conv) => sum + (conv.unreadCount || 0),
          0
        );
        dispatch({ type: "SET_UNREAD_COUNT", payload: totalUnread });
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser?.token, dispatch]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Listen for broadcasts
  useEffect(() => {
    const unsubscribe = onBroadcast((data) => {
      dispatch({ type: "ADD_CONVERSATION", payload: data.conversation });
      dispatch({ type: "INCREMENT_UNREAD" });
    });
    return unsubscribe;
  }, [onBroadcast, dispatch]);

  // Listen for unread updates
  useEffect(() => {
    const unsubscribe = onUnreadUpdate(() => {
      fetchConversations();
    });
    return unsubscribe;
  }, [onUnreadUpdate, fetchConversations]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onNewMessage(() => {
      fetchConversations();
    });
    return unsubscribe;
  }, [onNewMessage, fetchConversations]);

  // Listen for being added to conversation
  useEffect(() => {
    const unsubscribe = onAddedToConversation(() => {
      fetchConversations();
    });
    return unsubscribe;
  }, [onAddedToConversation, fetchConversations]);

  // Listen for new internal conversations (Owner/HR)
  useEffect(() => {
    const unsubscribe = onNewInternalConversation(() => {
      fetchConversations();
    });
    return unsubscribe;
  }, [onNewInternalConversation, fetchConversations]);

  // Listen for conversation deletion
  useEffect(() => {
    const unsubscribe = onConversationDeleted(({ conversationId }) => {
      // Remove the conversation from state
      dispatch({ type: "REMOVE_CONVERSATION", payload: conversationId });
    });
    return unsubscribe;
  }, [onConversationDeleted, dispatch]);

  // Handle conversation deletion (owner only)
  const handleDeleteConversation = useCallback((conv) => {
    if (!isOwner) return;

    const title = getConversationTitle(conv);
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete "${title}"? This will permanently remove all messages for all participants.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await MessageService.deleteConversation(
                conv.conversationId,
                state.currentUser.token
              );
              if (result.success) {
                dispatch({ type: "REMOVE_CONVERSATION", payload: conv.conversationId });
              } else if (result.error) {
                Alert.alert("Error", result.error);
              }
            } catch (error) {
              console.error("Error deleting conversation:", error);
              Alert.alert("Error", "Failed to delete conversation");
            }
          },
        },
      ]
    );
  }, [isOwner, state.currentUser?.token, dispatch]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return "now";
    } else if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getConversationTitle = (conv) => {
    const conversation = conv.conversation;
    if (!conversation) return "Conversation";

    if (conversation.conversationType === "broadcast") {
      return conversation.title || "Announcement";
    }
    if (conversation.conversationType === "support") {
      if (isOwner || isHR) {
        return conversation.title || "Support Request";
      }
      return "Support";
    }
    if (conversation.conversationType === "internal") {
      // Check if it's a group or 1-on-1
      if (conversation.title) {
        return conversation.title;
      }
      // Get other participant names for 1-on-1
      const otherParticipants = conversation.participants?.filter(
        (p) => p.userId !== parseInt(state.currentUser?.userId)
      );
      if (otherParticipants?.length === 1) {
        const user = otherParticipants[0].user;
        return user?.username || "Team Member";
      }
      if (otherParticipants?.length > 1) {
        return "Team Chat";
      }
    }
    // Business owner <-> Employee conversations
    if (conversation.conversationType === "business_employee" ||
        conversation.conversationType === "employee_group") {
      if (conversation.title) {
        return conversation.title;
      }
      // Get other participant names
      const otherParticipants = conversation.participants?.filter(
        (p) => p.userId !== parseInt(state.currentUser?.userId)
      );
      if (otherParticipants?.length === 1) {
        const user = otherParticipants[0].user;
        if (user?.firstName) {
          return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
        }
        return user?.username || "Employee";
      }
      if (otherParticipants?.length > 1) {
        const firstUser = otherParticipants[0].user;
        const name = firstUser?.firstName || firstUser?.username || "Employee";
        return `${name} +${otherParticipants.length - 1}`;
      }
    }
    if (conversation.appointment) {
      const date = new Date(conversation.appointment.date);
      return `Appt - ${date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })}`;
    }
    // Get other participant names
    const otherParticipants = conversation.participants?.filter(
      (p) => p.userId !== parseInt(state.currentUser?.userId)
    );
    if (otherParticipants?.length > 0) {
      const firstUser = otherParticipants[0].user;
      const name = firstUser?.username || "User";
      if (otherParticipants.length > 1) {
        return `${name} +${otherParticipants.length - 1}`;
      }
      return name;
    }
    return "Conversation";
  };

  const getPreviewText = (conv) => {
    const lastMessage = conv.conversation?.messages?.[0];
    if (lastMessage) {
      if (lastMessage.deletedAt) {
        return "Message was deleted";
      }
      const isMine = lastMessage.senderId === parseInt(state.currentUser?.userId);
      const prefix = isMine ? "You: " : "";
      const content = lastMessage.content.length > 50
        ? lastMessage.content.substring(0, 50) + "..."
        : lastMessage.content;
      return `${prefix}${content}`;
    }
    return "No messages yet";
  };

  const getInitials = (title) => {
    return title
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getConversationType = (conv) => {
    const type = conv.conversation?.conversationType;
    if (type === "broadcast") return TABS.BROADCASTS;
    if (type === "support") return TABS.SUPPORT;
    if (type === "internal") return TABS.TEAM;
    if (type === "business_employee" || type === "employee_group") return TABS.TEAM;
    return TABS.ALL;
  };

  const getTypeIcon = (conv) => {
    const type = conv.conversation?.conversationType;
    if (type === "broadcast") return { name: "radio", color: colors.warning[500] };
    if (type === "support") return { name: "life-buoy", color: colors.primary[500] };
    if (type === "internal") return { name: "users", color: colors.secondary[500] };
    if (type === "business_employee") return { name: "user", color: colors.success[500] };
    if (type === "employee_group") return { name: "users", color: colors.success[500] };
    if (conv.conversation?.appointment) return { name: "calendar", color: colors.success[500] };
    return { name: "message-circle", color: colors.neutral[400] };
  };

  const handleConversationPress = (conv) => {
    navigate(`/messages/${conv.conversationId}`);
  };

  // Filter conversations based on active tab and search
  const filteredConversations = (state.conversations || []).filter((conv) => {
    // Filter by tab
    if (activeTab !== TABS.ALL) {
      const convType = getConversationType(conv);
      if (convType !== activeTab && convType !== TABS.ALL) {
        // Special handling - appointment convos should show in ALL only
        if (activeTab === TABS.BROADCASTS && conv.conversation?.conversationType !== "broadcast") return false;
        if (activeTab === TABS.SUPPORT && conv.conversation?.conversationType !== "support") return false;
        if (activeTab === TABS.TEAM) {
          const teamTypes = ["internal", "business_employee", "employee_group"];
          if (!teamTypes.includes(conv.conversation?.conversationType)) return false;
        }
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const title = getConversationTitle(conv).toLowerCase();
      const preview = getPreviewText(conv).toLowerCase();
      const query = searchQuery.toLowerCase();
      return title.includes(query) || preview.includes(query);
    }

    return true;
  });

  // Get available tabs based on role
  const getAvailableTabs = () => {
    if (isOwner || isHR) {
      return [
        { key: TABS.ALL, label: "All", icon: "inbox" },
        { key: TABS.SUPPORT, label: "Support", icon: "life-buoy" },
        { key: TABS.TEAM, label: "Team", icon: "users" },
        { key: TABS.BROADCASTS, label: "Broadcasts", icon: "radio" },
      ];
    }
    // Cleaners/Clients only see All tab
    return [{ key: TABS.ALL, label: "All", icon: "inbox" }];
  };

  const renderConversationItem = ({ item: conv }) => {
    const title = getConversationTitle(conv);
    const typeIcon = getTypeIcon(conv);
    const hasUnread = conv.unreadCount > 0;
    const isBroadcast = conv.conversation?.conversationType === "broadcast";
    const isGroup = (conv.conversation?.participants?.length || 0) > 2;

    return (
      <Pressable
        onPress={() => handleConversationPress(conv)}
        onLongPress={isOwner ? () => handleDeleteConversation(conv) : undefined}
        delayLongPress={500}
        style={({ pressed }) => [
          styles.conversationItem,
          hasUnread && styles.conversationItemUnread,
          pressed && styles.conversationItemPressed,
        ]}
      >
        {/* Avatar */}
        <View style={[
          styles.avatar,
          isBroadcast && styles.avatarBroadcast,
        ]}>
          {isBroadcast ? (
            <Icon name="radio" size={20} color={colors.warning[600]} />
          ) : isGroup ? (
            <Icon name="users" size={18} color={colors.text.secondary} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(title)}</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.conversationTitle,
                  hasUnread && styles.conversationTitleUnread,
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
              <View style={[styles.typeBadge, { backgroundColor: typeIcon.color + "20" }]}>
                <Icon name={typeIcon.name} size={10} color={typeIcon.color} />
              </View>
            </View>
            <Text style={styles.conversationTime}>
              {formatTime(
                conv.conversation?.messages?.[0]?.createdAt ||
                  conv.conversation?.updatedAt
              )}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text
              style={[
                styles.conversationPreview,
                hasUnread && styles.conversationPreviewUnread,
              ]}
              numberOfLines={1}
            >
              {getPreviewText(conv)}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const availableTabs = getAvailableTabs();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigate("/")} style={styles.backButton}>
          <Icon name="arrow-left" size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Messages</Text>
        {canCreateConversation && (
          <Pressable
            onPress={() => setShowNewModal(true)}
            style={styles.newButton}
          >
            <Icon name="edit" size={20} color={colors.primary[500]} />
          </Pressable>
        )}
        {!canCreateConversation && <View style={styles.headerSpacer} />}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Icon name="x" size={18} color={colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {/* Tab Bar */}
      {availableTabs.length > 1 && (
        <View style={styles.tabBar}>
          {availableTabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? colors.primary[500] : colors.text.tertiary}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Conversation List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderConversationItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Icon name="message-circle" size={48} color={colors.neutral[300]} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No results found" : "No conversations yet"}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? "Try a different search term"
                : canCreateConversation
                ? "Tap the compose button to start a new conversation"
                : "Your conversations will appear here"}
            </Text>
          </View>
        }
      />

      {/* FAB for Broadcast (Owner only) */}
      {isOwner && (
        <Pressable
          style={styles.broadcastFab}
          onPress={() => navigate("/messages/broadcast")}
        >
          <Icon name="radio" size={22} color={colors.white} />
        </Pressable>
      )}

      {/* New Conversation Modal */}
      <NewConversationModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  newButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xs,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary[50],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.primary[500],
  },
  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  conversationItemUnread: {
    backgroundColor: colors.primary[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  conversationItemPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  // Avatar
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarBroadcast: {
    backgroundColor: colors.warning[100],
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  // Content
  conversationContent: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  conversationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    flexShrink: 1,
  },
  conversationTitleUnread: {
    fontWeight: typography.fontWeight.bold,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  conversationTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conversationPreview: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  conversationPreviewUnread: {
    color: colors.text.primary,
  },
  unreadBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 22,
    alignItems: "center",
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  // Empty State
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: "center",
    lineHeight: 22,
  },
  // Broadcast FAB
  broadcastFab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.warning[500],
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lg,
  },
});

export default ConversationList;
